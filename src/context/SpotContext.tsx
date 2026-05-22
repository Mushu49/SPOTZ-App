// filepath: src/context/SpotContext.tsx
import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  collection,
  deleteDoc,
  disableNetwork,
  DocumentReference,
  doc,
  DocumentData,
  enableNetwork,
  getDoc,
  getDocs,
  getDocsFromServer,
  Firestore,
  onSnapshot,
  orderBy,
  query,
  Query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  WriteBatch,
  writeBatch,
} from 'firebase/firestore';
import { updateProfile } from '@firebase/auth';
import {
  AppSettings,
  PhotoSpot,
  SpotImageAsset,
  SpotComment,
  SpotReply,
  User,
  getSpotCategoryIds,
  normalizePhotoCategory,
} from '../types';
import { clearPersistedImagesAsync, normalizeImageUri, normalizeImageUris } from '../utils/images';
import { ONBOARDING_COMPLETED_STORAGE_KEY } from '../utils/onboarding';
import { auth, db, isFirebaseConfigured } from '../services/firebase';
import { uploadProfileImageToCloudinary, uploadSpotImagesToCloudinary } from '../services/cloudinary';
import { upsertPublicCreatorProfile } from '../services/publicProfiles';
import { demoSpots, isDemoSpotId } from '../data/demoSpots';
import { isSpotzDemoModeEnabled } from '../utils/demoMode';
import {
  createNotificationDocument,
  maybeRequestNotificationsAfterInteraction,
  setNotificationsEnabledForUser,
} from '../services/notifications';
import { useAuth } from './AuthContext';

type CommentsBySpot = Record<string, SpotComment[]>;
type FirestoreDate = { toDate?: () => Date } | Date | string | number | null | undefined;
type SpotRefreshResult = {
  spots: PhotoSpot[];
  comments: CommentsBySpot;
};
type RefreshLocationState = {
  latitude: number;
  longitude: number;
} | null;
type RefreshSpotsOptions = {
  source?: 'discover' | 'manual';
  activeTab?: string;
  selectedCategory?: string;
  locationFeaturesEnabled?: boolean;
  locationPermissionStatus?: string;
  isLocationAccessEnabled?: boolean;
  location?: RefreshLocationState;
};
export type AddSpotProgressPhase = 'preparing' | 'uploading' | 'saving' | 'done';
export type AddSpotProgress = {
  phase: AddSpotProgressPhase;
  message: string;
  progress?: number;
};
type AddSpotOptions = {
  onProgress?: (progress: AddSpotProgress) => void;
};

interface SpotContextType {
  spots: PhotoSpot[];
  favorites: string[];
  user: User;
  comments: CommentsBySpot;
  settings: AppSettings;
  isSyncing: boolean;
  isUserDataLoading: boolean;
  syncError?: string;
  updateUserProfile: (profile: Pick<User, 'displayName' | 'bio' | 'profileImage'>) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetAppData: () => Promise<void>;
  deleteAllSpotsFromDatabase: () => Promise<void>;
  refreshSpots: (options?: RefreshSpotsOptions) => Promise<SpotRefreshResult>;
  addSpot: (spot: Omit<PhotoSpot, 'id' | 'createdAt' | 'createdBy'>, options?: AddSpotOptions) => Promise<void>;
  deleteSpot: (spotId: string) => Promise<boolean>;
  toggleFavorite: (spotId: string) => Promise<void>;
  addComment: (spotId: string, text: string) => Promise<void>;
  addReply: (spotId: string, rootCommentId: string, parentId: string, text: string) => Promise<void>;
  toggleCommentLike: (spotId: string, commentId: string) => Promise<void>;
  toggleReplyLike: (spotId: string, commentId: string, replyId: string) => Promise<void>;
  deleteComment: (spotId: string, commentId: string) => Promise<boolean>;
  deleteReply: (spotId: string, commentId: string, replyId: string) => Promise<boolean>;
  getSpotById: (id: string) => PhotoSpot | undefined;
  getSpotsByCategory: (category: string) => PhotoSpot[];
  getFavoriteSpots: () => PhotoSpot[];
  getSpotComments: (spotId: string) => SpotComment[];
}

const defaultUser: User = {
  id: 'currentUser',
  username: 'Photographer',
  usernameLower: 'photographer',
  displayName: 'Photographer',
  email: '',
  bio: 'Photography enthusiast',
  profileImage: undefined,
  showProfileImageInComments: true,
  isBanned: false,
  uploadedSpots: [],
  savedSpots: [],
};

const defaultSettings: AppSettings = {
  language: 'English',
  defaultMapApp: 'apple',
  notificationsEnabled: true,
  themePreference: 'dark',
  showProfileImageInComments: true,
};

const STORAGE_KEYS = {
  USER_PREFIX: '@spotz_user_',
  SETTINGS: '@spotz_settings',
  DEVICE_ID: '@spotz_device_id',
};
const FIRESTORE_DELETE_BATCH_LIMIT = 450;

const SpotContext = createContext<SpotContextType | undefined>(undefined);

function normalizeSpot(spot: PhotoSpot): PhotoSpot {
  const categoryId = normalizePhotoCategory(spot.categoryId || spot.category);
  const creatorId = spot.creatorId || spot.createdBy;
  const creatorUsername = spot.creatorUsername || spot.creatorDisplayName || '';
  const creatorDisplayName = spot.creatorDisplayName || spot.creatorUsername || '';
  const visibility = spot.visibility === 'private' || spot.isPublic === false ? 'private' : 'public';

  return {
    ...spot,
    category: categoryId,
    categoryId,
    categoryIds: getSpotCategoryIds(categoryId, spot.categoryIds),
    images: normalizeImageUris(spot.images),
    imageAssets: normalizeSpotImageAssets(spot.imageAssets),
    creatorId,
    createdBy: spot.createdBy || creatorId,
    creatorUsername,
    creatorDisplayName,
    creatorAvatarUrl: normalizeImageUri(spot.creatorAvatarUrl),
    creatorShowProfileImageInComments: spot.creatorShowProfileImageInComments,
    visibility,
    isPublic: visibility === 'public',
    allowComments: spot.allowComments ?? true,
    isRemoved: spot.isRemoved === true,
  };
}

function normalizeSpotImageAssets(assets: unknown): SpotImageAsset[] {
  if (!Array.isArray(assets)) return [];

  return assets
    .map((asset) => {
      if (!asset || typeof asset !== 'object') return null;

      const record = asset as Record<string, unknown>;
      const url = typeof record.url === 'string' ? record.url.trim() : '';
      const publicId = typeof record.publicId === 'string' ? record.publicId.trim() : '';
      const provider = record.provider === 'cloudinary' ? 'cloudinary' : '';

      if (!url || !publicId || provider !== 'cloudinary') return null;

      return { url, publicId, provider } satisfies SpotImageAsset;
    })
    .filter((asset): asset is SpotImageAsset => Boolean(asset));
}

function normalizeUser(user: User): User {
  const username = user.username?.trim() || defaultUser.username;
  const displayName = user.displayName?.trim() || username;

  return {
    ...user,
    username,
    usernameLower: user.usernameLower || getNormalizedUsername(username),
    displayName,
    profileImage: normalizeImageUri(user.profileImage),
    showProfileImageInComments: user.showProfileImageInComments ?? true,
    isBanned: user.isBanned === true,
    isFounder: user.isFounder === true,
    founderNumber: typeof user.founderNumber === 'number' ? user.founderNumber : null,
    founderGrantedAt: getDate(user.founderGrantedAt) ?? null,
    proUntil: getDate(user.proUntil) ?? null,
    proSource: user.proSource === 'founder' || user.proSource === 'paid' ? user.proSource : null,
  };
}

function isUserBanned(user: Pick<User, 'isBanned'>) {
  return user.isBanned === true;
}

function getFirestoreErrorCode(error: unknown) {
  if (typeof error === 'object' && error && 'code' in error) {
    return String((error as { code?: string }).code);
  }

  return '';
}

function isPermissionDeniedError(error: unknown) {
  return getFirestoreErrorCode(error).includes('permission-denied');
}

function isExpectedBlockedFirestoreError(error: unknown, isProtectedFirestoreBlocked: boolean) {
  return isProtectedFirestoreBlocked && isPermissionDeniedError(error);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message?: string }).message || '');
  }

  return String(error || '');
}

function isUnavailableFirestoreError(error: unknown) {
  const code = getFirestoreErrorCode(error);
  const message = getErrorMessage(error).toLowerCase();

  return (
    code.includes('unavailable') ||
    message.includes('offline') ||
    message.includes('network') ||
    message.includes('transport')
  );
}

