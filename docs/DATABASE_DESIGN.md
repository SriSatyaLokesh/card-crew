# Card Crew — Database Design (Postgres on Supabase)

**Status:** Proposed target design. Derived from the PRD only, not from the current schema.
**Source:** [trusted_personal_resource_network_prd.md](trusted_personal_resource_network_prd.md)
**Companion:** [DATABASE_MIGRATION_PLAN.md](DATABASE_MIGRATION_PLAN.md) — how to get from the current schema to this one.
**Phase tags:** `[MVP]` `[V1]` `[V2]`. Everything tagged MVP is specified as runnable DDL in §12; V1/V2 are sketched.

---

## 1. Principles

1. **Postgres does the graph work.** Traversal, visibility filtering and ranking run in SQL. The API layer calls one function and returns rows.
2. **Privacy is enforced in the database.** The API can have bugs; a query it forgets to filter must still not leak.
3. **Nothing we filter or join on lives in `jsonb` or `text[]`.** Those are for display-only extras.
4. **Generic resource, typed detail.** One `resources` table forever; type-specific fields in 1:1 detail tables.
5. **Metadata only.** No card numbers, CVV, PIN, OTP or credentials (PRD §13.2). Nothing in this schema can hold them.
6. **Design for the shape of the query, not the shape of the entity.** The hot query is *"holders of card X within N hops of me"*; indexes and table layout are chosen for it.

---

## 2. Entity overview

```text
auth.users ─1:1─ profiles ──┬── friend_requests        lifecycle (pending/accepted/declined)
                            ├── friendships            canonical undirected edge   ┐ trigger
                            │   └─ friend_edges        symmetric mirror, for scans ┘
                            ├── user_blocks
                            ├── user_reliability       rollup for ranking
                            └── resources ──── catalog_items ──┬─ catalog_cards (+ use cases)
                                  │                            ├─ vouchers / benefits  [V1]
                                  │                            └─ issuers, card_networks
                                  ├── resource_policies  [V1]
                                  └── requests ── request_events
                                                  search_events (partitioned)
merchants ── offers ── offer_eligible_cards ── catalog_items   [V1]
```

---

## 3. Identity `[MVP]`

- `profiles.id uuid` **is** `auth.users.id` (`references auth.users(id) on delete cascade`). One identity, no shadow user table, no ID drift, and `auth.uid()` works directly in RLS.
- Email lives in `auth.users`; `profiles` holds `display_name`, optional `phone`, `status`, and privacy-relevant defaults.
- All timestamps are `timestamptz`.
- `user_reliability(user_id, requests_received, requests_approved, median_response_seconds, updated_at)` is a rollup recomputed by `pg_cron` — never computed on the read path. Feeds ranking (PRD §11.3). `[V1]`

---

## 4. Trust graph `[MVP]`

The graph is the product, so it gets four tables with one job each.

| Table | Job | Notes |
|---|---|---|
| `friend_requests` | Lifecycle of an invitation | Directional. `pending → accepted / declined / cancelled`. History kept. |
| `friendships` | The accepted edge | **One row per pair**, `user_a < user_b` enforced by `CHECK`. Carries `relationship_group`, `trust_level`. |
| `friend_edges` | Traversal index | **Two rows per friendship** `(a,b)` and `(b,a)`, maintained by trigger. Never written by the app. |
| `user_blocks` | Blocks | Directional, independent of friendship. |

**Why two edge tables.** An undirected pair stored once is the correct source of truth (no duplicate/reversed rows, `(a,b)` uniqueness is trivial). But it makes *"all friends of X"* a `WHERE user_a = X OR user_b = X` query, which one B-tree cannot serve. `friend_edges` is the same data pre-doubled so *"all friends of X"* is `WHERE user_id = X` — a primary-key range scan, index-only.

**Why blocks are not a friendship status.** A block is a directional safety control with its own lifecycle. If it is a status on the friendship row, unblocking destroys the friendship, a block can only be recorded when a friendship exists, and the blocked side can't be hidden from search. Blocking a friend deletes the friendship in the same transaction; search and request paths exclude any pair with a block in *either* direction.

**Why not one row per direction as source of truth.** Two rows per friendship as the *writable* model means every accept/remove must touch both atomically, and drift between them becomes a data-integrity bug. Here only the trigger writes the mirror.

---

## 5. Degree traversal `[MVP]` → `[V1]` → future

