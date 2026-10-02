# Milestone 7: Chat Trust Gate Security Fix & Anti-Exfiltration Safety

**Tracked Issue:** [#34](https://github.com/SriSatyaLokesh/card-crew/issues/34) & Private Security Advisory  
**Priority:** Critical (Security & Trust Enforcement)  
**Status:** Ready for Implementation  
**Estimated Complexity:** Medium  

---

## 1. Executive Summary & Problem Statement

> **As a privacy-conscious user**, I want chat communication to be strictly gated behind my established trust network (friends or approved resource requests), and I want active safeguards that prevent anyone from accidentally pasting card numbers, CVVs, or OTPs into chat.

An audit of the recent chat implementation (`supabase/migrations/20261001000001_chat_and_messages.sql`) revealed an authorization bypass: any authenticated user could initiate a chat with any other user merely by knowing their UUID, bypassing the trust graph. Furthermore, to adhere to PRD §13.2/§13.4, chat must enforce strict card-secret detection to preserve Card Crew's core boundary: **we never store or transmit sensitive payment credentials.**

---

## 2. Vulnerability Remediation & Authorization Gate

### 2.1 Enforcing Friendship / Approved Request Gate on Chat Creation

```sql
-- Migration: Gate chat creation on trusted relationships
create or replace function public.get_or_create_direct_chat(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_chat_id uuid;
  v_is_friend boolean;
  v_has_approved_request boolean;
begin
  if v_uid is null then
    raise exception using errcode = 'PT401', message = 'not_authenticated';
  end if;

  if v_uid = p_other_user_id then
    raise exception using errcode = 'PT400', message = 'cannot_chat_with_self';
  end if;

  -- 1. Check if users are blocked
  if exists (
    select 1 from public.user_blocks
     where (blocker_id = v_uid and blocked_id = p_other_user_id)
        or (blocker_id = p_other_user_id and blocked_id = v_uid)
  ) then
    raise exception using errcode = 'PT403', message = 'user_blocked';
  end if;

  -- 2. Trust Graph Gate: must be friends OR have an approved request between them
  select exists (
    select 1 from public.friend_edges
     where user_id = v_uid and friend_id = p_other_user_id
  ) into v_is_friend;

  if not v_is_friend then
    select exists (
      select 1 from public.requests
       where ((requester_id = v_uid and owner_id = p_other_user_id)
           or (requester_id = p_other_user_id and owner_id = v_uid))
         and status = 'approved'
    ) into v_has_approved_request;

    if not v_has_approved_request then
      raise exception using errcode = 'PT403', message = 'trust_relationship_required';
    end if;
  end if;

  -- 3. Return existing chat or create new
  select c.id into v_chat_id
    from public.chats c
    join public.chat_participants cp1 on cp1.chat_id = c.id and cp1.user_id = v_uid
    join public.chat_participants cp2 on cp2.chat_id = c.id and cp2.user_id = p_other_user_id
   where c.is_group = false;

  if v_chat_id is null then
    insert into public.chats (created_by, is_group)
    values (v_uid, false)
    returning id into v_chat_id;

    insert into public.chat_participants (chat_id, user_id)
    values (v_chat_id, v_uid), (v_chat_id, p_other_user_id);
  end if;

  return v_chat_id;
end;
$$;
```

### 2.2 Avatar Storage Path Scoping
Scope the storage RLS policy on the `avatars` bucket so that users can only upload and overwrite files located in `avatars/<auth.uid()>/...`.

---

## 3. Chat Trust & Safety Polish (Issue #34)

### 3.1 Persistent Disclaimer Banner
- Embedded at the top of every active chat view (`ChatPage.tsx`):
  > *"Never share full card numbers, CVVs, PINs, OTPs, or net banking passwords in chat. Card Crew is for coordinating help, not transferring financial credentials."*
- Rendered in a high-visibility amber notice with a `ShieldAlert` SVG icon.

### 3.2 Client & Server Heuristic Content Guard
- Intercepts outbound messages before transmission.
- Patterns checked:
  - 13–19 digit numeric strings that pass the **Luhn Algorithm** (potential credit/debit card numbers).
  - Explicit keyword triggers: *"cvv"*, *"pin"*, *"otp"* followed by 3–6 digits.
- When detected:
  - Client-side: Block submission immediately with modal warning: *"Message blocked: Card Crew protects your privacy by preventing the transmission of payment card numbers and security codes."*
  - Server-side: Trigger or check in `send_message` RPC rejecting the payload.

---

## 4. Acceptance Criteria

- [ ] Non-friends cannot create or message a chat without an approved request.
- [ ] Avatar storage RLS prevents overwriting other users' avatar objects.
- [ ] Persistent safety disclaimer banner displays in all chat rooms.
- [ ] Credit card numbers (Luhn-valid) and CVV/OTP patterns are blocked client-side and server-side.
- [ ] Integration tests verify trust gate enforcement and content guard blocking.
