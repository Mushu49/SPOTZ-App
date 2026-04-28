// filepath: app/types/index.ts

export type PhotoCategory = 
  | 'car'
  | 'landscape'
  | 'street'
  | 'portrait'
  | 'urban'
  | 'drone';

export interface PhotoSpot {
  id: string;
  title: string;
  description: string;
  category: PhotoCategory;
  images: string[];
  latitude: number;
  longitude: number;
  bestTimeToShoot: string;
  createdAt: Date;
  createdBy: string;
  isFavorite?: boolean;
}

export interface User {
  id: string;
  username: string;
  profileImage?: string;
  uploadedSpots: string[];
  savedSpots: string[];
}

export const CATEGORIES: { value: PhotoCategory; label: string; icon: string }[] = [
  { value: 'car', label: 'Car Photography', icon: '🚗' },
  { value: 'landscape', label: 'Landscape', icon: '🏔️' },
  { value: 'street', label: 'Street', icon: '🏙️' },
  { value: 'portrait', label: 'Portrait', icon: '👤' },
  { value: 'urban', label: 'Urban', icon: '🌆' },
  { value: 'drone', label: 'Drone', icon: '🚁' },
];

export const BEST_TIMES = [
  'Golden Hour (Morning)',
  'Golden Hour (Evening)',
  'Blue Hour (Morning)',
  'Blue Hour (Evening)',
  'Midday',
  'Night',
  'Overcast',
  'Any Time',
];