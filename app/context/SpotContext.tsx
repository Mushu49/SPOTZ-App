// filepath: app/context/SpotContext.tsx
import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PhotoSpot, User } from '../types';
import { demoSpots } from '../data/demoSpots';

interface SpotContextType {
  spots: PhotoSpot[];
  favorites: string[];
  user: User;
  addSpot: (spot: Omit<PhotoSpot, 'id' | 'createdAt' | 'createdBy'>) => void;
  toggleFavorite: (spotId: string) => void;
  getSpotById: (id: string) => PhotoSpot | undefined;
  getSpotsByCategory: (category: string) => PhotoSpot[];
  getFavoriteSpots: () => PhotoSpot[];
}

const defaultUser: User = {
  id: 'currentUser',
  username: 'Photographer',
  profileImage: undefined,
  uploadedSpots: ['1', '2'],
  savedSpots: [],
};

const STORAGE_KEYS = {
  SPOTS: '@spotz_spots',
  FAVORITES: '@spotz_favorites',
};

const SpotContext = createContext<SpotContextType | undefined>(undefined);

export function SpotProvider({ children }: { children: ReactNode }) {
  const [spots, setSpots] = useState<PhotoSpot[]>(demoSpots);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [user, setUser] = useState<User>(defaultUser);
  const isInitialLoad = useRef(true);

  // Load data from AsyncStorage on mount
  useEffect(() => {
    const loadPersistedData = async () => {
      try {
        const [storedSpots, storedFavorites] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.SPOTS),
          AsyncStorage.getItem(STORAGE_KEYS.FAVORITES),
        ]);

        if (storedSpots) setSpots(JSON.parse(storedSpots));
        if (storedFavorites) setFavorites(JSON.parse(storedFavorites));
      } catch (e) {
        console.error('Failed to load data from storage', e);
      } finally {
        isInitialLoad.current = false;
      }
    };
    loadPersistedData();
  }, []);

  // Save data to AsyncStorage whenever spots or favorites change
  useEffect(() => {
    if (isInitialLoad.current) return;

    const saveData = async () => {
      await AsyncStorage.setItem(STORAGE_KEYS.SPOTS, JSON.stringify(spots));
      await AsyncStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
    };
    saveData();
  }, [spots, favorites]);

  const addSpot = useCallback((spotData: Omit<PhotoSpot, 'id' | 'createdAt' | 'createdBy'>) => {
    const newSpot: PhotoSpot = {
      ...spotData,
      id: Date.now().toString(),
      createdAt: new Date(),
      createdBy: 'currentUser',
    };
    setSpots((prev) => [newSpot, ...prev]);
    setUser((prev) => ({
      ...prev,
      uploadedSpots: [...prev.uploadedSpots, newSpot.id],
    }));
  }, []);

  const toggleFavorite = useCallback((spotId: string) => {
    setFavorites((prev) => {
      if (prev.includes(spotId)) {
        return prev.filter((id) => id !== spotId);
      }
      return [...prev, spotId];
    });
    setUser((prev) => {
      if (prev.savedSpots.includes(spotId)) {
        return {
          ...prev,
          savedSpots: prev.savedSpots.filter((id) => id !== spotId),
        };
      }
      return {
        ...prev,
        savedSpots: [...prev.savedSpots, spotId],
      };
    });
  }, []);

  const getSpotById = useCallback(
    (id: string) => spots.find((spot) => spot.id === id),
    [spots]
  );

  const getSpotsByCategory = useCallback(
    (category: string) => spots.filter((spot) => spot.category === category),
    [spots]
  );

  const getFavoriteSpots = useCallback(
    () => spots.filter((spot) => favorites.includes(spot.id)),
    [spots, favorites]
  );

  return (
    <SpotContext.Provider
      value={{
        spots,
        favorites,
        user,
        addSpot,
        toggleFavorite,
        getSpotById,
        getSpotsByCategory,
        getFavoriteSpots,
      }}
    >
      {children}
    </SpotContext.Provider>
  );
}

export function useSpots() {
  const context = useContext(SpotContext);
  if (!context) {
    throw new Error('useSpots must be used within a SpotProvider');
  }
  return context;
}