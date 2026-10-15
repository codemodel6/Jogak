import { getTrustGrade } from "@/shared/lib/trust";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const sizes = {
  md: { box: "h-16 w-16 rounded-[20px]", icon: "text-[2rem]", shine: "inset-x-2 top-1.5 h-4" },
  sm: { box: "h-12 w-12 rounded-[16px]", icon: "text-[1.5rem]", shine: "inset-x-1.5 top-1 h-3" },
};

// 신뢰 등급 엠블럼: 등급별 색 타일 + 메달/보석 아이콘. 블랙은 무지갯빛 보석.
export default function TrustGradeEmblem({ topPercent, size = "md" }: { topPercent: number; size?: keyof typeof sizes }) {
  const { grade } = getTrustGrade(topPercent);
  const Icon = grade.icon;
  const style = sizes[size];

  return (
    <div className={cx("relative flex shrink-0 items-center justify-center text-white", style.box, grade.emblemClassName)}>
      <span className={cx("pointer-events-none absolute rounded-full bg-white/30 blur-[6px]", style.shine)} />
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <linearGradient id="black-gem-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#c4b5fd" />
            <stop offset="65%" stopColor="#67e8f9" />
            <stop offset="100%" stopColor="#f0abfc" />
          </linearGradient>
        </defs>
      </svg>
      <Icon
        className={cx(
          "relative drop-shadow-[0_2px_6px_rgba(139,92,246,0.45)]",
          style.icon,
          "iconClassName" in grade && grade.iconClassName,
        )}
      />
    </div>
  );
}
