// filepath: app/(tabs)/add.tsx

import React, { useState, useEffect } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Region } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import { SPOTZ_BRAND, SPOTZ_THEME } from '../../src/constants/brand';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { SpotzSwitch } from '../../src/components/ui/SpotzSwitch';
import { AddSpotProgress, useSpots } from '../../src/context/SpotContext';
import { useAppColorScheme, useIsSpotzTheme } from '../../src/hooks/useAppColorScheme';
import { CATEGORIES, BEST_TIMES, PhotoCategory, getSpotCategoryIds } from '../../src/types';
import {
  formatCoordinates,
  formatLocationFromAddress,
  ReverseGeocodeResult,
} from '../../src/utils/location';
import { getImageSource } from '../../src/utils/images';

// Predefined popular locations for search
// OpenStreetMap Nominatim API for global geocoding
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const MAX_IMAGES = 3;
const TITLE_MAX_LENGTH = 35;
const DESCRIPTION_MAX_LENGTH = 200;
const GLASS_TAB_BAR_HEIGHT = 72;
const GLASS_TAB_BAR_BOTTOM_OFFSET = 8;
const ADD_BUTTON_TAB_GAP = 16;

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
  address?: {
    road?: string;
    pedestrian?: string;
    footway?: string;
    cycleway?: string;
    path?: string;
    residential?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    region?: string;
    country?: string;
  };
}

