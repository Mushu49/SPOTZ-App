// filepath: app/(tabs)/discover.tsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  FlatList,
  Image,
  TextInput,
  Dimensions,
  Keyboard,
  Animated,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FavoriteHeartButton } from '@/components/FavoriteHeartButton';
import { SPOTZ_BRAND, SPOTZ_THEME } from '../../src/constants/brand';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { useSpots } from '../../src/context/SpotContext';
import { useLocationPermission } from '../../src/context/LocationPermissionContext';
import { useAppColorScheme, useIsSpotzTheme } from '../../src/hooks/useAppColorScheme';
import {
  ALL_CATEGORY_FILTER,
  CATEGORIES,
  CategoryFilterId,
  PhotoSpot,
  SpotComment,
  SpotReply,
  getCategoryLabel,
} from '../../src/types';
import { getSpotCoverImageSource } from '../../src/utils/images';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;
const GRID_GAP = 16;
type CategoryFilterItem = { id: CategoryFilterId; value: CategoryFilterId; label: string };
type DiscoverTab = 'popular' | 'nearby' | 'recent' | 'favorites';
type NearbySpot = PhotoSpot & { distanceKm?: number };
type CommentsBySpot = Record<string, SpotComment[] | undefined>;
const DISCOVER_TABS: DiscoverTab[] = ['popular', 'nearby', 'recent', 'favorites'];
const DISCOVER_INITIAL_VISIBLE_COUNT = 10;
const DISCOVER_LOAD_MORE_COUNT = 10;
const DISCOVER_TAB_BAR_HEIGHT = 72;
const DISCOVER_TAB_BAR_BOTTOM_OFFSET = 8;
const DISCOVER_TAB_BAR_CLEARANCE = 32;

function getFirebaseErrorCode(error: unknown) {
  if (typeof error === 'object' && error && 'code' in error) {
    return String((error as { code?: string }).code || '');
  }

  return '';
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message?: string }).message || '');
  }

  return String(error || '');
}

function getRefreshFailureMessage(error: unknown) {
  const code = getFirebaseErrorCode(error);
  const message = getErrorMessage(error).toLowerCase();

  if (code.includes('permission-denied')) {
    return 'Your account does not currently have permission to load public spots.';
  }

  if (code.includes('unavailable') || message.includes('offline') || message.includes('network')) {
    return 'SPOTZ could not reach Firestore. Check your connection and try again.';
  }

  return 'Unable to load the latest spots right now.';
}

function createInitialVisibleCounts(): Record<DiscoverTab, number> {
  return {
    popular: DISCOVER_INITIAL_VISIBLE_COUNT,
    nearby: DISCOVER_INITIAL_VISIBLE_COUNT,
    recent: DISCOVER_INITIAL_VISIBLE_COUNT,
    favorites: DISCOVER_INITIAL_VISIBLE_COUNT,
  };
}

function getCommentAuthorId(item: Pick<SpotComment | SpotReply, 'authorId' | 'userId'>) {
  return item.authorId || item.userId || '';
}

function addReplyAuthorIds(replies: SpotReply[] | undefined, authorIds: Set<string>) {
  (replies || []).forEach((reply) => {
    const authorId = getCommentAuthorId(reply);
    if (authorId) authorIds.add(authorId);
    addReplyAuthorIds(reply.replies, authorIds);
  });
}

function getUniqueCommenterCount(comments: SpotComment[] | undefined) {
  const authorIds = new Set<string>();

  (comments || []).forEach((comment) => {
    const authorId = getCommentAuthorId(comment);
    if (authorId) authorIds.add(authorId);
    addReplyAuthorIds(comment.replies, authorIds);
  });

  return authorIds.size;
}

function getPopularityScore(spot: PhotoSpot, comments: SpotComment[] | undefined) {
  const favoriteCount = Math.max(0, Number(spot.favoriteCount) || 0);
  return favoriteCount + getUniqueCommenterCount(comments);
}

