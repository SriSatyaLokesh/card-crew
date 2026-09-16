# Frontend Plan — F1 to F8

Status: F1-F8 all implemented in `frontend/`
Scope: F1 (app shell), F2 (My Network), F3 (My Cards), F4 (search-first home), F5 (result badges +
request action), F6 (request compose + incoming/outgoing + approve/decline/ignore + contact handoff),
F7 (lightweight graph/context view), F8 (loading/error/success states across all screens)

## 0. What already exists

A runnable scaffold lives in `frontend/` (Vite + React + TypeScript) implementing the full F1-F8 set
against the real backend contract:

- `frontend/src/auth` — Supabase-backed session + `/users/sync` profile bootstrap, route guard.
- `frontend/src/pages/HomePage.tsx` — F1 signed-in home, F4 catalog search/select, F5 badges + request
  action, F7 network graph.
- `frontend/src/pages/MyCardsPage.tsx` — F3 catalog search, add card, edit visibility/request toggle,
  remove, F8 loading/error/success states.
- `frontend/src/pages/MyNetworkPage.tsx` — F2 invite, accept, decline/remove, block, F8 loading/error/
  success states, confirmation before block.
- `frontend/src/pages/RequestsPage.tsx` — F6 incoming/outgoing tabs, approve/decline/ignore, contact
  reveal after approval.
- `frontend/src/components/NetworkGraph.tsx` — F7 self + direct friends, highlighted on active search.
- `frontend/src/components/RequestComposeModal.tsx` — F6 compose form used from Home's "Request help".
- `frontend/src/lib/apiClient.ts` — typed client for every endpoint used below.
- `frontend/src/lib/resolveNames.ts` — shared display-name resolution used by Home, Requests, My Network.

A backend contract change was required to complete F5/F6: `GET /search/network` now returns `resource_id`
per match (previously only `user_id, relationship, requestable`), since creating a request needs a
specific resource id that the old response didn't expose. This is additive and covered by the existing
backend test suite (26/26 passing).

## 1. Tech stack (locked)

- Vite + React 18 + TypeScript, matching the backend's TypeScript-first convention.
- `react-router-dom` for routing.
- `@supabase/supabase-js` for auth (same Supabase project as the backend).
- No UI framework dependency yet — plain CSS in `src/App.css`. Do not add a component library without a
  Lead/UX decision; keep the dependency surface small per the MVP guardrails in `docs/BUILD_PLAN.md`.
- API access is a thin `fetch` wrapper (`src/lib/apiClient.ts`), not a data-fetching library. Do not add
  React Query/SWR for F1-F4 — the data needs are simple list/create/update calls.

## 2. Known backend gap to flag, not silently work around

There is **no endpoint to look up a user by email or phone**. `POST /connections` requires the addressee's
backend user id. Until Backend adds a lookup endpoint, the Invite form in My Network takes a **user ID**
directly, with copy that says so. Do not fake an email-based invite flow — that would silently promise
functionality the backend cannot deliver. File this as a backend follow-up (`B11` candidate) rather than
building a client-side workaround.

## 3. API contract reference (current backend behavior)

Auth: Supabase session access token goes in `Authorization: Bearer {token}` **only** for `POST /users/sync`.
Every other endpoint currently uses an explicit `user_id` in the query string or body (documented in
`backend/README.md` as stub auth to be hardened later — the frontend must not assume bearer auth works on
these routes yet).

| Endpoint | Method | Notes |
| --- | --- | --- |
| `/users/sync` | POST | Bearer token required. Upserts profile, returns `{ user }`. |
| `/users/:id` | GET | Optional bearer; owner gets full profile, others get public profile. |
| `/catalog/cards` | GET | Returns `{ cards }`, no query params — filter client-side. |
| `/resources` | POST | Body: `owner_id, card_catalog_id, visibility?, request_enabled?, notes?`. |
| `/resources` | GET | Query: `user_id` (owner). Returns `{ resources }`. |
| `/resources/:id` | GET | Query: `user_id` (viewer) — 403 if private/not a direct friend. |
| `/resources/:id` | PATCH | Body: `user_id` (must be owner) + fields to change. |
| `/resources/:id` | DELETE | Body or query `user_id` (must be owner). |
| `/connections` | POST | Body: `requester_id, addressee_id`. |
| `/connections/:id/accept` | POST | Query: `user_id` (must be addressee). |
| `/connections/:id/block` | POST | Query: `user_id` (either participant). |
| `/connections/:id` | DELETE | Query: `user_id` (either participant) — used for decline/remove/cancel. |
| `/connections` | GET | Query: `user_id`, optional `status`. Returns `{ connections }`. |
| `/search/network` | GET | Query: `user_id, card_catalog_id`. Returns `{ matches: [{ user_id, resource_id, relationship, requestable }] }`. Display name is not included — fetch via `/users/:id`. |
| `/requests` | POST | Body: `requester_id, owner_id, resource_id, message?`. 403 if not a direct friend or resource isn't requestable. |
| `/requests/incoming` | GET | Query: `user_id` (owner). Returns `{ requests }`. |
| `/requests/outgoing` | GET | Query: `user_id` (requester). Returns `{ requests }`. |
| `/requests/:id` | PATCH | Body: `user_id` (must be owner), `status: approved\|declined\|ignored`. |
| `/requests/:id/contact` | POST | Body: `user_id` (either participant). 409 unless the request is approved. |

