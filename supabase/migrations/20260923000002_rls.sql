-- Row Level Security — the cheap backstop layer (own-row / direct-friend predicates only).
-- Multi-hop discovery and every state-changing operation live in SECURITY DEFINER functions
-- (20260923000003_functions.sql), not here — RLS cannot safely express graph traversal and
-- a client-checkable policy cannot derive server-side values like requests.owner_id.
--
-- Every auth.uid() call below is wrapped as (select auth.uid()) so Postgres evaluates it once
-- per statement rather than once per row (see docs/DATABASE_DESIGN.md §8 "policy hygiene").
--
-- No `grant select/insert/update/delete ... to authenticated` statements appear below: a
-- stock Supabase project already grants table-level privileges on the public schema to
-- `anon`/`authenticated` as part of its own bootstrap, and RLS is what actually restricts
-- rows. If this schema is ever applied to a non-Supabase Postgres, those grants need adding
-- explicitly first — table-level privilege and row-level security are two separate gates.

alter table profiles              enable row level security;
alter table friend_requests       enable row level security;
alter table friendships           enable row level security;
alter table friend_edges          enable row level security;
alter table user_blocks           enable row level security;
alter table issuers               enable row level security;
alter table card_networks         enable row level security;
alter table catalog_items         enable row level security;
alter table catalog_cards         enable row level security;
alter table use_cases             enable row level security;
alter table catalog_card_use_cases enable row level security;
alter table resources             enable row level security;
alter table requests              enable row level security;
alter table request_events        enable row level security;
alter table search_events         enable row level security;

-- ── profiles ─────────────────────────────────────────────────────────────────
-- Full row (including phone) is self-only. Everyone else resolves display names through
-- the profiles_public view below — not through this table directly.
create policy profiles_self_read on profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_self_write on profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy profiles_self_update on profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- safe-columns projection for resolving a display name (a friend, a pending request's
-- sender, a search result's owner) — never phone. security_invoker = false so it works
-- without a matching RLS predicate on profiles; granted to `authenticated` only, never
-- `anon` — this is a trusted-network app, not a public directory.
create view profiles_public with (security_invoker = false) as
  select id, display_name, status from profiles;
revoke all on profiles_public from public, anon;
grant select on profiles_public to authenticated;

-- ── trust graph ──────────────────────────────────────────────────────────────
create policy friend_requests_party_read on friend_requests for select to authenticated
  using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));
-- no INSERT/UPDATE policy: friend_requests is written only by send_friend_request(),
-- accept_friend_request() and decline_friend_request() (SECURITY DEFINER).

create policy friendships_party_read on friendships for select to authenticated
  using (user_a = (select auth.uid()) or user_b = (select auth.uid()));
-- no write policy: friendships is written only by accept_friend_request()/block_user()/
-- remove_friend() — a client insert here would represent unproven bidirectional consent.

create policy friend_edges_own on friend_edges for select to authenticated
  using (user_id = (select auth.uid()));
-- no write policy: friend_edges is maintained only by the sync_friend_edges trigger.

create policy blocks_own on user_blocks for all to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));

-- ── catalog (public read-mostly reference data) ────────────────────────────
create policy issuers_read on issuers for select to authenticated using (true);
create policy networks_read on card_networks for select to authenticated using (true);
create policy use_cases_read on use_cases for select to authenticated using (true);
create policy catalog_items_read on catalog_items for select to authenticated using (active);
create policy catalog_cards_read on catalog_cards for select to authenticated
  using (exists (select 1 from catalog_items ci where ci.id = catalog_item_id and ci.active));
create policy catalog_card_use_cases_read on catalog_card_use_cases for select to authenticated
  using (exists (select 1 from catalog_items ci where ci.id = catalog_item_id and ci.active));
-- no write policies anywhere in the catalog: seeded only via migrations/seed.sql, run as
-- the migration role, which bypasses RLS entirely (table owner).

-- ── resources ────────────────────────────────────────────────────────────────
create policy resources_owner_all on resources for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy resources_friends_read on resources for select to authenticated
  using (
    status = 'active' and visibility_depth >= 1
    and exists (
      select 1 from friend_edges e
      where e.user_id = (select auth.uid()) and e.friend_id = resources.owner_id
    )
  );
-- friends-of-friends (depth 2) visibility for a single resource read is not expressible
-- as RLS (needs a two-hop self-join); that path goes through get_resource() instead.
-- with-check on the owner insert above allows writing any catalog_item_id; the FK plus
-- the fact that catalog_items itself has no INSERT policy already prevents referencing
-- a catalog item that isn't real — nothing further to add here.

-- ── requests ─────────────────────────────────────────────────────────────────
create policy requests_party_read on requests for select to authenticated
  using (requester_id = (select auth.uid()) or owner_id = (select auth.uid()));
-- deliberately no INSERT/UPDATE policy: owner_id/intermediary_id must be *derived*
-- server-side from the resource + friend graph (create_request()); a client-checkable
-- WITH CHECK can only validate columns the client supplies, which would force the client
-- to compute and submit those values itself — reopening the id-spoofing hole this design
-- exists to close. All writes go through create_request()/respond_to_request()/
-- respond_to_referral() (SECURITY DEFINER).

create policy request_events_party_read on request_events for select to authenticated
  using (
    exists (
      select 1 from requests r
      where r.id = request_id
        and (r.requester_id = (select auth.uid()) or r.owner_id = (select auth.uid()))
    )
  );
-- no write policy: request_events is written only by the RPC functions, as part of the
-- same transaction as the state change it logs.

-- search_events: no read/write policy for `authenticated` at all — audit log, written by
-- search_network()/network_graph() as the function owner, read only via service role
-- (analytics), never by clients.
