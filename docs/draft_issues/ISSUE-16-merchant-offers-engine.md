# Title: feat(offers): Merchant offers engine with Offer -> Card -> Friend network matcher

**Labels**: `frontend`, `backend`, `database`, `offers`, `p2-medium`  
**Milestone**: Milestone 11 - Merchant Offers Engine & Perk Discovery  

---

## 1. User Story
**As a** Card Crew user planning an upcoming purchase on an e-commerce platform (e.g., Apple, Amazon, MakeMyTrip, Swiggy),  
**I want** to browse curated merchant offers and immediately see which card in my own wallet or my friends' wallets unlocks that offer,  
**So that** I never miss out on instant bank discounts, cashback promotions, or seasonal sales.

---

## 2. Brutal Audit Reasons & Problem Statement
From the quantitative UI/UX Brutal Audit & Feature Discovery Review:
1. **Disconnected Value Proposition**:
   - The primary financial benefit of credit card sharing is capturing high-value merchant discounts (e.g. 10% instant discount on ICICI cards during Amazon Great Indian Festival).
   - Currently, users must already know which card qualifies, manually message friends, and guess who has what.
2. **Missing Centralized Offer Catalog**:
   - There is no curated or database-backed offers repository in the system. The `OffersPage.tsx` is either an unstyled placeholder or non-existent.
3. **No 1-Click Handshake from Offer to Request**:
   - Even if an offer is known, there is no direct link between discovering an offer and initiating a card usage request to the specific friend who owns the required card.

---

## 3. Technical Specifications

### 3.1 Merchant Offers Database Schema (`supabase/migrations/20261003000009_merchant_offers_schema.sql`)
```sql
-- Migration: Merchant offers and card eligibility linking
CREATE TABLE IF NOT EXISTS public.merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL, -- 'Shopping', 'Travel', 'Food & Dining', 'Electronics', 'Entertainment'
  logo_url TEXT,
  website_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.merchant_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  discount_summary TEXT NOT NULL, -- e.g. "10% Instant Discount up to ₹1,500"
  min_spend NUMERIC(10, 2) DEFAULT 0,
  max_discount NUMERIC(10, 2),
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_thru TIMESTAMPTZ NOT NULL,
  coupon_code TEXT,
  terms_conditions TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Many-to-many relationship linking offers to qualifying catalog cards
CREATE TABLE IF NOT EXISTS public.offer_eligible_cards (
  offer_id UUID NOT NULL REFERENCES public.merchant_offers(id) ON DELETE CASCADE,
  catalog_card_id UUID NOT NULL REFERENCES public.catalog_cards(id) ON DELETE CASCADE,
  PRIMARY KEY (offer_id, catalog_card_id)
);

-- Index for searching active offers
CREATE INDEX IF NOT EXISTS idx_offers_validity ON public.merchant_offers(valid_thru) WHERE valid_thru > now();

-- RPC: Match active offers against user and friend wallets
CREATE OR REPLACE FUNCTION public.get_matched_offers_for_user()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_result JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'offer_id', o.id,
      'merchant_name', m.name,
      'category', m.category,
      'title', o.title,
      'discount_summary', o.discount_summary,
      'valid_thru', o.valid_thru,
      'eligible_cards_count', (SELECT COUNT(*) FROM public.offer_eligible_cards WHERE offer_id = o.id),
      -- Does the logged-in user own an eligible card?
      'user_owned_cards', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', uc.id, 'card_name', cc.card_name))
        FROM public.user_cards uc
        JOIN public.catalog_cards cc ON cc.id = uc.card_id
        JOIN public.offer_eligible_cards oec ON oec.catalog_card_id = cc.id
        WHERE uc.user_id = v_user_id AND oec.offer_id = o.id
      ), '[]'::jsonb),
      -- Do friends own an eligible card?
      'friend_owned_cards', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'friend_id', p.id,
          'friend_name', p.full_name,
          'friend_username', p.username,
          'card_name', cc.card_name,
          'user_card_id', uc.id
        ))
        FROM public.friend_edges fe
        JOIN public.user_cards uc ON uc.user_id = CASE WHEN fe.user_a = v_user_id THEN fe.user_b ELSE fe.user_a END
        JOIN public.profiles p ON p.id = uc.user_id
        JOIN public.catalog_cards cc ON cc.id = uc.card_id
        JOIN public.offer_eligible_cards oec ON oec.catalog_card_id = cc.id
        WHERE (fe.user_a = v_user_id OR fe.user_b = v_user_id) AND oec.offer_id = o.id
      ), '[]'::jsonb)
    )
  ) INTO v_result
  FROM public.merchant_offers o
  JOIN public.merchants m ON m.id = o.merchant_id
  WHERE o.valid_thru > now();

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
```

### 3.2 UI Offer Card Component (`frontend/src/components/offers/OfferCard.tsx`)
Render a rich card with 3 state badges:
1. **"In Your Wallet"**: Highlighted in emerald if the user directly owns an eligible card.
2. **"Available via Crew"**: Highlighted in indigo if a connected friend owns an eligible card, with a 1-click `[ Request from @friend ]` CTA that opens the `NewRequestSheetModal`.
3. **"Card Needed"**: Highlighted in amber if no one in the user's crew currently holds an eligible card, with an `[ Invite Friends ]` CTA.

---

## 4. Step-by-Step Implementation Guide
1. **Apply Migration**:
   - Deploy `supabase/migrations/20261003000009_merchant_offers_schema.sql`.
   - Seed sample top merchants (Amazon, Flipkart, Swiggy, Zomato, MakeMyTrip, Apple) and real seasonal bank offers.
2. **Build `OffersPage.tsx`**:
   - Category filter pills: `All`, `Shopping`, `Food & Dining`, `Travel`, `Electronics`.
   - Responsive grid layout (`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`).
3. **Connect 1-Click Request Flow**:
   - Wire `[ Request from @friend ]` button directly to prefill `NewRequestSheetModal` with the friend's user ID and target card ID.

---

## 5. Security, Privacy & Integrity Boundaries
- **Friend Trust Verification**: Only show cards from users with confirmed friendship edges (`friend_edges`).
- **Data Freshness**: Automatically exclude expired offers where `valid_thru < now()`.

---

## 6. Acceptance Criteria Checklist
- [ ] Database stores merchants, offers, and many-to-many card eligibility links.
- [ ] `get_matched_offers_for_user` RPC returns matched user cards and friend cards in one query.
- [ ] UI clearly indicates whether an offer is unlocked by the user, available via a friend, or unavailable.
- [ ] Clicking "Request from @friend" opens the request modal pre-filled with the friend and card details.
- [ ] Category tabs correctly filter offers on the page.

---

## 7. Verification & Test Plan
1. **Matcher RPC Test**:
   - Seed an Amazon offer eligible for "ICICI Amazon Pay".
   - Give Friend B the "ICICI Amazon Pay" card.
   - Run RPC as User A; verify result contains Friend B's name in `friend_owned_cards`.
2. **End-to-End Navigation Test**:
   - Navigate to `/offers`, click "Request from @friend", confirm request modal opens with correct details.
