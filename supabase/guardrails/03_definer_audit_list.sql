-- Guardrail: the SECURITY DEFINER functions in the database must exactly match the
-- audited list below (mirrors the comment block at the end of
-- 20260923000003_functions.sql). Fails in both directions:
--   - a new DEFINER function shipped without updating this list (privilege creep by omission)
--   - a stale entry naming a function that no longer exists or is no longer DEFINER
-- Update both this file and the comment block together when the set changes.
do $$
declare
  v_audited text[] := array[
    'get_resource', 'send_friend_request', 'accept_friend_request', 'decline_friend_request',
    'block_user', 'remove_friend', 'search_network', 'network_graph', 'create_request',
    'respond_to_request', 'respond_to_referral', 'reveal_contact',
    -- trigger function, not an RPC, but still SECURITY DEFINER: friend_edges has no
    -- INSERT/DELETE policy for `authenticated`, so the trigger must bypass RLS to
    -- maintain the mirror when a friendships row (which IS authenticated-writable via
    -- accept_friend_request/block_user/remove_friend) changes.
    'sync_friend_edges'
  ];
  v_unaudited text;
  v_stale text;
begin
  select string_agg(p.proname, ', ') into v_unaudited
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and p.proname <> all (v_audited);

  if v_unaudited is not null then
    raise exception
      'SECURITY DEFINER function(s) not in the audited list -- add to supabase/guardrails/03_definer_audit_list.sql and the comment block in 20260923000003_functions.sql, with a one-line justification: %',
      v_unaudited;
  end if;

  select string_agg(x, ', ') into v_stale
  from unnest(v_audited) x
  where not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = x and p.prosecdef
  );

  if v_stale is not null then
    raise exception 'Audited function(s) no longer exist as SECURITY DEFINER -- remove from the audit list: %', v_stale;
  end if;
end $$;
