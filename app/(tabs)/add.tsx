// filepath: app/(tabs)/add.tsx

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  FlatList,
  Keyboard,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import MapView, { Marker, Region } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import { useSpots } from '../context/SpotContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { CATEGORIES, BEST_TIMES, PhotoCategory } from '../types';

// Predefined popular locations for search
// OpenStreetMap Nominatim API for global geocoding
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const MAX_IMAGES = 5;

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
}

export default function AddSpotScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { addSpot } = useSpots();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PhotoCategory | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [location, setLocation] = useState({ latitude: 37.7749, longitude: -122.4194 });
  const [region, setRegion] = useState<Region>({
    latitude: 37.7749,
    longitude: -122.4194,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedPlaceName, setSelectedPlaceName] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showFullscreenMap, setShowFullscreenMap] = useState(false);
  const [tempLocation, setTempLocation] = useState({ latitude: 37.7749, longitude: -122.4194 });
  const [tempRegion, setTempRegion] = useState<Region>({
    latitude: 37.7749,
    longitude: -122.4194,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const [tempSearchQuery, setTempSearchQuery] = useState('');
  const [tempSearchResults, setTempSearchResults] = useState<SearchResult[]>([]);
  const [tempShowResults, setTempShowResults] = useState(false);
  const [tempSelectedPlaceName, setTempSelectedPlaceName] = useState('');

  // Debounce search to avoid too many API calls
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim().length >= 3) {
        searchLocations(searchQuery);
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Search locations using OpenStreetMap Nominatim API
  const searchLocations = async (query: string) => {
    setIsSearching(true);
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        limit: '10',
        addressdetails: '1',
        'accept-language': 'en',
      });

      const response = await fetch(`${NOMINATIM_SEARCH_URL}?${params}`, {
        headers: {
          'User-Agent': 'SPOTZApp/1.0',
        },
      });

      if (response.ok) {
        const data: SearchResult[] = await response.json();
        setSearchResults(data);
        setShowResults(true);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle selecting a location from search results
  const handleSelectLocation = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    
    setLocation({ latitude: lat, longitude: lon });
    setRegion({
      latitude: lat,
      longitude: lon,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    });
    
    // Extract a short name from display_name
    const nameParts = result.display_name.split(',');
    const shortName = nameParts[0].trim();
    setSelectedPlaceName(shortName);
    setSearchQuery(shortName);
    setShowResults(false);
  };

  // Search for temp location in fullscreen map
  const searchTempLocations = async (query: string) => {
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        limit: '10',
        addressdetails: '1',
        'accept-language': 'en',
      });

      const response = await fetch(`${NOMINATIM_SEARCH_URL}?${params}`, {
        headers: {
          'User-Agent': 'SPOTZApp/1.0',
        },
      });

      if (response.ok) {
        const data: SearchResult[] = await response.json();
        setTempSearchResults(data);
        setTempShowResults(true);
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  // Handle selecting a location in fullscreen map
  const handleTempSelectLocation = (result: SearchResult) => {
    Keyboard.dismiss();
    
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    
    setTempLocation({ latitude: lat, longitude: lon });
    setTempRegion({
      latitude: lat,
      longitude: lon,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    });
    
    const nameParts = result.display_name.split(',');
    const shortName = nameParts[0].trim();
    setTempSelectedPlaceName(shortName);
    setTempSearchQuery(shortName);
    setTempShowResults(false);
  };

  // Handle map press in fullscreen mode
  const handleTempMapPress = (event: any) => {
    Keyboard.dismiss();
    
    const { coordinate } = event.nativeEvent;
    setTempLocation(coordinate);
    setTempSelectedPlaceName('');
  };

  // Confirm location from fullscreen map
  const handleConfirmLocation = () => {
    Keyboard.dismiss();
    
    setLocation(tempLocation);
    setRegion(tempRegion);
    setSelectedPlaceName(tempSelectedPlaceName);
    setSearchQuery(tempSelectedPlaceName || `${tempLocation.latitude.toFixed(4)}, ${tempLocation.longitude.toFixed(4)}`);
    setShowFullscreenMap(false);
  };

  const isFormValid = title && selectedCategory && selectedTime;

  const handleSubmit = () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title for your spot');
      return;
    }
    if (!selectedCategory) {
      Alert.alert('Error', 'Please select a category');
      return;
    }
    if (!selectedTime) {
      Alert.alert('Error', 'Please select the best time to shoot');
      return;
    }

    addSpot({
      title: title.trim(),
      description: description.trim(),
      category: selectedCategory,
      bestTimeToShoot: selectedTime,
      images: images.length > 0 ? images : ['https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800'],
      latitude: location.latitude,
      longitude: location.longitude,
      isFavorite: false,
    });

    Alert.alert('Success', 'Your spot has been added!', [
      {
        text: 'OK',
        onPress: () => {
          // Reset form
          setTitle('');
          setDescription('');
          setSelectedCategory(null);
          setSelectedTime('');
          setImages([]);
          router.push('/');
        },
      },
    ]);
  };

  const handleMapPress = (event: any) => {
    const { coordinate } = event.nativeEvent;
    setLocation(coordinate);
  };

  const pickImage = async () => {
    // Calculate remaining slots
    const remainingSlots = MAX_IMAGES - images.length;
    
    if (remainingSlots <= 0) {
      Alert.alert('Limit Reached', 'You can upload maximum 5 images per spot.');
      return;
    }
    
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library to select images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      allowsEditing: false,
      quality: 1,
      selectionLimit: remainingSlots, // Limit to remaining slots
    });

    if (!result.canceled && result.assets.length > 0) {
      const newImages = result.assets.map((asset) => asset.uri);
      setImages((prev) => [...prev, ...newImages].slice(0, MAX_IMAGES));
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, isDark && styles.containerDark]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, isDark && styles.textLight]}>Add New Spot</Text>
          <Text style={[styles.headerSubtitle, isDark && styles.textMuted]}>
            Share your favorite photo location
          </Text>
        </View>

        {/* Title Input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, isDark && styles.textLight]}>Title *</Text>
          <TextInput
            style={[styles.input, isDark && styles.inputDark]}
            placeholder="Enter spot name"
            placeholderTextColor={isDark ? '#666' : '#999'}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Description Input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, isDark && styles.textLight]}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea, isDark && styles.inputDark]}
            placeholder="Describe this photo spot..."
            placeholderTextColor={isDark ? '#666' : '#999'}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Images Section */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <Text style={[styles.cardTitle, isDark && styles.textLight]}>Images</Text>
          <Text style={[styles.cardSubtitle, isDark && styles.textMuted]}>
            You can select up to {MAX_IMAGES} images ({images.length}/{MAX_IMAGES} selected)
          </Text>
          <TouchableOpacity
            style={[
              styles.imagePickerButton, 
              isDark && styles.imagePickerButtonDark,
              images.length >= MAX_IMAGES && styles.imagePickerButtonDisabled,
            ]}
            onPress={pickImage}
            disabled={images.length >= MAX_IMAGES}
          >
            <Text style={styles.imagePickerIcon}>📷</Text>
            <Text style={[
              styles.imagePickerText, 
              isDark && styles.textLight,
              images.length >= MAX_IMAGES && styles.imagePickerTextDisabled,
            ]}>
              {images.length >= MAX_IMAGES ? 'Maximum images selected' : 'Select Images from Gallery'}
            </Text>
          </TouchableOpacity>
          {images.length > 0 && (
            <View style={styles.imagePreviewContainer}>
              <FlatList
                data={images}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item, index) => `${item}-${index}`}
                renderItem={({ item, index }) => (
                  <View style={styles.imagePreviewWrapper}>
                    <Image 
                      source={{ uri: item }} 
                      style={styles.imagePreview} 
                    />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => removeImage(index)}
                    >
                      <Text style={styles.removeImageText}>×</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            </View>
          )}
        </View>

        {/* Category Section */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <Text style={[styles.cardTitle, isDark && styles.textLight]}>Category *</Text>
          <Text style={[styles.cardSubtitle, isDark && styles.textMuted]}>
            Choose the main category of your spot
          </Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.value}
                style={[
                  styles.categoryButton,
                  isDark && styles.categoryButtonDark,
                  selectedCategory === cat.value && (isDark ? styles.categoryButtonSelectedDark : styles.categoryButtonSelected),
                ]}
                onPress={() => setSelectedCategory(cat.value)}
              >
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                <Text
                  style={[
                    styles.categoryLabel,
                    selectedCategory === cat.value && styles.categoryLabelSelected,
                    isDark && selectedCategory !== cat.value && styles.textLight,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Best Time to Shoot Section */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <Text style={[styles.cardTitle, isDark && styles.textLight]}>Best Time to Shoot *</Text>
          <Text style={[styles.cardSubtitle, isDark && styles.textMuted]}>
            Select the best time for great shots at this location
          </Text>
          <View style={styles.timeGrid}>
            {BEST_TIMES.map((time) => (
              <TouchableOpacity
                key={time}
                style={[
                  styles.timeButton,
                  isDark && styles.timeButtonDark,
                  selectedTime === time && (isDark ? styles.timeButtonSelectedDark : styles.timeButtonSelected),
                ]}
                onPress={() => setSelectedTime(time)}
              >
                <Text
                  style={[styles.timeLabel, selectedTime === time && styles.timeLabelSelected, isDark && selectedTime !== time && styles.textLight]}
                >
                  {time}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Location Section */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <Text style={[styles.cardTitle, isDark && styles.textLight]}>Location *</Text>
          <Text style={[styles.cardSubtitle, isDark && styles.textMuted]}>
            Set the exact location of your spot on the map
          </Text>
          
          {/* Search Bar */}
          <View style={[styles.searchContainer, isDark && styles.searchContainerDark]}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={[styles.searchInput, isDark && styles.searchInputDark]}
              placeholder="Search city, street, or landmark..."
              placeholderTextColor={isDark ? '#666' : '#999'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => searchQuery.trim().length > 0 && setShowResults(true)}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(''); setShowResults(false); }}>
                <Text style={styles.clearButton}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Search Results Dropdown */}
          {showResults && searchResults.length > 0 && (
            <View style={[styles.searchResults, isDark && styles.searchResultsDark]}>
              <FlatList
                data={searchResults}
                keyExtractor={(item) => `${item.place_id}`}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.searchResultItem, isDark && styles.searchResultItemDark]}
                    onPress={() => handleSelectLocation(item)}
                  >
                    <Text style={[styles.searchResultText, isDark && styles.textLight]} numberOfLines={2}>
                      {item.display_name}
                    </Text>
                  </TouchableOpacity>
                )}
                keyboardShouldPersistTaps="handled"
              />
            </View>
          )}

          {/* Selected Place Name */}
          {selectedPlaceName ? (
            <Text style={[styles.selectedPlaceText, isDark && styles.textLight]}>
              📍 {selectedPlaceName}
            </Text>
          ) : null}

          {/* Map */}
          <View style={[styles.mapContainer, isDark && styles.mapContainerDark]}>
            <MapView
              style={styles.map}
              region={region}
              onRegionChangeComplete={setRegion}
              onPress={handleMapPress}
              customMapStyle={isDark ? darkMapStyle : []}
            >
              <Marker coordinate={location} />
            </MapView>
            {/* Expand Button */}
            <TouchableOpacity
              style={[styles.expandButton, isDark && styles.expandButtonDark]}
              onPress={() => setShowFullscreenMap(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.expandButtonText}>⛶</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.coordinates, isDark && styles.textMuted]}>
            {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
          </Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, !isFormValid && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!isFormValid}
        >
          <Text style={styles.submitButtonText}>Add Spot</Text>
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Fullscreen Map Modal */}
      {showFullscreenMap && (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={[styles.fullscreenMapContainer, isDark && styles.fullscreenMapContainerDark]}>
            {/* Fullscreen Map - Behind all controls */}
            <MapView
              style={styles.fullscreenMap}
              region={tempRegion}
              onRegionChangeComplete={setTempRegion}
              onPress={handleTempMapPress}
              customMapStyle={isDark ? darkMapStyle : []}
            >
              <Marker coordinate={tempLocation} />
            </MapView>

          {/* Floating Top Bar Container */}
          <View style={styles.floatingTopBar}>
            {/* Floating Search Bar */}
            <View style={[styles.floatingSearchContainer, isDark && styles.floatingSearchContainerDark]}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={[styles.searchInput, isDark && styles.searchInputDark]}
                placeholder="Search city, street, or landmark..."
                placeholderTextColor={isDark ? '#666' : '#999'}
                value={tempSearchQuery}
                onChangeText={(text) => {
                  setTempSearchQuery(text);
                  if (text.trim().length >= 3) {
                    searchTempLocations(text);
                  } else {
                    setTempSearchResults([]);
                    setTempShowResults(false);
                  }
                }}
                onFocus={() => tempSearchQuery.trim().length > 0 && setTempShowResults(true)}
              />
              {tempSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setTempSearchQuery(''); setTempShowResults(false); }}>
                  <Text style={styles.clearButton}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Floating Close Button */}
            <TouchableOpacity
              style={[styles.floatingCloseButton, isDark && styles.floatingCloseButtonDark]}
              onPress={() => setShowFullscreenMap(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.floatingCloseButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search Results Dropdown */}
          {tempShowResults && tempSearchResults.length > 0 && (
            <View style={[styles.floatingSearchResults, isDark && styles.floatingSearchResultsDark]}>
              <FlatList
                data={tempSearchResults}
                keyExtractor={(item) => `${item.place_id}`}
                renderItem={({ item }) => {
                  const nameParts = item.display_name.split(',');
                  const primaryName = nameParts[0].trim();
                  const secondaryAddress = nameParts.slice(1, 3).join(', ').trim();
                  return (
                    <TouchableOpacity
                      style={[styles.floatingSearchResultItem, isDark && styles.floatingSearchResultItemDark]}
                      onPress={() => handleTempSelectLocation(item)}
                    >
                      <Text style={[styles.floatingSearchResultPrimary, isDark && styles.textLight]} numberOfLines={1}>
                        {primaryName}
                      </Text>
                      {secondaryAddress ? (
                        <Text style={[styles.floatingSearchResultSecondary, isDark && styles.textMuted]} numberOfLines={1}>
                          {secondaryAddress}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              />
            </View>
          )}

          {/* Selected Place Name */}
          {tempSelectedPlaceName ? (
            <Text style={[styles.selectedPlaceText, isDark && styles.textLight]}>
              📍 {tempSelectedPlaceName}
            </Text>
          ) : null}

          {/* Floating Confirm Button */}
          <TouchableOpacity
            style={styles.floatingConfirmButton}
            onPress={handleConfirmLocation}
            activeOpacity={0.8}
          >
            <Text style={styles.floatingConfirmButtonText}>Confirm Location</Text>
          </TouchableOpacity>
        </View>
        </TouchableWithoutFeedback>
      )}
    </KeyboardAvoidingView>
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
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    marginTop: 60,
    marginBottom: 24,
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
  // Card Styles
  card: {
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  cardDark: {
    backgroundColor: '#2a2a2a',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  labelHint: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000000',
  },
  inputDark: {
    backgroundColor: '#2a2a2a',
    color: '#ffffff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  categoryButton: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 12,
    width: '47%',
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  categoryButtonDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#3a3a3a',
  },
  categoryButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  categoryButtonSelectedDark: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  categoryIcon: {
    fontSize: 26,
    marginBottom: 8,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
  },
  categoryLabelSelected: {
    color: '#ffffff',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    width: '47%',
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  timeButtonDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#3a3a3a',
  },
  timeButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  timeButtonSelectedDark: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
  },
  timeLabelSelected: {
    color: '#ffffff',
  },
  mapContainer: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
  },
  mapContainerDark: {
    borderWidth: 1,
    borderColor: '#333',
  },
  map: {
    flex: 1,
  },
  coordinates: {
    fontSize: 12,
    color: '#666666',
    marginTop: 8,
    textAlign: 'center',
  },
  // Expand Button Styles
  expandButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  expandButtonDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  expandButtonText: {
    fontSize: 22,
    color: '#ffffff',
  },
  // Fullscreen Map Styles
  fullscreenMapContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    zIndex: 1000,
  },
  fullscreenMapContainerDark: {
    backgroundColor: '#1a1a1a',
  },
  fullscreenMap: {
    ...StyleSheet.absoluteFillObject,
  },
  // Floating Top Bar Container
  floatingTopBar: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
  },
  // Floating Close Button
  floatingCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  floatingCloseButtonDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  floatingCloseButtonText: {
    fontSize: 18,
    color: '#ffffff',
  },
  // Floating Search Container
  floatingSearchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    height: 48,
  },
  floatingSearchContainerDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  // Floating Search Results
  floatingSearchResults: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 14,
    maxHeight: 250,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingSearchResultsDark: {
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  floatingSearchResultItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  floatingSearchResultItemDark: {
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  floatingSearchResultPrimary: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 2,
  },
  floatingSearchResultSecondary: {
    fontSize: 13,
    color: '#666666',
  },
  // Floating Confirm Button
  floatingConfirmButton: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  floatingConfirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Search Bar Styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minHeight: 48,
  },
  searchContainerDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#3a3a3a',
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    color: '#000000',
  },
  searchInputDark: {
    color: '#ffffff',
  },
  searchPlaceholder: {
    color: '#999999',
  },
  clearButton: {
    fontSize: 16,
    color: '#888888',
    padding: 6,
    marginLeft: 4,
  },
  searchResults: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    maxHeight: 200,
    marginBottom: 12,
    overflow: 'hidden',
  },
  searchResultsDark: {
    backgroundColor: '#2a2a2a',
  },
  searchResultItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchResultItemDark: {
    borderBottomColor: '#3a3a3a',
  },
  searchResultText: {
    fontSize: 15,
    color: '#000000',
  },
  selectedPlaceText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 12,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 100,
  },
  // Image Picker Styles
  imagePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  imagePickerButtonDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#444',
  },
  imagePickerIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  imagePickerText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
  },
  imagePickerButtonDisabled: {
    backgroundColor: '#e0e0e0',
    borderColor: '#ccc',
    opacity: 0.6,
  },
  imagePickerTextDisabled: {
    color: '#888',
  },
  imagePreviewContainer: {
    marginTop: 12,
  },
  imagePreviewWrapper: {
    position: 'relative',
    marginRight: 8,
  },
  imagePreview: {
    width: 160,
    height: 90,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  removeImageText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
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
];