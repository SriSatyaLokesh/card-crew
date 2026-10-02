-- Migration: 20260926000001_avatars_and_card_sharing.sql
-- 1. Add avatar_url to profiles
-- 2. Update profiles_public view to include avatar_url
-- 3. Update sync_profile function to support avatar_url
-- 4. Create avatars storage bucket and RLS policies
-- 5. Update network_graph function to return avatar_url on nodes
-- 6. Add resources_network_read RLS policy for depth 2
-- 7. Add get_person_cards RPC function

-- ── 1. profiles.avatar_url ──────────────────────────────────────────────────
alter table public.profiles
  add column if not exists avatar_url text;

-- ── 2. profiles_public view ─────────────────────────────────────────────────
create or replace view public.profiles_public with (security_invoker = false) as
  select id, display_name, status, avatar_url from public.profiles;

revoke all on public.profiles_public from public, anon;
grant select on public.profiles_public to authenticated;

-- ── 3. sync_profile function ────────────────────────────────────────────────
create or replace function public.sync_profile(
  p_display_name text default null,
  p_phone text default null,
  p_avatar_url text default null
)
returns public.profiles
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_existing public.profiles%rowtype;
  v_name text;
  v_meta jsonb := coalesce((select auth.jwt() -> 'user_metadata'), '{}'::jsonb);
  v_avatar text;
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

  v_avatar := coalesce(p_avatar_url, v_existing.avatar_url, nullif(trim(v_meta ->> 'avatar_url'), ''));

  begin
    insert into public.profiles (id, display_name, phone, avatar_url, status)
    values (v_uid, v_name, coalesce(p_phone, v_existing.phone), v_avatar, coalesce(v_existing.status, 'active'))
    on conflict (id) do update
      set display_name = excluded.display_name,
          phone = coalesce(p_phone, public.profiles.phone),
          avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
          updated_at = now()
    returning * into v_row;
  exception
    when unique_violation then
      raise exception using errcode = 'PT409', message = 'phone_already_in_use';
  end;

  return v_row;
end;
$$;
revoke execute on function public.sync_profile(text, text, text) from public, anon;
grant execute on function public.sync_profile(text, text, text) to authenticated;

-- ── 4. Supabase Storage: avatars bucket ─────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public Access for Avatars'
  ) then
    create policy "Public Access for Avatars"
      on storage.objects for select
      using (bucket_id = 'avatars');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated users can upload avatars'
  ) then
    create policy "Authenticated users can upload avatars"
      on storage.objects for insert
      to authenticated
      with check (bucket_id = 'avatars');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated users can update their avatars'
  ) then
    create policy "Authenticated users can update their avatars"
      on storage.objects for update
      to authenticated
      using (bucket_id = 'avatars');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated users can delete their avatars'
  ) then
    create policy "Authenticated users can delete their avatars"
      on storage.objects for delete
      to authenticated
      using (bucket_id = 'avatars');
  end if;
end $$;

-- ── 5. network_graph with avatar_url ─────────────────────────────────────────
create or replace function public.network_graph(p_max_depth int default 2)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as uid),
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
      'user_id', p.id,
      'display_name', p.display_name,
      'avatar_url', p.avatar_url,
      'depth', v.depth,
      'relationship', case v.depth when 0 then 'self' when 1 then 'direct' else 'second-degree' end,
      'via_user_id', v.via,
      'card_count', coalesce(c.card_count, 0)
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
revoke execute on function public.network_graph(int) from public, anon;
grant execute on function public.network_graph(int) to authenticated;

-- ── 6. RLS: resources_network_read for depth 2 ──────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'resources' and policyname = 'resources_network_read'
  ) then
    create policy resources_network_read on public.resources for select to authenticated
      using (
        status = 'active' and visibility_depth >= 2
        and exists (
          select 1 from public.friend_edges e1
          join public.friend_edges e2 on e2.user_id = e1.friend_id
          where e1.user_id = (select auth.uid()) and e2.friend_id = resources.owner_id
        )
        and not exists (
          select 1 from public.user_blocks b
          where (b.blocker_id = (select auth.uid()) and b.blocked_id = resources.owner_id)
             or (b.blocker_id = resources.owner_id and b.blocked_id = (select auth.uid()))
        )
      );
  end if;
end $$;

-- ── 7. RPC: get_person_cards ────────────────────────────────────────────────
-- Justification: walks the friend graph to determine viewer depth from p_user_id
-- and returns that user's visible cards joined with catalog data according to visibility_depth.
create or replace function public.get_person_cards(p_user_id uuid)
returns table (
  id uuid,
  owner_id uuid,
  catalog_item_id uuid,
  visibility_depth smallint,
  request_enabled boolean,
  status resource_status,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  product_name text,
  issuer text,
  issuer_slug text,
  card_type text,
  card_category text,
  variant text,
  upi_enabled boolean,
  network text,
  segment text,
  use_cases text[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_depth int;
begin
  if v_uid is null then
    raise exception using errcode = 'PT401', message = 'not_authenticated';
  end if;

  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = v_uid and b.blocked_id = p_user_id)
       or (b.blocker_id = p_user_id and b.blocked_id = v_uid)
  ) then
    raise exception using errcode = 'PT403', message = 'blocked';
  end if;

  if p_user_id = v_uid then
    v_depth := 0;
  elsif exists (select 1 from public.friend_edges e where e.user_id = v_uid and e.friend_id = p_user_id) then
    v_depth := 1;
  elsif exists (
    select 1 from public.friend_edges e1
    join public.friend_edges e2 on e2.user_id = e1.friend_id
    where e1.user_id = v_uid and e2.friend_id = p_user_id
  ) then
    v_depth := 2;
  else
    v_depth := 99;
  end if;

  return query
  select
    r.id,
    r.owner_id,
    r.catalog_item_id,
    r.visibility_depth,
    r.request_enabled,
    r.status,
    r.notes,
    r.created_at,
    r.updated_at,
    c.product_name,
    c.issuer,
    c.issuer_slug,
    c.card_type,
    c.card_category,
    c.variant,
    c.upi_enabled,
    c.network,
    c.segment,
    c.use_cases
  from public.resources r
  join public.catalog_cards_view c on c.id = r.catalog_item_id
  where r.owner_id = p_user_id
    and (
      (v_depth = 0)
      or
      (
        r.status = 'active'
        and (r.expiry_at is null or r.expiry_at > now())
        and r.visibility_depth >= v_depth
      )
    )
  order by c.product_name;
end;
$$;
revoke execute on function public.get_person_cards(uuid) from public, anon;
grant execute on function public.get_person_cards(uuid) to authenticated;
