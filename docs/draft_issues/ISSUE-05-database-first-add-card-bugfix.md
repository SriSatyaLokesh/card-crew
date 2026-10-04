# Title: fix(cards): Eliminate random card assignment fallback bug and implement database-first Add Card flow

**Labels**: `bug`, `frontend`, `backend`, `data-integrity`, `p0-critical`  
**Milestone**: Milestone 3 - Database-First Add Card Architecture  

---

## 1. User Story
**As a** Card Crew user adding one of my credit or debit cards to my portfolio,  
**I want** to search from an authoritative, database-backed catalog of cards, and if my specific card is not listed, be prompted to define a custom card with exact details,  
**So that** my profile never gets silently populated with incorrect or random financial cards that I do not own, ensuring 100% data integrity across the platform.

---

## 2. Brutal Audit Reasons & Problem Statement
From the quantitative UI/UX Brutal Audit & Codebase Security Inspection:
1. **Critical Data Integrity Fallback Bug**:
   - In `frontend/src/lib/apiClient.ts` lines 181–190:
     ```typescript
     // DANGEROUS SILENT FALLBACK IN CURRENT CODE:
     if (catalogCards.length === 0) {
       // Silently grabs ANY existing card from the database and assigns it!
       const { data: randomFallback } = await supabase.from('catalog_cards').select('id').limit(1).single();
       cardId = randomFallback.id;
     }
     ```
   - If a user enters "Tata Neu Infinity" and it is not yet in `catalog_cards`, the application silently links their portfolio to an arbitrary card (e.g., an HDFC Regalia or SBI SimplyCLICK) without warning the user!
   - This corrupts friendship searches, benefits matching, and trust graph calculations.
2. **Missing Custom Card Creation Path**:
   - Users who hold niche, corporate, co-branded, or international cards are completely unable to register their cards properly without triggering the silent fallback bug.
3. **Poor Search Ergonomics**:
   - The current card search lacks client-side debouncing, keyboard navigation, and clear "No results found — Create custom card" affordances.

---

## 3. Technical Specifications

### 3.1 Database Migration for Custom Card Submissions (`supabase/migrations/20261003000002_custom_catalog_cards.sql`)
```sql
-- Migration: Add custom card creation support with user attribution
ALTER TABLE public.catalog_cards
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_catalog_cards_name_trgm 
ON public.catalog_cards USING gin (card_name gin_trgm_ops);

-- Secure RPC function to safely register custom cards
CREATE OR REPLACE FUNCTION public.create_custom_card_and_add_to_wallet(
  p_card_name TEXT,
  p_bank_name TEXT,
  p_card_network TEXT,
  p_card_type TEXT,
  p_card_level TEXT,
  p_last_four TEXT,
  p_nickname TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_catalog_id UUID;
  v_user_card_id UUID;
  v_card_color TEXT := '#1E293B';
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validation
  IF LENGTH(p_card_name) < 2 OR LENGTH(p_bank_name) < 2 THEN
    RAISE EXCEPTION 'Card and bank names must be at least 2 characters';
  END IF;

  IF p_last_four !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'Last four digits must be exactly 4 numeric digits';
  END IF;

  -- Check if identical card exists in catalog
  SELECT id INTO v_catalog_id
  FROM public.catalog_cards
  WHERE LOWER(card_name) = LOWER(p_card_name)
    AND LOWER(bank_name) = LOWER(p_bank_name)
  LIMIT 1;

  -- If not found, create new catalog card (marked as unverified)
  IF v_catalog_id IS NULL THEN
    INSERT INTO public.catalog_cards (
      card_name,
      bank_name,
      card_network,
      card_type,
      card_level,
      card_color,
      is_verified,
      created_by_user_id
    ) VALUES (
      TRIM(p_card_name),
      TRIM(p_bank_name),
      p_card_network,
      p_card_type,
      p_card_level,
      v_card_color,
      FALSE,
      v_user_id
    )
    RETURNING id INTO v_catalog_id;
  END IF;

  -- Add to user's wallet
  INSERT INTO public.user_cards (
    user_id,
    card_id,
    last_four_digits,
    card_nickname,
    is_active
  ) VALUES (
    v_user_id,
    v_catalog_id,
    p_last_four,
    p_nickname,
    TRUE
  )
  RETURNING id INTO v_user_card_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_card_id', v_user_card_id,
    'catalog_card_id', v_catalog_id
  );
END;
$$;
```

