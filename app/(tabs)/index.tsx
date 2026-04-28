// filepath: app/(tabs)/index.tsx

import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  TouchableOpacity,
  Image,
  Platform,
  ActivityIndicator,
  Linking,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import MapView, { Marker, Region } from 'react-native-maps';
import { useSpots } from '../context/SpotContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { PhotoSpot, CATEGORIES } from '../types';

const { width } = Dimensions.get('window');

export default function MapScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const mapRef = useRef<MapView>(null);
  const { spots } = useSpots();
  const [selectedSpot, setSelectedSpot] = useState<PhotoSpot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const initialRegion: Region = {
    latitude: 39.8283,
    longitude: -98.5795,
    latitudeDelta: 40,
    longitudeDelta: 40,
  };

  useEffect(() => {
    setTimeout(() => setIsLoading(false), 1000);
  }, []);

  const getCategoryLabel = (category: string) => {
    const cat = CATEGORIES.find((c) => c.value === category);
    return cat?.label || category;
  };

  const handleMarkerPress = (spot: PhotoSpot) => {
    setSelectedSpot(spot);
  };

  const handleViewDetails = (spotId: string) => {
    router.push({ pathname: '/spot/[id]', params: { id: spotId } } as any);
  };

  const handleNavigate = (spot: PhotoSpot) => {
    const { latitude, longitude, title } = spot;
    const url = Platform.select({
      ios: `maps:?daddr=${latitude},${longitude}&q=${encodeURIComponent(title)}`,
      android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodeURIComponent(title)})`,
    });
    if (url) {
      Linking.openURL(url);
    }
  };

  const focusOnSpot = (spot: PhotoSpot) => {
    mapRef.current?.animateToRegion(
      {
        latitude: spot.latitude,
        longitude: spot.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
      500
    );
    setSelectedSpot(spot);
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDark ? '#fff' : '#000'} />
          <Text style={[styles.loadingText, isDark && styles.textLight]}>
            Loading SPOTZ...
          </Text>
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          showsUserLocation
          showsMyLocationButton
          customMapStyle={isDark ? darkMapStyle : []}
        >
          {spots.map((spot) => (
            <Marker
              key={spot.id}
              coordinate={{
                latitude: spot.latitude,
                longitude: spot.longitude,
              }}
              onPress={() => handleMarkerPress(spot)}
            >
              <View style={styles.markerContainer}>
                <View style={[styles.marker, isDark && styles.markerDark]}>
                  <Text style={styles.markerIcon}>
                    {CATEGORIES.find((c) => c.value === spot.category)?.icon || '📍'}
                  </Text>
                </View>
              </View>
            </Marker>
          ))}
        </MapView>
      )}

      {/* Header */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Text style={[styles.headerTitle, isDark && styles.textLight]}>SPOTZ</Text>
        <Text style={[styles.headerSubtitle, isDark && styles.textMuted]}>
          Discover amazing photo locations
        </Text>
      </View>

      {/* Selected Spot Preview Card */}
      {selectedSpot && (
        <View style={[styles.previewCard, isDark && styles.previewCardDark]}>
          <Image
            source={{ uri: selectedSpot.images[0] }}
            style={styles.previewImage}
            resizeMode="cover"
          />
          <View style={styles.previewContent}>
            <Text style={[styles.previewTitle, isDark && styles.textLight]} numberOfLines={1}>
              {selectedSpot.title}
            </Text>
            <View style={styles.previewMeta}>
              <Text style={[styles.previewCategory, isDark && styles.textMuted]}>
                {getCategoryLabel(selectedSpot.category)}
              </Text>
              <Text style={[styles.previewTime, isDark && styles.textMuted]}>
                {selectedSpot.bestTimeToShoot}
              </Text>
            </View>
            <View style={styles.previewButtons}>
              <TouchableOpacity
                style={[styles.previewButton, styles.primaryButton]}
                onPress={() => handleViewDetails(selectedSpot.id)}
              >
                <Text style={styles.primaryButtonText}>View Details</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.previewButton, styles.secondaryButton, isDark && styles.secondaryButtonDark]}
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
            <Text style={[styles.closeButtonText, isDark && styles.textLight]}>×</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Category Quick Filter */}
      <View style={styles.categoryFilter}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollView}>
          {CATEGORIES.map((item) => (
            <TouchableOpacity
              key={item.value}
              style={[styles.categoryChip, isDark && styles.categoryChipDark]}
              onPress={() => {
                const categorySpots = spots.filter((s) => s.category === item.value);
                if (categorySpots.length > 0) {
                  focusOnSpot(categorySpots[0]);
                }
              }}
            >
              <Text style={styles.categoryChipIcon}>{item.icon}</Text>
              <Text style={[styles.categoryChipLabel, isDark && styles.textLight]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
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
    backgroundColor: '#1a1a1a',
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
  header: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerDark: {
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 2,
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
  markerContainer: {
    alignItems: 'center',
  },
  marker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  markerDark: {
    backgroundColor: '#333333',
  },
  markerIcon: {
    fontSize: 20,
  },
  previewCard: {
    position: 'absolute',
    bottom: 100,
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
  previewMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  previewCategory: {
    fontSize: 12,
    color: '#666666',
  },
  previewTime: {
    fontSize: 12,
    color: '#666666',
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
    backgroundColor: '#007AFF',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  secondaryButton: {
    backgroundColor: '#f0f0f0',
  },
  secondaryButtonDark: {
    backgroundColor: '#444444',
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
  },
  closeButtonText: {
    fontSize: 20,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  categoryFilter: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
  },
  scrollView: {
    paddingHorizontal: 20,
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
  categoryChipIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  categoryChipLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#000000',
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
