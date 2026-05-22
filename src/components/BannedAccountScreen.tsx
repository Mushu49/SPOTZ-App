import React from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SPOTZ_BRAND, SPOTZ_PIN_LOGO_SOURCE } from '../constants/brand';
import type { AccountBanStatus } from '../context/AuthContext';

type BannedAccountScreenProps = {
  accountBan: AccountBanStatus;
  isLoggingOut?: boolean;
  onLogout: () => void;
};

export function BannedAccountScreen({
  accountBan,
  isLoggingOut = false,
  onLogout,
}: BannedAccountScreenProps) {
  const reason = accountBan.banReason?.trim();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image source={SPOTZ_PIN_LOGO_SOURCE} style={styles.logo} resizeMode="contain" />
        <View style={styles.iconShell}>
          <Ionicons name="lock-closed-outline" size={30} color={SPOTZ_BRAND.accent} />
        </View>
        <Text style={styles.title}>Account access restricted</Text>
        <Text style={styles.message}>
          This account has been banned from using SPOTZ.
        </Text>
        {!!reason && (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>Reason</Text>
            <Text style={styles.reasonText}>{reason}</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={onLogout}
          disabled={isLoggingOut}
          activeOpacity={0.78}
          accessibilityRole="button"
          accessibilityLabel="Log out"
        >
          {isLoggingOut ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.logoutButtonText}>Log Out</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: SPOTZ_BRAND.charcoal,
    padding: 24,
  },
  content: {
    alignItems: 'center',
  },
  logo: {
    width: 76,
    height: 86,
    marginBottom: 22,
  },
  iconShell: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 29,
    backgroundColor: 'rgba(139, 158, 139, 0.16)',
    marginBottom: 18,
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    color: 'rgba(255, 255, 255, 0.76)',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
  },
  reasonBox: {
    alignSelf: 'stretch',
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    padding: 14,
    marginTop: 20,
  },
  reasonLabel: {
    color: SPOTZ_BRAND.accent,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  reasonText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
  },
  logoutButton: {
    minWidth: 150,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: SPOTZ_BRAND.accent,
    paddingHorizontal: 24,
    marginTop: 28,
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
