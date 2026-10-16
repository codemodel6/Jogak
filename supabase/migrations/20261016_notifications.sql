-- 알림: 앱 안 알림 목록 + 휴대폰·PC 알림창(웹 푸시)
-- 흐름: 이벤트 발생(트리거) → push_notify() → notifications 저장 + Edge Function(send-push) 호출 → 기기 알림창
-- 푸시 발송 비밀값은 Vault의 'push_webhook_secret', Edge Function 쪽은 PUSH_WEBHOOK_SECRET 환경변수로 같은 값을 쓴다.

create extension if not exists pg_net;

-- 1) 알림 목록 (종 아이콘)
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in ('match', 'chat', 'event')),
  type text not null,
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- 2) 기기별 푸시 구독 (브라우저·홈 화면 앱마다 1개)
create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists "push_subscriptions_own" on public.push_subscriptions;
create policy "push_subscriptions_own" on public.push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 같은 기기를 다른 계정으로 다시 구독하면 주인을 바꾼다 (endpoint는 기기마다 하나)
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, p_user_agent)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
end;
$$;

-- 3) 알림 설정 (설정 화면 스위치). 행이 없으면 모두 켜짐으로 본다.
create table if not exists public.notification_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  match boolean not null default true,
  chat boolean not null default true,
  event boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;
drop policy if exists "notification_settings_own" on public.notification_settings;
create policy "notification_settings_own" on public.notification_settings
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 4) 알림 만들기: 목록 저장(p_store) + 설정이 켜져 있고 구독한 기기가 있으면 푸시 요청
-- 알림이 실패해도 원래 동작(메시지 전송·매칭 등)은 막지 않는다.
create or replace function public.push_notify(
  p_user_id uuid,
  p_category text,
  p_type text,
  p_title text,
  p_body text,
  p_link text,
  p_store boolean default true,
  p_tag text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
  v_secret text;
  v_unread integer;
begin
  if p_user_id is null then
    return;
  end if;

  if p_store then
    insert into public.notifications (user_id, category, type, title, body, link)
    values (p_user_id, p_category, p_type, p_title, coalesce(p_body, ''), p_link);
  end if;

  begin
    select case p_category when 'match' then s.match when 'chat' then s.chat else s.event end
      into v_enabled
      from public.notification_settings s
     where s.user_id = p_user_id;

    if coalesce(v_enabled, true)
       and exists (select 1 from public.push_subscriptions where user_id = p_user_id) then
      select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_webhook_secret' limit 1;
      select count(*) into v_unread from public.notifications where user_id = p_user_id and read_at is null;

      perform net.http_post(
        url := 'https://qfjtdeglkpsvzklwstpm.supabase.co/functions/v1/send-push',
        body := jsonb_build_object(
          'userId', p_user_id,
          'title', p_title,
          'body', coalesce(p_body, ''),
          'link', coalesce(p_link, '/home'),
          'tag', coalesce(p_tag, p_type),
          'badge', v_unread
        ),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', coalesce(v_secret, '')),
        timeout_milliseconds := 5000
      );
    end if;
  exception when others then
    raise warning 'push_notify 실패: %', sqlerrm;
  end;
end;
$$;

revoke all on function public.push_notify(uuid, text, text, text, text, text, boolean, text) from public, anon, authenticated;
revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

create or replace function public.profile_display_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(trim((select name from public.profiles where user_id = p_user_id)), ''), '상대');
$$;

-- 5) 이벤트별 트리거 --------------------------------------------------------

-- 새 메시지 → 같은 방 사람들 (목록에는 저장하지 않음: 채팅 목록의 안 읽은 표시가 그 역할)
create or replace function public.notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chat public.chats;
  v_sender text;
  v_member uuid;
