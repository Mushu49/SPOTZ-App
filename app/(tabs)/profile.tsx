// filepath: app/(tabs)/profile.tsx

import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSpots } from '../context/SpotContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { PhotoSpot, CATEGORIES } from '../types';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

export default function ProfileScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, spots, getFavoriteSpots } = useSpots();

  const uploadedSpots = spots.filter((spot) => user.uploadedSpots.includes(spot.id));
  const favoriteSpots = getFavoriteSpots();

  const handleSpotPress = (spotId: string) => {
    router.push({ pathname: '/spot/[id]', params: { id: spotId } } as any);
  };

  const getCategoryLabel = (category: string) => {
    const cat = CATEGORIES.find((c) => c.value === category);
    return cat?.label || category;
  };

  const renderSpotCard = ({ item }: { item: PhotoSpot }) => (
    <TouchableOpacity
      style={[styles.spotCard, isDark && styles.spotCardDark]}
      onPress={() => handleSpotPress(item.id)}
    >
      <Image
        source={{ uri: item.images[0] }}
        style={styles.spotImage}
        resizeMode="cover"
      />
      <View style={styles.spotInfo}>
        <Text style={[styles.spotTitle, isDark && styles.textLight]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[styles.spotCategory, isDark && styles.textMuted]}>
          {getCategoryLabel(item.category)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const StatItem = ({ value, label }: { value: number; label: string }) => (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, isDark && styles.textLight]}>{value}</Text>
      <Text style={[styles.statLabel, isDark && styles.textMuted]}>{label}</Text>
    </View>
  );

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isDark && styles.textLight]}>Profile</Text>
      </View>

      {/* Profile Card */}
      <View style={[styles.profileCard, isDark && styles.profileCardDark]}>
        <View style={[styles.avatarContainer, isDark && styles.avatarContainerDark]}>
          <Text style={styles.avatarText}>
            {user.username.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.username, isDark && styles.textLight]}>{user.username}</Text>
        <Text style={[styles.userBio, isDark && styles.textMuted]}>
          Photography enthusiast
        </Text>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <StatItem value={uploadedSpots.length} label="Spots" />
          <View style={styles.statDivider} />
          <StatItem value={favoriteSpots.length} label="Favorites" />
        </View>
      </View>

      {/* Sections */}
      <FlatList
        data={[
          { key: 'uploaded', title: 'My Uploaded Spots', data: uploadedSpots },
          { key: 'favorites', title: 'Saved Spots', data: favoriteSpots },
        ]}
        renderItem={({ item }) => (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDark && styles.textLight]}>
              {item.title}
            </Text>
            {item.data.length > 0 ? (
              <FlatList
                data={item.data}
                renderItem={renderSpotCard}
                keyExtractor={(spot) => spot.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
              />
            ) : (
              <View style={styles.emptySection}>
                <Text style={[styles.emptyText, isDark && styles.textMuted]}>
                  {item.key === 'uploaded'
                    ? "You haven't uploaded any spots yet"
                    : 'No saved spots yet'}
                </Text>
                {item.key === 'favorites' && (
                  <TouchableOpacity
                    style={styles.exploreButton}
                    onPress={() => router.push('/discover')}
                  >
                    <Text style={styles.exploreButtonText}>Explore Spots</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
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
    backgroundColor: '#1a1a1a',
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
  textLight: {
    color: '#ffffff',
  },
  textMuted: {
    color: '#888888',
  },
  profileCard: {
    marginHorizontal: 20,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  profileCardDark: {
    backgroundColor: '#2a2a2a',
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainerDark: {
    backgroundColor: '#444',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
  },
  username: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  userBio: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
  },
  statLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e5e5e5',
  },
  listContent: {
    paddingBottom: 100,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  horizontalList: {
    paddingRight: 20,
  },
  spotCard: {
    width: CARD_WIDTH,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  spotCardDark: {
    backgroundColor: '#2a2a2a',
  },
  spotImage: {
    width: '100%',
    height: 100,
  },
  spotInfo: {
    padding: 10,
  },
  spotTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  spotCategory: {
    fontSize: 11,
    color: '#666666',
  },
  emptySection: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  exploreButton: {
    marginTop: 12,
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  exploreButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});