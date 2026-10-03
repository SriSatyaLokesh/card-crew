# Milestone 11: Mobile-First Experience & Touch Ergonomics

**Tracked Issue:** [#49](https://github.com/SriSatyaLokesh/card-crew/issues/49)  
**Priority:** High (Primary User Surface)  
**Status:** Ready for Implementation  
**Estimated Complexity:** High  

---

## 1. Executive Summary & Philosophy

> **As an active Card Crew user on the move**, I want the mobile application experience to be fast, thumb-friendly, and beautifully responsive, with intuitive bottom navigation and zero horizontal scrolling, so that I can look up cards and coordinate with friends in seconds while at a store checkout or airport lounge.

Desktop is a secondary management station; **mobile is where real-world financial resource coordination happens**. Whether paying a restaurant bill, checking in at a Priority Pass lounge, or redeeming an online shopping coupon on an e-commerce app, Card Crew must excel as a mobile web application.

---

## 2. Mobile Ergonomics & UX Principles

### 2.1 The "Thumb Zone" Navigation Architecture

```
Mobile Screen Top (375px)
┌────────────────────────────────────────┐
│ Hard-to-reach zone                     │
│ -> Logo, Greeting, Compact Avatar      │
├────────────────────────────────────────┤
│ Natural View Zone                      │
│ -> Search Hero                         │
│ -> Active Card Carousel                │
│ -> Pending Requests Stack              │
├────────────────────────────────────────┤
│ Prime Thumb Zone (Bottom 120px)        │
│ -> Primary Quick Action Strip          │
│ -> Fixed Bottom Navigation Bar         │
└────────────────────────────────────────┘
```

### 2.2 Key Mobile UI Patterns

1. **Fixed Bottom Navigation Bar (`BottomNavBar.tsx`):**
   - Replaces the desktop side rail on viewports under 768px.
   - Fixed to viewport bottom with `env(safe-area-inset-bottom)` support.
   - 4 primary destinations:
     - **Search / Home** (`Search` SVG icon)
     - **My Cards** (`CreditCard` SVG icon)
     - **Requests** (`Inbox` SVG icon + live badge count)
     - **Network** (`Users` SVG icon)
   - Height: 64px; touch target >= 48px per tab.
2. **Bottom Sheet Modals (`SheetModal.tsx`):**
   - Modals on mobile do not float in the center of the screen; they slide up from the bottom as a sheet.
   - Smooth drag-down or tap-backdrop to dismiss.
   - Used for **Add Card**, **Invite Friend**, and **Contact Reveal**.
3. **Horizontal Card Carousel with CSS Snap (`scroll-snap-type: x mandatory`):**
   - Allows users to flick through their active cards one by one.
   - Displays dots or index indicator below.
4. **Zero Horizontal Overflow:**
   - Global CSS rule: `body, html { overflow-x: hidden; }`.
   - All forms, search bars, and card lists stretch to 100% width with 16px lateral padding.

---

## 3. CSS Tokens & Mobile Responsive Breakpoints

```css
/* Mobile Breakpoints */
@media (max-width: 767px) {
  /* Hide desktop sidebar */
  .nav-shell {
    display: none;
  }

  /* Reserve bottom space for fixed navigation */
  body {
    padding-bottom: calc(64px + env(safe-area-inset-bottom, 16px));
  }

  /* Full-width container padding */
  .page, .dashboard-container {
    padding: var(--space-4) var(--space-4);
    width: 100%;
    max-width: 100vw;
    box-sizing: border-box;
  }

  /* Bottom sheet modal styling */
  .modal-content {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    max-height: 85vh;
    border-radius: 16px 16px 0 0;
    animation: slideUp 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }
}
```

---

## 4. Implementation Steps

1. Create `frontend/src/components/navigation/BottomNavBar.tsx`.
2. Implement `frontend/src/components/common/SheetModal.tsx` with responsive sliding behavior.
3. Update `App.tsx` and layout shell to render `BottomNavBar` on mobile viewports.
4. Convert `SavedCardItem.tsx` and `CardTile.tsx` to snap-scrollable mobile carousels.
5. Audit and eliminate any fixed pixel widths exceeding 320px across all CSS files.
6. Verify on real device viewports: iPhone SE (375px), iPhone 14/15 (393px), Pixel 7 (412px), iPad Mini (768px).

---

## 5. Acceptance Criteria

- [ ] Mobile navigation is thumb-accessible at the screen bottom with responsive touch targets (>= 48px).
- [ ] No horizontal scrolling exists on any page across standard mobile resolutions (320px–767px).
- [ ] Modals on mobile slide up as bottom sheets rather than centering awkwardly.
- [ ] Card decks support smooth swipe gestures with CSS scroll snapping.
- [ ] Tested and verified against mobile Safari, Android Chrome, and iOS WebView.
