-- 매칭 통계: 오늘·누적 매칭 성공 건수 (매칭 화면의 통계 칸)

-- 매칭이 성사된 시각. 오늘 건수를 가르는 기준이다.
alter table public.chats
  add column if not exists matched_at timestamptz;

-- match_status 가 matched 로 바뀌는 순간 시각을 서버에서 기록한다 (화면에서 값을 넣지 않는다)
create or replace function public.set_chat_matched_at()
returns trigger
language plpgsql
as $$
begin
  if new.match_status = 'matched' and old.match_status is distinct from 'matched' then
    new.matched_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists chats_set_matched_at on public.chats;
create trigger chats_set_matched_at
  before update of match_status on public.chats
  for each row execute function public.set_chat_matched_at();

-- 채팅방은 권한상 내가 참여한 방만 보이므로, 전체 건수는 숫자만 돌려주는 함수로 센다
-- 오늘 = 한국 시간 기준 0시부터
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
  from public.chats
  where match_status = 'matched';
$$;

revoke all on function public.get_match_stats() from public, anon;
grant execute on function public.get_match_stats() to authenticated;
