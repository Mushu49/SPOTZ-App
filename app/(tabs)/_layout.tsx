import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { SPOTZ_BRAND, SPOTZ_THEME } from '../../src/constants/brand';
import { useAppColorScheme, useIsSpotzTheme } from '../../src/hooks/useAppColorScheme';

type TabIconName = 'map.fill' | 'plus.circle.fill' | 'sparkles' | 'person.fill';
const TAB_BAR_BOTTOM_OFFSET = 8;
const TAB_BAR_SIDE_INSET = 20;

function GlassTabIcon({
  focused,
  name,
  color,
  isDark,
  isSpotzTheme,
}: {
  focused: boolean;
  name: TabIconName;
  color: string;
  isDark: boolean;
  isSpotzTheme: boolean;
}) {
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 90,
    }).start();
  }, [focused, progress]);

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1.08],
  });
  const indicatorOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Animated.View style={[styles.iconShell, { transform: [{ scale }] }]}>
      <Animated.View
        style={[
          styles.activeIndicator,
          {
            opacity: indicatorOpacity,
            backgroundColor: isSpotzTheme
              ? SPOTZ_THEME.accentSurfaceStrong
              : isDark ? SPOTZ_BRAND.accentSoft : 'rgba(139, 158, 139, 0.20)',
          },
        ]}
      />
      <IconSymbol size={focused ? 27 : 25} name={name} color={color} />
    </Animated.View>
  );
}

function GlassTabBar({
  state,
  descriptors,
  navigation,
  activeColor,
  inactiveColor,
  isDark,
  isSpotzTheme,
  bottom,
}: BottomTabBarProps & {
  activeColor: string;
  inactiveColor: string;
  isDark: boolean;
  isSpotzTheme: boolean;
  bottom: number;
}) {
  const focusedOptions = descriptors[state.routes[state.index].key]?.options;
  const focusedTabBarStyle = StyleSheet.flatten(focusedOptions?.tabBarStyle) as
    | { display?: string }
    | undefined;

  if (focusedTabBarStyle?.display === 'none') {
    return null;
  }

  return (
    <View
      style={[
        styles.tabBarFrame,
        {
          bottom,
          shadowColor: isDark ? '#000000' : '#64748b',
          shadowOpacity: isDark ? 0.42 : 0.24,
        },
      ]}
    >
      <View style={[styles.glassBackground, isDark ? styles.glassBackgroundDark : styles.glassBackgroundLight, isSpotzTheme && styles.glassBackgroundSpotz]}>
        <View style={[styles.frostedTint, isDark ? styles.frostedTintDark : styles.frostedTintLight, isSpotzTheme && styles.frostedTintSpotz]} />
        <View style={[styles.topHighlight, isDark ? styles.topHighlightDark : styles.topHighlightLight]} />
        <View style={styles.tabContent}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const focused = state.index === index;
            const color = focused ? activeColor : inactiveColor;
            const label =
              typeof options.tabBarLabel === 'string'
                ? options.tabBarLabel
                : options.title ?? route.name;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarButtonTestID}
                onPress={onPress}
                onLongPress={onLongPress}
                onPressIn={() => {
                  if (process.env.EXPO_OS === 'ios') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                }}
                style={styles.tabItem}
              >
                {options.tabBarIcon?.({ focused, color, size: focused ? 27 : 25 })}
                <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useAppColorScheme();
  const isSpotzTheme = useIsSpotzTheme();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const activeColor = SPOTZ_BRAND.accent;
  const inactiveColor = isSpotzTheme ? SPOTZ_THEME.mutedText : isDark ? 'rgba(255, 255, 255, 0.50)' : 'rgba(17, 24, 39, 0.42)';

  return (
    <Tabs
      tabBar={(props) => (
        <GlassTabBar
          {...props}
          activeColor={activeColor}
          inactiveColor={inactiveColor}
          isDark={isDark}
          isSpotzTheme={isSpotzTheme}
          bottom={insets.bottom + TAB_BAR_BOTTOM_OFFSET}
        />
      )}
      screenOptions={{
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, focused }) => (
            <GlassTabIcon focused={focused} name="map.fill" color={color} isDark={isDark} isSpotzTheme={isSpotzTheme} />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Add Spot',
          tabBarIcon: ({ color, focused }) => (
            <GlassTabIcon focused={focused} name="plus.circle.fill" color={color} isDark={isDark} isSpotzTheme={isSpotzTheme} />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, focused }) => (
            <GlassTabIcon focused={focused} name="sparkles" color={color} isDark={isDark} isSpotzTheme={isSpotzTheme} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <GlassTabIcon focused={focused} name="person.fill" color={color} isDark={isDark} isSpotzTheme={isSpotzTheme} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarFrame: {
    position: 'absolute',
    left: TAB_BAR_SIDE_INSET,
    right: TAB_BAR_SIDE_INSET,
    height: 72,
    borderRadius: 28,
    overflow: 'visible',
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 30,
    elevation: 24,
  },
  glassBackground: {
    flex: 1,
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
  },
  glassBackgroundLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderColor: 'rgba(255, 255, 255, 0.92)',
  },
  glassBackgroundDark: {
    backgroundColor: 'rgba(18, 18, 20, 0.88)',
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  glassBackgroundSpotz: {
    backgroundColor: 'rgba(26, 36, 25, 0.92)',
    borderColor: SPOTZ_THEME.borderStrong,
  },
  frostedTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  frostedTintLight: {
    backgroundColor: 'rgba(241, 245, 249, 0.20)',
  },
  frostedTintDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  frostedTintSpotz: {
    backgroundColor: 'rgba(139, 158, 139, 0.08)',
  },
  topHighlight: {
    position: 'absolute',
    top: 1,
    left: 24,
    right: 24,
    height: 1,
    borderRadius: 1,
  },
  topHighlightLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  topHighlightDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.26)',
  },
  tabContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 12 : 10,
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: -2,
  },
  iconShell: {
    width: 48,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  activeIndicator: {
    position: 'absolute',
    width: 46,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
});