Search depth is a first-class parameter (PRD §11.2): MVP = 1, V1 = 2, future = N.

### 5.1 Depth 1 — index scan

```sql
select friend_id from friend_edges where user_id = $me;
```

Cost ∝ your friend count.

### 5.2 Depth 2 — one self-join, no recursion

```sql
select e2.friend_id, e2.user_id as via
from friend_edges e1
join friend_edges e2 on e2.user_id = e1.friend_id
where e1.user_id = $me and e2.friend_id <> $me;
```

Exactly two hops, `via_user_id` (PRD §12.3: *"2nd-degree via Rahul"*) falls out for free, one round trip. Cost ∝ friends × their friends.

### 5.3 Depth 3+ — recursive CTE, filtered first

Do **not** expand the whole neighbourhood then filter by card. Invert it: find holders of the card first (small set, indexed by `catalog_item_id`), then test reachability of those holders within N hops with a depth-capped recursive CTE and a hard `LIMIT`. Depth cap and row cap come from config, not user input.

### 5.4 Why per-viewer reach is not precomputed

Average degree `d = 150`:

| Depth | Reachable per user (approx.) |
|---|---|
| 1 | 150 |
| 2 | ~22,500 |
| 3 | ~3,400,000 |

Materialising depth 3 for every user is millions of rows *per user*, and one new friendship rewrites the neighbourhoods of everyone within 2 hops of both people. Depth ≤ 2 is materialisable; depth 3 is not. So:

- **Default:** compute at query time (§5.1–5.3).
- **Escape hatch `[V1+]`:** `network_reach(user_id, reachable_id, depth, via_id)` for depth ≤ 2 only, built incrementally by trigger with a `pg_cron` repair job. **Enable only when** measured p95 of `search_network()` at depth 2 exceeds the agreed budget (suggest 150 ms) on production-sized data. Not before — it adds write amplification and a correctness burden that a small graph doesn't need.
- **Depth 3+ future:** recursive CTE with card-first filter (§5.3); revisit only if that measurably fails.

### 5.5 Privacy interaction with depth

Result rows expose `depth` and `via_user_id` only — never the intermediate graph (PRD §12.3). A depth-2 hit reveals *one* mutual friend, and only when that friend is not blocked/hidden.

---

## 6. Catalog `[MVP]` → `[V1]`

Lookup tables replace free-text columns, which drift ("HDFC" / "HDFC Bank" / "hdfc").

- `issuers(id, slug, name, country)`; `card_networks(id, slug, name)`.
- `catalog_items(id uuid, item_type, issuer_id, name, country, active, search_text)` — **one** surrogate key for everything a resource can point at (card now; voucher, benefit, membership later). `resources.catalog_item_id` is therefore a single FK for the life of the product.
- `catalog_cards(catalog_item_id PK/FK, card_type, card_category, network_id, variant, upi_enabled)` — card-specific, filterable columns.
- `use_cases(id, slug)` + `catalog_card_use_cases(catalog_item_id, use_case_id)` — replaces an array column so "cards for travel" is an indexed join.
- `catalog_items.search_text` — `lower(issuer.name || ' ' || item name)`, maintained by a `before insert/update` trigger (a generated column cannot read another table). GIN `gin_trgm_ops` index gives typo-tolerant type-ahead: `where search_text % 'infinia' order by similarity(...)`.
- `unaccent` is not immutable, so it cannot go in an index expression directly; either skip it (catalog is English) or add an `IMMUTABLE` wrapper function.
- Catalog is **global, read-mostly, curated** (PRD §24 trade-off 1). RLS: `select` for `authenticated`; writes only by service role.

---

## 7. Resources `[MVP]`

```text
resources
  id, owner_id → profiles, catalog_item_id → catalog_items,
  visibility_depth smallint  (0 private, 1 friends, 2 friends-of-friends, 3 network),
  request_enabled bool, share_contact_on_approval bool,
  availability_status, expiry_at, status (active/inactive/removed), notes,
  created_at, updated_at
```

