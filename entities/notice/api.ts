import type { Notice, NoticeCategory, NoticeComment } from "@/entities/notice";
import { supabase } from "@/shared/supabase";
import { getProfileMap, requireUser } from "@/shared/lib/supabase/helpers";

type PostRow = {
  id: number;
  author_id: string;
  category: NoticeCategory;
  title: string;
  content: string;
  pinned: boolean;
  views: number;
  created_at: string;
  board_comments?: Array<{ count: number }>;
};

type CommentRow = {
  id: number;
  author_id: string;
  content: string;
  created_at: string;
};

const NEW_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

function formatDate(value: string) {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

function toNotice(row: PostRow, profiles: Awaited<ReturnType<typeof getProfileMap>>): Notice {
  const author = profiles.get(row.author_id);

  return {
    id: row.id,
    category: row.category,
    title: row.title,
    content: row.content,
    pinned: row.pinned,
    views: row.views,
    createdAt: row.created_at,
    date: formatDate(row.created_at),
    isNew: Date.now() - new Date(row.created_at).getTime() < NEW_WINDOW_MS,
    author: { userId: row.author_id, name: author?.name ?? "익명", photo: author?.photos?.[0] },
    commentCount: row.board_comments?.[0]?.count ?? 0,
  };
}

export async function getBoardPosts() {
  const { data, error } = await supabase
    .from("board_posts")
    .select("*, board_comments(count)")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as PostRow[];
  const profiles = await getProfileMap([...new Set(rows.map((row) => row.author_id))]);

  return { posts: rows.map((row) => toNotice(row, profiles)) };
}

export async function getBoardPost(postId: number) {
  const { data, error } = await supabase
    .from("board_posts")
    .select("*, board_comments(count)")
    .eq("id", postId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    return { post: null };
  }

  const row = data as PostRow;
  const profiles = await getProfileMap([row.author_id]);
  return { post: toNotice(row, profiles) };
}

export async function increaseBoardView(postId: number) {
  await supabase.rpc("increment_board_view", { p_post_id: postId });
}

export async function getBoardComments(postId: number) {
  const { data, error } = await supabase
    .from("board_comments")
    .select("id, author_id, content, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as CommentRow[];
  const profiles = await getProfileMap([...new Set(rows.map((row) => row.author_id))]);

  const comments: NoticeComment[] = rows.map((row) => ({
    id: row.id,
    content: row.content,
    createdAt: row.created_at,
    author: {
      userId: row.author_id,
      name: profiles.get(row.author_id)?.name ?? "익명",
      photo: profiles.get(row.author_id)?.photos?.[0],
    },
  }));

  return { comments };
}

export async function addBoardComment(payload: { postId: number; content: string }) {
  const user = await requireUser();
  const { error } = await supabase
    .from("board_comments")
    .insert({ post_id: payload.postId, author_id: user.id, content: payload.content });

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteBoardComment(commentId: number) {
  const { error } = await supabase.from("board_comments").delete().eq("id", commentId);

  if (error) {
    throw new Error(error.message);
  }
}