function sortSpotsByPopularity(spots: PhotoSpot[], comments: CommentsBySpot) {
  return [...spots].sort((a, b) => {
    const scoreDifference = getPopularityScore(b, comments[b.id]) - getPopularityScore(a, comments[a.id]);

    if (scoreDifference !== 0) return scoreDifference;

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function isPrivateSpot(spot: PhotoSpot) {
  return spot.visibility === 'private' || spot.isPublic === false;
}

function CategoryChip({
  item,
  isSelected,
  isDark,
  isSpotzTheme,
  onPress,
}: {
  item: CategoryFilterItem;
  isSelected: boolean;
  isDark: boolean;
  isSpotzTheme: boolean;
  onPress: () => void;
}) {
  const progress = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: isSelected ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [isSelected, progress]);

  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [isSpotzTheme ? SPOTZ_THEME.panel : isDark ? '#2a2a2a' : '#f5f5f5', SPOTZ_BRAND.accent],
  });
  const borderColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [isSpotzTheme ? SPOTZ_THEME.border : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', SPOTZ_BRAND.accent],
  });
  const textColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [isSpotzTheme ? SPOTZ_THEME.text : isDark ? '#b6b6b6' : '#555555', isSpotzTheme ? SPOTZ_THEME.accentText : '#ffffff'],
  });
  const chipScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.02],
  });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.82}>
      <Animated.View
        style={[
          styles.categoryChip,
          {
            backgroundColor,
            borderColor,
            transform: [{ scale: chipScale }],
          },
        ]}
      >
        <CategoryIcon category={item.value} size={14} style={styles.categoryChipIcon} />
        <Animated.Text style={[styles.categoryChipLabel, { color: textColor }]}>
          {item.label}
        </Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function DiscoverScreen() {
  const router = useRouter();
  const colorScheme = useAppColorScheme();
  const isSpotzTheme = useIsSpotzTheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const {
    spots,
    favorites,
    comments,
    user,
    isSyncing,
    isUserDataLoading,
    toggleFavorite,
    refreshSpots,
  } = useSpots();
  const {
    coords: userLocation,
    isLocationAccessEnabled,
    locationFeaturesEnabled,
    permissionStatus,
  } = useLocationPermission();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilterId>('all');
  const [activeTab, setActiveTab] = useState<DiscoverTab>('popular');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [popularOrderIds, setPopularOrderIds] = useState<string[]>([]);
  const [hasInitializedPopularOrder, setHasInitializedPopularOrder] = useState(false);
  const [visibleCountsByTab, setVisibleCountsByTab] = useState<Record<DiscoverTab, number>>(
    createInitialVisibleCounts
  );
  const isMountedRef = useRef(true);
  const listBottomPadding =
    insets.bottom +
    DISCOVER_TAB_BAR_HEIGHT +
    DISCOVER_TAB_BAR_BOTTOM_OFFSET +
    DISCOVER_TAB_BAR_CLEARANCE;

  const hasLoadedInitialDiscoverData = !isUserDataLoading && !isSyncing;
  const canInitializePopularOrder = useMemo(
    () =>
      hasLoadedInitialDiscoverData &&
      (
        spots.length === 0 ||
        spots.every((spot) => isPrivateSpot(spot) || Object.prototype.hasOwnProperty.call(comments, spot.id))
      ),
    [comments, hasLoadedInitialDiscoverData, spots]
  );

  const matchesDiscoverFilters = useCallback(
    (spot: PhotoSpot) => {
      const normalizedSearchQuery = searchQuery.toLowerCase();
      const matchesSearch = normalizedSearchQuery
        ? spot.title.toLowerCase().includes(normalizedSearchQuery) ||
          spot.description.toLowerCase().includes(normalizedSearchQuery)
        : true;
      const matchesCategory = spot.categoryIds.includes(selectedCategory);
      return matchesSearch && matchesCategory;
    },
    [searchQuery, selectedCategory]
  );

  const visibleDiscoverSpots = useMemo(
    () => spots.filter((spot) => !isPrivateSpot(spot)),
    [spots]
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (hasInitializedPopularOrder || !canInitializePopularOrder) return;

    setPopularOrderIds(sortSpotsByPopularity(visibleDiscoverSpots, comments).map((spot) => spot.id));
    setHasInitializedPopularOrder(true);
  }, [canInitializePopularOrder, comments, hasInitializedPopularOrder, visibleDiscoverSpots]);

  // Filter spots based on search and category
  const filteredSpots = useMemo(
    () => visibleDiscoverSpots.filter(matchesDiscoverFilters),
    [matchesDiscoverFilters, visibleDiscoverSpots]
  );

  const stablePopularSpots = useMemo(() => {
    if (!hasInitializedPopularOrder) {
      return sortSpotsByPopularity(visibleDiscoverSpots, comments);
    }

    const spotById = new Map(visibleDiscoverSpots.map((spot) => [spot.id, spot]));
    const orderedSpots = popularOrderIds
      .map((spotId) => spotById.get(spotId))
      .filter((spot): spot is PhotoSpot => Boolean(spot));
    const orderedSpotIds = new Set(popularOrderIds);
    const currentUserNewSpots = visibleDiscoverSpots.filter(
      (spot) => !orderedSpotIds.has(spot.id) && (spot.creatorId || spot.createdBy) === user.id
    );

    return [...currentUserNewSpots, ...orderedSpots];
  }, [comments, hasInitializedPopularOrder, popularOrderIds, user.id, visibleDiscoverSpots]);

  const popularSpots = useMemo(
    () => stablePopularSpots.filter(matchesDiscoverFilters),
    [matchesDiscoverFilters, stablePopularSpots]
  );

  const recentSpots = useMemo(
    () => [...filteredSpots].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [filteredSpots]
  );

  const favoriteSpots = useMemo(
    () => filteredSpots.filter((spot) => favorites.includes(spot.id)),
    [favorites, filteredSpots]
  );

  const getDistanceKm = useCallback((spot: PhotoSpot) => {
    if (!locationFeaturesEnabled || !userLocation) return Number.POSITIVE_INFINITY;

    const earthRadiusKm = 6371;
    const latitudeDelta = ((spot.latitude - userLocation.latitude) * Math.PI) / 180;
    const longitudeDelta = ((spot.longitude - userLocation.longitude) * Math.PI) / 180;
    const userLatitude = (userLocation.latitude * Math.PI) / 180;
    const spotLatitude = (spot.latitude * Math.PI) / 180;
    const haversine =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(userLatitude) *
        Math.cos(spotLatitude) *
        Math.sin(longitudeDelta / 2) ** 2;

    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  }, [locationFeaturesEnabled, userLocation]);

  const nearbySpots: NearbySpot[] = useMemo(
    () =>
      locationFeaturesEnabled && userLocation
        ? filteredSpots
            .map((spot) => ({
              ...spot,
              distanceKm: getDistanceKm(spot),
            }))
            .sort((a, b) => a.distanceKm - b.distanceKm)
        : [],
    [filteredSpots, getDistanceKm, locationFeaturesEnabled, userLocation]
  );

  const visibleTabSpots = useMemo(
    () =>
      activeTab === 'favorites'
        ? favoriteSpots
        : activeTab === 'nearby'
          ? nearbySpots
          : activeTab === 'recent'
            ? recentSpots
            : popularSpots,
    [activeTab, favoriteSpots, nearbySpots, popularSpots, recentSpots]
  );
  const activeVisibleCount =
    visibleCountsByTab[activeTab] ?? DISCOVER_INITIAL_VISIBLE_COUNT;
  const paginatedTabSpots = useMemo(
    () => visibleTabSpots.slice(0, activeVisibleCount),
    [activeVisibleCount, visibleTabSpots]
  );
  const hasMoreSpots = paginatedTabSpots.length < visibleTabSpots.length;

  useEffect(() => {
    setVisibleCountsByTab(createInitialVisibleCounts());
  }, [searchQuery, selectedCategory]);

  const formatDistance = (distanceKm?: number) => {
    if (!locationFeaturesEnabled || !userLocation) return '';
    if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm)) return '';
    return `${distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm)} km away`;
  };

  const handleOpenPrivacySettings = () => {
    Keyboard.dismiss();
    router.push({
      pathname: '/(tabs)/profile',
      params: { settings: 'privacy', settingsNonce: String(Date.now()) },
    } as any);
  };

  const handleSpotPress = (spotId: string) => {
    Keyboard.dismiss();
    router.push({ pathname: '/spot/[id]', params: { id: spotId } } as any);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setVisibleCountsByTab(createInitialVisibleCounts());

    try {
      const refreshedData = await refreshSpots({
        source: 'discover',
        activeTab,
        selectedCategory,
        locationFeaturesEnabled,
        locationPermissionStatus: permissionStatus,
        isLocationAccessEnabled,
        location: userLocation
          ? {
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
            }
          : null,
      });

      if (!isMountedRef.current) return;

      const refreshedVisibleSpots = refreshedData.spots.filter((spot) => !isPrivateSpot(spot));
      setPopularOrderIds(
        sortSpotsByPopularity(refreshedVisibleSpots, refreshedData.comments).map((spot) => spot.id)
      );
      setHasInitializedPopularOrder(true);
    } catch (error) {
      if (!isMountedRef.current) return;

      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.error('[DiscoverRefresh] failed', {
          platform: Platform.OS,
          firebaseCode: getFirebaseErrorCode(error) || 'unknown',
          message: getErrorMessage(error),
          query: 'spots where isRemoved == false',
          activeTab,
          selectedCategory,
          locationFeaturesEnabled,
          locationPermissionStatus: permissionStatus,
          isLocationAccessEnabled,
          location: userLocation
            ? {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
              }
            : null,
        });
      }
      Alert.alert('Refresh Failed', getRefreshFailureMessage(error));
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  };

  const handleShowMore = () => {
    setVisibleCountsByTab((prev) => ({
      ...prev,
      [activeTab]: prev[activeTab] + DISCOVER_LOAD_MORE_COUNT,
    }));
  };

  const handleFavoritePress = (spot: PhotoSpot) => {
    Keyboard.dismiss();
    toggleFavorite(spot.id);
  };

  const renderSpotCard = ({ item }: { item: PhotoSpot | NearbySpot }) => (
    <TouchableOpacity
      style={[styles.spotCard, isDark && styles.spotCardDark, isSpotzTheme && styles.spotCardSpotz]}
      onPress={() => handleSpotPress(item.id)}
    >
      <View style={styles.spotImageContainer}>
        <Image
          source={getSpotCoverImageSource(item, 'card')}
          style={styles.spotImage}
          resizeMode="cover"
        />
        <FavoriteHeartButton
          isFavorite={favorites.includes(item.id)}
          onPress={() => handleFavoritePress(item)}
          size={34}
          style={styles.cardFavoriteButton}
        />
      </View>
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
        <Text style={[styles.spotTime, isDark && styles.textMuted]}>
          {activeTab === 'nearby' ? formatDistance((item as NearbySpot).distanceKm) : item.bestTimeToShoot}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderListFooter = () => {
    if (visibleTabSpots.length === 0 || !hasMoreSpots) {
      return null;
    }

    return (
      <View style={styles.loadMoreContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.loadMoreButton,
            isDark && styles.loadMoreButtonDark,
            isSpotzTheme && styles.loadMoreButtonSpotz,
            pressed && styles.loadMoreButtonPressed,
          ]}
          onPress={handleShowMore}
          accessibilityRole="button"
          accessibilityLabel="Show more spots"
        >
          <Text style={[styles.loadMoreButtonText, isDark && styles.loadMoreButtonTextDark, isSpotzTheme && styles.loadMoreButtonTextSpotz]}>
            Show More
          </Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark, isSpotzTheme && styles.containerSpotz]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, isDark && styles.textLight]}>Discover</Text>
          <Text style={[styles.headerSubtitle, isDark && styles.textMuted]}>
            Find your next photo location
          </Text>
        </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, isDark && styles.searchContainerDark, isSpotzTheme && styles.searchContainerSpotz]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.searchInput, isDark && styles.textLight]}
          placeholder="Search spots..."
          placeholderTextColor={isDark ? '#666' : '#999'}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
          blurOnSubmit
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              Keyboard.dismiss();
              setSearchQuery('');
            }}
          >
            <Text style={styles.clearButton}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, isSpotzTheme && styles.tabsSpotz]}>
        {DISCOVER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => {
              Keyboard.dismiss();
              setActiveTab(tab);
            }}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.tabTextActive,
                isDark && styles.textLight,
              ]}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Category Filter */}
      <View style={styles.categoryFilter}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[ALL_CATEGORY_FILTER, ...CATEGORIES]}
          keyExtractor={(item) => item.value}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={Keyboard.dismiss}
          renderItem={({ item }) => (
            <CategoryChip
              item={item}
              isSelected={selectedCategory === item.value}
              isDark={isDark}
              isSpotzTheme={isSpotzTheme}
              onPress={() => {
                Keyboard.dismiss();
                setSelectedCategory(item.value);
              }}
            />
          )}
        />
      </View>

      {/* Spots Grid */}
      <FlatList
        style={styles.spotsList}
        data={paginatedTabSpots}
        renderItem={renderSpotCard}
        keyExtractor={(item) => item.id}
        extraData={[favorites, activeTab, activeVisibleCount, locationFeaturesEnabled, userLocation, selectedCategory, popularOrderIds.join('|')]}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={[styles.gridContent, { paddingBottom: listBottomPadding }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={DISCOVER_INITIAL_VISIBLE_COUNT}
        maxToRenderPerBatch={DISCOVER_LOAD_MORE_COUNT}
        windowSize={5}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={Keyboard.dismiss}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={SPOTZ_BRAND.accent}
            colors={[SPOTZ_BRAND.accent]}
          />
        }
        ListEmptyComponent={
          activeTab === 'nearby' && !locationFeaturesEnabled ? (
            <View style={styles.nearbyDisabledContainer}>
              <View style={[styles.nearbyDisabledIcon, isDark && styles.nearbyDisabledIconDark]}>
                <Ionicons name="location-outline" size={23} color={SPOTZ_BRAND.accent} />
              </View>
              <Text style={[styles.nearbyDisabledTitle, isDark && styles.textLight]}>
                Location is off
              </Text>
              <Text style={[styles.nearbyDisabledDescription, isDark && styles.textMuted]}>
                Enable location in Privacy Settings to sort nearby spots by distance.
              </Text>
              <TouchableOpacity
                style={[styles.privacySettingsButton, isDark && styles.privacySettingsButtonDark]}
                onPress={handleOpenPrivacySettings}
                activeOpacity={0.78}
              >
                <Text style={styles.privacySettingsButtonText}>Open Privacy Settings</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, isDark && styles.textMuted]}>
                {activeTab === 'favorites'
                  ? 'No favorite spots yet'
                  : activeTab === 'nearby'
                    ? 'No nearby spots found'
                    : 'No spots found'}
              </Text>
            </View>
          )
        }
        ListFooterComponent={renderListFooter}
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
  containerSpotz: {
    backgroundColor: SPOTZ_THEME.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000000',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  textLight: {
    color: '#ffffff',
  },
  textMuted: {
    color: '#888888',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    marginHorizontal: 20,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchContainerDark: {
    backgroundColor: '#2a2a2a',
  },
  searchContainerSpotz: {
    backgroundColor: SPOTZ_THEME.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SPOTZ_THEME.border,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000000',
  },
  clearButton: {
    fontSize: 20,
    color: '#666',
    padding: 4,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  tabsSpotz: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SPOTZ_THEME.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: SPOTZ_BRAND.accent,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  tabTextActive: {
    color: SPOTZ_BRAND.accent,
    fontWeight: '600',
  },
  categoryFilter: {
    marginBottom: 16,
    paddingLeft: 20,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  categoryChipDark: {
    backgroundColor: '#2a2a2a',
  },
  categoryChipSelected: {
    backgroundColor: SPOTZ_BRAND.accent,
  },
  categoryChipIcon: {
    marginRight: 4,
  },
  categoryChipLabel: {
    fontSize: 12,
    color: '#000000',
  },
  categoryChipLabelSelected: {
    color: '#ffffff',
  },
  gridContent: {
    paddingHorizontal: 8,
    rowGap: GRID_GAP,
  },
  spotsList: {
    flex: 1,
  },
  gridRow: {
    justifyContent: 'center',
    gap: GRID_GAP,
  },
  spotCard: {
    width: CARD_WIDTH,
    backgroundColor: '#fbfbfc',
    borderRadius: 16,
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
  spotCardSpotz: {
    backgroundColor: SPOTZ_THEME.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SPOTZ_THEME.border,
  },
  spotImageContainer: {
    width: '100%',
    height: 120,
  },
  spotImage: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  cardFavoriteButton: {
    top: 8,
    right: 8,
  },
  spotInfo: {
    padding: 12,
  },
  spotTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 6,
  },
  spotCategory: {
    flexShrink: 1,
    fontSize: 11,
    color: '#4f5560',
    opacity: 0.8,
  },
  spotCategoryIcon: {
    marginRight: 4,
  },
  spotCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 14,
  },
  spotTime: {
    fontSize: 10,
    color: '#4f5560',
    marginTop: 4,
    opacity: 0.72,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  loadMoreContainer: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 24,
  },
  loadMoreButton: {
    minHeight: 44,
    minWidth: 148,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    paddingHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.14)',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 3,
  },
  loadMoreButtonDark: {
    backgroundColor: 'rgba(38, 38, 42, 0.88)',
    borderColor: 'transparent',
    shadowColor: '#000000',
    shadowOpacity: 0.38,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 5,
  },
  loadMoreButtonSpotz: {
    backgroundColor: SPOTZ_THEME.accentSurface,
    borderColor: SPOTZ_THEME.borderStrong,
    shadowColor: SPOTZ_BRAND.accent,
    shadowOpacity: 0.24,
  },
  loadMoreButtonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.985 }],
  },
  loadMoreButtonText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '800',
  },
  loadMoreButtonTextDark: {
    color: '#f9fafb',
  },
  loadMoreButtonTextSpotz: {
    color: SPOTZ_THEME.text,
  },
  nearbyDisabledContainer: {
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 42,
  },
  nearbyDisabledIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139, 158, 139, 0.14)',
    marginBottom: 14,
  },
  nearbyDisabledIconDark: {
    backgroundColor: 'rgba(139, 158, 139, 0.16)',
  },
  nearbyDisabledTitle: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  nearbyDisabledDescription: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 280,
  },
  privacySettingsButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: SPOTZ_BRAND.accent,
    marginTop: 18,
    shadowColor: SPOTZ_BRAND.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 3,
  },
  privacySettingsButtonDark: {
    shadowOpacity: 0.28,
  },
  privacySettingsButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
