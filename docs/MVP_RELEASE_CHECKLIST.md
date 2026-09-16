# MVP Release Checklist

Status: T1-T5 all evidence-backed and passing (T5 executed live end-to-end on 2026-09-16; see notes below)
Owner: Tester (T1-T5), signed off by Lead (see `docs/MVP_SIGNOFF.md` L5)

## T1 — PRD MVP acceptance criteria vs. evidence

Source: `docs/trusted_personal_resource_network_prd.md` §25.

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | A user can register | PASS | Supabase Auth sign-up (`frontend/src/pages/LoginPage.tsx`) + `POST /users/sync`; test: "POST /users/sync creates a user profile from Supabase auth..." |
| 2 | A user can add/accept a friend | PASS | `POST /connections`, `POST /connections/:id/accept`; tests in `connection.routes.test.ts` |
| 3 | A user can select cards from a canonical catalog | PASS | `GET /catalog/cards`; test: "GET /catalog/cards returns a curated card catalog"; UI: `MyCardsPage.tsx` |
| 4 | A user can mark card metadata as visible to their network | PASS | `POST/PATCH /resources` `visibility` field; test: "POST /resources and GET /resources list the owner's cards" |
| 5 | A user can search/select a specific card | PASS | `HomePage.tsx` catalog search/select |
| 6 | Backend searches the user's relationship graph | PASS | `resource.service.ts` `findNetworkMatchesForCard` |
| 7 | Matching friends are returned with relationship distance | PASS | `/search/network` returns `relationship: "direct"`; test: "GET /search/network returns direct friends with requestable flag" |
| 8 | User can request help from a matching owner | PASS | `POST /requests`; `RequestComposeModal.tsx`; test: "POST /requests and PATCH /requests/:id support owner approval flow" |
| 9 | Owner can approve/decline | PASS | `PATCH /requests/:id`; `RequestsPage.tsx` approve/decline/ignore |
| 10 | Contact/share handoff works without revealing central card credentials | PASS | `POST /requests/:id/contact`, gated on `status: approved`; test: "approved requests gate contact handoff for both participants" |
| 11 | No card number/CVV/PIN/OTP is required for the network use case | PASS | See T4 below |
| 12 | User can remove a resource or friendship | PASS | `DELETE /resources/:id`, `DELETE /connections/:id`; test: "DELETE /connections/:id marks a connection as removed" |
| 13 | Privacy settings are enforced server-side, not only in UI | PASS | Tests: "network search hides private and blocked resources", "resource reads and mutations require the owner or an allowed viewer", "request creation rejects non-friends and blocked connections" |
| 14 | Search and request operations are auditable | PASS | `CardCatalog`/`Resource`/`Request` now have Prisma models. Migration `20260916060000_catalog_resources_requests` was deployed to the live Supabase database on 2026-09-16 (`npx prisma migrate deploy`) and verified via a live `GET /catalog/cards` call returning the seeded catalog. |
| 15 | Core API endpoints are documented and testable independently from the UI | PASS | `docs/API_CONTRACT.md`; all 26 backend tests exercise the HTTP layer directly, not through the UI |

## T2 — Happy-path test cases

All of the following are automated (`npm test` in `backend/`, 26/26 passing as of this checklist):

- Register/login → `POST /users/sync` tests in `user.routes.test.ts`.
- Add friend → accept → `POST /connections` + `POST /connections/:id/accept` tests in `connection.routes.test.ts`.
- Add card → `POST /resources` test in `backend-b4-b10.test.ts`.
- Search card → `GET /search/network` test in `backend-b4-b10.test.ts`.
- Send request → approve → `POST /requests` + `PATCH /requests/:id` test in `backend-b4-b10.test.ts`.

Frontend equivalents exist as manual flows (no frontend test runner is configured yet — see "Gaps" below):
`LoginPage` → `MyNetworkPage` invite/accept → `MyCardsPage` add → `HomePage` search → `RequestComposeModal`
→ `RequestsPage` approve.

## T3 — Negative / privacy test cases

All automated in `backend/src/backend-b4-b10.test.ts`:

