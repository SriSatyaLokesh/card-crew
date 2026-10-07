# Milestone 8: Local Encrypted Vault & V1 Resource Expansion

**Tracked Issues:** [#35](https://github.com/SriSatyaLokesh/card-crew/issues/35), [#39](https://github.com/SriSatyaLokesh/card-crew/issues/39), [#21](https://github.com/SriSatyaLokesh/card-crew/issues/21), [#40](https://github.com/SriSatyaLokesh/card-crew/issues/40), [#36](https://github.com/SriSatyaLokesh/card-crew/issues/36)  
**Priority:** Medium / Strategic  
**Status:** Architecture Designed; Execution Scheduled after Milestones 1–6  
**Estimated Complexity:** High  

---

## 1. Executive Summary & User Story

> **As a Card Crew member**, I want to securely store device-only personal card notes in an encrypted local vault without sending private notes to any cloud server, and I want to discover and share broader resources (such as airport lounge guest passes, shopping vouchers, and merchant discounts) through my trusted network.

Card Crew's mission extends from payment card discovery to a comprehensive, trusted personal resource network (PRD §8). This milestone delivers two foundational capabilities:
1. **Device-Local Encrypted Card Vault (PRD §13.3):** Client-side zero-knowledge encrypted notes for billing cycles, reward pointers, or fee waivers.
2. **V1 Resource & Offers Expansion (PRD §8, §13.5):** Expanding beyond cards into lounge passes, vouchers, and merchant discount matching (Offer → Card → Friend).

---

## 2. Part A: Device-Local Encrypted Vault (#35)

### 2.1 Security Model: Strict Device-Local Zero Knowledge
- **Storage:** Browser `IndexedDB` (not `localStorage`).
- **Encryption:** AES-256-GCM authenticated encryption via the standard **Web Crypto API**.
- **Key Derivation:** PBKDF2 (100,000+ iterations, SHA-256) or WebAuthn biometric passkey.
- **Zero Cloud Network Calls:** Unencrypted note text and encryption keys are **never** transmitted across the network, logged, or saved in Supabase or server databases.
- **Data Loss Policy:** Explicitly documented as device-local: if the browser storage is cleared or device wiped, local notes do not survive.

---

## 3. Part B: V1 Resource Policy & Expansion (#39, #40)

### 3.1 Generic Resource Policy Model (PRD §13.5)
Expand `resources` beyond `card` with a flexible policy enum:
- `DISCOVERABLE`: Searchable by network.
- `REQUESTABLE`: Peer can request help.
- `TRANSFERABLE`: Ownership can be handed off (e.g. voucher code).
- `LENDABLE`: Temporarily utilized (e.g. lounge companion access).
- `EXPIRABLE`: Automatically filtered out once `expiry_at < now()`.

### 3.2 V1 Resource Types
- **Airport Lounge Access:** Companion / guest vouchers (Priority Pass, Dreamfolks, bank-sponsored).
- **Merchant Gift Cards & Vouchers:** E.g. Amazon, Flipkart, MakeMyTrip vouchers with verified expiration dates.
- **Subscriptions & Memberships:** Club Vistara, Marriott Bonvoy, Times Prime.

---

## 4. Part C: Merchant Offers & Search Flow (#21, #36)

### 4.1 Offer → Card → Person Discovery
Instead of knowing which card has a discount, a user simply searches: *"Swiggy"* or *"Flight discount"*.
- System looks up merchant `Swiggy`.
- Matches active offers (e.g., *"15% off up to ₹150 on HDFC Swiggy Card"*).
- Traverses the trust graph to identify which direct or 2nd-degree friends own that eligible card.
- User can immediately send a request to their friend with the offer context pre-filled.

### 4.2 Schema Sketch
- `merchants`: `(id, name, slug, logo_url)`
- `offers`: `(id, merchant_id, title, discount_pct, max_discount, min_order, valid_until)`
- `offer_eligible_cards`: `(offer_id, catalog_item_id)`

---

## 5. Acceptance Criteria

- [ ] Vault notes encrypt client-side with AES-256-GCM; zero network requests contain plaintext notes.
- [ ] Resources support `coupon`, `voucher`, and `lounge_access` with enforced expiration timestamps.
- [ ] Users can search by merchant name and see which friends have cards eligible for merchant discounts.
- [ ] All new components strictly adhere to the zero-emoji SVG icon standard and paper-index styling.
