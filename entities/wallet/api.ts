import type { PointTransaction, Wallet } from "@/entities/wallet";
import { requireUser } from "@/shared/lib/supabase/helpers";
import { supabase } from "@/shared/supabase";

export async function getMyWallet() {
  const { data, error } = await supabase.rpc("get_my_wallet");
  if (error) throw new Error(error.message);
  return data as Wallet;
}

// 오늘 첫 접속이면 출석으로 기록한다. 7일 연속마다 보너스 매칭권 1장.
export async function checkIn() {
  const { data, error } = await supabase.rpc("check_in");
  if (error) throw new Error(error.message);
  return data as { bonusGranted: boolean; wallet: Wallet };
}

export async function getPointHistory(): Promise<PointTransaction[]> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("point_transactions")
    .select("id, delta, balance, reason, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  return ((data ?? []) as Array<{ id: number; delta: number; balance: number; reason: string; created_at: string }>).map(
    (row) => ({ id: row.id, delta: row.delta, balance: row.balance, reason: row.reason, createdAt: row.created_at }),
  );
}
