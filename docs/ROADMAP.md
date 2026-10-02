# Card Crew — Comprehensive Product Roadmap

**Baseline:** `main` @ `c5f3f2e` (2026-10-02)  
**Product:** Trusted Personal Resource Network (India-First)  
**Status:** MVP Core Complete; Phase 1 Redesign & Hardening Underway  
**Design System Source of Truth:** [`docs/design.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/design.md)  
**Architecture Source of Truth:** [`ARCHITECTURE.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/ARCHITECTURE.md)  
**Product Requirements Document:** [`docs/trusted_personal_resource_network_prd.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/trusted_personal_resource_network_prd.md)  

---

## 1. Vision & Core Philosophy

Card Crew is a **privacy-preserving, trusted personal resource index**. It is designed to help friends and trusted circles coordinate help — discovering who owns which credit/debit card, lounge pass, or shopping voucher — **without ever sharing card numbers, CVVs, PINs, OTPs, or financial credentials**.

The core experience revolves around five non-negotiable principles:
1. **Search First:** The home experience begins with search, not cluttered metric feeds.
2. **Metadata Only:** Never ask for, collect, store, or display sensitive payment credentials.
3. **Explicit Trust:** Clearly distinguish between Direct Friends (1st degree) and Extended Network (2nd degree).
4. **Owner Control & Privacy:** Approvals are required before contact information is disclosed.
5. **Calm, Serious Craft:** Clean paper index + cobalt signal aesthetic; **zero emojis**, replaced by accessible SVG vector iconography.

---

## 2. Deep Audit: What is Already Built vs. What Needs to Be Built

### 2.1 Identity & Authentication
- **Already Built:**
  - Supabase Auth email/password authentication.
  - User profiles table (`public.profiles`) with `id`, `display_name`, `phone`, `avatar_url`, and `status`.
  - Profile synchronization RPC (`public.sync_profile`).
- **Gaps & What Needs to Be Built:**
  - **Sign-in & Sign-up Redesign:** `LoginPage.tsx` is an unstyled, barebones email/password form that lacks branding and fails to capture phone or username.
  - **Phone Number Registration:** While `profiles.phone` exists in schema, onboarding never captures it.
  - **Username Handles:** No `username` column in `profiles`; users cannot choose an `@handle`.
  - **Multi-Identifier Login:** Inability to log in using phone number or username.

### 2.2 Social Graph & Friend Adding
- **Already Built:**
  - Bilateral friendship tables (`friendships`, `friend_edges`) with triggers.
  - Friend request workflows (`send_friend_request`, `accept_friend_request`, `decline_friend_request`).
  - 2-hop trust network traversal (`search_network` RPC).
  - Force-directed D3 network graph visualization (`NetworkGraph.tsx`).
- **Gaps & What Needs to Be Built:**
  - **Multi-Identifier Friend Lookup:** Users currently need another person's raw internal `user_id` (UUID) to send a friend request. Must support exact-match lookup by **Phone Number**, **Username**, and **Email** without directory harvesting or email leakage.
  - **Anti-Enumeration Throttling:** Must protect exact-match lookup RPC against brute-force phone/email harvesting.

### 2.3 Card Catalog & Resource Wallet
- **Already Built:**
  - Comprehensive 200+ Indian card catalog seeded in `catalog_items`, `catalog_cards`, `issuers`, `card_networks`.
  - Distinct separation of `segment` (retail, co-branded, corporate), `variant` (tier), and `card_type` (credit, debit, prepaid).
  - User resource attachments stored in `resources` table with `visibility_depth` (0=private, 1=friends, 2=network).
- **Gaps & What Needs to Be Built:**
  - **Critical Fallback Bug:** In `apiClient.ts:createCard` (lines 181–190), if a typed card is not found in the catalog, the code silently assigns an **arbitrary random unowned card** to the user!
  - **Database-Catalog-First Addition:** The Add Card flow must search the 200+ database cards first.
  - **Missing Card Search & Custom Card Fallback:** If a card is not in the database catalog, allow user to search or enter structured custom card metadata (Bank, Product Name, Network, Tier, Partner, Card Type) without corrupting catalog integrity.

### 2.4 Visual Design & Iconography
- **Already Built:**
  - Paper index + cobalt design system guidelines in `docs/design.md`.
  - CSS tokens for surfaces, typography, and contrast.
- **Gaps & What Needs to Be Built:**
  - **Zero-Emoji Rule:** Widespread unicode emojis (`🔍`, `💳`, `👥`, `📬`, `💬`, `⚙️`, `🌱`, `📥`, `📤`, `🌐`, `⚠️`, `✓`, `👋`) scattered across all components must be completely replaced with accessible SVG icons.
  - **Realistic Card Visual Engine:** `CardTile.tsx` and `SavedCardItem.tsx` are generic colored boxes missing:
    - Issuing Bank Branding (`HDFC Bank`, `SBI Card`, `ICICI Bank`, `Axis Bank`, etc.)
    - Payment Network SVG Badges (`Visa`, `MasterCard`, `American Express`, `RuPay`, `Diners Club`)
    - Card Tier / Level Markers (`Platinum`, `Signature`, `Infinite`, `World`, `Gold`, `Millennia`, `Regalia`)
    - Co-brand Partner Badges (`Swiggy`, `Flipkart`, `Tata Neu`, `Amazon Pay`, etc.)
    - Card Type Indicators (`Credit`, `Debit`, `Prepaid`, `Forex`)
    - Vector EMV Chip & Contactless Waves.
  - **Dashboard Reconstruction:** `HomePage.tsx` has grown into a 957-line monolith with mixed UX concerns. It must be reconstructed into a search-first, modular dashboard.

### 2.5 Security & Trust Enforcement
- **Already Built:**
  - Server-enforced RLS policies across core tables.
  - Audit logging in `request_events`.
  - Contact handoff gating (`reveal_contact` RPC).
- **Gaps & What Needs to Be Built:**
  - **Chat Authorization Trust Gate:** `get_or_create_direct_chat` currently allows any authenticated user to message any other user without being friends.
  - **Avatar Storage RLS:** Bucket policies must be scoped to caller's `auth.uid()` path prefix.
  - **Anti-Exfiltration Content Guard:** Client and server heuristic guard (Luhn validation + CVV/PIN regex) to prevent users from sharing payment secrets in chat.
  - **Device-Local Encrypted Card Vault:** Strict zero-knowledge local-only note encryption (AES-256-GCM + IndexedDB).

---

## 3. Phased Execution Roadmap & Milestone Matrix

To ensure focused execution, the roadmap is partitioned into modular, standalone **pages of work** in [`docs/roadmap/`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/roadmap/):

| Milestone | Focus Area | Tracked Issue | Spec Document | Status |
|---|---|---|---|---|
| **Milestone 1** | **Zero-Emoji Audit & Accessible SVG Icon System** | [#41](https://github.com/SriSatyaLokesh/card-crew/issues/41) | [`01-zero-emoji-svg-iconography.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/roadmap/01-zero-emoji-svg-iconography.md) | **Next Up** |
| **Milestone 2** | **Realistic Visual Card Engine (Bank, Network, Tier, Partner, Level)** | [#42](https://github.com/SriSatyaLokesh/card-crew/issues/42) | [`02-realistic-card-visual-engine.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/roadmap/02-realistic-card-visual-engine.md) | **Next Up** |
| **Milestone 3** | **Database-Catalog-First Add Card & Custom Card Fallback** | [#43](https://github.com/SriSatyaLokesh/card-crew/issues/43) | [`03-database-first-add-card-and-custom-cards.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/roadmap/03-database-first-add-card-and-custom-cards.md) | **Next Up** |
| **Milestone 4** | **Redesigned Sign-in & Sign-up with Multi-Identifier Auth** | [#44](https://github.com/SriSatyaLokesh/card-crew/issues/44) | [`04-auth-redesign-and-multi-identifier.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/roadmap/04-auth-redesign-and-multi-identifier.md) | **Next Up** |
| **Milestone 5** | **Multi-Identifier Friend Network (Phone, Username, Email)** | [#38](https://github.com/SriSatyaLokesh/card-crew/issues/38) | [`05-multi-identifier-friend-network.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/roadmap/05-multi-identifier-friend-network.md) | **Next Up** |
| **Milestone 6** | **Dashboard Reconstruction & Search-First Experience** | [#45](https://github.com/SriSatyaLokesh/card-crew/issues/45) | [`06-dashboard-reconstruction-and-redesign.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/roadmap/06-dashboard-reconstruction-and-redesign.md) | **Ready** |
| **Milestone 7** | **Chat Trust Gate Security Fix & Anti-Exfiltration Safety** | [#34](https://github.com/SriSatyaLokesh/card-crew/issues/34) + Advisory | [`07-chat-trust-security-and-safety.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/roadmap/07-chat-trust-security-and-safety.md) | **Ready** |
| **Milestone 8** | **Device-Local Encrypted Vault & V1 Resource Expansion** | [#35](https://github.com/SriSatyaLokesh/card-crew/issues/35), [#39](https://github.com/SriSatyaLokesh/card-crew/issues/39), [#21](https://github.com/SriSatyaLokesh/card-crew/issues/21), [#40](https://github.com/SriSatyaLokesh/card-crew/issues/40), [#36](https://github.com/SriSatyaLokesh/card-crew/issues/36) | [`08-vault-and-resource-expansion.md`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/roadmap/08-vault-and-resource-expansion.md) | **Scheduled** |

---

## 4. Immediate Work Plan: First 3–4 Milestones

The team will execute the first 4 milestones in immediate sequential order:

```
[Milestone 1: SVG Iconography]
           │
           ▼
[Milestone 2: Realistic Visual Card Engine]
           │
           ▼
[Milestone 3: Database Catalog-First Add Card Flow]
           │
           ▼
[Milestone 4 & 5: Multi-Identifier Auth & Friend Network]
           │
           ▼
[Milestone 6: Dashboard Reconstruction]
```

### 1. Milestone 1: Accessible SVG Iconography System ([Issue #41](https://github.com/SriSatyaLokesh/card-crew/issues/41))
- **Why First:** Provides visual cleanliness and unlocks design token compliance across all UI components.
- **Deliverables:** Zero unicode emojis in `frontend/src/`, `lucide-react` integration, custom hardware/network SVGs, automated emoji-prevention lint test.

### 2. Milestone 2: Realistic Visual Card Engine ([Issue #42](https://github.com/SriSatyaLokesh/card-crew/issues/42))
- **Why Second:** Foundational component used across Search results, Wallet, Person modals, and the new Dashboard.
- **Deliverables:** `VisualCard.tsx` rendering authentic Bank Name, Payment Network (Visa, Mastercard, Amex, RuPay, Diners), Tier/Level (Platinum, Signature, World, Infinite), Co-brand Partner, EMV chip, and contactless wave.

### 3. Milestone 3: Database-Catalog-First Add Card Flow ([Issue #43](https://github.com/SriSatyaLokesh/card-crew/issues/43))
- **Why Third:** Fixes the critical bug where missing cards get assigned random unowned catalog cards.
- **Deliverables:** High-speed typeahead search over 200+ database cards; custom card fallback form capturing Bank, Card Name, Network, Tier, Partner, and Type; zero random card assignment.

### 4. Milestone 4: Multi-Identifier Sign-in & Sign-up ([Issue #44](https://github.com/SriSatyaLokesh/card-crew/issues/44))
- **Why Fourth:** Completes onboarding identity so users can register with Email, Phone Number (+91), and Username (@handle), enabling seamless friend discovery in Milestone 5.
- **Deliverables:** Redesigned paper-index auth screen, multi-identifier login resolution, synchronized profile creation.

---

## 5. Security & Boundary Guardrails

Every milestone must strictly uphold the system boundaries:
1. **Never Store Payment Credentials:** Card numbers (PAN), CVVs, PINs, OTPs, or passwords must never have database columns, input fields, or storage buckets.
2. **Exact-Match-Only Discovery:** Finding friends by phone/email/username must never return browsable directories, partial fuzzy results, or expose email addresses to clients.
3. **No Financial Settlement:** Card Crew is strictly an index of who owns what; it does not process payments, escrow, or lending transactions.
4. **Device-Local Vault:** Personal card notes must remain encrypted strictly on the user's device with AES-256-GCM; zero cloud network transmission.

---

## 6. How to Contribute

1. Pick an open milestone issue from GitHub ([#41](https://github.com/SriSatyaLokesh/card-crew/issues/41), [#42](https://github.com/SriSatyaLokesh/card-crew/issues/42), [#43](https://github.com/SriSatyaLokesh/card-crew/issues/43), [#44](https://github.com/SriSatyaLokesh/card-crew/issues/44), [#38](https://github.com/SriSatyaLokesh/card-crew/issues/38), [#45](https://github.com/SriSatyaLokesh/card-crew/issues/45)).
2. Read the corresponding specification document in [`docs/roadmap/`](file:///D:/professional/code/SriSatyaLokesh/card-crew/docs/roadmap/).
3. Create a feature branch: `git checkout -b feat/<issue-number>-<short-description>`.
4. Implement changes adhering to the acceptance criteria, accessibility standards, and test suites.
5. Submit a PR referencing the issue (`Closes #<issue-number>`).
