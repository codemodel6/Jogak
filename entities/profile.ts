export type Profile = {
  userId?: string;
  name?: string;
  height?: string;
  age?: string;
  location?: string;
  hearts?: number;
  photos?: string[];
  hasActiveMatch?: boolean;
  gender?: string;
  mbti?: string;
  purpose?: string;
  photosPrivate?: boolean;
  // 프로필 아이콘(채팅·상대 정보에 보이는 사진). 없으면 기본 이미지.
  avatarUrl?: string;
  // 실물 사진(비공개 저장소 경로). 없으면 '실물 등록 안 함'.
  facePhotoPath?: string;
  hasFacePhoto?: boolean;
  onboarded?: boolean;
  trustScore?: number;
  introduction?: string;
};
