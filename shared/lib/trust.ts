import { PiMedalFill, PiSketchLogoFill } from "react-icons/pi";

// 신뢰 등급은 전체 회원 중 신뢰 점수 순위(상위 %)로 정해진다. 25%마다 한 단계, 상위 5%는 블랙.
// maxTop: 이 등급이 되는 가장 낮은 순위(상위 %). 화면 막대는 왼쪽이 하위, 오른쪽이 상위다.
export const TRUST_GRADES = [
  {
    name: "브론즈",
    barWidth: 23.5,
    maxTop: 100,
    icon: PiMedalFill,
    className: "text-orange-300",
    emblemClassName: "bg-[linear-gradient(145deg,#f0a36b,#9a4f22_60%,#5e2c10)] shadow-[0_14px_30px_rgba(154,79,34,0.35)]",
    barClassName: "bg-[linear-gradient(90deg,#c97a45,#9a4f22)]",
  },
  {
    name: "실버",
    barWidth: 23.5,
    maxTop: 75,
    icon: PiMedalFill,
    className: "text-zinc-100",
    emblemClassName: "bg-[linear-gradient(145deg,#f4f6fb,#a3aabb_55%,#5b6273)] shadow-[0_14px_30px_rgba(163,170,187,0.3)]",
    barClassName: "bg-[linear-gradient(90deg,#c9ceda,#8a91a3)]",
  },
  {
    name: "골드",
    barWidth: 23.5,
    maxTop: 50,
    icon: PiMedalFill,
    className: "text-amber-300",
    emblemClassName: "bg-[linear-gradient(145deg,#ffe08a,#d79b1f_55%,#8a5a07)] shadow-[0_14px_30px_rgba(215,155,31,0.35)]",
    barClassName: "bg-[linear-gradient(90deg,#f2c24f,#c88a12)]",
  },
  {
    name: "다이아몬드",
    barWidth: 20.5,
    maxTop: 25,
    icon: PiSketchLogoFill,
    className: "text-cyan-200",
    emblemClassName: "bg-[linear-gradient(145deg,#c8f6ff,#38bdf8_50%,#4f46e5)] shadow-[0_14px_34px_rgba(56,189,248,0.4)]",
    barClassName: "bg-[linear-gradient(90deg,#67e8f9,#38bdf8)]",
  },
  {
    name: "블랙",
    barWidth: 9,
    maxTop: 5,
    icon: PiSketchLogoFill,
    // 흑요석 같은 검정 바탕 + 은은한 오로라 테두리, 보석은 무지갯빛 그라데이션(BLACK_GEM_GRADIENT_ID)으로 칠한다.
    className:
      "bg-[linear-gradient(100deg,#ffffff,#d9d3f2_35%,#9a93b8_60%,#f4f1ff)] bg-clip-text text-transparent",
    emblemClassName:
      "bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.22),transparent_38%),radial-gradient(circle_at_75%_85%,rgba(124,92,255,0.35),transparent_45%),linear-gradient(150deg,#2a2638,#0b0a12_55%,#000)] shadow-[0_0_0_1.5px_rgba(214,206,255,0.55),0_0_28px_rgba(139,92,246,0.45),inset_0_0_16px_rgba(167,139,250,0.3)]",
    iconClassName: "[&_path]:fill-[url(#black-gem-gradient)]",
  },
];

export function getTrustGrade(topPercent: number) {
  const index = TRUST_GRADES.reduce((found, grade, i) => (topPercent <= grade.maxTop ? i : found), 0);
  return { grade: TRUST_GRADES[index] };
}

// 실제 순위 집계 전까지는 신뢰 점수로 상위 %를 추정한다 (100점 = 상위 1%, 70점 = 상위 30%).
export function estimateTopPercent(trustScore: number) {
  return Math.max(1, 100 - trustScore);
}
