import { normalizeImageUris } from '../utils/images';
import { Image } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

const DEFAULT_CLOUDINARY_CLOUD_NAME = 'dc8tl4fo9';
const DEFAULT_CLOUDINARY_UPLOAD_PRESET = 'spotz_uploads';
const MAX_CLOUDINARY_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_UPLOAD_IMAGE_DIMENSION = 1920;
const UPLOAD_IMAGE_QUALITY = 0.78;
const FALLBACK_UPLOAD_IMAGE_DIMENSION = 1600;
const FALLBACK_UPLOAD_IMAGE_QUALITY = 0.68;

const CLOUDINARY_CLOUD_NAME =
  process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || DEFAULT_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET =
  process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || DEFAULT_CLOUDINARY_UPLOAD_PRESET;
const CLOUDINARY_FOLDER = process.env.EXPO_PUBLIC_CLOUDINARY_FOLDER;

type CloudinaryUploadResponse = {
  secure_url?: string;
  public_id?: string;
  error?: {
    message?: string;
  };
};

export type CloudinaryUploadProgress = {
  completed: number;
  total: number;
  progress: number;
};

export type CloudinaryUploadedImage = {
  secureUrl: string;
  publicId: string;
  provider: 'cloudinary';
};

function isRemoteOrDataUri(uri: string) {
  return /^(https?:|data:)/i.test(uri);
}

function getImageDimensions(uri: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error)
    );
  });
}

function getFileSize(uri: string) {
  if (isRemoteOrDataUri(uri)) return undefined;

  try {
    const file = new FileSystem.File(uri);
    const info = file.info();

    return info.exists ? info.size : undefined;
  } catch {
    return undefined;
  }
}

function formatMegabytes(bytes?: number) {
  if (typeof bytes !== 'number') return 'unknown size';
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

async function resizeAndCompressImage(
  uri: string,
  dimensions: { width: number; height: number },
  maxDimension: number,
  quality: number
) {
  const longestSide = Math.max(dimensions.width, dimensions.height);
  const actions =
    longestSide > maxDimension
      ? [
          {
            resize:
              dimensions.width >= dimensions.height
                ? { width: maxDimension }
                : { height: maxDimension },
          },
        ]
      : [];

  return manipulateAsync(uri, actions, {
    compress: quality,
    format: SaveFormat.JPEG,
  });
}

async function optimizeImageForUpload(uri: string, index: number) {
  if (isRemoteOrDataUri(uri)) {
    return uri;
  }

  try {
    const dimensions = await getImageDimensions(uri);
    const originalSize = getFileSize(uri);
    let optimizedImage = await resizeAndCompressImage(
      uri,
      dimensions,
      MAX_UPLOAD_IMAGE_DIMENSION,
      UPLOAD_IMAGE_QUALITY
    );
    let optimizedSize = getFileSize(optimizedImage.uri);

    if (typeof optimizedSize === 'number' && optimizedSize > MAX_CLOUDINARY_UPLOAD_BYTES) {
      optimizedImage = await resizeAndCompressImage(
        uri,
        dimensions,
        FALLBACK_UPLOAD_IMAGE_DIMENSION,
        FALLBACK_UPLOAD_IMAGE_QUALITY
      );
      optimizedSize = getFileSize(optimizedImage.uri);
    }

    if (typeof optimizedSize === 'number' && optimizedSize > MAX_CLOUDINARY_UPLOAD_BYTES) {
      throw new Error(
        `Image ${index + 1} is still too large after compression (${formatMegabytes(
          optimizedSize
        )}). Please choose a smaller photo.`
      );
    }

    console.log('[Cloudinary] Image optimized for upload', {
      index,
      originalWidth: dimensions.width,
      originalHeight: dimensions.height,
      originalSize: formatMegabytes(originalSize),
      optimizedWidth: optimizedImage.width,
      optimizedHeight: optimizedImage.height,
      optimizedSize: formatMegabytes(optimizedSize),
    });

    return optimizedImage.uri;
  } catch (error) {
    console.warn('[Cloudinary] Image optimization failed', {
      index,
      error,
    });

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(`Image ${index + 1} could not be compressed. Please try a different photo.`);
  }
}

function getFileExtension(uri: string) {
  const cleanUri = uri.split('?')[0];
  const match = cleanUri.match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1]?.toLowerCase() || 'jpg';
}

