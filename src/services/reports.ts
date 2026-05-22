import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

export const REPORT_REASONS = [
  'Spam',
  'Harassment or bullying',
  'Hate or abusive content',
  'Nudity or sexual content',
  'Violence or dangerous content',
  'Stolen photo / copyright',
  'Other',
] as const;

export const REPORT_STATUSES = [
  'open',
  'reviewed',
  'action_taken',
  'dismissed',
] as const;

export type ReportReason = typeof REPORT_REASONS[number];
export type ReportStatus = typeof REPORT_STATUSES[number];
export type ReportTargetType = 'spot' | 'comment' | 'reply' | 'user';

export type SubmitReportInput = {
  targetType: ReportTargetType;
  targetId: string;
  targetOwnerId?: string | null;
  reason: ReportReason;
  details?: string;
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

export type ReportModerationFields = {
  status: ReportStatus;
  reviewedAt?: unknown;
  reviewedBy?: string;
  reviewNote?: string;
  actionTaken?: string;
};

export function isDuplicateReportError(error: unknown) {
  return error instanceof Error && error.message === 'DUPLICATE_RECENT_REPORT';
}

function cleanString(value: string | null | undefined) {
  const cleanValue = value?.trim();
  return cleanValue || undefined;
}

function omitUndefinedFields(fields: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined)
  );
}

export async function submitReport(input: SubmitReportInput) {
  if (!db) throw new Error('Firestore is not configured.');

  const authenticatedUser = auth?.currentUser;
  if (!authenticatedUser) throw new Error('You must be signed in to submit a report.');

  // Reporter fields are intentionally derived from Firebase Auth here.
  // Callers only describe the reported target so reporterId cannot be confused with targetOwnerId.
  const reporterId = authenticatedUser.uid;
  const reporterEmail = authenticatedUser.email || '';
  const targetId = input.targetId.trim();
  const targetOwnerId = input.targetOwnerId?.trim() || null;
  const details = input.details?.trim() || '';

  if (!targetId) throw new Error('A report target is required.');
  if (targetOwnerId && targetOwnerId === reporterId) {
    throw new Error('You cannot report your own content.');
  }

  // TODO(admin): Build a moderation dashboard that lists open reports, groups repeat
  // reports by target, and records moderator decisions without deleting content automatically.
  const reportRef = await addDoc(collection(db, 'reports'), omitUndefinedFields({
    reporterId,
    reporterEmail,
    targetType: input.targetType,
    targetId,
    targetOwnerId,
    reason: input.reason,
    details,
    status: 'open' satisfies ReportStatus,
    createdAt: serverTimestamp(),
    spotId: cleanString(input.spotId),
    spotTitle: cleanString(input.spotTitle),
    spotImageUrls: input.spotImageUrls?.filter(Boolean),
    spotOwnerId: cleanString(input.spotOwnerId),
    spotOwnerDisplayName: cleanString(input.spotOwnerDisplayName),
    commentId: cleanString(input.commentId),
    commentText: cleanString(input.commentText),
    commentOwnerId: cleanString(input.commentOwnerId),
    replyId: cleanString(input.replyId),
    replyText: cleanString(input.replyText),
    replyOwnerId: cleanString(input.replyOwnerId),
    reportedUserId: cleanString(input.reportedUserId),
    reportedUserDisplayName: cleanString(input.reportedUserDisplayName),
    reportedUserHandle: cleanString(input.reportedUserHandle),
  }));

  return reportRef.id;
}
