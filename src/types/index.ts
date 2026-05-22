// filepath: src/types/index.ts

import type { ImageRequireSource } from 'react-native';

export type PhotoCategory =
  | 'car_photography'
  | 'landscape'
  | 'street'
  | 'portrait'
  | 'wildlife';

export type CategoryFilterId = 'all' | PhotoCategory;

export type SpotImage = string | { uri?: string; url?: string };

export type SpotImageAsset = {
  url: string;
  publicId: string;
  provider: 'cloudinary';
};

export interface PhotoSpot {
  id: string;
  title: string;
  description: string;
  category: PhotoCategory;
  categoryId: PhotoCategory;
  categoryIds: CategoryFilterId[];
  images: SpotImage[];
  imageAssets?: SpotImageAsset[];
  imageStoragePaths?: string[];
  latitude: number;
  longitude: number;
  locationName?: string;
  bestTimeToShoot: string;
  createdAt: Date;
  createdBy: string;
  creatorId?: string;
  creatorUsername?: string;
  creatorAvatarUrl?: string;
  creatorDisplayName?: string;
  creatorShowProfileImageInComments?: boolean;
  visibility?: SpotVisibility;
  isPublic?: boolean;
  isPrivate?: boolean;
  isDemo?: boolean;
  demoSource?: string;
  isRemoved?: boolean;
  removedReason?: string;
  removedAt?: Date;
  removedBy?: string;
  favoriteCount?: number;
  allowComments?: boolean;
  isFavorite?: boolean;
}

export interface User {
  id: string;
  username: string;
  usernameLower?: string;
  displayName?: string;
  email?: string;
  bio?: string;
  profileImage?: SpotImage;
  joinedAt?: Date;
  showProfileImageInComments?: boolean;
  isBanned?: boolean;
  banReason?: string;
  bannedAt?: Date;
  bannedBy?: string;
  isFounder?: boolean;
  founderNumber?: number | null;
  founderGrantedAt?: Date | null;
  proUntil?: Date | null;
  proSource?: 'founder' | 'paid' | null;
  uploadedSpots: string[];
  savedSpots: string[];
}

export interface PublicCreatorProfile {
  id: string;
  username: string;
  displayName?: string;
  email?: string;
  bio?: string;
  profileImageUrl?: string;
  avatarUrl?: string;
  joinedAt?: Date;
  showProfileImageInComments?: boolean;
}

export type DefaultMapApp = 'apple' | 'google';
export type ThemePreference = 'dark' | 'light' | 'system' | 'spotz';
export type SpotVisibility = 'public' | 'private';

export interface AppSettings {
  language: string;
  defaultMapApp: DefaultMapApp;
  notificationsEnabled: boolean;
  themePreference: ThemePreference;
  showProfileImageInComments: boolean;
}

export interface SpotReply {
  id: string;
  spotId: string;
  commentId: string;
  parentId: string;
  rootCommentId: string;
  replyingToUserId?: string | null;
  replyingToUsername?: string;
  authorId?: string;
  userId: string;
  username: string;
  profileImageUrl?: string;
  showProfileImageInComments?: boolean;
  text: string;
  createdAt: string;
  likedBy?: string[];
  likeCount?: number;
  replies?: SpotReply[];
}

export interface SpotComment {
  id: string;
  spotId: string;
  parentId?: string | null;
  rootCommentId?: string;
  authorId?: string;
  userId: string;
  username: string;
  profileImageUrl?: string;
  showProfileImageInComments?: boolean;
  text: string;
  createdAt: string;
  likedBy?: string[];
  likeCount?: number;
  replies?: SpotReply[];
}

export type SpotzNotificationType =
  | 'spot_comment'
  | 'comment_reply'
  | 'spot_favorite';

export interface SpotzNotification {
  id: string;
  type: SpotzNotificationType;
  recipientId: string;
  actorId: string;
  actorUsername: string;
  spotId: string;
  spotTitle: string;
  commentId?: string | null;
  rootCommentId?: string | null;
  parentId?: string | null;
  replyId?: string | null;
  isRead: boolean;
  createdAt: Date;
  readAt?: Date | null;
}

export type CategoryConfig = {
  id: PhotoCategory;
  value: PhotoCategory;
  label: string;
  icon: string;
  iconSource: ImageRequireSource;
  markerSource: ImageRequireSource;
  markerSourceDark: ImageRequireSource;
  aliases: string[];
};

