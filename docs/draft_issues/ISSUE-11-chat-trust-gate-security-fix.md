# Title: fix(security): Chat trust-graph authorization gate and storage RLS policy hardening

**Labels**: `security`, `backend`, `database`, `chat`, `p0-critical`  
**Milestone**: Milestone 8 - Chat Trust Security & Storage Policy Hardening  

---

## 1. User Story
**As a** Card Crew user value-conscious of my privacy and financial security,  
**I want** direct chat channels to be strictly restricted to verified friends or active card request partners,  
**So that** unauthenticated strangers, malicious actors, or spam bots cannot initiate direct messaging channels or harvest my contact details by guessing my user UUID.

---

## 2. Brutal Audit Reasons & Problem Statement
From the Security Vulnerability Audit & Architecture Review:
1. **Critical Trust-Gate Bypass in Chat RPC**:
   - In `supabase/migrations/20261001000001_chat_and_messages.sql`:
     ```sql
     -- VULNERABLE FUNCTION:
     CREATE OR REPLACE FUNCTION public.get_or_create_direct_chat(p_other_user_id UUID)
     -- Verifies auth.uid() is not null, but NEVER checks friend_edges or request status!
     ```
   - Any authenticated user can call `supabase.rpc('get_or_create_direct_chat', { p_other_user_id: '<target-uuid>' })` with an arbitrary UUID and establish a private chat room.
   - This completely undermines the "Crew" trust boundary, opening users up to unsolicited harassment, phishing, and scam solicitations.
2. **Missing Chat Participant Authorization in Storage**:
   - Supabase storage bucket policies for chat attachments or avatars lack path-scoped ownership enforcement (`auth.uid() = (storage.foldername(name))[1]`), permitting potential cross-tenant overwrites.

---

## 3. Technical Specifications

### 3.1 Hardened Database Function (`supabase/migrations/20261003000005_chat_trust_gate_security.sql`)
```sql
-- Migration: Hardened chat authorization gate enforcing friendship or active request
CREATE OR REPLACE FUNCTION public.get_or_create_direct_chat(p_other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_chat_id UUID;
  v_is_authorized BOOLEAN := FALSE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_user_id = p_other_user_id THEN
    RAISE EXCEPTION 'Cannot initiate a chat with yourself';
  END IF;

  -- 1. Check if users are connected via friend_edges
  SELECT EXISTS (
    SELECT 1 FROM public.friend_edges 
    WHERE (user_a = v_user_id AND user_b = p_other_user_id)
       OR (user_b = v_user_id AND user_a = p_other_user_id)
  ) INTO v_is_authorized;

  -- 2. If not friends, check if they share an active or pending card request
  IF NOT v_is_authorized THEN
    SELECT EXISTS (
      SELECT 1 FROM public.card_requests 
      WHERE status IN ('pending', 'approved')
        AND ((requester_id = v_user_id AND owner_id = p_other_user_id)
          OR (requester_id = p_other_user_id AND owner_id = v_user_id))
    ) INTO v_is_authorized;
  END IF;

  -- Block unauthorized chat attempts
  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Access Denied: You must be connected as friends or share an active card request to chat';
  END IF;

  -- Check if a direct chat room already exists between these two users
  SELECT c.id INTO v_chat_id
  FROM public.chats c
  JOIN public.chat_members m1 ON m1.chat_id = c.id AND m1.user_id = v_user_id
  JOIN public.chat_members m2 ON m2.chat_id = c.id AND m2.user_id = p_other_user_id
  WHERE c.is_group = FALSE
  LIMIT 1;

  -- If chat doesn't exist, create it atomically
  IF v_chat_id IS NULL THEN
    INSERT INTO public.chats (created_by, is_group)
    VALUES (v_user_id, FALSE)
    RETURNING id INTO v_chat_id;

    INSERT INTO public.chat_members (chat_id, user_id)
    VALUES 
      (v_chat_id, v_user_id),
      (v_chat_id, p_other_user_id);
  END IF;

  RETURN v_chat_id;
END;
$$;
```

### 3.2 Hardened Storage RLS Policy for Attachments
```sql
-- Enforce path-scoped uploads: /<chat_id>/<user_id>/<file>
CREATE POLICY "Enforce chat membership for attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat_attachments' AND
  EXISTS (
    SELECT 1 FROM public.chat_members cm
    WHERE cm.chat_id = (storage.foldername(name))[1]::UUID
      AND cm.user_id = auth.uid()
  )
);
```

---

## 4. Step-by-Step Implementation Guide
1. **Apply SQL Security Migration**:
   - Deploy `supabase/migrations/20261003000005_chat_trust_gate_security.sql`.
2. **Frontend Error Handling in `ChatPage.tsx`**:
   - Catch `Access Denied` exception gracefully when attempting to navigate to `/chat/:partnerId`.
   - Display informative UI error banner:
     > `"You must be connected as friends or have an active card request to message this user. Send a friend request first."`
3. **Verify Chat RLS**:
   - Ensure RLS policies on `messages` table enforce `EXISTS (SELECT 1 FROM chat_members WHERE chat_id = messages.chat_id AND user_id = auth.uid())`.

---

## 5. Security, Privacy & Integrity Boundaries
- **Strict Relationship Validation**: No chat record can be generated in the database without an active social edge (`friend_edges`) or active transaction (`card_requests`).
- **Defensive Anti-Enumeration**: Do not leak user existence if an invalid target UUID is passed.

---

## 6. Acceptance Criteria Checklist
- [ ] Calling `get_or_create_direct_chat` with a stranger's UUID throws an exception.
- [ ] Users connected as friends can successfully open and create chat rooms.
- [ ] Users with active/pending card requests can successfully message each other.
- [ ] Attempting to chat with oneself is rejected.
- [ ] Chat attachments cannot be uploaded to rooms where the user is not a member.
- [ ] Chat UI displays clean user-friendly feedback when a chat attempt is blocked.

---

## 7. Verification & Test Plan
1. **Negative Security Test**:
   - Create two test users (User A and User B) with no friend edge and no card request.
   - User A calls `get_or_create_direct_chat(User B)`.
   - Confirm call fails with PostgreSQL exception `Access Denied`.
2. **Positive Flow Test**:
   - Connect User A and User B via friend request approval.
   - Verify `get_or_create_direct_chat` executes successfully and returns valid `chat_id`.
