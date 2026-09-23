-- Guardrail: every base table in `public` has row level security enabled. Catches
-- "added a table, forgot RLS" before it ships. Add a table name here only when leaving it
-- open is deliberate and reviewed — none are today, not even the catalog tables, which
-- stay RLS-enabled with a permissive `using(active)`/`using(true)` policy rather than
-- RLS-off.
do $$
declare
  v_allowlist text[] := array[]::text[];
  v_bad text;
begin
  select string_agg(c.relname, ', ') into v_bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity
    and c.relname <> all (v_allowlist);

  if v_bad is not null then
    raise exception 'Table(s) in public schema without RLS enabled: %', v_bad;
  end if;
end $$;
