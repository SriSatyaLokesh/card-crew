# Title: feat(resources): Generic resource sharing policy engine and V1 perk types (Coupons, Vouchers, Lounge Passes)

**Labels**: `backend`, `database`, `frontend`, `architecture`, `p2-medium`  
**Milestone**: Milestone 10 - Resource Policy Engine & Multi-Perk Architecture  

---

## 1. User Story
**As a** Card Crew user who holds unused shopping vouchers, e-commerce discount coupons, or airport lounge access passes,  
**I want** to list these benefits under a generic sharing policy model,  
**So that** my friends can discover and utilize these time-sensitive perks before they expire, without being restricted solely to credit card transactions.

---

## 2. Brutal Audit Reasons & Problem Statement
From the Architecture & Product Roadmap Review:
1. **Hardcoded Card-Only Schema**:
   - The database and frontend are tightly coupled to physical cards (`catalog_cards`, `user_cards`).
   - In reality, fintech benefit sharing revolves heavily around non-card perks: Swiggy/Zomato coupons, Amazon/Flipkart gift vouchers, BookMyShow BOGO passes, and Airport Lounge QR codes.
2. **Missing Granular Sharing Policies**:
   - Current card sharing is all-or-nothing. Users cannot designate a perk as "Single Use Only", "Family Circle Only", or set an automatic expiration timestamp.
3. **No Dynamic Benefit Lifecycle**:
   - Vouchers and coupons expire, yet the system lacks lifecycle states (`active`, `reserved`, `redeemed`, `expired`).

---

## 3. Technical Specifications

### 3.1 Generic Resource Schema Migration (`supabase/migrations/20261003000008_generic_resource_engine.sql`)
```sql
-- Migration: Generic shared resources architecture
CREATE TYPE public.resource_type_enum AS ENUM (
  'credit_card',
  'debit_card',
  'coupon',
  'voucher',
  'lounge_pass',
  'reward_points'
);

CREATE TYPE public.resource_sharing_scope AS ENUM (
  'friends_only',
  'specific_friends',
  'public_crew',
  'family_circle'
);

CREATE TYPE public.resource_status_enum AS ENUM (
  'active',
  'reserved',
  'redeemed',
  'expired'
);

CREATE TABLE IF NOT EXISTS public.shared_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  resource_type public.resource_type_enum NOT NULL,
  title TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  description TEXT,
  sharing_scope public.resource_sharing_scope DEFAULT 'friends_only',
  status public.resource_status_enum DEFAULT 'active',
  code_or_identifier TEXT, -- Encrypted or masked voucher/coupon code
  discount_percentage NUMERIC(5, 2),
  max_discount_amount NUMERIC(10, 2),
  min_transaction_amount NUMERIC(10, 2),
  expiry_date TIMESTAMPTZ,
  usage_limit INT DEFAULT 1,
  current_usage_count INT DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for querying active resources
CREATE INDEX IF NOT EXISTS idx_resources_owner ON public.shared_resources(owner_id);
CREATE INDEX IF NOT EXISTS idx_resources_active ON public.shared_resources(status, expiry_date) WHERE status = 'active';

-- RLS Policies
ALTER TABLE public.shared_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their resources"
ON public.shared_resources FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Friends can view shared resources"
ON public.shared_resources FOR SELECT
TO authenticated
USING (
  status = 'active' AND (
    sharing_scope = 'public_crew' OR
    (sharing_scope = 'friends_only' AND EXISTS (
      SELECT 1 FROM public.friend_edges fe 
      WHERE (fe.user_a = auth.uid() AND fe.user_b = shared_resources.owner_id)
         OR (fe.user_b = auth.uid() AND fe.user_a = shared_resources.owner_id)
    ))
  )
);
```

### 3.2 TypeScript Resource Interfaces (`frontend/src/types/resources.ts`)
```typescript
export type ResourceType = 'credit_card' | 'debit_card' | 'coupon' | 'voucher' | 'lounge_pass' | 'reward_points';
export type SharingScope = 'friends_only' | 'specific_friends' | 'public_crew' | 'family_circle';
export type ResourceStatus = 'active' | 'reserved' | 'redeemed' | 'expired';

export interface SharedResource {
  id: string;
  owner_id: string;
  resource_type: ResourceType;
  title: string;
  brand_name: string;
  description?: string;
  sharing_scope: SharingScope;
  status: ResourceStatus;
  code_or_identifier?: string;
  discount_percentage?: number;
  max_discount_amount?: number;
  min_transaction_amount?: number;
  expiry_date?: string;
  usage_limit: number;
  current_usage_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
}
```

---

## 4. Step-by-Step Implementation Guide
1. **Deploy Database Migration**:
   - Apply `supabase/migrations/20261003000008_generic_resource_engine.sql`.
2. **Implement Resource Listing Components**:
   - Create `frontend/src/components/resources/ResourceCard.tsx` with distinct visual styling for coupons, vouchers, and lounge passes.
   - Use dedicated Lucide SVG icons (`<Tag />` for coupons, `<Ticket />` for vouchers, `<Plane />` for lounge access).
3. **Build "Share Perk" Modal**:
   - Create `frontend/src/components/resources/AddResourceModal.tsx` supporting date pickers for expiry and scope selectors.
4. **Auto-Expiration Background Cleanup / Check**:
   - Add a SQL view or cron check to transition expired resources (`expiry_date < now()`) to status `'expired'`.

---

## 5. Security, Privacy & Integrity Boundaries
- **Code Masking**: Secret coupon/voucher codes are masked in public list views (`••••ABCD`) and only revealed when a request is approved by the owner.
- **Strict RLS Scope**: Strangers cannot read resources scoped to `friends_only`.

---

## 6. Acceptance Criteria Checklist
- [ ] Database supports multiple perk types (`coupon`, `voucher`, `lounge_pass`).
- [ ] Friends can browse active perks shared within their network.
- [ ] Single-use vouchers automatically transition to `redeemed` upon usage confirmation.
- [ ] Expired perks are automatically excluded from active search results.
- [ ] RLS policies strictly safeguard friend-only resources from non-friends.

---

## 7. Verification & Test Plan
1. **RLS Authorization Test**:
   - Insert a `friends_only` voucher under User A.
   - Query as non-friend User C; confirm 0 rows returned.
   - Query as friend User B; confirm voucher row returned.
2. **Lifecycle State Transition**:
   - Mark a voucher as `redeemed`; verify it disappears from active feed.
