-- 사진 공개 범위 + 실물 확인 매칭
-- · 사진은 2가지: 프로필 아이콘(avatar_url, 공개 저장소, 어디서나 보임) / 실물 사진(face_photo_path, 비공개 저장소)
-- · 실물 사진은 매칭 확인 창에서만 시간제한 링크로 본다.
--   요청한 사람(A)은 요청 즉시 상대(B)의 실물을 보고 [매칭]/[거절]을 고른다.
--   B는 A가 [매칭]을 고른 뒤에야 A의 실물을 보고 [매칭]/[거절]을 고른다.
-- · 거절(A든 B든)하면 대화방이 닫혀 더 이상 메시지를 보낼 수 없다.
-- · 매칭권(무료 3장 → 보너스 → 1P)은 대화 시작이 아니라 매칭 요청 때 쓴다. 대화는 무료.
-- · 매칭 중 '매치 취소': 취소한 사람 신뢰 점수 -1 (대화방은 20261016_close_chat_on_match_end에서 닫는다).

-- 1) 프로필 사진 컬럼 (+ 실물 공개 판단에 쓰는 매칭 컬럼) ---------------------------
alter table public.matches add column if not exists requester_confirmed boolean not null default false;
alter table public.matches add column if not exists is_priority boolean not null default false;
alter table public.matches add column if not exists withdrawn_by uuid;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists face_photo_path text;
alter table public.profiles add column if not exists has_face_photo boolean
  generated always as (face_photo_path is not null) stored;

-- 기존 회원: 첫 번째 사진을 프로필 아이콘으로 옮기고 실물 사진은 비워 둔다
update public.profiles set avatar_url = photos[1] where avatar_url is null and coalesce(array_length(photos, 1), 0) > 0;

grant insert (avatar_url, face_photo_path) on public.profiles to authenticated;
grant update (avatar_url, face_photo_path) on public.profiles to authenticated;

-- 실물 사진 경로는 반드시 본인 폴더(<user_id>/...)여야 한다
create or replace function public.check_face_photo_path()
returns trigger
language plpgsql
as $$
begin
  if new.face_photo_path is not null and split_part(new.face_photo_path, '/', 1) <> new.user_id::text then
    raise exception '실물 사진 경로가 올바르지 않습니다.';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_check_face_path on public.profiles;
create trigger profiles_check_face_path before insert or update of face_photo_path on public.profiles
  for each row execute function public.check_face_photo_path();

-- 2) 비공개 실물 사진 저장소 ----------------------------------------------------
insert into storage.buckets (id, name, public)
values ('face-photos', 'face-photos', false)
on conflict (id) do update set public = false;

-- 지금 이 사람(p_owner)의 실물을 볼 수 있는가
create or replace function public.can_view_face(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = p_owner or exists (
    select 1 from public.matches m
     where m.status in ('requested', 'matched', 'met')
       and (
         (m.requester_id = auth.uid() and m.receiver_id = p_owner)
         or (m.receiver_id = auth.uid() and m.requester_id = p_owner and m.requester_confirmed)
       )
  );
$$;

drop policy if exists "face photos insert own" on storage.objects;
create policy "face photos insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'face-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "face photos update own" on storage.objects;
create policy "face photos update own" on storage.objects for update to authenticated
  using (bucket_id = 'face-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "face photos delete own" on storage.objects;
create policy "face photos delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'face-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "face photos select allowed" on storage.objects;
create policy "face photos select allowed" on storage.objects for select to authenticated
  using (bucket_id = 'face-photos' and public.can_view_face(((storage.foldername(name))[1])::uuid));

-- 3) 매칭·대화방 상태 컬럼 ------------------------------------------------------
alter table public.matches drop constraint if exists matches_status_check;
alter table public.matches add constraint matches_status_check
  check (status in ('requested', 'matched', 'met', 'declined', 'cancelled', 'expired', 'reported', 'withdrawn'));

alter table public.chats add column if not exists closed_at timestamptz;
alter table public.chats add column if not exists closed_reason text;

-- 닫힌 대화방에는 메시지를 보낼 수 없다
create or replace function public.block_closed_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.chats where id = new.chat_id and closed_at is not null) then
    raise exception '대화가 종료된 방이에요.';
  end if;
  return new;
end;
$$;
drop trigger if exists messages_block_closed on public.messages;
create trigger messages_block_closed before insert on public.messages
  for each row execute function public.block_closed_chat_message();