begin
  select * into v_chat from public.chats where id = new.chat_id;
  v_sender := coalesce(nullif(trim(new.user_name), ''), public.profile_display_name(new.user_id));

  for v_member in
    select user_id from public.chat_members where chat_id = new.chat_id and user_id <> new.user_id
  loop
    perform public.push_notify(
      v_member, 'chat', 'message',
      case when v_chat.is_group then coalesce(nullif(v_chat.title, ''), '단체 채팅') else v_sender end,
      case when v_chat.is_group then v_sender || ': ' || left(new.message, 80) else left(new.message, 100) end,
      '/chat/' || new.chat_id, false, 'chat-' || new.chat_id
    );
  end loop;
  return null;
end;
$$;
drop trigger if exists messages_notify on public.messages;
create trigger messages_notify after insert on public.messages
  for each row execute function public.notify_on_message();

-- 1:1 대화 시작 → 상대
create or replace function public.notify_on_chat_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.is_group, false) = false and new.user2_id is not null and new.user1_id is not null then
    perform public.push_notify(
      new.user2_id, 'chat', 'chat_request', '새 대화 요청',
      public.profile_display_name(new.user1_id) || '님이 대화를 시작했어요.',
      '/chat/' || new.id
    );
  end if;
  return null;
end;
$$;
drop trigger if exists chats_notify on public.chats;
create trigger chats_notify after insert on public.chats
  for each row execute function public.notify_on_chat_created();

-- 매칭 요청 → 받는 사람
create or replace function public.notify_on_match_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.push_notify(
    new.receiver_id, 'match', 'match_requested', '매칭 요청',
    public.profile_display_name(new.requester_id) || '님이 만남을 요청했어요. 수락하면 매칭이 시작돼요.',
    '/chat/' || new.chat_id
  );
  return null;
end;
$$;
drop trigger if exists matches_notify_insert on public.matches;
create trigger matches_notify_insert after insert on public.matches
  for each row execute function public.notify_on_match_created();

-- 매칭 상태 변화 → 상대 (수락·거절·취소·만남 완료·기한 종료, 한쪽 '만났어요')
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
      perform public.push_notify(new.requester_id, 'match', 'match_declined', '매칭 거절',
        v_receiver || '님이 이번 매칭 요청을 거절했어요.', v_link);
    elsif new.status = 'cancelled' then
      perform public.push_notify(new.receiver_id, 'match', 'match_cancelled', '매칭 요청 취소',
        v_requester || '님이 매칭 요청을 취소했어요.', v_link);
    elsif new.status = 'met' then
      perform public.push_notify(new.requester_id, 'match', 'match_met', '만남 완료 · 신뢰 점수 +1',
        v_receiver || '님과의 만남은 어땠나요? 후기를 남겨 주세요.', v_link);
      perform public.push_notify(new.receiver_id, 'match', 'match_met', '만남 완료 · 신뢰 점수 +1',
        v_requester || '님과의 만남은 어땠나요? 후기를 남겨 주세요.', v_link);
    elsif new.status = 'expired' then
      -- 확인하지 않은 쪽은 감점 알림(trust_penalties)으로 따로 받는다
      if new.requester_met then
        perform public.push_notify(new.requester_id, 'match', 'match_expired', '매칭 종료',
          v_receiver || '님이 24시간 안에 만남 확인을 하지 않아 매칭이 끝났어요.', v_link);
      end if;
      if new.receiver_met then
        perform public.push_notify(new.receiver_id, 'match', 'match_expired', '매칭 종료',
          v_requester || '님이 24시간 안에 만남 확인을 하지 않아 매칭이 끝났어요.', v_link);
      end if;
    end if;
  elsif new.status = 'matched' then
    -- 한쪽만 '만났어요'를 눌렀을 때 아직 안 누른 상대에게
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
drop trigger if exists matches_notify_update on public.matches;
create trigger matches_notify_update after update on public.matches
  for each row execute function public.notify_on_match_updated();

