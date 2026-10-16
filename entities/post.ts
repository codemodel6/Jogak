export type Post = {
  postId: string;
  userId: string;
  userName: string;
  title: string;
  content: string;
  createdAt: string;
  tags: string[];
  // 글쓰기 때 올린 대표 이미지. 없으면 화면에서 기본 이미지를 쓴다.
  coverUrl?: string;
  // 상단 노출(2P) 끝나는 시각. 지금보다 뒤면 노출 중이다.
  boostedUntil?: string;
  // 글쓴이가 실물 사진을 등록했는지 (매칭 목록 '사진 공개/비공개' 필터)
  authorHasFace: boolean;
};

export function isBoosted(post: Pick<Post, "boostedUntil">, now = Date.now()) {
  return Boolean(post.boostedUntil) && new Date(post.boostedUntil as string).getTime() > now;
}
