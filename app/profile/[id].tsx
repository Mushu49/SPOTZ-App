import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SPOTZ_BRAND, SPOTZ_PIN_LOGO_SOURCE } from '../../src/constants/brand';
import { ReportModal } from '../../src/components/ReportModal';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { useSpots } from '../../src/context/SpotContext';
import { useAppColorScheme } from '../../src/hooks/useAppColorScheme';
import { PublicCreatorProfile, PhotoSpot, getCategoryLabel } from '../../src/types';
import { getSpotLocationLabel } from '../../src/utils/location';
import { getImageSource, getSpotCoverImageSource, normalizeImageUri } from '../../src/utils/images';
import {
  fetchPublicCreatorProfile,
  getPublicCreatorProfileFromUser,
} from '../../src/services/publicProfiles';
import {
  isDuplicateReportError,
  ReportReason,
  submitReport,
} from '../../src/services/reports';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

function isPrivateSpot(spot: PhotoSpot) {
  return spot.visibility === 'private' || spot.isPublic === false;
}

function CreatorAvatar({
  imageUri,
  username,
  isDark,
}: {
  imageUri?: string;
  username: string;
  isDark: boolean;
}) {
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [imageUri]);

  if (imageUri && !hasImageError) {
    return (
      <Image
        source={getImageSource(imageUri)}
        style={styles.avatarImage}
        resizeMode="cover"
        onError={() => setHasImageError(true)}
      />
    );
  }

  return (
    <View style={[styles.avatarPlaceholder, isDark && styles.avatarPlaceholderDark]}>
      <Image source={SPOTZ_PIN_LOGO_SOURCE} style={styles.avatarPlaceholderLogo} resizeMode="contain" />
    </View>
  );
}

