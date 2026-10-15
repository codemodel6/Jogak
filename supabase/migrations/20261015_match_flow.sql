-- 매칭 흐름: 요청 → 수락 → (실시간 위치 공유) → 만났어요(+1) / 시간 초과·노쇼 신고(-1)
--
-- 규칙
--  1) 1:1 채팅방에서 한 사람이 매칭을 요청하고, 상대가 수락하면 매칭된다. (방마다 진행 중인 매칭은 1개)
--  2) 매칭 중에는 두 사람이 서로의 위치를 실시간으로 본다. (위치 공유에 하트를 쓰지 않는다)
--  3) 두 사람 모두 "만났어요"를 누르면 매칭이 끝나고 둘 다 신뢰 점수 +1.
--  4) 매칭 수락 후 24시간 안에 "만났어요"를 누르지 않은 사람은 신뢰 점수 -1 (바로 차감).
--  5) "못 만났어요" 신고를 받으면 바로 깎지 않고 1시간 유예한다.
--     신고당한 사람이 1시간 안에 "만났어요" 또는 "이의 제기"를 누르면 취소, 아무것도 안 하면 -1.
--  6) 점수·매칭 상태는 화면에서 직접 바꾸지 못하고 아래 DB 함수로만 바꾼다.

-- ───────── 테이블 ─────────
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  -- requested: 수락 대기 / matched: 매칭 중 / met: 만남 완료 / declined: 거절 / cancelled: 요청 취소
  -- expired: 24시간 초과 / reported: 노쇼 신고로 종료
  status text not null default 'requested'
    check (status in ('requested', 'matched', 'met', 'declined', 'cancelled', 'expired', 'reported')),
  requested_at timestamptz not null default now(),
  matched_at timestamptz,
  ended_at timestamptz,
  requester_met boolean not null default false,
  receiver_met boolean not null default false
);
create unique index if not exists matches_one_active_per_chat
  on public.matches (chat_id) where status in ('requested', 'matched');
create index if not exists matches_status_matched_at_idx on public.matches (status, matched_at);

create table if not exists public.trust_penalties (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,      -- 깎이는 사람
  reporter_id uuid references auth.users(id) on delete set null,           -- 신고한 사람 (시간 초과는 null)
  reason text not null check (reason in ('no_show_report', 'no_confirm_timeout')),
  status text not null default 'pending' check (status in ('pending', 'applied', 'cancelled')),
  created_at timestamptz not null default now(),
  due_at timestamptz not null,
  resolved_at timestamptz
);
create index if not exists trust_penalties_pending_idx on public.trust_penalties (status, due_at);

alter table public.locations add column if not exists updated_at timestamptz not null default now();

alter table public.matches enable row level security;
alter table public.trust_penalties enable row level security;

