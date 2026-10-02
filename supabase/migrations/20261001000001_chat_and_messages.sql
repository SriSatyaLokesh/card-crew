-- Migration: 20261001000001_chat_and_messages.sql
-- Phase 1 Chat & Message Model for Supabase

-- 1. Create chats table
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  chat_type text not null default 'direct' check (chat_type in ('direct', 'group'))
);

-- 2. Create chat_participants table
create table if not exists public.chat_participants (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  unique (chat_id, user_id)
);

-- 3. Create messages table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (length(trim(content)) > 0),
  message_type text not null default 'text' check (message_type in ('text', 'image', 'video', 'file', 'audio', 'system')),
  status text not null default 'sent' check (status in ('sent', 'delivered', 'seen')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Create user_presence table (for persistent last-seen tracking)
create table if not exists public.user_presence (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Helper function for RLS checks (SECURITY DEFINER to avoid infinite recursion)
create or replace function public.is_chat_member(p_chat_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.chat_participants
    where chat_id = p_chat_id and user_id = p_user_id
  );
$$;

revoke execute on function public.is_chat_member(uuid, uuid) from public, anon;
grant execute on function public.is_chat_member(uuid, uuid) to authenticated;

-- 6. Create indexes
create index if not exists idx_messages_chat_created on public.messages (chat_id, created_at desc);
create index if not exists idx_messages_sender on public.messages (sender_id);
create index if not exists idx_messages_chat_status on public.messages (chat_id, status);
create index if not exists idx_chat_participants_chat on public.chat_participants (chat_id);
create index if not exists idx_chat_participants_user on public.chat_participants (user_id);
create index if not exists idx_chats_updated on public.chats (updated_at desc);

-- 7. Enable Row Level Security (RLS)
alter table public.chats enable row level security;
alter table public.chat_participants enable row level security;
alter table public.messages enable row level security;
alter table public.user_presence enable row level security;

-- 8. RLS Policies for chats
drop policy if exists chats_select on public.chats;
create policy chats_select on public.chats
  for select to authenticated
  using (public.is_chat_member(id));

drop policy if exists chats_insert on public.chats;
create policy chats_insert on public.chats
  for insert to authenticated
  with check (created_by = (select auth.uid()));

drop policy if exists chats_update on public.chats;
create policy chats_update on public.chats
  for update to authenticated
  using (public.is_chat_member(id));

-- 9. RLS Policies for chat_participants
drop policy if exists chat_participants_select on public.chat_participants;
create policy chat_participants_select on public.chat_participants
  for select to authenticated
  using (public.is_chat_member(chat_id));

drop policy if exists chat_participants_insert on public.chat_participants;
create policy chat_participants_insert on public.chat_participants
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.chats c
      where c.id = chat_participants.chat_id and c.created_by = (select auth.uid())
    )
  );

drop policy if exists chat_participants_update on public.chat_participants;
create policy chat_participants_update on public.chat_participants
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 10. RLS Policies for messages
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated
  using (public.is_chat_member(chat_id));

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_chat_member(chat_id)
  );

drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages
  for update to authenticated
  using (public.is_chat_member(chat_id))
  with check (public.is_chat_member(chat_id));

-- 11. RLS Policies for user_presence
drop policy if exists user_presence_select on public.user_presence;
create policy user_presence_select on public.user_presence
  for select to authenticated
  using (true);

drop policy if exists user_presence_all on public.user_presence;
create policy user_presence_all on public.user_presence
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 12. Add tables to Supabase Realtime publication
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'chat_participants') then
    alter publication supabase_realtime add table public.chat_participants;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'chats') then
    alter publication supabase_realtime add table public.chats;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'user_presence') then
    alter publication supabase_realtime add table public.user_presence;
  end if;
end $$;

alter table public.messages replica identity full;
alter table public.chat_participants replica identity full;
alter table public.chats replica identity full;
alter table public.user_presence replica identity full;

-- 13. Helper Functions & RPCs

