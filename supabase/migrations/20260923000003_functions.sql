-- RPC catalog. Every route the old Express backend exposed becomes either a plain
-- PostgREST table/view call under RLS (see previous migration) or a function here.
--
-- Privilege model (docs/DATABASE_DESIGN.md §8, "SECURITY INVOKER by default"): a function
-- that only ever touches the caller's own rows runs as SECURITY INVOKER — RLS re-checks
-- every sub-query the same as a direct client call, so a bug in the function body cannot
-- cross the authorization boundary. SECURITY DEFINER is reserved for functions that
-- genuinely must read or write another user's row; each one below carries a one-line
-- justification. See the "Security Definer Audit" list at the end of this file — CI should
-- diff that list against pg_proc(prosecdef) so a new DEFINER function can't ship unaudited.
--
-- Every DEFINER function: `set search_path = ''`, fully-qualified `public.` names, acting
-- user from current_user_id() only (never a parameter), `revoke ... from public, anon`.

-- Indirection around auth.uid(): every function below calls this instead of auth.uid()
-- directly, so a future move off Supabase's auth needs one redefinition here, not a rewrite
-- of every function body.
create function current_user_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select auth.uid();
$$;
-- Postgres grants EXECUTE on new functions to PUBLIC by default — lock this down like
-- every other function here, even though it's normally only called internally.
revoke execute on function current_user_id() from public, anon;
grant execute on function current_user_id() to authenticated;

-- ── error contract ───────────────────────────────────────────────────────────
-- RAISE EXCEPTION ... USING ERRCODE = 'PTxxx' maps straight to that HTTP status in
-- PostgREST (PT400->400, PT403->403, PT404->404, PT409->409, PT429->429). Unmapped
-- Postgres errors (e.g. 23505 unique_violation) fall back to PostgREST's built-in class
-- mapping, generally 409/400 — never treated as success by the frontend adapter.

-- ═══════════════════════════════════════════════════════════════════════════
-- SECURITY INVOKER — own-row-only operations, RLS is the sole enforcement
-- ═══════════════════════════════════════════════════════════════════════════

-- Replaces POST /users/sync. Idempotent upsert; no auth.users insert trigger, because the
-- display-name resolution cascade below needs to run before the row can be considered
-- complete, which a trigger firing at signup time can't do.
create function sync_profile(p_display_name text default null, p_phone text default null)
returns profiles
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := public.current_user_id();
  v_existing public.profiles%rowtype;
  v_name text;
  v_meta jsonb := coalesce((select auth.jwt() -> 'user_metadata'), '{}'::jsonb);
  v_row public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception using errcode = 'PT401', message = 'not_authenticated';
  end if;

  select * into v_existing from public.profiles where id = v_uid;

  v_name := nullif(trim(coalesce(p_display_name, '')), '');
  if v_name is null then v_name := v_existing.display_name; end if;
  if v_name is null then v_name := nullif(trim(v_meta ->> 'display_name'), ''); end if;
  if v_name is null then v_name := nullif(trim(v_meta ->> 'full_name'), ''); end if;
  if v_name is null then v_name := nullif(trim(v_meta ->> 'name'), ''); end if;
  if v_name is null then v_name := nullif(trim(v_meta ->> 'preferred_username'), ''); end if;
  if v_name is null or length(v_name) > 80 then
    raise exception using errcode = 'PT400', message = 'display_name_required';
  end if;

  begin
    insert into public.profiles (id, display_name, phone, status)
    values (v_uid, v_name, coalesce(p_phone, v_existing.phone), coalesce(v_existing.status, 'active'))
    on conflict (id) do update
      set display_name = excluded.display_name,
          phone = coalesce(p_phone, public.profiles.phone),
          updated_at = now()
    returning * into v_row;
  exception
    when unique_violation then
      raise exception using errcode = 'PT409', message = 'phone_already_in_use';
  end;

  return v_row;
