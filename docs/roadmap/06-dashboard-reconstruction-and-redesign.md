# Milestone 6: Dashboard Reconstruction & Mobile-First UX Study

**Tracked Issue:** [#45](https://github.com/SriSatyaLokesh/card-crew/issues/45)  
**Priority:** High (Core Application Experience)  
**Status:** Ready for Implementation  
**Estimated Complexity:** High  

---

## 1. UX Study: The Core Application Idea & Customer Needs

To reconstruct the dashboard properly, we must align the interface directly with the **fundamental customer journey** of Card Crew:

### 1.1 The Core Customer Job-to-be-Done
> *"I am about to make an e-commerce purchase, dine at a restaurant, or travel through an airport lounge. I want to know in seconds which of my trusted friends has the right card or voucher, and send them a polite, private request for help."*

### 1.2 Five Key Customer Needs

1. **Instant Search (Zero Latency to Query):**
   - The user shouldn't have to navigate past graphs or dense tables. The search bar must be the primary visual anchor in the viewport, supporting fuzzy card names, banks, or merchant offers (e.g. *"Swiggy"*, *"HDFC Millennia"*, *"Lounge access BLR"*).
2. **Effortless Quick Actions (Thumb-Friendly):**
   - Adding a card or inviting a friend shouldn't require page jumps. Quick action pills at the top of the mobile viewport (`+ Add Card`, `+ Invite Friend`) trigger smooth bottom-sheet modals.
3. **Actionable Approvals Banner (Attention-Guaranteed):**
   - If a friend requested a card, this is high urgency. The dashboard surfaces an amber notification card at the top with 1-click **Approve** and **Decline** options.
4. **My Active Cards Deck (Visual Wallet):**
   - Users take pride in their cards and want to see their shared wallet. A horizontal swipeable card deck shows each card with its authentic bank colors, network logo, tier, and sharing scope.
5. **Mobile-First Primacy:**
   - 85%+ of usage occurs on smartphones. The desktop layout is an expansive adaptation; the mobile layout is the **primary product interface**.

---

## 2. Reconstructed Dashboard Architecture

```
Mobile Viewport (320px – 767px)
┌────────────────────────────────────────────────────────┐
│ [Logo] Card Crew                           [Avatar]    │ <- Top Brand Bar
├────────────────────────────────────────────────────────┤
│ [1. SEARCH HERO]                                       │
│ "Find help from people you trust"                      │
│ ┌────────────────────────────────────────────────────┐ │
│ │ 🔍 Search cards, banks, offers, or friends...       │ │
│ └────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────┤
│ [2. QUICK ACTION STRIP]                                │
│ [ + Add Card ]     [ + Invite Friend ]    [ 📬 Alerts ] │
├────────────────────────────────────────────────────────┤
│ [3. PENDING APPROVALS ALERT] (Dynamic)                 │
│ ┌────────────────────────────────────────────────────┐ │
│ │ ⚠️ 2 requests pending your review                  │ │
│ │ Ramesh needs HDFC Regalia · [Review Now]           │ │
│ └────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────┤
│ [4. MY CARDS DECK] (Horizontal Snap Carousel)          │
│ ┌──────────────────────┐ ┌──────────────────────────┐  │
│ │ [VisualCard 1: HDFC] │ │ [VisualCard 2: SBI]      │  │
│ └──────────────────────┘ └──────────────────────────┘  │
├────────────────────────────────────────────────────────┤
│ [5. TRUST NETWORK PULSE]                               │
│ 👥 Direct Friends: 14     🌐 2-Hop Network Reach: 86   │
├────────────────────────────────────────────────────────┤
│ [Search]      [Cards]      [Requests (2)]    [Network] │ <- Fixed Bottom Nav
└────────────────────────────────────────────────────────┘
```

---

## 3. Component Breakdown & Refactoring

`HomePage.tsx` (currently 957 lines) is refactored into modular subcomponents in `frontend/src/components/dashboard/`:

1. **`DashboardSearchHero.tsx`**:
   - Clean, distraction-free hero section with autofocus and keyboard shortcut (`/`).
   - Categorized live search dropdown (Cards / Friends) with relationship distance pills (`1st Degree` / `2nd Degree via [Friend]`).
2. **`DashboardQuickActions.tsx`**:
   - Rapid action buttons triggering bottom-sheet modals:
     - `+ Add Card`: Launches Database Catalog Search / Custom Card fallback modal.
     - `+ Invite Friend`: Launches Phone / Username / Email lookup modal.
3. **`DashboardPendingAlerts.tsx`**:
   - Clean amber callout banner rendered when inbound requests are pending response.
4. **`DashboardCardDeck.tsx`**:
   - Horizontal snap carousel utilizing `VisualCard` with authentic card colorways.
5. **`DashboardNetworkPulse.tsx`**:
   - Replaces fragmented emoji stat pills with clean SVG metrics.

---

## 4. Implementation Steps

1. Create modular dashboard subcomponents in `frontend/src/components/dashboard/`.
2. Refactor `HomePage.tsx` to compose the subcomponents, reducing file size to <150 lines.
3. Connect quick actions directly to the Add Card modal (Milestone 3) and Multi-Identifier Friend lookup (Milestone 5).
4. Implement mobile swipe carousel with CSS `scroll-snap-type: x mandatory`.
5. Integrate with Bottom Navigation Bar (Milestone 11).
6. Verify layout responsiveness across 320px, 375px, 768px, and 1024px+ viewports.

---

## 5. Acceptance Criteria

- [ ] Search hero is the primary visual anchor in the viewport upon loading.
- [ ] Quick action buttons open streamlined modals for card addition and friend invitation.
- [ ] Active cards render as a swipeable visual deck with authentic bank colors.
- [ ] Pending requests appear as prominent, actionable alerts.
- [ ] Zero horizontal page overflow; mobile layout is touch-optimized (>= 48px targets).
