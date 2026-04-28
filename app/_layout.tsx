import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { SpotProvider } from './context/SpotContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SpotProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          <Stack.Screen 
            name="spot/[id]" 
            options={{ 
              presentation: 'card',
              headerShown: true,
              headerStyle: { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#ffffff' },
              headerTintColor: colorScheme === 'dark' ? '#ffffff' : '#000000',
            }} 
          />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SpotProvider>
  );
}
