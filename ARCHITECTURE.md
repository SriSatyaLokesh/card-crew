# Architecture

This document is the map for new contributors: what runs where, how a
request flows through the system, and how the pieces fit together. It
intentionally summarizes rather than duplicates — each section links to the
authoritative deep-dive doc.

For the product "why", see the
[PRD](docs/trusted_personal_resource_network_prd.md). For "what does the UI
look like", see [`docs/design.md`](docs/design.md). For "what does the wire
protocol look like", see [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).

## The one-paragraph version

Card Crew is a trusted social graph over resource metadata. A user declares
cards (and eventually other resources) they hold; the app never stores the
credentials that would make those resources usable by someone else, only
metadata (issuer, network, variant, use-case tags) plus who's allowed to
see and request them. Search walks the user's direct and second-degree
friend graph for a matching resource, and a request/approval flow — not a
directory — is what turns "someone I know has this" into contact between
two people, with the resource owner deciding how far to go.

## System diagram

```text
                     ┌─────────────────────────────┐
                     │        Browser (SPA)         │
                     │  frontend/  Vite + React +TS │
                     └───────────────┬───────────────┘
                                     │ HTTPS
                     ┌───────────────▼───────────────┐
                     │       Cloudflare Worker         │
                     │  wrangler.jsonc — serves static  │
                     │  frontend/dist, proxies /api/*   │
                     └──────┬───────────────┬─────────┘
                            │               │
              (today, live)│               │(Phase A, built & tested;
                            │               │ not yet wired to frontend)
              ┌─────────────▼───────┐   ┌───▼─────────────────────┐
              │ Cloudflare Container │   │   Supabase (hosted)      │
              │  backend/  Express + │   │  PostgREST + RPC (Sec.   │
              │  TS + Prisma          │   │  DEFINER fns) + RLS +    │
              │  → same Postgres DB   │   │  GoTrue Auth              │
              └─────────────┬────────┘   └──────────────┬───────────┘
                            │                            │
                            └──────────────┬─────────────┘
                                           ▼
                              ┌─────────────────────────┐
                              │  Supabase Postgres        │
                              │  Users · Connections ·     │
                              │  CardCatalog · Resources ·  │
                              │  Requests                    │
                              └───────────────────────────┘
```

The two right-hand paths are **not both live at once for the frontend** —
see [Migration status](#migration-status) below. Today, all frontend
traffic goes through the Express/Prisma Container. The Supabase-native
layer (PostgREST + RPC + RLS) is built and tested but only exercised
directly, by `tests/integration/`.

## Components

| Component | Path | Stack | Role |
| --- | --- | --- | --- |
| Web app | `frontend/` | Vite, React 18, TypeScript, React Router | The only user-facing surface. Mobile-first per `docs/design.md`. |
| API (live) | `backend/` | Express 5, TypeScript, Prisma, `tsx` | Today's deployed backend — CRUD + search over Users/Connections/Resources/Requests. See [Known limitations](docs/API_CONTRACT.md#known-limitations-tracked-not-silently-patched). |
| Data layer (target) | `supabase/` | PostgreSQL, PostgREST, RLS, SQL RPC functions | The backend Card Crew is migrating to: no application server, authorization enforced in Postgres itself. |
| Integration tests | `tests/integration/` | Vitest | Exercises `supabase/` against a real local Supabase instance (`supabase start`). |
| Edge/deploy | `wrangler.jsonc`, `.github/workflows/cloudflare-pages.yml` | Cloudflare Workers | Serves `frontend/dist` as static assets; proxies API routes to the Container today. |
| Auth | Supabase Auth (GoTrue) | — | Both backends verify the same Supabase-issued bearer tokens. |

## Core entities

These map directly onto the tables in `docs/DATABASE_DESIGN.md` and the
Prisma models in `backend/prisma/schema.prisma`:

- **User** — a profile keyed by the Supabase Auth user id. Public fields
  (`display_name`, `status`) are visible to anyone; `email`/`phone` are
  owner-only until a `Request` is approved.
- **Connection** — a friend edge between two Users, with status
  `pending → accepted | blocked | removed`. Direction (`requester`,
  `addressee`) is preserved even after acceptance.
- **CardCatalog** — the curated, shared reference list of real-world cards
  (issuer, network, variant, UPI capability, use-case tags). Not
  user-owned; seeded centrally.
- **Resource** — a User's claim on a `CardCatalog` entry ("I have this
  card"), with `visibility` (`private | friends | network`) and
  `request_enabled` controlling discoverability. This is the generalizable
  unit — future resource types (coupons, memberships, lounge access; see
  the PRD) are expected to extend this shape rather than replace it.
- **Request** — one user asking another (via a shared `Resource`) for
  help, moving through `pending → approved | declined | ignored`. Contact
  details are only returned by `POST /requests/:id/contact` once a request
  is `approved` — this is the single approval gate contact handoff runs
  through, and it's enforced server-side, not just hidden in the UI.

## Request flow: finding and asking for a card

1. **Search.** `GET /search/network?user_id&card_catalog_id` (or
   `GET /network/graph` for the graph view) walks the caller's `accepted`
   `Connection`s — and, at depth 2, friends-of-friends — for an `active`,
   non-`private` `Resource` matching the requested `CardCatalog` entry.
   Private resources and non-accepted connections never appear in results.
2. **Match.** The response tells the searcher *that* a match exists and
   whether it's `requestable` (the owner's `request_enabled` flag) — never
   the owner's contact details at this stage.
