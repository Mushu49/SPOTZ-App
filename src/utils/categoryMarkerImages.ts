import { ImageRequireSource } from 'react-native';
import { getCategoryMarkerImageSource } from '../types';

// MapView markers use static PNGs for stable rendering across iOS and Android.
// The concrete marker assets are declared in the shared category config.

export function getCategoryMarkerImage(category: string, isDark = false): ImageRequireSource {
  return getCategoryMarkerImageSource(category, isDark);
}
