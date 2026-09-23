-- Guardrail: every SECURITY DEFINER function in public must have search_path pinned.
-- An unpinned search_path on a DEFINER function is the single most dangerous mistake
-- possible here (schema-shadowing privilege escalation) — this makes it a CI failure,
-- not a code-review hope.
do $$
declare
  v_bad text;
begin
  select string_agg(p.proname, ', ') into v_bad
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and not exists (
      select 1 from unnest(coalesce(p.proconfig, '{}')) cfg
      where cfg like 'search_path=%'
    );

  if v_bad is not null then
    raise exception 'SECURITY DEFINER function(s) missing a pinned search_path: %', v_bad;
  end if;
end $$;
