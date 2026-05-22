import { useColorScheme as useSystemColorScheme } from 'react-native';
import { useSpots } from '../context/SpotContext';

export function useAppColorScheme() {
  const systemColorScheme = useSystemColorScheme();
  const { settings } = useSpots();

  if (settings.themePreference === 'spotz') {
    return 'dark';
  }

  if (settings.themePreference === 'system') {
    return systemColorScheme === 'light' ? 'light' : 'dark';
  }

  return settings.themePreference;
}

export function useIsSpotzTheme() {
  const { settings } = useSpots();
  return settings.themePreference === 'spotz';
}