end;
$$;
revoke execute on function sync_profile(text, text) from public, anon;
grant execute on function sync_profile(text, text) to authenticated;

-- Bundles the highest-traffic screen's reads (own resources, own pending requests both
-- directions, friend count) into one round trip instead of three-plus. INVOKER: every
-- sub-query below is already RLS-scoped to "my own rows" by the policies in the previous
-- migration, so this function cannot leak another user's row even with a body bug.
create function get_dashboard()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'resources', coalesce((
      select jsonb_agg(row_to_json(r)) from (
        select id, catalog_item_id, visibility_depth, request_enabled, status
        from public.resources
        where owner_id = public.current_user_id() and status <> 'removed'
        order by created_at desc
        limit 50
      ) r
    ), '[]'::jsonb),
    'incoming_requests', coalesce((
      select jsonb_agg(row_to_json(r)) from (
        select id, requester_id, resource_id, status, created_at
        from public.requests
        where owner_id = public.current_user_id() and status = 'pending'
        order by created_at desc
        limit 50
      ) r
    ), '[]'::jsonb),
    'outgoing_requests', coalesce((
      select jsonb_agg(row_to_json(r)) from (
        select id, owner_id, resource_id, status, created_at
        from public.requests
        where requester_id = public.current_user_id() and status = 'pending'
        order by created_at desc
        limit 50
      ) r
    ), '[]'::jsonb),
    'friend_count', (select count(*) from public.friend_edges where user_id = public.current_user_id())
  );
$$;
revoke execute on function get_dashboard() from public, anon;
grant execute on function get_dashboard() to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- SECURITY DEFINER — each crosses into another user's data; justified per function
-- ═══════════════════════════════════════════════════════════════════════════

-- Justification: reads another user's resource row (owner may not be a direct friend
-- yet — that's exactly the thing being checked) to compute the viewer's graph distance.
create function get_resource(p_resource_id uuid)
returns resources
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.current_user_id();
  v_r public.resources%rowtype;
  v_depth int;
begin
  if v_uid is null then raise exception using errcode = 'PT401', message = 'not_authenticated'; end if;

  select * into v_r from public.resources where id = p_resource_id;
  if not found then raise exception using errcode = 'PT404', message = 'resource_not_found'; end if;

  if v_r.owner_id = v_uid then
    return v_r; -- owner always sees own resource regardless of status
  end if;

  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = v_uid and b.blocked_id = v_r.owner_id)
       or (b.blocker_id = v_r.owner_id and b.blocked_id = v_uid)
  ) then
    raise exception using errcode = 'PT403', message = 'blocked';
  end if;

  select case
    when exists (select 1 from public.friend_edges e where e.user_id = v_uid and e.friend_id = v_r.owner_id) then 1
    when exists (
      select 1 from public.friend_edges e1
      join public.friend_edges e2 on e2.user_id = e1.friend_id
      where e1.user_id = v_uid and e2.friend_id = v_r.owner_id
    ) then 2
    else 99
  end into v_depth;

  if v_r.status <> 'active' or v_depth > v_r.visibility_depth then
    raise exception using errcode = 'PT403', message = 'not_visible';
  end if;

  return v_r;
end;
$$;
revoke execute on function get_resource(uuid) from public, anon;
grant execute on function get_resource(uuid) to authenticated;

-- Justification: must check existence/blocks of ANOTHER user and insert a request row
-- referencing them, before any friendship exists.
create function send_friend_request(p_addressee_id uuid)
returns friend_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.current_user_id();
  v_row public.friend_requests%rowtype;
