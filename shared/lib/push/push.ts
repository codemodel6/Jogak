import { supabase } from "@/shared/supabase";

// 이 기기의 알림창 알림 상태
// unsupported: 브라우저가 지원 안 함 / needs-install: 아이폰은 홈 화면에 추가해야 함
// denied: 알림을 차단함 / off: 아직 켜지 않음 / on: 받는 중
export type PushStatus = "unsupported" | "needs-install" | "denied" | "off" | "on";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function isIos() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as { standalone?: boolean }).standalone));
}

function base64ToBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function isPushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}

async function saveSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: subscription.endpoint,
    p_p256dh: json.keys?.p256dh ?? "",
    p_auth: json.keys?.auth ?? "",
    p_user_agent: navigator.userAgent.slice(0, 300),
  });
  if (error) throw error;
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) {
    return isIos() && !isStandalone() ? "needs-install" : "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "off";
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  return subscription ? "on" : "off";
}

// 알림 켜기: 권한 요청 → 구독 → DB 저장. 반드시 버튼 클릭 안에서 불러야 한다(브라우저 정책).
export async function enablePush(): Promise<PushStatus> {
  if (!isPushSupported()) return getPushStatus();
  if (!vapidPublicKey) throw new Error("푸시 공개키(NEXT_PUBLIC_VAPID_PUBLIC_KEY)가 설정되지 않았어요.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";

  const registration = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready);
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(vapidPublicKey) }));
  await saveSubscription(subscription);
  return "on";
}

// 이 기기만 알림 끄기 (로그아웃 때도 부른다)
export async function disablePush() {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
  await subscription.unsubscribe();
}

// 이미 허용한 기기는 들어올 때마다 구독을 다시 저장한다 (다른 계정으로 바꿔 로그인한 경우·만료 대비)
export async function syncPushSubscription() {
  if (!isPushSupported() || Notification.permission !== "granted" || !vapidPublicKey) return;
  const registration = (await registerServiceWorker()) ?? undefined;
  if (!registration) return;
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(vapidPublicKey) }));
  await saveSubscription(subscription);
}
