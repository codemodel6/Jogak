// 조각 서비스워커: 웹 푸시를 받아 휴대폰·PC 알림창에 띄운다.
// 보내는 쪽은 Supabase Edge Function(send-push). 내용: { title, body, link, tag, badge }

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const link = data.link || "/home";

  event.waitUntil(
    (async () => {
      if (typeof data.badge === "number" && "setAppBadge" in self.navigator) {
        self.navigator.setAppBadge(data.badge).catch(() => {});
      }

      // 그 채팅방을 지금 화면에 띄워 보고 있으면 알림창은 생략한다
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const viewing = link.startsWith("/chat/") && windows.some((client) => {
        try {
          return client.focused && new URL(client.url).pathname === link;
        } catch {
          return false;
        }
      });
      if (viewing) return;

      await self.registration.showNotification(data.title || "조각", {
        body: data.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: data.tag || undefined,
        renotify: Boolean(data.tag),
        data: { link },
      });
    })(),
  );
});

// 알림을 누르면 열려 있는 앱 창으로 가서 해당 화면을 연다 (없으면 새 창)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/home";
  const target = new URL(link, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const sameOrigin = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (sameOrigin) {
        await sameOrigin.focus();
        if ("navigate" in sameOrigin) {
          await sameOrigin.navigate(target).catch(() => self.clients.openWindow(target));
        }
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
