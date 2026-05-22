import type { Timestamp } from 'firebase/firestore';

export type ReportStatus = 'open' | 'reviewed' | 'action_taken' | 'dismissed';
export type ReportTargetType = 'spot' | 'comment' | 'reply' | 'user';

export type Report = {
  id: string;
  status: ReportStatus;
  targetType?: ReportTargetType;
  targetId?: string;
  targetOwnerId?: string | null;
  reporterId?: string;
  reporterEmail?: string;
  reason?: string;
  details?: string;
  createdAt?: Timestamp;
  reviewedAt?: Timestamp;
  reviewedBy?: string;
  reviewNote?: string;
  actionTaken?: string;
  spotId?: string;
  spotTitle?: string;
  spotImageUrls?: string[];
  spotOwnerId?: string | null;
  spotOwnerDisplayName?: string;
  commentId?: string;
  commentText?: string;
  commentOwnerId?: string | null;
  replyId?: string;
  replyText?: string;
  replyOwnerId?: string | null;
  reportedUserId?: string;
  reportedUserDisplayName?: string;
  reportedUserHandle?: string;
};

export type AdminUser = {
  uid: string;
  email: string | null;
  role?: string;
};

export type ModeratedUser = {
  id: string;
  username?: string;
  displayName?: string;
  email?: string;
  isBanned?: boolean;
  banReason?: string;
};

export type ModeratedSpot = {
  id: string;
  title?: string;
  isRemoved?: boolean;
  removedReason?: string;
};