3. **Request.** `POST /requests` is only accepted if requester and owner
   are direct (`accepted`) friends and the resource is active, requestable,
   and non-private — this is re-checked server-side even though search
   already filtered for it, because the two calls aren't atomic.
4. **Approve.** The owner reviews the pending request in "Requests →
   Incoming" and moves it to `approved`, `declined`, or `ignored`.
5. **Contact.** Only once `approved`, either participant can call
   `POST /requests/:id/contact` to retrieve the permitted contact fields.
   Nothing about payment credentials is ever part of this exchange — Card
   Crew's job ends at "here's how to reach the person who can help."

Full request/response shapes: [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).

## Privacy and security architecture

This is the layer every contribution has to respect — see
[`SECURITY.md`](SECURITY.md#security-boundary) for the contributor-facing
version.

- **No credential fields, anywhere.** There is no column, log field, or
  API parameter for a card number, CVV, PIN, OTP, or bank password in
  either backend's schema. This isn't a validation rule to bypass, it's a
  refusal to have the field exist.
- **Authorization enforced server-side, twice over during migration.**
  Today (`backend/`), route handlers check ownership/friendship before
  returning data. In the target architecture (`supabase/`), the same
  guarantees are Row Level Security policies enforced by Postgres itself —
  see `supabase/README.md`'s privilege model (every function is
  `SECURITY INVOKER` unless individually justified and audited as
  `SECURITY DEFINER`).
- **Contact details are gated, not just hidden.** The approval check in
  step 4 above happens before the contact fields are ever put on the
  wire — not filtered out client-side after being sent.
- **Known gap, tracked openly:** the live `backend/` currently trusts a
  caller-supplied `user_id` on most endpoints instead of verifying a
  session token (`POST /users/sync` is the exception). This is documented
  in `docs/API_CONTRACT.md` and must be closed before the stub-auth model
  is acceptable for a real public launch — see
  [`SECURITY.md`](SECURITY.md) if you're looking at this as a security
  researcher rather than a contributor.

## Migration status

Card Crew is moving off the Express/Prisma API (`backend/`) onto the
Supabase-native layer (`supabase/`: PostgREST + RPC + RLS, no application
server), so the frontend can eventually deploy as a static site with
nothing else to run. Full rationale and phased cutover plan:
[issue #3](https://github.com/SriSatyaLokesh/card-crew/issues/3) and
[`docs/DATABASE_MIGRATION_PLAN.md`](docs/DATABASE_MIGRATION_PLAN.md).

| Phase | What | Status |
| --- | --- | --- |
| A — Build the Supabase-native layer | Schema, RLS policies, RPC catalog under `supabase/` | ✅ Built and tested against a real local Supabase instance |
| B — Prove it | `tests/integration/` suite against `supabase start` | ✅ In place, runs in CI (`supabase-integration-tests.yml`) |
| C — Frontend cutover | `frontend/` calls Supabase directly instead of the Express API | ⬜ Not started |
| D — Deploy simplification | Drop the Cloudflare Container; Worker only serves static assets | ⬜ Not started |
| E — Retire `backend/` | Keep as reference only (already the case — see `backend/README.md`) | ◐ Partially — code kept, not deployed |

If you're picking up work in this area, check the README's architecture
table and the linked issue for the current state before assuming which
backend a change belongs in — this table will drift as work lands, so
treat the linked issue as the source of truth if the two ever disagree.

## Deployment

`.github/workflows/cloudflare-pages.yml` builds both apps, runs backend
tests, and deploys `frontend/dist` as static assets on Cloudflare Workers
on every push to `main`. The same Worker proxies `/api/*` to the
Express/Prisma backend running in a Cloudflare Container (Workers Paid
plan feature). See the README's
[Cloudflare Deployment](README.md#cloudflare-deployment) section for the
exact secrets/variables a deployment needs.

## Where this is headed

Per the PRD, the resource model is deliberately generic — cards are the
first category, not the ceiling. V1/V2 direction (lookup by email instead
of raw user id, second-degree request flows, eventually an agent/LLM layer
on top of deterministic search) lives in
[the PRD](docs/trusted_personal_resource_network_prd.md); this document
will grow new sections as those land rather than staying card-specific.
