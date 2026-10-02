# Milestone 5: Multi-Identifier Friend Network (Phone, Username, Email)

**Tracked Issue:** [#38](https://github.com/SriSatyaLokesh/card-crew/issues/38)  
**Priority:** High (Social Graph & Usability)  
**Status:** Ready for Implementation  
**Estimated Complexity:** Medium  

---

## 1. Executive Summary & User Story

> **As a user wanting to connect with someone I know**, I want to find and invite them by their phone number, username, or email address instead of needing their internal UUID, so that expanding my trusted resource network is simple and natural.

Currently, sending a friend request requires the recipient's internal system UUID (`user_id`). This is a critical friction point identified in PRD §12.4 and `docs/API_CONTRACT.md`. This milestone implements exact-match-only identifier lookup across phone numbers, usernames, and emails, coupled with server-side rate-limiting to prevent directory enumeration.

---

## 2. Privacy & Anti-Harvesting Principles

Per PRD §12.4:
1. **No Address Book Uploads:** Card Crew deliberately avoids requesting or uploading users' complete address books.
2. **Exact-Match-Only Lookup:** The lookup function only succeeds if the caller supplies the exact identifier. It does **not** support fuzzy search, prefix matching, or directory browsing.
3. **Email Concealment:** The recipient's email is never exposed back to the client. The lookup returns only `{ user_id, display_name, avatar_url, username }`.
4. **Anti-Enumeration Throttling:** Strict per-caller rate limiting prevents script-based harvesting of phone numbers or email addresses.

---

## 3. Database Architecture & RPC Specification

### 3.1 Rate-Limiting Table & Exact Match Function (`supabase/migrations/`)

```sql
-- Table to throttle lookup attempts per caller
create table if not exists public.user_lookup_attempts (
  id bigint generated always as identity primary key,
  caller_id uuid not null references public.profiles(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index if not exists lookup_attempts_caller on public.user_lookup_attempts (caller_id, attempted_at desc);

-- Exact-match lookup function
create or replace function public.find_user_by_identifier(p_identifier text)
returns table (
  user_id uuid,
  display_name text,
  username text,
  avatar_url text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_clean text := trim(p_identifier);
  v_recent_attempts int;
  v_match_id uuid;
begin
  if v_caller is null then
    raise exception using errcode = 'PT401', message = 'not_authenticated';
  end if;

  if length(v_clean) < 3 then
    return;
  end if;

  -- 1. Anti-enumeration throttling (max 20 lookups per 15 minutes)
  select count(*) into v_recent_attempts
    from public.user_lookup_attempts
   where caller_id = v_caller
     and attempted_at > now() - interval '15 minutes';

  if v_recent_attempts >= 20 then
    raise exception using errcode = 'PT429', message = 'too_many_lookup_attempts';
  end if;

  insert into public.user_lookup_attempts (caller_id) values (v_caller);

  -- 2. Exact match on username (with or without leading @)
  select p.id into v_match_id
    from public.profiles p
   where lower(p.username) = lower(regexp_replace(v_clean, '^@', ''))
     and p.status = 'active'
     and p.id <> v_caller;

  -- 3. Exact match on phone number
  if v_match_id is null then
    select p.id into v_match_id
      from public.profiles p
     where (p.phone = v_clean or p.phone = ('+91' || regexp_replace(v_clean, '^\+91', '')))
       and p.status = 'active'
       and p.id <> v_caller;
  end if;

  -- 4. Exact match on email (queries auth.users securely)
  if v_match_id is null and v_clean ~* '^.+@.+\..+$' then
    select u.id into v_match_id
      from auth.users u
      join public.profiles p on p.id = u.id
     where lower(u.email) = lower(v_clean)
       and p.status = 'active'
       and u.id <> v_caller;
  end if;

  -- 5. Return profile tuple if matched
  if v_match_id is not null then
    return query
    select p.id as user_id, p.display_name, p.username, p.avatar_url
      from public.profiles p
     where p.id = v_match_id;
  end if;
end;
$$;
```

---

## 4. UI Implementation (`MyNetworkPage.tsx` / `UserSearchInput.tsx`)

1. **Invite Modal / Input Bar:**
   - Input placeholder: *"Enter friend's phone number (+91), @username, or email..."*
   - Immediate feedback showing the matched profile card with avatar and display name before sending the request.
   - Clear "User not found" state if no exact match exists.
2. **One-Click Send Request:**
   - Calls `sendFriendRequest(targetUserId)` once confirmed.
   - Displays confirmation toast with SVG check icon.

---

## 5. Acceptance Criteria

- [ ] Users can locate friends by typing their exact phone number, `@username`, or email.
- [ ] No partial or fuzzy directory results are ever returned.
- [ ] Lookup requests are strictly rate-limited (max 20 per 15 minutes per user).
- [ ] Recipient emails are never disclosed in client responses.
- [ ] Automated integration tests verify positive matches across phone, username, and email, plus 0 results on non-exact inputs.
