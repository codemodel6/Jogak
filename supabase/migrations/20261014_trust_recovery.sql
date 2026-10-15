-- 신뢰 점수 저장 칸 (0~100)
alter table public.profiles
  add column if not exists trust_score integer not null default 70
  check (trust_score between 0 and 100);

-- 신뢰 포인트로 신뢰 점수 회복: 1점 = 1,000P
-- 잔액 확인·차감·점수 증가를 한 트랜잭션에서 처리하고, 100점을 넘는 만큼은 차감하지 않는다.
create or replace function public.recover_trust(p_score integer)
returns table (trust_score integer, hearts integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost_per_score constant integer := 1000;
  v_current_score integer;
  v_current_hearts integer;
  v_gain integer;
  v_cost integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_score is null or p_score <= 0 then
    raise exception '회복할 점수를 선택해 주세요.';
  end if;

  select p.trust_score, coalesce(p.hearts, 0)
    into v_current_score, v_current_hearts
    from public.profiles p
   where p.user_id = auth.uid()
   for update;

  if not found then
    raise exception '프로필을 찾을 수 없습니다.';
  end if;

  v_gain := least(p_score, 100 - v_current_score);
  if v_gain <= 0 then
    raise exception '이미 최고 점수입니다.';
  end if;

  v_cost := v_gain * v_cost_per_score;
  if v_current_hearts < v_cost then
    raise exception '신뢰 포인트가 부족합니다. (필요 %P, 보유 %P)', v_cost, v_current_hearts;
  end if;

  update public.profiles p
     set trust_score = v_current_score + v_gain,
         hearts = v_current_hearts - v_cost
   where p.user_id = auth.uid();

  return query select v_current_score + v_gain, v_current_hearts - v_cost;
end;
$$;

revoke all on function public.recover_trust(integer) from public, anon;
grant execute on function public.recover_trust(integer) to authenticated;

-- 개발용: 테스트 계정에 신뢰 포인트 50,000P 지급
update public.profiles set hearts = 50000 where user_id = '6fe46ef0-8743-4a95-ad38-aee4fa58ec55';
