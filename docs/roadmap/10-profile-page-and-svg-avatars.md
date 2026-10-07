# Milestone 10: Expanded Profile Page & Customizable SVG Avatars

**Tracked Issue:** [#37](https://github.com/SriSatyaLokesh/card-crew/issues/37)  
**Priority:** Medium / High (Privacy & Profile Management)  
**Status:** Ready for Implementation  
**Estimated Complexity:** Medium  

---

## 1. Executive Summary & User Story

> **As a privacy-focused user**, I want a comprehensive Profile page displaying my identity, network statistics, and security settings, and I want customizable, lightweight SVG-generated avatars instead of uploading personal photos, so that my profile stays personal and expressive without exposing private image files to cloud storage buckets.

PR #33 introduced binary photo uploads to a Supabase Storage bucket (`avatars`). This created storage bandwidth overhead, image downscaling complexity in the browser, and an RLS authorization vulnerability (an authenticated user could overwrite files in the bucket). This milestone replaces binary uploads with **deterministic, lightweight, customizable SVG-generated avatars** (Boring-Avatars / DiceBear style) and significantly enriches the information displayed on the Profile page.

---

## 2. Codebase Audit: Current State vs Target Specifications

| Feature | Current State (`ProfilePage.tsx`) | Target Architecture |
|---|---|---|
| **Avatar Format** | Binary image file uploaded to Supabase Storage | **Client-generated SVG vector avatar** (0 storage cost, 0 network latency, 0 RLS exposure) |
| **Avatar Customization** | File picker (PNG/JPEG) with canvas compression | Seed-based SVG generator with **"Regenerate"** button and color palette selector |
| **Identity Information** | Display name & username only | Display Name, Username (`@handle`), Phone (`+91`), Email Address |
| **Network & Trust Summary** | None on Profile page | At-a-glance summary: Trusted Friends Count, Extended Reach, Active Cards Shared |
| **Security Controls** | Basic password update form | Password change with strength meter, Active Session timestamp, Privacy toggle |

---

## 3. Customizable SVG Avatar Architecture

### 3.1 Deterministic SVG Generation

Instead of storing images, `profiles` stores an `avatar_seed text` (e.g. `user_c89f2a`) and `avatar_style text` (e.g. `beam`, `geometric`, `pixel`).
- Defaults to `profile.id` if no custom seed is chosen.
- A pure client-side mathematical function computes:
  - Background color from a curated palette of accessible colors.
  - Geometric shapes, smiling expressions, or modern abstract art.
  - Returns a pure `<svg>` element with zero external network requests.

### 3.2 Schema Enhancements (`supabase/migrations/`)

```sql
alter table public.profiles
  add column if not exists avatar_seed text default null,
  add column if not exists avatar_style text default 'beam';

-- Update sync_profile to handle avatar_seed and avatar_style
create or replace function public.sync_profile(
  p_display_name text default null,
  p_phone text default null,
  p_avatar_url text default null,
  p_username text default null,
  p_avatar_seed text default null,
  p_avatar_style text default null
)
returns public.profiles
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_existing public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception using errcode = 'PT401', message = 'not_authenticated';
  end if;

  select * into v_existing from public.profiles where id = v_uid;

  update public.profiles
     set display_name = coalesce(nullif(trim(p_display_name), ''), v_existing.display_name),
         phone        = coalesce(nullif(trim(p_phone), ''), v_existing.phone),
         username     = coalesce(nullif(trim(p_username), ''), v_existing.username),
         avatar_seed  = coalesce(nullif(trim(p_avatar_seed), ''), v_existing.avatar_seed),
         avatar_style = coalesce(nullif(trim(p_avatar_style), ''), v_existing.avatar_style),
         updated_at   = now()
   where id = v_uid
   returning * into v_existing;

  return v_existing;
end;
$$;
```

---

## 4. Expanded Profile Page UI Sections

```
┌─────────────────────────────────────────────────────────────┐
│ Profile & Account Management                                │
├─────────────────────────────────────────────────────────────┤
│ [Generated SVG Avatar]                                      │
│ [ 🎲 Regenerate Avatar ]   [ 🎨 Change Color Palette ]       │
├─────────────────────────────────────────────────────────────┤
│ 1. Personal Identity                                        │
│ Display Name: [ Ramesh Kumar             ]                  │
│ Username:     [ @ramesh_k                ] (Verified)       │
│ Phone Number: [ +91 98765 43210          ]                  │
│ Email:        [ ramesh@example.com       ] (Read-only)      │
├─────────────────────────────────────────────────────────────┤
│ 2. Trusted Crew Summary                                     │
│ 👥 Direct Friends: 14     🌐 2-Hop Network: 86               │
│ 💳 Active Cards Shared: 4 (3 Direct Only, 1 Total Network)   │
├─────────────────────────────────────────────────────────────┤
│ 3. Security & Credentials                                   │
│ [Change Password Form with SVG visibility toggles]          │
│ [ Sign Out Button ]                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Acceptance Criteria

- [ ] Users can customize their avatar using deterministic SVG generation (zero binary file uploads).
- [ ] Avatar seed and style save cleanly to `profiles.avatar_seed` and `profiles.avatar_style`.
- [ ] Everywhere an avatar appears (`NavBar`, `NetworkGraph`, `UserListItem`, `RequestCard`), it renders the generated SVG vector.
- [ ] Profile page displays Display Name, Username, Phone, Email, and Network Statistics.
- [ ] Eliminates reliance on the `avatars` storage bucket, neutralizing storage RLS concerns.
