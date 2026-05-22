// filepath: app/(tabs)/index.tsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Platform,
  Alert,
  StatusBar,
  Animated,
} from 'react-native';
import type { ImageRequireSource, LayoutChangeEvent } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import MapView, { Marker, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPOTZ_BRAND, SPOTZ_THEME } from '../../src/constants/brand';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { useSpots } from '../../src/context/SpotContext';
import { useLocationPermission } from '../../src/context/LocationPermissionContext';
import { useAppColorScheme, useIsSpotzTheme } from '../../src/hooks/useAppColorScheme';
import {
  PhotoCategory,
  PhotoSpot,
  CATEGORIES,
  getCategoryLabel,
} from '../../src/types';
import { getSpotLocationLabel } from '../../src/utils/location';
import { getSpotCoverImageSource } from '../../src/utils/images';
import { openSpotInMaps } from '../../src/utils/maps';
import { getCategoryMarkerImage } from '../../src/utils/categoryMarkerImages';

const { width } = Dimensions.get('window');
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
const GLASS_TAB_BAR_HEIGHT = 72;
const GLASS_TAB_BAR_BOTTOM_OFFSET = 8;
const GLASS_TAB_BAR_SIDE_INSET = 20;
const CATEGORY_ROW_TAB_GAP = 14;
const PREVIEW_CARD_TOP_GAP = 16;
const PREVIEW_CARD_BUTTON_GAP = 12;
const PREVIEW_CARD_ESTIMATED_HEIGHT = 304;
const VIEWPORT_BUFFER_RATIO = 0.75;
const REGION_UPDATE_DEBOUNCE_MS = 200;
const IOS_REGION_UPDATE_DEBOUNCE_MS = 1000;
const IOS_MAX_RENDERED_MARKERS = 50;
const MIN_REGION_CHANGE_DELTA = 0.00001;
const FALLBACK_REGION: Region = {
  latitude: 44.4268,
  longitude: 26.1025,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};
const USER_LOCATION_DELTA = 0.04;
const MAP_CATEGORY_FILTERS = CATEGORIES;
const MAP_UNSELECTED_CATEGORY = 'all_unselected';
type IosMarkerRenderMode =
  | 'none'
  | 'static-one'
  | 'viewport-default-pin'
  | 'viewport-static-image';
// Flip this locally to isolate iOS MapKit crashes in the order above.
const IOS_MARKER_RENDER_MODE: IosMarkerRenderMode = 'viewport-static-image';

const normalizeLongitude = (longitude: number) => {
  const normalized = ((longitude + 180) % 360 + 360) % 360 - 180;
  return normalized === -180 ? 180 : normalized;
};

const isLongitudeInsideBounds = (longitude: number, minLongitude: number, maxLongitude: number) => {
  const normalizedLongitude = normalizeLongitude(longitude);
  const normalizedMin = normalizeLongitude(minLongitude);
  const normalizedMax = normalizeLongitude(maxLongitude);

  if (normalizedMin <= normalizedMax) {
    return normalizedLongitude >= normalizedMin && normalizedLongitude <= normalizedMax;
  }

  return normalizedLongitude >= normalizedMin || normalizedLongitude <= normalizedMax;
};

const isSpotInsideBufferedRegion = (spot: PhotoSpot, region: Region) => {
  const latitudeSpan = Math.min(180, region.latitudeDelta * (1 + VIEWPORT_BUFFER_RATIO * 2));
  const longitudeSpan = Math.min(360, region.longitudeDelta * (1 + VIEWPORT_BUFFER_RATIO * 2));
  const minLatitude = Math.max(-90, region.latitude - latitudeSpan / 2);
  const maxLatitude = Math.min(90, region.latitude + latitudeSpan / 2);

  if (spot.latitude < minLatitude || spot.latitude > maxLatitude) {
    return false;
  }

  if (longitudeSpan >= 360) {
    return true;
  }

  return isLongitudeInsideBounds(
    spot.longitude,
    region.longitude - longitudeSpan / 2,
    region.longitude + longitudeSpan / 2
  );
};

