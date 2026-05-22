import { ActionSheetIOS, Linking, Platform } from 'react-native';
import { DefaultMapApp, PhotoSpot } from '../types';

function getAppleMapsUrl(spot: PhotoSpot) {
  const label = encodeURIComponent(spot.title);

  if (Platform.OS === 'ios') {
    return `maps://?daddr=${spot.latitude},${spot.longitude}&q=${label}`;
  }

  return `https://maps.apple.com/?daddr=${spot.latitude},${spot.longitude}&q=${label}`;
}

function getGoogleMapsUrl(spot: PhotoSpot) {
  const destination = `${spot.latitude},${spot.longitude}`;
  const label = encodeURIComponent(spot.title);

  if (Platform.OS === 'android') {
    return `google.navigation:q=${destination}(${label})`;
  }

  return `comgooglemaps://?daddr=${destination}&directionsmode=driving&q=${label}`;
}

function getGoogleMapsWebUrl(spot: PhotoSpot) {
  return `https://www.google.com/maps/dir/?api=1&destination=${spot.latitude},${spot.longitude}&travelmode=driving`;
}

function getWazeUrl(spot: PhotoSpot) {
  return `waze://?ll=${spot.latitude},${spot.longitude}&navigate=yes`;
}

async function canOpenAppUrl(url: string) {
  try {
    return await Linking.canOpenURL(url);
  } catch (error) {
    console.error('Failed to check maps app availability', error);
    return false;
  }
}

async function openUrlWithFallback(url: string, fallbackUrl: string) {
  try {
    await Linking.openURL(url);
  } catch (error) {
    console.error('Failed to open selected maps app', error);
    await Linking.openURL(fallbackUrl);
  }
}

async function openSpotInMapsIOS(spot: PhotoSpot) {
  const appleMapsUrl = getAppleMapsUrl(spot);
  const googleMapsUrl = getGoogleMapsUrl(spot);
  const wazeUrl = getWazeUrl(spot);
  const options: { label: string; url?: string }[] = [
    { label: 'Apple Maps', url: appleMapsUrl },
  ];

  const [canOpenGoogleMaps, canOpenWaze] = await Promise.all([
    canOpenAppUrl('comgooglemaps://'),
    canOpenAppUrl('waze://'),
  ]);

  if (canOpenGoogleMaps) {
    options.push({ label: 'Google Maps', url: googleMapsUrl });
  }

  if (canOpenWaze) {
    options.push({ label: 'Waze', url: wazeUrl });
  }

  options.push({ label: 'Cancel' });

  ActionSheetIOS.showActionSheetWithOptions(
    {
      options: options.map((option) => option.label),
      cancelButtonIndex: options.length - 1,
      userInterfaceStyle: 'dark',
    },
    async (buttonIndex) => {
      const selectedOption = options[buttonIndex];
      if (!selectedOption?.url) return;

      await openUrlWithFallback(selectedOption.url, appleMapsUrl);
    }
  );
}

export async function openSpotInMaps(spot: PhotoSpot, defaultMapApp: DefaultMapApp) {
  if (Platform.OS === 'ios') {
    await openSpotInMapsIOS(spot);
    return;
  }

  const preferredUrl =
    defaultMapApp === 'google' ? getGoogleMapsUrl(spot) : getAppleMapsUrl(spot);
  const fallbackUrl =
    defaultMapApp === 'google' ? getGoogleMapsWebUrl(spot) : getGoogleMapsWebUrl(spot);

  try {
    const canOpenPreferred = await Linking.canOpenURL(preferredUrl);
    await Linking.openURL(canOpenPreferred ? preferredUrl : fallbackUrl);
  } catch (error) {
    console.error('Failed to open maps', error);
    await Linking.openURL(fallbackUrl);
  }
}
