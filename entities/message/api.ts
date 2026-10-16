import { supabase } from "@/shared/supabase";
import { getProfileMap, requireUser } from "@/shared/lib/supabase/helpers";
import { getProfile } from "@/entities/profile/api";

type MessageRow = {
  id: number | string;
  chat_id: string;
  user_id: string;
  user_name?: string | null;
  message: string;
  kind?: string | null;
  created_at?: string | null;
};

export async function getMessages(chatId: string) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as MessageRow[];
  const profiles = await getProfileMap([
    ...new Set(rows.map((message) => message.user_id)),
  ]);

  const messages = rows.map((message) => ({
    messageId: Number(message.id),
    userId: message.user_id,
    userName: message.user_name ?? profiles.get(message.user_id)?.name ?? "익명",
    message: message.message,
    kind: message.kind === "system" ? ("system" as const) : ("text" as const),
    timestamp: message.created_at ?? new Date().toISOString(),
  }));

  return { messages };
}

export async function sendMessage(payload: {
  chatId: string;
  message: string;
}) {
  const user = await requireUser();
  const profile = await getProfile();

  const { error } = await supabase.from("messages").insert({
    chat_id: payload.chatId,
    user_id: user.id,
    user_name: profile.profile.name,
    message: payload.message,
  });

  if (error) {
    throw error;
  }

  return { success: true };
}
