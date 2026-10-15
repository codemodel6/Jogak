import ReviewsPage from "@/views/reviews";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  return <ReviewsPage initialTab={tab === "written" ? "written" : "received"} />;
}