begin
  if v_uid is null then raise exception using errcode = 'PT401', message = 'not_authenticated'; end if;
  if p_addressee_id = v_uid then raise exception using errcode = 'PT400', message = 'cannot_friend_self'; end if;
  if not exists (select 1 from public.profiles where id = p_addressee_id) then
    raise exception using errcode = 'PT404', message = 'user_not_found';
  end if;
  if exists (
    select 1 from public.user_blocks
    where (blocker_id = v_uid and blocked_id = p_addressee_id)
       or (blocker_id = p_addressee_id and blocked_id = v_uid)
  ) then
    raise exception using errcode = 'PT403', message = 'blocked';
  end if;
  if exists (
    select 1 from public.friendships
    where user_a = least(v_uid, p_addressee_id) and user_b = greatest(v_uid, p_addressee_id)
  ) then
    raise exception using errcode = 'PT409', message = 'already_friends';
  end if;
  if (
    select count(*) from public.friend_requests
    where requester_id = v_uid and created_at > now() - interval '1 minute'
  ) >= 10 then
    raise exception using errcode = 'PT429', message = 'rate_limited';
  end if;

  begin
    insert into public.friend_requests (requester_id, addressee_id)
    values (v_uid, p_addressee_id)
    returning * into v_row;
  exception
    when unique_violation then
      raise exception using errcode = 'PT409', message = 'request_already_pending';
  end;

  return v_row;
end;
$$;
revoke execute on function send_friend_request(uuid) from public, anon;
grant execute on function send_friend_request(uuid) to authenticated;

-- Justification: writes a friendships row representing BOTH parties' consent. Could be
-- expressed as an RLS WITH CHECK proving "a matching pending request exists," but that
-- pushes bidirectional-consent logic into a policy expression — harder to test in
-- isolation and easier to get subtly wrong than explicit, individually-testable plpgsql.
create function accept_friend_request(p_request_id uuid)
returns friendships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.current_user_id();
  v_req public.friend_requests%rowtype;
  v_fr public.friendships%rowtype;
begin
  if v_uid is null then raise exception using errcode = 'PT401', message = 'not_authenticated'; end if;

  select * into v_req from public.friend_requests where id = p_request_id;
  if not found then raise exception using errcode = 'PT404', message = 'request_not_found'; end if;
  if v_req.addressee_id <> v_uid then
    raise exception using errcode = 'PT403', message = 'only_addressee_can_accept';
  end if;
  if v_req.status <> 'pending' then
    raise exception using errcode = 'PT409', message = 'request_not_pending';
  end if;

  update public.friend_requests set status = 'accepted', responded_at = now() where id = p_request_id;

  insert into public.friendships (user_a, user_b)
  values (least(v_req.requester_id, v_req.addressee_id), greatest(v_req.requester_id, v_req.addressee_id))
  on conflict do nothing;

  select * into v_fr from public.friendships
  where user_a = least(v_req.requester_id, v_req.addressee_id)
    and user_b = greatest(v_req.requester_id, v_req.addressee_id);

  return v_fr;
end;
$$;
revoke execute on function accept_friend_request(uuid) from public, anon;
grant execute on function accept_friend_request(uuid) to authenticated;

-- Justification: same as accept — writes the counterpart's request row on decline/cancel.
create function decline_friend_request(p_request_id uuid)
returns friend_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.current_user_id();
  v_req public.friend_requests%rowtype;
begin
  if v_uid is null then raise exception using errcode = 'PT401', message = 'not_authenticated'; end if;

  select * into v_req from public.friend_requests where id = p_request_id;
  if not found then raise exception using errcode = 'PT404', message = 'request_not_found'; end if;
  if v_req.status <> 'pending' then raise exception using errcode = 'PT409', message = 'request_not_pending'; end if;

  if v_uid = v_req.addressee_id then
    update public.friend_requests set status = 'declined', responded_at = now()
    where id = p_request_id returning * into v_req;
  elsif v_uid = v_req.requester_id then
    update public.friend_requests set status = 'cancelled', responded_at = now()
    where id = p_request_id returning * into v_req;
  else
    raise exception using errcode = 'PT403', message = 'not_a_party';
  end if;

  return v_req;
end;
$$;
revoke execute on function decline_friend_request(uuid) from public, anon;
grant execute on function decline_friend_request(uuid) to authenticated;

