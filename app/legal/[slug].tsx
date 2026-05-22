import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SPOTZ_BRAND, SPOTZ_THEME } from '../../src/constants/brand';
import { getLegalPage, LEGAL_PUBLIC_URLS } from '../../src/data/legalPages';
import { useAppColorScheme, useIsSpotzTheme } from '../../src/hooks/useAppColorScheme';

export default function LegalPageScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const colorScheme = useAppColorScheme();
  const isSpotzTheme = useIsSpotzTheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const page = getLegalPage(slug);
  const onlineVersionUrl = LEGAL_PUBLIC_URLS[page.slug];

  const handleOnlineVersionPress = () => {
    Linking.openURL(onlineVersionUrl).catch((error) => {
      console.error('Failed to open legal online version', error);
    });
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark, isSpotzTheme && styles.containerSpotz]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={[
          styles.header,
          isDark && styles.headerDark,
          isSpotzTheme && styles.headerSpotz,
          { paddingTop: insets.top + (Platform.OS === 'android' ? 6 : 0) },
        ]}
      >
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
          activeOpacity={0.72}
          accessibilityRole="button"
          accessibilityLabel="Close legal page"
        >
          <View style={[styles.headerCloseButton, isDark && styles.headerCloseButtonDark, isSpotzTheme && styles.headerCloseButtonSpotz]}>
            <Ionicons name="close" size={19} color={isDark ? '#ffffff' : '#111827'} />
          </View>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDark && styles.textLight]} numberOfLines={1}>
          {page.title}
        </Text>
        <View style={styles.headerButton} />
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 36 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, isDark && styles.textLight]}>{page.title}</Text>
        <Text style={[styles.updatedLabel, isDark && styles.textMuted]}>{page.updatedLabel}</Text>
        <TouchableOpacity
          style={[
            styles.onlineVersionCard,
            isDark && styles.onlineVersionCardDark,
            isSpotzTheme && styles.onlineVersionCardSpotz,
          ]}
          onPress={handleOnlineVersionPress}
          activeOpacity={0.74}
          accessibilityRole="link"
          accessibilityLabel={`Open online version of ${page.title}`}
        >
          <View style={styles.onlineVersionIcon}>
            <Ionicons name="open-outline" size={17} color={SPOTZ_BRAND.accent} />
          </View>
          <View style={styles.onlineVersionTextGroup}>
            <Text style={[styles.onlineVersionLabel, isDark && styles.textLight]}>
              Online version
            </Text>
            <Text style={styles.onlineVersionUrl} numberOfLines={1}>
              {onlineVersionUrl}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={isDark ? '#8e8e93' : '#9ca3af'} />
        </TouchableOpacity>
        <Text style={[styles.intro, isDark && styles.textMuted]}>{page.intro}</Text>

        <View style={[styles.sectionList, isDark && styles.sectionListDark, isSpotzTheme && styles.sectionListSpotz]}>
          {page.sections.map((section, sectionIndex) => (
            <View key={section.heading}>
              <View style={styles.section}>
                <Text style={[styles.sectionHeading, isDark && styles.textLight]}>
                  {section.heading}
                </Text>
                {section.body.map((paragraph) => (
                  <Text key={paragraph} style={[styles.paragraph, isDark && styles.textMuted]}>
                    {paragraph}
                  </Text>
                ))}
              </View>
              {sectionIndex < page.sections.length - 1 && (
                <View style={[styles.divider, isDark && styles.dividerDark]} />
              )}
            </View>
          ))}
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
    backgroundColor: SPOTZ_BRAND.charcoal,
  },
  containerSpotz: {
    backgroundColor: SPOTZ_THEME.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 8,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
  },
  headerDark: {
    backgroundColor: SPOTZ_BRAND.charcoal,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerSpotz: {
    backgroundColor: SPOTZ_THEME.background,
    borderBottomColor: SPOTZ_THEME.border,
  },
  headerButton: {
    width: 56,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(243, 244, 246, 0.88)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(17, 24, 39, 0.08)',
  },
  headerCloseButtonDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  headerCloseButtonSpotz: {
    backgroundColor: SPOTZ_THEME.panelElevated,
    borderColor: SPOTZ_THEME.border,
  },
  headerTitle: {
    flex: 1,
    color: '#000000',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  title: {
    color: '#000000',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0,
  },
  updatedLabel: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  intro: {
    color: '#666666',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 16,
  },
  onlineVersionCard: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#f7f7f8',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  onlineVersionCardDark: {
    backgroundColor: '#2a2a2a',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  onlineVersionCardSpotz: {
    backgroundColor: SPOTZ_THEME.panel,
    borderColor: SPOTZ_THEME.border,
  },
  onlineVersionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139, 158, 139, 0.14)',
  },
  onlineVersionTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  onlineVersionLabel: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
  onlineVersionUrl: {
    color: SPOTZ_BRAND.accent,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionList: {
    backgroundColor: '#f7f7f8',
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 22,
  },
  sectionListDark: {
    backgroundColor: '#2a2a2a',
  },
  sectionListSpotz: {
    backgroundColor: SPOTZ_THEME.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SPOTZ_THEME.border,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionHeading: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  paragraph: {
    color: '#666666',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    marginLeft: 16,
  },
  dividerDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  textLight: {
    color: '#ffffff',
  },
  textMuted: {
    color: '#a1a1aa',
  },
});