type MapSpotMarkerData = {
  id: string;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  image?: ImageRequireSource;
  spot: PhotoSpot;
};

type MapCategorySelection = PhotoCategory | typeof MAP_UNSELECTED_CATEGORY;

function isValidMapCoordinate(spot: PhotoSpot) {
  return (
    Number.isFinite(spot.latitude) &&
    Number.isFinite(spot.longitude) &&
    spot.latitude >= -90 &&
    spot.latitude <= 90 &&
    spot.longitude >= -180 &&
    spot.longitude <= 180
  );
}

function isValidMapMarkerSpot(spot: PhotoSpot) {
  return typeof spot.id === 'string' && spot.id.trim().length > 0 && isValidMapCoordinate(spot);
}

function isPrivateSpot(spot: PhotoSpot) {
  return spot.visibility === 'private' || spot.isPublic === false;
}

function isSpotOwner(spot: PhotoSpot, userId: string) {
  return (spot.creatorId || spot.createdBy) === userId;
}

function getUserLocationRegion(locationCoords: { latitude: number; longitude: number }): Region {
  return {
    latitude: locationCoords.latitude,
    longitude: locationCoords.longitude,
    latitudeDelta: USER_LOCATION_DELTA,
    longitudeDelta: USER_LOCATION_DELTA,
  };
}

function spotMatchesMapCategory(spot: PhotoSpot, selectedCategoryId: PhotoCategory) {
  return (
    (Array.isArray(spot.categoryIds) && spot.categoryIds.includes(selectedCategoryId)) ||
    spot.category === selectedCategoryId
  );
}

function getSpotRegionDistanceScore(spot: PhotoSpot, region: Region | null) {
  if (!region) return 0;

  return (
    Math.abs(spot.latitude - region.latitude) +
    Math.abs(normalizeLongitude(spot.longitude - region.longitude))
  );
}

function limitIosMarkerSpots(spots: PhotoSpot[], region: Region | null) {
  if (Platform.OS !== 'ios' || spots.length <= IOS_MAX_RENDERED_MARKERS) {
    return spots;
  }

  return [...spots]
    .sort(
      (a, b) =>
        getSpotRegionDistanceScore(a, region) - getSpotRegionDistanceScore(b, region)
    )
    .slice(0, IOS_MAX_RENDERED_MARKERS);
}

function getSpotMarkerData(
  spots: PhotoSpot[],
  isDark: boolean,
  useMarkerImages: boolean
): MapSpotMarkerData[] {
  return spots.map((spot) => ({
    id: spot.id,
    coordinate: {
      latitude: spot.latitude,
      longitude: spot.longitude,
    },
    image: useMarkerImages ? getCategoryMarkerImage(spot.category, isDark) : undefined,
    spot,
  }));
}

function isSameRegion(a: Region | null, b: Region) {
  return Boolean(
    a &&
    Math.abs(a.latitude - b.latitude) < MIN_REGION_CHANGE_DELTA &&
    Math.abs(a.longitude - b.longitude) < MIN_REGION_CHANGE_DELTA &&
    Math.abs(a.latitudeDelta - b.latitudeDelta) < MIN_REGION_CHANGE_DELTA &&
    Math.abs(a.longitudeDelta - b.longitudeDelta) < MIN_REGION_CHANGE_DELTA
  );
}

