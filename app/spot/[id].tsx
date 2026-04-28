// filepath: app/spot/[id].tsx

import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  FlatList,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSpots } from '../context/SpotContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { CATEGORIES } from '../types';

const { width } = Dimensions.get('window');

export default function SpotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { getSpotById, toggleFavorite, favorites } = useSpots();
  
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const spot = getSpotById(id || '');
  const isFavorite = id ? favorites.includes(id) : false;

  if (!spot) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, isDark && styles.textLight]}>
            Spot not found
          </Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const getCategoryLabel = (category: string) => {
    const cat = CATEGORIES.find((c) => c.value === category);
    return cat?.label || category;
  };

  const handleToggleFavorite = () => {
    if (id) {
      toggleFavorite(id);
    }
  };

  const handleOpenInMaps = () => {
    const { latitude, longitude, title } = spot;
    const label = encodeURIComponent(title);
    
    if (Platform.OS === 'ios') {
      Linking.openURL(`maps:?daddr=${latitude},${longitude}&q=${label}`);
    } else {
      Linking.openURL(`geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`);
    }
  };

  const handleShare = () => {
    Alert.alert('Share', `Check out this photo spot: ${spot.title}`);
  };

  const renderImage = ({ item, index }: { item: string; index: number }) => (
    <Image
      source={{ uri: item }}
      style={styles.galleryImage}
      resizeMode="cover"
    />
  );

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image Gallery */}
        <View style={styles.galleryContainer}>
          <FlatList
            ref={flatListRef}
            data={spot.images}
            renderItem={renderImage}
            keyExtractor={(item, index) => `${spot.id}-${index}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(event) => {
              const index = Math.round(
                event.nativeEvent.contentOffset.x / width
              );
              setCurrentImageIndex(index);
            }}
            scrollEventThrottle={16}
          />
          
          {/* Image Counter */}
          <View style={styles.imageCounter}>
            <Text style={styles.imageCounterText}>
              {currentImageIndex + 1} / {spot.images.length}
            </Text>
          </View>

          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButtonOverlay}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonOverlayText}>←</Text>
          </TouchableOpacity>

          {/* Favorite Button */}
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={handleToggleFavorite}
          >
            <Text style={styles.favoriteButtonText}>
              {isFavorite ? '❤️' : '🤍'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Dot Indicators */}
        <View style={styles.dotContainer}>
          {spot.images.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                currentImageIndex === index && styles.dotActive,
                isDark && styles.dotDark,
              ]}
            />
          ))}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Title and Category */}
          <View style={styles.titleSection}>
            <Text style={[styles.title, isDark && styles.textLight]}>{spot.title}</Text>
            <View style={[styles.categoryBadge, isDark && styles.categoryBadgeDark]}>
              <Text style={styles.categoryIcon}>
                {CATEGORIES.find((c) => c.value === spot.category)?.icon || '📍'}
              </Text>
              <Text style={[styles.categoryText, isDark && styles.textLight]}>
                {getCategoryLabel(spot.category)}
              </Text>
            </View>
          </View>

          {/* Best Time to Shoot */}
          <View style={[styles.infoCard, isDark && styles.infoCardDark]}>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>⏰</Text>
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, isDark && styles.textMuted]}>
                  Best Time to Shoot
                </Text>
                <Text style={[styles.infoValue, isDark && styles.textLight]}>
                  {spot.bestTimeToShoot}
                </Text>
              </View>
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && styles.textLight]}>
              About This Spot
            </Text>
            <Text style={[styles.description, isDark && styles.textMuted]}>
              {spot.description}
            </Text>
          </View>

          {/* Location Info */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && styles.textLight]}>
              Location
            </Text>
            <View style={[styles.locationCard, isDark && styles.locationCardDark]}>
              <Text style={[styles.coordinates, isDark && styles.textMuted]}>
                📍 {spot.latitude.toFixed(4)}, {spot.longitude.toFixed(4)}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryAction]}
              onPress={handleOpenInMaps}
            >
              <Text style={styles.actionButtonIcon}>🗺️</Text>
              <Text style={styles.actionButtonText}>Open in Maps</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, isDark && styles.actionButtonDark]}
              onPress={handleShare}
            >
              <Text style={styles.actionButtonIcon}>📤</Text>
              <Text style={[styles.actionButtonText, isDark && styles.textLight]}>
                Share
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomPadding} />
        </View>
      </ScrollView>
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
  textLight: {
    color: '#ffffff',
  },
  textMuted: {
    color: '#888888',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#000000',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  galleryContainer: {
    position: 'relative',
  },
  galleryImage: {
    width: width,
    height: Math.round(width * 9 / 16),
  },
  imageCounter: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  imageCounterText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  backButtonOverlay: {
    position: 'absolute',
    top: 50,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonOverlayText: {
    color: '#ffffff',
    fontSize: 20,
  },
  favoriteButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteButtonText: {
    fontSize: 20,
  },
  dotContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ccc',
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: '#007AFF',
    width: 24,
  },
  dotDark: {
    backgroundColor: '#555',
  },
  content: {
    paddingHorizontal: 20,
  },
  titleSection: {
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 12,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  categoryBadgeDark: {
    backgroundColor: '#333',
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#000000',
  },
  infoCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  infoCardDark: {
    backgroundColor: '#2a2a2a',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: '#666666',
  },
  locationCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
  },
  locationCardDark: {
    backgroundColor: '#2a2a2a',
  },
  coordinates: {
    fontSize: 14,
    color: '#666666',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionButtonDark: {
    backgroundColor: '#333',
  },
  primaryAction: {
    backgroundColor: '#007AFF',
  },
  actionButtonIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  bottomPadding: {
    height: 40,
  },
});