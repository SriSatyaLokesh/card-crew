# Title: feat(database): Database-backed card branding colors and gradient themes in catalog_cards

**Labels**: `backend`, `database`, `supabase`, `migration`, `p1-high`  
**Milestone**: Milestone 2 - Realistic Card Visual Engine & Database Expansion  

---

## 1. User Story
**As a** Card Crew user viewing my card portfolio or browsing available friend cards,  
**I want** each credit/debit card to render with authentic, bank-accurate color gradients, accent highlights, and contrast-safe text colors fetched directly from the database,  
**So that** I can instantly recognize my HDFC Infinia (metallic deep obsidian), ICICI Sapphiro (cobalt midnight), SBI Cashback (azure electric), or Amex Platinum (frosted silver) at a single glance without relying on generic monochromatic grey rectangles.

---

## 2. Brutal Audit Reasons & Problem Statement
From the quantitative UI/UX Brutal Audit (Score: 36/100, Heuristic 7: Flexibility and Efficiency of Use, Heuristic 8: Aesthetic and Minimalist Design):
1. **Visual Monotony & High Cognitive Recognition Delay**:
   - Currently, cards in `MyCardsPage.tsx` and `DashboardPage.tsx` render with either hardcoded random CSS classes or a static fallback slate gradient.
   - Users cannot visually distinguish between an HDFC Millennia and an HDFC Infinia without reading the small, low-contrast text label. In physical wallets, cards are differentiated by bold color and metallic sheen.
2. **Missing Database Persistence**:
   - The `catalog_cards` table in Supabase does not store any visual metadata (`card_color`, `accent_color`, `gradient_theme`, `text_contrast_mode`).
   - Any visual styling currently implemented on the frontend is hardcoded in fragile `switch (cardName)` client-side statements that fail whenever a new card is added to the database.
3. **Severe Readability / Contrast Flaws**:
   - Some cards with light background colors render with white text, violating WCAG AA compliance and becoming completely unreadable.

---

## 3. Technical Specifications

### 3.1 Database Migration (`supabase/migrations/20261003000001_catalog_card_visual_metadata.sql`)
Add visual columns to `catalog_cards` with validation checks:

```sql
-- Migration: Add card visual metadata to catalog_cards
ALTER TABLE public.catalog_cards
ADD COLUMN IF NOT EXISTS card_color TEXT DEFAULT '#1E293B' CHECK (card_color ~* '^#[0-9A-Fa-f]{6}$'),
ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#FCD34D' CHECK (accent_color ~* '^#[0-9A-Fa-f]{6}$'),
ADD COLUMN IF NOT EXISTS gradient_theme TEXT DEFAULT 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
ADD COLUMN IF NOT EXISTS text_contrast_mode TEXT DEFAULT 'light' CHECK (text_contrast_mode IN ('light', 'dark')),
ADD COLUMN IF NOT EXISTS card_level TEXT DEFAULT 'Classic' CHECK (card_level IN ('Classic', 'Gold', 'Platinum', 'Titanium', 'Signature', 'World', 'Infinite', 'Super-Premium', 'Metal', 'Black'));

COMMENT ON COLUMN public.catalog_cards.card_color IS 'Primary hex brand color of the physical card';
COMMENT ON COLUMN public.catalog_cards.accent_color IS 'Embossed text / chip border / badge accent hex color';
COMMENT ON COLUMN public.catalog_cards.gradient_theme IS 'CSS gradient string used for photorealistic visual card canvas';
COMMENT ON COLUMN public.catalog_cards.text_contrast_mode IS 'Determines whether card text should be pure white (#FFF) or deep graphite (#0F172A)';
```

### 3.2 Seed Data Enrichment for Top Cards
Update existing catalog records with accurate bank gradients:

