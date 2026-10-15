import { supabase } from "@/shared/supabase";

type LocationRow = {
  chat_id: string;
  user_id: string;
  lat: number;
  lng: number;
};

// 위치 저장과 신뢰 포인트 차감은 DB 함수(share_location)에서 함께 처리한다.
export async function shareLocation(payload: {
  chatId: string;
  lat: number;
  lng: number;
}) {
  const { data, error } = await supabase.rpc("share_location", {
    p_chat_id: payload.chatId,
    p_lat: payload.lat,
    p_lng: payload.lng,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { hearts: data as number };
}

export async function getLocation(chatId: string, userId: string) {
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .eq("chat_id", chatId)
    .eq("user_id", userId)
    .single();

  if (error) {
    throw error;
  }

  return {
    location: {
      lat: (data as LocationRow).lat,
      lng: (data as LocationRow).lng,
    },
  };
}