drop policy if exists "matches select own" on public.matches;
create policy "matches select own" on public.matches for select to authenticated
  using (requester_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "trust_penalties select own" on public.trust_penalties;
create policy "trust_penalties select own" on public.trust_penalties for select to authenticated
  using (user_id = auth.uid() or reporter_id = auth.uid());

-- 매칭 상태는 함수로만 바꾼다 (예전처럼 화면에서 chats 를 직접 고치지 못하게)
revoke insert, update, delete on public.matches from authenticated, anon;
revoke insert, update, delete on public.trust_penalties from authenticated, anon;
revoke update on public.chats from authenticated, anon;

-- ───────── 내부 함수 ─────────
-- 신뢰 점수 증감 (0~100 안에서)
create or replace function public.adjust_trust_score(p_user_id uuid, p_delta integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set trust_score = least(100, greatest(0, trust_score + p_delta))
   where user_id = p_user_id;
$$;
revoke all on function public.adjust_trust_score(uuid, integer) from public, anon, authenticated;

-- 매칭이 끝나면 채팅방 상태를 되돌리고 공유하던 위치를 지운다
create or replace function public.reset_chat_match(p_chat_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.chats
     set match_status = 'none', match_requester = null,
         meet_success_user1 = false, meet_success_user2 = false
   where id = p_chat_id;
  delete from public.locations where chat_id = p_chat_id;
$$;
revoke all on function public.reset_chat_match(uuid) from public, anon, authenticated;

-- ───────── 화면에서 부르는 함수 ─────────
create or replace function public.request_match(p_chat_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_partner uuid;
  v_match_id uuid;
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

  select user_id into v_partner
    from public.chat_members
   where chat_id = p_chat_id and user_id <> v_uid
   limit 1;
  if v_partner is null then
    raise exception '대화 상대가 없습니다.';
  end if;

  if exists (select 1 from public.matches where chat_id = p_chat_id and status in ('requested', 'matched')) then
    raise exception '이미 진행 중인 매칭이 있습니다.';
  end if;

  insert into public.matches (chat_id, requester_id, receiver_id)
  values (p_chat_id, v_uid, v_partner)
  returning id into v_match_id;

  update public.chats set match_status = 'requested', match_requester = v_uid where id = p_chat_id;
  return v_match_id;
end;
$$;

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

  if p_accept then
    update public.matches set status = 'matched', matched_at = now() where id = p_match_id;
    update public.chats set match_status = 'matched' where id = v_match.chat_id;
    return 'matched';
  end if;

  update public.matches set status = 'declined', ended_at = now() where id = p_match_id;
  perform public.reset_chat_match(v_match.chat_id);
  return 'declined';
end;
$$;

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
end;
$$;

-- 만났어요: 두 사람 모두 누르면 매칭 종료 + 둘 다 +1
create or replace function public.confirm_meet(p_match_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_match public.matches;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if v_match.id is null or v_uid not in (v_match.requester_id, v_match.receiver_id) then
    raise exception '참여한 매칭이 아닙니다.';
  end if;
  if v_match.status <> 'matched' then
    raise exception '진행 중인 매칭이 아닙니다.';
  end if;

  if v_uid = v_match.requester_id then
    update public.matches set requester_met = true where id = p_match_id returning * into v_match;
    update public.chats set meet_success_user1 = true where id = v_match.chat_id and user1_id = v_uid;
    update public.chats set meet_success_user2 = true where id = v_match.chat_id and user2_id = v_uid;
  else
    update public.matches set receiver_met = true where id = p_match_id returning * into v_match;
    update public.chats set meet_success_user1 = true where id = v_match.chat_id and user1_id = v_uid;
    update public.chats set meet_success_user2 = true where id = v_match.chat_id and user2_id = v_uid;
  end if;

  if v_match.requester_met and v_match.receiver_met then
    update public.matches set status = 'met', ended_at = now() where id = p_match_id;
    perform public.adjust_trust_score(v_match.requester_id, 1);
    perform public.adjust_trust_score(v_match.receiver_id, 1);
    perform public.reset_chat_match(v_match.chat_id);
    return 'met';
  end if;

  return 'waiting';
end;
$$;

-- 못 만났어요: 매칭을 끝내고, 상대에게 1시간 뒤 -1 예정 알림을 건다
create or replace function public.report_no_show(p_match_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_match public.matches;
  v_target uuid;
  v_penalty_id uuid;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if v_match.id is null or v_uid not in (v_match.requester_id, v_match.receiver_id) then
    raise exception '참여한 매칭이 아닙니다.';
  end if;
  if v_match.status <> 'matched' then
    raise exception '진행 중인 매칭이 아닙니다.';
  end if;

  v_target := case when v_uid = v_match.requester_id then v_match.receiver_id else v_match.requester_id end;

  update public.matches set status = 'reported', ended_at = now() where id = p_match_id;
  insert into public.trust_penalties (match_id, chat_id, user_id, reporter_id, reason, due_at)
  values (p_match_id, v_match.chat_id, v_target, v_uid, 'no_show_report', now() + interval '1 hour')
  returning id into v_penalty_id;
  perform public.reset_chat_match(v_match.chat_id);

  return v_penalty_id;
end;
$$;

-- 감점 예정에 대한 조치("만났어요"·"이의 제기"): 1시간 안에 누르면 취소
create or replace function public.contest_penalty(p_penalty_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_penalty public.trust_penalties;
begin
  select * into v_penalty from public.trust_penalties where id = p_penalty_id for update;
  if v_penalty.id is null or v_penalty.user_id <> auth.uid() then
    raise exception '조치할 수 있는 감점이 아닙니다.';
  end if;
  if v_penalty.status <> 'pending' or v_penalty.due_at <= now() then
    raise exception '이미 처리된 감점입니다.';
  end if;

  update public.trust_penalties set status = 'cancelled', resolved_at = now() where id = p_penalty_id;
end;
$$;

-- 매칭 중 실시간 위치 갱신 (하트 차감 없음)
create or replace function public.update_live_location(p_chat_id uuid, p_lat double precision, p_lng double precision)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.matches
     where chat_id = p_chat_id and status = 'matched'
       and auth.uid() in (requester_id, receiver_id)
  ) then
    raise exception '매칭 중일 때만 위치를 공유할 수 있습니다.';
  end if;

  insert into public.locations (chat_id, user_id, lat, lng, updated_at)
  values (p_chat_id, auth.uid(), p_lat, p_lng, now())
  on conflict (chat_id, user_id) do update
    set lat = excluded.lat, lng = excluded.lng, updated_at = excluded.updated_at;
end;
$$;

-- 기한 처리: 유예 1시간이 지난 신고 감점 적용 + 24시간 지난 매칭 종료·감점
-- 1분마다 예약 작업으로 돌고, 화면에서도 채팅을 열 때 한 번씩 부른다 (중복 실행돼도 결과는 같다)
create or replace function public.process_match_deadlines()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_penalty public.trust_penalties;
  v_match public.matches;
begin
  for v_penalty in
    select * from public.trust_penalties
     where status = 'pending' and due_at <= now()
     for update skip locked
  loop
    update public.trust_penalties set status = 'applied', resolved_at = now() where id = v_penalty.id;
    perform public.adjust_trust_score(v_penalty.user_id, -1);
  end loop;

  for v_match in
    select * from public.matches
     where status = 'matched' and matched_at <= now() - interval '24 hours'
     for update skip locked
  loop
    update public.matches set status = 'expired', ended_at = now() where id = v_match.id;

    if not v_match.requester_met then
      insert into public.trust_penalties (match_id, chat_id, user_id, reason, status, due_at, resolved_at)
      values (v_match.id, v_match.chat_id, v_match.requester_id, 'no_confirm_timeout', 'applied', now(), now());
      perform public.adjust_trust_score(v_match.requester_id, -1);
    end if;
    if not v_match.receiver_met then
      insert into public.trust_penalties (match_id, chat_id, user_id, reason, status, due_at, resolved_at)
      values (v_match.id, v_match.chat_id, v_match.receiver_id, 'no_confirm_timeout', 'applied', now(), now());
      perform public.adjust_trust_score(v_match.receiver_id, -1);
    end if;

    perform public.reset_chat_match(v_match.chat_id);
  end loop;
end;
$$;

revoke all on function public.request_match(uuid) from public, anon;
revoke all on function public.respond_match(uuid, boolean) from public, anon;
revoke all on function public.cancel_match(uuid) from public, anon;
revoke all on function public.confirm_meet(uuid) from public, anon;
revoke all on function public.report_no_show(uuid) from public, anon;
revoke all on function public.contest_penalty(uuid) from public, anon;
revoke all on function public.update_live_location(uuid, double precision, double precision) from public, anon;
revoke all on function public.process_match_deadlines() from public, anon;
grant execute on function public.request_match(uuid) to authenticated;
grant execute on function public.respond_match(uuid, boolean) to authenticated;
grant execute on function public.cancel_match(uuid) to authenticated;
grant execute on function public.confirm_meet(uuid) to authenticated;
grant execute on function public.report_no_show(uuid) to authenticated;
grant execute on function public.contest_penalty(uuid) to authenticated;
grant execute on function public.update_live_location(uuid, double precision, double precision) to authenticated;
grant execute on function public.process_match_deadlines() to authenticated;

-- 매칭 통계는 이제 matches 기준으로 센다 (수락된 매칭 = 매칭 성공)
create or replace function public.get_match_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'today_matched', count(*) filter (
      where matched_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')
    ),
    'total_matched', count(*)
  )
  from public.matches
  where matched_at is not null;
$$;

-- ───────── 실시간 전송 ─────────
do $$
declare
  v_table text;
begin
  foreach v_table in array array['matches', 'trust_penalties', 'locations'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end;
$$;

-- ───────── 1분마다 기한 처리 ─────────
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'process-match-deadlines') then
    perform cron.unschedule('process-match-deadlines');
  end if;
  perform cron.schedule('process-match-deadlines', '* * * * *', 'select public.process_match_deadlines()');
end;
$$;