export const CATEGORIES: CategoryConfig[] = [
  {
    id: 'car_photography',
    value: 'car_photography',
    label: 'Car Photography',
    icon: '\u{1F697}',
    iconSource: require('../../assets/markers/icon-car.png'),
    markerSource: require('../../assets/markers/marker-car.png'),
    markerSourceDark: require('../../assets/markers/marker-car-dark.png'),
    aliases: ['car', 'cars', 'car photography', 'car_photography', 'automotive'],
  },
  {
    id: 'landscape',
    value: 'landscape',
    label: 'Landscape',
    icon: '\u{1F3D4}\uFE0F',
    iconSource: require('../../assets/markers/icon-landscape.png'),
    markerSource: require('../../assets/markers/marker-landscape.png'),
    markerSourceDark: require('../../assets/markers/marker-landscape-dark.png'),
    aliases: ['landscape', 'nature', 'drone'],
  },
  {
    id: 'street',
    value: 'street',
    label: 'Street',
    icon: '\u{1F3D9}\uFE0F',
    iconSource: require('../../assets/markers/icon-street.png'),
    markerSource: require('../../assets/markers/marker-street.png'),
    markerSourceDark: require('../../assets/markers/marker-street-dark.png'),
    aliases: ['street', 'urban', 'city'],
  },
  {
    id: 'portrait',
    value: 'portrait',
    label: 'Portrait',
    icon: '\u{1F464}',
    iconSource: require('../../assets/markers/icon-portrait.png'),
    markerSource: require('../../assets/markers/marker-portrait.png'),
    markerSourceDark: require('../../assets/markers/marker-portrait-dark.png'),
    aliases: ['portrait', 'people'],
  },
  {
    id: 'wildlife',
    value: 'wildlife',
    label: 'Wildlife',
    icon: '\u{1F98C}',
    iconSource: require('../../assets/markers/icon-wildlife.png'),
    markerSource: require('../../assets/markers/marker-wildlife.png'),
    markerSourceDark: require('../../assets/markers/marker-wildlife-dark.png'),
    aliases: ['wildlife', 'animal', 'animals', 'nature wildlife'],
  },
];

export const CATEGORY_ICONS: Record<PhotoCategory, string> = CATEGORIES.reduce((acc, category) => {
  acc[category.id] = category.icon;
  return acc;
}, {} as Record<PhotoCategory, string>);

export const CATEGORY_LABELS: Record<PhotoCategory, string> = CATEGORIES.reduce((acc, category) => {
  acc[category.id] = category.label;
  return acc;
}, {} as Record<PhotoCategory, string>);

export const CATEGORY_ICON_SOURCES: Record<PhotoCategory, ImageRequireSource> = CATEGORIES.reduce((acc, category) => {
  acc[category.id] = category.iconSource;
  return acc;
}, {} as Record<PhotoCategory, ImageRequireSource>);

export const ALL_CATEGORY_FILTER = {
  id: 'all',
  value: 'all',
  label: 'All',
  icon: '\u{1F30D}',
  iconSource: require('../../assets/markers/icon-all.png') as ImageRequireSource,
} as const;

export function normalizePhotoCategory(category: string): PhotoCategory {
  const normalizedCategory = String(category || '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');
  const categoryConfig = CATEGORIES.find((item) => (
    item.id === normalizedCategory ||
    item.aliases.some((alias) => alias.replace(/[-\s]+/g, '_') === normalizedCategory)
  ));

  if (categoryConfig) return categoryConfig.id;

  return 'landscape';
}

export function getSpotCategoryIds(
  category: string,
  categoryIds?: unknown
): CategoryFilterId[] {
  const normalizedCategory = normalizePhotoCategory(category);
  const normalizedCategoryIds = Array.isArray(categoryIds)
    ? categoryIds.map((categoryId) => {
        if (categoryId === 'all') return 'all';
        return normalizePhotoCategory(String(categoryId || normalizedCategory));
      })
    : [];

  return Array.from(new Set<CategoryFilterId>([
    'all',
    ...normalizedCategoryIds,
    normalizedCategory,
  ]));
}

export function getCategoryIcon(category: string): string {
  return CATEGORY_ICONS[normalizePhotoCategory(category)] || '\u{1F4CD}';
}

export function getCategoryIconSource(category: string): ImageRequireSource {
  if (category === 'all') return ALL_CATEGORY_FILTER.iconSource;
  return CATEGORY_ICON_SOURCES[normalizePhotoCategory(category)];
}

export function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[normalizePhotoCategory(category)] || category;
}

export function getCategoryDisplayLabel(category: string): string {
  return `${getCategoryIcon(category)} ${getCategoryLabel(category)}`;
}

export function getCategoryMarkerImageSource(category: string, isDark = false): ImageRequireSource {
  const categoryConfig = CATEGORIES.find((item) => item.id === normalizePhotoCategory(category));
  return isDark
    ? categoryConfig?.markerSourceDark || CATEGORIES[1].markerSourceDark
    : categoryConfig?.markerSource || CATEGORIES[1].markerSource;
}

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
