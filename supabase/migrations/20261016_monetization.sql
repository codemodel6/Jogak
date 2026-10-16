-- 수익 구조: 무료 매칭권(하루 3장) + 신뢰 포인트(1P = 1,000원) 유료 기능
-- · 대화 신청 = 매칭 글에 처음 말 걸기. 글마다 채팅방이 따로 생긴다(chats.post_id).
--   무료 매칭권(오늘 남은 것) → 보너스 매칭권 → 1P 순서로 쓴다. 이미 있는 방으로 다시 들어가는 건 무료.
-- · 진심 요청(+2P): 상대 채팅 목록 맨 위에 강조. 받는 쪽·수락하는 쪽은 항상 무료.
-- · 글 상단 노출(2P): 1시간 동안 실시간 매칭 카드·매칭 목록 맨 앞.
-- · 출석: 7일 연속 출석마다 보너스 매칭권 1장(포인트가 아니다).
-- · 좋은 후기(별 4개 이상)를 받으면 신뢰 점수 +1.
-- · 포인트·신뢰 점수는 서버 함수로만 바뀌게 컬럼 쓰기 권한을 막는다.

-- 1) 컬럼 ------------------------------------------------------------------
alter table public.profiles add column if not exists free_tickets_day date;
alter table public.profiles add column if not exists free_tickets_used integer not null default 0;
alter table public.profiles add column if not exists bonus_tickets integer not null default 0;
alter table public.profiles add column if not exists attendance_streak integer not null default 0;
alter table public.profiles add column if not exists last_attended_on date;

alter table public.chats add column if not exists post_id uuid references public.posts (id) on delete set null;
alter table public.chats add column if not exists is_priority boolean not null default false;
create index if not exists chats_post_id_idx on public.chats (post_id);

alter table public.posts add column if not exists boosted_until timestamptz;
create index if not exists posts_boosted_until_idx on public.posts (boosted_until);

-- 2) 쓰기 권한: 포인트·신뢰 점수·매칭권은 클라이언트가 못 바꾼다 ----------------
revoke insert, update on public.profiles from authenticated, anon;
grant insert (user_id, name, height, age, location, photos, gender, mbti, purpose, photos_private, onboarded_at, introduction)
  on public.profiles to authenticated;
grant update (user_id, name, height, age, location, photos, gender, mbti, purpose, photos_private, onboarded_at, introduction)
  on public.profiles to authenticated;

revoke update on public.posts from authenticated, anon;
grant update (title, content, tags, cover_url, user_name) on public.posts to authenticated;

-- 1:1 방은 start_post_chat()으로만 만든다 (매칭권 차감을 건너뛰지 못하게)
drop policy if exists "chats insert direct" on public.chats;
revoke insert on public.chats from authenticated, anon;

-- 3) 포인트 이용 내역 --------------------------------------------------------
create table if not exists public.point_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  delta integer not null,
  balance integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create index if not exists point_transactions_user_idx on public.point_transactions (user_id, created_at desc);

alter table public.point_transactions enable row level security;
drop policy if exists "point_transactions_select_own" on public.point_transactions;
create policy "point_transactions_select_own" on public.point_transactions
  for select to authenticated using (user_id = auth.uid());

-- 포인트가 바뀔 때마다 자동 기록. 사유는 함수가 app.point_reason에 적어 둔다.
create or replace function public.log_point_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := nullif(current_setting('app.point_reason', true), '');
begin
  if coalesce(new.hearts, 0) = coalesce(old.hearts, 0) then
    return null;
  end if;
  if v_reason is null then
    v_reason := case
      when new.trust_score > old.trust_score and new.hearts < old.hearts then 'trust_recover'
      when new.hearts > old.hearts then 'charge'
      else 'use'
    end;
  end if;
  insert into public.point_transactions (user_id, delta, balance, reason)
  values (new.user_id, coalesce(new.hearts, 0) - coalesce(old.hearts, 0), coalesce(new.hearts, 0), v_reason);
  return null;
end;
$$;
drop trigger if exists profiles_log_points on public.profiles;
create trigger profiles_log_points after update of hearts on public.profiles
  for each row execute function public.log_point_change();
revoke all on function public.log_point_change() from public, anon, authenticated;

-- 4) 지갑 조회 ----------------------------------------------------------------
create or replace function public.kst_today()
returns date
language sql
stable
as $$ select (now() at time zone 'Asia/Seoul')::date $$;

create or replace function public.get_my_wallet()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v public.profiles;
  v_today date := public.kst_today();
begin
  select * into v from public.profiles where user_id = auth.uid();
  if v.user_id is null then
    raise exception '프로필을 찾을 수 없습니다.';
  end if;

  return json_build_object(
    'points', coalesce(v.hearts, 0),
    'freeLeft', case when v.free_tickets_day = v_today then greatest(0, 3 - v.free_tickets_used) else 3 end,
    'freeTotal', 3,
    'bonusTickets', v.bonus_tickets,
    'streak', case when v.last_attended_on >= v_today - 1 then v.attendance_streak else 0 end,
    'attendedToday', v.last_attended_on = v_today,
    -- 무료 매칭권이 다시 채워지는 시각(한국 시간 자정)
    'resetsAt', ((v_today + 1)::timestamp at time zone 'Asia/Seoul')
  );
end;
$$;

