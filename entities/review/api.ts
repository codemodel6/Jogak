import type { Review, ReviewScope } from "@/entities/review";
import { supabase } from "@/shared/supabase";
import { getProfileMap, requireUser } from "@/shared/lib/supabase/helpers";

type ReviewRow = {
  id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  tags: string[] | null;
  content: string;
  created_at: string;
};

const LIST_LIMIT = 300;

// 작성자 이름은 가운데를 가린다: 이지혜 → 이*혜, 지혜 → 지*
function maskName(name: string) {
  if (name.length <= 1) return name;
  if (name.length === 2) return `${name[0]}*`;
  return `${name[0]}${"*".repeat(name.length - 2)}${name.at(-1)}`;
}

// 후기 목록(최신순): 게시판 '후기' 분류는 전체, 나의 후기는 받은 후기·쓴 후기
export async function getReviews(scope: ReviewScope) {
  const user = await requireUser();
  let query = supabase
    .from("reviews")
    .select("id, reviewer_id, reviewee_id, rating, tags, content, created_at")
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);

  if (scope === "received") {
    query = query.eq("reviewee_id", user.id);
  } else if (scope === "written") {
    query = query.eq("reviewer_id", user.id);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return { reviews: await toReviews((data ?? []) as ReviewRow[]) };
}

export async function getReview(reviewId: string) {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, reviewer_id, reviewee_id, rating, tags, content, created_at")
    .eq("id", reviewId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const [review] = data ? await toReviews([data as ReviewRow]) : [];
  return { review: review ?? null };
}

async function toReviews(rows: ReviewRow[]) {
  const profiles = await getProfileMap([...new Set(rows.flatMap((row) => [row.reviewer_id, row.reviewee_id]))]);

  const reviews: Review[] = rows.map((row) => {
    const reviewer = profiles.get(row.reviewer_id);
    const reviewee = profiles.get(row.reviewee_id);

    return {
      reviewId: row.id,
      rating: row.rating,
      tags: row.tags ?? [],
      content: row.content,
      createdAt: row.created_at,
      reviewer: {
        userId: row.reviewer_id,
        name: maskName(reviewer?.name ?? "익명"),
        photo: reviewer?.photos?.[0],
      },
      reviewee: {
        userId: row.reviewee_id,
        name: reviewee?.name ?? "익명",
        photo: reviewee?.photos?.[0],
      },
    };
  });

  return reviews;
}

export async function submitReview(payload: { matchId: string; rating: number; tags: string[]; content: string }) {
  const { data, error } = await supabase.rpc("submit_review", {
    p_match_id: payload.matchId,
    p_rating: payload.rating,
    p_tags: payload.tags,
    p_content: payload.content,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as string;
}
