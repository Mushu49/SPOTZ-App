import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';

const LOCATION_PROMPT_KEY_PREFIX = '@spotz_location_prompt_shown_';
const LOCATION_ACCESS_KEY_PREFIX = '@spotz_location_access_enabled_';

type LocationPermissionState = 'checking' | 'undetermined' | 'granted' | 'limited' | 'denied' | 'unavailable';
type LocationAccuracyState = 'full' | 'reduced' | 'unknown';

type LocationPermissionContextType = {
  coords: Location.LocationObjectCoords | null;
  permissionStatus: LocationPermissionState;
  accuracy: LocationAccuracyState;
  isLocationAccessEnabled: boolean;
  locationFeaturesEnabled: boolean;
  hasShownLocationPrompt: boolean;
  shouldShowLocationPrompt: boolean;
  isLocationLoading: boolean;
  isLocationPromptLoading: boolean;
  setLocationAccessEnabled: (enabled: boolean) => Promise<boolean>;
  requestLocationPermission: () => Promise<boolean>;
  dismissLocationPrompt: () => Promise<void>;
  refreshCurrentLocation: () => Promise<Location.LocationObjectCoords | null>;
};

const LocationPermissionContext = createContext<LocationPermissionContextType | undefined>(undefined);

function getPromptStorageKey(userId: string) {
  return `${LOCATION_PROMPT_KEY_PREFIX}${userId}`;
}

function getLocationAccessStorageKey(userId: string) {
  return `${LOCATION_ACCESS_KEY_PREFIX}${userId}`;
}

function getAccuracy(permission: Location.PermissionResponse): LocationAccuracyState {
  const iosAccuracy = (permission as Location.PermissionResponse & {
    ios?: { accuracy?: string };
  }).ios?.accuracy;

  if (iosAccuracy === 'full') return 'full';
  if (iosAccuracy === 'reduced') return 'reduced';
  return 'unknown';
}

function getPermissionStatus(permission: Location.PermissionResponse): LocationPermissionState {
  if (permission.granted) {
    return getAccuracy(permission) === 'reduced' ? 'limited' : 'granted';
  }

  if (permission.status === Location.PermissionStatus.DENIED) return 'denied';
  return 'undetermined';
}

function isUsableLocationStatus(status: LocationPermissionState) {
  return status === 'granted' || status === 'limited';
}

