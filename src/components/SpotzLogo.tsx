import React from 'react';
import { Image, ImageStyle, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SPOTZ_BRAND, SPOTZ_PIN_LOGO_SOURCE, SPOTZ_WORDMARK_LOGO_SOURCE } from '../constants/brand';

export const SPOTZ_LOGO_SOURCE = SPOTZ_WORDMARK_LOGO_SOURCE;

type SpotzLogoProps = {
  compact?: boolean;
  showSubtext?: boolean;
  variant?: 'wordmark' | 'pin';
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
};

export function SpotzLogo({
  compact = false,
  showSubtext = true,
  variant = 'wordmark',
  style,
  imageStyle,
}: SpotzLogoProps) {
  const isPin = variant === 'pin';

  return (
    <View style={[styles.logoWrap, compact && styles.logoWrapCompact, isPin && styles.pinLogoWrap, style]}>
      <Image
        source={isPin ? SPOTZ_PIN_LOGO_SOURCE : SPOTZ_WORDMARK_LOGO_SOURCE}
        style={[
          isPin ? styles.pinLogoImage : styles.logoImage,
          compact && (isPin ? styles.pinLogoImageCompact : styles.logoImageCompact),
          imageStyle,
        ]}
        resizeMode="contain"
      />
      {!compact && showSubtext && !isPin && (
        <Text style={styles.logoSubtext}>Discover photo spots{'\n'}around the world</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  logoWrap: {
    alignItems: 'center',
    marginBottom: 18,
  },
  logoWrapCompact: {
    marginTop: 6,
    marginBottom: 10,
  },
  logoImage: {
    width: 266,
    height: 92,
  },
  logoImageCompact: {
    width: 178,
    height: 62,
  },
  pinLogoWrap: {
    marginBottom: 12,
  },
  pinLogoImage: {
    width: 118,
    height: 132,
  },
  pinLogoImageCompact: {
    width: 56,
    height: 64,
  },
  logoSubtext: {
    marginTop: 10,
    color: SPOTZ_BRAND.mutedText,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
