-- Card Crew — core schema. Ported from docs/DATABASE_DESIGN.md §12, with the RLS
-- hardening from that doc's Revision Notes (2026-09-23) and the issue #3 review already
-- applied here rather than patched later:
--   - profiles_self_read + profiles_public view (authenticated-only, no phone), not a
--     single friend-readable policy.
--   - no requests_insert_own policy — request rows are only ever written by RPC functions
--     (see 20260923000003_functions.sql) that derive owner_id/intermediary_id server-side.
-- RLS policies and grants live in the next migration so every table exists first.

-- ── extensions ───────────────────────────────────────────────────────────────
create extension if not exists pg_trgm;

-- ── enums ────────────────────────────────────────────────────────────────────
create type user_status           as enum ('active', 'blocked', 'deleted');
create type friend_request_status as enum ('pending', 'accepted', 'declined', 'cancelled');
create type resource_status       as enum ('active', 'inactive', 'removed');
create type request_status        as enum ('pending', 'approved', 'declined', 'ignored');
create type referral_status       as enum ('not_required', 'pending', 'approved', 'declined', 'ignored');
create type catalog_item_type     as enum ('card', 'voucher', 'benefit', 'membership');

-- ── identity ─────────────────────────────────────────────────────────────────
create table profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text        not null,
  phone        text        unique,
  status       user_status not null default 'active',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── trust graph ──────────────────────────────────────────────────────────────
create table friend_requests (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles (id) on delete cascade,
  addressee_id uuid not null references profiles (id) on delete cascade,
  status       friend_request_status not null default 'pending',
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);
-- at most one open request per unordered pair
create unique index friend_requests_open_pair
  on friend_requests (least(requester_id, addressee_id), greatest(requester_id, addressee_id))
  where status = 'pending';
create index friend_requests_addressee on friend_requests (addressee_id) where status = 'pending';
-- rate-limit support: send_friend_request() counts recent rows per requester
create index friend_requests_requester_created on friend_requests (requester_id, created_at);

