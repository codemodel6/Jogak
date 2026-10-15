export type ChatMember = {
  userId: string;
  name: string;
  photos: string[];
  role: "owner" | "member";
  lastReadAt: string | null;
};

export type ChatSummary = {
  chatId: string;
  matchStatus: string;
  isGroup: boolean;
  // 단체 채팅방 이름(없으면 참여자 이름을 이어 붙인다). 1:1은 상대 이름.
  title: string;
  memberCount: number;
  otherUser: {
    name: string;
    photos: string[];
  };
  // 마지막 메시지(없으면 null)
  lastMessage: { message: string; timestamp: string } | null;
};

export type ChatMessage = {
  messageId: number;
  userId: string;
  userName: string;
  message: string;
  timestamp: string;
};

export type ChatDetail = {
  chatId: string;
  isGroup: boolean;
  title: string;
  members: ChatMember[];
  user1Id: string;
  user2Id: string;
  matchRequester: string | null;
  matchStatus: string;
  meetSuccessUser1: boolean;
  meetSuccessUser2: boolean;
  otherUser: {
    userId: string;
    name: string;
    photos: string[];
    height?: string;
    age?: string;
    location?: string;
    gender?: string;
    mbti?: string;
    trustScore: number;
  };
};
