-- 첫 로그인 프로필 입력(온보딩) 항목
alter table public.profiles
  add column if not exists gender text,
  add column if not exists mbti text,
  add column if not exists purpose text,
  add column if not exists photos_private boolean not null default false,
  add column if not exists onboarded_at timestamptz;

-- 프로필 사진 버킷 (공개 URL 사용)
insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

-- 본인 폴더(<user_id>/...)에만 업로드·수정·삭제 가능
create policy "profile photos insert own"
on storage.objects for insert
to authenticated
with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "profile photos update own"
on storage.objects for update
to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "profile photos delete own"
on storage.objects for delete
to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
