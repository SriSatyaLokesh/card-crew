# Milestone 2: Realistic Financial Card Engine (Bank, Network, Tier, Partner, Level & Dynamic Card Colors)

**Tracked Issue:** [#42](https://github.com/SriSatyaLokesh/card-crew/issues/42) & [#48](https://github.com/SriSatyaLokesh/card-crew/issues/48)  
**Priority:** High (Core UI Identity)  
**Status:** Ready for Implementation  
**Estimated Complexity:** Medium / High  

---

## 1. Executive Summary & User Story

> **As a Card Crew member**, I want each card in my wallet and my network to display its authentic issuing bank colors, branding, network badge (Visa, MasterCard, Amex, RuPay, Diners Club), card level/tier (Platinum, Signature, Infinite, World), co-brand partner (Swiggy, Flipkart, Tata Neu), and card type (Credit, Debit, Prepaid, Forex) on a realistic, high-fidelity card graphic, so that I can instantly recognize the card and its tier benefits at a glance.

Card Crew's value proposition is discovering who in your trusted circle has the right card for an offer, lounge access, or discount. The existing card visualizer is a basic colored rectangle that obscures critical details like bank issuer, payment network, and card tier. Moreover, cards lacked individual authentic colorways. This milestone integrates database-backed card color theming and builds a realistic visual card engine.

---

## 2. Codebase Audit: Current State vs Target Specifications

| Feature | Current State (`CardTile.tsx` / `SavedCardItem.tsx`) | Target Architecture (`VisualCard.tsx`) |
|---|---|---|
| **Card Colors & Theming** | 4 static generic CSS classes (`credit`, `debit`, `prepaid`, `business`) | **Database-backed dynamic colorways** (`card_color`, `accent_color`, `gradient_theme`) stored in `catalog_cards` matching physical card artwork |
| **Bank / Issuer Name** | Merged into single title string or absent | Dedicated top header: prominent bank name/wordmark (e.g. `HDFC BANK`, `SBI CARD`, `ICICI BANK`, `AXIS BANK`) |
| **Payment Network** | Plain text string (if available) or omitted | Official vector SVG badge: **Visa**, **MasterCard**, **American Express**, **RuPay**, **Diners Club** |
| **Card Tier / Level** | Buried in subtitle or missing | Distinctive badge: `PLATINUM`, `SIGNATURE`, `INFINITE`, `WORLD`, `SELECT`, `REGALIA`, `MILLENNIA` |
| **Co-brand Partner** | Ignored or unstyled in product name | Dedicated co-brand badge: `Swiggy`, `Flipkart`, `Tata Neu`, `Amazon Pay`, `Club Vistara` |
| **Card Type** | Plain text label (`Credit` / `Debit`) | Form factor pill: `CREDIT`, `DEBIT`, `PREPAID`, `FOREX` |
| **Hardware Accents** | Rough CSS lines for chip, text `)))` | Scalable vector `EmvChipIcon` and smooth 4-arc `ContactlessWaveIcon` |
| **Network Visibility** | Unicode emojis `🌐 Network` / `👥 Direct` | Clean SVG badge with `Globe` / `Users` icon + tooltip |

---

## 3. Database Schema: Card Color Theming Storage

Each card row in `catalog_cards` captures its physical color styling so that newly added or existing cards render authentically without hardcoding CSS in components:

```sql
-- Migration: Add authentic color theming to catalog_cards
alter table public.catalog_cards
  add column if not exists card_color text not null default '#1E3A8A',
  add column if not exists accent_color text not null default '#38BDF8',
  add column if not exists gradient_theme text not null default 'default';

-- Update view to include color tokens
drop view if exists public.catalog_cards_view;
create view public.catalog_cards_view with (security_invoker = true) as
  select
    ci.id, ci.name as product_name, ci.country, ci.active,
    i.name as issuer, i.slug as issuer_slug,
    cc.card_type, cc.card_category, cc.segment, cc.variant, cc.upi_enabled,
    cc.card_color, cc.accent_color, cc.gradient_theme,
    n.name as network,
    coalesce(
      (select array_agg(uc.slug order by uc.slug)
         from catalog_card_use_cases ccu join use_cases uc on uc.id = ccu.use_case_id
        where ccu.catalog_item_id = ci.id),
      '{}'
    ) as use_cases
  from catalog_items ci
  join catalog_cards cc on cc.catalog_item_id = ci.id
  join issuers i on i.id = ci.issuer_id
  join card_networks n on n.id = cc.network_id
  where ci.item_type = 'card';
```

---

## 4. Visual Layout & Component Anatomy

```
┌─────────────────────────────────────────────────────────────┐
│ [HDFC BANK]                              [CONTACTLESS WAVE] │
│                                                             │
│ [EMV CHIP]                                                  │
│                                                             │
│ [REGALIA GOLD]                                              │
│ [CO-BRAND: TATA NEU INFINITY]                               │
│                                                             │
│ [👥 Direct Friends · Ramesh]      [PLATINUM]   [VISA LOGO]  │
└─────────────────────────────────────────────────────────────┘
```

### 4.1 Card Color Presets Seeded in Database

- **HDFC Millennia:** Background `#1E3A8A`, Accent `#38BDF8` (Gloss Cobalt & Cyan).
- **HDFC Regalia Gold:** Background `#1E293B`, Accent `#D97706` (Matte Slate & Brushed Gold).
- **HDFC Infinia:** Background `#090D16`, Accent `#94A3B8` (Obsidian Black Metal).
- **SBI SimplyCLICK:** Background `#1D4ED8`, Accent `#F97316` (Deep Royal Blue & Orange).
- **ICICI Amazon Pay:** Background `#18181B`, Accent `#F59E0B` (Charcoal Matte & Amazon Gold).
- **Axis Magnus:** Background `#4A044E`, Accent `#F59E0B` (Burgundy Velvet & Gold).
- **Amex Platinum:** Background `#475569`, Accent `#E2E8F0` (Brushed Stainless Steel).
- **Tata Neu Infinity:** Background `#2E1065`, Accent `#EC4899` (Royal Violet & Magenta Glow).

---

## 5. Implementation Steps

1. **Vector Network Assets (`frontend/src/components/icons/network/`):**
   - Create `VisaLogo.tsx`, `MasterCardLogo.tsx`, `AmexLogo.tsx`, `RuPayLogo.tsx`, `DinersClubLogo.tsx`.
   - Create `EmvChipIcon.tsx` and `ContactlessWaveIcon.tsx`.
2. **Unified `VisualCard` Component (`frontend/src/components/VisualCard.tsx`):**
   - Read dynamic `card_color` and `accent_color` directly from card props.
   - Render gradient background dynamically:
     ```tsx
     const cardStyle = {
       background: `linear-gradient(135deg, ${card.card_color || '#1e293b'} 0%, ${darken(card.card_color, 20)} 100%)`,
       boxShadow: `0 8px 24px -4px ${hexToRgba(card.card_color, 0.4)}`,
     };
     ```
   - Render Bank Name (top left), Contactless Wave (top right), EMV Chip, Card Name, Partner Tag, Tier Badge, and Network SVG (bottom right).
3. **Consumers Refactoring:**
   - Update `CardTile.tsx` and `SavedCardItem.tsx` to utilize `VisualCard`.
   - Update `PersonCardsModal.tsx` and `DashboardCardDeck.tsx`.
4. **Testing:**
   - Visual regression test verifying all network logos and dynamic colors render cleanly across screen sizes.

---

## 6. Acceptance Criteria

- [ ] Each card renders its authentic colorway derived from database catalog columns (`card_color`, `accent_color`).
- [ ] Card graphic displays Bank/Issuer, Network vector logo, Tier/Level, Co-brand Partner, and Form Factor.
- [ ] Hardware EMV chip and contactless wave render cleanly as scalable SVGs.
- [ ] Card scales responsively down to 320px mobile viewports without horizontal clipping.
- [ ] Zero unicode emojis used anywhere in the card graphic.
