-- 매칭이 끝나면 대화방도 닫는다
-- · 매칭 중(matched)이던 매칭이 끝나면(만남 성사·매치 취소·못 만났어요·24시간 만료) 더 이상 메시지를 보낼 수 없다.
-- · 요청 단계에서 끝난 경우(거절·요청 취소)는 각 함수가 이미 방을 닫는다.
-- · 닫힌 사유(closed_reason)는 매칭 상태 값(met/withdrawn/reported/expired)을 그대로 쓴다.

create or replace function public.close_chat_on_match_end()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'matched' and new.status in ('met', 'withdrawn', 'reported', 'expired', 'cancelled') then
    perform public.close_chat(new.chat_id, new.status);
  end if;
  return new;
end;
$$;
revoke all on function public.close_chat_on_match_end() from public, anon, authenticated;

drop trigger if exists matches_close_chat_on_end on public.matches;
create trigger matches_close_chat_on_end after update of status on public.matches
  for each row execute function public.close_chat_on_match_end();


-- 매치 취소 사유 ------------------------------------------------------------------
-- · 취소할 때 사유를 고르고, 그 사유는 대화방 맨 아래 시스템 메시지로 남는다.
-- · 시스템 메시지(kind = 'system')는 서버 함수만 쓴다. 보낸 사람(user_id)은 취소한 사람이다.
alter table public.matches add column if not exists withdraw_reason text;
alter table public.messages add column if not exists kind text not null default 'text';
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check check (kind in ('text', 'system'));

drop policy if exists "messages insert member" on public.messages;
create policy "messages insert member" on public.messages for insert
  with check (user_id = auth.uid() and public.is_chat_member(chat_id) and kind = 'text');

-- 시스템 메시지는 푸시를 따로 보내지 않는다(매치 취소 알림이 이미 간다)
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
  if new.kind = 'system' then
    return null;
  end if;

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

drop function if exists public.withdraw_match(uuid);
create or replace function public.withdraw_match(p_match_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches;
  v_uid uuid := auth.uid();
  v_reason text := left(trim(coalesce(p_reason, '')), 100);
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if v_match.id is null or v_uid not in (v_match.requester_id, v_match.receiver_id) then
    raise exception '취소할 수 있는 매칭이 아닙니다.';
  end if;
  if v_match.status <> 'matched' then
    raise exception '매칭 중일 때만 취소할 수 있어요.';
  end if;
  if v_reason = '' then
    raise exception '취소 사유를 골라 주세요.';
  end if;

  -- 방이 닫히기 전에 사유를 시스템 메시지로 남긴다
  insert into public.messages (chat_id, user_id, user_name, message, kind)
  values (v_match.chat_id, v_uid, public.profile_display_name(v_uid), v_reason, 'system');

  update public.matches
     set status = 'withdrawn', ended_at = now(), withdrawn_by = v_uid, withdraw_reason = v_reason
   where id = p_match_id;
  perform public.adjust_trust_score(v_uid, -1);
  perform public.reset_chat_match(v_match.chat_id);
end;
$$;
revoke all on function public.withdraw_match(uuid, text) from public, anon;
grant execute on function public.withdraw_match(uuid, text) to authenticated;
comment on function public.withdraw_match(uuid, text) is '매칭 중 매치 취소: 사유를 시스템 메시지로 남기고, 취소한 사람 신뢰 점수 -1, 대화방도 닫힌다(트리거)';
