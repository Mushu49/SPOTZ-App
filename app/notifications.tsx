import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SPOTZ_BRAND, SPOTZ_THEME } from '../src/constants/brand';
import { useNotifications } from '../src/context/NotificationContext';
import { useSpots } from '../src/context/SpotContext';
import { useAppColorScheme, useIsSpotzTheme } from '../src/hooks/useAppColorScheme';
import { SpotzNotification } from '../src/types';

const GLASS_TAB_BAR_HEIGHT = 72;
const GLASS_TAB_BAR_BOTTOM_OFFSET = 8;

function getNotificationIcon(type: SpotzNotification['type']): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'spot_comment':
      return 'chatbubble-ellipses-outline';
    case 'comment_reply':
      return 'return-down-forward-outline';
    case 'spot_favorite':
      return 'heart-outline';
    default:
      return 'notifications-outline';
  }
}

function getNotificationTitle(notification: SpotzNotification) {
  switch (notification.type) {
    case 'spot_comment':
      return `${notification.actorUsername} commented on your spot`;
    case 'comment_reply':
      return `${notification.actorUsername} replied to your comment`;
    case 'spot_favorite':
      return `${notification.actorUsername} favorited your spot`;
    default:
      return 'New SPOTZ activity';
  }
}

function formatNotificationTime(date: Date) {
  const now = Date.now();
  const ageMs = Math.max(0, now - date.getTime());
  const minutes = Math.floor(ageMs / 60000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const colorScheme = useAppColorScheme();
  const isSpotzTheme = useIsSpotzTheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const { getSpotById } = useSpots();
  const {
    notifications,
    unreadCount,
    isLoading,
    markAllAsRead,
    clearAllNotifications,
    openNotification,
  } = useNotifications();
  const bottomPadding = insets.bottom + GLASS_TAB_BAR_HEIGHT + GLASS_TAB_BAR_BOTTOM_OFFSET + 24;
  const androidHeaderTopPadding = Math.max(insets.top, NativeStatusBar.currentHeight ?? 0) + 8;

  const handleClearNotifications = useCallback(() => {
    if (notifications.length === 0) return;

    clearAllNotifications().catch(() => {
      Alert.alert('Could not clear notifications', 'Please try again.');
    });
  }, [clearAllNotifications, notifications.length]);

  const renderNotification = ({ item }: { item: SpotzNotification }) => {
    const linkedSpot = item.spotId ? getSpotById(item.spotId) : undefined;
    const isSpotUnavailable = item.spotId && (!linkedSpot || linkedSpot.isRemoved === true);

    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          isDark && styles.notificationCardDark,
          isSpotzTheme && styles.notificationCardSpotz,
          !item.isRead && styles.notificationCardUnread,
        ]}
        onPress={() => openNotification(item)}
        activeOpacity={0.76}
      >
        <View style={[styles.iconBubble, isDark && styles.iconBubbleDark, isSpotzTheme && styles.iconBubbleSpotz]}>
          <Ionicons
            name={getNotificationIcon(item.type)}
            size={20}
            color={item.type === 'spot_favorite' ? '#ff3b30' : SPOTZ_BRAND.accent}
          />
        </View>
        <View style={styles.notificationContent}>
          <View style={styles.notificationTitleRow}>
            <Text style={[styles.notificationTitle, isDark && styles.textLight]} numberOfLines={2}>
              {getNotificationTitle(item)}
            </Text>
            {!item.isRead && <View style={styles.unreadDot} />}
          </View>
          <Text style={[styles.notificationBody, isDark && styles.textMuted]} numberOfLines={2}>
            {isSpotUnavailable
              ? 'This spot may no longer be available.'
              : item.spotTitle}
          </Text>
          <Text style={[styles.notificationTime, isDark && styles.textMuted]}>
            {formatNotificationTime(item.createdAt)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark, isSpotzTheme && styles.containerSpotz]}>
      {Platform.OS === 'android' && (
        <View
          style={[
            styles.androidTopBar,
            { paddingTop: androidHeaderTopPadding },
            isDark && styles.androidTopBarDark,
            isSpotzTheme && styles.androidTopBarSpotz,
          ]}
        >
          <TouchableOpacity
            style={styles.androidBackButton}
            onPress={() => router.back()}
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Ionicons name="chevron-back" size={28} color={isDark ? '#ffffff' : '#111827'} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.header}>
        <View style={styles.headerTextGroup}>
          <Text style={[styles.headerTitle, isDark && styles.textLight]} numberOfLines={1}>
            Notifications
          </Text>
          <Text style={[styles.headerSubtitle, isDark && styles.textMuted]}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
          </Text>
        </View>
        {notifications.length > 0 && (
          <View style={styles.headerActions}>
            {unreadCount > 0 && (
              <TouchableOpacity style={styles.markReadButton} onPress={markAllAsRead} activeOpacity={0.72}>
                <Text style={styles.markReadText}>Mark all read</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.clearButton} onPress={handleClearNotifications} activeOpacity={0.72}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={SPOTZ_BRAND.accent} />
          <Text style={[styles.centerStateText, isDark && styles.textMuted]}>
            Loading notifications...
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            notifications.length === 0 && styles.emptyListContent,
            { paddingBottom: bottomPadding },
          ]}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, isDark && styles.emptyIconDark]}>
                <Ionicons name="notifications-off-outline" size={30} color={SPOTZ_BRAND.accent} />
              </View>
              <Text style={[styles.emptyTitle, isDark && styles.textLight]}>
                No notifications yet
              </Text>
              <Text style={[styles.emptyBody, isDark && styles.textMuted]}>
                Comments, replies, and favorites on your spots will appear here.
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  containerDark: {
    backgroundColor: SPOTZ_BRAND.charcoal,
  },
  containerSpotz: {
    backgroundColor: SPOTZ_THEME.background,
  },
  androidTopBar: {
    paddingHorizontal: 8,
    paddingBottom: 4,
    backgroundColor: '#ffffff',
  },
  androidTopBarDark: {
    backgroundColor: SPOTZ_BRAND.charcoal,
  },
  androidTopBarSpotz: {
    backgroundColor: SPOTZ_THEME.background,
  },
  androidBackButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 6 : 18,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 3,
    fontWeight: '600',
  },
  textLight: {
    color: '#ffffff',
  },
  textMuted: {
    color: '#9ca3af',
  },
  markReadButton: {
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: 18,
    paddingHorizontal: 12,
    backgroundColor: SPOTZ_BRAND.accentSoft,
  },
  markReadText: {
    color: SPOTZ_BRAND.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearButton: {
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: 18,
    paddingHorizontal: 12,
  },
  clearText: {
    color: '#8b9e8b',
    fontSize: 13,
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 10,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  notificationCard: {
    minHeight: 84,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#f7f7f8',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  notificationCardDark: {
    backgroundColor: '#202124',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  notificationCardSpotz: {
    backgroundColor: SPOTZ_THEME.panel,
    borderColor: SPOTZ_THEME.border,
  },
  notificationCardUnread: {
    borderColor: SPOTZ_BRAND.accent,
  },
  iconBubble: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SPOTZ_BRAND.accentSoft,
  },
  iconBubbleDark: {
    backgroundColor: 'rgba(139, 158, 139, 0.14)',
  },
  iconBubbleSpotz: {
    backgroundColor: SPOTZ_THEME.accentSurface,
  },
  notificationContent: {
    flex: 1,
    minWidth: 0,
  },
  notificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  notificationTitle: {
    flex: 1,
    color: '#111827',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  notificationBody: {
    color: '#6b7280',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  notificationTime: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginTop: 5,
    backgroundColor: SPOTZ_BRAND.accent,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  centerStateText: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingBottom: 80,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SPOTZ_BRAND.accentSoft,
    marginBottom: 18,
  },
  emptyIconDark: {
    backgroundColor: 'rgba(139, 158, 139, 0.16)',
  },
  emptyTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '900',
  },
  emptyBody: {
    maxWidth: 300,
    color: '#6b7280',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
});
