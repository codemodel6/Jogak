-- 신뢰 포인트 단위 변경: 1포인트 = 1,000원 (기존 1P = 1원)
-- 기존 잔액을 새 단위로 환산하고, 신뢰 회복 비율을 1점 = 1포인트로 바꾼다.
update public.profiles set hearts = floor(coalesce(hearts, 0) / 1000.0);

create or replace function public.recover_trust(p_score integer)
returns table (trust_score integer, hearts integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost_per_score constant integer := 1;
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
    raise exception '신뢰 포인트가 부족합니다. (필요 %, 보유 %)', v_cost, v_current_hearts;
  end if;

  update public.profiles p
     set trust_score = v_current_score + v_gain,
         hearts = v_current_hearts - v_cost
   where p.user_id = auth.uid();

  return query select v_current_score + v_gain, v_current_hearts - v_cost;
end;
$$;

select user_id, hearts, trust_score from public.profiles;
