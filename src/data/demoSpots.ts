import { PhotoCategory, PhotoSpot, getSpotCategoryIds } from '../types';

import demoSpotItemsJson from './demoSpots.json';

type DemoSpotItem = {
  id: string;
  title: string;
  category: PhotoCategory;
  locationName: string;
  latitude: number;
  longitude: number;
  description: string;
  bestTimeToShoot: string;
  images: string[];
  creatorId: string;
  creatorUsername: string;
  creatorDisplayName: string;
  createdAt: string;
  favoriteCount: number;
  imageCredit: string;
};

const demoSpotItems = demoSpotItemsJson as unknown as DemoSpotItem[];

export const DEMO_SPOT_CREATOR_ID = 'spotz-demo-creator';
export const DEMO_SPOT_CREATOR_USERNAME = 'spotzdemo';
export const DEMO_SPOT_CREATOR_DISPLAY_NAME = 'SPOTZ Demo';

export const demoSpotIds = new Set(demoSpotItems.map((spot) => spot.id));

export function isDemoSpotId(spotId: string) {
  return demoSpotIds.has(spotId);
}

export const demoSpots: PhotoSpot[] = demoSpotItems.map((spot) => ({
  id: spot.id,
  title: spot.title,
  description: spot.description,
  category: spot.category,
  categoryId: spot.category,
  categoryIds: getSpotCategoryIds(spot.category),
  images: spot.images,
  latitude: spot.latitude,
  longitude: spot.longitude,
  locationName: spot.locationName,
  bestTimeToShoot: spot.bestTimeToShoot,
  createdAt: new Date(spot.createdAt),
  createdBy: spot.creatorId,
  creatorId: spot.creatorId,
  creatorUsername: spot.creatorUsername,
  creatorDisplayName: spot.creatorDisplayName,
  creatorAvatarUrl: '',
  creatorShowProfileImageInComments: false,
  visibility: 'public',
  isPublic: true,
  isPrivate: false,
  isRemoved: false,
  isDemo: true,
  demoSource: spot.imageCredit,
  favoriteCount: spot.favoriteCount,
  allowComments: false,
}));