- **`visibility_depth` as a number** (not an unordered enum) makes the privacy check a single comparison inside the search: `reach.depth <= r.visibility_depth`. It also means *friends-of-friends* is a real level — a resource can be visible to FoF without being visible to the whole network, which the PRD §12.1 requires and a three-value `private/friends/network` enum cannot express.
- **Three independent permissions** (PRD §12.2): discover = `visibility_depth`; request = `request_enabled`; contact reveal = `share_contact_on_approval`. They are separate columns, not one flag.
- **Duplicate guard:** partial unique index on `(owner_id, catalog_item_id) where status <> 'removed'`.
- **Soft delete** via `status = 'removed'`; partial indexes exclude removed rows so they cost nothing at read time.
- **Type detail, V1:** `resource_vouchers(resource_id PK/FK, code_hash?, face_value, currency, valid_to)`, `resource_benefit_access(resource_id PK/FK, entitlements, guest_limit)`. Class-table inheritance: no sparse nullable columns on the hot table. Voucher codes, if ever stored, are encrypted/hashed and never in search-visible columns.
- **Policy `[V1]`:** `resource_policies(catalog_item_id or resource_type, discoverable, requestable, transferable, lendable, sellable, expirable, location_restricted, relationship_restricted, provider_rules jsonb)` — the PRD §13.5 rule engine. `jsonb` is acceptable here because these are evaluated per catalog item by the app, not filtered across millions of rows.

---

## 8. Privacy enforcement `[MVP]`

Two layers, deliberately different.

**Layer 1 — RLS on every table (backstop).** Only *cheap* predicates:
- own rows (`owner_id = (select auth.uid())`),
- direct friends via `friend_edges`.

**Layer 2 — `SECURITY DEFINER` functions (multi-hop discovery).** Depth-2+ visibility is **not** an RLS policy. A policy that walks the graph would be evaluated per candidate row, and a recursive/self-join predicate inside RLS is pathological for the planner. Instead:
- Clients have **no `select` policy** that lets them enumerate other users' resources beyond direct friends.
- `search_network()` (§9) is `SECURITY DEFINER`, `set search_path = ''`, reads `auth.uid()` itself (never a parameter), and applies visibility, block, status, expiry and policy rules explicitly.
- `revoke execute … from public, anon`; `grant execute … to authenticated`.

Rules for every `SECURITY DEFINER` function: pinned empty `search_path`, fully-qualified object names, no dynamic SQL from parameters, acting user derived from `auth.uid()` only.

Policy hygiene: wrap `auth.uid()` as `(select auth.uid())` so Postgres evaluates it once per statement instead of per row; index every column an RLS predicate touches.

---

## 9. The hot query — "which friend has this card" `[MVP]`

### 9.1 Two plan shapes

The planner must be able to pick, because card popularity is extremely skewed:

| Situation | Best plan | Uses |
|---|---|---|
| Popular card (many holders), small network | Expand *network* first, probe `resources` per member | `resources (owner_id, catalog_item_id)` |
| Rare card, large network | Scan *holders* of the card, test membership in the network set | `resources (catalog_item_id, owner_id)` partial covering |

Both indexes exist. `alter table resources alter column catalog_item_id set statistics 1000;` so the tail of the distribution is estimated correctly rather than guessed from defaults.

### 9.2 Function contract

`search_network(p_catalog_item uuid, p_max_depth int default 1)` returns:

`(owner_id, display_name, resource_id, depth, via_user_id, requestable, needs_referral, trust_level, rank)`

- Acting user is `auth.uid()`. There is **no user-id parameter**.
- `p_max_depth` is clamped to `[1, configured_max]` inside the function.
- Excludes: self, inactive/blocked/deleted profiles, removed/inactive/expired resources, `visibility_depth < depth`, any pair with a block in either direction.
- Returns **one row per holder** (best resource, then shortest path), so the UI never has to dedupe.
- Ranking (PRD §11.3) is done in SQL: shallower depth → higher `trust_level` → availability → reliability; distance is a secondary factor after direct/trust.
- Writes one `search_events` row (audit, PRD criterion 14) — asynchronously via `pg_notify`/queue if it ever shows up in the latency profile.

Reference implementation in §12.

### 9.3 Offer → card → person `[V1]`

PRD §8.4 becomes the same query with the card equality replaced by an eligible-set:

```sql
where r.catalog_item_id in (select card_item_id from offer_eligible_cards where offer_id = $1)
```

Same `(catalog_item_id, owner_id)` index. Merchant search is a trigram lookup on `merchants.search_text`, then join to offers.

---

## 10. Requests & audit `[MVP]`

