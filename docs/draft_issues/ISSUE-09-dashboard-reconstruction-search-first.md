# Title: feat(dashboard): Search-first dashboard reconstruction with 1-click Quick Action bar and Crew Card Matcher

**Labels**: `frontend`, `ui`, `ux`, `dashboard`, `p1-high`  
**Milestone**: Milestone 6 - Dashboard Reconstruction & Search-First Experience  

---

## 1. User Story
**As a** Card Crew user opening the application before making an online or offline purchase,  
**I want** a search-first dashboard with an intelligent Crew Card Matcher and 1-click Quick Actions,  
**So that** I can instantly discover which card in my network yields the highest discount or rewards for my target merchant (e.g., "Swiggy", "Amazon", "MakeMyTrip"), without digging through multiple pages.

---

## 2. Brutal Audit Reasons & Problem Statement
From the quantitative UI/UX Brutal Audit (Score: 36/100, Heuristic 1: Visibility of system status, Heuristic 6: Recognition rather than recall):
1. **Passive, Unactionable Dashboard**:
   - The current `DashboardPage.tsx` displays inert metrics ("Total Cards: 4", "Active Requests: 2") with no immediate path to action.
   - Users primarily open Card Crew with an immediate intent: *"I am buying something right now; who has the best card?"* The current design fails to address this primary job-to-be-done.
2. **Missing Instant Merchant Card Matching**:
   - Users have to manually inspect each friend's profile or card list to discover if anyone holds an Axis Atlas or ICICI Amazon Pay card.
3. **Cluttered Quick Actions**:
   - Quick action buttons are scattered across the screen with inconsistent paddings, unstyled borders, and native emojis.
4. **Poor Information Density on Mobile**:
   - On mobile screens, massive stat boxes consume the entire initial viewport, pushing user cards and recent transactions completely out of sight.

---

## 3. Technical Specifications

### 3.1 Crew Merchant Card Matcher Architecture
Create a client/server search resolver that matches merchant keywords against catalog offers and user/friend cards:
- Query: e.g. `"Swiggy"`.
- Match Algorithm:
  1. Exact merchant match in `merchant_offers` table.
  2. Find all `catalog_cards` eligible for the offer.
  3. Intersect with:
     - User's own cards (`user_cards`).
     - Friends' cards (`friend_edges` $\rightarrow$ `user_cards`).
  4. Return ranked cards sorted by discount value or cashback percentage.

### 3.2 Dashboard Layout Structure (`frontend/src/pages/DashboardPage.tsx`)
1. **Top Greeting & Security Status**:
   - Modern header: `"Welcome back, {full_name}"` with seed avatar.
   - Trust badge: `"Vault Encrypted"` or `"Network Active"`.
2. **Universal Merchant & Card Search Bar (`HeroCardSearch.tsx`)**:
   - Large prominent search input: `"Where are you shopping today? (e.g. Swiggy, Amazon, Flights)..."`
   - Interactive dropdown with instant match results:
     - *"Top match in your crew: HDFC Swiggy Card (Held by @alex — 10% Cashback)"* $\rightarrow$ `[ Request Card ]` button.
3. **1-Click Quick Action Strip (`QuickActionsStrip.tsx`)**:
   - 4 prominent, thumb-friendly action cards:
     - **Add Card**: `<CreditCard />` + "Register your card"
     - **Request Benefit**: `<ArrowLeftRight />` + "Ask friend for card"
     - **Add Crew**: `<UserPlus />` + "Connect by handle/phone"
     - **Browse Perks**: `<Tag />` + "Explore merchant deals"
4. **Active Wallet Carousel**:
   - Horizontal swipeable strip of the user's active cards using `<VisualCard size="sm" interactive />`.
   - Trailing card: `[ + Add New Card ]` dotted outline card.
5. **Recent Crew Activity Feed**:
   - Streamlined chronological feed of incoming/outgoing card usage, approved requests, and perks shared.

---

## 4. Step-by-Step Implementation Guide
1. **Create Merchant Matcher Component**:
   - Create `frontend/src/components/dashboard/HeroCardSearch.tsx`.
   - Connect to `apiClient.ts` search endpoint with debounce.
2. **Build Quick Action Strip**:
   - Create `frontend/src/components/dashboard/QuickActionsStrip.tsx`.
   - Ensure $48\text{px}$ minimum touch target height with SVG icons and active state highlights.
3. **Redesign Dashboard Page**:
   - Overhaul `frontend/src/pages/DashboardPage.tsx`.
   - Organize into logical visual hierarchy: Search $\rightarrow$ Quick Actions $\rightarrow$ My Cards $\rightarrow$ Activity Feed.
4. **Skeleton Loading States**:
   - Add `<DashboardSkeleton />` ensuring smooth progressive rendering during initial network fetch.

---

## 5. Security, Privacy & Integrity Boundaries
- **Friend Privacy In Matcher**: Only show card names and masked digits from friends with whom an `accepted` friendship edge exists.
- **Debounced RPC Calls**: Debounce search queries by 300ms to avoid overloading the Supabase database.

---

## 6. Acceptance Criteria Checklist
- [ ] Universal search bar is prominently located at the top of the dashboard.
- [ ] Typing a recognized merchant (e.g. "Amazon") displays matching cards owned by user or friends.
- [ ] 1-click Quick Action strip allows immediate access to Add Card, Request, Add Friend, and Offers.
- [ ] Wallet carousel displays cards with realistic `<VisualCard size="sm" />`.
- [ ] Mobile layout stacks cleanly with zero horizontal viewport clipping.
- [ ] Dashboard passes Lighthouse accessibility audit with score $\ge 95$.

---

## 7. Verification & Test Plan
1. **Merchant Matcher E2E Test**:
   - In browser, type "Swiggy" in the search box.
   - Verify card result shows discount rate and card owner handle.
2. **Mobile Usability Test**:
   - Open on 390px viewport; verify Quick Actions and Search are reachable within one thumb swipe.
