# Merge Request: Production-Safe Supabase Integration (Card Sharing, Network Graph Avatars, Profile Page)

## Summary

Refactored the PR to adhere 100% to the production **Supabase architecture** (Supabase Database, Auth, Storage, and RLS). All introduced Express routes, Prisma models, custom controllers, and backend dependencies have been removed. The features are implemented natively using Supabase without reintroducing the legacy backend.

---

## 🚀 Key Features & Changes

### 1. Card Sharing via Supabase Database & RLS
- **Existing `resources` Table & `visibility_depth`**:
  - `0 = Private`: Accessible only by the card owner.
  - `1 = Direct Friends`: Accessible by owner and direct 1st-degree friends.
  - `2 = Total Network`: Accessible by owner, direct friends, and 2nd-degree connections (Friends of Friends).
- **Database-Level Authorization**:
  - Enhanced RLS policy `resources_network_read` for 2nd-degree network discovery.
  - Added PostgreSQL RPC function `get_person_cards(p_user_id uuid)` with server-side friend-edge traversal, block checks, and `visibility_depth` enforcement.
  - Connected `PersonCardsModal` and `CardTile` components to view shared cards directly from the Network Graph.
  - Updated `MyCardsPage` visibility controls to map explicitly to `private`, `friends`, and `network` depths.

### 2. Avatars Using Supabase Storage
- **Public Storage Bucket**: Created and configured the public `avatars` bucket with RLS policies allowing authenticated users to upload, update, and manage their avatar image files.
- **Profile Schema & Public View**:
  - Added `avatar_url` column to `public.profiles`.
  - Recreated `public.profiles_public` view to project `id, display_name, status, avatar_url` for authenticated clients.
  - Updated `public.sync_profile` function to handle `avatar_url` seamlessly with user metadata.
- **Network Graph Avatars**:
  - Updated `public.network_graph` RPC function to return `avatar_url` for each node.
  - Network graph canvas renders circular cropped avatars with graceful fallback to standard colored node dots.

### 3. Profile Management via Supabase Auth
- **Native Supabase Client**:
  - Password updates execute directly via `supabase.auth.updateUser({ password })`.
  - Display name updates synchronize both `supabase.auth.updateUser({ data: { display_name } })` and `public.profiles`.
  - Avatar uploads push image files directly to the `avatars` Supabase Storage bucket, obtain the public URL, and update `profiles.avatar_url` and auth metadata.
  - Robust error handling, loading states, session expiration resilience, and duplicate submission prevention.

### 4. Removal of Express/Prisma Backend
- Reverted all PR modifications in `backend/` back to clean `main` status.
- Removed custom Express routes (`backend/src/auth`, `backend/src/cards`), Prisma models, and test mocks.
- Restored `apiClient.ts` as a pure Supabase client calling PostgREST and RPC endpoints.
- Cleaned up dead UI components and unused imports.

---

## 🛠 Type of Change

- [x] **Refactoring** (aligning PR architecture with production Supabase)
- [x] **New feature** (Card Sharing with depth authorization, Storage avatars, Profile Page)
- [x] **Security / RLS** (Database-level multi-hop visibility checks, Storage RLS)
- [x] **Cleanup** (Removal of redundant Express/Prisma code)

---

## 🧪 Testing & Verification

- **Frontend Compilation**: `npx tsc --noEmit` &rarr; **0 errors**.
- **Backend Test Suite**: Ran `npm --prefix backend test` &rarr; **28 / 28 tests passing**.
- **Integration Tests Updated**:
  - `tests/integration/resources.test.ts`: Added tests verifying that friends-of-friends access `visibility_depth = 2` but are denied `visibility_depth = 1`, and verified `get_person_cards` RPC enforcement.
  - `tests/integration/profiles.test.ts`: Added tests for `avatar_url` updates in `profiles` and reading via `profiles_public`.
  - `tests/integration/network.test.ts`: Verified `avatar_url` property presence on `network_graph` nodes.
- **Guardrails**: Updated `supabase/guardrails/03_definer_audit_list.sql` to include `get_person_cards`.