function logDevRefreshEvent(label: string, payload: Record<string, unknown>) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;

  console.log(`[SpotRefresh] ${label}`, payload);
}

function logDevRefreshError(
  label: string,
  error: unknown,
  options: RefreshSpotsOptions,
  extra: Record<string, unknown> = {}
) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;

  console.error(`[SpotRefresh] ${label}`, {
    platform: Platform.OS,
    firebaseCode: getFirestoreErrorCode(error) || 'unknown',
    message: getErrorMessage(error),
    source: options.source || 'manual',
    activeTab: options.activeTab || 'unknown',
    selectedCategory: options.selectedCategory || 'unknown',
    locationFeaturesEnabled: options.locationFeaturesEnabled ?? 'unknown',
    locationPermissionStatus: options.locationPermissionStatus || 'unknown',
    isLocationAccessEnabled: options.isLocationAccessEnabled ?? 'unknown',
    location: options.location || null,
    ...extra,
  });
}

async function resetAndroidFirestoreNetwork(firestore: Firestore) {
  if (Platform.OS !== 'android') return;

  await disableNetwork(firestore);
  await enableNetwork(firestore);
}

async function getFreshDocsWithAndroidRetry(
  firestore: Firestore,
  queryRef: Query<DocumentData>,
  queryDescription: string,
  options: RefreshSpotsOptions,
  shouldSuppressError?: (error: unknown) => boolean
) {
  try {
    return await getDocsFromServer(queryRef);
  } catch (error) {
    const shouldSuppress = shouldSuppressError?.(error) === true;

    if (isPermissionDeniedError(error)) {
      throw error;
    }

    if (!shouldSuppress) {
      logDevRefreshError('server read failed', error, options, {
        query: queryDescription,
        retryingAfterNetworkReset: Platform.OS === 'android' && isUnavailableFirestoreError(error),
      });
    }

    if (shouldSuppress || Platform.OS !== 'android' || !isUnavailableFirestoreError(error)) {
      throw error;
    }

    await resetAndroidFirestoreNetwork(firestore);
    return getDocsFromServer(queryRef);
  }
}

async function isCurrentUserBannedFromServer(firestore: Firestore, userId: string) {
  if (!userId || userId === defaultUser.id) return false;

  try {
    const userSnapshot = await getDoc(doc(firestore, 'users', userId));
    return userSnapshot.exists() && userSnapshot.data().isBanned === true;
  } catch {
    return false;
  }
}

function getUserStorageKey(userId: string) {
  return `${STORAGE_KEYS.USER_PREFIX}${userId}`;
}

function getNormalizedUsername(username: string) {
  return username.trim().toLowerCase();
}

type DeleteBatchState = {
  batch: WriteBatch;
  operationCount: number;
};

async function commitDeleteBatchIfNeeded(
  firestore: Firestore,
  state: DeleteBatchState,
  force = false
) {
  if (state.operationCount === 0 || (!force && state.operationCount < FIRESTORE_DELETE_BATCH_LIMIT)) {
    return;
  }

  await state.batch.commit();
  state.batch = writeBatch(firestore);
  state.operationCount = 0;
}

async function queueDeleteDoc(
  firestore: Firestore,
  state: DeleteBatchState,
  ref: DocumentReference<DocumentData>
) {
  state.batch.delete(ref);
  state.operationCount += 1;
  await commitDeleteBatchIfNeeded(firestore, state);
}

async function queueDeleteCollectionDocs(
  firestore: Firestore,
  state: DeleteBatchState,
  path: string[]
) {
  const snapshot = await getDocs(collection(firestore, path[0], ...path.slice(1)));

  for (const documentSnapshot of snapshot.docs) {
    await queueDeleteDoc(firestore, state, documentSnapshot.ref);
  }
}

