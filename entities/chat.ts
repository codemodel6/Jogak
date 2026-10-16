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
  // 어느 매칭 글로 시작한 대화인지 (글마다 방이 따로 생긴다. 예전 방은 null)
  postId: string | null;
  postTitle: string | null;
  // 상대가 나에게 보낸 진심 요청(2P)이면 목록 맨 위에 강조한다
  priorityIncoming: boolean;
  // 매칭 거절로 닫힌 방 (메시지를 보낼 수 없다)
  closed: boolean;
};

export type ChatMessage = {
  messageId: number;
  userId: string;
  userName: string;
  message: string;
  timestamp: string;
  // system: 매치 취소처럼 서버가 남기는 안내. message에는 사유가 들어 있다.
  kind: "text" | "system";
};

export type ChatDetail = {
  chatId: string;
  isGroup: boolean;
  title: string;
  postTitle: string | null;
  // declined: 받은 사람이 거절 / requester_rejected: 요청한 사람이 거절(취소)
  // met·withdrawn·reported·expired: 매칭이 끝남(만남 성사·매치 취소·못 만났어요·시간 만료). null이면 열린 방.
  closedReason: string | null;
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
