import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';

import { useSpots } from './SpotContext';
import { db } from '../services/firebase';
import {
  configureSpotzNotifications,
  markNotificationRead,
  registerForPushNotificationsAsync,
  setNotificationsEnabledForUser,
  syncPushTokenIfAlreadyGranted,
} from '../services/notifications';
import { SpotzNotification, SpotzNotificationType } from '../types';

type FirestoreDate = { toDate?: () => Date } | Date | string | number | null | undefined;

type NotificationContextValue = {
  notifications: SpotzNotification[];
  unreadCount: number;
  permissionStatus: Notifications.PermissionStatus | 'unsupported' | 'missing-project-id' | 'error' | null;
  isLoading: boolean;
  isRegistering: boolean;
  requestNotificationPermission: () => Promise<NotificationContextValue['permissionStatus']>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  openNotification: (notification: SpotzNotification) => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

function getDate(value: FirestoreDate) {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === 'object' && typeof value.toDate === 'function') return value.toDate();
  if (typeof value !== 'string' && typeof value !== 'number') return new Date();

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function getNotificationFromFirestore(id: string, data: Record<string, any>): SpotzNotification {
  return {
    id,
    type: data.type as SpotzNotificationType,
    recipientId: data.recipientId || '',
    actorId: data.actorId || '',
    actorUsername: data.actorUsername || 'Someone',
    spotId: data.spotId || '',
    spotTitle: data.spotTitle || 'a SPOTZ location',
    commentId: data.commentId || null,
    rootCommentId: data.rootCommentId || null,
    parentId: data.parentId || null,
    replyId: data.replyId || null,
    isRead: data.isRead === true,
    createdAt: getDate(data.createdAt),
    readAt: data.readAt ? getDate(data.readAt) : null,
  };
}

function getNotificationMessage(notification: SpotzNotification) {
  switch (notification.type) {
    case 'spot_comment':
      return `${notification.actorUsername} commented on ${notification.spotTitle}.`;
    case 'comment_reply':
      return `${notification.actorUsername} replied to your comment on ${notification.spotTitle}.`;
    case 'spot_favorite':
      return `${notification.actorUsername} favorited ${notification.spotTitle}.`;
    default:
      return `${notification.actorUsername} interacted with ${notification.spotTitle}.`;
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, settings } = useSpots();
  const [notifications, setNotifications] = useState<SpotzNotification[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<NotificationContextValue['permissionStatus']>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const hasLoadedInitialSnapshot = useRef(false);
  const seenNotificationIds = useRef(new Set<string>());

  useEffect(() => {
    configureSpotzNotifications().catch((error) => {
      console.error('[Notifications] Failed to configure notifications', error);
    });
  }, []);

  useEffect(() => {
    if (!user.id || user.isBanned || !db) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    hasLoadedInitialSnapshot.current = false;
    seenNotificationIds.current = new Set();

    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('recipientId', '==', user.id),
      orderBy('createdAt', 'desc'),
      limit(60)
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const nextNotifications = snapshot.docs
          .filter((notificationDoc) => notificationDoc.data().hidden !== true)
          .map((notificationDoc) =>
            getNotificationFromFirestore(notificationDoc.id, notificationDoc.data())
          );

        if (hasLoadedInitialSnapshot.current && settings.notificationsEnabled) {
          snapshot.docChanges().forEach((change) => {
            if (change.type !== 'added') return;
            if (seenNotificationIds.current.has(change.doc.id)) return;
            if (change.doc.data().hidden === true) return;

            const notification = getNotificationFromFirestore(change.doc.id, change.doc.data());
            if (notification.isRead) return;

            Notifications.scheduleNotificationAsync({
              content: {
                title: 'SPOTZ',
                body: getNotificationMessage(notification),
                data: {
                  notificationId: notification.id,
                  spotId: notification.spotId,
                  commentId: notification.commentId,
                  rootCommentId: notification.rootCommentId,
                  replyId: notification.replyId,
                },
              },
              trigger: null,
            }).catch((error) => {
              console.error('[Notifications] Failed to schedule local notification', error);
            });
          });
        }

        nextNotifications.forEach((notification) => {
          seenNotificationIds.current.add(notification.id);
        });
        hasLoadedInitialSnapshot.current = true;
        setNotifications(nextNotifications);
        setIsLoading(false);
      },
      (error) => {
        console.error('[Notifications] Failed to load notifications', error);
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, [settings.notificationsEnabled, user.id, user.isBanned]);

  useEffect(() => {
    if (!user.id || user.isBanned) return;

    setNotificationsEnabledForUser(user.id, settings.notificationsEnabled).catch((error) => {
      console.error('[Notifications] Failed to persist notification preference', error);
    });

    syncPushTokenIfAlreadyGranted(user.id, settings.notificationsEnabled)
      .then((result) => setPermissionStatus(result.status as NotificationContextValue['permissionStatus']))
      .catch((error) => {
        console.error('[Notifications] Failed to sync push token', error);
        setPermissionStatus('error');
      });
  }, [settings.notificationsEnabled, user.id, user.isBanned]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data || {};
      const notificationId = typeof data.notificationId === 'string' ? data.notificationId : '';
      const spotId = typeof data.spotId === 'string' ? data.spotId : '';
      const commentId = typeof data.commentId === 'string' ? data.commentId : '';
      const replyId = typeof data.replyId === 'string' ? data.replyId : '';

      if (notificationId) {
        markNotificationRead(notificationId).catch(() => {});
      }

      if (spotId) {
        router.push({
          pathname: '/spot/[id]',
          params: {
            id: spotId,
            commentId,
            replyId,
            from: 'notifications',
          },
        } as any);
      }
    });

    return () => subscription.remove();
  }, [router]);

  const requestNotificationPermission = useCallback(async () => {
    if (!user.id || user.isBanned) return permissionStatus;
    if (isRegistering) return permissionStatus;

    setIsRegistering(true);
    try {
      const result = await registerForPushNotificationsAsync(user.id, true);
      setPermissionStatus(result.status);
      return result.status;
    } finally {
      setIsRegistering(false);
    }
  }, [isRegistering, permissionStatus, user.id, user.isBanned]);

  const markAsRead = useCallback(async (notificationId: string) => {
    await markNotificationRead(notificationId);
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!db) return;
    const firestore = db;

    const unreadNotifications = notifications.filter((notification) => !notification.isRead);
    if (unreadNotifications.length === 0) return;

    const batch = writeBatch(db);
    unreadNotifications.forEach((notification) => {
      batch.update(doc(firestore, 'notifications', notification.id), {
        isRead: true,
        readAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }, [notifications]);

  const clearAllNotifications = useCallback(async () => {
    if (!db || !user.id || notifications.length === 0) return;
    const firestore = db;
    const notificationsToClear = notifications.filter(
      (notification) => notification.recipientId === user.id
    );
    if (notificationsToClear.length === 0) return;
    const clearedNotificationIds = new Set(
      notificationsToClear.map((notification) => notification.id)
    );

    setNotifications((currentNotifications) =>
      currentNotifications.filter((notification) => !clearedNotificationIds.has(notification.id))
    );

    try {
      const batch = writeBatch(db);
      notificationsToClear.forEach((notification) => {
        batch.update(doc(firestore, 'notifications', notification.id), {
          hidden: true,
          clearedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    } catch (error) {
      setNotifications((currentNotifications) => [
        ...notificationsToClear,
        ...currentNotifications.filter((notification) => !clearedNotificationIds.has(notification.id)),
      ].sort((firstNotification, secondNotification) =>
        secondNotification.createdAt.getTime() - firstNotification.createdAt.getTime()
      ));
      throw error;
    }
  }, [notifications, user.id]);

  const openNotification = useCallback(async (notification: SpotzNotification) => {
    if (!notification.isRead) {
      await markNotificationRead(notification.id).catch(() => {});
    }

    if (notification.spotId) {
      router.push({
        pathname: '/spot/[id]',
        params: {
          id: notification.spotId,
          commentId: notification.commentId || notification.rootCommentId || '',
          replyId: notification.replyId || '',
          from: 'notifications',
        },
      } as any);
    }
  }, [router]);

  const value = useMemo<NotificationContextValue>(() => ({
    notifications,
    unreadCount: notifications.filter((notification) => !notification.isRead).length,
    permissionStatus,
    isLoading,
    isRegistering,
    requestNotificationPermission,
    markAsRead,
    markAllAsRead,
    clearAllNotifications,
    openNotification,
  }), [
    notifications,
    permissionStatus,
    isLoading,
    isRegistering,
    requestNotificationPermission,
    markAsRead,
    markAllAsRead,
    clearAllNotifications,
    openNotification,
  ]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }

  return context;
}