-- A. get_or_create_direct_chat: safely retrieves an existing 1-on-1 chat or creates a new one
create or replace function public.get_or_create_direct_chat(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_chat_id uuid;
begin
  if v_uid is null then
    raise exception using errcode = 'PT401', message = 'not_authenticated';
  end if;

  if p_other_user_id is null or p_other_user_id = v_uid then
    raise exception using errcode = 'PT400', message = 'invalid_recipient';
  end if;

  if not exists (select 1 from public.profiles where id = p_other_user_id) then
    raise exception using errcode = 'PT404', message = 'user_not_found';
  end if;

  -- Check if a direct chat between these two users already exists
  select c.id into v_chat_id
  from public.chats c
  join public.chat_participants cp1 on cp1.chat_id = c.id and cp1.user_id = v_uid
  join public.chat_participants cp2 on cp2.chat_id = c.id and cp2.user_id = p_other_user_id
  where c.chat_type = 'direct'
  limit 1;

  if v_chat_id is not null then
    return v_chat_id;
  end if;

  -- Create a new direct chat
  insert into public.chats (created_by, chat_type)
  values (v_uid, 'direct')
  returning id into v_chat_id;

  -- Add both participants
  insert into public.chat_participants (chat_id, user_id)
  values
    (v_chat_id, v_uid),
    (v_chat_id, p_other_user_id);

  return v_chat_id;
end;
$$;

revoke execute on function public.get_or_create_direct_chat(uuid) from public, anon;
grant execute on function public.get_or_create_direct_chat(uuid) to authenticated;

-- B. get_user_chats: returns all conversations for current user with other participant details & last message
create or replace function public.get_user_chats()
returns table (
  chat_id uuid,
  chat_type text,
  updated_at timestamptz,
  other_user_id uuid,
  other_user_name text,
  other_user_avatar_url text,
  last_read_at timestamptz,
  last_message_id uuid,
  last_message_content text,
  last_message_sender_id uuid,
  last_message_status text,
  last_message_created_at timestamptz,
  unread_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception using errcode = 'PT401', message = 'not_authenticated';
  end if;

  return query
  with my_chats as (
    select
      cp.chat_id,
      cp.last_read_at,
      c.chat_type,
      c.updated_at
    from public.chat_participants cp
    join public.chats c on c.id = cp.chat_id
    where cp.user_id = v_uid
  ),
  other_members as (
    select distinct on (cp.chat_id)
      cp.chat_id,
      cp.user_id as other_id,
      p.display_name as other_name,
      p.avatar_url as other_avatar
    from public.chat_participants cp
    join public.profiles p on p.id = cp.user_id
    where cp.user_id <> v_uid
    order by cp.chat_id, cp.joined_at
  ),
  latest_msgs as (
    select distinct on (m.chat_id)
      m.chat_id,
      m.id as msg_id,
      m.content as msg_content,
      m.sender_id as msg_sender_id,
      m.status as msg_status,
      m.created_at as msg_created_at
    from public.messages m
    order by m.chat_id, m.created_at desc
  ),
  unreads as (
    select
      mc.chat_id,
      count(m.id) as cnt
    from my_chats mc
    left join public.messages m on m.chat_id = mc.chat_id
      and m.sender_id <> v_uid
      and m.created_at > mc.last_read_at
    group by mc.chat_id
  )
  select
    mc.chat_id,
    mc.chat_type,
    mc.updated_at,
    om.other_id as other_user_id,
    coalesce(om.other_name, 'Member') as other_user_name,
    om.other_avatar as other_user_avatar_url,
    mc.last_read_at,
    lm.msg_id as last_message_id,
    lm.msg_content as last_message_content,
    lm.msg_sender_id as last_message_sender_id,
    lm.msg_status as last_message_status,
    lm.msg_created_at as last_message_created_at,
    coalesce(u.cnt, 0) as unread_count
  from my_chats mc
  left join other_members om on om.chat_id = mc.chat_id
  left join latest_msgs lm on lm.chat_id = mc.chat_id
  left join unreads u on u.chat_id = mc.chat_id
  order by coalesce(lm.msg_created_at, mc.updated_at) desc;
end;
$$;

revoke execute on function public.get_user_chats() from public, anon;
grant execute on function public.get_user_chats() to authenticated;

-- C. mark_chat_as_read: marks messages in chat as seen and updates last_read_at
create or replace function public.mark_chat_as_read(p_chat_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception using errcode = 'PT401', message = 'not_authenticated';
  end if;

  -- Update participant last_read_at
  update public.chat_participants
  set last_read_at = now()
  where chat_id = p_chat_id and user_id = v_uid;

  -- Update unseen incoming messages to seen
  update public.messages
  set status = 'seen', updated_at = now()
  where chat_id = p_chat_id
    and sender_id <> v_uid
    and status <> 'seen';

  -- Update chat updated_at timestamp
  update public.chats
  set updated_at = now()
  where id = p_chat_id;
end;
$$;

revoke execute on function public.mark_chat_as_read(uuid) from public, anon;
grant execute on function public.mark_chat_as_read(uuid) to authenticated;

-- D. mark_messages_delivered: updates incoming sent messages to delivered
create or replace function public.mark_messages_delivered(p_chat_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception using errcode = 'PT401', message = 'not_authenticated';
  end if;

  update public.messages
  set status = 'delivered', updated_at = now()
  where chat_id = p_chat_id
    and sender_id <> v_uid
    and status = 'sent';
end;
$$;

revoke execute on function public.mark_messages_delivered(uuid) from public, anon;
grant execute on function public.mark_messages_delivered(uuid) to authenticated;

-- E. update_user_last_seen: persists the user's latest active timestamp
create or replace function public.update_user_last_seen()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;

  insert into public.user_presence (user_id, last_seen_at, updated_at)
  values (v_uid, now(), now())
  on conflict (user_id) do update
  set last_seen_at = now(), updated_at = now();
end;
$$;

revoke execute on function public.update_user_last_seen() from public, anon;
grant execute on function public.update_user_last_seen() to authenticated;
