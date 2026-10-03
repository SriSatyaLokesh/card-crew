# Title: feat(friends): Multi-identifier friend discovery (Phone, Username, Email) with privacy-safe exact matching

**Labels**: `frontend`, `backend`, `social`, `privacy`, `p1-high`  
**Milestone**: Milestone 4 - Authentication Redesign & Multi-Identifier Network  

---

## 1. User Story
**As a** Card Crew user wanting to share card benefits with trusted friends and family,  
**I want** to search for and send friend requests using their phone number, unique @username, or email address,  
**So that** connecting with real-world contacts is immediate and natural, without needing to ask them for arbitrary system UUIDs or rarely used email addresses.

---

## 2. Brutal Audit Reasons & Problem Statement
From the quantitative UI/UX Brutal Audit (Score: 36/100, Heuristic 2: Match between system and real world, Heuristic 5: Error Prevention):
1. **Unrealistic Friend Discovery**:
   - The existing `FriendsPage.tsx` only allows adding friends via their exact registered email address.
   - In social networks and peer finance apps (UPI, Splitwise, Google Pay), users connect via mobile contacts or short usernames. Demanding email addresses creates high user friction and abandons social graph growth.
2. **Privacy Vulnerability & Data Harvesting Risk**:
   - An unconstrained `ilike '%search%'` query on user profiles would allow malicious users or bots to scrape the entire user database of phone numbers and emails.
   - The search mechanism must enforce exact-match or strict rate-limited lookups to protect user privacy.
3. **Weak Feedback on Friend Requests**:
   - Sending a request currently provides little feedback if the user doesn't exist, has already received a pending request, or is already a friend.

---

## 3. Technical Specifications

### 3.1 Privacy-Safe Search RPC (`supabase/migrations/20261003000004_friend_discovery_rpc.sql`)
```sql
-- Migration: Secure RPC for finding friends by phone, username, or email
CREATE OR REPLACE FUNCTION public.lookup_friend_by_identifier(p_query TEXT)
RETURNS TABLE (
  profile_id UUID,
  full_name TEXT,
  username TEXT,
  avatar_seed TEXT,
  friendship_status TEXT -- 'none', 'pending_outgoing', 'pending_incoming', 'accepted', 'self'
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_current_user UUID;
  v_clean_query TEXT;
  v_is_phone BOOLEAN;
  v_is_email BOOLEAN;
BEGIN
  v_current_user := auth.uid();
  IF v_current_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_clean_query := TRIM(p_query);
  IF LENGTH(v_clean_query) < 3 THEN
    RETURN;
  END IF;

  -- Remove leading '@' if typed
  IF LEFT(v_clean_query, 1) = '@' THEN
    v_clean_query := SUBSTRING(v_clean_query FROM 2);
  END IF;

  v_is_phone := v_clean_query ~ '^\+?[0-9]{10,14}$';
  v_is_email := v_clean_query ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';

  RETURN QUERY
  SELECT 
    p.id AS profile_id,
    p.full_name,
    p.username,
    COALESCE(p.avatar_seed, p.username, 'default') AS avatar_seed,
    CASE 
      WHEN p.id = v_current_user THEN 'self'
      WHEN EXISTS (
        SELECT 1 FROM public.friend_edges fe 
        WHERE (fe.user_a = v_current_user AND fe.user_b = p.id)
           OR (fe.user_b = v_current_user AND fe.user_a = p.id)
      ) THEN 'accepted'
      WHEN EXISTS (
        SELECT 1 FROM public.friend_requests fr 
        WHERE fr.sender_id = v_current_user AND fr.receiver_id = p.id AND fr.status = 'pending'
      ) THEN 'pending_outgoing'
      WHEN EXISTS (
        SELECT 1 FROM public.friend_requests fr 
        WHERE fr.sender_id = p.id AND fr.receiver_id = v_current_user AND fr.status = 'pending'
      ) THEN 'pending_incoming'
      ELSE 'none'
    END AS friendship_status
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE (
    -- Exact username match
    LOWER(p.username) = LOWER(v_clean_query)
    -- Or exact phone match (clean formatting)
    OR (v_is_phone AND (
      p.phone_number = v_clean_query 
      OR p.phone_number = '+91' || REGEXP_REPLACE(v_clean_query, '^(\+91|0)', '')
    ))
    -- Or exact email match
    OR (v_is_email AND LOWER(u.email) = LOWER(v_clean_query))
  )
  LIMIT 5;
END;
$$;
```

### 3.2 UI Flow in `FriendsPage.tsx`
1. **Search Header**:
   - Modern search bar with multi-identifier prompt:  
     `"Search by username (@handle), phone (+91), or email..."`
   - Real-time debounced search (350ms).
2. **Search Result Card (`FriendSearchResultCard.tsx`)**:
   - Displays candidate avatar (SVG seed), Full Name, `@username`.
   - Contextual Action Button:
     - `none` $\rightarrow$ `[ + Add Friend ]` (Brand primary CTA)
     - `pending_outgoing` $\rightarrow$ `[ Request Sent ]` (Disabled / Muted)
     - `pending_incoming` $\rightarrow$ `[ Accept Request ]` (Emerald CTA)
     - `accepted` $\rightarrow$ `[ Connected ]` (Badge)
     - `self` $\rightarrow$ `[ That's you! ]`
3. **Empty States**:
   - No query $\rightarrow$ `"Search for friends to expand your card sharing network."`
   - Query unmatched $\rightarrow$ `"No users found with this handle or phone number. Check spelling or invite them to Card Crew."`

---

## 4. Step-by-Step Implementation Guide
1. **Database Migration**:
   - Deploy `supabase/migrations/20261003000004_friend_discovery_rpc.sql`.
2. **Update API Client**:
   - Add `searchFriends(query: string)` method calling `lookup_friend_by_identifier` RPC in `frontend/src/lib/apiClient.ts`.
3. **Component Refactoring**:
   - Update `frontend/src/pages/FriendsPage.tsx`.
   - Extract `AddFriendModal.tsx` or inline quick search bar.
   - Replace raw user emails in the friend list with verified `@username` and Full Name.
4. **Toast Feedback**:
   - Show instantaneous feedback on request dispatch: `"Friend request sent to @username"`.

---

## 5. Security, Privacy & Integrity Boundaries
- **Zero Wildcard Exposure**: Phone numbers and emails are never returned in the result set; only public profiles (Name, Username, Avatar).
- **Exact Match Enforcement**: Phone numbers and emails must match exactly. No prefix searching or wildcard scans are permitted on sensitive contact info.

---

## 6. Acceptance Criteria Checklist
- [ ] Users can find other members by entering exact phone number (with or without `+91`), `@username`, or email.
- [ ] Profile information returned omits private email addresses and phone numbers.
- [ ] Accurate status badges render for existing friends, pending outgoing requests, and pending incoming requests.
- [ ] Prevent users from sending friend requests to themselves.
- [ ] Search responds in $< 150\text{ms}$ with index-backed SQL lookups.

---

## 7. Verification & Test Plan
1. **RPC Test**:
   - Execute query with valid username, formatted phone number, and test email.
   - Confirm status transitions (`none`, `pending_outgoing`, `accepted`).
2. **Security Leak Check**:
   - Inspect JSON response over Network tab in DevTools; verify `phone_number` and `email` columns are never included in the RPC output payload.
