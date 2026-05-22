import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import { SpotzNotificationType } from '../types';
import { isAndroidExpoGo } from '../utils/runtimeEnvironment';
import { db } from './firebase';

const NOTIFICATION_PROMPTED_KEY_PREFIX = '@spotz_notifications_prompted_';
const NOTIFICATION_CHANNEL_ID = 'spotz-community';

type CreateNotificationInput = {
  id: string;
  type: SpotzNotificationType;
  recipientId?: string | null;
  actorId: string;
  actorUsername: string;
  spotId: string;
  spotTitle: string;
  commentId?: string | null;
  rootCommentId?: string | null;
  parentId?: string | null;
  replyId?: string | null;
};

type NotificationRegistrationResult = {
  status: Notifications.PermissionStatus | 'unsupported' | 'missing-project-id' | 'error';
  token?: string;
};

let hasConfiguredNotifications = false;

function getPromptedStorageKey(userId: string) {
  return `${NOTIFICATION_PROMPTED_KEY_PREFIX}${userId}`;
}

function getExpoProjectId() {
  return (
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    ''
  );
}

function getPushTokenDocId(token: string) {
  return token.replace(/[^\w.-]/g, '_').slice(0, 180);
}

export function supportsRemotePushNotifications() {
  return Platform.OS !== 'web' && !isAndroidExpoGo();
}

export async function configureSpotzNotifications() {
  if (hasConfiguredNotifications) return;
  hasConfiguredNotifications = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === 'android' && !isAndroidExpoGo()) {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
      name: 'SPOTZ community',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: '#8b9e8b',
      sound: undefined,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
}

export async function getNotificationPermissionStatus() {
  if (!supportsRemotePushNotifications()) return 'unsupported';

  const permissions = await Notifications.getPermissionsAsync();
  return permissions.status;
}

export async function storeExpoPushTokenForUser(userId: string, token: string) {
  if (!db || !userId || !token) return;

  const tokenId = getPushTokenDocId(token);
  await setDoc(doc(db, 'users', userId, 'pushTokens', tokenId), {
    id: tokenId,
    token,
    platform: Platform.OS,
    enabled: true,
    provider: 'expo',
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true });
}

export async function registerForPushNotificationsAsync(
  userId: string,
  shouldPrompt: boolean
): Promise<NotificationRegistrationResult> {
  if (!supportsRemotePushNotifications()) return { status: 'unsupported' };
  if (!userId) return { status: 'error' };

  try {
    await configureSpotzNotifications();

    const currentPermissions = await Notifications.getPermissionsAsync();
    let status = currentPermissions.status;

    if (status !== Notifications.PermissionStatus.GRANTED && shouldPrompt) {
      const promptedPermissions = await Notifications.requestPermissionsAsync();
      status = promptedPermissions.status;
      await AsyncStorage.setItem(getPromptedStorageKey(userId), 'true');
    }

    if (status !== Notifications.PermissionStatus.GRANTED) {
      return { status };
    }

    const projectId = getExpoProjectId();
    if (!projectId) {
      return { status: 'missing-project-id' };
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    await storeExpoPushTokenForUser(userId, tokenResponse.data);

    return {
      status,
      token: tokenResponse.data,
    };
  } catch (error) {
    console.error('[Notifications] Failed to register for push notifications', error);
    return { status: 'error' };
  }
}

export async function syncPushTokenIfAlreadyGranted(userId: string, notificationsEnabled: boolean) {
  if (!notificationsEnabled) return { status: await getNotificationPermissionStatus() };

  const status = await getNotificationPermissionStatus();
  if (status === Notifications.PermissionStatus.GRANTED) {
    return registerForPushNotificationsAsync(userId, false);
  }

  return { status };
}

export async function maybeRequestNotificationsAfterInteraction(
  userId: string,
  notificationsEnabled: boolean
) {
  if (!notificationsEnabled || !userId) return { status: await getNotificationPermissionStatus() };

  const hasPrompted = await AsyncStorage.getItem(getPromptedStorageKey(userId));
  const currentStatus = await getNotificationPermissionStatus();
  const shouldPrompt =
    !hasPrompted &&
    currentStatus !== Notifications.PermissionStatus.GRANTED &&
    currentStatus !== Notifications.PermissionStatus.DENIED;

  return registerForPushNotificationsAsync(userId, shouldPrompt);
}

export async function setNotificationsEnabledForUser(userId: string, enabled: boolean) {
  if (!db || !userId) return;

  await setDoc(doc(db, 'users', userId), {
    notificationPreferences: {
      community: enabled,
      push: enabled,
    },
    notificationsEnabled: enabled,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function createNotificationDocument(input: CreateNotificationInput) {
  if (!db || !input.recipientId) return;
  if (input.recipientId === input.actorId) return;

  await setDoc(doc(db, 'notifications', input.id), {
    type: input.type,
    recipientId: input.recipientId,
    actorId: input.actorId,
    actorUsername: input.actorUsername,
    spotId: input.spotId,
    spotTitle: input.spotTitle,
    commentId: input.commentId || null,
    rootCommentId: input.rootCommentId || null,
    parentId: input.parentId || null,
    replyId: input.replyId || null,
    isRead: false,
    readAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function markNotificationRead(notificationId: string) {
  if (!db || !notificationId) return;

  await updateDoc(doc(db, 'notifications', notificationId), {
    isRead: true,
    readAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteNotification(notificationId: string) {
  if (!db || !notificationId) return;

  await deleteDoc(doc(db, 'notifications', notificationId));
}
