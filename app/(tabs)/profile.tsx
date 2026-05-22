// filepath: app/(tabs)/profile.tsx

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Alert,
  Linking,
  TouchableWithoutFeedback,
  Pressable,
  Animated,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { SPOTZ_BRAND, SPOTZ_PIN_LOGO_SOURCE, SPOTZ_THEME } from '../../src/constants/brand';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { SpotzSwitch } from '../../src/components/ui/SpotzSwitch';
import { useSpots } from '../../src/context/SpotContext';
import { useNotifications } from '../../src/context/NotificationContext';
import { useLocationPermission } from '../../src/context/LocationPermissionContext';
import { useAppColorScheme, useIsSpotzTheme } from '../../src/hooks/useAppColorScheme';
import {
  PhotoSpot,
  ThemePreference,
  getCategoryLabel,
} from '../../src/types';
import { LEGAL_PAGE_SUMMARIES, LegalPageSlug } from '../../src/data/legalPages';
import { getSpotLocationLabel } from '../../src/utils/location';
import { getImageSource, getSpotCoverImageSource, normalizeImageUri, persistLocalImageAsync } from '../../src/utils/images';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;
const DISPLAY_NAME_MAX_LENGTH = 40;
const BIO_MAX_LENGTH = 100;
const SETTINGS_SHEET_DISMISSED_Y = 620;
const GLASS_TAB_BAR_HEIGHT = 72;
const GLASS_TAB_BAR_BOTTOM_OFFSET = 8;
const ANDROID_TAB_BAR_GAP = 24;
type SettingsSheet = 'general' | 'theme' | 'privacy' | 'legal';

