import ReviewDetailPage from "@/views/review-detail";

export default async function Page({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await params;
  return <ReviewDetailPage reviewId={reviewId} />;
}
