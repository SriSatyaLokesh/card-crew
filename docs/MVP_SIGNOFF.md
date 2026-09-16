# Lead MVP Sign-Off

Status: signed off for MVP scope as implemented
Owner: Lead (scope, data model, permission matrix, release sign-off)

## L1 — MVP scope freeze

Confirmed frozen to the scope in `docs/BUILD_PLAN.md` §3-4 and delivered:

- Direct friends only (no 2nd-degree traversal).
- Canonical, curated card catalog (`CardCatalog`, seeded with HDFC/Axis/Amex entries).
- Card search → direct-friend network search (`/search/network`).
- Request → owner approve/decline/ignore flow (`/requests`).
- Basic privacy: visibility (`private/friends/network`) + `request_enabled` per resource, enforced
  server-side.
- Basic contact handoff: contact details hidden until the owner approves the specific request.

Anything outside this list (marketplace, payments, 2nd-degree graph, OTT sharing, merchant/offer search,
native app) remains explicitly out of scope per `docs/BUILD_PLAN.md` §4 — no scope crept in during
implementation.

## L2 — REST contract

Published at [`docs/API_CONTRACT.md`](./API_CONTRACT.md), covering `/users`, `/connections`,
`/catalog/cards`, `/resources`, `/search/network`, and `/requests`.

## L3 — Data model approval

Approved as implemented:

- `User` — Supabase-auth-backed identity, no password storage (see decision log, 2026-09-15).
- `Connection` — trust graph edge with `pending/accepted/blocked/removed` status and a unique active-pair
  constraint (`active_pair_key`) enforced at the database level.
- `CardCatalog` — canonical card metadata (issuer, product, type, network, variant, country).
- `Resource` — the generic owner-held-thing model; `UserCard` is realized as `Resource` rows scoped to a
  `card_catalog_id`, per the naming decision in `docs/BUILD_PLAN.md` L3. A distinct `UserCard` table was
  not introduced because the MVP only has one resource type (cards) — introduce the subtype split only
  when a second resource type (V1: coupons/vouchers/benefits) is actually built, to avoid a premature
  abstraction.
- `Request` — requester/owner/resource triple with status and timestamps.

No `VisibilityRule` table was introduced separately; visibility and `request_enabled` live directly on
`Resource`. This matches MVP's "basic privacy" requirement (BUILD_PLAN §2) — a dedicated rule engine is a
V1+ concern once per-resource-category rules are needed.

**Correction made during this sign-off pass:** `CardCatalog`, `Resource`, and `Request` originally had no
Prisma models — the running server used in-memory repositories for all three, meaning cards, added
resources, and requests did not survive a server restart. This directly conflicted with PRD acceptance
criterion #14 ("search and request operations are auditable"). Fixed by adding the three models plus a
new migration (`20260916060000_catalog_resources_requests`, includes a data seed for the curated catalog)
and `Prisma*Repository` implementations wired into `backend/src/server.ts`. The migration was hand-authored
rather than generated via `prisma migrate dev` because this environment has no verified live database
connection to run that command against safely — apply it with `npx prisma migrate deploy` against the real
Supabase database before relying on persistence in a deployed environment. In-memory repositories remain
the production code path only if this migration hasn't been deployed yet, and remain the test-suite path
by design (fast, isolated, no DB dependency).

## L4 — Server-side permission matrix (MVP, direct-friend only)

| Actor relationship to owner | Can discover resource | Can see resource in search | Can request | Can see contact |
| --- | --- | --- | --- | --- |
| Self | Always | Always | N/A | N/A |
| Direct friend (`accepted`), resource `visibility: friends` or `network` | Yes | Yes | Yes, if `request_enabled` | Only after the owner approves that specific request |
| Direct friend, resource `visibility: private` | No | No | No | No |
| Not connected / `pending` / `removed` | No | No | No (403 on request creation) | No |
| `blocked` (either direction) | No | No | No | No |

Enforced in `backend/src/resources/resource.service.ts` (`assertCanView`, `assertOwner`) and
`backend/src/requests/request.service.ts` (`create` requires an `accepted` connection; `revealContact`
requires `status: approved`). Covered by automated tests — see `docs/MVP_RELEASE_CHECKLIST.md` T3.

## L5 — Release checklist sign-off

Signed off against `docs/MVP_RELEASE_CHECKLIST.md`, which maps every PRD MVP acceptance criterion
(`docs/trusted_personal_resource_network_prd.md` §25) to automated test evidence. All of T1-T5 are now
evidence-backed, including a full live browser run (T5, 2026-09-16):

- The `20260916060000_catalog_resources_requests` migration was deployed to the live Supabase database on
  2026-09-16 and verified via a live `GET /catalog/cards` call — the persistence fix is confirmed working,
  not just committed to a migration file.
- The full register → connect → add card → search → request → approve → contact-reveal loop was executed
  end-to-end in a real browser against the live backend and Supabase project. Two real defects surfaced
  and were fixed during this run, not just logged: missing CORS configuration on the backend (blocked
  every cross-origin request from the frontend) and a stale-closure bug in `RequestsPage` that showed raw
  catalog ids instead of card names. See `docs/MVP_RELEASE_CHECKLIST.md` T5 for full detail.
- The live run used a desktop-width browser, not a physical mobile device or emulated narrow viewport —
  flagged as a follow-up, not silently assumed to be covered.
- Invite-by-email is not implemented (no backend lookup endpoint) — tracked in `docs/API_CONTRACT.md` and
  `docs/FRONTEND_PLAN.md`, not required by the PRD's MVP acceptance criteria list.

With those items understood and accepted as follow-ups, the MVP backlog in `docs/BUILD_PLAN.md`
(Backend B1-B10, Frontend F1-F8, UX U1-U5, Lead L1-L5, Tester T1-T5) is complete.
