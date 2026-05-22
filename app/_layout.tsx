import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import '../src/utils/suppressExpoGoNotificationWarnings';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { SpotProvider, useSpots } from '../src/context/SpotContext';
import { NotificationProvider } from '../src/context/NotificationContext';
import { LocationPermissionProvider, useLocationPermission } from '../src/context/LocationPermissionContext';
import { AuthScreen } from '../src/components/AuthScreen';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { OnboardingScreen } from '../src/components/OnboardingScreen';
import { LocationPermissionPrompt } from '../src/components/LocationPermissionPrompt';
import { BannedAccountScreen } from '../src/components/BannedAccountScreen';
import { SPOTZ_BRAND, SPOTZ_THEME } from '../src/constants/brand';
import { useAppColorScheme, useIsSpotzTheme } from '../src/hooks/useAppColorScheme';
import { ALWAYS_SHOW_ONBOARDING, getHasCompletedOnboarding } from '../src/utils/onboarding';

SplashScreen.preventAutoHideAsync().catch(() => {});

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootAuthGate />
    </AuthProvider>
  );
}

function RootAuthGate() {
  const {
    firebaseUser,
    isAuthLoading,
    isBanLoading,
    accountBan,
    logout,
  } = useAuth();
  const [isStartupScreenVisible, setIsStartupScreenVisible] = useState(true);
  const [isOnboardingLoading, setIsOnboardingLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboardingState] = useState(false);
  const [isMainAppLoading, setIsMainAppLoading] = useState(true);
  const isStartupLoading =
    isAuthLoading ||
    isOnboardingLoading ||
    Boolean(firebaseUser && isBanLoading);
  const shouldRenderMainApp =
    Boolean(firebaseUser) &&
    !isBanLoading &&
    !accountBan.isBanned;
  const isStartupReady =
    !isStartupLoading &&
    (!shouldRenderMainApp || !isMainAppLoading);
  const handleStartupFinish = useCallback(() => {
    setIsStartupScreenVisible(false);
  }, []);
  const handleOnboardingFinish = useCallback(() => {
    setHasCompletedOnboardingState(true);
  }, []);
  const handleMainAppLoadingChange = useCallback((isLoading: boolean) => {
    setIsMainAppLoading(isLoading);
  }, []);

  useEffect(() => {
    let isMounted = true;

    getHasCompletedOnboarding()
      .then((completed) => {
        if (isMounted) {
          setHasCompletedOnboardingState(ALWAYS_SHOW_ONBOARDING ? false : completed);
        }
      })
      .catch((error) => {
        console.error('Failed to load onboarding state', error);
      })
      .finally(() => {
        if (isMounted) {
          setIsOnboardingLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  let content: ReactNode = null;
  let statusBarStyle: 'light' | 'dark' = 'light';

  if (isStartupLoading) {
    content = null;
  } else if (!firebaseUser) {
    if (!hasCompletedOnboarding) {
      content = (
        <OnboardingScreen onFinish={handleOnboardingFinish} />
      );
    } else {
      content = <AuthScreen />;
    }
  } else if (accountBan.isBanned) {
    content = (
        <BannedAccountScreen accountBan={accountBan} onLogout={logout} />
    );
  } else {
    content = (
      <LocationPermissionProvider>
        <SpotProvider>
          <NotificationProvider>
            <MainAppGate
              isStartupScreenVisible={isStartupScreenVisible}
              onLoadingChange={handleMainAppLoadingChange}
            />
          </NotificationProvider>
        </SpotProvider>
      </LocationPermissionProvider>
    );
  }

  return (
    <View style={styles.root}>
      {content}
      {isStartupScreenVisible && (
        <View style={styles.startupLoadingOverlay}>
          <LoadingScreen isReady={isStartupReady} onFinish={handleStartupFinish} />
        </View>
      )}
      {(isStartupScreenVisible || !shouldRenderMainApp) && (
        <StatusBar style={isStartupScreenVisible ? 'light' : statusBarStyle} />
      )}
    </View>
  );
}

function MainAppGate({
  isStartupScreenVisible,
  onLoadingChange,
}: {
  isStartupScreenVisible: boolean;
  onLoadingChange: (isLoading: boolean) => void;
}) {
  const colorScheme = useAppColorScheme();
  const isSpotzTheme = useIsSpotzTheme();
  const { isSyncing, isUserDataLoading } = useSpots();
  const {
    shouldShowLocationPrompt,
    isLocationPromptLoading,
  } = useLocationPermission();
  const isMainLoading = isUserDataLoading || isSyncing || isLocationPromptLoading;

  useEffect(() => {
    onLoadingChange(isMainLoading);
  }, [isMainLoading, onLoadingChange]);

  if (isStartupScreenVisible && isMainLoading) {
    return null;
  }

  if (shouldShowLocationPrompt) {
    return (
      <>
        <LocationPermissionPrompt />
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? {
      ...DarkTheme,
      colors: {
        ...DarkTheme.colors,
        primary: SPOTZ_BRAND.accent,
        background: isSpotzTheme ? SPOTZ_THEME.background : DarkTheme.colors.background,
        card: isSpotzTheme ? SPOTZ_THEME.panel : DarkTheme.colors.card,
        text: isSpotzTheme ? SPOTZ_THEME.text : DarkTheme.colors.text,
        border: isSpotzTheme ? SPOTZ_THEME.border : DarkTheme.colors.border,
      },
    } : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen
          name="spot/[id]"
          options={{
            title: 'Spot Details',
            presentation: 'card',
            headerShown: true,
            headerStyle: { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#ffffff' },
            headerTintColor: colorScheme === 'dark' ? '#ffffff' : '#000000',
            headerBackTitle: '',
            headerBackButtonDisplayMode: 'minimal',
            headerTitleAlign: 'center',
            headerTitleStyle: {
              color: colorScheme === 'dark' ? '#ffffff' : '#000000',
              fontSize: 17,
              fontWeight: '600',
            },
          }}
        />
        <Stack.Screen
          name="profile/[id]"
          options={{
            title: 'Creator Profile',
            presentation: 'card',
            headerShown: true,
            headerStyle: { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#ffffff' },
            headerTintColor: colorScheme === 'dark' ? '#ffffff' : '#000000',
            headerBackTitle: '',
            headerBackButtonDisplayMode: 'minimal',
            headerTitleAlign: 'center',
            headerTitleStyle: {
              color: colorScheme === 'dark' ? '#ffffff' : '#000000',
              fontSize: 17,
              fontWeight: '600',
            },
          }}
        />
        <Stack.Screen
          name="legal/[slug]"
          options={{
            presentation: 'card',
            headerShown: true,
            headerStyle: { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#ffffff' },
            headerTintColor: colorScheme === 'dark' ? '#ffffff' : '#000000',
            headerBackTitle: '',
            headerBackButtonDisplayMode: 'minimal',
            headerTitleAlign: 'center',
            headerTitleStyle: {
              color: colorScheme === 'dark' ? '#ffffff' : '#000000',
              fontSize: 17,
              fontWeight: '600',
            },
          }}
        />
        <Stack.Screen
          name="notifications"
          options={{
            title: 'Notifications',
            presentation: 'card',
            headerShown: Platform.OS !== 'android',
            headerStyle: { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#ffffff' },
            headerTintColor: colorScheme === 'dark' ? '#ffffff' : '#000000',
            headerBackTitle: '',
            headerBackButtonDisplayMode: 'minimal',
            headerTitleAlign: 'center',
            headerTitleStyle: {
              color: colorScheme === 'dark' ? '#ffffff' : '#000000',
              fontSize: 17,
              fontWeight: '600',
            },
          }}
        />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  startupLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
  },
});
