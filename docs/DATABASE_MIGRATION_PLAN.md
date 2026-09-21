# Card Crew — Database Migration Plan

**Status:** Proposed. Docs only; no schema or code changes are made by this document.
**Target:** [DATABASE_DESIGN.md](DATABASE_DESIGN.md)
**Current state reviewed:** `backend/prisma/schema.prisma`, migrations `20260915154000` … `20260916090000`, and the network/resource/connection/request code under `backend/src`.

---

## 1. Findings — current implementation vs. target

Severity: **H** blocks a PRD requirement or breaks at modest scale · **M** correctness/integrity risk · **L** hygiene.

| # | Sev | Where | Finding | Fix (phase) |
|---|---|---|---|---|
| 1 | H | [resource.service.ts:101](../backend/src/resources/resource.service.ts#L101), [resource.repository.ts:34](../backend/src/resources/resource.repository.ts#L34) | Card search calls `resourceRepository.listAll()` — loads **every** non-removed resource row into Node, then filters by card in JS. Cost ∝ total table size, not result size. | `search_network()` in SQL (P1) |
| 2 | H | [resource.service.ts:129-150](../backend/src/resources/resource.service.ts#L129) | Reachability is an app-side BFS: one `listByUser` query per frontier node (N+1). | Single self-join on `friend_edges` (P1) |
| 3 | H | [network.service.ts:62-96](../backend/src/network/network.service.ts#L62), [:99](../backend/src/network/network.service.ts#L99), [:110](../backend/src/network/network.service.ts#L110) | Graph endpoint repeats the N+1 walk, then calls `listAll()` again for counts, then `findById` **per node**, then `listByUser` **per node** for edges. Four query loops per request. | One graph query + grouped counts (P1) |
| 4 | H | whole repo | No Row Level Security and no DB-level access rules anywhere (PRD acceptance criterion 13: privacy enforced server-side). Isolation currently depends entirely on every API path filtering correctly. | RLS backstop + `SECURITY DEFINER` search (P0, P1) |
| 5 | M | [app.ts:59](../backend/src/app.ts#L59), [:78](../backend/src/app.ts#L78) | Network handlers take a user id as a query parameter; identity handling should be uniform with the other routers (session-derived). | Session-derived user context (P0) |
| 6 | H | [schema.prisma:100-116](../backend/prisma/schema.prisma) | `Resource.card_catalog_id` is a required FK to a card-only table. PRD §14 / principle 1 require a generic resource model; vouchers, lounge access and memberships would each need a schema rewrite. | `catalog_items` + typed details (P4) |
| 7 | M | [resource.repository.ts:193-207](../backend/src/resources/resource.repository.ts#L193) | `resourceIsRequestable` treats a **pending** connection like an accepted one for `friends`-visibility resources. A not-yet-accepted invitee can request friends-only resources. | Gate on `friend_edges` membership (P1/P3) |
| 8 | M | [resource.service.ts:110](../backend/src/resources/resource.service.ts#L110) | No friends-of-friends visibility level. Depth-2 hits are allowed only when `visibility = 'network'`, so "FoF-visible but not public-to-network" (PRD §12.1) cannot be expressed. | `visibility_depth` (P3) |
| 9 | M | [connection.repository.ts:64](../backend/src/connections/connection.repository.ts#L64), [schema.prisma:70](../backend/prisma/schema.prisma) | Pair uniqueness is a hand-built `active_pair_key` string column, kept correct in app code. | Canonical `friendships (user_a < user_b)` + `CHECK` (P2) |
| 10 | M | [connection.repository.ts:33-56](../backend/src/connections/connection.repository.ts#L33) | Friend lookup is `WHERE (requester=$a AND addressee=$b) OR (requester=$b AND addressee=$a)` and neighbour listing is `requester=$x OR addressee=$x` — an `OR` across two columns can't use one index. | `friend_edges` (P1) |
| 11 | M | [schema.prisma:16-21](../backend/prisma/schema.prisma) | `blocked` is a `ConnectionStatus`. Blocking is one-directional, requires an existing connection row, and unblocking destroys the friendship. | `user_blocks` (P2) |
| 12 | M | [schema.prisma:100-116](../backend/prisma/schema.prisma) | No uniqueness on `(owner_id, card_catalog_id)` — a user can add the same card repeatedly. | Partial unique index (P4, can ship earlier — see P1) |
| 13 | M | [schema.prisma:66-81](../backend/prisma/schema.prisma) | No `CHECK (requester_id <> addressee_id)` on `Connection`, nor `requester_id <> owner_id` on `Request`. | CHECK constraints (P2) |
| 14 | M | PRD criterion 14 | No audit trail for searches or request transitions. | `request_events`, `search_events` (P6) |
| 15 | M | PRD §13.5 | No policy/rule model — every resource is implicitly transferable/requestable. | `resource_policies` (P3/P4) |
| 16 | M | [schema.prisma:51](../backend/prisma/schema.prisma) | `User.id` is `String` (text), not `uuid`, and is not a foreign key to `auth.users`. Supabase Auth identity and the app user row can drift; RLS `auth.uid()` (uuid) comparisons need casts. | `profiles.id uuid` = `auth.users.id` (P2) |
| 17 | L | [schema.prisma:56-57](../backend/prisma/schema.prisma) et al. | `DateTime` maps to `timestamp(3)` **without time zone** everywhere. | `timestamptz` (P2/P4) |
| 18 | L | [schema.prisma:84-89](../backend/prisma/schema.prisma) | `issuer`, `card_type`, `card_category`, `network` are free-text `String`; drift ("HDFC" vs "HDFC Bank") breaks filtering and dedupe. | `issuers`, `card_networks`, CHECK/lookup (P5) |
| 19 | L | [schema.prisma:93](../backend/prisma/schema.prisma) | `use_cases String[]` — not indexable by membership without GIN; not joinable. | `use_cases` + join table (P5) |
| 20 | L | [card-catalog.seed.ts:225-246](../backend/src/catalog/card-catalog.seed.ts#L225) | Card category / use-case classification is regex over `issuer + product_name`, executed at seed time. Brittle, unreviewable, and re-derived on every seed. | Explicit seed data with reviewed columns (P5) |
| 21 | L | [card-catalog.repository.ts:54](../backend/src/catalog/card-catalog.repository.ts#L54), [:92](../backend/src/catalog/card-catalog.repository.ts#L92) | Catalog is fully loaded and sorted in JS (`byHdfcThenName`); no search endpoint; `ensureSeeded` upserts every row one query at a time. | trigram search + `ON CONFLICT` batch seed (P5) |
| 22 | L | `schema.prisma` (all models) | No `@@map`, so tables are quoted PascalCase (`"User"`, `"Connection"`). Every raw SQL, RLS policy and function must quote them. | `@@map` snake_case (P2) |
| 23 | L | [schema.prisma:66-81](../backend/prisma/schema.prisma) | Overlapping indexes: `(requester_id)`, `(addressee_id)`, `(requester_id, addressee_id)`, plus single-column `status` (low cardinality, rarely useful alone). | Drop with the table (P2) |
| 24 | L | [resource.service.ts:123](../backend/src/resources/resource.service.ts#L123) | Matches are keyed by `owner_id` in a `Map`, so "one row per holder" is an accident of iteration order, not a rule. | Explicit in SQL (P1) |

**What is already good and should be kept:** requests carry `intermediary_id` / `referral_status` (matches the depth-2 referral flow); soft delete via `status = 'removed'`; repository interfaces with in-memory fakes (tests stay DB-free); existing contract tests in [backend-b4-b10.test.ts](../backend/src/backend-b4-b10.test.ts) and [network.service.test.ts](../backend/src/network/network.service.test.ts).

---

## 2. Ground rules for every phase

1. **Each phase ships independently** and leaves the app working. No phase requires a later phase's objects.
2. **Expand → migrate → contract.** Add new objects first; dual-write / backfill; switch reads; verify; only then drop old ones — in a *later* migration, never the same one.
3. **Prisma stays** as client + typegen. Anything Prisma can't express (RLS, partial/covering/trigram indexes, triggers, `SECURITY DEFINER` functions, partitions) is hand-written SQL in `prisma/migrations/<ts>_<name>/migration.sql`. Prisma models that map onto hand-written tables use `@@map`; hand-written-only objects (`friend_edges`, functions) are called via `$queryRaw` / `$executeRaw`.
4. **Existing tests are the contract.** Phases that rewrite search must keep [backend-b4-b10.test.ts](../backend/src/backend-b4-b10.test.ts) and [network.service.test.ts](../backend/src/network/network.service.test.ts) passing unchanged; update the `InMemory*` repositories to mirror the new query semantics so unit tests stay DB-free.
5. **Migrations use `DIRECT_URL`** (non-pooled); app traffic uses the pooler with `pgbouncer=true`. ([DATABASE_DESIGN.md §11](DATABASE_DESIGN.md))
6. **Rollback** = each phase lists one. Destructive steps (column/table drops) are the only ones without an instant rollback, which is why they are always a separate, later migration after a verification window.
7. **Never run a phase against production first.** Apply to a Supabase branch / staging project, compare row counts and search results against the old path, then promote.

---

## 3. Phases

### Phase 0 — Access-control hardening (no schema change)

**Goal:** the acting user for every network read is the authenticated session user, and privacy holds even if an API path has a bug.

- Apply the existing Supabase auth middleware ([middleware/supabase-auth.ts](../backend/src/middleware/supabase-auth.ts)) to `/search/network` and `/network/graph` in [app.ts](../backend/src/app.ts); take the user id from the verified token, not from query parameters. Keep the params optional/ignored for one release for client compatibility, then remove.
- Enable RLS with own-row and direct-friend policies on the tables that exist today (Prisma runs as a privileged role, so RLS is a backstop for Supabase client/PostgREST access and for future SQL functions — the app-layer fix above is the primary control until Phase 1).
- **Files:** `app.ts`, `network/*`, one hand-written migration.
- **Prisma / raw split:** all raw SQL.
- **Rollback:** revert the middleware; `alter table … disable row level security`.
- **Proof:** unauthenticated requests get 401; a request authenticated as user A cannot obtain results scoped to user B; existing happy-path tests updated to send a token.

### Phase 1 — Move search & traversal into Postgres

**Goal:** kill findings 1, 2, 3, 7, 10, 24. Biggest performance and safety win, smallest schema change.

1. New migration adds `friend_edges` (design §4/§12), the `sync_friend_edges` trigger on the existing `Connection` table (fires when a row becomes `accepted` / leaves `accepted`), and **backfills** `friend_edges` from existing accepted connections. (Trigger targets `Connection` in this phase; it moves to `friendships` in Phase 2.)
2. Add the partial covering index on `Resource (card_catalog_id, owner_id) where status='active' and visibility <> 'private'` and `set statistics 1000`.
3. Add `search_network(card, depth)` and `network_graph(depth)` SQL functions; the user comes from `auth.uid()` **or**, for the Prisma-privileged connection, an explicit `p_user_id` argument validated against the token in the API layer (Prisma does not carry a JWT). Choose one and document it in the PR — recommended: two thin functions, `search_network_for(p_user, …)` (internal, revoked from clients) wrapped by `search_network(…)` (`auth.uid()`, granted to `authenticated`).
4. Rewrite `ResourceService.findNetworkMatchesForCard` and `NetworkService.graph` to a single `$queryRaw` each. Preserve the response shape.
5. **Delete `ResourceRepository.listAll()`** and its in-memory twin so the load-everything pattern cannot come back. Add a lint/test that fails on `findMany()` without `where` in repositories, if cheap.
6. Fix finding 7 in the new path: friends-only visibility requires an **accepted** edge (`friend_edges`), never `pending`.
7. Optionally add the partial unique index `(owner_id, card_catalog_id) where status <> 'removed'` here (finding 12) after a de-dupe query; it does not depend on later phases.

- **Files:** `resources/resource.service.ts`, `resources/resource.repository.ts`, `network/network.service.ts`, `connections/connection.repository.ts` (unchanged), 1–2 migrations, updated in-memory repos.
- **Rollback:** feature-flag the new query path; old code path stays for one release; `drop function`, `drop table friend_edges cascade`.
- **Proof:** contract tests unchanged and green; a seeded load test (e.g. 10k users, ~150 friends each, 100k resources) shows `search_network` depth 2 p95 within budget and `EXPLAIN (ANALYZE, BUFFERS)` uses the partial index and index-only scans on `friend_edges`; row parity between old and new paths on a staging copy.

### Phase 2 — Canonical friendships, blocks, identity

**Goal:** findings 9, 11, 13, 16, 17, 22, 23.

- Create `profiles` keyed to `auth.users.id` (uuid). Backfill from `"User"`, joined on the Supabase user id already used as `User.id`; assert every existing id parses as a uuid and exists in `auth.users` before adding the FK (report and resolve strays first).
- Create `friend_requests`, `friendships` (`user_a < user_b`), `user_blocks`; backfill from `Connection` (`accepted` → `friendships`, `pending` → `friend_requests`, `blocked` → `user_blocks` with the original direction). Move the `sync_friend_edges` trigger to `friendships`.
- Dual-write from `ConnectionService` for one release; switch reads; verify counts; **later migration** drops `Connection`, `active_pair_key`, and the overlapping indexes.
- `@@map` snake_case for all models; `timestamptz`.
- **Files:** `connections/*`, `users/*`, `middleware/supabase-auth.ts`, `prisma/schema.prisma`, 2–3 migrations.
- **Rollback:** dual-write window means the old tables stay authoritative-equivalent until the contract migration.
- **Proof:** counts match per status; property test "friendship exists ⇔ two `friend_edges` rows"; the block-removes-friendship path covered; every `auth.users` row has a profile.

### Phase 3 — Privacy completeness

**Goal:** findings 8, 15 and PRD §12.1–12.2.

- Replace `ResourceVisibility` enum (`private/friends/network`) with `visibility_depth smallint` (0–3); map old values (`private→0`, `friends→1`, `network→3`); expose `friends_of_friends = 2` in the API. Keep the enum in the API as a mapping so clients don't break.
- Add `share_contact_on_approval`; keep `request_enabled`. Discover / request / contact are now three independent settings.
- Add `resource_policies` (per catalog item / resource type) and have `create_request` consult it.
- **Rollback:** additive columns; old `visibility` column kept until contract.
- **Proof:** table-driven test over (depth × visibility_depth × request_enabled × block) matrix; FoF-visible resource appears at depth 2 but not to depth-3 viewers.

### Phase 4 — Generalise resources (expand → contract)

**Goal:** finding 6, 12.

1. **Expand:** create `catalog_items`, `catalog_cards`; backfill one `catalog_items` row per `CardCatalog` row, **reusing the id** as text→uuid mapping table or migrating ids to uuid (decide once; recommended: keep a `legacy_id text unique` column for cut-over, remove later). Add nullable `Resource.catalog_item_id`.
2. **Dual-write:** service writes both `card_catalog_id` and `catalog_item_id`.
3. **Backfill & verify:** every `Resource` row has `catalog_item_id`; zero rows where the two disagree.
4. **Switch reads** (search function, list endpoints) to `catalog_item_id`; add `NOT NULL`, FK, and the partial unique `(owner_id, catalog_item_id)`.
5. **Contract (separate, later migration):** drop `card_catalog_id`, then `CardCatalog`.
- **Rollback:** until step 5, revert reads to the old column; nothing has been dropped.
- **Proof:** parity queries in step 3 return 0; search results identical before/after; `API_CONTRACT.md` field names unchanged (or versioned).

### Phase 5 — Catalog normalisation & trigram search

**Goal:** findings 18–21.

- `issuers`, `card_networks`, `use_cases` + join; migrate `String` values via a mapping table reviewed by hand (this is data cleanup, not automation).
- `catalog_items.search_text` trigger + GIN trigram index; add `GET /catalog/cards?q=` backed by `search_text % $1 order by similarity`.
- Replace regex classification in `card-catalog.seed.ts` with explicit seed columns; make seeding a single `insert … on conflict do update` batch.
- **Rollback:** additive until the old text columns are dropped in a later migration.
- **Proof:** "infinia", "hdfc infinia", "hdfc infnia" all return the same top hit; no seed row lacks an issuer/network id.

### Phase 6 — Audit, reliability, ranking

**Goal:** finding 14, PRD §11.3.

- `request_events` (append-only; written in the same transaction as every status change).
- `search_events` partitioned monthly; `pg_cron` job creates next month's partition and drops partitions older than the retention window.
- `user_reliability` rollup via `pg_cron`; ranking (`depth → trust_level → availability → reliability`) moves into `search_network`.
- State transitions on `requests` go through a function; remove any generic client `UPDATE` policy.
- **Proof:** every request status change produces exactly one event row; partition rotation job verified on staging; ranking test with fixed fixtures.

### Phase 7 — Scale escape hatches (only when measured)

Each has a **trigger threshold**, not a date. Default is to *not* build them.

| Escape hatch | Build when | Notes |
|---|---|---|
| `network_reach` materialisation (depth ≤ 2) | p95 `search_network` at depth 2 > agreed budget on production-sized data, after Phase 1 indexes and stats are confirmed | Trigger-maintained + `pg_cron` repair; adds write amplification |
| Depth-3 search | Product requires N-degree | Recursive CTE, card-holders-first, hard depth/row caps; **never** materialised |
| Read replica for search | Search load contends with writes | Supabase read replicas; `search_network` is `STABLE`, replica-safe |
| Denormalised `holder_count` per catalog item | Popular-card counts shown in UI dominate load | Counter table updated by trigger |

---

## 4. Suggested PR sequence

| PR | Contents | Depends on |
|---|---|---|
| A | Phase 0 | — |
| B | Phase 1 (+ finding 12 partial unique) | A |
| C | Phase 2 (expand + dual-write) → D (contract) | B |
| E | Phase 3 | C |
| F | Phase 4 (expand → dual-write → verify) → G (contract) | E |
| H | Phase 5 | F |
| I | Phase 6 | H |
| — | Phase 7 items, each on its own trigger | measured |

A and B are the ones worth doing before real users: they remove the scaling cliff and the access-control dependency on app code. C–I are correctness and extensibility and can follow feature work.

## 5. Cross-cutting checklist (apply in every PR)

- [ ] Migration file has only the phase's objects; destructive drops are in their own migration.
- [ ] `EXPLAIN (ANALYZE, BUFFERS)` output for any new hot query attached to the PR.
- [ ] Every new table has RLS enabled and a policy per allowed role; none relies on "the API always filters".
- [ ] Every `SECURITY DEFINER` function: `set search_path = ''`, qualified names, acting user from `auth.uid()` or an API-validated argument on an internal-only function, `revoke … from public, anon`.
- [ ] `InMemory*` repositories updated to match new query semantics; existing contract tests pass unchanged.
- [ ] `docs/API_CONTRACT.md` updated if any response shape changes.
- [ ] Rollback step written in the PR description.

## 6. Open decisions needed before Phase 1

1. **Function calling model under Prisma:** Prisma connects with a privileged role and no JWT, so `auth.uid()` is null there. Recommended: `search_network_for(p_user uuid, …)` internal function (revoked from `anon`/`authenticated`) called by the API after token verification, plus a thin `auth.uid()` wrapper for direct Supabase-client use. Confirm.
2. **Id strategy for `catalog_items`:** migrate string ids (`hdfc-infinia`) to uuid with a `legacy_id` column, or keep a text PK. uuid + `legacy_id` recommended for a global-ready catalog.
3. **Depth-2 request policy:** may a depth-2 requester contact the owner directly, or must the intermediary approve first (current `referral_status` implies the latter)? Affects `needs_referral` semantics in the search result.
4. **p95 latency budget** for search (suggest 150 ms at depth 2) — needed to make Phase 7 triggers measurable.
5. **Pending-invitee visibility (finding 7):** confirm that pending invitees should see *nothing* of the inviter's resources.

## 7. Revision notes

_Pending: review against `timescale/pg-aiguide` guidance once installed. Changes will be listed here, not silently applied._