async function persistUserProfileToFirestore(nextUser: User) {
  if (!db || !nextUser.id || nextUser.id === defaultUser.id) return;

  const profileImage = normalizeImageUri(nextUser.profileImage) || '';
  const profileImageUrl = profileImage
    ? await uploadProfileImageToCloudinary(nextUser.id, profileImage)
    : '';
  const displayName = nextUser.displayName?.trim() || nextUser.username;

  await setDoc(doc(db, 'users', nextUser.id), {
    id: nextUser.id,
    userId: nextUser.id,
    username: nextUser.username,
    usernameLower: nextUser.usernameLower || getNormalizedUsername(nextUser.username),
    normalizedUsername: nextUser.usernameLower || getNormalizedUsername(nextUser.username),
    displayName,
    email: nextUser.email || auth?.currentUser?.email || '',
    bio: nextUser.bio || '',
    profileImage: profileImageUrl,
    profileImageUrl,
    avatarUrl: profileImageUrl,
    showProfileImageInComments: nextUser.showProfileImageInComments ?? true,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  await upsertPublicCreatorProfile({
    id: nextUser.id,
    username: nextUser.username,
    usernameLower: nextUser.usernameLower || getNormalizedUsername(nextUser.username),
    displayName,
    bio: nextUser.bio || '',
    profileImageUrl,
    showProfileImageInComments: nextUser.showProfileImageInComments ?? true,
  });

  if (auth?.currentUser?.uid === nextUser.id && auth.currentUser.displayName !== displayName) {
    await updateProfile(auth.currentUser, { displayName });
  }
}

async function getFirestoreUserProfile(userId: string): Promise<Partial<User> & {
  username?: string;
  displayName?: string;
  email?: string;
  profileImage?: string;
  profileImageUrl?: string;
} | null> {
  if (!db || !userId || userId === defaultUser.id) return null;

  try {
    const userSnapshot = await getDoc(doc(db, 'users', userId));

    if (!userSnapshot.exists()) return null;

    const data = userSnapshot.data();
    const username = typeof data.username === 'string' ? data.username.trim() : '';
    const displayName = typeof data.displayName === 'string' ? data.displayName.trim() : '';
    const email = typeof data.email === 'string' ? data.email.trim() : '';

    return {
      username: username || undefined,
      usernameLower: data.usernameLower || data.normalizedUsername || getNormalizedUsername(username),
      displayName: displayName || username || undefined,
      email: email || undefined,
      bio: typeof data.bio === 'string' ? data.bio : undefined,
      profileImage: data.profileImageUrl || data.avatarUrl || data.profileImage || undefined,
      profileImageUrl: data.profileImageUrl || data.avatarUrl || data.profileImage || undefined,
      joinedAt: getDate(data.createdAt),
      showProfileImageInComments: data.showProfileImageInComments ?? true,
      isBanned: data.isBanned === true,
      banReason: typeof data.banReason === 'string' ? data.banReason.trim() : undefined,
      bannedAt: data.isBanned === true ? getDate(data.bannedAt) : undefined,
      bannedBy: typeof data.bannedBy === 'string' ? data.bannedBy.trim() : undefined,
      isFounder: data.isFounder === true,
      founderNumber: typeof data.founderNumber === 'number' ? data.founderNumber : null,
      founderGrantedAt: data.isFounder === true ? getDate(data.founderGrantedAt) || null : null,
      proUntil: data.proUntil ? getDate(data.proUntil) || null : null,
      proSource: data.proSource === 'founder' || data.proSource === 'paid' ? data.proSource : null,
    };
  } catch (error) {
    console.error('Failed to load Firestore user profile', error);
    return null;
  }
}

function getDate(value: FirestoreDate) {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value.toDate) return value.toDate();
  if (typeof value === 'object') return new Date();
  return new Date(value);
}

function getSpotFromFirestore(id: string, data: Record<string, any>): PhotoSpot {
  const categoryId = normalizePhotoCategory(data.categoryId || data.category || 'landscape');
  const favoriteCount = Math.max(Number(data.favoriteCount) || 0, Number(data.likeCount) || 0);

  return normalizeSpot({
    id,
    title: data.title || '',
    description: data.description || '',
    category: categoryId,
    categoryId,
    categoryIds: getSpotCategoryIds(categoryId, data.categoryIds),
    images: normalizeImageUris(data.imageUrls || data.images),
    imageAssets: normalizeSpotImageAssets(data.imageAssets),
    imageStoragePaths: Array.isArray(data.imageStoragePaths) ? data.imageStoragePaths : [],
    latitude: data.latitude ?? data.coordinates?.latitude ?? 0,
    longitude: data.longitude ?? data.coordinates?.longitude ?? 0,
    locationName: data.locationName || data.location || '',
    bestTimeToShoot: data.bestTimeToShoot || data.bestTime || '',
    createdAt: getDate(data.createdAt),
    createdBy: data.createdBy || data.creatorId || data.ownerId || '',
    creatorId: data.creatorId || data.createdBy || data.ownerId || '',
    creatorUsername: data.creatorUsername || data.creatorDisplayName || '',
    creatorDisplayName: data.creatorDisplayName || data.creatorUsername || '',
    creatorAvatarUrl:
      data.creatorAvatarUrl || data.creatorProfileImageUrl || data.profileImageUrl || data.avatarUrl || '',
    creatorShowProfileImageInComments:
      typeof data.creatorShowProfileImageInComments === 'boolean'
        ? data.creatorShowProfileImageInComments
        : undefined,
    visibility: data.visibility === 'private' || data.isPublic === false ? 'private' : 'public',
    isPublic: !(data.visibility === 'private' || data.isPublic === false),
    isRemoved: data.isRemoved === true,
    removedReason: typeof data.removedReason === 'string' ? data.removedReason : undefined,
    removedAt: data.isRemoved === true ? getDate(data.removedAt) : undefined,
    removedBy: typeof data.removedBy === 'string' ? data.removedBy : undefined,
    favoriteCount,
    allowComments: data.allowComments !== false,
  });
}

function sortSpotsByCreatedAtDesc(spots: PhotoSpot[]) {
  return [...spots].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

function getReplyFromFirestore(
  reply: Record<string, any>,
  rootCommentId: string,
  spotId: string,
  fallbackParentId: string
): SpotReply {
  const replyId = reply.id || `${Date.now()}-${Math.round(Math.random() * 100000)}`;
  const userId = reply.userId || reply.authorId || '';

  return {
    id: replyId,
    spotId: reply.spotId || spotId,
    commentId: reply.commentId || rootCommentId,
    parentId: reply.parentId || fallbackParentId,
    rootCommentId: reply.rootCommentId || rootCommentId,
    replyingToUserId: reply.replyingToUserId || undefined,
    replyingToUsername: reply.replyingToUsername || undefined,
    authorId: reply.authorId || userId,
    userId,
    username: reply.username || 'Photographer',
    profileImageUrl: reply.profileImageUrl || reply.avatarUrl || undefined,
    showProfileImageInComments:
      typeof reply.showProfileImageInComments === 'boolean'
        ? reply.showProfileImageInComments
        : undefined,
    text: reply.text || '',
    createdAt: getDate(reply.createdAt).toISOString(),
    likedBy: Array.isArray(reply.likedBy) ? reply.likedBy : [],
    likeCount: Array.isArray(reply.likedBy) ? reply.likedBy.length : reply.likeCount || 0,
    replies: Array.isArray(reply.replies)
      ? reply.replies.map((nestedReply: any) =>
          getReplyFromFirestore(nestedReply, rootCommentId, spotId, replyId)
        )
      : [],
  };
}

function getCommentFromFirestore(id: string, data: Record<string, any>): SpotComment {
  const userId = data.userId || data.authorId || '';

  return {
    id,
    spotId: data.spotId || '',
    parentId: data.parentId || null,
    rootCommentId: data.rootCommentId || id,
    authorId: data.authorId || userId,
    userId,
    username: data.username || 'Photographer',
    profileImageUrl: data.profileImageUrl || data.avatarUrl || undefined,
    showProfileImageInComments:
      typeof data.showProfileImageInComments === 'boolean'
        ? data.showProfileImageInComments
        : undefined,
    text: data.text || '',
    createdAt: getDate(data.createdAt).toISOString(),
    likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
    likeCount: Array.isArray(data.likedBy) ? data.likedBy.length : data.likeCount || 0,
    replies: Array.isArray(data.replies)
      ? data.replies.map((reply: any) => getReplyFromFirestore(reply, id, data.spotId || '', id))
      : [],
  };
}

function toggleUserId(userIds: string[] | undefined, userId: string) {
  const nextUserIds = Array.isArray(userIds) ? userIds : [];

  return nextUserIds.includes(userId)
    ? nextUserIds.filter((id) => id !== userId)
    : [...nextUserIds, userId];
}

function findReplyById(replies: SpotReply[], replyId: string): SpotReply | undefined {
  for (const reply of replies) {
    if (reply.id === replyId) return reply;
    const nestedReply = findReplyById(reply.replies || [], replyId);
    if (nestedReply) return nestedReply;
  }

  return undefined;
}

function getReplyTarget(comment: SpotComment, parentId: string) {
  if (comment.id === parentId) {
    return {
      replyingToUserId: comment.userId || null,
      replyingToUsername: comment.username || 'user',
    };
  }

  const parentReply = findReplyById(comment.replies || [], parentId);

  return {
    replyingToUserId: parentReply?.userId || comment.userId || null,
    replyingToUsername: parentReply?.username || comment.username || 'user',
  };
}

function sanitizeReplyForFirestore(reply: SpotReply): Record<string, any> {
  return {
    id: reply.id || `${Date.now()}-${Math.round(Math.random() * 100000)}`,
    spotId: reply.spotId || '',
    commentId: reply.commentId || reply.rootCommentId || '',
    parentId: reply.parentId || reply.commentId || reply.rootCommentId || '',
    rootCommentId: reply.rootCommentId || reply.commentId || '',
    replyingToUserId: reply.replyingToUserId || null,
    replyingToUsername: reply.replyingToUsername || 'user',
    authorId: reply.authorId || reply.userId || '',
    userId: reply.userId || reply.authorId || '',
    username: reply.username || 'Photographer',
    profileImageUrl: reply.profileImageUrl || '',
    showProfileImageInComments: reply.showProfileImageInComments === true,
    text: reply.text || '',
    createdAt: reply.createdAt || new Date().toISOString(),
    likedBy: Array.isArray(reply.likedBy) ? reply.likedBy.filter(Boolean) : [],
    likeCount: Array.isArray(reply.likedBy)
      ? reply.likedBy.filter(Boolean).length
      : reply.likeCount || 0,
    replies: (reply.replies || []).map(sanitizeReplyForFirestore),
  };
}

function sanitizeCommentForFirestore(comment: Record<string, any>) {
  return {
    id: comment.id || '',
    spotId: comment.spotId || '',
    parentId: comment.parentId ?? null,
    rootCommentId: comment.rootCommentId || comment.id || '',
    authorId: comment.authorId || comment.userId || '',
    userId: comment.userId || comment.authorId || '',
    username: comment.username || 'Photographer',
    profileImageUrl: comment.profileImageUrl || '',
    showProfileImageInComments: comment.showProfileImageInComments === true,
    text: comment.text || '',
    createdAt: comment.createdAt || serverTimestamp(),
    likedBy: Array.isArray(comment.likedBy) ? comment.likedBy.filter(Boolean) : [],
    likeCount: Array.isArray(comment.likedBy)
      ? comment.likedBy.filter(Boolean).length
      : comment.likeCount || 0,
    replies: Array.isArray(comment.replies)
      ? comment.replies.map((reply: SpotReply) => sanitizeReplyForFirestore(reply))
      : [],
  };
}

function sanitizeRepliesForFirestore(replies: SpotReply[]) {
  return replies.map(sanitizeReplyForFirestore);
}

function updateReplyById(
  replies: SpotReply[],
  replyId: string,
  updater: (reply: SpotReply) => SpotReply
): SpotReply[] {
  return replies.map((reply) => {
    if (reply.id === replyId) return updater(reply);

    return {
      ...reply,
      replies: updateReplyById(reply.replies || [], replyId, updater),
    };
  });
}

function addNestedReply(replies: SpotReply[], parentId: string, newReply: SpotReply): SpotReply[] {
  return replies.map((reply) => {
    if (reply.id === parentId) {
      return {
        ...reply,
        replies: [...(reply.replies || []), newReply],
      };
    }

    return {
      ...reply,
      replies: addNestedReply(reply.replies || [], parentId, newReply),
    };
  });
}

function getNotificationActorUsername(user: Pick<User, 'displayName' | 'username'>) {
  return user.displayName?.trim() || user.username?.trim() || 'Someone';
}

function getSpotOwnerId(spot: Pick<PhotoSpot, 'creatorId' | 'createdBy'> | undefined) {
  return spot?.creatorId || spot?.createdBy || '';
}

function promptForNotificationsAfterInteraction(
  userId: string,
  notificationsEnabled: boolean
) {
  maybeRequestNotificationsAfterInteraction(userId, notificationsEnabled).catch((error) => {
    console.error('[Notifications] Permission registration skipped', error);
  });
}

function removeReplyById(replies: SpotReply[], replyId: string): SpotReply[] {
  return replies
    .filter((reply) => reply.id !== replyId)
    .map((reply) => ({
      ...reply,
      replies: removeReplyById(reply.replies || [], replyId),
    }));
}

async function uploadSpotImages(
  spotId: string,
  imageUris: string[],
  onProgress?: AddSpotOptions['onProgress']
) {
  const normalizedImageUris = normalizeImageUris(imageUris);
  const uploadedImages = await uploadSpotImagesToCloudinary(spotId, normalizedImageUris, (progress) => {
    const percent = Math.round(progress.progress * 100);
    onProgress?.({
      phase: 'uploading',
      message: `Uploading images... ${percent}%`,
      progress: progress.progress,
    });
  });
  const assets = uploadedImages.map((image) => ({
    url: image.secureUrl,
    publicId: image.publicId,
    provider: image.provider,
  }));

  return {
    urls: assets.map((asset) => asset.url),
    assets,
    paths: [],
  };
}

function mergeSnapshotIntoSessionSpots(snapshotSpots: PhotoSpot[]) {
  return snapshotSpots;
}

function getSpotsWithDemoSamples(sourceSpots: PhotoSpot[]) {
  if (!isSpotzDemoModeEnabled()) return sourceSpots;

  const sourceSpotIds = new Set(sourceSpots.map((spot) => spot.id));
  const missingDemoSpots = demoSpots.filter((spot) => !sourceSpotIds.has(spot.id));

  return sortSpotsByCreatedAtDesc([...sourceSpots, ...missingDemoSpots]);
}

function getCommentsWithDemoSamples(sourceComments: CommentsBySpot) {
  if (!isSpotzDemoModeEnabled()) return sourceComments;

  const nextComments = { ...sourceComments };
  demoSpots.forEach((spot) => {
    if (!nextComments[spot.id]) {
      nextComments[spot.id] = [];
    }
  });

  return nextComments;
}

export function SpotProvider({ children }: { children: ReactNode }) {
  const { firebaseUser, isBanLoading, accountBan } = useAuth();
  const authenticatedUser = useMemo<User>(() => {
    const fallbackUsername =
      firebaseUser?.email?.split('@')[0] ||
      defaultUser.username;
    const fallbackDisplayName = firebaseUser?.displayName?.trim() || fallbackUsername;

    return {
      ...defaultUser,
      id: firebaseUser?.uid || defaultUser.id,
      username: fallbackUsername,
      usernameLower: getNormalizedUsername(fallbackUsername),
      displayName: fallbackDisplayName,
      email: firebaseUser?.email || '',
    };
  }, [firebaseUser?.displayName, firebaseUser?.email, firebaseUser?.uid]);
  const [spots, setSpots] = useState<PhotoSpot[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [user, setUser] = useState<User>(authenticatedUser);
  const [comments, setComments] = useState<CommentsBySpot>({});
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isSyncing, setIsSyncing] = useState(isFirebaseConfigured);
  const [isUserDataLoading, setIsUserDataLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | undefined>(
    isFirebaseConfigured ? undefined : 'Firebase is not configured.'
  );
  const displaySpots = useMemo(() => getSpotsWithDemoSamples(spots), [spots]);
  const displayComments = useMemo(() => getCommentsWithDemoSamples(comments), [comments]);
  const spotIdsSignature = useMemo(() => spots.map((spot) => spot.id).join('|'), [spots]);
  const canUseProtectedFirestore = Boolean(firebaseUser) && !isBanLoading && !accountBan.isBanned;
  const isProtectedFirestoreBlockedRef = useRef(!canUseProtectedFirestore);
  const accountBanRef = useRef(accountBan);
  const isProviderMountedRef = useRef(true);
  const isInitialLoad = useRef(true);
  const shouldSkipNextSave = useRef(false);
  const hasAcceptedInitialSpotSnapshot = useRef(false);

  useEffect(() => {
    isProviderMountedRef.current = true;

    return () => {
      isProviderMountedRef.current = false;
      isProtectedFirestoreBlockedRef.current = true;
    };
  }, []);

  useEffect(() => {
    accountBanRef.current = accountBan;
  }, [accountBan]);

  useEffect(() => {
    isProtectedFirestoreBlockedRef.current = !canUseProtectedFirestore;
  }, [canUseProtectedFirestore]);

  useEffect(() => {
    setUser((prev) => ({
      ...prev,
      isBanned: accountBan.isBanned,
      banReason: accountBan.banReason,
      bannedAt: accountBan.bannedAt,
      bannedBy: accountBan.bannedBy,
    }));

    if (accountBan.isBanned) {
      setSpots([]);
      setFavorites([]);
      setComments({});
      setIsSyncing(false);
      setSyncError(undefined);
      hasAcceptedInitialSpotSnapshot.current = false;
    }
  }, [accountBan]);

  // Load data from AsyncStorage on mount
  useEffect(() => {
    let isMounted = true;

    const loadPersistedData = async () => {
      setIsUserDataLoading(true);

      try {
        const [storedUser, storedSettings, storedDeviceId] = await Promise.all([
          AsyncStorage.getItem(getUserStorageKey(authenticatedUser.id)),
          AsyncStorage.getItem(STORAGE_KEYS.SETTINGS),
          AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID),
        ]);
        const deviceId = storedDeviceId || `device-${Date.now()}-${Math.round(Math.random() * 100000)}`;

        if (!storedDeviceId) {
          await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
        }

        const parsedUser = storedUser ? JSON.parse(storedUser) : {};
        const firestoreUser = await getFirestoreUserProfile(authenticatedUser.id);
        const resolvedUsername =
          firestoreUser?.username ||
          parsedUser.username ||
          authenticatedUser.username;
        const resolvedDisplayName =
          firestoreUser?.displayName ||
          parsedUser.displayName ||
          authenticatedUser.displayName ||
          resolvedUsername;

        const nextUser = normalizeUser({
          ...authenticatedUser,
          ...parsedUser,
          ...firestoreUser,
          id: authenticatedUser.id,
          username: resolvedUsername,
          usernameLower:
            firestoreUser?.usernameLower ||
            parsedUser.usernameLower ||
            getNormalizedUsername(resolvedUsername),
          displayName: resolvedDisplayName,
          email: firestoreUser?.email || parsedUser.email || authenticatedUser.email || '',
        });
        const nextSettings = {
          ...defaultSettings,
          ...(storedSettings ? JSON.parse(storedSettings) : {}),
          showProfileImageInComments:
            firestoreUser?.showProfileImageInComments ??
            (storedSettings ? JSON.parse(storedSettings).showProfileImageInComments : undefined) ??
            defaultSettings.showProfileImageInComments,
        };

        if (!isMounted) return;

        setUser(nextUser);
        setSettings(nextSettings);
        if (!nextUser.isBanned && !accountBanRef.current.isBanned) {
          upsertPublicCreatorProfile({
            id: nextUser.id,
            username: nextUser.username,
            usernameLower: nextUser.usernameLower || getNormalizedUsername(nextUser.username),
            displayName: nextUser.displayName || nextUser.username,
            bio: nextUser.bio || '',
            profileImageUrl: normalizeImageUri(nextUser.profileImage) || '',
            showProfileImageInComments: nextUser.showProfileImageInComments ?? true,
          }).catch((error) => {
            if (!isPermissionDeniedError(error)) {
              console.error('Failed to sync public profile mirror', error);
            }
          });
        }
      } catch (e) {
        console.error('Failed to load data from storage', e);
      } finally {
        if (isMounted) {
          isInitialLoad.current = false;
          setIsUserDataLoading(false);
        }
      }
    };

    loadPersistedData();

    return () => {
      isMounted = false;
    };
  }, [authenticatedUser]);

  // Save data to AsyncStorage whenever spots or favorites change
  useEffect(() => {
    if (isInitialLoad.current) return;
    if (shouldSkipNextSave.current) {
      shouldSkipNextSave.current = false;
      return;
    }

    const saveData = async () => {
      await AsyncStorage.setItem(getUserStorageKey(user.id), JSON.stringify(normalizeUser(user)));
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    };
    saveData();
  }, [user, settings]);

  useEffect(() => {
    if (!db) {
      setIsSyncing(false);
      return;
    }
    if (!canUseProtectedFirestore) {
      setIsSyncing(false);
      return;
    }
    if (isUserDataLoading) return;

    setIsSyncing(true);
    // TODO: Add Firestore security rules so private spots are readable only by their creator.
    const spotsQuery = query(collection(db, 'spots'), where('isRemoved', '==', false));
    const unsubscribe = onSnapshot(
      spotsQuery,
      (snapshot) => {
        const nextSpots = sortSpotsByCreatedAtDesc(
          snapshot.docs
            .map((spotDoc) => getSpotFromFirestore(spotDoc.id, spotDoc.data()))
            .filter((spot) => spot.isRemoved !== true)
        );
        setSpots(() => {
          if (!hasAcceptedInitialSpotSnapshot.current) {
            hasAcceptedInitialSpotSnapshot.current = true;
            return nextSpots;
          }

          return mergeSnapshotIntoSessionSpots(nextSpots);
        });
        setIsSyncing(false);
        setSyncError(undefined);
      },
      (error) => {
        if (isExpectedBlockedFirestoreError(error, isProtectedFirestoreBlockedRef.current)) {
          setIsSyncing(false);
          return;
        }

        if (isPermissionDeniedError(error)) {
          setSyncError(undefined);
        } else {
          console.error('Failed to sync spots', error);
          setSyncError('Unable to sync spots right now.');
        }
        setIsSyncing(false);
      }
    );

    return unsubscribe;
  }, [canUseProtectedFirestore, isUserDataLoading, user.id]);

  useEffect(() => {
    if (!canUseProtectedFirestore) {
      setFavorites([]);
      return;
    }
    if (!db || isUserDataLoading || !user.id) return;

    const favoriteCollection = collection(db, 'users', user.id, 'favorites');
    const unsubscribe = onSnapshot(
      favoriteCollection,
      (snapshot) => {
        const nextFavorites = snapshot.docs.map((favoriteDoc) => favoriteDoc.id);
        setFavorites(nextFavorites);
        setUser((prev) => ({ ...prev, savedSpots: nextFavorites }));
      },
      (error) => {
        if (isExpectedBlockedFirestoreError(error, isProtectedFirestoreBlockedRef.current)) {
          return;
        }

        if (isPermissionDeniedError(error)) {
          return;
        }

        console.error('Failed to sync favorites', error);
      }
    );

    return unsubscribe;
  }, [canUseProtectedFirestore, isUserDataLoading, user.id]);

  useEffect(() => {
    if (!canUseProtectedFirestore) {
      setComments({});
      return;
    }
    if (!db) {
      setComments({});
      return;
    }
    if (isUserDataLoading) return;
    const currentSpotIds = spotIdsSignature ? spotIdsSignature.split('|') : [];

    if (currentSpotIds.length === 0) {
      setComments({});
      return;
    }
    const firestore = db;

    const unsubscribers = currentSpotIds.map((spotId) =>
      onSnapshot(
        query(collection(firestore, 'spots', spotId, 'comments'), orderBy('createdAt', 'desc')),
        (snapshot) => {
          setComments((prev) => ({
            ...prev,
            [spotId]: snapshot.docs.map((commentDoc) =>
              getCommentFromFirestore(commentDoc.id, {
                ...commentDoc.data(),
                spotId,
              })
            ),
          }));
        },
        (error) => {
          if (
            isExpectedBlockedFirestoreError(error, isProtectedFirestoreBlockedRef.current) ||
            isPermissionDeniedError(error)
          ) {
            setComments((prev) => {
              const nextComments = { ...prev };
              delete nextComments[spotId];
              return nextComments;
            });
            return;
          }

          console.error(`Failed to sync comments for spot ${spotId}`, error);
        }
      )
    );

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [canUseProtectedFirestore, isUserDataLoading, spotIdsSignature]);

  const updateUserProfile = useCallback((profile: Pick<User, 'displayName' | 'bio' | 'profileImage'>) => {
    if (user.isBanned === true) {
      setSyncError('This account is banned and cannot edit its profile.');
      return;
    }

    const previousUser = user;
    const nextUser = normalizeUser({
      ...user,
      ...profile,
      displayName: profile.displayName?.trim() || user.username,
      bio: profile.bio?.trim() || '',
      profileImage: normalizeImageUri(profile.profileImage),
    });

    setUser(nextUser);
    persistUserProfileToFirestore(nextUser).catch((error) => {
      console.error('Failed to persist user profile', error);
      setUser(previousUser);
    });
  }, [user]);

  const updateSettings = useCallback((nextSettings: Partial<AppSettings>) => {
    if (user.isBanned === true) {
      setSyncError('This account is banned and cannot update settings.');
      return;
    }

    setSettings((prev) => ({
      ...prev,
      ...nextSettings,
    }));
    if (typeof nextSettings.notificationsEnabled === 'boolean' && db && user.id && user.id !== defaultUser.id) {
      setNotificationsEnabledForUser(user.id, nextSettings.notificationsEnabled).catch((error) => {
        console.error('Failed to persist notification preference', error);
      });
    }
    if (typeof nextSettings.showProfileImageInComments === 'boolean') {
      setUser((prev) => ({
        ...prev,
        showProfileImageInComments: nextSettings.showProfileImageInComments,
      }));
      if (db && user.id && user.id !== defaultUser.id) {
        setDoc(doc(db, 'users', user.id), {
          id: user.id,
          userId: user.id,
          showProfileImageInComments: nextSettings.showProfileImageInComments,
          updatedAt: serverTimestamp(),
        }, { merge: true }).catch((error) => {
          console.error('Failed to persist comment profile image preference', error);
        });
        upsertPublicCreatorProfile({
          id: user.id,
          username: user.username,
          usernameLower: user.usernameLower || getNormalizedUsername(user.username),
          displayName: user.displayName || user.username,
          bio: user.bio || '',
          profileImageUrl: normalizeImageUri(user.profileImage) || '',
          showProfileImageInComments: nextSettings.showProfileImageInComments,
        }).catch((error) => {
          if (!isPermissionDeniedError(error)) {
            console.error('Failed to persist public profile image preference', error);
          }
        });
      }
    }
  }, [user]);

  const refreshSpots = useCallback(async (options: RefreshSpotsOptions = {}) => {
    const emptyRefreshResult = {
      spots: [],
      comments: {},
    };
    const clearRefreshState = () => {
      if (!isProviderMountedRef.current) return;

      setSpots([]);
      setFavorites([]);
      setComments({});
      setIsSyncing(false);
      setSyncError(undefined);
    };
    const shouldSuppressRefreshError = (error: unknown) =>
      isPermissionDeniedError(error) &&
      (
        isProtectedFirestoreBlockedRef.current ||
        accountBanRef.current.isBanned ||
        !isProviderMountedRef.current
      );

    if (!canUseProtectedFirestore || accountBanRef.current.isBanned || !isProviderMountedRef.current) {
      clearRefreshState();
      return emptyRefreshResult;
    }

    if (!db) {
      const message = 'Firebase is not configured. Add your Firebase environment variables.';
      setSyncError(message);
      throw new Error(message);
    }

    const firestore = db;

    try {
      const spotsQuery = query(
        collection(firestore, 'spots'),
        where('isRemoved', '==', false)
      );
      const favoritesQuery = collection(firestore, 'users', user.id, 'favorites');
      logDevRefreshEvent('starting server refresh', {
        platform: Platform.OS,
        source: options.source || 'manual',
        query: 'spots where isRemoved == false',
        activeTab: options.activeTab || 'unknown',
        selectedCategory: options.selectedCategory || 'unknown',
        locationFeaturesEnabled: options.locationFeaturesEnabled ?? 'unknown',
        locationPermissionStatus: options.locationPermissionStatus || 'unknown',
        isLocationAccessEnabled: options.isLocationAccessEnabled ?? 'unknown',
        location: options.location || null,
      });

      const spotsSnapshot = await getFreshDocsWithAndroidRetry(
        firestore,
        spotsQuery,
        'spots where isRemoved == false',
        options,
        shouldSuppressRefreshError
      );

      if (accountBanRef.current.isBanned || !isProviderMountedRef.current) {
        clearRefreshState();
        return emptyRefreshResult;
      }

      const nextSpots = sortSpotsByCreatedAtDesc(
        spotsSnapshot.docs
          .map((spotDoc) => getSpotFromFirestore(spotDoc.id, spotDoc.data()))
          .filter((spot) => spot.isRemoved !== true)
      );

      let nextFavorites = favorites;
      try {
        const favoritesSnapshot = await getFreshDocsWithAndroidRetry(
          firestore,
          favoritesQuery,
          `users/${user.id}/favorites`,
          options,
          shouldSuppressRefreshError
        );
        nextFavorites = favoritesSnapshot.docs.map((favoriteDoc) => favoriteDoc.id);
      } catch (error) {
        if (!shouldSuppressRefreshError(error) && !isPermissionDeniedError(error)) {
          logDevRefreshError('favorites refresh skipped', error, options, {
            query: `users/${user.id}/favorites`,
          });
        }
      }

      const nextCommentEntries = await Promise.all(
        nextSpots.map(async (spot) => {
          let commentsSnapshot;

          try {
            commentsSnapshot = await getFreshDocsWithAndroidRetry(
              firestore,
              query(collection(firestore, 'spots', spot.id, 'comments'), orderBy('createdAt', 'desc')),
              `spots/${spot.id}/comments orderBy createdAt desc`,
              options,
              shouldSuppressRefreshError
            );
          } catch (error) {
            if (!shouldSuppressRefreshError(error) && !isPermissionDeniedError(error)) {
              logDevRefreshError('comments refresh skipped', error, options, {
                query: `spots/${spot.id}/comments orderBy createdAt desc`,
                spotId: spot.id,
              });
            }
            return [spot.id, comments[spot.id] || []] as const;
          }

          return [
            spot.id,
            commentsSnapshot.docs.map((commentDoc) =>
              getCommentFromFirestore(commentDoc.id, {
                ...commentDoc.data(),
                spotId: spot.id,
              })
            ),
          ] as const;
        })
      );

      if (accountBanRef.current.isBanned || !isProviderMountedRef.current) {
        clearRefreshState();
        return emptyRefreshResult;
      }

      setSpots(nextSpots);
      hasAcceptedInitialSpotSnapshot.current = true;
      setFavorites(nextFavorites);
      const nextComments = Object.fromEntries(nextCommentEntries);
      setComments(nextComments);
      setUser((prev) => ({ ...prev, savedSpots: nextFavorites }));
      setSyncError(undefined);

      return {
        spots: getSpotsWithDemoSamples(nextSpots),
        comments: getCommentsWithDemoSamples(nextComments),
      };
    } catch (error) {
      if (
        shouldSuppressRefreshError(error) ||
        (isPermissionDeniedError(error) && await isCurrentUserBannedFromServer(firestore, user.id))
      ) {
        clearRefreshState();
        return emptyRefreshResult;
      }

      logDevRefreshError('refresh failed', error, options, {
        query: 'spots where isRemoved == false',
      });
      if (!isPermissionDeniedError(error)) {
        console.error('Failed to refresh spots', error);
      }
      setSyncError('Unable to refresh spots right now.');
      throw error;
    }
  }, [canUseProtectedFirestore, comments, favorites, user.id]);

  const resetAppData = useCallback(async () => {
    shouldSkipNextSave.current = true;
    const nextDeviceId = `device-${Date.now()}-${Math.round(Math.random() * 100000)}`;

    if (db) {
      const favoritesSnapshot = await getDocs(collection(db, 'users', user.id, 'favorites'));
      const batch = writeBatch(db);
      favoritesSnapshot.docs.forEach((favoriteDoc) => batch.delete(favoriteDoc.ref));
      await batch.commit();
    }

    await Promise.all([
      AsyncStorage.multiRemove([
        getUserStorageKey(user.id),
        STORAGE_KEYS.SETTINGS,
        STORAGE_KEYS.DEVICE_ID,
        ONBOARDING_COMPLETED_STORAGE_KEY,
      ]),
      clearPersistedImagesAsync(),
    ]);
    await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, nextDeviceId);

    setSpots([]);
    hasAcceptedInitialSpotSnapshot.current = false;
    setFavorites([]);
    setUser(authenticatedUser);
    setComments({});
    setSettings(defaultSettings);
  }, [authenticatedUser, user.id]);

  const deleteAllSpotsFromDatabase = useCallback(async () => {
    if (!db) {
      const message = 'Firebase is not configured. Unable to delete spots.';
      setSyncError(message);
      throw new Error(message);
    }

    const firestore = db;
    const batchState: DeleteBatchState = {
      batch: writeBatch(firestore),
      operationCount: 0,
    };

    try {
      console.warn('[DeveloperReset] Deleting all Firestore spots and related spot data.');
      const spotsSnapshot = await getDocs(collection(firestore, 'spots'));

      for (const spotSnapshot of spotsSnapshot.docs) {
        const spotId = spotSnapshot.id;
        const commentsSnapshot = await getDocs(collection(firestore, 'spots', spotId, 'comments'));

        for (const commentSnapshot of commentsSnapshot.docs) {
          await queueDeleteCollectionDocs(firestore, batchState, [
            'spots',
            spotId,
            'comments',
            commentSnapshot.id,
            'replies',
          ]);
          await queueDeleteCollectionDocs(firestore, batchState, [
            'spots',
            spotId,
            'comments',
            commentSnapshot.id,
            'likes',
          ]);
          await queueDeleteDoc(firestore, batchState, commentSnapshot.ref);
        }

        await queueDeleteCollectionDocs(firestore, batchState, ['spots', spotId, 'likes']);
        await queueDeleteDoc(firestore, batchState, spotSnapshot.ref);
      }

      await commitDeleteBatchIfNeeded(firestore, batchState, true);

      try {
        const usersSnapshot = await getDocs(collection(firestore, 'users'));
        for (const userSnapshot of usersSnapshot.docs) {
          await queueDeleteCollectionDocs(firestore, batchState, [
            'users',
            userSnapshot.id,
            'favorites',
          ]);
        }

        await commitDeleteBatchIfNeeded(firestore, batchState, true);
      } catch (favoritesError) {
        console.warn(
          '[DeveloperReset] Spots were deleted, but clearing all user favorites was skipped or blocked.',
          favoritesError
        );
      }

      setSpots([]);
      hasAcceptedInitialSpotSnapshot.current = true;
      setFavorites([]);
      setComments({});
      setUser((prev) => ({
        ...prev,
        uploadedSpots: [],
        savedSpots: [],
      }));
      setSyncError(undefined);
    } catch (error) {
      console.error('[DeveloperReset] Failed to delete all spots', error);
      setSyncError('Unable to delete all spots right now.');
      throw error;
    }
  }, []);

  const addSpot = useCallback(async (
    spotData: Omit<PhotoSpot, 'id' | 'createdAt' | 'createdBy'>,
    options?: AddSpotOptions
  ) => {
    if (user.isBanned === true) {
      const message = 'This account is banned and cannot add spots.';
      setSyncError(message);
      throw new Error(message);
    }

    if (!db) {
      const message = 'Firebase is not configured. Add your Firebase environment variables.';
      setSyncError(message);
      console.error('[AddSpot] Save error', message);
      throw new Error(message);
    }

    const spotRef = doc(collection(db, 'spots'));
    const normalizedImages = normalizeImageUris(spotData.images);
    const normalizedCategory = normalizePhotoCategory(spotData.categoryId || spotData.category);
    const categoryIds = getSpotCategoryIds(normalizedCategory, spotData.categoryIds);
    const locationName = spotData.locationName || '';
    const visibility = spotData.visibility === 'private' ? 'private' : 'public';
    const isPublic = visibility === 'public';
    const creatorShowProfileImageInComments = settings.showProfileImageInComments;
    const creatorAvatarUrl = creatorShowProfileImageInComments
      ? normalizeImageUri(user.profileImage) || ''
      : '';

    try {
      options?.onProgress?.({
        phase: 'preparing',
        message: normalizedImages.length > 1 ? 'Preparing images...' : 'Preparing image...',
        progress: 0,
      });
      const uploadedImages = await uploadSpotImages(spotRef.id, normalizedImages, options?.onProgress);

      options?.onProgress?.({
        phase: 'saving',
        message: 'Saving spot...',
        progress: 0.92,
      });
      await setDoc(spotRef, {
        id: spotRef.id,
        title: spotData.title,
        description: spotData.description,
        category: normalizedCategory,
        categoryId: normalizedCategory,
        categoryIds,
        bestTime: spotData.bestTimeToShoot,
        bestTimeToShoot: spotData.bestTimeToShoot,
        location: locationName,
        locationName,
        coordinates: {
          latitude: spotData.latitude,
          longitude: spotData.longitude,
        },
        latitude: spotData.latitude,
        longitude: spotData.longitude,
        images: uploadedImages.urls,
        imageUrls: uploadedImages.urls,
        imageAssets: uploadedImages.assets,
        imageStoragePaths: uploadedImages.paths,
        imageStorageMode: 'cloudinary',
        creatorId: user.id,
        ownerId: user.id,
        creatorUsername: user.username,
        creatorDisplayName: user.displayName || user.username,
        creatorAvatarUrl,
        creatorProfileImageUrl: creatorAvatarUrl,
        creatorShowProfileImageInComments,
        visibility,
        isPublic,
        isRemoved: false,
        allowComments: spotData.allowComments !== false,
        createdBy: user.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      options?.onProgress?.({
        phase: 'done',
        message: 'Almost done...',
        progress: 1,
      });

      const createdSpot = normalizeSpot({
        id: spotRef.id,
        title: spotData.title,
        description: spotData.description,
        category: normalizedCategory,
        categoryId: normalizedCategory,
        categoryIds,
        bestTimeToShoot: spotData.bestTimeToShoot,
        images: uploadedImages.urls,
        imageAssets: uploadedImages.assets,
        imageStoragePaths: uploadedImages.paths,
        latitude: spotData.latitude,
        longitude: spotData.longitude,
        locationName,
        createdAt: new Date(),
        createdBy: user.id,
        creatorId: user.id,
        creatorUsername: user.username,
        creatorDisplayName: user.displayName || user.username,
        creatorAvatarUrl,
        creatorShowProfileImageInComments,
        visibility,
        isPublic,
        isRemoved: false,
        favoriteCount: 0,
        allowComments: spotData.allowComments !== false,
        isFavorite: false,
      });

      setSpots((prev) => (
        prev.some((spot) => spot.id === spotRef.id) ? prev : [createdSpot, ...prev]
      ));
      hasAcceptedInitialSpotSnapshot.current = true;
      setUser((prev) => ({
        ...prev,
        uploadedSpots: [...new Set([...prev.uploadedSpots, spotRef.id])],
      }));
      setSyncError(undefined);
    } catch (error) {
      console.error('[AddSpot] Save error', error);
      setSyncError('Unable to save this spot right now.');
      throw error;
    }
  }, [
    settings.showProfileImageInComments,
    user,
  ]);

  const deleteSpot = useCallback(async (spotId: string) => {
    if (!db) return false;
    if (isUserBanned(user)) return false;
    const spotToDelete = spots.find((spot) => spot.id === spotId);

    if (!spotToDelete || spotToDelete.createdBy !== user.id) {
      return false;
    }

    await deleteDoc(doc(db, 'spots', spotId));

    setUser((prev) => ({
      ...prev,
      uploadedSpots: prev.uploadedSpots.filter((id) => id !== spotId),
      savedSpots: prev.savedSpots.filter((id) => id !== spotId),
    }));

    return true;
  }, [spots, user]);

  const toggleFavorite = useCallback(async (spotId: string) => {
    if (!db) return;
    if (user.isBanned === true) return;

    const spot = displaySpots.find((item) => item.id === spotId);
    if (!spot) return;

    if (isSpotzDemoModeEnabled() && isDemoSpotId(spotId) && !spots.some((item) => item.id === spotId)) {
      setFavorites((prev) => {
        const nextFavorites = prev.includes(spotId)
          ? prev.filter((favoriteSpotId) => favoriteSpotId !== spotId)
          : [...prev, spotId];

        setUser((previousUser) => ({ ...previousUser, savedSpots: nextFavorites }));
        return nextFavorites;
      });
      return;
    }

    const isPrivateSpot = spot?.visibility === 'private' || spot?.isPublic === false;
    const isOwner = (spot?.creatorId || spot?.createdBy) === user.id;
    if (isPrivateSpot && !isOwner) return;

    const isFavorite = favorites.includes(spotId);
    const favoriteRef = doc(db, 'users', user.id, 'favorites', spotId);
    const spotRef = doc(db, 'spots', spotId);
    const favoriteCountDelta = isFavorite ? -1 : 1;

    setFavorites((prev) => (isFavorite ? prev.filter((id) => id !== spotId) : [...prev, spotId]));
    setSpots((prev) =>
      prev.map((spot) =>
        spot.id === spotId
          ? { ...spot, favoriteCount: Math.max(0, (spot.favoriteCount || 0) + favoriteCountDelta) }
          : spot
      )
    );

    try {
      await runTransaction(db, async (transaction) => {
        const spotSnapshot = await transaction.get(spotRef);
        const spotData = spotSnapshot.exists() ? spotSnapshot.data() : {};
        const currentFavoriteCount = Math.max(
          Number(spotData.favoriteCount) || 0,
          Number(spotData.likeCount) || 0
        );
        const nextFavoriteCount = Math.max(0, currentFavoriteCount + favoriteCountDelta);

        if (isFavorite) {
          transaction.delete(favoriteRef);
        } else {
          transaction.set(favoriteRef, {
            spotId,
            userId: user.id,
            createdAt: serverTimestamp(),
          });
        }

        transaction.update(spotRef, {
          favoriteCount: nextFavoriteCount,
          likeCount: nextFavoriteCount,
          updatedAt: serverTimestamp(),
        });
      });

      promptForNotificationsAfterInteraction(user.id, settings.notificationsEnabled);

      if (!isFavorite) {
        createNotificationDocument({
          id: `spot_favorite_${spotId}_${user.id}_${Date.now()}`,
          type: 'spot_favorite',
          recipientId: getSpotOwnerId(spot),
          actorId: user.id,
          actorUsername: getNotificationActorUsername(user),
          spotId,
          spotTitle: spot.title,
        }).catch((error) => {
          console.error('[Notifications] Failed to create favorite notification', error);
        });
      }
    } catch (error) {
      console.error('Failed to toggle favorite', error);
      setFavorites((prev) =>
        isFavorite
          ? [...new Set([...prev, spotId])]
          : prev.filter((favoriteSpotId) => favoriteSpotId !== spotId)
      );
      setSpots((prev) =>
        prev.map((spot) =>
          spot.id === spotId
            ? { ...spot, favoriteCount: Math.max(0, (spot.favoriteCount || 0) - favoriteCountDelta) }
            : spot
        )
      );
    }
  }, [displaySpots, favorites, settings.notificationsEnabled, spots, user]);

  const addComment = useCallback(async (spotId: string, text: string) => {
    if (!db) return;
    if (user.isBanned === true) return;
    const trimmedText = text.trim();
    const spot = spots.find((item) => item.id === spotId);
    const isPrivateSpot = spot?.visibility === 'private' || spot?.isPublic === false;
    const isOwner = (spot?.creatorId || spot?.createdBy) === user.id;

    if (!trimmedText) return;
    if (!spot || spot.allowComments === false || (isPrivateSpot && !isOwner)) return;

    const profileImageUrl = settings.showProfileImageInComments
      ? normalizeImageUri(user.profileImage)
      : undefined;

    const commentRef = doc(collection(db, 'spots', spotId, 'comments'));

    const commentPayload = sanitizeCommentForFirestore({
      id: commentRef.id,
      spotId,
      parentId: null,
      rootCommentId: commentRef.id,
      authorId: user.id,
      userId: user.id,
      username: user.displayName || user.username,
      profileImageUrl: profileImageUrl || '',
      showProfileImageInComments: settings.showProfileImageInComments,
      text: trimmedText,
      createdAt: serverTimestamp(),
      likedBy: [],
      likeCount: 0,
      replies: [],
    });
    await setDoc(commentRef, commentPayload);

    promptForNotificationsAfterInteraction(user.id, settings.notificationsEnabled);
    createNotificationDocument({
      id: `spot_comment_${spotId}_${commentRef.id}`,
      type: 'spot_comment',
      recipientId: getSpotOwnerId(spot),
      actorId: user.id,
      actorUsername: getNotificationActorUsername(user),
      spotId,
      spotTitle: spot.title,
      commentId: commentRef.id,
      rootCommentId: commentRef.id,
    }).catch((error) => {
      console.error('[Notifications] Failed to create comment notification', error);
    });
  }, [
    settings.notificationsEnabled,
    settings.showProfileImageInComments,
    spots,
    user,
  ]);

  const addReply = useCallback(async (
    spotId: string,
    rootCommentId: string,
    parentId: string,
    text: string
  ) => {
    if (!db) return;
    if (user.isBanned === true) return;
    const trimmedText = text.trim();
    const spot = spots.find((item) => item.id === spotId);
    const isPrivateSpot = spot?.visibility === 'private' || spot?.isPublic === false;
    const isOwner = (spot?.creatorId || spot?.createdBy) === user.id;

    if (!trimmedText) return;
    if (!spot || spot.allowComments === false || (isPrivateSpot && !isOwner)) return;

    const rootComment = comments[spotId]?.find((comment) => comment.id === rootCommentId);
    if (!rootComment) return;
    const replyTarget = getReplyTarget(rootComment, parentId);

    const newReply: SpotReply = {
      id: `${Date.now()}-${Math.round(Math.random() * 100000)}`,
      spotId,
      commentId: rootCommentId,
      parentId,
      rootCommentId,
      replyingToUserId: replyTarget.replyingToUserId || null,
      replyingToUsername: replyTarget.replyingToUsername || 'user',
      authorId: user.id,
      userId: user.id,
      username: user.displayName || user.username,
      profileImageUrl: settings.showProfileImageInComments
        ? normalizeImageUri(user.profileImage) || ''
        : '',
      showProfileImageInComments: settings.showProfileImageInComments,
      text: trimmedText,
      createdAt: new Date().toISOString(),
      likedBy: [],
      likeCount: 0,
      replies: [],
    };
    const nextReplies =
      parentId === rootCommentId
        ? [...(rootComment.replies || []), newReply]
        : addNestedReply(rootComment.replies || [], parentId, newReply);
    const sanitizedReplies = sanitizeRepliesForFirestore(nextReplies);

    setComments((prev) => ({
      ...prev,
      [spotId]: (prev[spotId] || []).map((comment) =>
        comment.id === rootCommentId ? { ...comment, replies: nextReplies } : comment
      ),
    }));

    try {
      await updateDoc(doc(db, 'spots', spotId, 'comments', rootCommentId), {
        replies: sanitizedReplies,
        updatedAt: serverTimestamp(),
      });

      promptForNotificationsAfterInteraction(user.id, settings.notificationsEnabled);
      createNotificationDocument({
        id: `comment_reply_${spotId}_${rootCommentId}_${newReply.id}`,
        type: 'comment_reply',
        recipientId: replyTarget.replyingToUserId,
        actorId: user.id,
        actorUsername: getNotificationActorUsername(user),
        spotId,
        spotTitle: spot.title,
        commentId: rootCommentId,
        rootCommentId,
        parentId,
        replyId: newReply.id,
      }).catch((error) => {
        console.error('[Notifications] Failed to create reply notification', error);
      });
    } catch (error) {
      console.error('Failed to add reply', error);
      setComments((prev) => ({
        ...prev,
        [spotId]: (prev[spotId] || []).map((comment) =>
          comment.id === rootCommentId
            ? { ...comment, replies: rootComment.replies || [] }
            : comment
        ),
      }));
      throw error;
    }
  }, [
    comments,
    settings.notificationsEnabled,
    settings.showProfileImageInComments,
    spots,
    user,
  ]);

  const toggleCommentLike = useCallback(async (spotId: string, commentId: string) => {
    if (!db) return;
    if (isUserBanned(user)) return;

    const comment = comments[spotId]?.find((item) => item.id === commentId);
    if (!comment) return;

    const nextLikedBy = toggleUserId(comment.likedBy, user.id);

    setComments((prev) => ({
      ...prev,
      [spotId]: (prev[spotId] || []).map((item) =>
        item.id === commentId
          ? { ...item, likedBy: nextLikedBy, likeCount: nextLikedBy.length }
          : item
      ),
    }));

    try {
      await updateDoc(doc(db, 'spots', spotId, 'comments', commentId), {
        likedBy: nextLikedBy,
        likeCount: nextLikedBy.length,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Failed to toggle comment like', error);
      setComments((prev) => ({
        ...prev,
        [spotId]: (prev[spotId] || []).map((item) =>
          item.id === commentId
            ? {
                ...item,
                likedBy: comment.likedBy || [],
                likeCount: comment.likeCount || comment.likedBy?.length || 0,
              }
            : item
        ),
      }));
    }
  }, [comments, user]);

  const toggleReplyLike = useCallback(async (spotId: string, commentId: string, replyId: string) => {
    if (!db) return;
    if (isUserBanned(user)) return;

    const comment = comments[spotId]?.find((item) => item.id === commentId);
    const reply = findReplyById(comment?.replies || [], replyId);
    if (!comment || !reply) return;

    const nextLikedBy = toggleUserId(reply.likedBy, user.id);
    const nextReplies = updateReplyById(
      comment.replies || [],
      replyId,
      (item) => ({ ...item, likedBy: nextLikedBy, likeCount: nextLikedBy.length })
    );

    setComments((prev) => ({
      ...prev,
      [spotId]: (prev[spotId] || []).map((item) =>
        item.id === commentId ? { ...item, replies: nextReplies } : item
      ),
    }));

    try {
      const sanitizedReplies = sanitizeRepliesForFirestore(nextReplies);
      await updateDoc(doc(db, 'spots', spotId, 'comments', commentId), {
        replies: sanitizedReplies,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Failed to toggle reply like', error);
      setComments((prev) => ({
        ...prev,
        [spotId]: (prev[spotId] || []).map((item) =>
          item.id === commentId ? { ...item, replies: comment.replies || [] } : item
        ),
      }));
    }
  }, [comments, user]);

  const deleteComment = useCallback(async (spotId: string, commentId: string) => {
    if (!db) return false;
    if (isUserBanned(user)) return false;

    const comment = comments[spotId]?.find((item) => item.id === commentId);
    if (!comment || comment.userId !== user.id) return false;

    setComments((prev) => ({
      ...prev,
      [spotId]: (prev[spotId] || []).filter((item) => item.id !== commentId),
    }));

    try {
      await deleteDoc(doc(db, 'spots', spotId, 'comments', commentId));
      return true;
    } catch (error) {
      console.error('Failed to delete comment', error);
      setComments((prev) => ({
        ...prev,
        [spotId]: prev[spotId]?.some((item) => item.id === commentId)
          ? prev[spotId]
          : [comment, ...(prev[spotId] || [])],
      }));
      return false;
    }
  }, [comments, user]);

  const deleteReply = useCallback(async (spotId: string, commentId: string, replyId: string) => {
    if (!db) return false;
    if (isUserBanned(user)) return false;

    const comment = comments[spotId]?.find((item) => item.id === commentId);
    const reply = findReplyById(comment?.replies || [], replyId);
    if (!comment || !reply || reply.userId !== user.id) return false;

    const nextReplies = removeReplyById(comment.replies || [], replyId);

    setComments((prev) => ({
      ...prev,
      [spotId]: (prev[spotId] || []).map((item) =>
        item.id === commentId ? { ...item, replies: nextReplies } : item
      ),
    }));

    try {
      const sanitizedReplies = sanitizeRepliesForFirestore(nextReplies);
      await updateDoc(doc(db, 'spots', spotId, 'comments', commentId), {
        replies: sanitizedReplies,
        updatedAt: serverTimestamp(),
      });
      return true;
    } catch (error) {
      console.error('Failed to delete reply', error);
      setComments((prev) => ({
        ...prev,
        [spotId]: (prev[spotId] || []).map((item) =>
          item.id === commentId ? { ...item, replies: comment.replies || [] } : item
        ),
      }));
      return false;
    }
  }, [comments, user]);

  const getSpotById = useCallback(
    (id: string) => displaySpots.find((spot) => spot.id === id),
    [displaySpots]
  );

  const getSpotsByCategory = useCallback(
    (category: string) => {
      if (category === 'all') {
        return displaySpots.filter((spot) => spot.categoryIds.includes('all'));
      }

      const normalizedCategory = normalizePhotoCategory(category);
      return displaySpots.filter((spot) => spot.categoryIds.includes(normalizedCategory));
    },
    [displaySpots]
  );

  const getFavoriteSpots = useCallback(
    () => displaySpots.filter((spot) => {
      const isPrivateSpot = spot.visibility === 'private' || spot.isPublic === false;
      const isOwner = (spot.creatorId || spot.createdBy) === user.id;
      return favorites.includes(spot.id) && (!isPrivateSpot || isOwner);
    }),
    [displaySpots, favorites, user.id]
  );

  const getSpotComments = useCallback(
    (spotId: string) =>
      (displayComments[spotId] || []).map((comment) => ({
        ...comment,
        replies: comment.replies || [],
      })),
    [displayComments]
  );

  return (
    <SpotContext.Provider
      value={{
        spots: displaySpots,
        favorites,
        user,
        comments: displayComments,
        settings,
        isSyncing,
        isUserDataLoading,
        syncError,
        updateUserProfile,
        updateSettings,
        resetAppData,
        deleteAllSpotsFromDatabase,
        refreshSpots,
        addSpot,
        deleteSpot,
        toggleFavorite,
        addComment,
        addReply,
        toggleCommentLike,
        toggleReplyLike,
        deleteComment,
        deleteReply,
        getSpotById,
        getSpotsByCategory,
        getFavoriteSpots,
        getSpotComments,
      }}
    >
      {children}
    </SpotContext.Provider>
  );
}

export function useSpots() {
  const context = useContext(SpotContext);
  if (!context) {
    throw new Error('useSpots must be used within a SpotProvider');
  }
  return context;
}