- `requests(id, requester_id, owner_id, resource_id, intermediary_id, message, status, referral_status, created_at, responded_at)` — `intermediary_id` is the `via` user for a depth-2 request (referral flow).
- `request_events(id, request_id, actor_id, event, created_at)` — append-only; every status transition is a row. Enforces auditability; also the source for `user_reliability`.
- `search_events` — **declaratively partitioned by month** (`partition by range (created_at)`), high write volume, low read. Retention via `pg_cron` detach + drop of old partitions (instant, no `DELETE` bloat). Primary key must include the partition key.
- Request state transitions go through a function (or a `before update` trigger) that validates `pending → approved/declined/ignored` and that only the owner may transition, rather than trusting a generic `update` policy.
- Integrity: `check (requester_id <> owner_id)`; `resource_id` FK; owner on the request must equal `resources.owner_id` (enforced by trigger or composite FK).

---

## 11. Supabase operational notes

- **Pooling.** App traffic through the transaction-mode pooler (port 6543). Prisma needs `?pgbouncer=true` on that URL; **migrations use a separate `DIRECT_URL`** (port 5432) because prepared statements and advisory locks break under transaction pooling.
- **Extensions:** `pg_trgm`, `pg_cron` (enable in Dashboard → Database → Extensions). `unaccent` optional (§6).
- **Migrations:** Prisma remains the client and type generator. Everything Prisma's schema language cannot express — RLS, partial/covering/trigram indexes, triggers, `SECURITY DEFINER` functions, partitioning — is hand-written SQL in `backend/prisma/migrations/*/migration.sql`. Guard against `prisma migrate dev` "drift" by mirroring hand-written objects in comments and keeping them out of `schema.prisma`.
- **Naming:** Prisma default maps `model User` to a quoted `"User"` table. Use `@@map("snake_case")` / `@map` so raw SQL, RLS and functions are readable and unquoted.
- **Realtime:** enable only on `requests` (owner inbox). `friend_edges`, events and catalog stay off Realtime. Set `replica identity` deliberately if update payloads need old values.
- **Bloat / autovacuum:** `friend_edges` is small-row, high-churn on friend add/remove; keep `fillfactor` default, tune `autovacuum_vacuum_scale_factor` on it if it shows bloat. `search_events` is append-only and partitioned — no vacuum pressure.
- **Backups / PITR:** available on paid tiers; catalog is reproducible from seed, user tables are not.
- **Never** put a service-role key in any client bundle; `search_network` is called with the user's JWT so `auth.uid()` resolves.

---

## 12. Reference DDL — MVP slice

Postgres 15+, Supabase. Illustrative and complete enough to run against a scratch database; not yet a migration.

