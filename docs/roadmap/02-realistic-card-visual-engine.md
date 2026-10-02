# Milestone 2: Realistic Financial Card Engine (Bank, Network, Tier, Partner, Level)

**Tracked Issue:** [#42](https://github.com/SriSatyaLokesh/card-crew/issues/42)  
**Priority:** High (Core UI Identity)  
**Status:** Ready for Implementation  
**Estimated Complexity:** Medium  

---

## 1. Executive Summary & User Story

> **As a Card Crew member**, I want to view cards in my wallet and my network as realistic, high-fidelity financial card representations displaying the issuing Bank Name, Card Network (Visa, MasterCard, Amex, RuPay, Diners Club), Card Level/Tier (Platinum, Signature, Infinite, World, etc.), Co-brand Partner (Swiggy, Flipkart, Tata Neu, etc.), and Card Type (Credit, Debit, Prepaid, Forex), so that I can instantly recognize the card and its tier benefits at a glance.

Card Crew's value proposition is discovering who in your trusted circle has the right card for an offer, lounge access, or discount. The existing card visualizer is a basic colored rectangle that obscures critical details like bank issuer, payment network, and card tier. This milestone builds a modular, realistic visual card rendering engine.

---

## 2. Codebase Audit: Current State vs Target Specifications

| Feature | Current State (`CardTile.tsx` / `SavedCardItem.tsx`) | Target Architecture (`VisualCard.tsx`) |
|---|---|---|
| **Bank / Issuer Name** | Merged into single title string or absent | Dedicated top header: prominent bank name/wordmark (e.g. `HDFC BANK`, `SBI CARD`, `ICICI BANK`) |
| **Payment Network** | Plain text string (if available) or omitted | Official vector SVG badge: **Visa**, **MasterCard**, **American Express**, **RuPay**, **Diners Club** |
| **Card Tier / Level** | Buried in subtitle or missing | Distinctive badge: `PLATINUM`, `SIGNATURE`, `INFINITE`, `WORLD`, `SELECT`, `REGALIA`, `MILLENNIA` |
| **Co-brand Partner** | Ignored or unstyled in product name | Dedicated co-brand badge: `Swiggy`, `Flipkart`, `Tata Neu`, `Amazon Pay`, `Club Vistara` |
| **Card Type** | Plain text label (`Credit` / `Debit`) | Form factor pill: `CREDIT`, `DEBIT`, `PREPAID`, `FOREX` |
| **Hardware Accents** | Rough CSS lines for chip, text `)))` | Scalable vector `EmvChipIcon` and smooth 4-arc `ContactlessWaveIcon` |
| **Network Visibility** | Unicode emojis `🌐 Network` / `👥 Direct` | Clean SVG badge with `Globe` / `Users` icon + tooltip |
| **Visual Themes** | 4 simple CSS classes (`visual-card-credit`, etc.) | Semantic tier-based finishes: **Obsidian/Black** (Infinite/World Elite), **Platinum Sheen**, **Gold Brushed**, **Cobalt Core**, **Slate Corporate** |

---

## 3. Visual Layout & Component Anatomy

```
┌─────────────────────────────────────────────────────────────┐
│ [BANK NAME / ISSUER]                     [CONTACTLESS WAVE] │
│                                                             │
│ [EMV CHIP]                                                  │
│                                                             │
│ [PRODUCT TITLE / VARIANT]                                   │
│ [CO-BRAND PARTNER BADGE (e.g. Tata Neu / Swiggy)]           │
│                                                             │
│ [CARDHOLDER / NETWORK SCOPE]      [TIER]  [NETWORK SVG]     │
│ (e.g., Direct Friends · Ramesh)   PLATINUM     VISA         │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 CSS Design Tokens & Theming Matrix

```css
/* Card Surface Themes */
.card-theme-infinite {
  background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #020617 100%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  color: #f8fafc;
}

.card-theme-platinum {
  background: linear-gradient(135deg, #334155 0%, #64748b 50%, #475569 100%);
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
  color: #ffffff;
}

.card-theme-gold {
  background: linear-gradient(135deg, #78350f 0%, #b45309 50%, #d97706 100%);
  border: 1px solid rgba(254, 243, 199, 0.3);
  color: #fffbeb;
}

.card-theme-cobalt {
  background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #1d4ed8 100%);
  border: 1px solid rgba(219, 234, 254, 0.25);
  color: #ffffff;
}

.card-theme-corporate {
  background: linear-gradient(135deg, #18181b 0%, #27272a 50%, #3f3f46 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fafafa;
}
```

---

## 4. Implementation Steps

1. **Vector Network Assets (`frontend/src/components/icons/network/`):**
   - Create `VisaLogo.tsx`: Authentic dual-tone or monochrome Visa vector.
   - Create `MasterCardLogo.tsx`: Overlapping red and orange circles.
   - Create `AmexLogo.tsx`: Distinctive American Express box vector.
   - Create `RuPayLogo.tsx`: RuPay dual chevron vector.
   - Create `DinersClubLogo.tsx`: Diners Club split-circle crest.
2. **Unified `VisualCard` Component (`frontend/src/components/VisualCard.tsx`):**
   - Accept either `PersonCard`, `UserCard`, or custom card props.
   - Extract issuer, product name, network, tier, partner, and segment cleanly.
   - Support `size="sm"` (for compact lists / decks) and `size="md"` (for search results and modal previews).
   - Render hardware chip, contactless wave, and visibility scope with zero emojis.
3. **Refactor Existing Consumers:**
   - Update `CardTile.tsx` to wrap `VisualCard`.
   - Update `SavedCardItem.tsx` in `MyCardsPage.tsx`.
   - Update `PersonCardsModal.tsx` (when viewing all cards owned by a network connection).
   - Update `DashboardCardDeck.tsx` (in the new dashboard).
4. **Strict Security Verification:**
   - Confirm that no card number, CVV, or expiration date fields exist or are suggested in the card UI.

---

## 5. Acceptance Criteria

- [ ] All 5 major card networks (Visa, MasterCard, RuPay, Amex, Diners Club) render authentic SVG logos.
- [ ] Card header visibly displays the issuing bank/financial institution.
- [ ] Tier/level (Platinum, Signature, World, Infinite, etc.) and Co-brand partners (Swiggy, Flipkart, Tata Neu) render distinctly.
- [ ] Cards adapt to responsive viewport widths down to 320px without horizontal scroll or label clipping.
- [ ] Accessible labeling announces full card identity (`aria-label`).
- [ ] Zero unicode emojis used anywhere in the card component.
