export type NotificationCategory = "match" | "chat" | "event";

export type AppNotification = {
  id: number;
  category: NotificationCategory;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

// 설정 화면 스위치 (행이 없으면 모두 켜짐)
export type NotificationSettings = Record<NotificationCategory, boolean>;
