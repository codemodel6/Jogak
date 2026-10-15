-- 실제 읽음 표시: 참여자별 마지막으로 읽은 시각
alter table public.chat_members
  add column if not exists last_read_at timestamptz;

-- 채팅방을 보고 있는 사람이 "여기까지 읽음"을 기록한다 (본인 행만)
create or replace function public.mark_chat_read(p_chat_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_members
     set last_read_at = now()
   where chat_id = p_chat_id and user_id = auth.uid();
end;
$$;

revoke all on function public.mark_chat_read(uuid) from public, anon;
grant execute on function public.mark_chat_read(uuid) to authenticated;

-- 상대가 읽는 순간 보낸 사람 화면에도 반영되도록 실시간 전송
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_members'
  ) then
    alter publication supabase_realtime add table public.chat_members;
  end if;
end;
$$;

-- 내 정보의 한줄소개(상태 메시지), 최대 20자
alter table public.profiles
  add column if not exists introduction text
  check (introduction is null or char_length(introduction) <= 20);
grant insert (introduction) on public.profiles to authenticated;
grant update (introduction) on public.profiles to authenticated;

select count(*) filter (where tablename in ('messages','chat_members')) as realtime_tables from pg_publication_tables where pubname = 'supabase_realtime';
