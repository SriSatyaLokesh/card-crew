# Milestone 4: Redesigned Sign-in & Sign-up with Multi-Identifier Auth

**Tracked Issue:** [#44](https://github.com/SriSatyaLokesh/card-crew/issues/44)  
**Priority:** High (Identity & User Onboarding)  
**Status:** Ready for Implementation  
**Estimated Complexity:** Medium / High  

---

## 1. Executive Summary & User Story

> **As a new or returning user**, I want a beautifully designed Sign-in and Sign-up experience that allows me to register and authenticate using my Email, Phone Number, or Username, so that I can easily access my Card Crew account and be discoverable by friends through the contact identifier they already know.

The current authentication experience in `LoginPage.tsx` is an MVP email/password form. Users cannot set a phone number or username at sign-up, which directly breaks the social discovery loop (friends cannot look them up by phone or username). This milestone overhauls the authentication pages into a modern, paper-index-styled interface supporting multi-identifier onboarding.

---

## 2. Codebase Audit: Current State vs Target Specifications

| Feature | Current State (`LoginPage.tsx`) | Target Architecture |
|---|---|---|
| **Visual Design** | Minimal unstyled stacked inputs | Warm paper-index aesthetic (`docs/design.md`), cobalt action button, brand typography (`Caveat` + `Quicksand`) |
| **Registration Fields** | Display Name, Email, Password | Display Name, Email, Phone Number (`+91`), Username (`@handle`), Password |
| **Login Identifiers** | Email only | **Multi-identifier input**: Email, Username, or Phone Number |
| **Password Toggle** | Accessible text button, no icon | Accessible SVG toggle (`Eye` / `EyeOff`) with clean `aria-label` |
| **Error / Feedback** | Plain text string with emoji | High-contrast alert banner with `AlertCircle` SVG icon |
| **Session Sync** | Calls `syncProfile(displayName)` | Calls `syncProfile(displayName, phone, username)` |

---

## 3. Architecture & Data Flow

### 3.1 Multi-Identifier Resolution Architecture

Supabase Auth natively supports Email + Password or Phone + OTP. To allow users to log in with a **Username** or **Phone** using password authentication:

```
[User enters "john_doe" or "+919876543210"] + [Password]
                          │
                          ▼
            [resolve_login_identifier RPC]
     (Finds associated email in public.profiles / auth.users)
                          │
                          ▼
           [supabase.auth.signInWithPassword]
                 ({ email, password })
```

### 3.2 Schema Enhancements (`supabase/migrations/`)

```sql
-- Add username column to public.profiles
alter table public.profiles
  add column if not exists username text unique check (username ~* '^[a-zA-Z0-9_]{3,30}$');

create index if not exists profiles_username_idx on public.profiles (lower(username));
create index if not exists profiles_phone_idx on public.profiles (phone);

-- Secure RPC to resolve identifier to email for login
create or replace function public.resolve_login_identifier(p_identifier text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clean text := trim(p_identifier);
  v_user_id uuid;
  v_email text;
begin
  -- 1. If it's already an email format, return as-is
  if v_clean ~* '^.+@.+\..+$' then
    return lower(v_clean);
  end if;

  -- 2. Check if it matches a username in profiles
  select id into v_user_id
    from public.profiles
   where lower(username) = lower(regexp_replace(v_clean, '^@', ''));

  -- 3. Check if it matches a phone in profiles
  if v_user_id is null then
    select id into v_user_id
      from public.profiles
     where phone = v_clean or phone = ('+91' || regexp_replace(v_clean, '^\+91', ''));
  end if;

  -- 4. Lookup email in auth.users
  if v_user_id is not null then
    select email into v_email from auth.users where id = v_user_id;
    return v_email;
  end if;

  return null;
end;
$$;
```

---

## 4. UI / UX Design Specifications

### 4.1 Sign-Up Flow
- **Brand Hero:** Card Crew wordmark in `Caveat` cursive + "Find help from people you trust."
- **Fields:**
  - Display Name (`autoComplete="name"`, e.g. "Ramesh Kumar")
  - Email (`autoComplete="email"`, e.g. "ramesh@example.com")
  - Phone Number with `+91` prefix input (`type="tel"`, `autoComplete="tel"`)
  - Username handle with `@` prefix adornment (`autoComplete="username"`, e.g. "ramesh_k")
  - Password (`minLength={8}`) with strength hint.
- **CTA:** Primary cobalt button: "Create Account".

### 4.2 Sign-In Flow
- **Identifier Input:** Single adaptive field labeled: *"Email, Phone, or Username"*.
- **Password Input:** With accessible show/hide toggle.
- **CTA:** Primary cobalt button: "Sign In".
- **Toggle Mode:** Secondary text button: *"New to Card Crew? Create an account"*.

---

## 5. Implementation Steps

1. **Database Migration:**
   - Add `username` to `profiles` with regex constraint.
   - Deploy `resolve_login_identifier` RPC.
   - Update `sync_profile` to accept `p_username` and `p_phone`.
2. **Auth Context Updates (`AuthProvider.tsx`):**
   - Update `signUp(email, password, displayName, phone, username)`.
   - Update `signIn(identifier, password)`: resolves email via RPC if identifier is not an email, then authenticates.
3. **Component Redesign (`LoginPage.tsx`):**
   - Reconstruct markup using semantic HTML, accessible labels, and SVG iconography.
   - Integrate phone number formatting and username availability validation.
4. **Testing:**
   - Test sign-up with phone + username.
   - Test sign-in via username + password.
   - Test sign-in via phone number + password.
   - Verify zero emojis in auth components.

---

## 6. Acceptance Criteria

- [ ] Users can register with Display Name, Email, Phone Number (+91), Username, and Password.
- [ ] Users can sign in using their Email, Phone Number, or Username handle.
- [ ] Registered usernames and phone numbers are verified unique.
- [ ] Profile table is updated immediately upon registration.
- [ ] Accessible password toggle works seamlessly without DOM nesting errors.
- [ ] Zero unicode emojis used in authentication pages.
