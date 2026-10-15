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
};