```sql
-- ── extensions ───────────────────────────────────────────────
create extension if not exists pg_trgm;

-- ── enums ────────────────────────────────────────────────────
create type user_status        as enum ('active', 'blocked', 'deleted');
create type friend_request_status as enum ('pending', 'accepted', 'declined', 'cancelled');
create type resource_status    as enum ('active', 'inactive', 'removed');
create type request_status     as enum ('pending', 'approved', 'declined', 'ignored');
create type referral_status    as enum ('not_required', 'pending', 'approved', 'declined', 'ignored');
create type catalog_item_type  as enum ('card', 'voucher', 'benefit', 'membership');

-- ── identity ─────────────────────────────────────────────────
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text        not null,
  phone        text        unique,
  status       user_status not null default 'active',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── trust graph ──────────────────────────────────────────────
create table friend_requests (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id) on delete cascade,
  addressee_id uuid not null references profiles(id) on delete cascade,
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

create table friendships (
  user_a             uuid not null references profiles(id) on delete cascade,
  user_b             uuid not null references profiles(id) on delete cascade,
  relationship_group text,
  trust_level        smallint not null default 1 check (trust_level between 0 and 3),
  created_at         timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create table friend_edges (            -- written only by trigger
  user_id   uuid not null references profiles(id) on delete cascade,
  friend_id uuid not null references profiles(id) on delete cascade,
  primary key (user_id, friend_id)
);

create function sync_friend_edges() returns trigger
language plpgsql security definer set search_path = '' as $$
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
end $$;

create trigger friendships_sync
  after insert or delete on friendships
  for each row execute function sync_friend_edges();

create table user_blocks (
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index user_blocks_blocked on user_blocks (blocked_id);

-- ── catalog ──────────────────────────────────────────────────
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
  issuer_id   smallint references issuers(id),
  name        text not null,
  country     char(2) not null,
  active      boolean not null default true,
  search_text text not null default '',       -- maintained by trigger (needs issuer name)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (issuer_id, item_type, name)
);
create index catalog_items_search on catalog_items using gin (search_text gin_trgm_ops);
create table catalog_cards (
  catalog_item_id uuid primary key references catalog_items(id) on delete cascade,
  card_type       text     not null check (card_type in ('credit', 'debit')),
  card_category   text     not null,
  network_id      smallint not null references card_networks(id),
  variant         text,
  upi_enabled     boolean  not null default false
);
create table use_cases (
  id   smallint generated always as identity primary key,
  slug text not null unique
);
create table catalog_card_use_cases (
  catalog_item_id uuid     not null references catalog_cards(catalog_item_id) on delete cascade,
  use_case_id     smallint not null references use_cases(id),
  primary key (catalog_item_id, use_case_id)
);

create function set_catalog_search_text() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.search_text := lower(coalesce((select name from public.issuers where id = new.issuer_id) || ' ', '') || new.name);
  new.updated_at  := now();
  return new;
end $$;
create trigger catalog_items_search_text
  before insert or update on catalog_items
  for each row execute function set_catalog_search_text();

-- ── resources ────────────────────────────────────────────────
create table resources (
  id                      uuid primary key default gen_random_uuid(),
  owner_id                uuid not null references profiles(id) on delete cascade,
  catalog_item_id         uuid not null references catalog_items(id),
  visibility_depth        smallint not null default 1 check (visibility_depth between 0 and 3),
  request_enabled         boolean  not null default true,
  share_contact_on_approval boolean not null default true,
  availability_status     text     not null default 'available',
  expiry_at               timestamptz,
  status                  resource_status not null default 'active',
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create unique index resources_owner_item_uniq
  on resources (owner_id, catalog_item_id) where status <> 'removed';
create index resources_by_item on resources (catalog_item_id, owner_id)
  include (id, visibility_depth, request_enabled)
  where status = 'active' and visibility_depth > 0;
create index resources_by_owner on resources (owner_id) where status <> 'removed';
alter table resources alter column catalog_item_id set statistics 1000;

-- ── requests + audit ─────────────────────────────────────────
create table requests (
  id              uuid primary key default gen_random_uuid(),
  requester_id    uuid not null references profiles(id) on delete cascade,
  owner_id        uuid not null references profiles(id) on delete cascade,
  resource_id     uuid not null references resources(id) on delete cascade,
  intermediary_id uuid references profiles(id) on delete set null,
  message         text not null default '',
  status          request_status  not null default 'pending',
  referral_status referral_status not null default 'not_required',
  created_at      timestamptz not null default now(),
  responded_at    timestamptz,
  check (requester_id <> owner_id)
);
create index requests_owner_pending on requests (owner_id, created_at desc) where status = 'pending';
create index requests_requester     on requests (requester_id, created_at desc);
create index requests_resource      on requests (resource_id);
create index requests_intermediary  on requests (intermediary_id) where intermediary_id is not null;

create table request_events (
  id         bigint generated always as identity primary key,
  request_id uuid not null references requests(id) on delete cascade,
  actor_id   uuid references profiles(id) on delete set null,
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
-- monthly partitions created/dropped by pg_cron, e.g.:
-- create table search_events_2026_09 partition of search_events
--   for values from ('2026-09-01') to ('2026-10-01');

-- ── the hot query ────────────────────────────────────────────
create function search_network(p_catalog_item uuid, p_max_depth int default 1)
returns table (
  owner_id uuid, display_name text, resource_id uuid,
  depth int, via_user_id uuid, requestable boolean, needs_referral boolean
)
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as uid),
  d1 as (
    select e.friend_id as user_id, 1 as depth, null::uuid as via
    from public.friend_edges e join me on e.user_id = me.uid
  ),
  d2 as (
    select distinct on (e2.friend_id)
           e2.friend_id as user_id, 2 as depth, e2.user_id as via
    from d1
    join public.friend_edges e2 on e2.user_id = d1.user_id
    where least(greatest(p_max_depth, 1), 2) >= 2
      and e2.friend_id <> (select uid from me)
      and not exists (select 1 from d1 x where x.user_id = e2.friend_id)
    order by e2.friend_id, e2.user_id
  ),
  reach as (select * from d1 union all select * from d2)
  select r.owner_id, p.display_name, r.id, reach.depth, reach.via,
         r.request_enabled, reach.depth > 1
  from reach
  join public.resources r
    on r.owner_id = reach.user_id
   and r.catalog_item_id = p_catalog_item
   and r.status = 'active'
   and reach.depth <= r.visibility_depth
   and (r.expiry_at is null or r.expiry_at > now())
  join public.profiles p on p.id = r.owner_id and p.status = 'active'
  where not exists (
    select 1 from public.user_blocks b, me
    where (b.blocker_id = me.uid and b.blocked_id = r.owner_id)
       or (b.blocker_id = r.owner_id and b.blocked_id = me.uid)
  )
  order by reach.depth, p.display_name;
$$;
revoke execute on function search_network(uuid, int) from public, anon;
grant  execute on function search_network(uuid, int) to authenticated;

-- ── RLS (cheap predicates only) ──────────────────────────────
alter table profiles      enable row level security;
alter table friend_edges  enable row level security;
alter table friendships   enable row level security;
alter table friend_requests enable row level security;
alter table user_blocks   enable row level security;
alter table resources     enable row level security;
alter table requests      enable row level security;
alter table catalog_items enable row level security;

create policy friend_edges_own on friend_edges for select to authenticated
  using (user_id = (select auth.uid()));

create policy profiles_read on profiles for select to authenticated
  using (id = (select auth.uid())
      or exists (select 1 from friend_edges e
                 where e.user_id = (select auth.uid()) and e.friend_id = profiles.id));
create policy profiles_update_own on profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy resources_owner_all on resources for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy resources_friends_read on resources for select to authenticated
  using (status = 'active' and visibility_depth >= 1
     and exists (select 1 from friend_edges e
                 where e.user_id = (select auth.uid()) and e.friend_id = resources.owner_id));

create policy requests_party_read on requests for select to authenticated
  using (requester_id = (select auth.uid()) or owner_id = (select auth.uid()));
create policy requests_insert_own on requests for insert to authenticated
  with check (requester_id = (select auth.uid()));
-- status transitions: via function only; no generic UPDATE policy for clients.

create policy catalog_read on catalog_items for select to authenticated using (active);
create policy blocks_own on user_blocks for all to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));
create policy friendships_party_read on friendships for select to authenticated
  using (user_a = (select auth.uid()) or user_b = (select auth.uid()));
create policy friend_requests_party_read on friend_requests for select to authenticated
  using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));
```