-- Justification: deletes a friendships row representing both parties, cancels pending
-- requests between them — a cross-user, multi-table transaction.
create function block_user(p_target_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := public.current_user_id();
begin
  if v_uid is null then raise exception using errcode = 'PT401', message = 'not_authenticated'; end if;
  if p_target_id = v_uid then raise exception using errcode = 'PT400', message = 'cannot_block_self'; end if;

  -- idempotent by design: a block is a safety action, failing on "already blocked"
  -- protects nothing and adds a code path for no benefit.
  insert into public.user_blocks (blocker_id, blocked_id) values (v_uid, p_target_id) on conflict do nothing;

  delete from public.friendships
  where user_a = least(v_uid, p_target_id) and user_b = greatest(v_uid, p_target_id);
  -- friend_edges is dropped automatically by the sync_friend_edges trigger.

  delete from public.friend_requests
  where status = 'pending'
    and requester_id in (v_uid, p_target_id)
    and addressee_id in (v_uid, p_target_id);
end;
$$;
revoke execute on function block_user(uuid) from public, anon;
grant execute on function block_user(uuid) to authenticated;

-- Justification: deletes a friendships row keyed by both parties.
create function remove_friend(p_friend_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := public.current_user_id();
begin
  if v_uid is null then raise exception using errcode = 'PT401', message = 'not_authenticated'; end if;

  if not exists (
    select 1 from public.friendships
    where user_a = least(v_uid, p_friend_id) and user_b = greatest(v_uid, p_friend_id)
  ) then
    raise exception using errcode = 'PT404', message = 'friendship_not_found';
  end if;

  delete from public.friendships
  where user_a = least(v_uid, p_friend_id) and user_b = greatest(v_uid, p_friend_id);
end;
$$;
revoke execute on function remove_friend(uuid) from public, anon;
grant execute on function remove_friend(uuid) to authenticated;

-- Justification: the hot query — reads another user's resources across a multi-hop graph.
-- Full design/rationale in docs/DATABASE_DESIGN.md §9.
create function search_network(p_catalog_item uuid, p_max_depth int default 1)
returns table (
  owner_id uuid, display_name text, resource_id uuid,
  depth int, via_user_id uuid, requestable boolean, needs_referral boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select public.current_user_id() as uid),
  d1 as (
    select e.friend_id as user_id, 1 as depth, null::uuid as via
    from public.friend_edges e join me on e.user_id = me.uid
  ),
  d2 as (
    select distinct on (e2.friend_id)
           e2.friend_id as user_id, 2 as depth, e2.user_id as via
    from d1
    join public.friend_edges e2 on e2.user_id = d1.user_id
    where least(greatest(p_max_depth, 1), 2) >= 2
      and e2.friend_id <> (select uid from me)
      and not exists (select 1 from d1 x where x.user_id = e2.friend_id)
    order by e2.friend_id, e2.user_id
  ),
  reach as (select * from d1 union all select * from d2)
  select r.owner_id, p.display_name, r.id, reach.depth, reach.via,
         r.request_enabled, reach.depth > 1
  from reach
  join public.resources r
    on r.owner_id = reach.user_id
   and r.catalog_item_id = p_catalog_item
   and r.status = 'active'
   and reach.depth <= r.visibility_depth
   and (r.expiry_at is null or r.expiry_at > now())
  join public.profiles p on p.id = r.owner_id and p.status = 'active'
  where (select uid from me) is not null
    and not exists (
      select 1 from public.user_blocks b, me
      where (b.blocker_id = me.uid and b.blocked_id = r.owner_id)
         or (b.blocker_id = r.owner_id and b.blocked_id = me.uid)
    )
  order by reach.depth, p.display_name;
$$;
revoke execute on function search_network(uuid, int) from public, anon;
grant execute on function search_network(uuid, int) to authenticated;

-- Justification: same multi-hop graph traversal as search_network, returning full
-- node/edge sets instead of card matches. LIMIT 500 nodes is a hard cap, not deferred —
-- an unbounded jsonb response is a resource-exhaustion vector regardless of current
-- user count, unlike friend_edges materialization which is pure scale headroom.
create function network_graph(p_max_depth int default 2)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select public.current_user_id() as uid),
  d1 as (
    select e.friend_id as user_id, 1 as depth, null::uuid as via
    from public.friend_edges e, me where e.user_id = me.uid
  ),
  d2 as (
    select distinct on (e2.friend_id) e2.friend_id as user_id, 2 as depth, e2.user_id as via
    from d1
    join public.friend_edges e2 on e2.user_id = d1.user_id, me
    where least(greatest(p_max_depth, 1), 2) >= 2
      and e2.friend_id <> me.uid
      and not exists (select 1 from d1 x where x.user_id = e2.friend_id)
    order by e2.friend_id, e2.user_id
  ),
  reach_all as (
    select me.uid as user_id, 0 as depth, null::uuid as via from me
    union all select * from d1
    union all select * from d2
  ),
  blocked as (
    select b.blocker_id, b.blocked_id from public.user_blocks b, me
    where b.blocker_id = me.uid or b.blocked_id = me.uid
  ),
  visible_all as (
    select r.* from reach_all r
    where not exists (select 1 from blocked bl where bl.blocker_id = (select uid from me) and bl.blocked_id = r.user_id)
      and not exists (select 1 from blocked bl where bl.blocker_id = r.user_id and bl.blocked_id = (select uid from me))
  ),
  visible as (
    select * from visible_all order by depth, user_id limit 500
  ),
  truncated as (
    select (select count(*) from visible_all) > (select count(*) from visible) as is_truncated
  ),
  counts as (
    select r.owner_id, count(*) as card_count
    from public.resources r join visible v on v.user_id = r.owner_id
    where r.status = 'active' and v.depth <= r.visibility_depth
    group by r.owner_id
  ),
  nodes as (
    select jsonb_agg(jsonb_build_object(
      'user_id', p.id, 'display_name', p.display_name, 'depth', v.depth,
      'relationship', case v.depth when 0 then 'self' when 1 then 'direct' else 'second-degree' end,
      'via_user_id', v.via, 'card_count', coalesce(c.card_count, 0)
    )) as j
    from visible v
    join public.profiles p on p.id = v.user_id and p.status = 'active'
    left join counts c on c.owner_id = v.user_id
  ),
  edges as (
    select jsonb_agg(distinct jsonb_build_object('from_user_id', v1.user_id, 'to_user_id', e.friend_id)) as j
    from visible v1
    join public.friend_edges e on e.user_id = v1.user_id
    join visible v2 on v2.user_id = e.friend_id
    where v1.user_id < e.friend_id
  )
  select jsonb_build_object(
    'nodes', coalesce((select j from nodes), '[]'::jsonb),
    'edges', coalesce((select j from edges), '[]'::jsonb),
    'truncated', (select is_truncated from truncated)
  );
$$;
revoke execute on function network_graph(int) from public, anon;
grant execute on function network_graph(int) to authenticated;

-- Justification: reads another user's resource to derive owner_id, walks the graph to
-- find a mutual-friend referral path, inserts a row where owner_id/intermediary_id
-- reference people other than the caller.
create function create_request(p_resource_id uuid, p_message text default '')
returns requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.current_user_id();
  v_res public.resources%rowtype;
  v_intermediary uuid;
  v_direct boolean;
  v_req public.requests%rowtype;
begin
  if v_uid is null then raise exception using errcode = 'PT401', message = 'not_authenticated'; end if;

  select * into v_res from public.resources where id = p_resource_id;
  if not found then raise exception using errcode = 'PT404', message = 'resource_not_found'; end if;
  if v_res.owner_id = v_uid then raise exception using errcode = 'PT400', message = 'cannot_request_own_resource'; end if;
  if v_res.status <> 'active' or not v_res.request_enabled or v_res.visibility_depth < 1 then
    raise exception using errcode = 'PT403', message = 'resource_not_requestable';
  end if;
  if exists (
    select 1 from public.user_blocks
    where (blocker_id = v_uid and blocked_id = v_res.owner_id)
       or (blocker_id = v_res.owner_id and blocked_id = v_uid)
  ) then
    raise exception using errcode = 'PT403', message = 'blocked';
  end if;

  v_direct := exists (select 1 from public.friend_edges where user_id = v_uid and friend_id = v_res.owner_id);

  if not v_direct then
    select e2.user_id into v_intermediary
    from public.friend_edges e1
    join public.friend_edges e2 on e2.user_id = e1.friend_id
    where e1.user_id = v_uid and e2.friend_id = v_res.owner_id
    limit 1;
    if v_intermediary is null then raise exception using errcode = 'PT403', message = 'not_reachable'; end if;
    -- generalized from the old "visibility === 'network'" check to visibility_depth >= 2
    if v_res.visibility_depth < 2 then
      raise exception using errcode = 'PT403', message = 'not_available_beyond_direct_friends';
    end if;
  end if;

  if (
    select count(*) from public.requests
    where requester_id = v_uid and created_at > now() - interval '1 hour'
  ) >= 20 then
    raise exception using errcode = 'PT429', message = 'rate_limited';
  end if;

  insert into public.requests (requester_id, owner_id, resource_id, intermediary_id, message, referral_status)
  values (
    v_uid, v_res.owner_id, p_resource_id, v_intermediary, coalesce(p_message, ''),
    (case when v_intermediary is not null then 'pending' else 'not_required' end)::public.referral_status
  )
  returning * into v_req;

  insert into public.request_events (request_id, actor_id, event) values (v_req.id, v_uid, 'created');

  return v_req;
end;
$$;
revoke execute on function create_request(uuid, text) from public, anon;
grant execute on function create_request(uuid, text) to authenticated;

-- Justification: an RLS UPDATE ... WITH CHECK whose predicate fails returns a silent
-- 0-row success (PostgREST returns 200/[]), not the distinct PT409/PT400 the frontend
-- needs to show the right message. Kept DEFINER for error-message fidelity, not laziness.
create function respond_to_request(p_request_id uuid, p_status request_status)
returns requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.current_user_id();
  v_req public.requests%rowtype;
begin
  if v_uid is null then raise exception using errcode = 'PT401', message = 'not_authenticated'; end if;
  if p_status not in ('approved', 'declined', 'ignored') then
    raise exception using errcode = 'PT400', message = 'invalid_status';
  end if;

  select * into v_req from public.requests where id = p_request_id;
  if not found then raise exception using errcode = 'PT404', message = 'request_not_found'; end if;
  if v_req.owner_id <> v_uid then raise exception using errcode = 'PT403', message = 'only_owner_can_respond'; end if;
  if v_req.status <> 'pending' then raise exception using errcode = 'PT409', message = 'request_not_pending'; end if;
  if v_req.intermediary_id is not null and v_req.referral_status <> 'approved' then
    raise exception using errcode = 'PT409', message = 'referral_must_be_approved_first';
  end if;

  update public.requests set status = p_status, responded_at = now()
  where id = p_request_id returning * into v_req;
  insert into public.request_events (request_id, actor_id, event) values (p_request_id, v_uid, p_status::text);

  return v_req;
end;
$$;
revoke execute on function respond_to_request(uuid, request_status) from public, anon;
grant execute on function respond_to_request(uuid, request_status) to authenticated;

-- Justification: same error-message-fidelity reason as respond_to_request; also updates
-- a row the intermediary doesn't own in the requester/owner sense.
create function respond_to_referral(p_request_id uuid, p_referral_status referral_status)
returns requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.current_user_id();
  v_req public.requests%rowtype;
begin
  if v_uid is null then raise exception using errcode = 'PT401', message = 'not_authenticated'; end if;
  if p_referral_status not in ('approved', 'declined', 'ignored') then
    raise exception using errcode = 'PT400', message = 'invalid_referral_status';
  end if;

  select * into v_req from public.requests where id = p_request_id;
  if not found then raise exception using errcode = 'PT404', message = 'request_not_found'; end if;
  if v_req.intermediary_id is distinct from v_uid then
    raise exception using errcode = 'PT403', message = 'only_intermediary_can_decide';
  end if;

  update public.requests set referral_status = p_referral_status
  where id = p_request_id returning * into v_req;
  insert into public.request_events (request_id, actor_id, event)
  values (p_request_id, v_uid, 'referral_' || p_referral_status::text);

  return v_req;
end;
$$;
revoke execute on function respond_to_referral(uuid, referral_status) from public, anon;
grant execute on function respond_to_referral(uuid, referral_status) to authenticated;

-- Justification: reads another user's phone number — the one place in the whole schema
-- that happens, gated tightly behind an already-owner-approved request.
create type contact_info as (id uuid, display_name text, phone text, whatsapp_message text);

create function reveal_contact(p_request_id uuid, p_message text default null)
returns contact_info
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.current_user_id();
  v_req public.requests%rowtype;
  v_contact_id uuid;
  v_contact public.profiles%rowtype;
  v_msg text;
begin
  if v_uid is null then raise exception using errcode = 'PT401', message = 'not_authenticated'; end if;

  select * into v_req from public.requests where id = p_request_id;
  if not found then raise exception using errcode = 'PT404', message = 'request_not_found'; end if;
  if v_uid not in (v_req.owner_id, v_req.requester_id) then
    raise exception using errcode = 'PT403', message = 'only_participants_can_reveal_contact';
  end if;
  if v_req.status <> 'approved' then raise exception using errcode = 'PT409', message = 'request_not_approved'; end if;

  v_contact_id := case when v_req.owner_id = v_uid then v_req.requester_id else v_req.owner_id end;
  select * into v_contact from public.profiles where id = v_contact_id and status = 'active';
  if not found then raise exception using errcode = 'PT404', message = 'contact_not_found'; end if;

  v_msg := coalesce(
    nullif(trim(p_message), ''),
    'Hi ' || v_contact.display_name || ', I''m reaching out through Card Crew about a card request.'
  );

  insert into public.request_events (request_id, actor_id, event) values (p_request_id, v_uid, 'contact_revealed');

  return (v_contact.id, v_contact.display_name, v_contact.phone, v_msg)::public.contact_info;
end;
$$;
revoke execute on function reveal_contact(uuid, text) from public, anon;
grant execute on function reveal_contact(uuid, text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Security Definer Audit — kept in sync with the functions above. A CI check diffs the
-- set of prosecdef=true functions in pg_proc against this list; a new DEFINER function
-- landing without a row here should fail the build.
--
--   get_resource         — reads another user's resource + graph distance
--   send_friend_request   — reads/references another user before any friendship exists
--   accept_friend_request — writes a friendships row representing both parties
--   decline_friend_request— writes the counterpart's friend_requests row
--   block_user             — cross-user delete across friendships + friend_requests
--   remove_friend          — deletes a friendships row keyed by both parties
--   search_network          — multi-hop graph read across other users' resources
--   network_graph           — multi-hop graph read across other users' profiles/resources
--   create_request          — derives owner_id/intermediary_id from another user's data
--   respond_to_request      — error-message fidelity (see comment above the function)
--   respond_to_referral     — error-message fidelity (see comment above the function)
--   reveal_contact           — reads another user's phone number
--   sync_friend_edges (defined in 20260923000001_schema.sql, a trigger function, not an
--     RPC) — friend_edges has no INSERT/DELETE policy for `authenticated`, so the trigger
--     must bypass RLS to maintain the mirror when a friendships row changes.
--
-- Everything else in this file (current_user_id, sync_profile, get_dashboard) is
-- SECURITY INVOKER and relies on RLS alone.