### 3.2 Add Card UI Flow & State Machine
1. **Search Phase**:
   - User types in `CardSearchInput.tsx` (debounced by 300ms).
   - If matches exist in `catalog_cards`, display them in a rich dropdown showing bank insignia, card level, and network.
2. **Missing Card State**:
   - If search returns 0 matches, display `<EmptyCardCatalogState />`:
     > "Don't see your card? Add '{query}' to Card Crew catalog."
   - Clicking opens the `AddCustomCardModal.tsx`.
3. **Custom Card Form (`AddCustomCardModal.tsx`)**:
   - Input: Bank Name (autocomplete or free text).
   - Input: Card Name (prefilled from search query).
   - Select: Payment Network (Visa, Mastercard, RuPay, Amex, Diners).
   - Select: Card Level (Platinum, Signature, Metal, etc.).
   - Input: Last 4 digits (masked input `\d{4}`).
   - Optional: Nickname (e.g., "Personal Daily Driver").
4. **Submit & Instant Optimistic Update**:
   - Calls `create_custom_card_and_add_to_wallet` RPC.
   - Refreshes local portfolio cache without page reload.

---

## 4. Step-by-Step Implementation Guide
1. **Purge the Bug in `apiClient.ts`**:
   - Open `frontend/src/lib/apiClient.ts`.
   - Remove lines 181–190 that assign random fallback cards.
   - Throw a descriptive error `CARD_NOT_FOUND` if a non-existent card ID is requested.
2. **Deploy Database Migration**:
   - Apply `supabase/migrations/20261003000002_custom_catalog_cards.sql`.
3. **Build `AddCustomCardModal.tsx`**:
   - Create responsive modal in `frontend/src/components/cards/AddCustomCardModal.tsx`.
   - Include real-time preview of the card as the user enters bank and card details using `<VisualCard />`.
4. **Refactor `MyCardsPage.tsx` Add Flow**:
   - Integrate debounced catalog search.
   - Render "Add Custom Card" CTA when query is unmatched.
   - Handle form validation (exact 4 numeric digits for last 4, non-empty names).

---

## 5. Security, Privacy & Integrity Boundaries
- **No Full PAN Stored**: Strictly enforce regex validation `^[0-9]{4}$`. Never capture or transmit 16-digit card numbers.
- **Attribution & Anti-Abuse**: Custom catalog cards are marked `is_verified = FALSE` and tagged with `created_by_user_id` to allow automated or admin curation and prevent catalog spam.

---

## 6. Acceptance Criteria Checklist
- [ ] Code in `apiClient.ts` that assigns random fallback cards is completely excised.
- [ ] Searching for an uncataloged card displays a clear "Card not found. Add custom card" prompt.
- [ ] `create_custom_card_and_add_to_wallet` RPC creates catalog entry and wallet entry atomically.
- [ ] Submitting custom cards preserves bank name, card network, tier, and last 4 digits accurately.
- [ ] Newly added cards immediately appear in the user's wallet with accurate visual preview.
- [ ] No regression when adding pre-existing verified catalog cards.

---

## 7. Verification & Test Plan
1. **Integration Test**:
   - Attempt to add an uncataloged card name "SuperTestBank Black Metal".
   - Verify that the card is created with `is_verified: false` and linked to the user's wallet.
   - Confirm that no random unrelated card is assigned.
2. **Validation Negative Test**:
   - Submit card with last four digits as "12a4" or "123".
   - Confirm backend rejects the request with HTTP/PostgREST error 400.