Deliberately omitted from the MVP slice (see §13): `friend_requests` accept/decline and block-removes-friendship logic live in `SECURITY DEFINER` functions (`accept_friend_request`, `block_user`, `respond_to_request`) so each is one atomic, audited transition.

---

## 13. V1 / V2 sketch

`[V1]`
- `merchants(id, slug, name, search_text)`, `offers(id, merchant_id, description, value_type, value, valid_from, valid_to, country)`, `offer_eligible_cards(offer_id, card_item_id)`, `benefits`, `benefit_types` — PRD §8.3–8.4.
- `resource_policies`, `resource_vouchers`, `resource_benefit_access` (§7).
- `user_reliability` rollup (§3); ranking columns wired into `search_network`.
- Optional `network_reach` materialisation (§5.4) behind a measured threshold.
- Functions: `accept_friend_request`, `block_user`, `respond_to_request`, `create_request` (validates reach + visibility + policy + referral, all in one place).

`[V2]`
- Agent tool calls are the same functions, invoked with the user's JWT; the agent has no service-role path (PRD §27.3–4).
- `product_links(url_hash, merchant_id, resolved_offers…)` cache for product-link analysis.
- `notification_preferences`, `notifications` outbox.

---

## 14. Open questions

1. Should `trust_level` be user-set per friend, or derived (interaction history)? PRD §11.3 wants both signals; design stores the user-set value and leaves derivation to `user_reliability`.
2. FoF search: should the **intermediary** be able to veto (hide) their friend from FoF discovery? Design supports it as a per-friendship flag `discoverable_to_fof`; not yet in the DDL.
3. Should `search_events` store the query at all, or only counts? Storing `catalog_item_id` is enough for analytics and keeps it non-sensitive.
4. Contact handoff (PRD §7.2 F): store the reveal decision on `requests` (`contact_revealed_at`) rather than any contact data outside `profiles`.
5. Depth budget and p95 target for §5.4 need a number from product before Phase 7 can be triggered by measurement.

## Revision notes

_Pending: review pass against `timescale/pg-aiguide` guidance once the plugin is installed. Corrections will be recorded here rather than silently edited above._
