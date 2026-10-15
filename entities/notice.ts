export type NoticeCategory = "공지사항" | "자유" | "신고" | "후기";

export type Notice = {
  id: number;
  category: NoticeCategory;
  title: string;
  date: string;
  createdAt: string;
  views: number;
  content: string;
  pinned?: boolean;
  isNew?: boolean;
  author: { userId: string; name: string; photo?: string };
  commentCount: number;
};

export type NoticeComment = {
  id: number;
  content: string;
  createdAt: string;
  author: { userId: string; name: string; photo?: string };
};

export const noticeCategories: NoticeCategory[] = ["공지사항", "자유", "신고", "후기"];

export const noticeCategoryClassName: Record<NoticeCategory, string> = {
  공지사항: "bg-violet-500/18 text-violet-200",
  자유: "bg-sky-500/18 text-sky-200",
  신고: "bg-rose-500/18 text-rose-200",
  후기: "bg-emerald-500/18 text-emerald-200",
};
