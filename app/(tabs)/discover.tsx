// filepath: app/(tabs)/discover.tsx

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSpots } from '../context/SpotContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { PhotoSpot, CATEGORIES } from '../types';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

export default function DiscoverScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { spots, getFavoriteSpots } = useSpots();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'popular' | 'recent' | 'favorites'>('popular');

  // Filter spots based on search and category
  const filteredSpots = spots.filter((spot) => {
    const matchesSearch = searchQuery
      ? spot.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        spot.description.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    const matchesCategory = selectedCategory ? spot.category === selectedCategory : true;
    return matchesSearch && matchesCategory;
  });

  // Sort spots based on active tab
  const sortedSpots = [...filteredSpots].sort((a, b) => {
    if (activeTab === 'recent') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    // For popular, keep original order (could be based on favorites/views in real app)
    return 0;
  });

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
        <Text style={[styles.spotTime, isDark && styles.textMuted]}>
          {item.bestTimeToShoot}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isDark && styles.textLight]}>Discover</Text>
        <Text style={[styles.headerSubtitle, isDark && styles.textMuted]}>
          Find your next photo location
        </Text>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, isDark && styles.searchContainerDark]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.searchInput, isDark && styles.textLight]}
          placeholder="Search spots..."
          placeholderTextColor={isDark ? '#666' : '#999'}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.clearButton}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['popular', 'recent', 'favorites'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
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
          data={[{ value: null, label: 'All', icon: '🌍' }, ...CATEGORIES]}
          keyExtractor={(item) => item.value || 'all'}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.categoryChip,
                selectedCategory === item.value && styles.categoryChipSelected,
                isDark && styles.categoryChipDark,
              ]}
              onPress={() => setSelectedCategory(item.value)}
            >
              <Text style={styles.categoryChipIcon}>{item.icon}</Text>
              <Text
                style={[
                  styles.categoryChipLabel,
                  selectedCategory === item.value && styles.categoryChipLabelSelected,
                  isDark && styles.textLight,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Spots Grid */}
      <FlatList
        data={activeTab === 'favorites' ? favoriteSpots : sortedSpots}
        renderItem={renderSpotCard}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, isDark && styles.textMuted]}>
              {activeTab === 'favorites'
                ? 'No favorite spots yet'
                : 'No spots found'}
            </Text>
          </View>
        }
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
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  tabTextActive: {
    color: '#007AFF',
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
  },
  categoryChipDark: {
    backgroundColor: '#2a2a2a',
  },
  categoryChipSelected: {
    backgroundColor: '#007AFF',
  },
  categoryChipIcon: {
    fontSize: 14,
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
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  spotCard: {
    width: CARD_WIDTH,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    margin: 8,
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
    height: 120,
  },
  spotInfo: {
    padding: 12,
  },
  spotTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  spotCategory: {
    fontSize: 11,
    color: '#666666',
  },
  spotTime: {
    fontSize: 10,
    color: '#666666',
    marginTop: 2,
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
  },
});