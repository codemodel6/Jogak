import NoticeDetailPage from "@/views/notice-detail";

export default async function Page({
  params,
}: {
  params: Promise<{ noticeId: string }>;
}) {
  const { noticeId } = await params;
  return <NoticeDetailPage noticeId={Number(noticeId)} />;
}
