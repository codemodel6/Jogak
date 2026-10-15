-- 단체 채팅 + 권한(RLS) 정리
-- 1) 채팅방 참여자 테이블(chat_members)을 두고, 1:1·단체 모두 참여자 기준으로 권한을 판단한다.
-- 2) "로그인하면 전부 허용"이던 정책을 본인·참여자 기준으로 좁힌다.
-- 3) 신뢰 포인트(hearts)·신뢰 점수(trust_score)는 사용자가 직접 바꾸지 못하게 하고 DB 함수로만 바꾼다.
-- 4) 메시지를 Realtime으로 실시간 전송한다.

-- ───────── 채팅방 ─────────
alter table public.chats
  add column if not exists is_group boolean not null default false,
  add column if not exists title text,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create table if not exists public.chat_members (
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);
create index if not exists chat_members_user_id_idx on public.chat_members (user_id);

-- 기존 1:1 채팅방 참여자 채우기
insert into public.chat_members (chat_id, user_id, role)
select id, user1_id, 'owner' from public.chats where user1_id is not null
on conflict do nothing;
insert into public.chat_members (chat_id, user_id, role)
select id, user2_id, 'member' from public.chats where user2_id is not null
on conflict do nothing;

-- 1:1 채팅방이 만들어지면 두 사람을 참여자로 자동 등록
create or replace function public.add_direct_chat_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not new.is_group then
    insert into public.chat_members (chat_id, user_id, role)
    values (new.id, new.user1_id, 'owner'), (new.id, new.user2_id, 'member')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists chats_add_direct_members on public.chats;
create trigger chats_add_direct_members
after insert on public.chats
for each row execute function public.add_direct_chat_members();

-- 참여 여부 확인 (정책 안에서 chat_members를 다시 조회할 때 정책이 되풀이되지 않도록 security definer)
create or replace function public.is_chat_member(p_chat_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chat_members
     where chat_id = p_chat_id and user_id = auth.uid()
  );
$$;

-- 단체 채팅방 만들기: 방과 참여자를 한 번에 만든다
create or replace function public.create_group_chat(p_title text, p_member_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chat_id uuid;
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if coalesce(array_length(p_member_ids, 1), 0) < 2 then
    raise exception '단체 채팅은 나를 빼고 2명 이상 초대해야 합니다.';
  end if;
  if v_title is not null and char_length(v_title) > 30 then
    raise exception '채팅방 이름은 30자 이내로 입력해 주세요.';
  end if;

  insert into public.chats (is_group, title, created_by, match_status)
  values (true, v_title, auth.uid(), 'none')
  returning id into v_chat_id;

  insert into public.chat_members (chat_id, user_id, role)
  values (v_chat_id, auth.uid(), 'owner');

  insert into public.chat_members (chat_id, user_id)
  select v_chat_id, member_id
    from unnest(p_member_ids) as member_id
   where member_id <> auth.uid()
  on conflict do nothing;

  return v_chat_id;
end;
$$;

revoke all on function public.create_group_chat(text, uuid[]) from public, anon;
grant execute on function public.create_group_chat(text, uuid[]) to authenticated;

-- ───────── 권한(RLS) ─────────
alter table public.chat_members enable row level security;

drop policy if exists "allow authenticated profiles" on public.profiles;
drop policy if exists "allow authenticated posts" on public.posts;
drop policy if exists "allow authenticated chats" on public.chats;
drop policy if exists "allow authenticated messages" on public.messages;
drop policy if exists "allow authenticated locations" on public.locations;

-- 프로필: 누구나 볼 수 있고, 본인 것만 만들고 고친다
create policy "profiles select" on public.profiles for select to authenticated using (true);
create policy "profiles insert own" on public.profiles for insert to authenticated with check (user_id = auth.uid());
create policy "profiles update own" on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 신뢰 포인트·신뢰 점수는 사용자가 직접 쓰지 못한다 (recover_trust 등 DB 함수만 변경)
revoke insert, update on public.profiles from authenticated, anon;
grant insert (user_id, name, height, age, location, photos, gender, mbti, purpose, photos_private, onboarded_at)
  on public.profiles to authenticated;
grant update (user_id, name, height, age, location, photos, gender, mbti, purpose, photos_private, onboarded_at)
  on public.profiles to authenticated;

-- 매칭 글: 누구나 보고, 본인 글만 쓰고 고치고 지운다
create policy "posts select" on public.posts for select to authenticated using (true);
create policy "posts insert own" on public.posts for insert to authenticated with check (user_id = auth.uid());
create policy "posts update own" on public.posts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "posts delete own" on public.posts for delete to authenticated using (user_id = auth.uid());

-- 채팅방: 참여자만 본다. 1:1은 본인이 들어간 방만 만들 수 있다
create policy "chats select member" on public.chats for select to authenticated
  using (public.is_chat_member(id) or user1_id = auth.uid() or user2_id = auth.uid());
create policy "chats insert direct" on public.chats for insert to authenticated
  with check (is_group = false and user1_id = auth.uid() and user2_id is not null and user2_id <> auth.uid());
create policy "chats update member" on public.chats for update to authenticated
  using (public.is_chat_member(id)) with check (public.is_chat_member(id));

-- 참여자: 같은 방 참여자만 보고, 참여자가 다른 사람을 초대할 수 있다(단체방). 나가기는 본인만
create policy "chat_members select" on public.chat_members for select to authenticated
  using (public.is_chat_member(chat_id));
create policy "chat_members invite" on public.chat_members for insert to authenticated
  with check (
    public.is_chat_member(chat_id)
    and role = 'member'
    and exists (select 1 from public.chats c where c.id = chat_id and c.is_group)
  );
create policy "chat_members leave" on public.chat_members for delete to authenticated
  using (user_id = auth.uid());

-- 메시지: 참여자만 읽고, 참여자 본인 이름으로만 보낸다
create policy "messages select member" on public.messages for select to authenticated
  using (public.is_chat_member(chat_id));
create policy "messages insert member" on public.messages for insert to authenticated
  with check (user_id = auth.uid() and public.is_chat_member(chat_id));

-- 위치: 같은 방 참여자만 보고, 본인 위치만 올린다
create policy "locations select member" on public.locations for select to authenticated
  using (public.is_chat_member(chat_id));
create policy "locations insert own" on public.locations for insert to authenticated
  with check (user_id = auth.uid() and public.is_chat_member(chat_id));
create policy "locations update own" on public.locations for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 위치 공유: 위치 저장 + 신뢰 포인트 1 차감 (hearts는 DB 함수에서만 바꾼다)
create or replace function public.share_location(p_chat_id uuid, p_lat double precision, p_lng double precision)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hearts integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if not public.is_chat_member(p_chat_id) then
    raise exception '이 채팅방의 참여자가 아닙니다.';
  end if;

  insert into public.locations (chat_id, user_id, lat, lng)
  values (p_chat_id, auth.uid(), p_lat, p_lng)
  on conflict (chat_id, user_id) do update set lat = excluded.lat, lng = excluded.lng;

  update public.profiles
     set hearts = greatest(coalesce(hearts, 0) - 1, 0)
   where user_id = auth.uid()
  returning hearts into v_hearts;

  return v_hearts;
end;
$$;

revoke all on function public.share_location(uuid, double precision, double precision) from public, anon;
grant execute on function public.share_location(uuid, double precision, double precision) to authenticated;

-- ───────── 실시간 ─────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
