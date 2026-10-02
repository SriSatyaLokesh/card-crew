# Milestone 12: Brand Identity, Official Logo & SVG Favicon

**Tracked Issue:** [#48](https://github.com/SriSatyaLokesh/card-crew/issues/48)  
**Priority:** High (Brand Polish & Visual Trust)  
**Status:** Ready for Implementation  
**Estimated Complexity:** Low / Medium  

---

## 1. Executive Summary & User Story

> **As a Card Crew member**, I want the application to feature a distinctive, professional brand logo and crisp browser favicon, so that Card Crew is immediately recognizable, trustworthy, and polished across browser tabs, home screen bookmarks, and navigation bars.

Currently, `frontend/index.html` lacks a custom favicon, showing only the browser's blank default icon. The UI renders "Card Crew" in a plain text handwriting font without any graphic brand mark. This milestone establishes the official vector brand identity, provides scalable SVG logo components, and configures modern multi-resolution favicons.

---

## 2. Brand Symbolism & Visual Geometry

The Card Crew mark combines two core symbols:
1. **Layered Smart Cards:** Represents the wallet index of financial cards, benefits, and vouchers.
2. **Connected Trust Nodes:** Represents the bilateral peer-to-peer trust graph between verified friends.

```
       ┌───────────┐
  ┌────│─────┐     │  <- Upper Cobalt Card
  │    │  ●──┼──●  │  <- Trust Network Connection
  │    └─────│─────┘
  └──────────┘        <- Lower Midnight Navy Card
```

### 2.1 Vector SVG Asset Specifications

#### Logo Icon Mark (`frontend/src/components/brand/CardCrewLogo.tsx`):
```xml
<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" class="card-crew-logo" aria-hidden="true">
  <!-- Rear Card (Electric Cobalt) -->
  <rect x="12" y="6" width="30" height="22" rx="4" fill="#2563EB" fill-opacity="0.9" stroke="#1D4ED8" stroke-width="1.5"/>
  <!-- Front Card (Midnight Navy) -->
  <rect x="6" y="18" width="30" height="22" rx="4" fill="#0B132B" stroke="#1E293B" stroke-width="1.5"/>
  <!-- EMV Gold Chip Accent -->
  <rect x="10" y="24" width="6" height="5" rx="1" fill="#F59E0B"/>
  <!-- Trust Connection Nodes & Bridge -->
  <line x1="20" y1="29" x2="30" y2="29" stroke="#10B981" stroke-width="2.2" stroke-linecap="round"/>
  <circle cx="20" cy="29" r="2.5" fill="#10B981"/>
  <circle cx="30" cy="29" r="2.5" fill="#10B981"/>
</svg>
```

#### Application Favicon (`frontend/public/favicon.svg`):
A streamlined, high-contrast 32x32 SVG vector that scales crisply down to 16x16 in browser tabs:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#0B132B"/>
  <rect x="8" y="5" width="18" height="13" rx="2.5" fill="#2563EB"/>
  <rect x="5" y="12" width="18" height="13" rx="2.5" fill="#1E293B" stroke="#334155" stroke-width="1"/>
  <rect x="7" y="15" width="4" height="3.5" rx="0.5" fill="#F59E0B"/>
  <line x1="13" y1="18.5" x2="19" y2="18.5" stroke="#10B981" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="13" cy="18.5" r="1.5" fill="#10B981"/>
  <circle cx="19" cy="18.5" r="1.5" fill="#10B981"/>
</svg>
```

---

## 3. Implementation Steps

1. **Favicon File Creation:**
   - Create `frontend/public/favicon.svg` with the vector mark.
   - Generate standard PNG sizes (`favicon-32x32.png`, `apple-touch-icon.png`).
2. **HTML Header Integration (`frontend/index.html`):**
   ```html
   <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
   <link rel="alternate icon" href="/favicon.ico" />
   <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
   <meta name="theme-color" content="#0B132B" />
   ```
3. **Reusable Brand Logo Component:**
   - Create `frontend/src/components/brand/CardCrewBrand.tsx` supporting:
     - `variant="icon"` (standalone mark)
     - `variant="full"` (icon mark + modern geometric sans-serif wordmark)
4. **Deploy Across Core Surfaces:**
   - Update `NavBar.tsx` (desktop header / sidebar).
   - Update `BottomNavBar.tsx` and mobile top bar.
   - Update `LoginPage.tsx` / `SignupPage.tsx` hero.

---

## 4. Acceptance Criteria

- [ ] Browser tabs render the crisp vector SVG favicon.
- [ ] Apple touch icon is properly configured for iOS home-screen bookmarks.
- [ ] Official Card Crew logo component replaces raw cursive text in `NavBar.tsx` and auth pages.
- [ ] Theme color meta tag matches `--primary-navy` (`#0B132B`) for seamless mobile browser bar integration.
