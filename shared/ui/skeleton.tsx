// 불러오는 동안 실제 화면과 같은 자리에 보여주는 회색 블록(빛이 지나가는 효과)
export default function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`relative overflow-hidden bg-white/[0.06] before:absolute before:inset-0 before:-translate-x-full before:animate-[skeleton-shimmer_1.4s_infinite] before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)] ${className}`}
    />
  );
}