-- 5) 출석 체크 (앱에 들어올 때 하루 한 번) -------------------------------------
create or replace function public.check_in()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.profiles;
  v_today date := public.kst_today();
  v_streak integer;
  v_bonus boolean := false;
begin
  select * into v from public.profiles where user_id = auth.uid() for update;
  if v.user_id is null then
    raise exception '프로필을 찾을 수 없습니다.';
  end if;

  if v.last_attended_on is distinct from v_today then
    v_streak := case when v.last_attended_on = v_today - 1 then v.attendance_streak + 1 else 1 end;
    v_bonus := v_streak % 7 = 0;

    update public.profiles
       set attendance_streak = v_streak,
           last_attended_on = v_today,
           bonus_tickets = bonus_tickets + case when v_bonus then 1 else 0 end
     where user_id = v.user_id;

    if v_bonus then
      perform public.push_notify(v.user_id, 'event', 'attendance_bonus', '연속 출석 보상',
        v_streak || '일 연속 출석! 보너스 매칭권 1장을 드렸어요.', '/matching');
    end if;
  end if;

  return json_build_object('bonusGranted', v_bonus, 'wallet', public.get_my_wallet());
end;
$$;

-- 6) 대화 신청 (매칭 글에 말 걸기) ---------------------------------------------
create or replace function public.start_post_chat(p_post_id uuid, p_priority boolean default false)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_post public.posts;
  v_me public.profiles;
  v_today date := public.kst_today();
  v_free_left integer;
  v_paid_by text;
  v_cost integer := 0;
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

  -- 이 글로 이미 대화 중이면 그 방으로 (차감 없음)
  select id into v_chat_id
    from public.chats
   where post_id = p_post_id and is_group = false
     and ((user1_id = v_uid and user2_id = v_post.user_id) or (user1_id = v_post.user_id and user2_id = v_uid))
   order by created_at desc
   limit 1;
  if v_chat_id is not null then
    return json_build_object('chatId', v_chat_id, 'paidBy', 'existing', 'wallet', public.get_my_wallet());
  end if;

  select * into v_me from public.profiles where user_id = v_uid for update;
  if v_me.user_id is null then
    raise exception '프로필을 먼저 완성해 주세요.';
  end if;

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

  insert into public.chats (user1_id, user2_id, match_status, post_id, is_priority)
  values (v_uid, v_post.user_id, 'none', p_post_id, p_priority)
  returning id into v_chat_id;

  return json_build_object('chatId', v_chat_id, 'paidBy', v_paid_by, 'cost', v_cost, 'wallet', public.get_my_wallet());
end;
$$;

-- 7) 글 상단 노출 (2P, 1시간. 노출 중이면 1시간 연장) ----------------------------
create or replace function public.boost_post(p_post_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_post public.posts;
  v_points integer;
  v_until timestamptz;
begin
  select * into v_post from public.posts where id = p_post_id for update;
  if v_post.id is null or v_post.user_id <> v_uid then
    raise exception '내 글만 상단에 올릴 수 있어요.';
  end if;

  select coalesce(hearts, 0) into v_points from public.profiles where user_id = v_uid for update;
  if v_points < 2 then
    raise exception using errcode = 'P0402', message = '상단 노출에는 신뢰 포인트 2P가 필요해요.';
  end if;

  perform set_config('app.point_reason', 'post_boost', true);
  update public.profiles set hearts = hearts - 2 where user_id = v_uid;
  perform set_config('app.point_reason', '', true);

  v_until := greatest(now(), coalesce(v_post.boosted_until, now())) + interval '1 hour';
  update public.posts set boosted_until = v_until where id = p_post_id;

  return json_build_object('boostedUntil', v_until, 'wallet', public.get_my_wallet());
end;
$$;

-- 8) 좋은 후기를 받으면 신뢰 점수 +1 ----------------------------------------------
create or replace function public.reward_good_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.rating >= 4 then
    perform public.adjust_trust_score(new.reviewee_id, 1);
  end if;
  return null;
end;
$$;
drop trigger if exists reviews_reward on public.reviews;
create trigger reviews_reward after insert on public.reviews
  for each row execute function public.reward_good_review();
revoke all on function public.reward_good_review() from public, anon, authenticated;

-- 9) 권한 -----------------------------------------------------------------------
revoke all on function public.get_my_wallet() from public, anon;
revoke all on function public.check_in() from public, anon;
revoke all on function public.start_post_chat(uuid, boolean) from public, anon;
revoke all on function public.boost_post(uuid) from public, anon;
grant execute on function public.get_my_wallet() to authenticated;
grant execute on function public.check_in() to authenticated;
grant execute on function public.start_post_chat(uuid, boolean) to authenticated;
grant execute on function public.boost_post(uuid) to authenticated;

-- 10) 대화 신청 알림: 어느 글에 온 신청인지, 진심 요청인지 함께 알린다 ------------
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
      new.user2_id, 'chat',
      case when new.is_priority then 'priority_request' else 'chat_request' end,
      case when new.is_priority then '💜 진심 요청이 왔어요' else '새 대화 신청' end,
      public.profile_display_name(new.user1_id) || '님이 ' ||
        case when v_title is not null then '''' || left(v_title, 30) || ''' 글에 ' else '' end ||
        '대화를 신청했어요.',
      '/chat/' || new.id
    );
  end if;
  return null;
end;
$$;
