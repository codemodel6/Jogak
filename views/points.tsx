"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { FiCheck, FiChevronLeft, FiCreditCard, FiInfo, FiSmartphone } from "react-icons/fi";

import { useProfileQuery } from "@/entities/profile/hooks";
import { POINT_REASON_LABEL, PRICE } from "@/entities/wallet";
import { usePointHistoryQuery, useWalletQuery } from "@/entities/wallet/hooks";
import { useAuthStatusQuery } from "@/features/auth/hooks";
import Skeleton from "@/shared/ui/skeleton";
import TrustCrystalIcon from "@/shared/ui/trust-crystal-icon";
import MainLayout from "@/widgets/main-layout";

// 결제는 화면만 먼저 만든 상태다(결제 대행사 연동 전). 이용 내역은 point_transactions에서 읽는다.
// 신뢰 포인트 1개 = 1,000원
const POINT_PRICE = 1000;

const packages = [
  { id: "p5", points: 5, bonus: 0 },
  { id: "p10", points: 10, bonus: 1 },
  { id: "p30", points: 30, bonus: 4, badge: "인기" },
  { id: "p50", points: 50, bonus: 8 },
  { id: "p100", points: 100, bonus: 20, badge: "최대 혜택" },
  { id: "p200", points: 200, bonus: 50 },
].map((item) => ({ ...item, price: item.points * POINT_PRICE }));

const paymentMethods = [
  { id: "card", label: "신용·체크카드", icon: FiCreditCard },
  { id: "kakaopay", label: "카카오페이" },
  { id: "tosspay", label: "토스페이" },
  { id: "naverpay", label: "네이버페이" },
  { id: "phone", label: "휴대폰 결제", icon: FiSmartphone },
];

type HistoryType = "충전" | "사용" | "적립";

type HistoryItem = { id: number; type: HistoryType; title: string; date: string; amount: number; balance: number };

