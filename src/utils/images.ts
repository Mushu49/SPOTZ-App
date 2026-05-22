import { ImageSourcePropType } from 'react-native';
import * as FileSystem from 'expo-file-system';

export type StoredImage = string | { uri?: string; url?: string } | null | undefined;
export type ImageOptimizationPreset = 'thumbnail' | 'card' | 'detail' | 'fullscreen';

export const FALLBACK_SPOT_IMAGE =
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800';

const IMAGE_DIRECTORY_NAME = 'spotz-images';
const CLOUDINARY_UPLOAD_SEGMENT = '/image/upload/';
const CLOUDINARY_IMAGE_HOST_PATTERN = /^https?:\/\/res\.cloudinary\.com\//i;
const CLOUDINARY_IMAGE_PRESETS: Record<ImageOptimizationPreset, string> = {
  thumbnail: 'f_auto,q_auto,c_fill,w_480,h_320',
  card: 'f_auto,q_auto,c_fill,w_700,h_460',
  detail: 'f_auto,q_auto,c_limit,w_1400',
  fullscreen: 'f_auto,q_auto,c_limit,w_2200',
};

export function getImageUri(image: StoredImage) {
  if (typeof image === 'string') return image.trim();
  if (image && typeof image === 'object') return (image.uri || image.url || '').trim();
  return '';
}

export function normalizeImageUri(image: StoredImage) {
  const uri = getImageUri(image);
  return uri.length > 0 ? uri : undefined;
}

export function normalizeImageUris(images: unknown) {
  if (!Array.isArray(images)) return [];

  return images
    .map((image) => normalizeImageUri(image as StoredImage))
    .filter((uri): uri is string => !!uri);
}

export function getOptimizedImageUrl(
  url: string | undefined,
  preset: ImageOptimizationPreset = 'card'
) {
  if (!url) return url;

  const uri = url.trim();

  if (!CLOUDINARY_IMAGE_HOST_PATTERN.test(uri)) {
    return uri;
  }

  const uploadIndex = uri.indexOf(CLOUDINARY_UPLOAD_SEGMENT);

  if (uploadIndex === -1) {
    return uri;
  }

  const transform = CLOUDINARY_IMAGE_PRESETS[preset];
  const uploadEndIndex = uploadIndex + CLOUDINARY_UPLOAD_SEGMENT.length;
  const beforeUploadPath = uri.slice(0, uploadEndIndex);
  const afterUploadPath = uri.slice(uploadEndIndex);

  if (afterUploadPath.startsWith(`${transform}/`)) {
    return uri;
  }

  return `${beforeUploadPath}${transform}/${afterUploadPath}`;
}

export function getImageSource(
  image: StoredImage,
  fallbackUri = FALLBACK_SPOT_IMAGE,
  preset?: ImageOptimizationPreset
): ImageSourcePropType {
  const uri = normalizeImageUri(image) || fallbackUri;
  return { uri: preset ? getOptimizedImageUrl(uri, preset) : uri };
}

export function getSpotCoverImageSource(
  spot: { images?: StoredImage[] },
  preset: ImageOptimizationPreset = 'card'
) {
  return getImageSource(spot.images?.[0], FALLBACK_SPOT_IMAGE, preset);
}

function isRemoteOrDataUri(uri: string) {
  return /^(https?:|data:)/i.test(uri);
}

function getFileExtension(uri: string) {
  const cleanUri = uri.split('?')[0];
  const match = cleanUri.match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1] || 'jpg';
}

function getImageDirectory() {
  return new FileSystem.Directory(FileSystem.Paths.document, IMAGE_DIRECTORY_NAME);
}

export async function persistLocalImageAsync(uri: string, prefix: string) {
  if (!uri || isRemoteOrDataUri(uri)) {
    return uri;
  }

  try {
    const imageDirectory = getImageDirectory();

    if (uri.startsWith(imageDirectory.uri)) {
      return uri;
    }

    if (!imageDirectory.exists) {
      imageDirectory.create({ intermediates: true, idempotent: true });
    }

    const extension = getFileExtension(uri);
    const fileName = `${prefix}-${Date.now()}-${Math.round(
      Math.random() * 100000
    )}.${extension}`;
    const sourceFile = new FileSystem.File(uri);
    const destinationFile = new FileSystem.File(imageDirectory, fileName);

    sourceFile.copy(destinationFile);
    return destinationFile.uri;
  } catch (error) {
    console.error('Failed to persist image', error);
    return uri;
  }
}

export async function persistLocalImagesAsync(images: string[], prefix: string) {
  return Promise.all(images.map((uri) => persistLocalImageAsync(uri, prefix)));
}

export async function clearPersistedImagesAsync() {
  try {
    const imageDirectory = getImageDirectory();

    if (imageDirectory.exists) {
      imageDirectory.delete();
    }
  } catch (error) {
    console.error('Failed to clear persisted images', error);
  }
}
