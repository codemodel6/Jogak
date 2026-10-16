-- 회원가입: 이메일 인증번호 방식
-- · 가입 화면에서 [인증 요청] 전에 이미 가입을 마친 이메일인지 확인한다.
-- · '가입을 마쳤다' = 이메일 인증을 했고 비밀번호도 정한 계정(user_metadata.password_set). 인증만 하고 비밀번호를 안 정한 계정은 다시 가입할 수 있다.
--   인증번호로 만든 계정에도 Supabase가 임의 비밀번호를 넣으므로 encrypted_password로는 판단할 수 없다.
-- · 인증 메일 템플릿(인증번호 6자리)은 Supabase 인증 설정에서 바꿨다(Management API config/auth).
create or replace function public.is_email_registered(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from auth.users
     where lower(email) = lower(trim(p_email))
       and email_confirmed_at is not null
       and coalesce(raw_user_meta_data ->> 'password_set', '') = 'true'
  );
$$;
revoke all on function public.is_email_registered(text) from public;
grant execute on function public.is_email_registered(text) to anon, authenticated;

-- 이 방식 전에 비밀번호로 가입을 마친 계정은 가입 완료로 표시해 둔다
update auth.users
   set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"password_set": true}'::jsonb
 where email_confirmed_at is not null
   and raw_app_meta_data -> 'providers' ? 'email'
   and coalesce(raw_user_meta_data ->> 'password_set', '') <> 'true'
   and created_at < '2026-10-16 05:03:00+00';