create table friendships (
  user_a             uuid not null references profiles (id) on delete cascade,
  user_b             uuid not null references profiles (id) on delete cascade,
  relationship_group text,
  trust_level        smallint not null default 1 check (trust_level between 0 and 3),
  created_at         timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
-- the PK covers lookups by user_a; user_b needs its own index for the "OR" traversal
-- query (WHERE user_a = $1 OR user_b = $1) to stay index-backed both directions.
create index friendships_user_b on friendships (user_b);

create table friend_edges ( -- written only by the trigger below, never by the app
  user_id   uuid not null references profiles (id) on delete cascade,
  friend_id uuid not null references profiles (id) on delete cascade,
  primary key (user_id, friend_id)
);

create function sync_friend_edges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.friend_edges (user_id, friend_id)
    values (new.user_a, new.user_b), (new.user_b, new.user_a)
    on conflict do nothing;
  elsif tg_op = 'DELETE' then
    delete from public.friend_edges
    where (user_id, friend_id) in ((old.user_a, old.user_b), (old.user_b, old.user_a));
  end if;
  return null;
end;
$$;

create trigger friendships_sync
  after insert or delete on friendships
  for each row execute function sync_friend_edges();

create table user_blocks (
  blocker_id uuid not null references profiles (id) on delete cascade,
  blocked_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index user_blocks_blocked on user_blocks (blocked_id);

-- ── catalog ──────────────────────────────────────────────────────────────────
create table issuers (
  id      smallint generated always as identity primary key,
  slug    text not null unique,
  name    text not null,
  country char(2) not null
);

create table card_networks (
  id   smallint generated always as identity primary key,
  slug text not null unique,
  name text not null
);

create table catalog_items (
  id          uuid primary key default gen_random_uuid(),
  item_type   catalog_item_type not null,
  issuer_id   smallint references issuers (id),
  name        text not null,
  country     char(2) not null,
  active      boolean not null default true,
  search_text text not null default '', -- maintained by trigger below (needs issuer name)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (issuer_id, item_type, name)
);
create index catalog_items_search on catalog_items using gin (search_text gin_trgm_ops);

create table catalog_cards (
  catalog_item_id uuid primary key references catalog_items (id) on delete cascade,
  card_type       text     not null check (card_type in ('credit', 'debit', 'charge', 'co-branded')),
  card_category   text     not null check (card_category in ('credit', 'debit', 'prepaid', 'charge')),
  network_id      smallint not null references card_networks (id),
  variant         text,
  upi_enabled     boolean  not null default false
);

create table use_cases (
  id   smallint generated always as identity primary key,
  slug text not null unique
);

create table catalog_card_use_cases (
  catalog_item_id uuid     not null references catalog_cards (catalog_item_id) on delete cascade,
  use_case_id     smallint not null references use_cases (id),
  primary key (catalog_item_id, use_case_id)
);

create function set_catalog_search_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_text := lower(coalesce((select name from public.issuers where id = new.issuer_id) || ' ', '') || new.name);
  new.updated_at  := now();
  return new;
end;
$$;
create trigger catalog_items_search_text
  before insert or update on catalog_items
  for each row execute function set_catalog_search_text();

-- convenience read view for the frontend — embeds issuer/network/use_cases so a single
-- PostgREST call can fetch a browsable card list without N+1 lookups (see issue #3 review).
create view catalog_cards_view with (security_invoker = true) as
  select
    ci.id, ci.name as product_name, ci.country, ci.active,
    i.name as issuer, i.slug as issuer_slug,
    cc.card_type, cc.card_category, cc.variant, cc.upi_enabled,
    n.name as network,
    coalesce(
      (select array_agg(uc.slug order by uc.slug)
         from catalog_card_use_cases ccu join use_cases uc on uc.id = ccu.use_case_id
        where ccu.catalog_item_id = ci.id),
      '{}'
    ) as use_cases
  from catalog_items ci
  join catalog_cards cc on cc.catalog_item_id = ci.id
  join issuers i on i.id = ci.issuer_id
  join card_networks n on n.id = cc.network_id
  where ci.item_type = 'card';

-- ── resources ────────────────────────────────────────────────────────────────
create table resources (
  id                        uuid primary key default gen_random_uuid(),
  owner_id                  uuid not null references profiles (id) on delete cascade,
  catalog_item_id           uuid not null references catalog_items (id),
  visibility_depth          smallint not null default 1 check (visibility_depth between 0 and 3),
  request_enabled           boolean  not null default true,
  share_contact_on_approval boolean  not null default true,
  availability_status       text     not null default 'available',
  expiry_at                 timestamptz,
  status                    resource_status not null default 'active',
  notes                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create unique index resources_owner_item_uniq
  on resources (owner_id, catalog_item_id) where status <> 'removed';
create index resources_by_item on resources (catalog_item_id, owner_id)
  include (id, visibility_depth, request_enabled)
  where status = 'active' and visibility_depth > 0;
create index resources_by_owner on resources (owner_id) where status <> 'removed';
alter table resources alter column catalog_item_id set statistics 1000;

-- ── requests + audit ─────────────────────────────────────────────────────────
create table requests (
  id              uuid primary key default gen_random_uuid(),
  requester_id    uuid not null references profiles (id) on delete cascade,
  owner_id        uuid not null references profiles (id) on delete cascade,
  resource_id     uuid not null references resources (id) on delete cascade,
  intermediary_id uuid references profiles (id) on delete set null,
  message         text not null default '',
  status          request_status  not null default 'pending',
  referral_status referral_status not null default 'not_required',
  created_at      timestamptz not null default now(),
  responded_at    timestamptz,
  check (requester_id <> owner_id)
);
create index requests_owner_pending on requests (owner_id, created_at desc) where status = 'pending';
create index requests_requester on requests (requester_id, created_at desc);
create index requests_resource on requests (resource_id);
create index requests_intermediary on requests (intermediary_id) where intermediary_id is not null;
-- rate-limit support: create_request() counts recent rows per requester
create index requests_requester_created on requests (requester_id, created_at);

create table request_events (
  id         bigint generated always as identity primary key,
  request_id uuid not null references requests (id) on delete cascade,
  actor_id   uuid references profiles (id) on delete set null,
  event      text not null,
  created_at timestamptz not null default now()
);
create index request_events_request on request_events (request_id, created_at);

create table search_events (
  id              bigint generated always as identity,
  user_id         uuid        not null,
  catalog_item_id uuid        not null,
  max_depth       smallint    not null,
  result_count    int         not null,
  created_at      timestamptz not null default now(),
  primary key (id, created_at)
) partition by range (created_at);
-- monthly partitions are created/dropped by a pg_cron job (see docs/DATABASE_DESIGN.md §11);
-- one bootstrap partition so inserts don't fail before the job first runs.
create table search_events_2026_09 partition of search_events
  for values from ('2026-09-01') to ('2026-10-01');
create table search_events_2026_10 partition of search_events
  for values from ('2026-10-01') to ('2026-11-01');
