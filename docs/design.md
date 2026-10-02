# Card Crew UI Design System (v2.0)

**Status:** Implementation Source of Truth  
**Product:** Trusted Personal Resource Network (India-First)  
**Scope:** Mobile-First Primary Web App & Responsive Desktop Dashboard  
**Tracked Issue:** [#48](https://github.com/SriSatyaLokesh/card-crew/issues/48)  

---

## 1. Product Feeling & Visual Identity

Card Crew is a **trusted, high-security personal resource network**. The visual language must feel:
- **Trustworthy & Modern:** Premium financial clarity without bank bloat. Clean white and slate surfaces, dark navy accents, and radiant cobalt signals.
- **Mobile-First:** 85%+ of card coordination happens on mobile devices when users are shopping, dining, or booking flights. Mobile touch ergonomics take precedence over desktop layouts.
- **Zero Emojis:** All unicode emojis are replaced with crisp, accessible vector SVG icons.
- **Authentic Financial Craft:** Cards rendered in the UI mirror their authentic physical counterparts, featuring real bank colorways, metallic EMV chips, contactless arcs, network badges (Visa, MasterCard, Amex, RuPay, Diners), and tier markers (Platinum, Signature, World, Infinite).

---

## 2. Core Design Principles

1. **Mobile-First UX:** Touch targets must be at least 48px. Navigation is thumb-accessible at the screen bottom. No clipped text or horizontal overflow.
2. **Search First:** The home viewport immediately offers the central resource and friend search bar. Metrics and graph canvas remain secondary context.
3. **Card-Authentic Visuals:** Each card carries its authentic issuer color palette, gradient theme, and branding retrieved directly from the database catalog.
4. **Zero Payment Credentials:** Never display or request card numbers, CVVs, PINs, or expiration dates. The design reinforces metadata-only privacy.
5. **Clear Trust Boundaries:** Explicit visual separation between `Direct Friend` (1st-degree), `Extended Crew` (2nd-degree), and `Pending Request`.
6. **Zero Emojis:** Strict vector SVG iconography with uniform stroke, scalable viewBoxes, and accessible ARIA attributes.

---

## 3. Brand Identity, Logo & Favicon

### 3.1 Card Crew Brand Logo

The Card Crew logo fuses two core metaphors: **overlapping financial cards** and **trusted connection nodes**.

```
       ┌───────────┐
  ┌────│─────┐     │  <- Two layered, rounded credit cards
  │    │  ●──┼──●  │  <- Connected trust nodes spanning the cards
  │    └─────│─────┘
  └──────────┘
```

#### Official SVG Vector Specification:
```xml
<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" class="card-crew-logo">
  <!-- Rear Card (Electric Cobalt) -->
  <rect x="12" y="6" width="30" height="22" rx="4" fill="#2563EB" fill-opacity="0.85" stroke="#1D4ED8" stroke-width="1.5"/>
  <!-- Front Card (Midnight Navy) -->
  <rect x="6" y="18" width="30" height="22" rx="4" fill="#0B132B" stroke="#1E293B" stroke-width="1.5"/>
  <!-- EMV Chip Accent -->
  <rect x="10" y="24" width="6" height="5" rx="1" fill="#F59E0B"/>
  <!-- Trust Connection Nodes & Bridge -->
  <line x1="20" y1="29" x2="30" y2="29" stroke="#10B981" stroke-width="2" stroke-linecap="round"/>
  <circle cx="20" cy="29" r="2.5" fill="#10B981"/>
  <circle cx="30" cy="29" r="2.5" fill="#10B981"/>
</svg>
```

### 3.2 Application Favicon
- Linked in `frontend/index.html` as:
  ```html
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <meta name="theme-color" content="#0B132B" />
  ```

---

## 4. Color Tokens (Modern Trust Palette)

```css
:root {
  /* Brand Primary */
  --primary-navy: #0b132b;
  --primary-navy-surface: #1c2541;
  --cobalt-600: #2563eb;
  --cobalt-700: #1d4ed8;
  --cobalt-50: #eff6ff;

  /* Surfaces & Neutrals */
  --surface-base: #f8fafc;
  --surface-card: #ffffff;
  --surface-elevated: #ffffff;
  --border-subtle: #e2e8f0;
  --border-medium: #cbd5e1;

  /* Ink & Typography */
  --ink-950: #0f172a;
  --ink-800: #1e293b;
  --ink-600: #475569;
  --ink-400: #94a3b8;

  /* Semantic Feedback */
  --emerald-600: #10b981;
  --emerald-50: #ecfdf5;
  --amber-600: #f59e0b;
  --amber-50: #fffbeb;
  --coral-600: #ef4444;
  --coral-50: #fef2f2;

  /* Focus & Active */
  --focus-ring: #2563eb;
  --touch-target-min: 48px;
}
```

---

## 5. Typography Hierarchy

Moving away from informal handwriting cursives to clean, modern, high-legibility geometric sans-serif:
- **Headings & Brand Title:** `Inter`, `Plus Jakarta Sans`, system `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`.
- **Numeric & Card Data:** `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`.
- **Scale:**
  - Display Title: 2.25rem (36px), 700 bold
  - Section Header: 1.5rem (24px), 600 semibold
  - Card Product Title: 1.125rem (18px), 600 semibold
  - Body Text: 1rem (16px), line-height 1.5
  - Small / Badge: 0.8125rem (13px), 600 semibold

---

## 6. Dynamic Card Visual Theming Engine

Each card stored in the catalog specifies its visual appearance:

| Card Series / Bank | Primary Hex | Accent Hex | Gradient / Visual Theme |
|---|---|---|---|
| **HDFC Millennia** | `#1E3A8A` | `#38BDF8` | Deep Cobalt to Cyan Gloss |
| **HDFC Regalia Gold** | `#1E293B` | `#D97706` | Slate Black with Brushed Gold |
| **HDFC Infinia** | `#090D16` | `#475569` | Obsidian Black Metal with Silver Rim |
| **SBI SimplyCLICK** | `#1D4ED8` | `#F97316` | Electric Blue with Vibrant Orange Accent |
| **ICICI Amazon Pay** | `#18181B` | `#F59E0B` | Charcoal Matte with Amazon Gold Wave |
| **Axis Magnus** | `#4A044E` | `#F59E0B` | Deep Burgundy Velvet with Gold |
| **Amex Platinum** | `#475569` | `#E2E8F0` | Brushed Stainless Steel Metallic |
| **Tata Neu Infinity** | `#2E1065` | `#EC4899` | Neu Royal Violet to Magenta Glow |

### 6.1 Database Schema Integration
`catalog_cards` captures:
- `card_color text not null default '#1E3A8A'`
- `accent_color text not null default '#38BDF8'`
- `gradient_theme text not null default 'default'`

---

## 7. Mobile-First Layout Architecture

```
Mobile Viewport (320px – 767px)
┌────────────────────────────────────────┐
│ [Logo] Card Crew            [Avatar]  │ <- Top App Header (56px)
├────────────────────────────────────────┤
│ [ 🔍 Search cards or friends...      ] │ <- Search Hero
├────────────────────────────────────────┤
│ [ + Add Card ]  [ + Invite ] [Alerts]  │ <- Quick Action Pill Strip
├────────────────────────────────────────┤
│ Active Cards (Swipeable Snap Deck)     │
│ [Card 1]  [Card 2]  [Card 3]           │ <- Horizontal Scroll Snap
├────────────────────────────────────────┤
│ Pending Requests (Vertical Stack)      │
│ ┌────────────────────────────────────┐ │
│ │ Ramesh requested HDFC Regalia      │ │
│ │ [Approve]             [Decline]    │ │
│ └────────────────────────────────────┘ │
├────────────────────────────────────────┤
│ [Search] [Cards] [Requests] [Network]  │ <- Fixed Bottom Nav (64px)
└────────────────────────────────────────┘
```

### 7.1 Key Mobile Ergonomics
1. **Fixed Bottom Navigation:** Thumb-friendly bottom navigation bar with 4 primary destinations (Search, My Cards, Requests, Network).
2. **Bottom-Sheet Modals (`sheet-modal`):** Modals slide up from bottom on mobile with smooth swipe-down-to-dismiss gesture.
3. **Zero Horizontal Overflow:** Strict `overflow-x: hidden` across all containers; wide tables replaced with vertical card lists.
4. **Touch Target Size:** Buttons, inputs, and links have minimum 48px height and width.
