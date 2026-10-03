# Title: feat(auth): Redesign authentication flow with multi-identifier support (Email, Phone, Username)

**Labels**: `frontend`, `backend`, `auth`, `supabase`, `p1-high`  
**Milestone**: Milestone 4 - Authentication Redesign & Multi-Identifier Network  

---

## 1. User Story
**As a** new or returning Card Crew user,  
**I want** to sign up or log in using my preferred identifier (Email, Indian Phone Number (+91), or unique Username handle),  
**So that** onboarding is fast, frictionless, mobile-friendly, and integrates naturally with my social and phone contact networks.

---

## 2. Brutal Audit Reasons & Problem Statement
From the quantitative UI/UX Brutal Audit (Score: 36/100, Heuristic 5: Error Prevention, Heuristic 7: Flexibility and Efficiency of Use):
1. **Rigid Email-Only Sign-In**:
   - The current authentication screen only supports standard email/password.
   - For an Indian fintech / card sharing community, peer-to-peer relationships are anchored around mobile phone numbers and social handles, not formal email addresses.
2. **Missing Username & Phone Registration**:
   - Users cannot claim an `@username` during registration, forcing the app to generate arbitrary fallback labels or expose raw UUIDs/emails across the UI.
3. **Form Usability Failures**:
   - The auth screen has poor password visibility toggling, no inline validation for common password errors, and no autofocus ergonomics on mobile keyboards (missing `autocomplete="username"`, `type="tel"`, `inputmode="numeric"`).
4. **Disorienting Error Banners**:
   - Authentication errors appear in abrupt red floating boxes that do not pinpoint which field failed validation.

---

## 3. Technical Specifications

### 3.1 Database Migration for Multi-Identifier Profiles (`supabase/migrations/20261003000003_multi_identifier_auth.sql`)
```sql
-- Migration: Add phone_number and username constraints to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone_number TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- Username format check: 3 to 24 chars, alphanumeric + underscores/dots, lowercase
ALTER TABLE public.profiles 
ADD CONSTRAINT check_username_format 
CHECK (username ~* '^[a-z0-9_.]{3,24}$');

-- Phone number E.164 standard check (+ followed by 10-15 digits)
ALTER TABLE public.profiles 
ADD CONSTRAINT check_phone_format 
CHECK (phone_number IS NULL OR phone_number ~* '^\+[1-9]\d{9,14}$');

-- Indexes for lightning-fast lookup
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles (phone_number);

-- RPC: Check identifier availability without exposing profile PII
CREATE OR REPLACE FUNCTION public.check_identifier_available(
  p_identifier_type TEXT,
  p_value TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_identifier_type = 'username' THEN
    RETURN NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE LOWER(username) = LOWER(TRIM(p_value))
    );
  ELSIF p_identifier_type = 'email' THEN
    RETURN NOT EXISTS (
      SELECT 1 FROM auth.users WHERE LOWER(email) = LOWER(TRIM(p_value))
    );
  ELSIF p_identifier_type = 'phone' THEN
    RETURN NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE phone_number = TRIM(p_value)
    );
  ELSE
    RAISE EXCEPTION 'Invalid identifier type';
  END IF;
END;
$$;
```

### 3.2 Authentication UI Component Architecture (`frontend/src/pages/AuthPage.tsx`)
1. **Tabs & Mode Toggle**:
   - `[ Email & Password ]` | `[ Phone & OTP ]`
   - Quick OAuth: `[ Continue with Google ]`
2. **Sign-Up Enhanced Step Form**:
   - **Step 1: Credentials**:
     - Full Name (`input autocomplete="name"`)
     - Unique Username (`input placeholder="e.g. satya_k"` with live availability checkmark)
     - Email or Phone Number with country code selector (default `+91` India)
     - Password with strength meter and show/hide eye toggle
   - **Step 2: Profile Persona**:
     - Choose seed avatar style (Micah / Bottts / Fun-Emoji)
3. **Smart Identifier Login**:
   - Single input field allowing user to type either `satya@example.com`, `+919876543210`, or `satya_k`.
   - Backend resolver identifies input format and authenticates accordingly.

---

## 4. Step-by-Step Implementation Guide
1. **Run Database Migration**:
   - Apply `supabase/migrations/20261003000003_multi_identifier_auth.sql`.
2. **Build Identifier Validation Helpers**:
   - Create `frontend/src/utils/validation.ts`:
     - `isValidUsername(handle: string): boolean`
     - `normalizePhoneNumber(raw: string, countryCode = '+91'): string`
     - `isValidEmail(email: string): boolean`
3. **Refactor Auth Page**:
   - Redesign `frontend/src/pages/AuthPage.tsx` using the Modern Trust design system.
   - Embed `<Logo variant="full" size="xl" />` at the top.
   - Implement real-time debounced check via `check_identifier_available` RPC as user types their desired username.
4. **Supabase Auth Hook / Trigger Integration**:
   - Update `handle_new_user` Supabase trigger function in migrations to populate `username`, `phone_number`, and `full_name` into `public.profiles` from `auth.users.raw_user_meta_data`.

---

## 5. Security, Privacy & Integrity Boundaries
- **Anti-Enumeration Protections**:
  - `check_identifier_available` must be rate-limited (max 30 requests/minute per IP) to prevent malicious actors from harvesting registered usernames or phone numbers.
- **E.164 Phone Formatting**: Always format phone numbers to standard E.164 (`+919876543210`) before database storage to eliminate duplicate accounts caused by variations in spaces, dashes, or leading zeros.

---

## 6. Acceptance Criteria Checklist
- [ ] Users can sign up providing Full Name, unique @handle, Email, and Phone Number.
- [ ] Unique username constraint prevents duplicate handles case-insensitively (`Satya` vs `satya`).
- [ ] Live availability feedback indicates whether a username is free or already taken.
- [ ] Phone numbers are formatted with country code (defaulting to +91).
- [ ] Password visibility toggle works smoothly with accessible SVG icons (`Eye` / `EyeOff`).
- [ ] Clean mobile responsiveness with native keyboard attribute hints (`inputmode`, `autocomplete`).

---

## 7. Verification & Test Plan
1. **Form Validation Unit Tests**:
   - Test `isValidUsername` with valid (`satya_01`, `john.doe`) and invalid (`ab`, `user@name`, `very_long_username_exceeding_twenty_four_chars`).
2. **Sign-Up Flow Integration**:
   - Complete registration with a new test account.
   - Inspect `public.profiles` table to confirm `username`, `full_name`, and `phone_number` are correctly saved.