create or replace function public.close_chat(p_chat_id uuid, p_reason text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.chats set closed_at = now(), closed_reason = p_reason where id = p_chat_id and closed_at is null;
$$;
revoke all on function public.close_chat(uuid, text) from public, anon, authenticated;

-- 4) 대화 시작은 무료 (매칭권은 매칭 요청 때) ------------------------------------
drop function if exists public.start_post_chat(uuid, boolean);
create or replace function public.start_post_chat(p_post_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_post public.posts;
  v_chat_id uuid;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;
  select * into v_post from public.posts where id = p_post_id;
  if v_post.id is null then
    raise exception '삭제되었거나 없는 글입니다.';
  end if;
  if v_post.user_id = v_uid then
    raise exception '내 글에는 대화를 신청할 수 없어요.';
  end if;

  select id into v_chat_id
    from public.chats
   where post_id = p_post_id and is_group = false
     and ((user1_id = v_uid and user2_id = v_post.user_id) or (user1_id = v_post.user_id and user2_id = v_uid))
   order by created_at desc
   limit 1;

  if v_chat_id is null then
    insert into public.chats (user1_id, user2_id, match_status, post_id)
    values (v_uid, v_post.user_id, 'none', p_post_id)
    returning id into v_chat_id;
  end if;

  return json_build_object('chatId', v_chat_id);
end;
$$;
revoke all on function public.start_post_chat(uuid) from public, anon;
grant execute on function public.start_post_chat(uuid) to authenticated;

-- 5) 매칭 요청: 매칭권(무료 → 보너스 → 1P), 진심 요청 +2P ------------------------
drop function if exists public.request_match(uuid);
create or replace function public.request_match(p_chat_id uuid, p_priority boolean default false)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_partner uuid;
  v_match_id uuid;
  v_me public.profiles;
  v_today date := public.kst_today();
  v_free_left integer;
  v_paid_by text;
  v_cost integer := 0;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if not public.is_chat_member(p_chat_id) then
    raise exception '이 채팅방의 참여자가 아닙니다.';
  end if;
  if exists (select 1 from public.chats where id = p_chat_id and coalesce(is_group, false)) then
    raise exception '단체 채팅에서는 매칭을 요청할 수 없습니다.';
  end if;
  if exists (select 1 from public.chats where id = p_chat_id and closed_at is not null) then
    raise exception '대화가 종료된 방이에요.';
  end if;

  select user_id into v_partner from public.chat_members where chat_id = p_chat_id and user_id <> v_uid limit 1;
  if v_partner is null then
    raise exception '대화 상대가 없습니다.';
  end if;
  if exists (select 1 from public.matches where chat_id = p_chat_id and status in ('requested', 'matched')) then
    raise exception '이미 진행 중인 매칭이 있습니다.';
  end if;
  if exists (select 1 from public.matches where chat_id = p_chat_id and status = 'met') then
    raise exception '이미 만남이 성사된 대화방이에요.';
  end if;

  select * into v_me from public.profiles where user_id = v_uid for update;
  v_free_left := case when v_me.free_tickets_day = v_today then greatest(0, 3 - v_me.free_tickets_used) else 3 end;
  if v_free_left > 0 then
    v_paid_by := 'free';
  elsif v_me.bonus_tickets > 0 then
    v_paid_by := 'bonus';
  else
    v_paid_by := 'points';
    v_cost := 1;
  end if;
  if p_priority then
    v_cost := v_cost + 2;
  end if;
  if coalesce(v_me.hearts, 0) < v_cost then
    raise exception using
      errcode = 'P0402',
      message = case
        when v_paid_by = 'points' then '오늘 무료 매칭권을 다 썼어요. 신뢰 포인트 ' || v_cost || 'P가 필요해요.'
        else '진심 요청에는 신뢰 포인트 ' || v_cost || 'P가 필요해요.'
      end;
  end if;

  perform set_config('app.point_reason', case when p_priority then 'priority_request' else 'extra_request' end, true);
  update public.profiles
     set free_tickets_day = v_today,
         free_tickets_used = case
           when v_paid_by = 'free' then (case when free_tickets_day = v_today then free_tickets_used else 0 end) + 1
           when free_tickets_day = v_today then free_tickets_used
           else 0
         end,
         bonus_tickets = bonus_tickets - case when v_paid_by = 'bonus' then 1 else 0 end,
         hearts = coalesce(hearts, 0) - v_cost
   where user_id = v_uid;
  perform set_config('app.point_reason', '', true);

  insert into public.matches (chat_id, requester_id, receiver_id, is_priority)
  values (p_chat_id, v_uid, v_partner, p_priority)
  returning id into v_match_id;

  update public.chats
     set match_status = 'requested', match_requester = v_uid, is_priority = is_priority or p_priority
   where id = p_chat_id;

  return json_build_object('matchId', v_match_id, 'paidBy', v_paid_by, 'cost', v_cost, 'wallet', public.get_my_wallet());
