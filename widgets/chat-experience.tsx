"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FiCalendar,
  FiCheck,
  FiChevronLeft,
  FiFlag,
  FiImage,
  FiLogOut,
  FiMoreHorizontal,
  FiSend,
  FiShield,
  FiTrendingUp,
  FiUserPlus,
  FiUsers,
  FiX,
} from "react-icons/fi";

import type { ChatDetail, ChatMessage, ChatSummary } from "@/entities/chat";
import {
  useChatDetailQuery,
  useChatPartnersQuery,
  useChatsQuery,
  useCreateGroupChatMutation,
  useInviteMembersMutation,
  useLeaveChatMutation,
} from "@/entities/chat/hooks";
import { useMessagesQuery, useSendMessageMutation } from "@/entities/message/hooks";
import { useProfileQuery, useUserProfileQuery } from "@/entities/profile/hooks";
import { markChatRead } from "@/entities/chat/api";
import { useAuthStatusQuery, useCurrentUserIdQuery } from "@/features/auth/hooks";
import MatchWithdrawButton from "@/features/match/match-withdraw-button";
import { useOnlineUserIds } from "@/shared/lib/presence/online-users";
import { estimateTopPercent, getTrustGrade } from "@/shared/lib/trust";
import Skeleton from "@/shared/ui/skeleton";
import TrustGradeEmblem from "@/shared/ui/trust-grade-emblem";
import MainLayout from "@/widgets/main-layout";
import MatchPanel from "@/widgets/match-panel";

type ChatExperienceProps = {
  mobileView: "list" | "detail";
  selectedChatId?: string;
};

const listTabs = ["전체", "안읽음", "즐겨찾기", "보관"];

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatListTime(timestamp: string) {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return "방금 전";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
  return new Date(timestamp).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}

function formatMessageTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function Avatar({
  src,
  alt,
  sizeClass,
  fallback,
}: {
  src?: string;
  alt: string;
  sizeClass: string;
  fallback: string;
}) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-full border border-white/10 bg-[linear-gradient(135deg,var(--avatar-from),var(--avatar-to))]",
        sizeClass,
      )}
    >
      {src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="h-full w-full object-cover" />
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-zinc-300">
          {fallback}
        </div>
      )}
    </div>
  );
}

type UserInfo = {
  name: string;
  photo?: string;
  gender?: string;
  age?: string;
  height?: string;
  mbti?: string;
  trustScore: number;
};

// 사용자 정보 카드: 사진·이름 → 신뢰 등급·점수 → 기본 정보
function UserInfoCard({ user }: { user: UserInfo }) {
  const topPercent = estimateTopPercent(user.trustScore);
  const { grade } = getTrustGrade(topPercent);
  const rows = [
    { icon: FiUsers, label: "성별", value: user.gender || "-" },
    { icon: FiCalendar, label: "나이", value: user.age ? `${user.age}세` : "-" },
    { icon: FiTrendingUp, label: "키", value: user.height ? `${user.height.replace(/cm$/, "")}cm` : "-" },
    { icon: FiFlag, label: "MBTI", value: user.mbti || "-" },
  ];

  return (
    <>
      <div className="flex flex-col items-center border-b border-white/8 px-5 pb-5 pt-6 text-center">
        <Avatar src={user.photo} alt={user.name} sizeClass="h-24 w-24" fallback={user.name.slice(0, 1)} />
        <h3 className="mt-3 max-w-full truncate text-[1.3rem] font-semibold text-white">{user.name}</h3>

        <div className="mt-4 flex w-full items-center gap-3 rounded-[16px] bg-white/4 px-4 py-3 text-left">
          <TrustGradeEmblem topPercent={topPercent} size="sm" />
          <div className="min-w-0 flex-1">
            <p className={cx("text-[1rem] font-semibold leading-tight", grade.className)}>{grade.name}</p>
            <p className="mt-0.5 text-[0.76rem] text-zinc-400">상위 {topPercent}%</p>
          </div>
          <p className="shrink-0 text-[1.25rem] font-semibold leading-none tracking-[-0.03em] text-white">
            {user.trustScore}
            <span className="ml-0.5 text-[0.78rem] font-normal text-zinc-400">점</span>
          </p>
        </div>
      </div>

      <dl className="space-y-2.5 border-b border-white/8 px-5 py-4">
        {rows.map((row) => {
          const Icon = row.icon;

          return (
            <div key={row.label} className="flex items-center justify-between gap-3 text-[0.9rem]">
              <dt className="flex items-center gap-2.5 text-zinc-400">
                <Icon className="text-violet-400" />
                {row.label}
              </dt>
              <dd className="text-zinc-100">{row.value}</dd>
            </div>
          );
        })}
      </dl>
    </>
  );
}