function getMimeType(uri: string) {
  const extension = getFileExtension(uri);

  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'heic') return 'image/heic';
  return 'image/jpeg';
}

function getUploadFile(uri: string, prefix: string, index: number) {
  if (isRemoteOrDataUri(uri)) return uri;

  const extension = getFileExtension(uri);
  return {
    uri,
    name: `${prefix}-${index}.${extension}`,
    type: getMimeType(uri),
  };
}

export function isCloudinaryConfigured() {
  return Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET);
}

export async function uploadSpotImagesToCloudinary(
  spotId: string,
  imageUris: string[],
  onProgress?: (progress: CloudinaryUploadProgress) => void
): Promise<CloudinaryUploadedImage[]> {
  const normalizedImageUris = normalizeImageUris(imageUris);

  if (normalizedImageUris.length === 0) return [];

  if (!isCloudinaryConfigured()) {
    throw new Error(
      'Cloudinary is not configured. Add EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET.'
    );
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  let completedUploads = 0;

  onProgress?.({
    completed: 0,
    total: normalizedImageUris.length,
    progress: 0,
  });

  const uploadResults = await Promise.allSettled(normalizedImageUris.map(async (uri, index) => {
    const uploadUri = await optimizeImageForUpload(uri, index);
    const formData = new FormData();
    formData.append('file', getUploadFile(uploadUri, `spot-${spotId}`, index) as any);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET as string);
    if (CLOUDINARY_FOLDER) {
      formData.append('folder', `${CLOUDINARY_FOLDER}/${spotId}`);
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });
    const data = (await response.json()) as CloudinaryUploadResponse;

    if (!response.ok || !data.secure_url) {
      throw new Error(data.error?.message || 'Cloudinary image upload failed.');
    }

    if (!data.public_id) {
      throw new Error('Cloudinary image upload did not return a public id.');
    }

    completedUploads += 1;
    onProgress?.({
      completed: completedUploads,
      total: normalizedImageUris.length,
      progress: completedUploads / normalizedImageUris.length,
    });

    return {
      secureUrl: data.secure_url,
      publicId: data.public_id,
      provider: 'cloudinary',
    } satisfies CloudinaryUploadedImage;
  }));
  const failedUpload = uploadResults.find((result) => result.status === 'rejected');

  if (failedUpload?.status === 'rejected') {
    throw failedUpload.reason instanceof Error
      ? failedUpload.reason
      : new Error('Cloudinary image upload failed.');
  }

  const uploadedImages = uploadResults.map((result) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }

    throw result.reason instanceof Error
      ? result.reason
      : new Error('Cloudinary image upload failed.');
  });

  return uploadedImages;
}

export async function uploadProfileImageToCloudinary(userId: string, imageUri: string) {
  const normalizedImageUri = normalizeImageUris([imageUri])[0];

  if (!normalizedImageUri) return '';
  if (isRemoteOrDataUri(normalizedImageUri)) return normalizedImageUri;

  if (!isCloudinaryConfigured()) {
    throw new Error(
      'Cloudinary is not configured. Add EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET.'
    );
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  const uploadUri = await optimizeImageForUpload(normalizedImageUri, 0);
  const formData = new FormData();
  formData.append('file', getUploadFile(uploadUri, `profile-${userId}`, 0) as any);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET as string);
  if (CLOUDINARY_FOLDER) {
    formData.append('folder', `${CLOUDINARY_FOLDER}/profiles/${userId}`);
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });
  const data = (await response.json()) as CloudinaryUploadResponse;

  if (!response.ok || !data.secure_url) {
    throw new Error(data.error?.message || 'Cloudinary profile image upload failed.');
  }

  return data.secure_url;
}