export function LocationPermissionProvider({ children }: { children: ReactNode }) {
  const { firebaseUser } = useAuth();
  const [coords, setCoords] = useState<Location.LocationObjectCoords | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionState>('checking');
  const [accuracy, setAccuracy] = useState<LocationAccuracyState>('unknown');
  const [isLocationAccessEnabled, setIsLocationAccessEnabled] = useState(true);
  const [hasShownLocationPrompt, setHasShownLocationPrompt] = useState(false);
  const [isPromptStateLoading, setIsPromptStateLoading] = useState(true);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const isLocationAccessEnabledRef = useRef(true);

  const userId = firebaseUser?.uid || '';

  useEffect(() => {
    isLocationAccessEnabledRef.current = isLocationAccessEnabled;
  }, [isLocationAccessEnabled]);

  const readPermissionStatus = useCallback(async () => {
    const permission = await Location.getForegroundPermissionsAsync();
    const nextAccuracy = getAccuracy(permission);
    const nextStatus = getPermissionStatus(permission);

    setAccuracy(nextAccuracy);
    setPermissionStatus(nextStatus);

    if (!isUsableLocationStatus(nextStatus)) {
      setCoords(null);
    }

    return nextStatus;
  }, []);

  const readCurrentLocation = useCallback(async (status: LocationPermissionState) => {
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();

      if (!servicesEnabled) {
        setPermissionStatus('unavailable');
        setCoords(null);
        return null;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (!isLocationAccessEnabledRef.current) {
        setCoords(null);
        return null;
      }

      setCoords(currentLocation.coords);
      setPermissionStatus(status);
      return currentLocation.coords;
    } catch (error) {
      console.error('Failed to get current location', error);
      setPermissionStatus('unavailable');
      setCoords(null);
      return null;
    }
  }, []);

  const refreshCurrentLocation = useCallback(async () => {
    if (!isLocationAccessEnabled) {
      setCoords(null);
      return null;
    }

    const nextStatus = await readPermissionStatus();

    if (!isUsableLocationStatus(nextStatus)) {
      return null;
    }

    return readCurrentLocation(nextStatus);
  }, [isLocationAccessEnabled, readCurrentLocation, readPermissionStatus]);

  useEffect(() => {
    let isMounted = true;

    const loadPermissionState = async () => {
      if (!userId) {
        setCoords(null);
        setPermissionStatus('undetermined');
        isLocationAccessEnabledRef.current = true;
        setIsLocationAccessEnabled(true);
        setHasShownLocationPrompt(false);
        setIsPromptStateLoading(false);
        return;
      }

      setIsPromptStateLoading(true);

      try {
        const [storedPromptShown, storedLocationAccessEnabled, permission] = await Promise.all([
          AsyncStorage.getItem(getPromptStorageKey(userId)),
          AsyncStorage.getItem(getLocationAccessStorageKey(userId)),
          Location.getForegroundPermissionsAsync(),
        ]);

        if (!isMounted) return;

        const nextLocationAccessEnabled = storedLocationAccessEnabled !== 'false';
        const nextPermissionStatus = getPermissionStatus(permission);

        setHasShownLocationPrompt(storedPromptShown === 'true');
        setAccuracy(getAccuracy(permission));
        isLocationAccessEnabledRef.current = nextLocationAccessEnabled;
        setIsLocationAccessEnabled(nextLocationAccessEnabled);

        if (!nextLocationAccessEnabled) {
          setPermissionStatus(nextPermissionStatus);
          setCoords(null);
        } else if (permission.granted) {
          await readCurrentLocation(nextPermissionStatus);
        } else {
          setPermissionStatus(nextPermissionStatus);
          setCoords(null);
        }
      } catch (error) {
        console.error('Failed to load location permission state', error);
        if (isMounted) {
          setPermissionStatus('unavailable');
          setCoords(null);
        }
      } finally {
        if (isMounted) {
          setIsPromptStateLoading(false);
        }
      }
    };

    loadPermissionState();

    return () => {
      isMounted = false;
    };
  }, [readCurrentLocation, userId]);

  const rememberPromptShown = useCallback(async () => {
    if (!userId) return;
    setHasShownLocationPrompt(true);
    await AsyncStorage.setItem(getPromptStorageKey(userId), 'true');
  }, [userId]);

  const requestPermissionAndLocation = useCallback(async () => {
    try {
      await rememberPromptShown();

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setPermissionStatus('unavailable');
        setCoords(null);
        return false;
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      setAccuracy(getAccuracy(permission));

      if (!permission.granted) {
        setPermissionStatus(getPermissionStatus(permission));
        setCoords(null);
        return false;
      }

      const nextStatus = getPermissionStatus(permission);
      const currentCoords = await readCurrentLocation(nextStatus);
      return Boolean(currentCoords);
    } catch (error) {
      console.error('Failed to request location permission', error);
      setPermissionStatus('unavailable');
      setCoords(null);
      return false;
    }
  }, [readCurrentLocation, rememberPromptShown]);

  const setLocationAccessEnabled = useCallback(async (enabled: boolean) => {
    if (!userId) return false;

    setIsLocationLoading(true);

    try {
      isLocationAccessEnabledRef.current = enabled;
      setIsLocationAccessEnabled(enabled);
      await AsyncStorage.setItem(getLocationAccessStorageKey(userId), String(enabled));

      if (!enabled) {
        setCoords(null);
        return true;
      }

      return await requestPermissionAndLocation();
    } finally {
      setIsLocationLoading(false);
    }
  }, [requestPermissionAndLocation, userId]);

  const requestLocationPermission = useCallback(async () => {
    if (!userId) return false;

    setIsLocationLoading(true);

    try {
      isLocationAccessEnabledRef.current = true;
      setIsLocationAccessEnabled(true);
      const permissionGranted = await requestPermissionAndLocation();

      if (permissionGranted) {
        await AsyncStorage.setItem(getLocationAccessStorageKey(userId), 'true');
        return true;
      }

      isLocationAccessEnabledRef.current = false;
      setIsLocationAccessEnabled(false);
      await AsyncStorage.setItem(getLocationAccessStorageKey(userId), 'false');
      return false;
    } finally {
      setIsLocationLoading(false);
    }
  }, [requestPermissionAndLocation, userId]);

  const dismissLocationPrompt = useCallback(async () => {
    await rememberPromptShown();
    if (!userId) return;

    isLocationAccessEnabledRef.current = false;
    setIsLocationAccessEnabled(false);
    setCoords(null);
    await AsyncStorage.setItem(getLocationAccessStorageKey(userId), 'false');
  }, [rememberPromptShown, userId]);

  const shouldShowLocationPrompt = useMemo(
    () =>
      Boolean(userId) &&
      isLocationAccessEnabled &&
      !isPromptStateLoading &&
      !hasShownLocationPrompt &&
      !isUsableLocationStatus(permissionStatus),
    [hasShownLocationPrompt, isLocationAccessEnabled, isPromptStateLoading, permissionStatus, userId]
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' || !userId) return;

      refreshCurrentLocation().catch((error) => {
        console.error('Failed to refresh location permission on app active', error);
      });
    });

    return () => subscription.remove();
  }, [refreshCurrentLocation, userId]);

  const locationFeaturesEnabled = isLocationAccessEnabled && isUsableLocationStatus(permissionStatus) && Boolean(coords);

  return (
    <LocationPermissionContext.Provider
      value={{
        coords,
        permissionStatus,
        accuracy,
        isLocationAccessEnabled,
        locationFeaturesEnabled,
        hasShownLocationPrompt,
        shouldShowLocationPrompt,
        isLocationLoading: isLocationLoading || isPromptStateLoading,
        isLocationPromptLoading: isPromptStateLoading,
        setLocationAccessEnabled,
        requestLocationPermission,
        dismissLocationPrompt,
        refreshCurrentLocation,
      }}
    >
      {children}
    </LocationPermissionContext.Provider>
  );
}

export function useLocationPermission() {
  const context = useContext(LocationPermissionContext);
  if (!context) {
    throw new Error('useLocationPermission must be used within a LocationPermissionProvider');
  }
  return context;
}