function isPrivateSpot(spot: PhotoSpot) {
  return spot.visibility === 'private' || spot.isPublic === false;
}

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    value: 'dark',
    label: 'Dark Mode',
    description: 'Use SPOTZ in dark colors',
    icon: 'moon-outline',
  },
  {
    value: 'light',
    label: 'Light Mode',
    description: 'Use SPOTZ in light colors',
    icon: 'sunny-outline',
  },
  {
    value: 'spotz',
    label: 'SPOTZ Theme',
    description: 'Use a branded green SPOTZ palette',
    icon: 'leaf-outline',
  },
  {
    value: 'system',
    label: 'System Default',
    description: 'Follow device appearance',
    icon: 'phone-portrait-outline',
  },
];
export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ settings?: string; settingsNonce?: string }>();
  const colorScheme = useAppColorScheme();
  const isSpotzTheme = useIsSpotzTheme();
  const isDark = colorScheme === 'dark';
  const { logout, deleteAccount } = useAuth();
  const listBottomPadding =
    Platform.OS === 'android'
      ? GLASS_TAB_BAR_HEIGHT + GLASS_TAB_BAR_BOTTOM_OFFSET + ANDROID_TAB_BAR_GAP
      : 100;
  const {
    user,
    spots,
    getFavoriteSpots,
    updateUserProfile,
    settings,
    updateSettings,
    deleteAllSpotsFromDatabase,
  } = useSpots();
  const { unreadCount } = useNotifications();
  const {
    isLocationAccessEnabled,
    locationFeaturesEnabled,
    permissionStatus,
    isLocationLoading,
    setLocationAccessEnabled,
  } = useLocationPermission();
  const [expandedSections, setExpandedSections] = useState({
    uploaded: false,
  });
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [isSettingsSheetVisible, setIsSettingsSheetVisible] = useState(false);
  const [activeSettingsSheet, setActiveSettingsSheet] = useState<SettingsSheet | null>(null);
  const [isLanguagePickerVisible, setIsLanguagePickerVisible] = useState(false);
  const [isMapAppPickerVisible, setIsMapAppPickerVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [draftDisplayName, setDraftDisplayName] = useState(user.displayName || user.username);
  const [draftBio, setDraftBio] = useState(user.bio || '');
  const [draftProfileImage, setDraftProfileImage] = useState(normalizeImageUri(user.profileImage));
  const [profileError, setProfileError] = useState('');
  const [isDeleteAccountModalVisible, setIsDeleteAccountModalVisible] = useState(false);
  const [deleteAccountConfirmation, setDeleteAccountConfirmation] = useState('');
  const [deleteAccountError, setDeleteAccountError] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const settingsSheetTranslateY = useRef(new Animated.Value(SETTINGS_SHEET_DISMISSED_Y)).current;
  const settingsBackdropOpacity = useRef(new Animated.Value(0)).current;
  const handledSettingsNonce = useRef<string | undefined>(undefined);
  const uploadedSpots = spots.filter((spot) => spot.createdBy === user.id);
  const favoriteSpots = getFavoriteSpots();
  const profileDisplayName = user.displayName || user.username;
  const isDisplayNameValid = draftDisplayName.trim().length > 0;
  const profileValidationMessage =
    profileError ||
    (draftDisplayName.trim().length === 0 ? 'Display name is required.' : '');
  const canConfirmAccountDeletion = deleteAccountConfirmation.trim() === 'DELETE';

  const handleSpotPress = (spotId: string) => {
    router.push({
      pathname: '/spot/[id]',
      params: {
        id: spotId,
        from: 'profileUploads',
      },
    } as any);
  };

  const handleToggleSection = () => {
    setExpandedSections((prev) => ({
      ...prev,
      uploaded: !prev.uploaded,
    }));
  };

  const openNotifications = () => {
    router.push('/notifications' as any);
  };

  const openEditProfile = () => {
    setDraftDisplayName(user.displayName || user.username);
    setDraftBio(user.bio || '');
    setDraftProfileImage(normalizeImageUri(user.profileImage));
    setProfileError('');
    setIsEditModalVisible(true);
  };

  const closeEditProfile = () => {
    Keyboard.dismiss();
    setIsEditModalVisible(false);
  };

  const handleDisplayNameChange = (text: string) => {
    setProfileError('');
    setDraftDisplayName(text.slice(0, DISPLAY_NAME_MAX_LENGTH));
  };

  const handleBioChange = (text: string) => {
    setDraftBio(text.slice(0, BIO_MAX_LENGTH));
  };

  const pickProfileImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library to select a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (!result.canceled && result.assets.length > 0) {
      const persistedImageUri = await persistLocalImageAsync(result.assets[0].uri, 'profile');
      setDraftProfileImage(persistedImageUri);
    }
  };

  const handleSaveProfile = () => {
    Keyboard.dismiss();
    const trimmedDisplayName = draftDisplayName.trim();

    if (!trimmedDisplayName) {
      setProfileError('Display name is required.');
      return;
    }

    updateUserProfile({
      displayName: trimmedDisplayName,
      bio: draftBio.trim(),
      profileImage: draftProfileImage,
    });
    setIsEditModalVisible(false);
  };

  const openSettingsSheet = useCallback((sheet: SettingsSheet) => {
    setIsSettingsModalVisible(false);
    setActiveSettingsSheet(sheet);
    setIsSettingsSheetVisible(true);
    settingsSheetTranslateY.setValue(SETTINGS_SHEET_DISMISSED_Y);
    settingsBackdropOpacity.setValue(0);

    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(settingsSheetTranslateY, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(settingsBackdropOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [settingsBackdropOpacity, settingsSheetTranslateY]);

  useEffect(() => {
    if (params.settings !== 'privacy') return;

    const nonce = params.settingsNonce || 'initial';
    if (handledSettingsNonce.current === nonce) return;

    handledSettingsNonce.current = nonce;
    openSettingsSheet('privacy');
  }, [openSettingsSheet, params.settings, params.settingsNonce]);

  const dismissSettingsSheet = () => {
    Animated.parallel([
      Animated.timing(settingsSheetTranslateY, {
        toValue: SETTINGS_SHEET_DISMISSED_Y,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(settingsBackdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) return;
      setIsSettingsSheetVisible(false);
      setActiveSettingsSheet(null);
      setIsLanguagePickerVisible(false);
      setIsMapAppPickerVisible(false);
    });
  };

  const handleGeneralSettingsPress = () => {
    openSettingsSheet('general');
  };

  const handleSettingsItemPress = (item: 'theme' | 'privacy' | 'legal') => {
    openSettingsSheet(item);
  };

  const handleLegalItemPress = (slug: LegalPageSlug) => {
    setIsSettingsSheetVisible(false);
    setActiveSettingsSheet(null);
    setIsLanguagePickerVisible(false);
    setIsMapAppPickerVisible(false);
    router.push({ pathname: '/legal/[slug]', params: { slug } } as any);
  };

  const openDeleteAccountModal = () => {
    setIsSettingsSheetVisible(false);
    setActiveSettingsSheet(null);
    setIsLanguagePickerVisible(false);
    setIsMapAppPickerVisible(false);
    setDeleteAccountConfirmation('');
    setDeleteAccountError('');
    setIsDeleteAccountModalVisible(true);
  };

  const closeDeleteAccountModal = () => {
    if (isDeletingAccount) return;

    setIsDeleteAccountModalVisible(false);
    setDeleteAccountConfirmation('');
    setDeleteAccountError('');
  };

  const openAccountDeletionInfo = () => {
    if (isDeletingAccount) return;

    setIsDeleteAccountModalVisible(false);
    setDeleteAccountConfirmation('');
    setDeleteAccountError('');
    router.push({ pathname: '/legal/[slug]', params: { slug: 'account-deletion' } } as any);
  };

  const handleDeleteAccountConfirm = async () => {
    if (!canConfirmAccountDeletion || isDeletingAccount) return;

    Keyboard.dismiss();
    setDeleteAccountError('');
    setIsDeletingAccount(true);

    try {
      await deleteAccount();
      setIsDeleteAccountModalVisible(false);
    } catch (error) {
      setDeleteAccountError(
        error instanceof Error
          ? error.message
          : 'Unable to delete your account right now. Please try again.'
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleDeleteAllSpotsPress = () => {
    Alert.alert(
      'Delete All Spots',
      'Delete ALL spots from the database? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All Spots',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAllSpotsFromDatabase();
              dismissSettingsSheet();
              Alert.alert('Spots Deleted', 'All spots have been deleted from the database.');
            } catch (error) {
              console.error('Failed to delete all spots', error);
              Alert.alert('Delete Failed', 'Unable to delete all spots right now.');
            }
          },
        },
      ]
    );
  };

  const handleLocationAccessToggle = async (enabled: boolean) => {
    await setLocationAccessEnabled(enabled);
  };

  const handleOpenLocationSettings = async () => {
    try {
      await Linking.openSettings();
    } catch (error) {
      console.error('Failed to open system settings', error);
      Alert.alert('Open Settings', 'Open your device settings to update location permission for SPOTZ.');
    }
  };

  const locationAccessStatusLabel = !isLocationAccessEnabled
    ? 'Off'
    : locationFeaturesEnabled
      ? permissionStatus === 'limited'
        ? 'Limited'
        : 'On'
      : permissionStatus === 'denied'
        ? 'Blocked'
        : 'Needs permission';

  const handleLogOutPress = () => {
    setIsSettingsModalVisible(false);
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              console.error('Failed to log out', error);
              Alert.alert('Log Out Failed', 'Unable to log out right now. Please try again.');
            }
          },
        },
      ]
    );
  };

  const renderSpotCard = (item: PhotoSpot) => (
    <TouchableOpacity
      style={[styles.spotCard, isDark && styles.spotCardDark]}
      onPress={() => handleSpotPress(item.id)}
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
        <View style={styles.privateBadgeSlot}>
          {isPrivateSpot(item) && (
            <View style={[styles.privateBadge, isDark && styles.privateBadgeDark]}>
              <Ionicons name="lock-closed-outline" size={10} color={SPOTZ_BRAND.accent} />
              <Text style={styles.privateBadgeText}>Private</Text>
            </View>
          )}
        </View>
        <View style={styles.spotCategoryRow}>
          <CategoryIcon category={item.category} size={12} style={styles.spotCategoryIcon} />
          <Text style={[styles.spotCategory, isDark && styles.textMuted]} numberOfLines={1}>
            {getCategoryLabel(item.category)}
          </Text>
        </View>
        <Text style={[styles.spotLocation, isDark && styles.textMuted]} numberOfLines={1}>
          📍 {getSpotLocationLabel(item)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderSpotSection = (section: {
    key: 'uploaded';
    title: string;
    data: PhotoSpot[];
  }) => {
    const isExpanded = expandedSections[section.key];
    const visibleSpots = isExpanded ? section.data : section.data.slice(0, 2);
    const shouldShowToggle = section.data.length > 2;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, isDark && styles.textLight]}>
            {section.title}
          </Text>
          {shouldShowToggle && (
            <TouchableOpacity
              onPress={handleToggleSection}
              style={styles.showAllButton}
              activeOpacity={0.7}
            >
              <Text style={styles.showAllText}>{isExpanded ? 'Hide' : 'Show All'}</Text>
            </TouchableOpacity>
          )}
        </View>
        {section.data.length > 0 ? (
          <View style={styles.spotGrid}>
            {visibleSpots.map((spot) => (
              <View key={spot.id} style={styles.spotGridItem}>
                {renderSpotCard(spot)}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptySection}>
            <Text style={[styles.emptyText, isDark && styles.textMuted]}>
              {"You haven't uploaded any spots yet"}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const StatItem = ({ value, label }: { value: number; label: string }) => (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, isDark && styles.textLight]}>{value}</Text>
      <Text style={[styles.statLabel, isDark && styles.textMuted]}>{label}</Text>
    </View>
  );

  return (
    <View style={[styles.container, isDark && styles.containerDark, isSpotzTheme && styles.containerSpotz]}>
      {/* Sections */}
      <FlatList
        data={[
          { key: 'uploaded', title: 'My Uploaded Spots', data: uploadedSpots },
        ]}
        renderItem={({ item }) => renderSpotSection(item as {
          key: 'uploaded';
          title: string;
          data: PhotoSpot[];
        })}
        keyExtractor={(item) => item.key}
        contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPadding }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.headerTitle, isDark && styles.textLight]}>Profile</Text>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={[styles.settingsButton, isDark && styles.settingsButtonDark, isSpotzTheme && styles.settingsButtonSpotz]}
                  onPress={openNotifications}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Open notifications"
                >
                  <Ionicons
                    name="notifications-outline"
                    size={20}
                    color={isSpotzTheme ? SPOTZ_THEME.text : isDark ? '#ffffff' : '#1a1a1a'}
                  />
                  {unreadCount > 0 && (
                    <View style={styles.notificationBadge}>
                      <Text style={styles.notificationBadgeText}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.settingsButton, isDark && styles.settingsButtonDark, isSpotzTheme && styles.settingsButtonSpotz]}
                  onPress={() => setIsSettingsModalVisible(true)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Open settings"
                >
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={20}
                    color={isSpotzTheme ? SPOTZ_THEME.text : isDark ? '#ffffff' : '#1a1a1a'}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Profile Card */}
            <View
              style={[
                styles.profileCard,
                Platform.OS === 'ios' && styles.profileCardIOS,
                isDark && styles.profileCardDark,
                isSpotzTheme && styles.profileCardSpotz,
              ]}
            >
              <View style={[styles.avatarContainer, isDark && styles.avatarContainerDark]}>
                {normalizeImageUri(user.profileImage) ? (
                  <Image source={getImageSource(user.profileImage)} style={styles.avatarImage} />
                ) : (
                  <Image source={SPOTZ_PIN_LOGO_SOURCE} style={styles.avatarPlaceholderLogo} resizeMode="contain" />
                )}
              </View>
              <Text style={[styles.username, isDark && styles.textLight]}>{profileDisplayName}</Text>
              <Text style={styles.userHandle}>@{user.username}</Text>
              {user.isFounder && (
                <View style={[styles.founderBadge, isDark && styles.founderBadgeDark, isSpotzTheme && styles.founderBadgeSpotz]}>
                  <Ionicons name="sparkles-outline" size={13} color={SPOTZ_BRAND.accent} />
                  <Text style={styles.founderBadgeText}>
                    {typeof user.founderNumber === 'number'
                      ? `Founding Member #${user.founderNumber}`
                      : 'Founding Member'}
                  </Text>
                </View>
              )}
              <Text style={[styles.userBio, isDark && styles.textMuted]}>
                {user.bio || 'Photography enthusiast'}
              </Text>
              <TouchableOpacity
                style={[styles.editProfileButton, isDark && styles.editProfileButtonDark, isSpotzTheme && styles.editProfileButtonSpotz]}
                onPress={openEditProfile}
              activeOpacity={0.75}
              >
                <Ionicons
                  name="pencil-outline"
                  size={14}
                  color={isSpotzTheme ? SPOTZ_THEME.text : isDark ? '#ffffff' : '#1a1a1a'}
                />
                <Text style={[styles.editProfileButtonText, isDark && styles.textLight]}>
                  Edit Profile
                </Text>
              </TouchableOpacity>

              {/* Stats */}
              <View style={styles.statsContainer}>
                <StatItem value={uploadedSpots.length} label="Spots" />
                <View style={styles.statDivider} />
                <StatItem value={favoriteSpots.length} label="Favorites" />
              </View>
            </View>
          </>
        }
      />

      <Modal
        visible={isEditModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.editModal, isDark && styles.editModalDark]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeEditProfile} style={styles.modalHeaderButton}>
                <Text style={[styles.modalCancelText, isDark && styles.textMuted]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, isDark && styles.textLight]}>Edit Profile</Text>
              <TouchableOpacity
                onPress={handleSaveProfile}
                style={styles.modalHeaderButton}
                disabled={!isDisplayNameValid}
              >
                <Text style={[styles.modalSaveText, !isDisplayNameValid && styles.modalSaveTextDisabled]}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <View>
                <View style={styles.editAvatarSection}>
                  <TouchableOpacity onPress={pickProfileImage} activeOpacity={0.75}>
                    <View style={[styles.editAvatarContainer, isDark && styles.avatarContainerDark]}>
                  {draftProfileImage ? (
                    <Image source={getImageSource(draftProfileImage)} style={styles.avatarImage} />
                      ) : (
                        <Image source={SPOTZ_PIN_LOGO_SOURCE} style={styles.avatarPlaceholderLogo} resizeMode="contain" />
                      )}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={pickProfileImage} activeOpacity={0.75}>
                    <Text style={styles.changePhotoText}>Change Photo</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.editInputGroup}>
                  <Text style={[styles.editLabel, isDark && styles.textLight]}>Display name *</Text>
                  <TextInput
                    style={[styles.editInput, isDark && styles.editInputDark]}
                    value={draftDisplayName}
                    onChangeText={handleDisplayNameChange}
                    placeholder="Display name"
                    placeholderTextColor={isDark ? '#666' : '#999'}
                    autoCapitalize="words"
                    maxLength={DISPLAY_NAME_MAX_LENGTH}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                    blurOnSubmit
                  />
                  <View style={styles.inputMetaRow}>
                    <Text style={[styles.inputHint, isDark && styles.textMuted]}>
                      Your public profile name
                    </Text>
                    <Text style={[styles.characterCounter, isDark && styles.textMuted]}>
                      {draftDisplayName.length}/{DISPLAY_NAME_MAX_LENGTH}
                    </Text>
                  </View>
                  {profileValidationMessage && (
                    <Text style={styles.profileErrorText}>
                      {profileValidationMessage}
                    </Text>
                  )}
                </View>

                <View style={styles.editInputGroup}>
                  <Text style={[styles.editLabel, isDark && styles.textLight]}>Bio</Text>
                  <TextInput
                    style={[styles.editInput, styles.bioInput, isDark && styles.editInputDark]}
                    value={draftBio}
                    onChangeText={handleBioChange}
                    placeholder="Tell people about your photography style"
                    placeholderTextColor={isDark ? '#666' : '#999'}
                    multiline
                    maxLength={BIO_MAX_LENGTH}
                    textAlignVertical="top"
                    returnKeyType="done"
                    blurOnSubmit
                    onSubmitEditing={Keyboard.dismiss}
                  />
                  <Text style={[styles.characterCounter, isDark && styles.textMuted]}>
                    {draftBio.length}/{BIO_MAX_LENGTH}
                  </Text>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={isSettingsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSettingsModalVisible(false)}
      >
        <Pressable
          style={styles.settingsPopoverBackdrop}
          onPress={() => setIsSettingsModalVisible(false)}
        >
          <Pressable style={[styles.settingsPopover, isDark && styles.settingsPopoverDark, isSpotzTheme && styles.settingsPopoverSpotz]}>
            <TouchableOpacity
              style={styles.settingsMenuItem}
              onPress={handleGeneralSettingsPress}
              activeOpacity={0.72}
            >
              <Ionicons name="settings-outline" size={18} color={isSpotzTheme ? SPOTZ_THEME.text : isDark ? '#ffffff' : '#1f2937'} />
              <Text style={[styles.settingsMenuText, isDark && styles.textLight]}>General</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingsMenuItem}
              onPress={() => handleSettingsItemPress('theme')}
              activeOpacity={0.72}
            >
              <Ionicons name="moon-outline" size={18} color={isSpotzTheme ? SPOTZ_THEME.text : isDark ? '#ffffff' : '#1f2937'} />
              <Text style={[styles.settingsMenuText, isDark && styles.textLight]}>Theme</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingsMenuItem}
              onPress={() => handleSettingsItemPress('privacy')}
              activeOpacity={0.72}
            >
              <Ionicons name="lock-closed-outline" size={18} color={isSpotzTheme ? SPOTZ_THEME.text : isDark ? '#ffffff' : '#1f2937'} />
              <Text style={[styles.settingsMenuText, isDark && styles.textLight]}>Privacy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingsMenuItem}
              onPress={() => handleSettingsItemPress('legal')}
              activeOpacity={0.72}
            >
              <Ionicons name="document-text-outline" size={18} color={isSpotzTheme ? SPOTZ_THEME.text : isDark ? '#ffffff' : '#1f2937'} />
              <Text style={[styles.settingsMenuText, isDark && styles.textLight]}>Legal</Text>
            </TouchableOpacity>
            <View style={[styles.settingsMenuDivider, isDark && styles.settingsMenuDividerDark]} />
            <TouchableOpacity
              style={styles.settingsMenuItem}
              onPress={handleLogOutPress}
              activeOpacity={0.72}
            >
              <Ionicons name="log-out-outline" size={18} color="#ff3b30" />
              <Text style={[styles.settingsMenuText, styles.settingsMenuDestructive]}>
                Log Out
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={isSettingsSheetVisible}
        transparent
        animationType="none"
        onRequestClose={dismissSettingsSheet}
      >
        <View style={styles.generalSettingsBackdrop}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.generalSettingsBackdropOverlay,
              { opacity: settingsBackdropOpacity },
            ]}
          />
          <Pressable style={styles.generalSettingsDismissArea} onPress={dismissSettingsSheet}>
          <Animated.View
            style={[
              styles.generalSettingsPanel,
              isDark && styles.generalSettingsPanelDark,
              isSpotzTheme && styles.generalSettingsPanelSpotz,
              { transform: [{ translateY: settingsSheetTranslateY }] },
            ]}
          >
            <Pressable onPress={(event) => event.stopPropagation()}>
            <View style={styles.generalSettingsHeader}>
              <TouchableOpacity
                style={styles.generalSettingsHeaderButton}
                onPress={dismissSettingsSheet}
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityLabel="Close settings"
              >
                <View style={[styles.settingsCloseButton, isDark && styles.settingsCloseButtonDark, isSpotzTheme && styles.settingsCloseButtonSpotz]}>
                  <Ionicons name="close" size={19} color={isSpotzTheme ? SPOTZ_THEME.text : isDark ? '#ffffff' : '#111827'} />
                </View>
              </TouchableOpacity>
              <View style={styles.settingsTitleGroup}>
                <Text style={[styles.modalTitle, isDark && styles.textLight]}>
                  {activeSettingsSheet === 'general'
                    ? 'General'
                    : activeSettingsSheet === 'theme'
                      ? 'Theme'
                      : activeSettingsSheet === 'privacy'
                        ? 'Privacy'
                        : 'Legal'}
                </Text>
              </View>
              <View style={styles.generalSettingsHeaderButton} />
            </View>

            {activeSettingsSheet === 'general' ? (
              <View style={[styles.settingsList, isDark && styles.settingsListDark, isSpotzTheme && styles.settingsListSpotz]}>
              <TouchableOpacity
                style={styles.generalSettingsRow}
                onPress={() => setIsLanguagePickerVisible((prev) => !prev)}
                activeOpacity={0.72}
              >
                <View style={styles.generalSettingsRowLabel}>
                  <Ionicons name="language-outline" size={20} color={isSpotzTheme ? SPOTZ_THEME.text : isDark ? '#ffffff' : '#1f2937'} />
                  <Text style={[styles.generalSettingsLabel, isDark && styles.textLight]}>
                    Language
                  </Text>
                </View>
                <Text style={[styles.generalSettingsValue, isDark && styles.textMuted]}>
                  {settings.language}
                </Text>
              </TouchableOpacity>
              {isLanguagePickerVisible && (
                <View style={[styles.inlineSettingsPicker, isDark && styles.inlineSettingsPickerDark, isSpotzTheme && styles.inlineSettingsPickerSpotz]}>
                  <TouchableOpacity
                    style={styles.inlinePickerOption}
                    onPress={() => {
                      updateSettings({ language: 'English' });
                      setIsLanguagePickerVisible(false);
                    }}
                    activeOpacity={0.72}
                  >
                    <Text style={[styles.inlinePickerText, isDark && styles.textLight]}>English</Text>
                    <Ionicons name="checkmark" size={18} color={SPOTZ_BRAND.accent} />
                  </TouchableOpacity>
                  <Text style={[styles.inlinePickerHint, isDark && styles.textMuted]}>
                    More languages coming soon
                  </Text>
                </View>
              )}

              <View style={[styles.settingsRowDivider, isDark && styles.settingsRowDividerDark]} />

              <TouchableOpacity
                style={styles.generalSettingsRow}
                onPress={() => setIsMapAppPickerVisible((prev) => !prev)}
                activeOpacity={0.72}
              >
                <View style={styles.generalSettingsRowLabel}>
                  <Ionicons name="map-outline" size={20} color={isSpotzTheme ? SPOTZ_THEME.text : isDark ? '#ffffff' : '#1f2937'} />
                  <Text style={[styles.generalSettingsLabel, isDark && styles.textLight]}>
                    Default Map App
                  </Text>
                </View>
                <Text style={[styles.generalSettingsValue, isDark && styles.textMuted]}>
                  {settings.defaultMapApp === 'apple' ? 'Apple Maps' : 'Google Maps'}
                </Text>
              </TouchableOpacity>
              {isMapAppPickerVisible && (
                <View style={[styles.inlineSettingsPicker, isDark && styles.inlineSettingsPickerDark, isSpotzTheme && styles.inlineSettingsPickerSpotz]}>
                  {[
                    { label: 'Apple Maps', value: 'apple' as const },
                    { label: 'Google Maps', value: 'google' as const },
                  ].map((mapApp) => (
                    <TouchableOpacity
                      key={mapApp.value}
                      style={styles.inlinePickerOption}
                      onPress={() => {
                        updateSettings({ defaultMapApp: mapApp.value });
                        setIsMapAppPickerVisible(false);
                      }}
                      activeOpacity={0.72}
                    >
                      <Text style={[styles.inlinePickerText, isDark && styles.textLight]}>
                        {mapApp.label}
                      </Text>
                      {settings.defaultMapApp === mapApp.value && (
                        <Ionicons name="checkmark" size={18} color={SPOTZ_BRAND.accent} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={[styles.settingsRowDivider, isDark && styles.settingsRowDividerDark]} />

              <View style={styles.generalSettingsRow}>
                <View style={styles.generalSettingsRowLabel}>
                  <Ionicons name="notifications-outline" size={20} color={isSpotzTheme ? SPOTZ_THEME.text : isDark ? '#ffffff' : '#1f2937'} />
                  <Text style={[styles.generalSettingsLabel, isDark && styles.textLight]}>
                    Notifications
                  </Text>
                </View>
                <View style={styles.generalSettingsRowValue}>
                  <SpotzSwitch
                    value={settings.notificationsEnabled}
                    onValueChange={(notificationsEnabled) => updateSettings({ notificationsEnabled })}
                  />
                </View>
              </View>

              <View style={[styles.settingsRowDivider, isDark && styles.settingsRowDividerDark]} />

              <TouchableOpacity
                style={styles.generalSettingsRow}
                onPress={handleDeleteAllSpotsPress}
                activeOpacity={0.72}
              >
                <View style={styles.generalSettingsRowLabel}>
                  <Ionicons name="trash-outline" size={20} color="#ff3b30" />
                  <Text style={[styles.generalSettingsLabel, styles.resetAppText]}>
                    Delete All Spots
                  </Text>
                </View>
              </TouchableOpacity>
              </View>
            ) : activeSettingsSheet === 'theme' ? (
              <View style={[styles.settingsList, isDark && styles.settingsListDark, isSpotzTheme && styles.settingsListSpotz]}>
                {THEME_OPTIONS.map((option, index) => {
                  const isSelectedTheme = settings.themePreference === option.value;

                  return (
                    <React.Fragment key={option.value}>
                      <TouchableOpacity
                        style={styles.themeSettingsRow}
                        onPress={() => updateSettings({ themePreference: option.value })}
                        activeOpacity={0.72}
                      >
                        <View style={styles.themeSettingsRowLabel}>
                          <View
                            style={[
                              styles.themeRadio,
                              isSelectedTheme && styles.themeRadioSelected,
                            ]}
                          >
                            {isSelectedTheme && (
                              <View style={styles.themeRadioDot} />
                            )}
                          </View>
                          <Ionicons
                            name={option.icon}
                            size={20}
                            color={option.value === 'spotz' ? SPOTZ_BRAND.accent : isSpotzTheme ? SPOTZ_THEME.text : isDark ? '#ffffff' : '#1f2937'}
                          />
                          <View style={styles.themeSettingsTextGroup}>
                            <Text style={[styles.generalSettingsLabel, isDark && styles.textLight]}>
                              {option.label}
                            </Text>
                            <Text style={[styles.themeSettingsDescription, isDark && styles.textMuted]}>
                              {option.description}
                            </Text>
                          </View>
                        </View>
                        {isSelectedTheme && (
                          <Ionicons name="checkmark" size={20} color={SPOTZ_BRAND.accent} />
                        )}
                      </TouchableOpacity>
                      {index < THEME_OPTIONS.length - 1 && (
                        <View style={[styles.settingsRowDivider, isDark && styles.settingsRowDividerDark]} />
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
            ) : activeSettingsSheet === 'legal' ? (
              <View style={[styles.settingsList, isDark && styles.settingsListDark, isSpotzTheme && styles.settingsListSpotz]}>
                {LEGAL_PAGE_SUMMARIES.map((item, index) => (
                  <React.Fragment key={item.slug}>
                    <TouchableOpacity
                      style={styles.legalSettingsRow}
                      onPress={() => handleLegalItemPress(item.slug)}
                      activeOpacity={0.72}
                    >
                      <View style={styles.legalSettingsRowLabel}>
                        <Ionicons name={item.icon} size={20} color={isSpotzTheme ? SPOTZ_THEME.text : isDark ? '#ffffff' : '#1f2937'} />
                        <View style={styles.legalSettingsTextGroup}>
                          <Text style={[styles.generalSettingsLabel, isDark && styles.textLight]}>
                            {item.title}
                          </Text>
                          <Text style={[styles.legalSettingsDescription, isDark && styles.textMuted]}>
                            {item.description}
                          </Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={isDark ? '#8e8e93' : '#9ca3af'} />
                    </TouchableOpacity>
                    {index < LEGAL_PAGE_SUMMARIES.length - 1 && (
                      <View style={[styles.settingsRowDivider, isDark && styles.settingsRowDividerDark]} />
                    )}
                  </React.Fragment>
                ))}
                <View style={[styles.settingsRowDivider, isDark && styles.settingsRowDividerDark]} />
                <TouchableOpacity
                  style={styles.legalSettingsRow}
                  onPress={openDeleteAccountModal}
                  activeOpacity={0.72}
                >
                  <View style={styles.legalSettingsRowLabel}>
                    <Ionicons name="person-remove-outline" size={20} color="#ff3b30" />
                    <View style={styles.legalSettingsTextGroup}>
                      <Text style={[styles.generalSettingsLabel, styles.resetAppText]}>
                        Delete Account
                      </Text>
                      <Text style={[styles.legalSettingsDescription, isDark && styles.textMuted]}>
                        Permanently remove your account and anonymize your activity.
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#ff3b30" />
                </TouchableOpacity>
              </View>
            ) : activeSettingsSheet === 'privacy' ? (
              <View style={[styles.settingsList, isDark && styles.settingsListDark, isSpotzTheme && styles.settingsListSpotz]}>
                <View style={styles.locationAccessRow}>
                  <View style={styles.locationAccessLeft}>
                    <Ionicons
                      name="location-outline"
                      size={20}
                      color={isSpotzTheme ? SPOTZ_THEME.text : isDark ? '#ffffff' : '#1f2937'}
                      style={styles.locationAccessIcon}
                    />
                    <View style={styles.locationAccessTextGroup}>
                      <View style={styles.locationAccessTitleRow}>
                        <Text style={[styles.generalSettingsLabel, isDark && styles.textLight]}>
                          Location Access
                        </Text>
                        <Text style={[styles.locationAccessStatus, isDark && styles.textMuted]}>
                          {locationAccessStatusLabel}
                        </Text>
                      </View>
                      <Text style={[styles.locationAccessDescription, isDark && styles.textMuted]}>
                        Used for map centering, Nearby sorting, and distance labels.
                      </Text>
                    </View>
                  </View>
                  <View style={styles.locationAccessSwitchSlot}>
                    <SpotzSwitch
                      value={isLocationAccessEnabled}
                      onValueChange={handleLocationAccessToggle}
                      disabled={isLocationLoading}
                    />
                  </View>
                </View>
                {isLocationAccessEnabled && permissionStatus === 'denied' && (
                  <View style={[styles.locationPermissionNotice, isDark && styles.locationPermissionNoticeDark, isSpotzTheme && styles.locationPermissionNoticeSpotz]}>
                    <Text style={[styles.locationPermissionText, isDark && styles.textMuted]}>
                      Location permission is disabled in system settings.
                    </Text>
                    <TouchableOpacity
                      style={styles.locationSettingsButton}
                      onPress={handleOpenLocationSettings}
                      activeOpacity={0.72}
                    >
                      <Text style={styles.locationSettingsButtonText}>Open Settings</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={[styles.settingsRowDivider, isDark && styles.settingsRowDividerDark]} />

                <View style={styles.generalSettingsRow}>
                  <View style={styles.generalSettingsRowLabel}>
                    <Ionicons name="image-outline" size={20} color={isSpotzTheme ? SPOTZ_THEME.text : isDark ? '#ffffff' : '#1f2937'} />
                    <Text style={[styles.generalSettingsLabel, isDark && styles.textLight]}>
                      Show profile picture to others
                    </Text>
                  </View>
                  <View style={styles.generalSettingsRowValue}>
                    <SpotzSwitch
                      value={settings.showProfileImageInComments}
                      onValueChange={(showProfileImageInComments) =>
                        updateSettings({ showProfileImageInComments })
                      }
                    />
                  </View>
                </View>
              </View>
            ) : (
              <View style={[styles.settingsList, styles.placeholderSettingsList, isDark && styles.settingsListDark, isSpotzTheme && styles.settingsListSpotz]} />
            )}
            </Pressable>
          </Animated.View>
          </Pressable>
        </View>
      </Modal>

      <Modal
        visible={isDeleteAccountModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeDeleteAccountModal}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={[styles.deleteAccountModal, isDark && styles.editModalDark]}>
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  onPress={closeDeleteAccountModal}
                  style={styles.modalHeaderButton}
                  disabled={isDeletingAccount}
                >
                  <Text style={[styles.modalCancelText, isDark && styles.textMuted]}>Cancel</Text>
                </TouchableOpacity>
                <Text style={[styles.modalTitle, isDark && styles.textLight]}>Delete Account</Text>
                <View style={styles.modalHeaderButton} />
              </View>

              <Text style={[styles.deleteAccountTitle, isDark && styles.textLight]}>
                This cannot be undone.
              </Text>
              <Text style={[styles.deleteAccountBody, isDark && styles.textMuted]}>
                We will delete your Firebase account, profile, username reservation, saved favorites,
                and profile image reference. Your uploaded spots, comments, and replies will be shown
                as Deleted user so other community content is not removed.
              </Text>
              <TouchableOpacity
                style={styles.deleteAccountInfoLink}
                onPress={openAccountDeletionInfo}
                activeOpacity={0.72}
                disabled={isDeletingAccount}
                accessibilityRole="link"
              >
                <Text style={styles.deleteAccountInfoLinkText}>Account Deletion Information</Text>
              </TouchableOpacity>
              <Text style={[styles.deleteAccountBody, isDark && styles.textMuted]}>
                Type DELETE to confirm.
              </Text>

              <TextInput
                style={[styles.editInput, styles.deleteAccountInput, isDark && styles.editInputDark]}
                value={deleteAccountConfirmation}
                onChangeText={(text) => {
                  setDeleteAccountConfirmation(text);
                  setDeleteAccountError('');
                }}
                placeholder="DELETE"
                placeholderTextColor={isDark ? '#666' : '#999'}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!isDeletingAccount}
                returnKeyType="done"
                onSubmitEditing={handleDeleteAccountConfirm}
              />

              {!!deleteAccountError && (
                <Text style={styles.profileErrorText}>
                  {deleteAccountError}
                </Text>
              )}

              <TouchableOpacity
                style={[
                  styles.deleteAccountButton,
                  (!canConfirmAccountDeletion || isDeletingAccount) && styles.deleteAccountButtonDisabled,
                ]}
                onPress={handleDeleteAccountConfirm}
                activeOpacity={0.78}
                disabled={!canConfirmAccountDeletion || isDeletingAccount}
              >
                <Text style={styles.deleteAccountButtonText}>
                  {isDeletingAccount ? 'Deleting...' : 'Delete Account'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000000',
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f1f2',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    backgroundColor: '#ff3b30',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  notificationBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  settingsButtonDark: {
    backgroundColor: '#2a2a2a',
  },
  settingsButtonSpotz: {
    backgroundColor: SPOTZ_THEME.panelElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SPOTZ_THEME.border,
  },
  textLight: {
    color: '#ffffff',
  },
  textMuted: {
    color: '#888888',
  },
  profileCard: {
    marginHorizontal: 20,
    backgroundColor: '#f7f7f8',
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  profileCardIOS: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
  },
  profileCardDark: {
    backgroundColor: '#202124',
  },
  profileCardSpotz: {
    backgroundColor: SPOTZ_THEME.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SPOTZ_THEME.border,
  },
  avatarContainer: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: SPOTZ_BRAND.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.32)',
  },
  avatarContainerDark: {
    backgroundColor: 'rgba(139, 158, 139, 0.16)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 46,
  },
  avatarPlaceholderLogo: {
    width: 60,
    height: 68,
  },
  avatarText: {
    fontSize: 34,
    fontWeight: '700',
    color: '#ffffff',
  },
  username: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 3,
  },
  userHandle: {
    fontSize: 13,
    color: '#9b9b9f',
    marginBottom: 10,
  },
  founderBadge: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 14,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: 'rgba(139, 158, 139, 0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(139, 158, 139, 0.28)',
  },
  founderBadgeDark: {
    backgroundColor: 'rgba(139, 158, 139, 0.16)',
    borderColor: 'rgba(139, 158, 139, 0.34)',
  },
  founderBadgeSpotz: {
    backgroundColor: SPOTZ_THEME.accentSurface,
    borderColor: SPOTZ_THEME.border,
  },
  founderBadgeText: {
    color: SPOTZ_BRAND.accent,
    fontSize: 12,
    fontWeight: '900',
  },
  userBio: {
    fontSize: 13,
    lineHeight: 19,
    color: '#666666',
    marginBottom: 20,
    textAlign: 'center',
    opacity: 0.82,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#ececee',
    marginBottom: 24,
  },
  editProfileButtonDark: {
    backgroundColor: '#2f3033',
  },
  editProfileButtonSpotz: {
    backgroundColor: SPOTZ_THEME.accentSurface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SPOTZ_THEME.border,
  },
  editProfileButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  statItem: {
    alignItems: 'center',
    minWidth: 96,
    paddingHorizontal: 24,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#000000',
  },
  statLabel: {
    fontSize: 11,
    color: '#666666',
    marginTop: 5,
    opacity: 0.72,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(150, 150, 150, 0.2)',
  },
  listContent: {},
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  showAllButton: {
    paddingVertical: 6,
    paddingLeft: 12,
  },
  showAllText: {
    color: SPOTZ_BRAND.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  spotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  spotGridItem: {
    width: CARD_WIDTH,
    marginBottom: 12,
  },
  spotCard: {
    width: '100%',
    height: 196,
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
  spotImage: {
    width: '100%',
    height: 92,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  spotInfo: {
    height: 104,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    justifyContent: 'flex-start',
  },
  spotTitle: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
    color: '#000000',
    height: 30,
    marginBottom: 3,
  },
  privateBadgeSlot: {
    height: 17,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    marginBottom: 3,
  },
  privateBadge: {
    alignSelf: 'flex-start',
    minHeight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(139, 158, 139, 0.14)',
    paddingHorizontal: 6,
    marginLeft: 0,
  },
  privateBadgeDark: {
    backgroundColor: 'rgba(139, 158, 139, 0.18)',
  },
  privateBadgeText: {
    color: SPOTZ_BRAND.accent,
    fontSize: 9,
    fontWeight: '800',
  },
  spotCategory: {
    flexShrink: 1,
    fontSize: 10,
    lineHeight: 13,
    color: '#4f5560',
  },
  spotCategoryIcon: {
    marginRight: 4,
  },
  spotCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 13,
    marginBottom: 3,
  },
  spotLocation: {
    fontSize: 10,
    lineHeight: 13,
    color: '#4f5560',
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
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  editModal: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 34,
  },
  editModalDark: {
    backgroundColor: '#1f1f1f',
  },
  deleteAccountModal: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalHeaderButton: {
    width: 72,
    minHeight: 36,
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
  },
  modalCancelText: {
    fontSize: 15,
    color: '#666666',
  },
  modalSaveText: {
    color: SPOTZ_BRAND.accent,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
  },
  modalSaveTextDisabled: {
    color: '#9ca3af',
  },
  editAvatarSection: {
    alignItems: 'center',
    marginBottom: 22,
  },
  editAvatarContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: SPOTZ_BRAND.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 10,
  },
  changePhotoText: {
    color: SPOTZ_BRAND.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  editInputGroup: {
    marginBottom: 18,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  editInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#000000',
  },
  editInputDark: {
    backgroundColor: '#2a2a2a',
    color: '#ffffff',
  },
  bioInput: {
    height: 96,
  },
  inputMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  inputHint: {
    fontSize: 12,
    color: '#666666',
  },
  characterCounter: {
    alignSelf: 'flex-end',
    marginTop: 6,
    fontSize: 12,
    color: '#666666',
    opacity: 0.75,
  },
  profileErrorText: {
    marginTop: 6,
    color: '#ff3b30',
    fontSize: 12,
    fontWeight: '500',
  },
  deleteAccountTitle: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },
  deleteAccountBody: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  deleteAccountInfoLink: {
    alignSelf: 'flex-start',
    minHeight: 32,
    justifyContent: 'center',
    marginBottom: 10,
  },
  deleteAccountInfoLinkText: {
    color: SPOTZ_BRAND.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  deleteAccountInput: {
    marginTop: 4,
    fontWeight: '800',
    letterSpacing: 0,
  },
  deleteAccountButton: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff3b30',
    marginTop: 16,
  },
  deleteAccountButtonDisabled: {
    opacity: 0.46,
  },
  deleteAccountButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  settingsPopoverBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  settingsPopover: {
    position: 'absolute',
    top: 94,
    right: 20,
    width: 188,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 8,
  },
  settingsPopoverDark: {
    backgroundColor: '#202124',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  settingsPopoverSpotz: {
    backgroundColor: SPOTZ_THEME.panel,
    borderColor: SPOTZ_THEME.border,
  },
  settingsMenuItem: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
  },
  settingsMenuText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  settingsMenuDestructive: {
    color: '#ff3b30',
  },
  settingsMenuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    marginVertical: 6,
  },
  settingsMenuDividerDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  generalSettingsBackdrop: {
    flex: 1,
  },
  generalSettingsBackdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  generalSettingsDismissArea: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  generalSettingsPanel: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 34,
  },
  generalSettingsPanelDark: {
    backgroundColor: '#1f1f1f',
  },
  generalSettingsPanelSpotz: {
    backgroundColor: SPOTZ_THEME.backgroundAlt,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: SPOTZ_THEME.border,
  },
  generalSettingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  settingsTitleGroup: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generalSettingsHeaderButton: {
    width: 72,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(243, 244, 246, 0.88)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(17, 24, 39, 0.08)',
  },
  settingsCloseButtonDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  settingsCloseButtonSpotz: {
    backgroundColor: SPOTZ_THEME.panelElevated,
    borderColor: SPOTZ_THEME.border,
  },
  settingsList: {
    backgroundColor: '#f7f7f8',
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingsListDark: {
    backgroundColor: '#2a2a2a',
  },
  settingsListSpotz: {
    backgroundColor: SPOTZ_THEME.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SPOTZ_THEME.border,
  },
  placeholderSettingsList: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  placeholderSettingsText: {
    color: '#666666',
    fontSize: 14,
    textAlign: 'center',
  },
  generalSettingsRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: 16,
  },
  generalSettingsRowLabel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: '100%',
  },
  generalSettingsRowValue: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationAccessRow: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  locationAccessLeft: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  locationAccessIcon: {
    marginTop: 1,
  },
  locationAccessTextGroup: {
    flex: 1,
  },
  locationAccessTitleRow: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationAccessStatus: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '600',
  },
  locationAccessDescription: {
    color: '#666666',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  locationAccessSwitchSlot: {
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationPermissionNotice: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  locationPermissionNoticeDark: {
    backgroundColor: '#333333',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  locationPermissionNoticeSpotz: {
    backgroundColor: SPOTZ_THEME.panelElevated,
    borderColor: SPOTZ_THEME.border,
  },
  locationPermissionText: {
    color: '#666666',
    fontSize: 12,
    lineHeight: 17,
  },
  locationSettingsButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingVertical: 6,
  },
  locationSettingsButtonText: {
    color: SPOTZ_BRAND.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  themeSettingsRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  themeSettingsRowLabel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  themeSettingsTextGroup: {
    flex: 1,
  },
  themeSettingsDescription: {
    color: '#666666',
    fontSize: 12,
    marginTop: 3,
  },
  legalSettingsRow: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  legalSettingsRowLabel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  legalSettingsTextGroup: {
    flex: 1,
  },
  legalSettingsDescription: {
    color: '#666666',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  themeRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#9ca3af',
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeRadioSelected: {
    borderColor: SPOTZ_BRAND.accent,
  },
  themeRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: SPOTZ_BRAND.accent,
  },
  generalSettingsLabel: {
    flexShrink: 1,
    color: '#000000',
    fontSize: 15,
    fontWeight: '600',
  },
  generalSettingsValue: {
    color: '#666666',
    fontSize: 13,
  },
  settingsRowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    marginLeft: 48,
  },
  settingsRowDividerDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  inlineSettingsPicker: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    overflow: 'hidden',
  },
  inlineSettingsPickerDark: {
    backgroundColor: '#333333',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  inlineSettingsPickerSpotz: {
    backgroundColor: SPOTZ_THEME.panelElevated,
    borderColor: SPOTZ_THEME.border,
  },
  inlinePickerOption: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  inlinePickerText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },
  inlinePickerHint: {
    color: '#666666',
    fontSize: 12,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  resetAppText: {
    color: '#ff3b30',
  },
});