end;
$$;
revoke all on function public.request_match(uuid, boolean) from public, anon;
grant execute on function public.request_match(uuid, boolean) to authenticated;

-- 6) 요청한 사람의 결정: 상대 실물을 보고 [매칭] / [거절] -------------------------
create or replace function public.decide_match_request(p_match_id uuid, p_proceed boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if v_match.id is null or v_match.requester_id <> auth.uid() then
    raise exception '결정할 수 있는 매칭 요청이 아닙니다.';
  end if;
  if v_match.status <> 'requested' or v_match.requester_confirmed then
    raise exception '이미 처리된 매칭 요청입니다.';
  end if;

  if p_proceed then
    update public.matches set requester_confirmed = true where id = p_match_id;
    return 'confirmed';
  end if;

  update public.matches set status = 'cancelled', ended_at = now() where id = p_match_id;
  perform public.reset_chat_match(v_match.chat_id);
  perform public.close_chat(v_match.chat_id, 'requester_rejected');
  return 'cancelled';
end;
$$;
revoke all on function public.decide_match_request(uuid, boolean) from public, anon;
grant execute on function public.decide_match_request(uuid, boolean) to authenticated;

-- 7) 받은 사람의 응답: 요청한 사람이 [매칭]을 고른 뒤에만 -------------------------
create or replace function public.respond_match(p_match_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if v_match.id is null or v_match.receiver_id <> auth.uid() then
    raise exception '응답할 수 있는 매칭 요청이 아닙니다.';
  end if;
  if v_match.status <> 'requested' then
    raise exception '이미 처리된 매칭 요청입니다.';
  end if;
  if not v_match.requester_confirmed then
    raise exception '상대가 아직 매칭을 확정하지 않았어요.';
  end if;

  if p_accept then
    update public.matches set status = 'matched', matched_at = now() where id = p_match_id;
    update public.chats set match_status = 'matched' where id = v_match.chat_id;
    return 'matched';
  end if;

  update public.matches set status = 'declined', ended_at = now() where id = p_match_id;
  perform public.reset_chat_match(v_match.chat_id);
  perform public.close_chat(v_match.chat_id, 'declined');
  return 'declined';
end;
$$;

-- 요청 대기 중 요청한 사람이 취소 = 거절과 같다 (대화방도 닫힌다)
create or replace function public.cancel_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if v_match.id is null or v_match.requester_id <> auth.uid() or v_match.status <> 'requested' then
    raise exception '취소할 수 있는 매칭 요청이 아닙니다.';
  end if;

  update public.matches set status = 'cancelled', ended_at = now() where id = p_match_id;
  perform public.reset_chat_match(v_match.chat_id);
  perform public.close_chat(v_match.chat_id, 'requester_rejected');
end;
$$;

-- 8) 매칭 중 매치 취소: 취소한 사람 신뢰 점수 -1 ------------------------------------
create or replace function public.withdraw_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches;
  v_uid uuid := auth.uid();
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if v_match.id is null or v_uid not in (v_match.requester_id, v_match.receiver_id) then
    raise exception '취소할 수 있는 매칭이 아닙니다.';
  end if;
  if v_match.status <> 'matched' then
    raise exception '매칭 중일 때만 취소할 수 있어요.';
  end if;

  update public.matches set status = 'withdrawn', ended_at = now(), withdrawn_by = v_uid where id = p_match_id;
  perform public.adjust_trust_score(v_uid, -1);
  perform public.reset_chat_match(v_match.chat_id);
end;
$$;
revoke all on function public.withdraw_match(uuid) from public, anon;
grant execute on function public.withdraw_match(uuid) to authenticated;

-- 9) 알림 문구 ------------------------------------------------------------------
create or replace function public.notify_on_chat_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
begin
  if coalesce(new.is_group, false) = false and new.user2_id is not null and new.user1_id is not null then
    select title into v_title from public.posts where id = new.post_id;
    perform public.push_notify(
      new.user2_id, 'chat', 'chat_request', '새 대화',
      public.profile_display_name(new.user1_id) || '님이 ' ||
        case when v_title is not null then '''' || left(v_title, 30) || ''' 글로 ' else '' end ||
        '대화를 시작했어요.',
      '/chat/' || new.id
    );
  end if;
  return null;