export default function MapScreen() {
  const router = useRouter();
  const colorScheme = useAppColorScheme();
  const isSpotzTheme = useIsSpotzTheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const regionUpdateTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMapMovingRef = useRef(false);
  const renderedMarkerSignatureRef = useRef('');
  const hasUserMovedMapRef = useRef(false);
  const hasAutoCenteredOnUserRef = useRef(false);
  const { spots, settings, user } = useSpots();
  const {
    coords,
    locationFeaturesEnabled,
    isLocationAccessEnabled,
    isLocationLoading,
    requestLocationPermission,
    refreshCurrentLocation,
  } = useLocationPermission();
  const [selectedSpot, setSelectedSpot] = useState<PhotoSpot | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<MapCategorySelection>(MAP_UNSELECTED_CATEGORY);
  const [isLoading, setIsLoading] = useState(true);
  const [initialRegion, setInitialRegion] = useState<Region | null>(null);
  const [settledRegion, setSettledRegion] = useState<Region | null>(null);
  const [isMapMoving, setIsMapMoving] = useState(false);
  const [renderedMarkers, setRenderedMarkers] = useState<MapSpotMarkerData[]>([]);
  const [previewCardHeight, setPreviewCardHeight] = useState(0);
  const categoryFilterBottom =
    insets.bottom + GLASS_TAB_BAR_BOTTOM_OFFSET + GLASS_TAB_BAR_HEIGHT + CATEGORY_ROW_TAB_GAP;
  const previewCardTop = insets.top + PREVIEW_CARD_TOP_GAP;
  const safeTopInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : insets.top
  );
  const myLocationButtonTop = safeTopInset + 22;
  const myLocationButtonRight = Math.max(insets.right, 0) + 20;
  const myLocationButtonAnimatedTop = useRef(new Animated.Value(myLocationButtonTop)).current;
  const myLocationButtonTargetTop = selectedSpot
    ? previewCardTop + (previewCardHeight || PREVIEW_CARD_ESTIMATED_HEIGHT) + PREVIEW_CARD_BUTTON_GAP
    : myLocationButtonTop;
  const visibleMapSpots = useMemo(
    () => spots.filter((spot) => !isPrivateSpot(spot) || isSpotOwner(spot, user.id)),
    [spots, user.id]
  );
  const invalidSpots = useMemo(
    () => visibleMapSpots.filter((spot) => !isValidMapMarkerSpot(spot)),
    [visibleMapSpots]
  );
  const validSpots = useMemo(
    () => visibleMapSpots.filter(isValidMapMarkerSpot),
    [visibleMapSpots]
  );
  const markerRegion = settledRegion ?? initialRegion;
  const viewportSpots = useMemo(
    () => {
      if (!markerRegion) {
        return validSpots;
      }

      return validSpots.filter((spot) => isSpotInsideBufferedRegion(spot, markerRegion));
    },
    [markerRegion, validSpots]
  );
  const filteredSpots = useMemo(
    () => selectedCategoryId !== MAP_UNSELECTED_CATEGORY
      ? viewportSpots.filter((spot) => spotMatchesMapCategory(spot, selectedCategoryId))
      : viewportSpots,
    [selectedCategoryId, viewportSpots]
  );
  const markerRenderMode =
    Platform.OS === 'ios' ? IOS_MARKER_RENDER_MODE : 'viewport-static-image';
  const markerImagesEnabled =
    Platform.OS !== 'ios' || markerRenderMode === 'viewport-static-image';
  const shouldUseSpotzCustomMarkers = isSpotzTheme && Platform.OS === 'ios';
  const markerSpots = useMemo(() => {
    if (markerRenderMode === 'none') {
      return [];
    }

    if (markerRenderMode === 'static-one') {
      return validSpots.slice(0, 1);
    }

    return limitIosMarkerSpots(filteredSpots, markerRegion);
  }, [filteredSpots, markerRegion, markerRenderMode, validSpots]);
  const nextMarkerSignature = useMemo(
    () =>
      markerSpots
        .map((spot) => `${spot.id}:${spot.latitude}:${spot.longitude}`)
        .join('|'),
    [markerSpots]
  );
  const beginMapMovement = useCallback(() => {
    if (!isMapMovingRef.current) {
      isMapMovingRef.current = true;
      setIsMapMoving(true);
    }

    if (regionUpdateTimeout.current) {
      clearTimeout(regionUpdateTimeout.current);
      regionUpdateTimeout.current = null;
    }
  }, []);

  const scheduleSettledRegionUpdate = useCallback((region: Region) => {
    if (regionUpdateTimeout.current) {
      clearTimeout(regionUpdateTimeout.current);
      regionUpdateTimeout.current = null;
    }

    if (!isMapMovingRef.current) {
      isMapMovingRef.current = true;
      setIsMapMoving(true);
    }

    const debounceMs =
      Platform.OS === 'ios' ? IOS_REGION_UPDATE_DEBOUNCE_MS : REGION_UPDATE_DEBOUNCE_MS;

    regionUpdateTimeout.current = setTimeout(() => {
      setSettledRegion((prev) => (isSameRegion(prev, region) ? prev : region));
      isMapMovingRef.current = false;
      setIsMapMoving(false);
      regionUpdateTimeout.current = null;
    }, debounceMs);
  }, []);

  useEffect(() => {
    Animated.spring(myLocationButtonAnimatedTop, {
      toValue: myLocationButtonTargetTop,
      damping: 18,
      stiffness: 180,
      mass: 0.9,
      useNativeDriver: false,
    }).start();
  }, [myLocationButtonAnimatedTop, myLocationButtonTargetTop]);

  useEffect(() => {
    if (initialRegion) return;

    const nextRegion = coords ? getUserLocationRegion(coords) : FALLBACK_REGION;

    if (coords) {
      hasAutoCenteredOnUserRef.current = true;
    }
    setInitialRegion(nextRegion);
    setSettledRegion(nextRegion);
    setIsLoading(false);
  }, [coords, initialRegion]);

  useEffect(() => {
    if (
      !coords ||
      !initialRegion ||
      hasAutoCenteredOnUserRef.current ||
      hasUserMovedMapRef.current
    ) {
      return;
    }

    const nextRegion = getUserLocationRegion(coords);

    hasAutoCenteredOnUserRef.current = true;
    beginMapMovement();
    mapRef.current?.animateToRegion(nextRegion, 500);
    scheduleSettledRegionUpdate(nextRegion);
  }, [beginMapMovement, coords, initialRegion, scheduleSettledRegionUpdate]);

  useEffect(() => () => {
    if (regionUpdateTimeout.current) {
      clearTimeout(regionUpdateTimeout.current);
    }
  }, []);

  useEffect(() => {
    if (invalidSpots.length === 0) return;

    console.warn('[MapMarkers] Ignoring invalid marker spots', invalidSpots.map((spot) => ({
      id: spot.id,
      latitude: spot.latitude,
      longitude: spot.longitude,
    })));
  }, [invalidSpots]);

  useEffect(() => {
    if (isMapMovingRef.current || isMapMoving) return;

    const signature = `${markerRenderMode}:${isDark}:${isSpotzTheme}:${shouldUseSpotzCustomMarkers}:${markerImagesEnabled}:${nextMarkerSignature}`;
    if (renderedMarkerSignatureRef.current === signature) return;

    renderedMarkerSignatureRef.current = signature;
    setRenderedMarkers(getSpotMarkerData(markerSpots, isDark, markerImagesEnabled && !shouldUseSpotzCustomMarkers));
  }, [
    isDark,
    isSpotzTheme,
    isMapMoving,
    markerImagesEnabled,
    markerRenderMode,
    markerSpots,
    nextMarkerSignature,
    shouldUseSpotzCustomMarkers,
  ]);

  const handleMarkerPress = useCallback((spot: PhotoSpot) => {
    setSelectedSpot(spot);
  }, []);

  const handleViewDetails = (spotId: string) => {
    router.push({ pathname: '/spot/[id]', params: { id: spotId } } as any);
  };

  const handleNavigate = async (spot: PhotoSpot) => {
    await openSpotInMaps(spot, settings.defaultMapApp);
  };

  const openPrivacySettings = useCallback(() => {
    router.push({
      pathname: '/(tabs)/profile',
      params: { settings: 'privacy', settingsNonce: String(Date.now()) },
    } as any);
  }, [router]);

  const animateToUserLocation = useCallback((locationCoords: NonNullable<typeof coords>) => {
    const nextRegion = getUserLocationRegion(locationCoords);

    hasAutoCenteredOnUserRef.current = true;
    setSelectedSpot(null);
    beginMapMovement();
    mapRef.current?.animateToRegion(nextRegion, 500);
    scheduleSettledRegionUpdate(nextRegion);
  }, [beginMapMovement, scheduleSettledRegionUpdate]);

  const handleMyLocationPress = useCallback(async () => {
    if (!isLocationAccessEnabled) {
      Alert.alert(
        'Location is off',
        'Enable Location Access in Privacy Settings to center the map on your current location.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Privacy Settings', onPress: openPrivacySettings },
        ]
      );
      return;
    }

    if (locationFeaturesEnabled && coords) {
      animateToUserLocation(coords);
      return;
    }

    const refreshedCoords = await refreshCurrentLocation();
    if (refreshedCoords) {
      animateToUserLocation(refreshedCoords);
      return;
    }

    const permissionGranted = await requestLocationPermission();
    if (permissionGranted) {
      const nextCoords = await refreshCurrentLocation();
      if (nextCoords) {
        animateToUserLocation(nextCoords);
        return;
      }
    }

    Alert.alert(
      'Location unavailable',
      'Location permission is disabled in system settings or unavailable right now.',
      [
        { text: 'OK', style: 'cancel' },
        { text: 'Privacy Settings', onPress: openPrivacySettings },
      ]
    );
  }, [
    animateToUserLocation,
    coords,
    isLocationAccessEnabled,
    locationFeaturesEnabled,
    openPrivacySettings,
    refreshCurrentLocation,
    requestLocationPermission,
  ]);

  const handlePanDrag = useCallback(() => {
    hasUserMovedMapRef.current = true;
    beginMapMovement();
  }, [beginMapMovement]);

  const handleRegionChangeComplete = useCallback((region: Region) => {
    scheduleSettledRegionUpdate(region);
  }, [scheduleSettledRegionUpdate]);

  const handleCategoryPress = useCallback((category: PhotoCategory) => {
    if (category === selectedCategoryId) {
      return;
    }

    setSelectedCategoryId(category);
    setSelectedSpot(null);
  }, [selectedCategoryId]);

  const handlePreviewCardLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height);
    setPreviewCardHeight((prev) => (Math.abs(prev - nextHeight) < 1 ? prev : nextHeight));
  }, []);

  return (
    <View style={[styles.container, isDark && styles.containerDark, isSpotzTheme && styles.containerSpotz]}>
      {isLoading || !initialRegion ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDark ? '#fff' : '#000'} />
          <Text style={[styles.loadingText, isDark && styles.textLight]}>
            Locating...
          </Text>
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          showsUserLocation={locationFeaturesEnabled}
          showsMyLocationButton={false}
          customMapStyle={isDark && Platform.OS === 'ios' ? darkMapStyle : []}
          onPanDrag={handlePanDrag}
          onRegionChangeComplete={handleRegionChangeComplete}
        >
          {renderedMarkers.map((marker) => (
            <Marker
              key={marker.id}
              coordinate={marker.coordinate}
              {...(marker.image ? { image: marker.image } : {})}
              identifier={marker.id}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              zIndex={1}
              onPress={() => handleMarkerPress(marker.spot)}
            >
              {shouldUseSpotzCustomMarkers && (
                <View style={styles.spotzMarkerOuter}>
                  <View style={styles.spotzMarkerRing}>
                    <View style={styles.spotzMarkerCore}>
                      <CategoryIcon category={marker.spot.category} size={18} />
                    </View>
                  </View>
                </View>
              )}
            </Marker>
          ))}
        </MapView>
      )}

      {!isLoading && initialRegion && (
        <AnimatedTouchableOpacity
          style={[
            styles.myLocationButton,
            isDark && styles.myLocationButtonDark,
            Platform.OS === 'android' && styles.myLocationButtonAndroid,
            (!isLocationAccessEnabled || isLocationLoading) && styles.myLocationButtonMuted,
            {
              top: myLocationButtonAnimatedTop,
              right: myLocationButtonRight,
            },
          ]}
          onPress={handleMyLocationPress}
          activeOpacity={0.78}
          disabled={isLocationLoading}
          accessibilityRole="button"
          accessibilityLabel="Center map on my location"
        >
          {isLocationLoading ? (
            <ActivityIndicator size="small" color={isDark ? '#ffffff' : '#111827'} />
          ) : (
            <Ionicons
              name="locate-outline"
              size={22}
              color={isDark ? '#f8fafc' : '#0f172a'}
            />
          )}
        </AnimatedTouchableOpacity>
      )}

      {/* Selected Spot Preview Card */}
      {selectedSpot && (
        <View
          style={[styles.previewCard, { top: previewCardTop }, isDark && styles.previewCardDark, isSpotzTheme && styles.previewCardSpotz]}
          onLayout={handlePreviewCardLayout}
        >
          <Image
            source={getSpotCoverImageSource(selectedSpot, 'card')}
            style={styles.previewImage}
            resizeMode="cover"
          />
          <View style={styles.previewContent}>
            <Text style={[styles.previewTitle, isDark && styles.textLight]} numberOfLines={1}>
              {selectedSpot.title}
            </Text>
            {isSpotOwner(selectedSpot, user.id) && isPrivateSpot(selectedSpot) && (
              <View style={[styles.privateBadge, isDark && styles.privateBadgeDark]}>
                <Ionicons name="lock-closed-outline" size={12} color={SPOTZ_BRAND.accent} />
                <Text style={styles.privateBadgeText}>Private</Text>
              </View>
            )}
            <View style={styles.previewMeta}>
              <View style={styles.previewCategoryRow}>
                <CategoryIcon category={selectedSpot.category} size={13} style={styles.previewCategoryIcon} />
                <Text style={[styles.previewCategory, isDark && styles.textMuted]} numberOfLines={1}>
                  {getCategoryLabel(selectedSpot.category)}
                </Text>
              </View>
              <Text style={[styles.previewTime, isDark && styles.textMuted]}>
                {selectedSpot.bestTimeToShoot}
              </Text>
            </View>
            <Text style={[styles.previewLocation, isDark && styles.textMuted]} numberOfLines={1}>
              📍 {getSpotLocationLabel(selectedSpot)}
            </Text>
            <View style={styles.previewButtons}>
              <TouchableOpacity
                style={[styles.previewButton, styles.primaryButton]}
                onPress={() => handleViewDetails(selectedSpot.id)}
              >
                <Text style={[styles.primaryButtonText, isSpotzTheme && styles.primaryButtonTextSpotz]}>View Details</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.previewButton, styles.secondaryButton, isDark && styles.secondaryButtonDark, isSpotzTheme && styles.secondaryButtonSpotz]}
                onPress={() => handleNavigate(selectedSpot)}
              >
                <Text style={[styles.secondaryButtonText, isDark && styles.textLight]}>
                  Navigate
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setSelectedSpot(null)}
          >
            <Ionicons name="close" size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Category Quick Filter */}
      <View style={[styles.categoryFilter, { bottom: categoryFilterBottom }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scrollView}
          contentContainerStyle={styles.categoryScrollContent}
        >
          {MAP_CATEGORY_FILTERS.map((item) => {
            const isSelected = selectedCategoryId === item.value;

            return (
              <TouchableOpacity
              key={item.value}
                style={[
                  styles.categoryChip,
                  isDark && styles.categoryChipDark,
                  isSpotzTheme && styles.categoryChipSpotz,
                  isSelected && styles.categoryChipSelected,
                  isSpotzTheme && isSelected && styles.categoryChipSelectedSpotz,
                ]}
                onPress={() => handleCategoryPress(item.value)}
              >
                <View style={styles.categoryChipIconBox}>
                  <CategoryIcon category={item.value} size={18} />
                </View>
                <Text
                  style={[
                    styles.categoryChipLabel,
                    isDark && styles.textLight,
                    isSpotzTheme && styles.categoryChipLabelSpotz,
                    isSelected && (isSpotzTheme ? styles.categoryChipLabelSelectedSpotz : styles.categoryChipLabelSelected),
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
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
  map: {
    width: width,
    height: '100%',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  textLight: {
    color: '#ffffff',
  },
  textMuted: {
    color: '#888888',
  },
  spotzMarkerOuter: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotzMarkerRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 23, 15, 0.84)',
    borderWidth: 3,
    borderColor: SPOTZ_BRAND.accent,
    shadowColor: SPOTZ_BRAND.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.34,
    shadowRadius: 8,
    elevation: 5,
  },
  spotzMarkerCore: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SPOTZ_THEME.panelElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SPOTZ_THEME.borderStrong,
  },
  myLocationButton: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.16)',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
    zIndex: 12,
  },
  myLocationButtonDark: {
    backgroundColor: 'rgba(17, 24, 39, 0.38)',
    borderColor: 'rgba(255, 255, 255, 0.18)',
    shadowColor: '#000000',
    shadowOpacity: 0.22,
  },
  myLocationButtonAndroid: {
    elevation: 0,
    shadowOpacity: 0,
  },
  myLocationButtonMuted: {
    opacity: 0.82,
  },
  previewCard: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  previewCardDark: {
    backgroundColor: '#2a2a2a',
  },
  previewCardSpotz: {
    backgroundColor: SPOTZ_THEME.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SPOTZ_THEME.border,
  },
  previewImage: {
    width: '100%',
    height: 150,
  },
  previewContent: {
    padding: 16,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  privateBadge: {
    alignSelf: 'flex-start',
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 158, 139, 0.14)',
    paddingHorizontal: 9,
    marginLeft: 0,
    marginTop: 8,
  },
  privateBadgeDark: {
    backgroundColor: 'rgba(139, 158, 139, 0.18)',
  },
  privateBadgeText: {
    color: SPOTZ_BRAND.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  previewMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  previewCategoryRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
  },
  previewCategoryIcon: {
    marginRight: 5,
  },
  previewCategory: {
    flexShrink: 1,
    fontSize: 12,
    color: '#666666',
  },
  previewTime: {
    fontSize: 12,
    color: '#666666',
  },
  previewLocation: {
    fontSize: 12,
    color: '#666666',
    marginTop: 8,
  },
  previewButtons: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  previewButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: SPOTZ_BRAND.accent,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  primaryButtonTextSpotz: {
    color: SPOTZ_THEME.accentText,
  },
  secondaryButton: {
    backgroundColor: '#f0f0f0',
  },
  secondaryButtonDark: {
    backgroundColor: '#444444',
  },
  secondaryButtonSpotz: {
    backgroundColor: SPOTZ_THEME.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SPOTZ_THEME.border,
  },
  secondaryButtonText: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 14,
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
  },
  categoryFilter: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  scrollView: {
    flexGrow: 0,
  },
  categoryScrollContent: {
    paddingHorizontal: GLASS_TAB_BAR_SIDE_INSET,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryChipDark: {
    backgroundColor: '#333333',
  },
  categoryChipSpotz: {
    backgroundColor: SPOTZ_THEME.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SPOTZ_THEME.border,
  },
  categoryChipSelected: {
    backgroundColor: SPOTZ_BRAND.accent,
    shadowColor: SPOTZ_BRAND.accent,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  categoryChipSelectedSpotz: {
    borderColor: SPOTZ_BRAND.accent,
    shadowOpacity: 0.38,
  },
  categoryChipIconBox: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  categoryChipLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: '#000000',
  },
  categoryChipLabelSpotz: {
    color: SPOTZ_THEME.text,
  },
  categoryChipLabelSelected: {
    color: '#ffffff',
  },
  categoryChipLabelSelectedSpotz: {
    color: SPOTZ_THEME.accentText,
  },
});

const darkMapStyle = [
  {
    elementType: 'geometry',
    stylers: [{ color: '#242f3e' }],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#242f3e' }],
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#746855' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#38414e' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#212a37' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#17263c' }],
  },
];
