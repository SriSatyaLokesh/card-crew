# Milestone 3: Database-Catalog-First "Add Card" Flow & Custom Card Fallback

**Tracked Issue:** [#43](https://github.com/SriSatyaLokesh/card-crew/issues/43)  
**Priority:** High (Data Integrity & Core User Action)  
**Status:** Ready for Implementation  
**Estimated Complexity:** High  

---

## 1. Executive Summary & User Story

> **As a user adding a card to my wallet/crew**, I want the app to first search and match cards present in our verified database catalog, and if my card is not found, allow me to look for or add a custom card with its full details (Bank Name, Card Name, Network, Tier, Partner, and Card Type), so that my saved cards accurately represent what I own without arbitrary fallback cards being assigned to me.

Card Crew's card addition flow must prioritize catalog accuracy while gracefully handling edge cases where a niche, newly released, or corporate card is missing from the database.

---

## 2. Root Cause Analysis: The Silent Random Card Fallback Bug

An audit of `frontend/src/lib/apiClient.ts` (`createCard`) exposed a severe data integrity flaw (lines 181–190):

```typescript
// 4. Fallback: find any catalog card the user does NOT already have
if (!catalogItemId) {
  const existingOwned = await supabase
    .from("resources")
    .select("catalog_item_id")
    .eq("owner_id", ownerId);
  const ownedSet = new Set((existingOwned.data || []).map((r: any) => r.catalog_item_id));
  const unowned = allCatalog.find((c) => !ownedSet.has(c.id));
  catalogItemId = unowned?.id || allCatalog[0]?.id;
}
```

**The Bug:** If a user types a card name not found in the seeded catalog (e.g. *"Federal Bank Scapia"* or *"HDFC Tata Neu Infinity"* before it was seeded), the code does **not** inform the user or create a custom card. Instead, it arbitrarily selects **any unowned card** from the catalog (such as "SBI SimplySAVE") and links the user's resource to it! This violates basic data integrity and causes extreme user confusion.

---

## 3. Two-Tier "Add Card" Solution

### 3.1 Tier 1: Database Catalog Search First (Primary Path)

1. The user opens the Add Card modal or page.
2. A high-speed typeahead search queries `catalog_cards_view` (backed by PostgreSQL Trigram GIN index `catalog_items_search`).
3. Results display rich metadata: Bank Name, Product Name, Network, Tier/Variant, and Segment.
4. When the user selects a verified catalog card:
   - Sets visibility scope: `DIRECT_FRIENDS` (depth 1) or `TOTAL_NETWORK` (depth 2).
   - Inserts directly into `resources (owner_id, catalog_item_id, visibility_depth, request_enabled)`.
   - Guaranteed authentic metadata; zero ambiguity.

### 3.2 Tier 2: Missing Card Search & Custom Card Fallback (Secondary Path)

1. If the query yields no catalog match (or the user clicks *"Don't see your card? Add custom card"*):
2. The user is presented with a structured custom card creation form:
   - **Bank / Issuing Institution**: Autocomplete list of existing issuers (`HDFC Bank`, `SBI Card`, `ICICI Bank`, etc.) with free-text option.
   - **Card / Product Name**: Free-text product title (e.g., "Scapia Federal", "Amazon ICICI").
   - **Payment Network**: Radio or select: `Visa`, `MasterCard`, `RuPay`, `American Express`, `Diners Club`.
   - **Card Level / Tier**: `Platinum`, `Signature`, `Infinite`, `World`, `Gold`, `Select`, `Classic`, `Corporate`.
   - **Co-brand Partner (Optional)**: E.g., `Swiggy`, `Flipkart`, `Tata Neu`, `Amazon Pay`, `Zomato`.
   - **Card Type**: `Credit`, `Debit`, `Prepaid`, `Forex`.
3. Backend handling:
   - Stored cleanly via a dedicated RPC (`submit_custom_card` or `submit_catalog_card_variant` with `source = 'user_submitted'`, `verified = false`).
   - Attached immediately to the submitting user's `resources` list.
   - Hidden from public catalog search until administrative or community verification.

---

## 4. Technical Architecture & Database Design

### 4.1 Schema Migration (`supabase/migrations/`)

```sql
-- Support custom / user-submitted cards in catalog_items
alter table public.catalog_items
  add column if not exists source text not null default 'seed' check (source in ('seed', 'user_submitted')),
  add column if not exists verified boolean not null default true,
  add column if not exists submitted_by uuid references public.profiles(id) on delete set null;

-- RPC for secure custom card creation
create or replace function public.submit_custom_card(
  p_issuer_name text,
  p_product_name text,
  p_network text,
  p_card_type text,
  p_variant text default null,
  p_visibility_depth smallint default 1
)
returns public.resources
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_issuer_id smallint;
  v_network_id smallint;
  v_item_id uuid;
  v_res public.resources;
begin
  if v_uid is null then
    raise exception using errcode = 'PT401', message = 'not_authenticated';
  end if;

  -- 1. Resolve or create issuer
  select id into v_issuer_id from public.issuers where lower(name) = lower(trim(p_issuer_name));
  if v_issuer_id is null then
    insert into public.issuers (name, slug, country)
    values (trim(p_issuer_name), lower(regexp_replace(trim(p_issuer_name), '[^a-zA-Z0-9]+', '-', 'g')), 'IN')
    returning id into v_issuer_id;
  end if;

  -- 2. Resolve network
  select id into v_network_id from public.card_networks where lower(name) = lower(trim(p_network));
  if v_network_id is null then
    select id into v_network_id from public.card_networks where slug = 'visa';
  end if;

  -- 3. Insert catalog item tagged as user_submitted
  insert into public.catalog_items (item_type, issuer_id, name, country, active, source, verified, submitted_by)
  values ('card', v_issuer_id, trim(p_product_name), 'IN', true, 'user_submitted', false, v_uid)
  returning id into v_item_id;

  -- 4. Insert catalog card details
  insert into public.catalog_cards (catalog_item_id, card_type, card_category, network_id, variant, segment)
  values (v_item_id, lower(p_card_type), lower(p_card_type), v_network_id, p_variant, 'retail');

  -- 5. Attach directly to user's resources
  insert into public.resources (owner_id, catalog_item_id, visibility_depth, request_enabled)
  values (v_uid, v_item_id, p_visibility_depth, true)
  returning * into v_res;

  return v_res;
end;
$$;
```

---

## 5. Implementation Steps

1. **Delete the Random Card Assignment Bug:**
   - Remove lines 181–190 in `frontend/src/lib/apiClient.ts`.
   - Make `createCard` require a valid `catalogItemId` or invoke the new custom card flow.
2. **Database Migration:**
   - Add `source`, `verified`, `submitted_by` columns to `catalog_items`.
   - Add `submit_custom_card` RPC function.
3. **UI Redesign (`CardModal.tsx` / `MyCardsPage.tsx`):**
   - Step 1: Search database catalog with instant results and clear preview.
   - Step 2: "Can't find your card? Add custom card" toggle revealing structured fields (Bank, Product, Network, Tier, Type).
4. **Validation & Security:**
   - Strictly prevent entry of card numbers, CVVs, PINs, or OTPs. Notes field must carry the explicit disclaimer: *"Never share card numbers or CVVs"*.
5. **Testing:**
   - Vitest integration test for `submit_custom_card`.
   - Playwright test for searching catalog vs adding custom card.

---

## 6. Acceptance Criteria

- [ ] Zero arbitrary/random cards are ever assigned to a user when searching or creating cards.
- [ ] Catalog search returns matching database cards with bank, network, and tier.
- [ ] Custom card fallback allows specifying Bank, Card Name, Network, Tier, Partner, and Card Type.
- [ ] Newly added custom cards appear immediately in user's wallet.
- [ ] All inputs strictly enforce metadata-only (zero card numbers/CVV/PIN).
