# Card Crew MVP API Contract

Status: published for MVP sign-off (Lead L2)
Audience: Frontend, Tester, and any future API consumer

This is the authoritative contract for the MVP backend. It reflects the code in `backend/src/` as of this
document's creation, not aspirational behavior. Where the implementation is intentionally a stub (see
"Known limitations"), that is called out explicitly rather than glossed over.

## Conventions

- All responses are JSON. Errors are `{ "error": string }` with a matching HTTP status code.
- Timestamps are ISO 8601 strings.
- `POST /users/sync` is the only endpoint that uses a Supabase bearer token. Every other endpoint
  currently identifies the caller via an explicit `user_id` in the query string or body. This is a
  documented stub-auth model (see `backend/README.md`) and must be hardened before a public launch.
- Rate limits (per caller, per minute): profile sync 10, profile reads 30, connection mutations 30,
  connection lists 60. Resource/catalog/request endpoints do not yet have dedicated rate limits.

## Users

| Endpoint | Method | Auth | Body / Query | Response |
| --- | --- | --- | --- | --- |
| `/users/sync` | POST | Bearer (Supabase) | `{ display_name?, email?, phone? }` | `{ user }` — upserts the profile keyed by the verified Supabase user id |
| `/users/:id` | GET | Optional bearer | — | `{ user }` — full profile if the caller is the owner, public profile (`id, display_name, status, created_at, updated_at`) otherwise |

`display_name` max 80 chars, `email` max 254 chars and must be a valid address, `phone` max 32 chars.

## Connections (My Network)

| Endpoint | Method | Body / Query | Response |
| --- | --- | --- | --- |
| `/connections` | POST | `{ requester_id, addressee_id }` | `{ connection }`, status `pending`. 409 if an active connection already exists, 400 if self-connecting |
| `/connections/:id/accept` | POST | `?user_id=` (must be addressee) | `{ connection }`, status `accepted` |
| `/connections/:id/block` | POST | `?user_id=` (either participant) | `{ connection }`, status `blocked` |
| `/connections/:id` | DELETE | `?user_id=` (either participant) | 204 — status `removed` (used for decline/remove/cancel) |
| `/connections` | GET | `?user_id=&status=` (optional: `pending\|accepted\|blocked\|removed`) | `{ connections }` |

## Card Catalog

| Endpoint | Method | Response |
| --- | --- | --- |
| `/catalog/cards` | GET | `{ cards }` — curated, HDFC-first ordering. Each card includes `card_category` (`credit\|debit\|prepaid\|charge`), `upi_enabled`, and `use_cases` (for example `travel`, `cashback`, `fuel`, `lifestyle`, `railway`, `upi`, `daily-banking`); no query params, filter client-side |
| `/catalog/cards/:id` | GET | `{ card }` or 404 |

## Resources (My Cards)

A `Resource` is the MVP's `UserCard`: a canonical catalog card a user has added, with visibility and
request permissions attached (see `docs/MVP_SIGNOFF.md` for the data model note, L3).

| Endpoint | Method | Body / Query | Response |
| --- | --- | --- | --- |
| `/resources` | POST | `{ owner_id, card_catalog_id, visibility?, request_enabled?, notes? }` | `{ resource }`. `visibility` defaults to `friends`, `request_enabled` defaults to `true` |
| `/resources` | GET | `?user_id=` (owner) | `{ resources }` |
| `/resources/:id` | GET | `?user_id=` (viewer) | `{ resource }`. 403 if private and viewer isn't the owner, or viewer isn't a direct (`accepted`) friend of the owner |
| `/resources/:id` | PATCH | `{ user_id, visibility?, request_enabled?, notes?, status? }` | `{ resource }`. 403 unless `user_id` is the owner |
| `/resources/:id` | DELETE | `{ user_id }` or `?user_id=` | 204. 403 unless `user_id` is the owner. Soft-deletes (`status: removed`) |

## Network Search

| Endpoint | Method | Query | Response |
| --- | --- | --- | --- |
| `/search/network` | GET | `user_id, card_catalog_id` | `{ matches: [{ user_id, resource_id, relationship: "direct", requestable }] }` |

`/search/network` also accepts `depth=1|2`. Depth 1 returns direct friends. Depth 2 may return resources
from a friend of a friend when the resource is visible to `network`; those matches include `depth: 2`,
`via_user_id`, `relationship: "second-degree"`, and `requestable: false` until the referral workflow is
approved.

| Endpoint | Method | Query | Response |
| --- | --- | --- | --- |
| `/network/graph` | GET | `user_id, depth=1|2` | `{ nodes: [{ user_id, display_name, depth, relationship, via_user_id, card_count }], edges: [{ from_user_id, to_user_id, status }] }` |

Graph `card_count` is the count of active, non-private resource metadata visible to the graph view. It is
not a trust score and does not expose private resources.

Matches are limited to direct (`accepted`) friends with an `active`, non-`private` resource for that
catalog card. Private resources and blocked/pending connections never appear. `requestable` reflects the
resource owner's `request_enabled` flag. Display name is not included — resolve via `GET /users/:id`.

## Requests

| Endpoint | Method | Body / Query | Response |
| --- | --- | --- | --- |
| `/requests` | POST | `{ requester_id, owner_id, resource_id, message? }` | `{ request }`, status `pending`. 403 unless requester and owner are direct friends and the resource is active, requestable, and non-private |
| `/requests/incoming` | GET | `?user_id=` (owner) | `{ requests }` |
| `/requests/outgoing` | GET | `?user_id=` (requester) | `{ requests }` |
| `/requests/:id` | PATCH | `{ user_id, status }` (`status`: `approved\|declined\|ignored`) | `{ request }`. 403 unless `user_id` is the owner |
| `/requests/:id/contact` | POST | `{ user_id }` (either participant) | `{ contact: { id, display_name, email, phone } }`. 409 unless the request is `approved`, 403 if `user_id` isn't a participant |

## Known limitations (tracked, not silently patched)

1. **No user lookup by email/phone.** Inviting a friend requires their raw user id. Frontend surfaces this
   explicitly (see `docs/FRONTEND_PLAN.md`).
2. **Stub auth on non-sync endpoints.** `user_id` is caller-supplied and not verified against a session
   token. Acceptable for MVP demo/testing, not for a public deployment.
3. **No aggregate "resource count per friend."** `docs/FRONTEND_PLAN.md` F7 note explains why this wasn't
   added without a privacy decision.