export default function AddSpotScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const colorScheme = useAppColorScheme();
  const isSpotzTheme = useIsSpotzTheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showSpotToOthers, setShowSpotToOthers] = useState(true);
  const [allowComments, setAllowComments] = useState(true);

  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: showFullscreenMap ? { display: 'none' } : undefined,
    });

    return () => {
      navigation.setOptions({
        tabBarStyle: undefined,
      });
    };
  }, [navigation, showFullscreenMap]);

  const getReadableLocationName = async (latitude: number, longitude: number) => {
    try {
      const params = new URLSearchParams({
        lat: `${latitude}`,
        lon: `${longitude}`,
        format: 'json',
        addressdetails: '1',
        'accept-language': 'en',
      });

      const response = await fetch(`${NOMINATIM_REVERSE_URL}?${params}`, {
        headers: {
          'User-Agent': 'SPOTZApp/1.0',
        },
      });

      if (response.ok) {
        const data: ReverseGeocodeResult = await response.json();
        const formattedLocation = formatLocationFromAddress(data.address);

        if (formattedLocation) return formattedLocation;
      }
    } catch (error) {
      console.error('Reverse geocode error:', error);
    }

    return formatCoordinates(latitude, longitude);
  };

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
    }
  };

  // Handle selecting a location from search results
  const handleSelectLocation = async (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    
    setLocation({ latitude: lat, longitude: lon });
    setRegion({
      latitude: lat,
      longitude: lon,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    });
    
    const shortName =
      formatLocationFromAddress(result.address) ||
      await getReadableLocationName(lat, lon) ||
      result.display_name.split(',').slice(0, 2).join(',').trim();
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
  const handleTempSelectLocation = async (result: SearchResult) => {
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
    
    const shortName =
      formatLocationFromAddress(result.address) ||
      await getReadableLocationName(lat, lon) ||
      result.display_name.split(',').slice(0, 2).join(',').trim();
    setTempSelectedPlaceName(shortName);
    setTempSearchQuery(shortName);
    setTempShowResults(false);
  };

  // Handle map press in fullscreen mode
  const handleTempMapPress = async (event: any) => {
    Keyboard.dismiss();
    
    const { coordinate } = event.nativeEvent;
    setTempLocation(coordinate);
    const readableLocation = await getReadableLocationName(
      coordinate.latitude,
      coordinate.longitude
    );
    setTempSelectedPlaceName(readableLocation);
  };

  // Confirm location from fullscreen map
  const handleConfirmLocation = () => {
    Keyboard.dismiss();
    
    setLocation(tempLocation);
    setRegion(tempRegion);
    setSelectedPlaceName(tempSelectedPlaceName);
    setSearchQuery(tempSelectedPlaceName || formatCoordinates(tempLocation.latitude, tempLocation.longitude));
    setShowFullscreenMap(false);
  };

  const isTitleNearLimit = title.length >= TITLE_MAX_LENGTH - 10;
  const isDescriptionNearLimit = description.length >= DESCRIPTION_MAX_LENGTH - 25;
  const hasSelectedImage = images.length > 0;
  const isFormValid = title.trim().length > 0 && !!selectedCategory && !!selectedTime && hasSelectedImage;
  const canSubmit = isFormValid && !isUploading;
  const scrollContentBottomPadding =
    insets.bottom +
    GLASS_TAB_BAR_HEIGHT +
    GLASS_TAB_BAR_BOTTOM_OFFSET +
    ADD_BUTTON_TAB_GAP +
    (Platform.OS === 'android' ? 16 : 0);

  const handleTitleChange = (text: string) => {
    setTitle(text.slice(0, TITLE_MAX_LENGTH));
  };

  const handleDescriptionChange = (text: string) => {
    setDescription(text.slice(0, DESCRIPTION_MAX_LENGTH));
  };

  const handleSubmit = async () => {
    if (isUploading) return;

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
    if (!hasSelectedImage) {
      Alert.alert('Error', 'Please add at least one photo.');
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const locationName = selectedPlaceName || formatCoordinates(location.latitude, location.longitude);

    try {
      setIsUploading(true);
      setUploadMessage('Preparing images...');
      setUploadProgress(0);

      await addSpot({
        title: trimmedTitle,
        description: trimmedDescription,
        category: selectedCategory,
        categoryId: selectedCategory,
        categoryIds: getSpotCategoryIds(selectedCategory),
        bestTimeToShoot: selectedTime,
        images,
        latitude: location.latitude,
        longitude: location.longitude,
        locationName,
        visibility: showSpotToOthers ? 'public' : 'private',
        allowComments,
        isFavorite: false,
      }, {
        onProgress: (progress: AddSpotProgress) => {
          setUploadMessage(progress.message);
          if (typeof progress.progress === 'number') {
            setUploadProgress(progress.progress);
          }
        },
      });

      setUploadMessage('Almost done...');
      setUploadProgress(1);
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
            setShowSpotToOthers(true);
            setAllowComments(true);
            router.push('/');
          },
        },
      ]);
    } catch (error) {
      console.error('[AddSpot] Save error', error);
      Alert.alert(
        'Upload Failed',
        error instanceof Error ? error.message : 'Unable to save this spot right now. Please try again.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleMapPress = async (event: any) => {
    const { coordinate } = event.nativeEvent;
    setLocation(coordinate);
    const readableLocation = await getReadableLocationName(
      coordinate.latitude,
      coordinate.longitude
    );
    setSelectedPlaceName(readableLocation);
    setSearchQuery(readableLocation);
  };

  const pickImage = async () => {
    // Calculate remaining slots
    const remainingSlots = MAX_IMAGES - images.length;
    
    if (remainingSlots <= 0) {
      Alert.alert('Limit Reached', `You can upload maximum ${MAX_IMAGES} images per spot.`);
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
      if (result.assets.length > remainingSlots) {
        Alert.alert(
          'Image Limit',
          `Only ${remainingSlots} more ${remainingSlots === 1 ? 'image can' : 'images can'} be added.`
        );
      }

      const newImages = result.assets.slice(0, remainingSlots).map((asset) => asset.uri);
      setImages((prev) => [...prev, ...newImages].slice(0, MAX_IMAGES));
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, isDark && styles.containerDark, isSpotzTheme && styles.containerSpotz]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: scrollContentBottomPadding }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, isDark && styles.textLight]}>Add New Spot</Text>
          <Text style={[styles.headerSubtitle, isDark && styles.textMuted]}>
            Add your favorite photo location
          </Text>
        </View>

        {/* Title Input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, isDark && styles.textLight]}>Title *</Text>
          <TextInput
            style={[styles.input, isDark && styles.inputDark, isSpotzTheme && styles.inputSpotz]}
            placeholder="Enter spot name"
            placeholderTextColor={isDark ? '#666' : '#999'}
            value={title}
            onChangeText={handleTitleChange}
            maxLength={TITLE_MAX_LENGTH}
          />
          <Text
            style={[
              styles.characterCounter,
              isDark && styles.characterCounterDark,
              isTitleNearLimit && (isDark ? styles.characterCounterWarningDark : styles.characterCounterWarning),
            ]}
          >
            {title.length}/{TITLE_MAX_LENGTH}
          </Text>
        </View>

        {/* Description Input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, isDark && styles.textLight]}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea, isDark && styles.inputDark, isSpotzTheme && styles.inputSpotz]}
            placeholder="Describe this photo spot..."
            placeholderTextColor={isDark ? '#666' : '#999'}
            value={description}
            onChangeText={handleDescriptionChange}
            maxLength={DESCRIPTION_MAX_LENGTH}
            multiline
            numberOfLines={4}
          />
          <Text
            style={[
              styles.characterCounter,
              isDark && styles.characterCounterDark,
              isDescriptionNearLimit && (isDark ? styles.characterCounterWarningDark : styles.characterCounterWarning),
            ]}
          >
            {description.length}/{DESCRIPTION_MAX_LENGTH}
          </Text>
        </View>

        {/* Images Section */}
        <View style={[styles.card, isDark && styles.cardDark, isSpotzTheme && styles.cardSpotz]}>
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
                      source={getImageSource(item)} 
                      style={styles.imagePreview} 
                    />
                    <TouchableOpacity
                      style={[
                        styles.removeImageButton,
                        isDark ? styles.removeImageButtonDark : styles.removeImageButtonLight,
                        Platform.OS === 'android' && (
                          isDark ? styles.removeImageButtonAndroidDark : styles.removeImageButtonAndroidLight
                        ),
                      ]}
                      onPress={() => removeImage(index)}
                      activeOpacity={0.82}
                    >
                      <Ionicons
                        name="close"
                        size={Platform.OS === 'android' ? 20 : 18}
                        color={isDark ? '#ffffff' : '#111827'}
                        style={styles.removeImageIcon}
                      />
                      <Text style={styles.removeImageText}>×</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            </View>
          )}
        </View>

        {/* Category Section */}
        <View style={[styles.card, isDark && styles.cardDark, isSpotzTheme && styles.cardSpotz]}>
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
                  isSpotzTheme && styles.categoryButtonSpotz,
                  selectedCategory === cat.value && (isDark ? styles.categoryButtonSelectedDark : styles.categoryButtonSelected),
                ]}
                onPress={() => setSelectedCategory(cat.value)}
              >
                <CategoryIcon category={cat.value} size={26} style={styles.categoryIcon} />
                <Text
                  style={[
                    styles.categoryLabel,
                    selectedCategory === cat.value && (isSpotzTheme ? styles.selectedLabelSpotz : styles.categoryLabelSelected),
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
        <View style={[styles.card, isDark && styles.cardDark, isSpotzTheme && styles.cardSpotz]}>
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
                  isSpotzTheme && styles.timeButtonSpotz,
                  selectedTime === time && (isDark ? styles.timeButtonSelectedDark : styles.timeButtonSelected),
                ]}
                onPress={() => setSelectedTime(time)}
              >
                <Text
                  style={[styles.timeLabel, selectedTime === time && (isSpotzTheme ? styles.selectedLabelSpotz : styles.timeLabelSelected), isDark && selectedTime !== time && styles.textLight]}
                >
                  {time}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Location Section */}
        <View style={[styles.card, isDark && styles.cardDark, isSpotzTheme && styles.cardSpotz]}>
          <Text style={[styles.cardTitle, isDark && styles.textLight]}>Location *</Text>
          <Text style={[styles.cardSubtitle, isDark && styles.textMuted]}>
            Set the exact location of your spot on the map
          </Text>
          
          {/* Search Bar */}
          <View style={[styles.searchContainer, isDark && styles.searchContainerDark, isSpotzTheme && styles.searchContainerSpotz]}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={[styles.searchInput, isDark && styles.searchInputDark, isSpotzTheme && styles.searchInputSpotz]}
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
              {searchResults.map((item) => (
                <TouchableOpacity
                  key={`${item.place_id}`}
                  style={[styles.searchResultItem, isDark && styles.searchResultItemDark]}
                  onPress={() => handleSelectLocation(item)}
                >
                  <Text style={[styles.searchResultText, isDark && styles.textLight]} numberOfLines={2}>
                    {item.display_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Map */}
          <View style={[styles.mapContainer, isDark && styles.mapContainerDark]}>
            <MapView
              style={styles.map}
              region={region}
              onRegionChangeComplete={setRegion}
              onPress={handleMapPress}
              customMapStyle={isDark && Platform.OS === 'ios' ? darkMapStyle : []}
            >
              <Marker coordinate={location} />
            </MapView>
            {/* Expand Button */}
            <TouchableOpacity
              style={[
                styles.expandButton,
                isDark && styles.expandButtonDark,
                isSpotzTheme && styles.expandButtonSpotz,
                Platform.OS === 'android' && styles.expandButtonAndroid,
              ]}
              onPress={() => setShowFullscreenMap(true)}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityLabel="Open fullscreen map"
            >
              <Ionicons
                name="expand-outline"
                size={21}
                color={isSpotzTheme ? SPOTZ_THEME.text : '#ffffff'}
              />
              <Text style={styles.expandButtonText}>⛶</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.coordinates, isDark && styles.textMuted]}>
            {selectedPlaceName || formatCoordinates(location.latitude, location.longitude)}
          </Text>
        </View>

        {/* Visibility Section */}
        <View style={[styles.card, styles.settingsCard, isDark && styles.cardDark, isSpotzTheme && styles.cardSpotz]}>
          <View style={styles.settingsTitleRow}>
            <Text style={[styles.cardTitle, styles.commentsPermissionTitle, isDark && styles.textLight]}>
              Show this spot to others
            </Text>
            <View style={styles.settingsSwitchSlot}>
              <SpotzSwitch
                value={showSpotToOthers}
                onValueChange={setShowSpotToOthers}
              />
            </View>
          </View>
          <Text style={[styles.commentsPermissionHelper, isDark && styles.textMuted]}>
            If off, only you can see this spot.
          </Text>
        </View>

        {/* Comments Section */}
        <View style={[styles.card, styles.settingsCard, isDark && styles.cardDark, isSpotzTheme && styles.cardSpotz]}>
          <View style={styles.settingsTitleRow}>
            <Text style={[styles.cardTitle, styles.commentsPermissionTitle, isDark && styles.textLight]}>
              Allow comments
            </Text>
            <View style={styles.settingsSwitchSlot}>
              <SpotzSwitch
                value={allowComments}
                onValueChange={setAllowComments}
              />
            </View>
          </View>
          <Text style={[styles.commentsPermissionHelper, isDark && styles.textMuted]}>
            {allowComments
              ? 'Comments help your SPOTZ gain more visibility and popularity.'
              : 'With comments disabled, your SPOTZ may grow slower in Popular rankings.'}
          </Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            !isFormValid && styles.submitButtonDisabled,
            isUploading && styles.submitButtonUploading,
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.82}
        >
          {isUploading ? (
            <View style={styles.submitButtonContent}>
              <ActivityIndicator size="small" color="#ffffff" />
              <Text style={[styles.submitButtonText, isSpotzTheme && styles.submitButtonTextSpotz]}>
                {uploadMessage || 'Uploading...'}
              </Text>
            </View>
          ) : (
            <Text style={[styles.submitButtonText, isSpotzTheme && styles.submitButtonTextSpotz]}>Add Spot</Text>
          )}
        </TouchableOpacity>
        {isUploading && (
          <View style={styles.uploadProgressContainer}>
            <View style={styles.uploadProgressTrack}>
              <View style={[styles.uploadProgressFill, { width: `${Math.round(uploadProgress * 100)}%` }]} />
            </View>
            <Text style={[styles.uploadProgressText, isDark && styles.textMuted]}>
              {uploadMessage || 'Uploading...'}
            </Text>
          </View>
        )}

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
              customMapStyle={isDark && Platform.OS === 'ios' ? darkMapStyle : []}
            >
              <Marker coordinate={tempLocation} />
            </MapView>

          {/* Floating Top Bar Container */}
          <View style={styles.floatingTopBar}>
            {/* Floating Search Bar */}
            <View
              style={[
                styles.floatingSearchContainer,
                isDark && styles.floatingSearchContainerDark,
                Platform.OS === 'android' && styles.floatingSearchContainerAndroid,
              ]}
            >
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={[styles.searchInput, isDark && styles.searchInputDark]}
                placeholder="Search city, street, or landmark..."
                placeholderTextColor={isDark ? '#666' : '#999'}
                underlineColorAndroid="transparent"
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
              style={[
                styles.floatingCloseButton,
                isDark && styles.floatingCloseButtonDark,
                Platform.OS === 'android' && styles.floatingCloseButtonAndroid,
                isSpotzTheme && styles.floatingCloseButtonSpotz,
              ]}
              onPress={() => setShowFullscreenMap(false)}
              activeOpacity={0.7}
              hitSlop={8}
            >
              <Ionicons
                name="close"
                size={22}
                color={isSpotzTheme ? SPOTZ_THEME.text : '#ffffff'}
              />
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
    backgroundColor: SPOTZ_BRAND.charcoal,
  },
  containerSpotz: {
    backgroundColor: SPOTZ_THEME.background,
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
  settingsCard: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  cardDark: {
    backgroundColor: '#2a2a2a',
  },
  cardSpotz: {
    backgroundColor: SPOTZ_THEME.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SPOTZ_THEME.border,
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
  settingsTitleRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  commentsPermissionTitle: {
    flex: 1,
    marginBottom: 0,
    lineHeight: 24,
    includeFontPadding: false,
  },
  settingsSwitchSlot: {
    minWidth: 52,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentsPermissionHelper: {
    color: '#666666',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
    marginTop: 5,
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
  inputSpotz: {
    backgroundColor: SPOTZ_THEME.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SPOTZ_THEME.border,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  characterCounter: {
    alignSelf: 'flex-end',
    marginTop: 6,
    fontSize: 12,
    color: '#666666',
    opacity: 0.75,
  },
  characterCounterDark: {
    color: '#888888',
  },
  characterCounterWarning: {
    color: '#d97706',
    opacity: 0.9,
  },
  characterCounterWarningDark: {
    color: '#f59e0b',
    opacity: 0.9,
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
  categoryButtonSpotz: {
    backgroundColor: SPOTZ_THEME.input,
    borderColor: SPOTZ_THEME.border,
  },
  categoryButtonSelected: {
    backgroundColor: SPOTZ_BRAND.accent,
    borderColor: SPOTZ_BRAND.accent,
    shadowColor: SPOTZ_BRAND.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  categoryButtonSelectedDark: {
    backgroundColor: SPOTZ_BRAND.accent,
    borderColor: SPOTZ_BRAND.accent,
    shadowColor: SPOTZ_BRAND.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  categoryIcon: {
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
  selectedLabelSpotz: {
    color: SPOTZ_THEME.accentText,
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
  timeButtonSpotz: {
    backgroundColor: SPOTZ_THEME.input,
    borderColor: SPOTZ_THEME.border,
  },
  timeButtonSelected: {
    backgroundColor: SPOTZ_BRAND.accent,
    borderColor: SPOTZ_BRAND.accent,
    shadowColor: SPOTZ_BRAND.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  timeButtonSelectedDark: {
    backgroundColor: SPOTZ_BRAND.accent,
    borderColor: SPOTZ_BRAND.accent,
    shadowColor: SPOTZ_BRAND.accent,
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
    backgroundColor: 'rgba(17, 24, 39, 0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.42)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    overflow: 'hidden',
  },
  expandButtonDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  expandButtonSpotz: {
    backgroundColor: 'rgba(26, 36, 25, 0.88)',
    borderColor: SPOTZ_THEME.borderStrong,
  },
  expandButtonAndroid: {
    elevation: 0,
    shadowOpacity: 0,
  },
  expandButtonText: {
    display: 'none',
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
    backgroundColor: SPOTZ_BRAND.charcoal,
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
    flexShrink: 0,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
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
  floatingCloseButtonSpotz: {
    backgroundColor: 'rgba(26, 36, 25, 0.88)',
    borderColor: SPOTZ_THEME.borderStrong,
  },
  floatingCloseButtonAndroid: {
    backgroundColor: 'rgba(18, 18, 20, 0.82)',
    borderColor: 'rgba(255, 255, 255, 0.18)',
    shadowOpacity: 0,
    elevation: 0,
  },
  // Floating Search Container
  floatingSearchContainer: {
    flex: 1,
    marginRight: 12,
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
  floatingSearchContainerAndroid: {
    backgroundColor: 'rgba(18, 18, 20, 0.82)',
    borderColor: 'rgba(255, 255, 255, 0.18)',
    shadowOpacity: 0,
    elevation: 0,
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
    backgroundColor: SPOTZ_BRAND.accent,
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
  searchContainerSpotz: {
    backgroundColor: SPOTZ_THEME.input,
    borderColor: SPOTZ_THEME.border,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingVertical: 10,
    fontSize: 15,
    color: '#000000',
  },
  searchInputSpotz: {
    color: SPOTZ_THEME.text,
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
    backgroundColor: SPOTZ_BRAND.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonUploading: {
    backgroundColor: SPOTZ_BRAND.accent,
    opacity: 0.86,
  },
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButtonTextSpotz: {
    color: SPOTZ_THEME.accentText,
  },
  uploadProgressContainer: {
    marginTop: 10,
    paddingHorizontal: 2,
  },
  uploadProgressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(139, 158, 139, 0.16)',
    overflow: 'hidden',
  },
  uploadProgressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: SPOTZ_BRAND.accent,
  },
  uploadProgressText: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 7,
    textAlign: 'center',
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
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  removeImageButtonDark: {
    backgroundColor: 'rgba(8, 12, 18, 0.72)',
    borderColor: 'rgba(255, 255, 255, 0.24)',
  },
  removeImageButtonLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderColor: 'rgba(15, 23, 42, 0.16)',
    shadowOpacity: 0.18,
  },
  removeImageButtonAndroidDark: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(8, 12, 18, 0.78)',
    borderColor: 'rgba(255, 255, 255, 0.22)',
    elevation: 3,
  },
  removeImageButtonAndroidLight: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.84)',
    borderColor: 'rgba(15, 23, 42, 0.18)',
    elevation: 3,
  },
  removeImageIcon: {
    lineHeight: 20,
    textAlign: 'center',
  },
  removeImageText: {
    display: 'none',
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