end;
$$;

create or replace function public.notify_on_match_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.push_notify(
    new.receiver_id, 'match',
    case when new.is_priority then 'priority_request' else 'match_requested' end,
    case when new.is_priority then '💜 진심 매칭 요청' else '매칭 요청' end,
    public.profile_display_name(new.requester_id) || '님이 매칭을 요청했어요. 상대가 확정하면 사진을 보고 답할 수 있어요.',
    '/chat/' || new.chat_id
  );
  return null;
end;
$$;

create or replace function public.notify_on_match_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link text := '/chat/' || new.chat_id;
  v_requester text := public.profile_display_name(new.requester_id);
  v_receiver text := public.profile_display_name(new.receiver_id);
begin
  if new.status is distinct from old.status then
    if new.status = 'matched' then
      perform public.push_notify(new.requester_id, 'match', 'match_accepted', '매칭 성사!',
        v_receiver || '님이 매칭을 수락했어요. 24시간 안에 만나고 서로 ''만났어요''를 눌러 주세요.', v_link);
    elsif new.status = 'declined' then
      perform public.push_notify(new.requester_id, 'match', 'match_declined', '매칭이 거절됐어요',
        v_receiver || '님이 매칭을 거절했어요. 대화가 종료됐어요.', v_link);
    elsif new.status = 'cancelled' then
      perform public.push_notify(new.receiver_id, 'match', 'match_cancelled', '매칭 요청이 취소됐어요',
        v_requester || '님이 매칭 요청을 취소했어요. 대화가 종료됐어요.', v_link);
    elsif new.status = 'withdrawn' then
      perform public.push_notify(
        case when new.withdrawn_by = new.requester_id then new.receiver_id else new.requester_id end,
        'match', 'match_withdrawn', '매치 취소',
        (case when new.withdrawn_by = new.requester_id then v_requester else v_receiver end) || '님이 매치를 취소했어요.',
        v_link);
    elsif new.status = 'met' then
      perform public.push_notify(new.requester_id, 'match', 'match_met', '만남 완료 · 신뢰 점수 +1',
        v_receiver || '님과의 만남은 어땠나요? 후기를 남겨 주세요.', v_link);
      perform public.push_notify(new.receiver_id, 'match', 'match_met', '만남 완료 · 신뢰 점수 +1',
        v_requester || '님과의 만남은 어땠나요? 후기를 남겨 주세요.', v_link);
    elsif new.status = 'expired' then
      if new.requester_met then
        perform public.push_notify(new.requester_id, 'match', 'match_expired', '매칭 종료',
          v_receiver || '님이 24시간 안에 만남 확인을 하지 않아 매칭이 끝났어요.', v_link);
      end if;
      if new.receiver_met then
        perform public.push_notify(new.receiver_id, 'match', 'match_expired', '매칭 종료',
          v_requester || '님이 24시간 안에 만남 확인을 하지 않아 매칭이 끝났어요.', v_link);
      end if;
    end if;
  elsif new.status = 'requested' then
    -- 요청한 사람이 상대 사진을 보고 [매칭]을 골랐다 → 이제 받은 사람이 사진을 보고 답한다
    if new.requester_confirmed and not old.requester_confirmed then
      perform public.push_notify(new.receiver_id, 'match', 'match_confirmed', '매칭 요청 도착',
        v_requester || '님이 매칭을 원해요. 사진을 확인하고 매칭 또는 거절을 골라 주세요.', v_link);
    end if;
  elsif new.status = 'matched' then
    if new.requester_met and not old.requester_met and not new.receiver_met then
      perform public.push_notify(new.receiver_id, 'match', 'meet_confirmed', '만남 확인 요청',
        v_requester || '님이 ''만났어요''를 눌렀어요. 만났다면 나도 눌러 주세요.', v_link);
    elsif new.receiver_met and not old.receiver_met and not new.requester_met then
      perform public.push_notify(new.requester_id, 'match', 'meet_confirmed', '만남 확인 요청',
        v_receiver || '님이 ''만났어요''를 눌렀어요. 만났다면 나도 눌러 주세요.', v_link);
    end if;
  end if;
  return null;
end;
$$;

-- 10) 대화방 닫힘을 실시간으로 받는다 (채팅 입력창 잠금) ---------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chats'
  ) then
    alter publication supabase_realtime add table public.chats;
  end if;
end;
$$;