function StatItem({
  value,
  label,
  isDark,
}: {
  value: number;
  label: string;
  isDark: boolean;
}) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, isDark && styles.textLight]}>{value}</Text>
      <Text style={[styles.statLabel, isDark && styles.textMuted]}>{label}</Text>
    </View>
  );
}

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const creatorId = id || '';
  const router = useRouter();
  const colorScheme = useAppColorScheme();
  const isDark = colorScheme === 'dark';
  const { spots, user } = useSpots();
  const [profile, setProfile] = useState<PublicCreatorProfile | null>(null);
  const [hasLoadedProfile, setHasLoadedProfile] = useState(false);
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);

  const creatorSpots = useMemo(
    () => spots.filter((spot) => (spot.creatorId || spot.createdBy) === creatorId && !isPrivateSpot(spot)),
    [creatorId, spots]
  );
  const creatorHint = creatorSpots.find(
    (spot) => spot.creatorUsername || spot.creatorDisplayName || spot.creatorAvatarUrl
  );
  const username =
    profile?.username ||
    creatorHint?.creatorUsername ||
    (creatorId === user.id ? user.username : 'SPOTZ Creator');
  const displayName =
    profile?.displayName ||
    creatorHint?.creatorDisplayName ||
    creatorHint?.creatorUsername ||
    (creatorId === user.id ? user.displayName || user.username : username);
  const canShowProfileImage =
    creatorId === user.id ||
    profile?.showProfileImageInComments === true ||
    (!profile && creatorHint?.creatorShowProfileImageInComments === true);
  const avatarUrl = canShowProfileImage
    ? profile?.profileImageUrl ||
      profile?.avatarUrl ||
      normalizeImageUri(creatorHint?.creatorAvatarUrl) ||
      (creatorId === user.id ? normalizeImageUri(user.profileImage) : undefined)
    : undefined;
  const bio = profile?.bio || (creatorId === user.id ? user.bio : undefined);
  const joinedAt = profile?.joinedAt || (creatorId === user.id ? user.joinedAt : undefined);
  const totalLikes = creatorSpots.reduce((sum, spot) => sum + (spot.favoriteCount || 0), 0);
  const canReportCreator = !!creatorId && creatorId !== user.id;
  const profileUnavailable = hasLoadedProfile && !profile && creatorId !== user.id;

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      setHasLoadedProfile(false);

      if (!creatorId) {
        setProfile(null);
        setHasLoadedProfile(true);
        return;
      }

      if (creatorId === user.id) {
        setProfile(getPublicCreatorProfileFromUser(user));
        setHasLoadedProfile(true);
        return;
      }

      const nextProfile = await fetchPublicCreatorProfile(creatorId);

      if (isMounted) {
        setProfile(nextProfile);
        setHasLoadedProfile(true);
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [creatorId, user]);

  const formatJoinedDate = (date?: Date | string) => {
    if (!date) return '';
    const joinedDate = date instanceof Date ? date : new Date(date);

    if (Number.isNaN(joinedDate.getTime())) return '';

    return `Joined ${joinedDate.toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    })}`;
  };

  const handleSpotPress = (spotId: string) => {
    router.push({ pathname: '/spot/[id]', params: { id: spotId } } as any);
  };

  const handleBackPress = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/discover' as any);
  }, [router]);

  const handleSubmitReport = async (reason: ReportReason, details: string) => {
    try {
      await submitReport({
        targetType: 'user',
        // For profile reports, the reported user is both the target id and target owner.
        targetId: creatorId,
        targetOwnerId: creatorId,
        reportedUserId: creatorId,
        reportedUserDisplayName: displayName,
        reportedUserHandle: username,
        reason,
        details,
      });
      setIsReportModalVisible(false);
      Alert.alert('Thanks, your report was submitted.');
    } catch (error) {
      if (isDuplicateReportError(error)) {
        Alert.alert('Report Already Submitted', 'You recently reported this profile for the same reason.');
        return;
      }

      const message = error instanceof Error ? error.message : 'Unable to submit this report right now.';
      Alert.alert('Report Failed', message);
    }
  };

  const renderSpotCard = ({ item }: { item: PhotoSpot }) => (
    <TouchableOpacity
      style={[styles.spotCard, isDark && styles.spotCardDark]}
      onPress={() => handleSpotPress(item.id)}
      activeOpacity={0.84}
    >
      <Image
        source={getSpotCoverImageSource(item, 'thumbnail')}
        style={styles.spotImage}
        resizeMode="cover"
      />
      <View style={styles.spotInfo}>
        <Text style={[styles.spotTitle, isDark && styles.textLight]} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.spotCategoryRow}>
          <CategoryIcon category={item.category} size={12} style={styles.spotCategoryIcon} />
          <Text style={[styles.spotCategory, isDark && styles.textMuted]} numberOfLines={1}>
            {getCategoryLabel(item.category)}
          </Text>
        </View>
        <Text style={[styles.spotLocation, isDark && styles.textMuted]} numberOfLines={1}>
          {getSpotLocationLabel(item)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <Stack.Screen
        options={{
          title: username ? `@${username}` : 'Creator Profile',
          headerStyle: { backgroundColor: isDark ? SPOTZ_BRAND.charcoal : '#ffffff' },
          headerTintColor: isDark ? '#ffffff' : '#000000',
          headerBackTitle: '',
          headerBackButtonDisplayMode: 'minimal',
          headerBackVisible: false,
          headerTitleAlign: 'center',
          headerTitleStyle: {
            color: isDark ? '#ffffff' : '#000000',
            fontSize: 17,
            fontWeight: '600',
          },
          headerLeft: () => (
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={handleBackPress}
              activeOpacity={0.72}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={28} color={isDark ? '#ffffff' : '#111827'} />
            </TouchableOpacity>
          ),
          headerRight: () => canReportCreator ? (
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => setIsReportModalVisible(true)}
              activeOpacity={0.72}
              accessibilityRole="button"
              accessibilityLabel="Report creator profile"
            >
              <Ionicons name="flag-outline" size={21} color={isDark ? '#ffffff' : '#111827'} />
            </TouchableOpacity>
          ) : null,
        }}
      />
      <FlatList
        data={creatorSpots}
        renderItem={renderSpotCard}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={creatorSpots.length > 1 ? styles.gridRow : undefined}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.profileHeader}>
            <CreatorAvatar imageUri={avatarUrl} username={displayName} isDark={isDark} />
            <Text style={[styles.username, isDark && styles.textLight]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.handle} numberOfLines={1}>
              @{username}
            </Text>
            {!!bio && (
              <Text style={[styles.bio, isDark && styles.textMuted]}>
                {bio}
              </Text>
            )}
            {profileUnavailable && (
              <Text style={[styles.bio, isDark && styles.textMuted]}>
                Profile details are unavailable.
              </Text>
            )}
            {!!formatJoinedDate(joinedAt) && (
              <View style={styles.joinedRow}>
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={isDark ? '#8e8e93' : '#6b7280'}
                />
                <Text style={[styles.joinedText, isDark && styles.textMuted]}>
                  {formatJoinedDate(joinedAt)}
                </Text>
              </View>
            )}
            <View style={[styles.statsContainer, isDark && styles.statsContainerDark]}>
              <StatItem value={creatorSpots.length} label="Uploaded spots" isDark={isDark} />
              <View style={styles.statDivider} />
              <StatItem value={totalLikes} label="Likes received" isDark={isDark} />
            </View>
            <Text style={[styles.sectionTitle, isDark && styles.textLight]}>
              Uploaded Spots
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, isDark && styles.textMuted]}>
              {hasLoadedProfile ? 'No uploaded spots yet' : 'Loading creator spots...'}
            </Text>
          </View>
        }
      />
      <ReportModal
        visible={isReportModalVisible}
        isDark={isDark}
        title="Report Profile"
        onClose={() => setIsReportModalVisible(false)}
        onSubmit={handleSubmitReport}
      />
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
  textLight: {
    color: '#ffffff',
  },
  textMuted: {
    color: '#888888',
  },
  headerIconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  profileHeader: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 18,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#d1d5db',
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SPOTZ_BRAND.accentSoft,
  },
  avatarPlaceholderDark: {
    backgroundColor: 'rgba(139, 158, 139, 0.16)',
  },
  avatarPlaceholderLogo: {
    width: 62,
    height: 70,
  },
  username: {
    maxWidth: '100%',
    color: '#000000',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 16,
  },
  handle: {
    color: '#9b9b9f',
    fontSize: 13,
    marginTop: 3,
  },
  bio: {
    color: '#666666',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 12,
  },
  joinedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  joinedText: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '600',
  },
  statsContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7f7f8',
    borderRadius: 16,
    paddingVertical: 18,
    marginTop: 22,
    marginBottom: 24,
  },
  statsContainerDark: {
    backgroundColor: '#252629',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  statValue: {
    color: '#000000',
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    color: '#666666',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 5,
    textAlign: 'center',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 34,
    backgroundColor: 'rgba(150, 150, 150, 0.28)',
  },
  sectionTitle: {
    alignSelf: 'flex-start',
    color: '#000000',
    fontSize: 18,
    fontWeight: '700',
  },
  gridRow: {
    justifyContent: 'space-between',
  },
  spotCard: {
    width: CARD_WIDTH,
    height: 184,
    backgroundColor: '#fbfbfc',
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    overflow: 'hidden',
  },
  spotCardDark: {
    backgroundColor: '#2a2a2a',
    borderWidth: 0,
  },
  spotImage: {
    width: '100%',
    height: 100,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  spotInfo: {
    height: 84,
    padding: 10,
    justifyContent: 'space-between',
  },
  spotTitle: {
    color: '#000000',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
    height: 34,
  },
  spotCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 14,
  },
  spotCategoryIcon: {
    marginRight: 4,
  },
  spotCategory: {
    flexShrink: 1,
    color: '#4f5560',
    fontSize: 11,
    lineHeight: 14,
  },
  spotLocation: {
    color: '#4f5560',
    fontSize: 10,
    lineHeight: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  emptyText: {
    color: '#666666',
    fontSize: 14,
    textAlign: 'center',
  },
});
