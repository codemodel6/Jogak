import type { AppNotification, NotificationSettings } from "@/entities/notification";
import { requireUser } from "@/shared/lib/supabase/helpers";
import { supabase } from "@/shared/supabase";

type NotificationRow = {
  id: number;
  category: AppNotification["category"];
  type: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

const DEFAULT_SETTINGS: NotificationSettings = { match: true, chat: true, event: true };

export async function getNotifications(): Promise<AppNotification[]> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, category, type, title, body, link, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  return ((data ?? []) as NotificationRow[]).map((row) => ({
    id: row.id,
    category: row.category,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    readAt: row.read_at,
    createdAt: row.created_at,
  }));
}

// 종 아이콘 숫자: 지우지 않고 남아 있는 알림 개수
export async function getNotificationCount() {
  const user = await requireUser();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (error) throw error;
  return count ?? 0;
}

export async function deleteNotification(id: number) {
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) throw error;
}

export async function clearNotifications() {
  const user = await requireUser();
  const { error } = await supabase.from("notifications").delete().eq("user_id", user.id);
  if (error) throw error;
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("notification_settings")
    .select("match, chat, event")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data ? { match: data.match, chat: data.chat, event: data.event } : DEFAULT_SETTINGS;
}

export async function saveNotificationSettings(settings: NotificationSettings) {
  const user = await requireUser();
  const { error } = await supabase
    .from("notification_settings")
    .upsert({ user_id: user.id, ...settings, updated_at: new Date().toISOString() });

  if (error) throw error;
}