- "network search hides private and blocked resources" — private resources and blocked connections never
  appear in `/search/network`.
- "resource reads and mutations require the owner or an allowed viewer" — non-owner, non-friend `GET`
  returns 403; non-owner `PATCH`/`DELETE` returns 403.
- "request creation rejects non-friends and blocked connections" — `POST /requests` returns 403 for a
  non-friend or a blocked pair.
- "approved requests gate contact handoff for both participants" — `POST /requests/:id/contact` returns
  409 before approval.

## T4 — No sensitive card/credential fields

Verified by repository-wide search (`cvv|card_number|pin|otp|password_hash|cvc`, case-insensitive) across
`backend/src`, `frontend/src`, and `prisma/schema.prisma`:

- No card number, CVV, PIN, OTP, or bank-credential field exists in any type, Prisma model, or route.
- The only `password_hash` hits are (a) the original migration that created it and (b) the follow-up
  migration that dropped it (see decision log, 2026-09-15 — Supabase Auth replaced it), plus two test
  assertions confirming `password_hash` is absent from API responses.
- `MyCardsPage.tsx` shows an inline warning under the notes field: "Never enter a card number, CVV, PIN,
  or OTP here." — a UI-level reminder, not a substitute for the fact that no such field exists server-side.

**Result: PASS.**

## T5 — Mobile-browser smoke test (search → request loop)

**Status: PASS — executed end-to-end against the live backend, real Supabase project, and real
database on 2026-09-16.**

Sequence executed in-browser (desktop viewport; see note below on mobile-width):

1. Disabled "Confirm email" in Supabase (Authentication → Providers → Email) to remove the sign-up email
   rate limit blocking the first attempt.
2. Signed up "Owner Smoke" (`cardcrewsmoketestowner2@gmail.com`) — session created, profile synced.
3. As Owner Smoke: added HDFC Infinia via My Cards (`friends` visibility, requests enabled).
4. Signed up "Requester Smoke" (`cardcrewsmoketestrequester1@gmail.com`).
5. As Requester Smoke: invited Owner Smoke by user id from My Network.
6. Signed in as Owner Smoke: accepted the connection request — now Direct friends.
7. Signed in as Requester Smoke: searched "Infinia" on Home — result showed "Direct friend" and
   "Can request" badges, the network graph highlighted Owner Smoke with "1 match", sent a request via
   the compose modal — "Request sent" confirmed.
8. Signed in as Owner Smoke: Requests → Incoming showed the pending request with the requester's name,
   card, and message. Approved it.
9. Clicked "View contact" — revealed the requester's name and email. Confirmed this button/data is only
   available once `status: approved` (matches the B8/B9 privacy tests).

**Two real defects were found by this test and fixed, not just logged:**

- **CORS was entirely unconfigured on the backend.** Every frontend→backend call was blocked by the
  browser with `No 'Access-Control-Allow-Origin' header`. Fixed by adding the `cors` package, a
  `CORS_ORIGIN`-configurable middleware in `backend/src/app.ts` (defaults to `http://localhost:5173`), and
  documenting the new env var in `backend/README.md` and `.env.example`. All 26 backend tests still pass.
- **`RequestsPage` showed the raw catalog id (`hdfc-infinia`) instead of "HDFC Infinia"** — a stale-closure
  bug: the card-lookup map was built from component state that hadn't re-rendered yet when used in the
  same load cycle. Fixed by building the lookup from the freshly-fetched catalog array and passing it
  directly into the enrichment function instead of relying on a state-derived `useMemo`.

**Not yet verified:** an actual narrow/mobile browser viewport (this run used the default desktop-width
integrated browser). The responsive CSS in `frontend/src/App.css` is untested against a real mobile
viewport — recommend a follow-up pass with DevTools device emulation or a physical device before ship.

**Also re-enable "Confirm email" in Supabase before any real launch** — it was disabled solely to unblock
this local test run.
   account as the owner, search for that card as the other account, send a request, approve it, and
   confirm contact details appear only after approval.
3. Record any defects found by severity in this section.
