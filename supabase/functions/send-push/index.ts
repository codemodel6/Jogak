// 웹 푸시 발송: DB의 push_notify()가 pg_net으로 호출한다.
// 받는 사람의 모든 기기(push_subscriptions)로 보내고, 만료된 구독(404·410)은 지운다.
import { createClient } from "npm:@supabase/supabase-js@2.103.0";
import webpush from "npm:web-push@3.6.7";

type Payload = {
  userId: string;
  title: string;
  body: string;
  link: string;
  tag: string;
  badge?: number;
};

const secret = Deno.env.get("PUSH_WEBHOOK_SECRET") ?? "";

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:codemodel6@gmail.com",
  Deno.env.get("VAPID_PUBLIC_KEY") ?? "",
  Deno.env.get("VAPID_PRIVATE_KEY") ?? "",
);

const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  if (req.method !== "POST" || !secret || req.headers.get("x-push-secret") !== secret) {
    return new Response("forbidden", { status: 403 });
  }

  const payload = (await req.json()) as Payload;
  const { data: subscriptions, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", payload.userId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    link: payload.link,
    tag: payload.tag,
    badge: payload.badge ?? 0,
  });

  const results = await Promise.all(
    (subscriptions ?? []).map(async (sub) => {
      try {
        const res = await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          message,
          { TTL: 60 * 60 * 24, urgency: "high" },
        );
        return { id: sub.id, status: res.statusCode };
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode ?? 0;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        }
        return { id: sub.id, status, error: String((err as Error).message ?? err).slice(0, 200) };
      }
    }),
  );

  return Response.json({ sent: results.filter((r) => r.status >= 200 && r.status < 300).length, results });
});