function formatDateTime(value: string) {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// 신뢰 포인트를 쓰는 곳 (무료 매칭권을 다 쓴 뒤부터 포인트가 필요하다)
const USES = [
  { label: "추가 매칭", price: `${PRICE.extraRequest}P`, description: "무료 매칭권 3장을 다 쓴 뒤 한 번 더" },
  { label: "💜 진심 요청", price: `+${PRICE.priorityRequest}P`, description: "상대 채팅 목록 맨 위에 먼저 보여요" },
  { label: "글 상단 노출", price: `${PRICE.postBoost}P`, description: "1시간 동안 매칭 목록 맨 앞" },
  { label: "신뢰 점수 회복", price: "1P / 1점", description: "깎인 신뢰 점수를 되돌려요" },
];

const notes = [
  "충전한 포인트의 유효기간은 결제일로부터 5년입니다.",
  "보너스 포인트는 충전 포인트보다 먼저 사용됩니다.",
  "결제 후 7일 이내, 사용하지 않은 포인트에 한해 환불할 수 있습니다.",
  "신뢰 포인트 1개는 1,000원이며, 추가 매칭·진심 요청·글 상단 노출·신뢰 회복에 사용할 수 있습니다.",
  "무료 매칭권은 매일 3장이 주어지고, 한국 시간 자정에 다시 3장으로 채워집니다(남은 매칭권은 이월되지 않습니다).",
];

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function PointsPage() {
  const router = useRouter();
  const { data: isAuthenticated } = useAuthStatusQuery();
  const profileQuery = useProfileQuery(isAuthenticated === true);
  const [tab, setTab] = useState<"charge" | "history">("charge");
  const [selectedId, setSelectedId] = useState("p30");
  const [methodId, setMethodId] = useState("card");
  const [agreed, setAgreed] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<HistoryType | "전체">("전체");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated === false) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // 서버 화면과 브라우저 첫 화면을 같게(스켈레톤) 그린다
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const pointsLoading = !mounted || isAuthenticated !== true || profileQuery.isPending;
  const points = profileQuery.data?.profile.hearts ?? 0;
  const selected = packages.find((item) => item.id === selectedId) ?? packages[0];
  const walletQuery = useWalletQuery(isAuthenticated === true);
  const wallet = walletQuery.data;
  const historyQuery = usePointHistoryQuery(isAuthenticated === true && tab === "history");
  const historyItems: HistoryItem[] = (historyQuery.data ?? []).map((row) => ({
    id: row.id,
    type: row.reason === "charge" ? "충전" : row.delta > 0 ? "적립" : "사용",
    title: POINT_REASON_LABEL[row.reason] ?? "포인트 변동",
    date: formatDateTime(row.createdAt),
    amount: row.delta,
    balance: row.balance,
  }));
  const filteredHistory = historyItems.filter((item) => historyFilter === "전체" || item.type === historyFilter);

  const handlePay = () => {
    setNotice("결제 기능은 준비 중입니다.");
  };

  return (
    <MainLayout active="profile" title="포인트" copy="매칭에 사용할 포인트를 충전하고 내역을 확인하세요.">
      <Link
        href="/profile"
        className="mt-4 inline-flex items-center gap-1.5 text-[0.88rem] text-zinc-300 transition hover:text-white"
      >
        <FiChevronLeft />
        내 정보로
      </Link>

      <div className="mt-3 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        {/* 보유 포인트: PC에서는 오른쪽에 고정, 모바일에서는 맨 위 */}
        <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-5 xl:col-start-2 xl:row-start-1">
          <section className="keep-dark rounded-[22px] bg-[linear-gradient(135deg,rgba(87,60,216,0.92),rgba(25,20,74,0.94))] px-5 py-5 shadow-[0_22px_42px_rgba(29,20,84,0.3)]">
            <p className="text-[0.9rem] font-medium text-white/80">보유 포인트</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[radial-gradient(circle_at_50%_30%,rgba(196,181,253,0.35),transparent_60%),linear-gradient(150deg,#241c46,#120d2a_60%,#0a0718)] shadow-[0_0_0_1px_rgba(196,181,253,0.25)]">
                <TrustCrystalIcon className="h-9 w-auto drop-shadow-[0_0_8px_rgba(167,139,250,0.75)]" />
              </div>
              {pointsLoading ? (
                <Skeleton className="h-[2.2rem] w-20 rounded-md" />
              ) : (
                <p className="text-[2.2rem] font-semibold leading-none tracking-[-0.05em] text-white">
                  {points.toLocaleString()}
                </p>
              )}
            </div>
            <p className="mt-4 rounded-[12px] bg-white/10 px-3 py-2 text-[0.82rem] text-white/85">
              오늘 무료 매칭권{" "}
              <b className="text-white">
                {wallet ? `${wallet.freeLeft}/${wallet.freeTotal}장` : "-"}
              </b>
              {wallet && wallet.bonusTickets > 0 && ` · 보너스 ${wallet.bonusTickets}장`}
              {wallet && wallet.streak > 0 && ` · 연속 출석 ${wallet.streak}일`}
              <br />
              <span className="text-white/65">7일 연속 출석하면 보너스 매칭권 1장을 드려요.</span>
            </p>
          </section>

          <section className="desktop-panel px-5 py-4">
            <h2 className="text-[0.95rem] font-semibold text-white">신뢰 포인트 쓰는 곳</h2>
            <ul className="mt-2 divide-y divide-white/7">
              {USES.map((use) => (
                <li key={use.label} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block text-[0.88rem] text-zinc-100">{use.label}</span>
                    <span className="block text-[0.76rem] text-zinc-500">{use.description}</span>
                  </span>
                  <span className="shrink-0 text-[0.88rem] font-semibold text-violet-300">{use.price}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>

        <main className="flex min-w-0 flex-col gap-5 xl:col-start-1 xl:row-start-1">
          <div className="grid grid-cols-2 rounded-[16px] border border-white/8 bg-white/3 p-1">
            {(
              [
                { key: "charge", label: "충전하기" },
                { key: "history", label: "이용 내역" },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={cx(
                  "rounded-[12px] py-2.5 text-[0.92rem] font-medium transition",
                  tab === item.key
                    ? "bg-[linear-gradient(135deg,#6f56ff,#7b50f3)] text-on-accent shadow-[0_10px_24px_rgba(94,63,225,0.3)]"
                    : "text-zinc-400 hover:text-white",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "charge" ? (
            <>
              <section className="desktop-panel px-4 py-5 md:px-5">
                <h2 className="text-[1.1rem] font-semibold text-white">충전 상품</h2>
                <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-3">
                  {packages.map((item) => {
                    const active = item.id === selectedId;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className={cx(
                          "relative rounded-[16px] border px-3 py-4 text-left transition",
                          active
                            ? "border-violet-400/70 bg-violet-500/15"
                            : "border-white/8 bg-white/3 hover:border-white/20",
                        )}
                      >
                        {item.badge && (
                          <span className="absolute right-2.5 top-2.5 keep-dark rounded-full bg-[#8f522c] px-2 py-0.5 text-[0.68rem] font-semibold text-orange-100">
                            {item.badge}
                          </span>
                        )}
                        <p className="flex items-center gap-1.5 text-[1.25rem] font-semibold tracking-[-0.03em] text-white">
                          <TrustCrystalIcon className="h-5 w-auto" />
                          {item.points.toLocaleString()}
                        </p>
                        <p className="mt-1 h-5 text-[0.8rem] font-medium text-emerald-300">
                          {item.bonus > 0 && `+${item.bonus.toLocaleString()} 보너스`}
                        </p>
                        <p className="mt-2 text-[0.95rem] text-zinc-200">{item.price.toLocaleString()}원</p>
                        {active && (
                          <span className="absolute bottom-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-on-accent">
                            <FiCheck className="text-[0.75rem]" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="desktop-panel px-4 py-5 md:px-5">
                <h2 className="text-[1.1rem] font-semibold text-white">결제 수단</h2>
                <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-3">
                  {paymentMethods.map((method) => {
                    const Icon = method.icon;

                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setMethodId(method.id)}
                        className={cx(
                          "flex items-center justify-center gap-2 rounded-[14px] border px-3 py-3 text-[0.88rem] font-medium transition",
                          methodId === method.id
                            ? "border-violet-400/70 bg-violet-500/15 text-white"
                            : "border-white/8 bg-white/3 text-zinc-300 hover:border-white/20",
                        )}
                      >
                        {Icon && <Icon />}
                        {method.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="desktop-panel px-4 py-5 md:px-5">
                <h2 className="text-[1.1rem] font-semibold text-white">결제 정보</h2>
                <dl className="mt-4 space-y-2.5 text-[0.92rem]">
                  <div className="flex justify-between text-zinc-300">
                    <dt>선택 상품</dt>
                    <dd className="text-white">{selected.points.toLocaleString()}</dd>
                  </div>
                  <div className="flex justify-between text-zinc-300">
                    <dt>보너스</dt>
                    <dd className="text-emerald-300">+{selected.bonus.toLocaleString()}</dd>
                  </div>
                  <div className="flex justify-between text-zinc-300">
                    <dt>충전 후 포인트</dt>
                    <dd className="text-white">{(points + selected.points + selected.bonus).toLocaleString()}</dd>
                  </div>
                  <div className="flex justify-between border-t border-white/8 pt-3 text-[1rem] font-semibold text-white">
                    <dt>결제 금액</dt>
                    <dd>{selected.price.toLocaleString()}원</dd>
                  </div>
                </dl>

                <label className="mt-5 flex cursor-pointer items-start gap-2.5 text-[0.86rem] text-zinc-300">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(event) => setAgreed(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-violet-500"
                  />
                  주문 내용을 확인했으며, 결제와 포인트 이용약관에 동의합니다.
                </label>

                <button
                  type="button"
                  onClick={handlePay}
                  disabled={!agreed}
                  className="btn-primary mt-4 w-full py-3.5 text-[0.98rem]"
                >
                  {selected.price.toLocaleString()}원 결제하기
                </button>
              </section>
            </>
          ) : (
            <section className="desktop-panel px-2 py-3 md:px-3">
              <div className="flex gap-2 px-2 pb-3 pt-1">
                {(["전체", "충전", "사용", "적립"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setHistoryFilter(item)}
                    className={cx(
                      "rounded-full border px-4 py-1.5 text-[0.84rem] font-medium transition",
                      historyFilter === item
                        ? "border-violet-400/60 bg-violet-500/25 text-white"
                        : "border-white/8 bg-white/4 text-zinc-300 hover:border-white/20",
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>
              {historyQuery.isLoading &&
                Array.from({ length: 3 }, (_, index) => (
                  <div key={index} className="flex items-center justify-between px-3 py-3.5">
                    <Skeleton className="h-4 w-40 rounded-md" />
                    <Skeleton className="h-4 w-12 rounded-md" />
                  </div>
                ))}
              {!historyQuery.isLoading && filteredHistory.length === 0 && (
                <p className="px-3 py-10 text-center text-[0.86rem] text-zinc-400">
                  아직 포인트 이용 내역이 없어요.
                </p>
              )}
              <ul className="divide-y divide-white/7 border-t border-white/7">
                {filteredHistory.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-4 px-3 py-3.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cx(
                            "shrink-0 rounded-md px-1.5 py-0.5 text-[0.72rem] font-semibold",
                            item.type === "충전" && "bg-violet-500/18 text-violet-200",
                            item.type === "사용" && "bg-rose-500/15 text-rose-200",
                            item.type === "적립" && "bg-emerald-500/15 text-emerald-200",
                          )}
                        >
                          {item.type}
                        </span>
                        <p className="truncate text-[0.92rem] text-zinc-100">{item.title}</p>
                      </div>
                      <p className="mt-1 text-[0.78rem] text-zinc-500">{item.date}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={cx(
                          "text-[0.98rem] font-semibold",
                          item.amount > 0 ? "text-violet-300" : "text-zinc-200",
                        )}
                      >
                        {item.amount > 0 ? "+" : ""}
                        {item.amount.toLocaleString()}
                      </p>
                      <p className="mt-0.5 text-[0.76rem] text-zinc-500">잔액 {item.balance.toLocaleString()}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-[18px] border border-white/7 bg-white/2 px-4 py-4 md:px-5">
            <h3 className="flex items-center gap-1.5 text-[0.9rem] font-medium text-zinc-300">
              <FiInfo />
              유의사항
            </h3>
            <ul className="mt-2.5 space-y-1.5 text-[0.82rem] text-zinc-400">
              {notes.map((note) => (
                <li key={note} className="break-keep">
                  · {note}
                </li>
              ))}
            </ul>
          </section>
        </main>
      </div>

      {notice && (
        <div className="fixed left-1/2 top-4 z-[130] -translate-x-1/2 rounded-2xl border border-violet-400/20 bg-surface/95 px-4 py-3 text-sm text-violet-100 shadow-xl">
          {notice}
        </div>
      )}
    </MainLayout>
  );
}
