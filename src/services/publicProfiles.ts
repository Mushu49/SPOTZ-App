import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { PublicCreatorProfile, User } from '../types';
import { normalizeImageUri } from '../utils/images';
import { auth, db } from './firebase';

type FirestoreDate = { toDate?: () => Date } | Date | string | number | null | undefined;

function getDate(value: FirestoreDate) {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value.toDate) return value.toDate();
  if (typeof value === 'object') return undefined;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function getErrorCode(error: unknown) {
  if (typeof error === 'object' && error && 'code' in error) {
    return String((error as { code?: string }).code);
  }

  return '';
}

function isPermissionDeniedError(error: unknown) {
  return getErrorCode(error).includes('permission-denied');
}

function omitUndefinedFields(fields: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined)
  );
}

export function getPublicCreatorProfileFromUser(user: User): PublicCreatorProfile {
  const profileImageUrl = normalizeImageUri(user.profileImage);

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    email: user.email,
    bio: user.bio || undefined,
    profileImageUrl,
    avatarUrl: profileImageUrl,
    joinedAt: getDate(user.joinedAt),
    showProfileImageInComments: user.showProfileImageInComments ?? true,
  };
}

export async function upsertPublicCreatorProfile(profile: {
  id: string;
  username: string;
  usernameLower?: string;
  displayName?: string;
  bio?: string;
  profileImageUrl?: string;
  showProfileImageInComments?: boolean;
  createdAt?: unknown;
}) {
  if (!db || !profile.id) return;
  if (auth?.currentUser?.uid !== profile.id) return;

  const showProfileImageInComments = profile.showProfileImageInComments ?? true;
  const hasProfileImageInput = profile.profileImageUrl !== undefined;
  const visibleProfileImageUrl = showProfileImageInComments
    ? normalizeImageUri(profile.profileImageUrl) || ''
    : '';
  const username = profile.username.trim();
  const usernameLower = profile.usernameLower || username.toLowerCase();

  try {
    await setDoc(doc(db, 'publicProfiles', profile.id), omitUndefinedFields({
      id: profile.id,
      userId: profile.id,
      username,
      usernameLower,
      normalizedUsername: usernameLower,
      displayName: profile.displayName?.trim() || username,
      bio: profile.bio === undefined ? undefined : profile.bio.trim(),
      profileImageUrl: hasProfileImageInput || !showProfileImageInComments ? visibleProfileImageUrl : undefined,
      avatarUrl: hasProfileImageInput || !showProfileImageInComments ? visibleProfileImageUrl : undefined,
      showProfileImageInComments,
      createdAt: profile.createdAt,
      updatedAt: serverTimestamp(),
    }), { merge: true });
  } catch (error) {
    if (!isPermissionDeniedError(error)) {
      throw error;
    }
  }
}

export async function fetchPublicCreatorProfile(
  creatorId: string
): Promise<PublicCreatorProfile | null> {
  if (!db || !creatorId) return null;

  try {
    const snapshot = await getDoc(doc(db, 'publicProfiles', creatorId));

    if (!snapshot.exists()) return null;

    const data = snapshot.data();
    const username = typeof data.username === 'string' ? data.username.trim() : '';
    const displayName = typeof data.displayName === 'string' ? data.displayName.trim() : '';
    const showProfileImageInComments = data.showProfileImageInComments ?? true;
    const profileImageUrl = normalizeImageUri(
      data.profileImageUrl || data.avatarUrl || data.profileImage || data.photoURL
    );
    const visibleProfileImageUrl = showProfileImageInComments ? profileImageUrl : undefined;

    return {
      id: creatorId,
      username,
      displayName: displayName || username,
      email: typeof data.email === 'string' ? data.email.trim() : undefined,
      bio: typeof data.bio === 'string' ? data.bio.trim() : undefined,
      profileImageUrl: visibleProfileImageUrl,
      avatarUrl: visibleProfileImageUrl,
      joinedAt: getDate(data.createdAt),
      showProfileImageInComments,
    };
  } catch (error) {
    if (!isPermissionDeniedError(error)) {
      console.error('Failed to fetch public creator profile', error);
    }
    return null;
  }
}