-- 감점: 신고 접수 / 이의로 취소 / 적용
create or replace function public.notify_on_penalty()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link text := '/chat/' || new.chat_id;
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      perform public.push_notify(new.user_id, 'match', 'penalty_reported', '못 만났어요 신고',
        public.profile_display_name(new.reporter_id) || '님이 ''못 만났어요''를 눌렀어요. 1시간 안에 조치하지 않으면 신뢰 점수가 1점 깎여요.',
        v_link);
    elsif new.status = 'applied' then
      perform public.push_notify(new.user_id, 'match', 'penalty_applied', '신뢰 점수 -1',
        '24시간 안에 만남 확인을 하지 않아 신뢰 점수가 1점 깎였어요.', v_link);
    end if;
  elsif new.status is distinct from old.status then
    if new.status = 'cancelled' and new.reporter_id is not null then
      perform public.push_notify(new.reporter_id, 'match', 'penalty_cancelled', '감점 취소',
        public.profile_display_name(new.user_id) || '님이 이의를 제기해 감점이 취소됐어요.', v_link);
    elsif new.status = 'applied' then
      perform public.push_notify(new.user_id, 'match', 'penalty_applied', '신뢰 점수 -1',
        '1시간 안에 조치하지 않아 신뢰 점수가 1점 깎였어요.', v_link);
    end if;
  end if;
  return null;
end;
$$;
drop trigger if exists trust_penalties_notify on public.trust_penalties;
create trigger trust_penalties_notify after insert or update on public.trust_penalties
  for each row execute function public.notify_on_penalty();

-- 위치 공유 시작(처음 저장될 때만) → 매칭 상대
create or replace function public.notify_on_location_shared()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner uuid;
begin
  select case when requester_id = new.user_id then receiver_id else requester_id end
    into v_partner
    from public.matches
   where chat_id = new.chat_id and status = 'matched' and new.user_id in (requester_id, receiver_id)
   order by requested_at desc
   limit 1;

  if v_partner is not null then
    perform public.push_notify(v_partner, 'match', 'location_shared', '위치 공유 시작',
      public.profile_display_name(new.user_id) || '님이 실시간 위치 공유를 시작했어요.', '/chat/' || new.chat_id);
  end if;
  return null;
end;
$$;
drop trigger if exists locations_notify on public.locations;
create trigger locations_notify after insert on public.locations
  for each row execute function public.notify_on_location_shared();

-- 후기 받음 → 후기 대상
create or replace function public.notify_on_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.push_notify(new.reviewee_id, 'match', 'review_received', '새 후기',
    public.profile_display_name(new.reviewer_id) || '님이 후기를 남겼어요. ★' || new.rating,
    '/reviews');
  return null;
end;
$$;
drop trigger if exists reviews_notify on public.reviews;
create trigger reviews_notify after insert on public.reviews
  for each row execute function public.notify_on_review();

-- 내 게시글에 댓글 → 글쓴이 (설정의 '활동·이벤트 알림')
create or replace function public.notify_on_board_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
begin
  select author_id into v_author from public.board_posts where id = new.post_id;
  if v_author is not null and v_author <> new.author_id then
    perform public.push_notify(v_author, 'event', 'board_comment', '내 글에 새 댓글',
      public.profile_display_name(new.author_id) || ': ' || left(new.content, 80),
      '/notices/' || new.post_id);
  end if;
  return null;
end;
$$;
drop trigger if exists board_comments_notify on public.board_comments;
create trigger board_comments_notify after insert on public.board_comments
  for each row execute function public.notify_on_board_comment();

-- 트리거 함수는 직접 호출하지 못하게 막는다
revoke all on function public.notify_on_message() from public, anon, authenticated;
revoke all on function public.notify_on_chat_created() from public, anon, authenticated;
revoke all on function public.notify_on_match_created() from public, anon, authenticated;
revoke all on function public.notify_on_match_updated() from public, anon, authenticated;
revoke all on function public.notify_on_penalty() from public, anon, authenticated;
revoke all on function public.notify_on_location_shared() from public, anon, authenticated;
revoke all on function public.notify_on_review() from public, anon, authenticated;
revoke all on function public.notify_on_board_comment() from public, anon, authenticated;

-- 6) 종 아이콘 숫자가 바로 바뀌도록 실시간 전송
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
