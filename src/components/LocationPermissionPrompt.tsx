import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPOTZ_BRAND } from '../constants/brand';
import { useLocationPermission } from '../context/LocationPermissionContext';

export function LocationPermissionPrompt() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const {
    shouldShowLocationPrompt,
    isLocationLoading,
    requestLocationPermission,
    dismissLocationPrompt,
  } = useLocationPermission();

  if (!shouldShowLocationPrompt) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.card, isDark && styles.cardDark, { marginBottom: Math.max(insets.bottom, 18) }]}>
          <View style={[styles.iconShell, isDark && styles.iconShellDark]}>
            <Ionicons name="location-outline" size={30} color={isDark ? SPOTZ_BRAND.accent : '#111827'} />
          </View>
          <Text style={[styles.title, isDark && styles.textLight]}>Allow SPOTZ to use your location?</Text>
          <Text style={[styles.body, isDark && styles.textMuted]}>
            SPOTZ uses your location to center the map, show nearby photo spots, calculate distances,
            and power location-based suggestions.
          </Text>
          <Text style={[styles.body, styles.secondaryBody, isDark && styles.textMuted]}>
            {"If you choose Don't Allow, the map will not center on your location, Nearby spots may not work, and location-based suggestions may be unavailable. You can enable this later in Settings -> Privacy."}
          </Text>

          <TouchableOpacity
            style={[styles.allowButton, isLocationLoading && styles.disabledButton]}
            onPress={requestLocationPermission}
            disabled={isLocationLoading}
            activeOpacity={0.84}
            accessibilityRole="button"
          >
            {isLocationLoading ? (
              <ActivityIndicator color="#071018" />
            ) : (
              <Text style={styles.allowButtonText}>Allow</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.notNowButton}
            onPress={dismissLocationPrompt}
            disabled={isLocationLoading}
            activeOpacity={0.72}
            accessibilityRole="button"
          >
            <Text style={[styles.notNowText, isDark && styles.textMuted]}>{"Don't Allow"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  card: {
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
    backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  cardDark: {
    backgroundColor: SPOTZ_BRAND.charcoalElevated,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  iconShell: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: '#f2f5f9',
    marginBottom: 16,
  },
  iconShellDark: {
    backgroundColor: '#1d2632',
  },
  title: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    color: '#5f6876',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  secondaryBody: {
    marginTop: 0,
    marginBottom: 22,
  },
  textLight: {
    color: '#f8fafc',
  },
  textMuted: {
    color: '#a1aab6',
  },
  allowButton: {
    minHeight: 54,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SPOTZ_BRAND.accent,
  },
  disabledButton: {
    opacity: 0.68,
  },
  allowButtonText: {
    color: '#071018',
    fontSize: 17,
    fontWeight: '800',
  },
  notNowButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  notNowText: {
    color: '#596273',
    fontSize: 15,
    fontWeight: '700',
  },
});