## 4. Task breakdown

### F1 — App shell, auth entry, nav, signed-in home

- [x] Scaffold: routing shell, `AuthProvider`, `RequireAuth`, `NavBar`, `LoginPage`.
- [ ] Replace the placeholder sign-up/sign-in copy with the trust copy from `docs/UX_WIREFRAMES.md`.
- [ ] Add a loading state while the Supabase session is being restored on page load (avoid a login flash).
- [ ] Confirm `/users/sync` failures show a retry path instead of a stuck spinner.
- **Acceptance:** a new user can sign up, land on Home signed in, and refresh the page without being
  bounced to `/login` while the session is still valid.

### F2 — My Network

- [x] Scaffold: list connections split into Direct friends / Incoming / Outgoing / Blocked, accept,
      decline/remove, block, invite-by-user-id form.
- [ ] Add confirmation copy before block/remove using the exact strings in `docs/UX_WIREFRAMES.md` (U3).
- [ ] Add an inline error state when inviting a nonexistent user id (backend returns 404).
- [ ] Swap the invite-by-id form for invite-by-email once Backend ships the lookup endpoint (tracked gap
      above) — keep the API call isolated in `apiClient.ts` so this is a single-function change later.
- **Acceptance:** invite → accept → appears under Direct friends; block hides future invites/requests from
  that user (server-enforced already, UI must reflect status without a page reload).

### F3 — My Cards

- [x] Scaffold: catalog search/filter, add-card form (visibility + request toggle), resource list with
      inline edit and remove.
- [ ] Enforce that notes never collect card numbers/CVV/PIN — add a short inline warning under the notes
      field per the product boundary in `docs/BUILD_PLAN.md`.
- [ ] Add optimistic or at least immediate list refresh after add/edit/remove (currently a full refetch;
      fine for MVP, revisit only if it feels slow).
- **Acceptance:** a user can add a card, change its visibility, disable requests, and remove it, with the
  list always reflecting server state.

### F4 — Search-first home flow

- [x] Scaffold: card search/select on Home, minimal match list (name resolved via `/users/:id`), empty
      states for "no card selected" and "no match in network."
- [ ] Debounce the catalog filter input (currently filters on every keystroke against an already-fetched
      list, which is fine at this catalog size — revisit only if the catalog grows materially).
- [ ] Hand off the result list markup to F5 for badges + request action; keep the current list container's
      structure stable so F5 can extend it without a rewrite.
- **Acceptance:** searching a card a direct friend holds shows that friend; searching a card nobody in the
  network holds shows the "no match" empty state with an Invite CTA linking to My Network.

### F5 — Search results with badges and request action

- [x] Result list shows a "Direct friend" badge and a "Can request" / "Requests unavailable" badge per
      the canonical labels in `docs/UX_WIREFRAMES.md` (U4).
- [x] "Request help" button opens the F6 compose modal; hidden when the match isn't requestable.
- [x] Backend now returns `resource_id` per match so the frontend can create a request against the right
      resource (see contract note above).
- **Acceptance:** a requestable match shows both badges and a working "Request help" action; a
  non-requestable match shows badges only.

### F6 — Request compose, incoming/outgoing lists, approve/decline/ignore

- [x] `RequestComposeModal` sends `POST /requests` with an optional message.
- [x] `RequestsPage` with Incoming/Outgoing tabs; incoming pending requests show Approve/Decline/Ignore.
- [x] Approved requests expose "View contact" calling `POST /requests/:id/contact`, matching the approved/
      declined/ignored copy in `docs/UX_WIREFRAMES.md` (U3).
- **Acceptance:** requester sends a request → owner sees it under Incoming → owner approves → both sides
  can reveal contact info; declined/ignored requests never expose contact details.

### F7 — Lightweight graph/context view

- [x] `NetworkGraph` renders self + direct friends as simple nodes (no physics/heavy viz dependency).
- [x] Friends matching the active search are highlighted; count label is honest about what the backend
      can tell us ("1 match" / "No match" for the searched card, not an aggregate resource count — there is
      no endpoint for a friend's total resource count, and adding one would leak private-resource counts).
- **Acceptance:** the graph shows every direct friend; searching a card highlights exactly the friends
  returned by `/search/network`.

### F8 — Loading, error, success, and no-match states

- [x] Home, My Cards, My Network, and Requests each track loading/error/success independently and never
      flash an empty state before the first fetch resolves.
- [x] Every mutating action (add/edit/remove card, invite/accept/remove/block connection, send/approve/
      decline/ignore request, reveal contact) has its own try/catch and a user-visible error message.
- [x] Block and remove-card actions require a native confirm step before calling the API.
- **Acceptance:** disconnecting the backend and retrying any action surfaces an inline error, never a
  silent failure or an incorrectly empty list.

## 6. Still deferred

- Any UI component library adoption — raise with Lead/UX first if screens feel like they need one.
- Invite-by-email (blocked on a backend user-lookup endpoint, tracked above).
- A dedicated "friend's total resource count" view — would require a new backend endpoint and a privacy
  decision (see F7 note) before it can be built honestly.

## 7. Environment setup for whoever picks this up

```bash
cd frontend
npm install
cp .env.example .env   # fill VITE_API_BASE_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
npm run dev
```

Backend must be running locally (`cd backend && npm run dev`) with a matching Supabase project.
