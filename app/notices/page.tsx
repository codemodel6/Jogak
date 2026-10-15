import { noticeCategories } from "@/entities/notice";
import type { NoticeCategory } from "@/entities/notice";
import NoticesPage from "@/views/notices";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const initialCategory = noticeCategories.find((item) => item === category) as NoticeCategory | undefined;
  return <NoticesPage initialCategory={initialCategory ?? "전체"} />;
}