```sql
-- Seed top Indian credit cards with bank-authentic styling
UPDATE public.catalog_cards SET 
  card_color = '#0F172A', 
  accent_color = '#E2B857', 
  gradient_theme = 'linear-gradient(135deg, #0A0F1D 0%, #1E293B 50%, #0F172A 100%)',
  text_contrast_mode = 'light',
  card_level = 'Metal'
WHERE card_name ILIKE '%Infinia%';

UPDATE public.catalog_cards SET 
  card_color = '#1A365D', 
  accent_color = '#93C5FD', 
  gradient_theme = 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 60%, #172554 100%)',
  text_contrast_mode = 'light',
  card_level = 'Signature'
WHERE card_name ILIKE '%Regalia%';

UPDATE public.catalog_cards SET 
  card_color = '#0284C7', 
  accent_color = '#38BDF8', 
  gradient_theme = 'linear-gradient(135deg, #0369A1 0%, #0284C7 50%, #0C4A6E 100%)',
  text_contrast_mode = 'light',
  card_level = 'Platinum'
WHERE card_name ILIKE '%Millennia%';

UPDATE public.catalog_cards SET 
  card_color = '#002B49', 
  accent_color = '#60A5FA', 
  gradient_theme = 'linear-gradient(135deg, #001E36 0%, #003B64 50%, #001524 100%)',
  text_contrast_mode = 'light',
  card_level = 'World'
WHERE card_name ILIKE '%Sapphiro%';

UPDATE public.catalog_cards SET 
  card_color = '#E11D48', 
  accent_color = '#FDE047', 
  gradient_theme = 'linear-gradient(135deg, #881337 0%, #BE123C 60%, #4C0519 100%)',
  text_contrast_mode = 'light',
  card_level = 'Super-Premium'
WHERE card_name ILIKE '%Magnus%';

UPDATE public.catalog_cards SET 
  card_color = '#B91C1C', 
  accent_color = '#F59E0B', 
  gradient_theme = 'linear-gradient(135deg, #450A0A 0%, #7F1D1D 60%, #991B1B 100%)',
  text_contrast_mode = 'light',
  card_level = 'Signature'
WHERE card_name ILIKE '%Atlas%';

UPDATE public.catalog_cards SET 
  card_color = '#2563EB', 
  accent_color = '#FBBF24', 
  gradient_theme = 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 50%, #1E40AF 100%)',
  text_contrast_mode = 'light',
  card_level = 'Signature'
WHERE card_name ILIKE '%SBI Cashback%' OR card_name ILIKE '%SimplyCLICK%';

UPDATE public.catalog_cards SET 
  card_color = '#334155', 
  accent_color = '#E2E8F0', 
  gradient_theme = 'linear-gradient(135deg, #1E293B 0%, #475569 50%, #0F172A 100%)',
  text_contrast_mode = 'light',
  card_level = 'Metal'
WHERE card_name ILIKE '%OneCard%';

UPDATE public.catalog_cards SET 
  card_color = '#D1D5DB', 
  accent_color = '#1E293B', 
  gradient_theme = 'linear-gradient(135deg, #E5E7EB 0%, #9CA3AF 40%, #E5E7EB 80%, #6B7280 100%)',
  text_contrast_mode = 'dark',
  card_level = 'Metal'
WHERE card_name ILIKE '%Amex Platinum%' OR card_name ILIKE '%Platinum Card%';
```

### 3.3 TypeScript Model Interfaces (`frontend/src/types/cards.ts`)
```typescript
export type CardContrastMode = 'light' | 'dark';

export type CardLevel = 
  | 'Classic' 
  | 'Gold' 
  | 'Platinum' 
  | 'Titanium' 
  | 'Signature' 
  | 'World' 
  | 'Infinite' 
  | 'Super-Premium' 
  | 'Metal' 
  | 'Black';

export interface CatalogCard {
  id: string;
  card_name: string;
  bank_name: string;
  card_network: 'Visa' | 'Mastercard' | 'RuPay' | 'Amex' | 'Diners Club' | 'Other';
  card_type: 'Credit' | 'Debit' | 'Prepaid';
  card_level: CardLevel;
  card_color: string;
  accent_color: string;
  gradient_theme: string;
  text_contrast_mode: CardContrastMode;
  created_at: string;
}

export interface UserCard {
  id: string;
  user_id: string;
  card_id: string;
  last_four_digits: string;
  card_nickname?: string;
  is_active: boolean;
  catalog_card: CatalogCard;
}
```

---

## 4. Step-by-Step Implementation Guide
1. **Create and Apply Migration**:
   - Create migration file `supabase/migrations/20261003000001_catalog_card_visual_metadata.sql`.
   - Execute in Supabase DB via Supabase CLI or management console.
2. **Update Database Types**:
   - Update `frontend/src/types/index.ts` and `frontend/src/types/cards.ts` with visual fields.
3. **Update API Queries**:
   - In `frontend/src/lib/apiClient.ts`: Ensure all `select('*, catalog_cards(*)')` queries retrieve the new `card_color`, `accent_color`, `gradient_theme`, `text_contrast_mode`, and `card_level` columns.
4. **Fallback Gradient Generator Utility**:
   - Create `frontend/src/utils/cardTheme.ts` providing deterministic fallback gradients based on `bank_name` and `card_level` in case third-party/custom cards lack explicit database gradients.

---

## 5. Security, Privacy & Integrity Boundaries
- **Hex Color Regex Validation**: SQL constraints prevent arbitrary string injections into CSS background attributes (`CHECK (card_color ~* '^#[0-9A-Fa-f]{6}$')`).
- **Sanitized CSS Output**: Ensure `gradient_theme` strings only permit safe CSS color functions (`linear-gradient`, `radial-gradient`) to prevent CSS expression injections.

---

## 6. Acceptance Criteria Checklist
- [ ] Supabase schema migration executes without errors and adds columns to `catalog_cards`.
- [ ] At least 15 popular Indian credit cards are seeded with bank-authentic gradients and accent colors.
- [ ] `apiClient.ts` card fetching methods return full visual metadata.
- [ ] `cardTheme.ts` provides safe fallbacks for newly created or custom cards.
- [ ] Card text contrast mode (`light` vs `dark`) guarantees WCAG AA readability for every card.

---

## 7. Verification & Test Plan
1. **Database Schema Verification**:
   - Query `catalog_cards` via SQL:
     ```sql
     SELECT card_name, bank_name, card_color, gradient_theme, card_level FROM catalog_cards LIMIT 10;
     ```
   - Confirm valid hex strings and gradient definitions.
2. **Frontend Type Testing**:
   - Run `npm run type-check` or `npm run build` in `frontend/` to confirm zero TypeScript compilation errors.
