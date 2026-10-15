-- 매칭 글: 태그와 대표 이미지(오픈채팅 썸네일처럼 글마다 1장)
alter table public.posts
  add column if not exists tags text[] not null default '{}',
  add column if not exists cover_url text;

alter table public.posts drop constraint if exists posts_tags_limit;
alter table public.posts add constraint posts_tags_limit check (coalesce(array_length(tags, 1), 0) <= 5);
