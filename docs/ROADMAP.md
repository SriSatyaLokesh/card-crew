# Card Crew — Comprehensive Product Roadmap (v2.0)

**Baseline:** `main` @ `c5f3f2e` (2026-10-02)  
**Product:** Trusted Personal Resource Network (India-First)  
**Status:** MVP Core Complete; Visual Redesign, Mobile-First UX & Security Hardening Underway  
**Design System Source of Truth:** [`docs/design.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/design.md)  
**Architecture Source of Truth:** [`ARCHITECTURE.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/ARCHITECTURE.md)  
**Product Requirements Document:** [`docs/trusted_personal_resource_network_prd.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/trusted_personal_resource_network_prd.md)  

---

## 1. Vision & Core Philosophy

Card Crew is a **privacy-preserving, trusted personal resource network**. It empowers friends and extended circles to coordinate help — discovering who owns which credit/debit card, airport lounge access pass, or merchant discount voucher — **without ever sharing card numbers, CVVs, PINs, OTPs, or financial credentials**.

The core experience revolves around five non-negotiable principles:
1. **Mobile-First Primacy:** Over 85% of real-world coordination happens on mobile devices when users are shopping, dining, or booking travel. Mobile touch ergonomics (fixed bottom navigation, thumb-zone actions, zero horizontal scroll) take precedence over desktop layouts.
2. **Search First:** The home viewport immediately offers the central resource and friend search bar. Metrics and graph canvases remain secondary context.
3. **Card-Authentic Visuals & Dynamic Theming:** Each card rendered in the app reflects its authentic issuer branding and physical colors (retrieved from the catalog database), featuring realistic EMV chips, contactless arcs, network badges (Visa, MasterCard, Amex, RuPay, Diners), and tier markers (Platinum, Signature, World, Infinite).
4. **Metadata Only:** Never ask for, collect, store, or display sensitive payment credentials.
5. **Zero Emojis & High-Craft Branding:** Complete elimination of raw unicode emojis across all pages, replaced by accessible vector SVG icons, official Card Crew brand logo, and crisp browser favicons.

---

## 2. Deep Audit: What is Built vs. What Needs to Be Built

### 2.1 Design System, Logo & Favicon
- **Current State:** The legacy "paper index" design system in `docs/design.md` used informal cursive `Caveat` headings and muted off-whites that felt unpolished. The app lacked a brand logo and had no favicon in `frontend/index.html`.
- **What Needs to Be Built ([Issue #48](https://github.com/SriSatyaLokesh/card-crew/issues/48)):**
  - **Modern Trust Palette:** Midnight Navy (`#0B132B`, `#1C2541`), Radiant Cobalt (`#2563EB`), Surface Whites (`#FFFFFF`, `#F8FAFC`), Emerald Trust (`#10B981`), Amber (`#F59E0B`), Coral (`#EF4444`).
  - **Official Card Crew Logo:** Vector mark combining layered payment cards with connected trust graph nodes.
  - **Scalable SVG & PNG Favicon:** Integrated into `frontend/index.html` for clean browser tabs and mobile bookmarks.

### 2.2 Iconography & Visual Hygiene
- **Current State:** Widespread unicode emojis (`🔍`, `💳`, `👥`, `📬`, `💬`, `⚙️`, `🌱`, `📥`, `📤`, `🌐`, `⚠️`, `✓`, `👋`) in `NavBar.tsx`, `NetworkStatsDashboard.tsx`, `CardTile.tsx`, and throughout toasts.
- **What Needs to Be Built ([Issue #41](https://github.com/SriSatyaLokesh/card-crew/issues/41)):**
  - Complete purge of all raw unicode emojis across `frontend/src/`.
  - Accessible SVG icon system (`lucide-react` + custom domain SVGs for EMV chip, contactless wave, and card networks).

### 2.3 Visual Card Engine & Dynamic Card Colors
- **Current State:** Basic CSS gradient boxes in `CardTile.tsx` and `SavedCardItem.tsx` with generic CSS chip lines and text `)))`. Cards do not reflect authentic bank color schemes.
- **What Needs to Be Built ([Issue #42](https://github.com/SriSatyaLokesh/card-crew/issues/42), [#48](https://github.com/SriSatyaLokesh/card-crew/issues/48)):**
  - Database catalog storage for `card_color`, `accent_color`, and `gradient_theme` in `catalog_cards`.
  - High-fidelity `VisualCard` component displaying:
    - Issuing Bank Branding (`HDFC Bank`, `SBI Card`, `ICICI Bank`, `Axis Bank`, `Amex`, etc.)
    - Official Payment Network Badges (`Visa`, `MasterCard`, `American Express`, `RuPay`, `Diners Club`)
    - Card Tier / Level Markers (`Platinum`, `Signature`, `Infinite`, `World`, `Gold`, `Millennia`, `Regalia`)
    - Co-brand Partner Badges (`Swiggy`, `Flipkart`, `Tata Neu`, `Amazon Pay`, etc.)
    - Card Form Factor (`Credit`, `Debit`, `Prepaid`, `Forex`)
    - Scalable vector EMV smart chip and contactless payment waves.

### 2.4 Add Card Flow & Catalog Fallback
- **Current State:** 200+ Indian cards seeded in database catalog. **Critical bug in `apiClient.ts:createCard` (lines 181–190):** typing a card name not found in the catalog silently assigns an **arbitrary random unowned catalog card** to the user!
- **What Needs to Be Built ([Issue #43](https://github.com/SriSatyaLokesh/card-crew/issues/43)):**
  - **Database-Catalog-First Addition:** Typeahead search over 200+ database cards.
  - **Missing Card Search & Custom Fallback:** If not present in catalog, structured form captures Bank Name, Card Name, Network, Tier, Partner, and Card Type.
  - Completely eliminate the silent random card assignment bug.

### 2.5 Requests Page Overhaul & Zero Horizontal Scrolling
- **Current State:** `RequestsPage.tsx` has grown to 1,125 lines with wide table rows that force horizontal scrolling on mobile viewports.
- **What Needs to Be Built ([Issue #47](https://github.com/SriSatyaLokesh/card-crew/issues/47)):**
  - Responsive vertical request card stack (`RequestCard.tsx`) with zero horizontal overflow.
  - Clear segregation of **Incoming** (action required) vs **Outgoing** (awaiting response).
  - Rich Contact Hand-Off upon approval (1-click WhatsApp shortcut, phone call, in-app chat).
  - Request timeline audit trail backed by `request_events`.

### 2.6 Identity, Authentication & Profile Management
- **Current State:** `LoginPage.tsx` is an unstyled email/password form. Registration fails to collect phone number or username. `ProfilePage.tsx` uses heavy image uploads to a Supabase Storage bucket with RLS vulnerability surface.
- **What Needs to Be Built ([Issue #44](https://github.com/SriSatyaLokesh/card-crew/issues/44), [#38](https://github.com/SriSatyaLokesh/card-crew/issues/38), [#37](https://github.com/SriSatyaLokesh/card-crew/issues/37)):**
  - Redesigned Sign-in & Sign-up interface supporting Email, Phone (+91), and Username (@handle).
  - Multi-identifier sign-in resolution.
  - Multi-identifier friend lookup (Phone, Username, Email) via rate-limited, exact-match RPC.
  - Expanded Profile page with rich account info and **lightweight, customizable SVG-generated avatars** (Boring-Avatars / DiceBear style), eliminating binary storage uploads.

### 2.7 Reconstructed Dashboard & Mobile-First UX
- **Current State:** `HomePage.tsx` is an overgrown 957-line monolith with mixed concerns and clunky layout.
- **What Needs to Be Built ([Issue #45](https://github.com/SriSatyaLokesh/card-crew/issues/45)):**
  - Search-first hero (*"Find help from people you trust"*).
  - Streamlined Quick Action strip (`+ Add Card`, `+ Invite Friend`).
  - Active Cards deck with smooth mobile swipe snap carousel.
  - Pending approval alerts banner.
  - Thumb-friendly Fixed Bottom Navigation bar (`BottomNavBar.tsx`).

---

## 3. Modular Roadmap Pages of Work (Milestones 1 – 12)

Every milestone is documented as a standalone, actionable implementation page in [`docs/roadmap/`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/roadmap/):

| # | Milestone Title | Tracked Issue | Spec Document | Target Scope |
|---|---|---|---|---|
| **1** | **Zero-Emoji Audit & SVG Icon System** | [#41](https://github.com/SriSatyaLokesh/card-crew/issues/41) | [`01-zero-emoji-svg-iconography.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/roadmap/01-zero-emoji-svg-iconography.md) | Purge all unicode emojis; install `lucide-react` & custom vector SVGs |
| **2** | **Realistic Card Engine & Dynamic Colors** | [#42](https://github.com/SriSatyaLokesh/card-crew/issues/42), [#48](https://github.com/SriSatyaLokesh/card-crew/issues/48) | [`02-realistic-card-visual-engine.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/roadmap/02-realistic-card-visual-engine.md) | Bank branding, Network SVGs, Tier badges, EMV chip, database card colors |
| **3** | **Database-First Add Card & Custom Fallback** | [#43](https://github.com/SriSatyaLokesh/card-crew/issues/43) | [`03-database-first-add-card-and-custom-cards.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/roadmap/03-database-first-add-card-and-custom-cards.md) | Fix silent random card bug; 200+ catalog search + structured custom card form |
| **4** | **Redesigned Sign-in & Sign-up Auth** | [#44](https://github.com/SriSatyaLokesh/card-crew/issues/44) | [`04-auth-redesign-and-multi-identifier.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/roadmap/04-auth-redesign-and-multi-identifier.md) | Multi-identifier onboarding (Email, Phone, Username) + Modern paper-index UI |
| **5** | **Multi-Identifier Friend Network** | [#38](https://github.com/SriSatyaLokesh/card-crew/issues/38) | [`05-multi-identifier-friend-network.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/roadmap/05-multi-identifier-friend-network.md) | Exact-match friend lookup by Phone, Username, Email with rate-limited RPC |
| **6** | **Dashboard Reconstruction & UX Study** | [#45](https://github.com/SriSatyaLokesh/card-crew/issues/45) | [`06-dashboard-reconstruction-and-redesign.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/roadmap/06-dashboard-reconstruction-and-redesign.md) | Search-first hero, quick actions, active cards deck, pending approval alerts |
| **7** | **Chat Trust Gate & Security Guard** | [#34](https://github.com/SriSatyaLokesh/card-crew/issues/34) + Advisory | [`07-chat-trust-security-and-safety.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/roadmap/07-chat-trust-security-and-safety.md) | Gate chat on trust graph; persistent disclaimer; anti-exfiltration Luhn guard |
| **8** | **Device Vault & Resource Expansion** | [#35](https://github.com/SriSatyaLokesh/card-crew/issues/35), [#39](https://github.com/SriSatyaLokesh/card-crew/issues/39), [#40](https://github.com/SriSatyaLokesh/card-crew/issues/40), [#21](https://github.com/SriSatyaLokesh/card-crew/issues/21), [#36](https://github.com/SriSatyaLokesh/card-crew/issues/36) | [`08-vault-and-resource-expansion.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/roadmap/08-vault-and-resource-expansion.md) | Local encrypted notes (AES-GCM); vouchers, lounge access, merchant offers |
| **9** | **Requests Page Redesign (Zero Scroll)** | [#47](https://github.com/SriSatyaLokesh/card-crew/issues/47) | [`09-requests-page-redesign.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/roadmap/09-requests-page-redesign.md) | Eliminate horizontal scroll; responsive cards; 1-click WhatsApp handoff |
| **10** | **Expanded Profile & SVG Avatars** | [#37](https://github.com/SriSatyaLokesh/card-crew/issues/37) | [`10-profile-page-and-svg-avatars.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/roadmap/10-profile-page-and-svg-avatars.md) | Rich profile info; customizable seed-based SVG avatars (zero upload storage) |
| **11** | **Mobile-First Experience & Ergonomics** | [#48](https://github.com/SriSatyaLokesh/card-crew/issues/48) | [`11-mobile-first-experience.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/roadmap/11-mobile-first-experience.md) | Fixed bottom navigation, bottom sheets, 48px touch targets, zero overflow |
| **12** | **Brand Identity, Logo & Favicon** | [#48](https://github.com/SriSatyaLokesh/card-crew/issues/48) | [`12-brand-identity-logo-and-favicon.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/roadmap/12-brand-identity-logo-and-favicon.md) | Official SVG logo, browser favicon, Apple touch icons, brand theme |

---

## 4. Execution Plan & Sequential Dependency Graph

```
Phase 1: Design System & Visual Foundation
[M1: Zero-Emoji SVG Icons] ──► [M12: Logo & Favicon] ──► [M2: Card Visual Engine & Colors]
                                                                  │
Phase 2: Core Data & Identity                                     ▼
[M3: Database-First Add Card] ──► [M4: Multi-Identifier Auth] ──► [M5: Friend Network Lookup]
                                                                  │
Phase 3: Experience Overhaul (Mobile-First)                       ▼
[M11: Mobile-First Ergonomics] ──► [M6: Dashboard Redesign] ──► [M9: Requests Page Redesign]
                                                                  │
Phase 4: Profile, Security & Expansion                            ▼
[M10: Profile & SVG Avatars] ──► [M7: Chat Trust Gate] ──► [M8: Local Vault & Resources]
```

---

## 5. Security & Boundary Guardrails

Every milestone must strictly uphold the system boundaries:
1. **Never Store Payment Credentials:** Card numbers (PAN), CVVs, PINs, OTPs, or passwords must never have database columns, input fields, or storage buckets.
2. **Exact-Match-Only Discovery:** Finding friends by phone/email/username must never return browsable directories, partial fuzzy results, or expose email addresses to clients.
3. **No Financial Settlement:** Card Crew is strictly an index of who owns what; it does not process payments, escrow, or lending transactions.
4. **Device-Local Vault:** Personal card notes must remain encrypted strictly on the user's device with AES-256-GCM; zero cloud network transmission.
5. **Zero-Upload Avatars:** Prefer deterministic client-side SVG avatars over server-side image uploads.
