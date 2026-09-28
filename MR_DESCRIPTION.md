# Merge Request: Card Sharing, Network Graph Avatars, Profile Management & Request Enhancements

## Summary

This Merge Request introduces end-to-end support for card creation and visibility-scoped sharing, network graph avatar rendering, profile management (photo upload & password update), and UI enhancements in the Request tab.

---

## 🚀 Key Changes

### 1. Card Sharing & Visibility Control
- **Visibility Scoping**: Added ability to set card visibility during creation:
  - `direct_friends`: Visible only to 1st-degree friends.
  - `total_network`: Visible to 1st-degree and 2nd-degree connections (Friends of Friends).
- **View Person's Cards**: Added `PersonCardsModal` and `CardTile` components allowing users to view any connected person's cards directly from the Network Graph, enforcing visibility boundaries.
- **Backend Cards Module**: Full CRUD and access-control endpoints (`GET /cards`, `POST /cards`, `GET /cards/user/:userId`, `DELETE /cards/:id`, etc.) with test coverage.

### 2. Network Graph Avatar Rendering
- **Circular Avatar Nodes**: Render user profile photos inside network node circles using HTML5 Canvas clipping (`arc()` and `drawImage` with center-crop aspect preservation).
- **Graceful Fallbacks**: Renders standard colored dots if a user does not have a photo or if the image fails to load.
- **CORS & Re-render**: Fixed data URI cross-origin handling and added dynamic repaint listeners on image load/decode to prevent blank nodes.

### 3. Avatar Support in Search & User Lists
- **Service Updates**: Extended `searchByNameWithRelationships` and `getFriendsOfFriends` backend services to return `avatar_url`.
- **Component Updates**: Enhanced `UserListItem`, `RequestsPage`, `MyNetworkPage`, and `HomePage` to display profile pictures with seamless fallback to initials when image loading fails.

### 4. Request Tab Dashboard Refinement
- **Removed "Blocked Me" Pill**: Hid the "Blocked Me" count/button from the top stats dashboard for the current logged-in user.
- **Preserved Backend Logic**: Kept underlying blocking APIs and database models intact.
- **Responsive Layout**: Rebalanced the stats grid using `repeat(auto-fit, minmax(140px, 1fr))` to prevent awkward gaps or layout shifts.

### 5. Profile Management & Auth
- **Change Password**: Implemented `POST /auth/change-password` with bcrypt validation and hashing.
- **Photo Upload**: Implemented `POST /auth/photo` supporting avatar uploads and data URLs.
- **Profile Page**: Added frontend `ProfilePage` for updating avatar and password credentials.

---

## 🛠 Type of Change

- [x] **New feature** (non-breaking change adding functionality)
- [x] **Bug fix** (fixing image rendering, CORS canvas issue, avatar propagation)
- [x] **UI/UX improvement** (dashboard layout cleanup, avatar fallbacks)
- [x] **Refactoring & Tests** (backend test suites, service normalization)

---

## 🧪 Testing & Verification

### Automated Tests
- **Backend Test Suite**: Ran `npm --prefix backend test` &rarr; **35 / 35 tests passing** (covering auth, cards, network, connections).
- **TypeScript & Build Checks**:
  - `npm --prefix backend run build` &rarr; **0 errors**.
  - `npm --prefix frontend run build` &rarr; **0 errors**.

### Manual UI Testing
- [x] Created card with "Direct Friends" visibility and verified it only appears for 1st-degree connections.
- [x] Created card with "Total Network" visibility and verified it appears for 2nd-degree connections (FOF).
- [x] Clicked a node on the Network Graph and verified "View Cards" opens the modal displaying their accessible cards.
- [x] Confirmed node dots on Network Graph display avatar images with circular crop, or fallback colored dot if missing.
- [x] Verified user search results display profile photos or initials.
- [x] Verified Request tab top header displays 5 stat cards (`All`, `Incoming`, `Pending`, `Friends`, `FOF`) without the "Blocked Me" button.
- [x] Verified photo update and password change from the Profile page.

---

## 📦 Modified & Added Files Summary

- **Backend**:
  - `backend/src/auth/*`: Auth routes, services, password hashing, tests.
  - `backend/src/cards/*`: Card controller, repository, routes, service, tests.
  - `backend/src/users/*`: Added `avatar_url` propagation in user repository and search services.
  - `backend/src/network/*`: Added `avatar_url` in friend-of-friend summaries.
  - `backend/prisma/schema.prisma`: Added Card model and user avatar fields.
- **Frontend**:
  - `frontend/src/components/NetworkGraph.tsx`: Circular avatar node rendering with canvas clip.
  - `frontend/src/components/PersonCardsModal.tsx` & `CardTile.tsx`: Viewing cards for network contacts.
  - `frontend/src/components/NetworkStatsDashboard.tsx`: Removed "Blocked Me" counter.
  - `frontend/src/components/UserListItem.tsx`: Avatar display with initials fallback.
  - `frontend/src/pages/RequestsPage.tsx`, `HomePage.tsx`, `MyNetworkPage.tsx`: Mapped `avatar_url` across lists.
  - `frontend/src/pages/ProfilePage.tsx`: User profile photo and password update screen.
- **Scripts**:
  - `backend/scripts/seed-users.ts`: Demo user credentials and connection seeder.
  - `scripts/seed-avatars.cjs`: User avatar data generator for local testing.
