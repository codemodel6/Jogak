-- 만남 후기: 두 사람 모두 '만났어요'를 눌러 성사된 매칭(status = 'met')에 대해서만, 매칭 1건당 1번 쓴다.
-- 후기는 후기 게시판에서 로그인한 누구나 볼 수 있다. 쓰기는 submit_review 함수로만 한다.

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  chat_id uuid not null references public.chats(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  reviewee_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  tags text[] not null default '{}',
  content text not null default '' check (char_length(content) <= 80),
  created_at timestamptz not null default now(),
  unique (match_id, reviewer_id)
);

create index if not exists reviews_created_at_idx on public.reviews (created_at desc);
create index if not exists reviews_reviewee_idx on public.reviews (reviewee_id, created_at desc);

alter table public.reviews enable row level security;

drop policy if exists reviews_select on public.reviews;
create policy reviews_select on public.reviews for select to authenticated using (true);

revoke all on public.reviews from anon, authenticated;
grant select on public.reviews to authenticated;

create or replace function public.submit_review(
  p_match_id uuid,
  p_rating int,
  p_tags text[],
  p_content text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_match public.matches;
  v_reviewee uuid;
  v_tags text[];
  v_id uuid;
begin
  select * into v_match from public.matches where id = p_match_id;
  if v_match.id is null or v_uid is null or v_uid not in (v_match.requester_id, v_match.receiver_id) then
    raise exception '참여한 매칭이 아닙니다.';
  end if;
  if v_match.status <> 'met' then
    raise exception '만남이 성사된 매칭에만 후기를 남길 수 있어요.';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception '별점은 1~5점이에요.';
  end if;
  if exists (select 1 from public.reviews where match_id = p_match_id and reviewer_id = v_uid) then
    raise exception '이미 후기를 남겼어요.';
  end if;

  v_reviewee := case when v_uid = v_match.requester_id then v_match.receiver_id else v_match.requester_id end;

  -- 태그: 공백 정리, 빈 값·중복 제거, 20자·5개까지
  select coalesce(array_agg(t order by ord), '{}')
    into v_tags
    from (
      select t, min(ord) as ord
        from (
          select left(btrim(x), 20) as t, ord
            from unnest(coalesce(p_tags, '{}')) with ordinality as u(x, ord)
        ) s
       where t <> ''
       group by t
    ) d;
  v_tags := v_tags[1:5];

  insert into public.reviews (match_id, chat_id, reviewer_id, reviewee_id, rating, tags, content)
  values (p_match_id, v_match.chat_id, v_uid, v_reviewee, p_rating, v_tags, left(btrim(coalesce(p_content, '')), 80))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_review(uuid, int, text[], text) from public, anon;
grant execute on function public.submit_review(uuid, int, text[], text) to authenticated;

-- 만남이 성사된 채팅방에서는 다시 매칭을 요청하지 않는다
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
  if exists (select 1 from public.matches where chat_id = p_chat_id and status = 'met') then
    raise exception '이미 만남이 성사된 대화방이에요.';
  end if;

  insert into public.matches (chat_id, requester_id, receiver_id)
  values (p_chat_id, v_uid, v_partner)
  returning id into v_match_id;

  update public.chats set match_status = 'requested', match_requester = v_uid where id = p_chat_id;
  return v_match_id;
end;
$$;

-- 후기도 실시간으로 받는다(게시판·대화방 갱신)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reviews'
  ) then
    alter publication supabase_realtime add table public.reviews;
  end if;
end $$;
