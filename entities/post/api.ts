import { supabase } from "@/shared/supabase";
import { getProfileMap, photoBucket, requireUser } from "@/shared/lib/supabase/helpers";
import { isBoosted } from "@/entities/post";
import { getProfile } from "@/entities/profile/api";

type PostRow = {
  id: string;
  user_id: string;
  user_name?: string | null;
  title: string;
  content: string;
  created_at?: string | null;
  tags?: string[] | null;
  cover_url?: string | null;
  boosted_until?: string | null;
};

export async function getPosts() {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as PostRow[];
  const authors = await getProfileMap([...new Set(rows.map((post) => post.user_id))]);
  const posts = rows.map((post) => ({
    postId: post.id,
    userId: post.user_id,
    userName: post.user_name ?? "익명",
    title: post.title,
    content: post.content,
    createdAt: post.created_at ?? new Date().toISOString(),
    tags: post.tags ?? [],
    coverUrl: post.cover_url ?? undefined,
    boostedUntil: post.boosted_until ?? undefined,
    authorHasFace: Boolean(authors.get(post.user_id)?.has_face_photo),
  }));

  // 상단 노출 중인 글을 맨 앞에 (서로는 최신순 유지)
  const now = Date.now();
  posts.sort((a, b) => Number(isBoosted(b, now)) - Number(isBoosted(a, now)));

  return { posts };
}

export const MAX_POST_TAGS = 5;

export async function createPost(payload: {
  title: string;
  content: string;
  tags: string[];
  coverFile?: File | null;
}) {
  const user = await requireUser();
  const profile = await getProfile();
  let coverUrl: string | null = null;

  // 대표 이미지는 본인 폴더(<user_id>/posts/...)에 올린다
  if (payload.coverFile) {
    const extension = payload.coverFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `${user.id}/posts/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(photoBucket)
      .upload(filePath, payload.coverFile, { upsert: false, contentType: payload.coverFile.type });

    if (uploadError) {
      throw uploadError;
    }

    coverUrl = supabase.storage.from(photoBucket).getPublicUrl(filePath).data.publicUrl;
  }

  const { error } = await supabase.from("posts").insert({
    user_id: user.id,
    user_name: profile.profile.name,
    title: payload.title,
    content: payload.content,
    tags: payload.tags.slice(0, MAX_POST_TAGS),
    cover_url: coverUrl,
  });

  if (error) {
    throw error;
  }

  return { success: true };
}

// 내 글 상단 노출: 2P, 1시간 (노출 중이면 1시간 연장)
export async function boostPost(postId: string) {
  const { data, error } = await supabase.rpc("boost_post", { p_post_id: postId });
  if (error) throw new Error(error.message);
  return data as { boostedUntil: string };
}
