# Milestone 6: Dashboard Reconstruction & Redesign

**Tracked Issue:** [#45](https://github.com/SriSatyaLokesh/card-crew/issues/45)  
**Priority:** High (Primary User Experience)  
**Status:** Ready for Implementation  
**Estimated Complexity:** High  

---

## 1. Executive Summary & User Story

> **As a Card Crew member**, I want a reconstructed, cohesive dashboard that places trusted resource search front-and-center while offering an at-a-glance view of my network stats, my saved cards deck, pending requests, and quick crew actions, so that discovering help and managing my trusted network is fast, intuitive, and enjoyable.

The current `frontend/src/pages/HomePage.tsx` has grown into a 957-line monolith with mixed concerns, emoji-laden metric pills, and an unwieldy network graph that pushes search down. This milestone reconstructs the dashboard into a search-first, modular, accessible interface aligned with the Card Crew design system (`docs/design.md`).

---

## 2. Structural Architecture & Component Decoupling

`HomePage.tsx` will be restructured into clean, focused subcomponents in `frontend/src/components/dashboard/`:

```
┌─────────────────────────────────────────────────────────────────┐
│                       [NavBar Component]                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [1. DashboardSearchHero]                                       │
│  "Find help from people you trust"                              │
│  [ 🔍 Search cards, banks, offers, or friends...       [Search] ] │
│                                                                 │
│  [2. DashboardQuickActions]                                     │
│  [ + Add Card ]    [ + Invite Friend ]    [ 📬 Requests (2) ]   │
│                                                                 │
│  [3. DashboardPendingAlerts] (Conditional)                     │
│  "⚠️ 2 incoming card requests require your review" -> [Review]  │
│                                                                 │
│  ┌───────────────────────────────┬───────────────────────────┐  │
│  │ [4. DashboardCardDeck]        │ [5. DashboardNetworkStats]│  │
│  │ "Your Active Cards"           │ Direct Friends: 14        │  │
│  │ [VisualCard 1] [VisualCard 2] │ 2-Hop Network: 86         │  │
│  │ + Manage cards                │ Saved Resources: 8        │  │
│  └───────────────────────────────┴───────────────────────────┘  │
│                                                                 │
│  [6. DashboardRecentActivity]                                   │
│  Recent approvals, friend additions, or newly added crew cards  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Breakdown

### 3.1 `DashboardSearchHero.tsx`
- H1: *"Find help from people you trust"* (warm cursive `Caveat` accent).
- Full-width search bar with high-contrast SVG magnifying glass.
- Instant keyboard shortcut focus (`/` key).
- Displays live search results categorized into:
  - **Cards & Resources**: Shows bank, network, tier, and connection distance (`Direct Friend` or `2nd Degree via [Friend]`).
  - **Friends & Network**: Direct friend cards with fast message button.

### 3.2 `DashboardQuickActions.tsx`
- Fast, accessible action buttons:
  - **Add Card**: Opens the Database Catalog Search / Custom Card modal directly.
  - **Invite Friend**: Opens phone/username/email lookup modal.
  - **Review Requests**: Fast link to pending inbound/outbound approvals with badge counter.

### 3.3 `DashboardPendingAlerts.tsx`
- Sticky amber-tinted notification banner that surfaces only when actionable requests exist.
- Displays requester name, requested card, and inline "Approve" / "Decline" / "Review" shortcuts.

### 3.4 `DashboardCardDeck.tsx`
- Uses the new `VisualCard` engine (Milestone 2).
- Horizontal scrollable strip or grid showcasing the user's active cards with Bank, Network, Tier, and Scope.

### 3.5 `DashboardNetworkSummary.tsx`
- Compact paper-styled metric card:
  - Direct Trusted Connections
  - Extended Network Reach (2nd degree friends)
  - Cards in Wallet
- Replaces the 5 fragmented emoji pills with clean, structured SVG stats.

---

## 4. Implementation Steps

1. **Create Subcomponents:**
   - `frontend/src/components/dashboard/DashboardSearchHero.tsx`
   - `frontend/src/components/dashboard/DashboardQuickActions.tsx`
   - `frontend/src/components/dashboard/DashboardPendingAlerts.tsx`
   - `frontend/src/components/dashboard/DashboardCardDeck.tsx`
   - `frontend/src/components/dashboard/DashboardNetworkSummary.tsx`
2. **Refactor `HomePage.tsx`:**
   - Reduce size from 957 lines to ~150 lines by delegating state and UI to subcomponents.
   - Maintain search debouncing and keyboard navigation.
3. **Responsive Verification:**
   - Mobile (<768px): Vertical stacking, search first, bottom nav padding.
   - Tablet (768-1023px): 2-column grid for card deck and network summary.
   - Desktop (>=1024px): Max content width 920px with side context widgets.
4. **Testing:**
   - Unit test each dashboard subcomponent.
   - Playwright E2E test for the complete dashboard user journey.

---

## 5. Acceptance Criteria

- [ ] Search hero is the primary visual anchor upon page load.
- [ ] Quick actions provide direct 1-click modal access for adding cards and inviting friends.
- [ ] User's cards render realistic visuals via `VisualCard`.
- [ ] Network summary displays clean SVG metrics with zero unicode emojis.
- [ ] Dashboard adapts seamlessly across 375px, 768px, and 1024px+ screen sizes.