function GroupAvatar({ count, sizeClass }: { count: number; sizeClass: string }) {
  return (
    <div
      className={cx(
        "relative flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-[linear-gradient(135deg,#5b47e0,#2d2470)] text-on-accent",
        sizeClass,
      )}
    >
      <FiUsers className="text-[1.15rem]" />
      <span className="absolute -bottom-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[var(--surface)] bg-violet-500 px-1 text-[0.62rem] font-semibold">
        {count}
      </span>
    </div>
  );
}

export default function ChatExperience({ mobileView, selectedChatId }: ChatExperienceProps) {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const viewUserQuery = useUserProfileQuery(viewUserId);
  const [groupModal, setGroupModal] = useState<"create" | "invite" | null>(null);
  const [groupTitle, setGroupTitle] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [groupError, setGroupError] = useState<string | null>(null);
  const { data: isAuthenticated } = useAuthStatusQuery();
  const queryEnabled = isAuthenticated === true;
  const chatsQuery = useChatsQuery(queryEnabled);
  const profileQuery = useProfileQuery(queryEnabled);
  const currentUserIdQuery = useCurrentUserIdQuery(queryEnabled);

  useEffect(() => {
    if (isAuthenticated === false) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  const chats: ChatSummary[] = chatsQuery.data?.chats ?? [];
  const activeChatId = selectedChatId ?? chats[0]?.chatId ?? "";
  const chatQuery = useChatDetailQuery(activeChatId, queryEnabled && Boolean(activeChatId));
  const messagesQuery = useMessagesQuery(activeChatId, queryEnabled && Boolean(activeChatId));
  const sendMessageMutation = useSendMessageMutation();
  const partnersQuery = useChatPartnersQuery(queryEnabled && groupModal !== null);
  const createGroupChatMutation = useCreateGroupChatMutation();
  const inviteMembersMutation = useInviteMembersMutation(activeChatId);
  const leaveChatMutation = useLeaveChatMutation();
  const activeChat: ChatDetail | null = chatQuery.data?.chat ?? null;
  const messages: ChatMessage[] = messagesQuery.data?.messages ?? [];
  const currentUserId = currentUserIdQuery.data ?? "";
  const onlineIds = useOnlineUserIds(currentUserId || undefined);
  const otherOnline = Boolean(activeChat?.otherUser.userId && onlineIds.includes(activeChat.otherUser.userId));
  // 대화방 정보를 불러오는 동안 헤더(이름·신뢰 점수)는 스켈레톤으로 보여준다
  const headerLoading = Boolean(activeChatId) && !activeChat;
  const loading =
    isAuthenticated === undefined ||
    chatsQuery.isPending ||
    profileQuery.isPending ||
    currentUserIdQuery.isPending ||
    (activeChatId ? chatQuery.isPending || messagesQuery.isPending : false);
  const queryError =
    chatsQuery.error ??
    profileQuery.error ??
    currentUserIdQuery.error ??
    chatQuery.error ??
    messagesQuery.error;
  const error =
    actionError ??
    (queryError instanceof Error
      ? queryError.message
      : queryError
        ? "채팅 정보를 불러오지 못했습니다."
        : null);

  const selectedSummary = chats.find((chat) => chat.chatId === activeChatId) ?? chats[0] ?? null;
  const otherName = activeChat?.otherUser.name ?? selectedSummary?.otherUser.name ?? "대화 상대";
  const otherPhoto = activeChat?.otherUser.photos?.[0] ?? selectedSummary?.otherUser.photos?.[0];
  const isGroupChat = activeChat?.isGroup ?? selectedSummary?.isGroup ?? false;
  const groupTitleText = activeChat?.title ?? selectedSummary?.title ?? "단체 채팅";
  // 글로 시작한 1:1 대화는 글 제목을 방 이름으로 쓴다
  const postTitle = activeChat?.postTitle ?? selectedSummary?.postTitle ?? null;
  // 매칭이 거절되면 방이 닫혀 메시지를 보낼 수 없다
  const chatClosed = Boolean(activeChat?.closedReason);
  const groupMemberCount = activeChat?.members.length ?? selectedSummary?.memberCount ?? 0;
  const memberMap = new Map((activeChat?.members ?? []).map((member) => [member.userId, member]));
  const partners = partnersQuery.data?.partners ?? [];
  const selectablePartners =
    groupModal === "invite" ? partners.filter((partner) => !memberMap.has(partner.userId)) : partners;

  const openGroupModal = (mode: "create" | "invite") => {
    setGroupModal(mode);
    setGroupTitle("");
    setSelectedMemberIds([]);
    setGroupError(null);
  };

  const toggleMember = (userId: string) => {
    setSelectedMemberIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  };

  const handleSubmitGroup = async () => {
    setGroupError(null);

    try {
      if (groupModal === "create") {
        if (selectedMemberIds.length < 2) {
          setGroupError("나를 빼고 2명 이상 선택해 주세요.");
          return;
        }
        const response = await createGroupChatMutation.mutateAsync({
          title: groupTitle,
          memberIds: selectedMemberIds,
        });
        setGroupModal(null);
        router.push(`/chat/${response.chatId}`);
        return;
      }

      if (selectedMemberIds.length === 0) {
        setGroupError("초대할 사람을 선택해 주세요.");
        return;
      }
      await inviteMembersMutation.mutateAsync(selectedMemberIds);
      setGroupModal(null);
      setNotice(`${selectedMemberIds.length}명을 초대했습니다.`);
    } catch (err) {
      setGroupError(err instanceof Error ? err.message : "요청 처리에 실패했습니다.");
    }
  };

  const handleLeaveChat = async () => {
    try {
      await leaveChatMutation.mutateAsync(activeChatId);
      setProfileSheetOpen(false);
      router.push("/chats");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "채팅방을 나가지 못했습니다.");
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // 채팅방을 열어 둔 상태에서 메시지가 보이면 읽음으로 기록한다.
  const lastMessageId = messages.at(-1)?.messageId;
  useEffect(() => {
    if (!activeChatId || !queryEnabled || lastMessageId === undefined) {
      return;
    }

    const mark = () => {
      if (document.visibilityState === "visible") {
        void markChatRead(activeChatId).catch(() => {});
      }
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [activeChatId, queryEnabled, lastMessageId]);

  // 내 메시지를 몇 명이 읽었는지: 나를 뺀 참여자 중 마지막으로 읽은 시각이 메시지 시각 이후인 사람 수
  const otherMembers = (activeChat?.members ?? []).filter((member) => member.userId !== currentUserId);
  const countReaders = (timestamp: string) => {
    const sentAt = new Date(timestamp).getTime();
    return otherMembers.filter((member) => member.lastReadAt && new Date(member.lastReadAt).getTime() >= sentAt)
      .length;
  };

  const handleSelectChat = (chatId: string) => {
    router.push(`/chat/${chatId}`);
  };

  const handleSendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!newMessage.trim() || !activeChatId) {
      return;
    }

    try {
      await sendMessageMutation.mutateAsync({
        chatId: activeChatId,
        message: newMessage.trim(),
      });
      setNewMessage("");
      setActionError(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "메시지 전송에 실패했습니다.");
    }
  };

  const renderListItem = (chat: ChatSummary) => {
    const isActive = chat.chatId === activeChatId;

    return (
      <button
        key={chat.chatId}
        type="button"
        onClick={() => handleSelectChat(chat.chatId)}
        className={cx("chat-list-item w-full", isActive && "chat-list-item-active")}
      >
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            {chat.isGroup ? (
              <GroupAvatar count={chat.memberCount} sizeClass="h-14 w-14" />
            ) : (
              <Avatar
                src={chat.otherUser.photos?.[0]}
                alt={chat.otherUser.name}
                sizeClass="h-14 w-14"
                fallback={chat.otherUser.name.slice(0, 1)}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                {chat.closed && (
                  <span className="shrink-0 rounded-md bg-white/8 px-1.5 py-[1px] text-[0.68rem] font-semibold text-zinc-400">종료</span>
                )}
                {chat.priorityIncoming && (
                  <span className="shrink-0 rounded-md bg-violet-500/25 px-1.5 py-[1px] text-[0.68rem] font-bold text-violet-200">💜 진심</span>
                )}
                {/* 글로 시작한 대화는 글 제목이 방 이름, 상대 이름은 작게 */}
                <p className="chat-name-md line-clamp-1 font-semibold text-white">{chat.postTitle ?? chat.title}</p>
              </div>
              {chat.lastMessage && (
                <span className="chat-meta-text shrink-0 text-zinc-500">{formatListTime(chat.lastMessage.timestamp)}</span>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="chat-body-text line-clamp-1 text-zinc-300">
                {chat.postTitle && <span className="font-medium text-zinc-400">{chat.otherUser.name} · </span>}
                {chat.lastMessage?.message ?? (chat.isGroup ? `참여자 ${chat.memberCount}명` : "아직 대화가 없어요")}
              </p>
            </div>
          </div>
        </div>
      </button>
    );
  };

  const renderMessages = () => {
    if (!activeChatId) {
      return (
        <div className="chat-panel-soft flex h-full items-center justify-center p-8 text-sm text-zinc-400">
          선택한 채팅이 없습니다.
        </div>
      );
    }

    if (messagesQuery.isPending) {
      return (
        <div className="flex h-full flex-col justify-end gap-3 p-4">
          {["w-[44%]", "w-[60%]", "w-[36%]", "w-[52%]"].map((widthClass, index) => (
            <Skeleton
              key={widthClass}
              className={cx("h-10 rounded-[18px]", widthClass, index % 2 === 0 ? "self-start" : "self-end")}
            />
          ))}
        </div>
      );
    }

    if (messages.length === 0) {
      return (
        <div className="chat-panel-soft flex h-full items-center justify-center p-8 text-sm text-zinc-400">
          아직 대화가 없습니다. 첫 메시지를 보내 보세요.
        </div>
      );
    }

    const GROUP_GAP_MS = 3 * 60 * 1000;
    const dayKey = (timestamp: string) => new Date(timestamp).toDateString();
    const formatDay = (timestamp: string) =>
      new Date(timestamp).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });

    return (
      <div className="flex flex-col">
        {messages.map((message, index) => {
          const prev = messages[index - 1];
          const next = messages[index + 1];
          const mine = message.userId === currentUserId;
          const sender = memberMap.get(message.userId);
          const newDay = !prev || dayKey(prev.timestamp) !== dayKey(message.timestamp);
          // 같은 사람이 3분 안에 이어서 보낸 메시지는 한 묶음: 사진·이름은 첫 메시지, 시간은 마지막 메시지에만
          const joinsPrev =
            !newDay &&
            prev?.kind === "text" &&
            prev.userId === message.userId &&
            new Date(message.timestamp).getTime() - new Date(prev.timestamp).getTime() < GROUP_GAP_MS;
          const joinsNext =
            next?.kind === "text" &&
            next.userId === message.userId &&
            dayKey(next.timestamp) === dayKey(message.timestamp) &&
            new Date(next.timestamp).getTime() - new Date(message.timestamp).getTime() < GROUP_GAP_MS;
          const readers = mine && !joinsNext ? countReaders(message.timestamp) : 0;

          return (
            <div key={message.messageId}>
              {newDay && (
                <div className={cx("mb-2 flex items-center gap-3 text-[0.72rem] text-zinc-500", index === 0 ? "mt-0" : "mt-6")}>
                  <span className="h-px flex-1 bg-white/6" />
                  {formatDay(message.timestamp)}
                  <span className="h-px flex-1 bg-white/6" />
                </div>
              )}

              {message.kind === "system" ? (
                <div className="mt-4 flex justify-center">
                  <div className="max-w-[85%] rounded-[14px] border border-rose-500/30 bg-rose-500/8 px-4 py-2.5 text-center">
                    <p className="text-[0.82rem] font-semibold text-rose-200">
                      {mine ? "매치를 취소했습니다." : "상대방이 매치를 취소하였습니다."}
                    </p>
                    <p className="mt-0.5 break-keep text-[0.78rem] text-zinc-300">사유: {message.message}</p>
                    <p className="mt-0.5 text-[0.68rem] text-zinc-500">{formatMessageTime(message.timestamp)}</p>
                  </div>
                </div>
              ) : (
              <div className={cx("flex gap-2", mine ? "justify-end" : "justify-start", joinsPrev ? "mt-1 dark:mt-2" : "mt-3 dark:mt-4")}>
                {!mine &&
                  (joinsPrev ? (
                    <span className="w-9 shrink-0" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setViewUserId(message.userId)}
                      aria-label={`${sender?.name ?? message.userName} 정보 보기`}
                      className="h-fit shrink-0 rounded-full transition hover:opacity-80"
                    >
                      <Avatar
                        src={isGroupChat ? sender?.photos?.[0] : otherPhoto}
                        alt={message.userName}
                        sizeClass="h-9 w-9"
                        fallback={(isGroupChat ? (sender?.name ?? message.userName) : otherName).slice(0, 1)}
                      />
                    </button>
                  ))}

                <div className={cx("flex min-w-0 max-w-[75%] flex-col md:max-w-[60%]", mine ? "items-end" : "items-start")}>
                  {isGroupChat && !mine && !joinsPrev && (
                    <p className="mb-1 text-[0.76rem] text-zinc-400">{sender?.name ?? message.userName}</p>
                  )}
                  <div className={cx("flex items-end gap-1.5", mine && "flex-row-reverse")}>
                    <div
                      className={cx(
                        "rounded-[18px] px-3.5 py-2 text-[0.9rem] leading-[1.45]",
                        mine
                          ? "bg-[linear-gradient(135deg,rgba(93,68,234,0.98),rgba(114,76,240,0.96))] text-on-accent"
                          : "bg-bubble text-zinc-100",
                        mine && !joinsPrev && "rounded-tr-[6px]",
                        !mine && !joinsPrev && "rounded-tl-[6px]",
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.message}</p>
                    </div>
                    {!joinsNext && (
                      <span className={cx("flex shrink-0 flex-col pb-0.5 text-[0.68rem] leading-tight text-zinc-500", mine ? "items-end" : "items-start")}>
                        {readers > 0 && (
                          <span className="text-violet-300">{isGroupChat ? `${readers}명 읽음` : "읽음"}</span>
                        )}
                        {formatMessageTime(message.timestamp)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
    );
  };

  // 상대 프로필: 내 정보 화면과 같은 항목. 신뢰 등급·점수를 가장 위에 크게 보여준다.
  const otherTrustScore = activeChat?.otherUser.trustScore ?? 70;
  const { grade: otherGrade } = getTrustGrade(estimateTopPercent(otherTrustScore));

  const profileCard = (
    <>
      <UserInfoCard
        user={{
          name: otherName,
          photo: otherPhoto,
          gender: activeChat?.otherUser.gender,
          age: activeChat?.otherUser.age,
          height: activeChat?.otherUser.height,
          mbti: activeChat?.otherUser.mbti,
          trustScore: otherTrustScore,
        }}
      />
    </>
  );

  const groupCard = (
    <>
      <div className="flex flex-col items-center border-b border-white/8 px-5 py-4 text-center">
        <GroupAvatar count={groupMemberCount} sizeClass="h-16 w-16" />
        <h3 className="chat-panel-title mt-3.5 line-clamp-2 font-semibold text-white">{groupTitleText}</h3>
        <p className="chat-body-text mt-1.5 text-zinc-400">참여자 {groupMemberCount}명</p>
      </div>

      <div className="border-b border-white/8 px-5 py-4">
        <div className="flex items-center justify-between">
          <h4 className="text-[1.05rem] font-semibold text-white">참여자</h4>
          <button
            type="button"
            onClick={() => openGroupModal("invite")}
            className="flex h-8 items-center gap-1.5 rounded-[10px] bg-[linear-gradient(135deg,#6f56ff,#7b50f3)] px-3 text-[0.8rem] font-medium text-on-accent transition hover:brightness-110"
          >
            <FiUserPlus className="text-[0.85rem]" />
            초대
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {(activeChat?.members ?? []).map((member) => (
            <li key={member.userId} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setViewUserId(member.userId)}
                aria-label={`${member.name} 정보 보기`}
                className="shrink-0 rounded-full transition hover:opacity-80"
              >
                <Avatar src={member.photos?.[0]} alt={member.name} sizeClass="h-9 w-9" fallback={member.name.slice(0, 1)} />
              </button>
              <span className="min-w-0 flex-1 truncate text-[0.92rem] text-zinc-100">
                {member.name}
                {member.userId === currentUserId && <span className="ml-1.5 text-[0.78rem] text-zinc-500">(나)</span>}
              </span>
              {member.role === "owner" && (
                <span className="rounded-full bg-amber-400/14 px-2 py-0.5 text-[0.7rem] font-medium text-amber-200">방장</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="px-5 py-4">
        <button
          type="button"
          onClick={() => void handleLeaveChat()}
          disabled={leaveChatMutation.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-rose-400/25 py-2.5 text-[0.88rem] font-medium text-rose-200 transition hover:bg-rose-500/10 disabled:opacity-60"
        >
          <FiLogOut />
          {leaveChatMutation.isPending ? "나가는 중..." : "채팅방 나가기"}
        </button>
      </div>
    </>
  );

  const sideCard = isGroupChat ? groupCard : profileCard;

  const isDetail = mobileView === "detail";

  return (
    <MainLayout
      active="chats"
      title="채팅"
      copy="진짜 만남은 신뢰에서 시작됩니다."
      maxWidthClassName="max-w-[1320px]"
      fullHeight
      hideMobileNav={isDetail}
      hideMobileHeader={isDetail}
    >
      <div className="mt-4 grid min-h-0 flex-1 gap-4 md:grid-cols-[300px_minmax(0,1fr)] xl:mt-5 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
        {/* 대화 목록: 모바일에서는 /chats 화면에서만 보인다 */}
        <section className={cx("chat-panel min-h-0 flex-col overflow-hidden", isDetail ? "hidden md:flex" : "flex")}>
          <div className="border-b border-white/7 px-4 pt-3">
            <div className="flex justify-between gap-2">
              {listTabs.map((tab, index) => (
                <button
                  key={tab}
                  type="button"
                  className={cx("chat-tab flex-1 whitespace-nowrap px-0", index === 0 && "chat-tab-active")}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="px-3 pt-3">
            <button
              type="button"
              onClick={() => openGroupModal("create")}
              className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-dashed border-violet-400/35 py-2.5 text-[0.86rem] font-medium text-violet-200 transition hover:bg-violet-500/10"
            >
              <FiUsers />
              단체 채팅 만들기
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {loading && chats.length === 0 ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className="flex items-center gap-3 px-2 py-2.5">
                    <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-28 rounded-md" />
                      <Skeleton className="h-3.5 w-44 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            ) : chats.length === 0 ? (
              <div className="p-4 text-sm text-zinc-400">아직 생성된 채팅방이 없습니다.</div>
            ) : (
              <div className="space-y-2">{chats.map(renderListItem)}</div>
            )}
          </div>

        </section>

        {/* 대화창: 모바일에서는 /chat/:id 화면에서만 보인다 */}
        <section className={cx("chat-panel min-h-0 flex-col overflow-hidden", isDetail ? "flex" : "hidden md:flex")}>
          <div className="flex items-center gap-3 border-b border-white/7 px-4 py-3.5 md:px-5">
            <button
              type="button"
              onClick={() => router.push("/chats")}
              aria-label="채팅 목록으로"
              className="text-white md:hidden"
            >
              <FiChevronLeft className="text-[1.4rem]" />
            </button>
            <button
              type="button"
              onClick={() => setProfileSheetOpen(true)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left xl:pointer-events-none"
            >
              {headerLoading && !selectedSummary ? (
                <Skeleton className="h-11 w-11 shrink-0 rounded-full md:h-12 md:w-12" />
              ) : isGroupChat ? (
                <GroupAvatar count={groupMemberCount} sizeClass="h-11 w-11 md:h-12 md:w-12" />
              ) : (
                <Avatar src={otherPhoto} alt={otherName} sizeClass="h-11 w-11 shrink-0 md:h-12 md:w-12" fallback={otherName.slice(0, 1)} />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {headerLoading && !selectedSummary ? (
                    <Skeleton className="h-5 w-28 rounded-md" />
                  ) : (
                    <h2 className="truncate text-[1.05rem] font-semibold text-white md:text-[1.15rem]">
                      {isGroupChat ? groupTitleText : (postTitle ?? otherName)}
                    </h2>
                  )}
                  {!isGroupChat && otherOnline && (
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[0.72rem] font-medium text-emerald-300">
                      ONLINE
                    </span>
                  )}
                </div>
                {headerLoading ? (
                  <Skeleton className="mt-1.5 h-3.5 w-36 rounded-md" />
                ) : (
                  <p className="chat-meta-text mt-0.5 truncate text-zinc-300">
                    {isGroupChat
                      ? `참여자 ${groupMemberCount}명`
                      : `${postTitle ? `${otherName} · ` : ""}${otherGrade.name} · 신뢰 점수 ${otherTrustScore}점`}
                  </p>
                )}
              </div>
            </button>
            {activeChat && !isGroupChat && (
              <MatchWithdrawButton chatId={activeChat.chatId} onNotice={setNotice} onError={setActionError} />
            )}
          </div>

          <div className="border-b border-white/7 px-4 py-2.5 md:px-5">
            <div className="flex items-center gap-2.5 text-zinc-200">
              <FiShield className="shrink-0 text-zinc-100" />
              <p className="chat-meta-text">조각은 안전한 대화를 지원합니다.</p>
            </div>
          </div>

          {/* 1:1 매칭: 요청·수락·매칭 중(위치·만났어요)·감점 예정 조치 */}
          {activeChat && !isGroupChat && currentUserId && (
            <div className="border-b border-white/7 px-4 py-3 md:px-5">
              <MatchPanel
                chatId={activeChat.chatId}
                currentUserId={currentUserId}
                partnerUserId={activeChat.otherUser.userId}
                partnerName={otherName}
                partnerAvatar={activeChat.otherUser.photos?.[0]}
                closedReason={activeChat.closedReason}
                onNotice={setNotice}
                onError={setActionError}
              />
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5">{renderMessages()}</div>

          <form onSubmit={handleSendMessage} className="border-t border-white/7 px-4 py-3 md:px-5">
            <div className="chat-input-shell flex items-center gap-3 px-4 py-2.5">
              <input
                value={newMessage}
                onChange={(event) => setNewMessage(event.target.value)}
                placeholder={chatClosed ? "종료된 대화예요" : "메시지를 입력하세요..."}
                disabled={chatClosed}
                className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
              />
              <button type="button" className="text-zinc-400">
                <FiMoreHorizontal className="text-xl" />
              </button>
              <button type="button" className="text-zinc-400">
                <FiImage className="text-lg" />
              </button>
              <button
                type="submit"
                disabled={sendMessageMutation.isPending || chatClosed}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[linear-gradient(135deg,#5f49eb,#724bf0)] text-on-accent disabled:opacity-60"
              >
                <FiSend />
              </button>
            </div>
          </form>
        </section>

        {/* 상대 프로필: PC에서는 오른쪽 단, 그보다 좁으면 아래에서 올라오는 창 */}
        <aside className="chat-panel hidden min-h-0 overflow-y-auto xl:block">
          {activeChat ? (
            sideCard
          ) : headerLoading ? (
            <div className="space-y-3 p-6">
              <Skeleton className="mx-auto h-24 w-24 rounded-full" />
              <Skeleton className="mx-auto h-5 w-32 rounded-md" />
              <Skeleton className="h-28 rounded-[14px]" />
            </div>
          ) : (
            <div className="p-6 text-sm text-zinc-400">대화를 선택해 주세요.</div>
          )}
        </aside>
      </div>

      {profileSheetOpen && (
        <div className="fixed inset-0 z-[120] bg-black/55 xl:hidden" onClick={() => setProfileSheetOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-0 mx-auto max-h-[85dvh] max-w-[560px] overflow-y-auto rounded-t-[2rem] border border-white/8 bg-[linear-gradient(180deg,var(--surface),var(--surface-end))] px-5 pb-6 pt-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/20" />
            <div className="mb-4 flex items-center justify-between">
              <h3 className="chat-panel-title font-semibold text-white">{isGroupChat ? "참여자" : ""}</h3>
              <button type="button" onClick={() => setProfileSheetOpen(false)} aria-label="닫기" className="text-white">
                <FiX className="text-[1.3rem]" />
              </button>
            </div>
            <div className="chat-panel-soft overflow-hidden">
              {activeChat ? (
                sideCard
              ) : headerLoading ? (
                <div className="space-y-3 p-6">
              <Skeleton className="mx-auto h-24 w-24 rounded-full" />
              <Skeleton className="mx-auto h-5 w-32 rounded-md" />
              <Skeleton className="h-28 rounded-[14px]" />
            </div>
              ) : (
                <div className="p-6 text-sm text-zinc-400">대화를 선택해 주세요.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewUserId && (
        // 헤더를 눌렀을 때 뜨는 창과 같은 모양(아래에서 올라오는 창)으로 보여준다.
        <div className="fixed inset-0 z-[120] bg-black/55" onClick={() => setViewUserId(null)}>
          <div
            className="absolute inset-x-0 bottom-0 mx-auto max-h-[85dvh] max-w-[560px] overflow-y-auto rounded-t-[2rem] border border-white/8 bg-[linear-gradient(180deg,var(--surface),var(--surface-end))] px-5 pb-6 pt-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/20" />
            <div className="mb-4 flex items-center justify-end">
              <button type="button" onClick={() => setViewUserId(null)} aria-label="닫기" className="text-white">
                <FiX className="text-[1.3rem]" />
              </button>
            </div>
            <div className="chat-panel-soft overflow-hidden">
              {viewUserQuery.data ? (
                <>
                  <UserInfoCard
                    user={{
                      name: viewUserQuery.data.name,
                      photo: viewUserQuery.data.photos[0],
                      gender: viewUserQuery.data.gender,
                      age: viewUserQuery.data.age,
                      height: viewUserQuery.data.height,
                      mbti: viewUserQuery.data.mbti,
                      trustScore: viewUserQuery.data.trustScore,
                    }}
                  />
                </>
              ) : (
                viewUserQuery.isError ? (
                  <p className="px-6 py-16 text-center text-[0.9rem] text-zinc-400">사용자 정보를 불러오지 못했어요.</p>
                ) : (
                  <div className="space-y-3 p-6">
              <Skeleton className="mx-auto h-24 w-24 rounded-full" />
              <Skeleton className="mx-auto h-5 w-32 rounded-md" />
              <Skeleton className="h-28 rounded-[14px]" />
            </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {groupModal && (
        <div className="modal-overlay" onClick={() => setGroupModal(null)}>
          <div className="modal-card max-w-md" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-[1.2rem] font-semibold text-white">
                {groupModal === "create" ? "단체 채팅 만들기" : "참여자 초대"}
              </h3>
              <button type="button" onClick={() => setGroupModal(null)} aria-label="닫기" className="text-zinc-300 hover:text-white">
                <FiX className="text-[1.3rem]" />
              </button>
            </div>

            {groupModal === "create" && (
              <label className="label-text mt-4">
                채팅방 이름 (선택)
                <input
                  className="input-field"
                  value={groupTitle}
                  maxLength={30}
                  onChange={(event) => setGroupTitle(event.target.value)}
                  placeholder="비워 두면 참여자 이름으로 만들어요"
                />
              </label>
            )}

            <p className="mt-4 text-[0.84rem] text-zinc-400">
              {groupModal === "create"
                ? "대화한 적 있는 사람 중 2명 이상 선택해 주세요."
                : "대화한 적 있는 사람 중 초대할 사람을 선택해 주세요."}
            </p>
            <ul className="mt-2.5 max-h-72 space-y-1.5 overflow-y-auto">
              {partnersQuery.isPending ? (
                Array.from({ length: 3 }, (_, index) => (
                  <li key={index} className="flex items-center gap-3 px-3 py-2.5">
                    <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                    <Skeleton className="h-4 w-28 rounded-md" />
                  </li>
                ))
              ) : selectablePartners.length === 0 ? (
                <li className="rounded-[12px] bg-white/4 px-3 py-4 text-center text-[0.86rem] text-zinc-400">
                  {groupModal === "create" ? "아직 대화한 사람이 없어요." : "초대할 수 있는 사람이 없어요."}
                </li>
              ) : (
                selectablePartners.map((partner) => {
                  const checked = selectedMemberIds.includes(partner.userId);

                  return (
                    <li key={partner.userId}>
                      <button
                        type="button"
                        onClick={() => toggleMember(partner.userId)}
                        className={cx(
                          "flex w-full items-center gap-3 rounded-[12px] border px-3 py-2.5 text-left transition",
                          checked ? "border-violet-400/60 bg-violet-500/15" : "border-white/8 bg-white/3 hover:border-white/20",
                        )}
                      >
                        <Avatar
                          src={partner.photos?.[0]}
                          alt={partner.name}
                          sizeClass="h-9 w-9 shrink-0"
                          fallback={partner.name.slice(0, 1)}
                        />
                        <span className="min-w-0 flex-1 truncate text-[0.92rem] text-zinc-100">{partner.name}</span>
                        <span
                          className={cx(
                            "flex h-5 w-5 items-center justify-center rounded-full border",
                            checked ? "border-violet-400 bg-violet-500 text-on-accent" : "border-white/25",
                          )}
                        >
                          {checked && <FiCheck className="text-[0.75rem]" />}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>

            {groupError && <div className="alert-error mt-3">{groupError}</div>}

            <button
              type="button"
              onClick={() => void handleSubmitGroup()}
              disabled={createGroupChatMutation.isPending || inviteMembersMutation.isPending}
              className="btn-primary mt-5 w-full py-3"
            >
              {groupModal === "create"
                ? `${selectedMemberIds.length}명과 단체 채팅 시작`
                : `${selectedMemberIds.length}명 초대하기`}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed right-4 top-4 z-[130] rounded-2xl border border-rose-400/20 bg-rose-950/80 px-4 py-3 text-sm text-rose-100 shadow-xl">
          {error}
        </div>
      )}
      {notice && (
        <div className="fixed left-1/2 top-4 z-[130] -translate-x-1/2 rounded-2xl border border-emerald-400/20 bg-emerald-950/80 px-4 py-3 text-sm text-emerald-100 shadow-xl">
          {notice}
        </div>
      )}
    </MainLayout>
  );
}
