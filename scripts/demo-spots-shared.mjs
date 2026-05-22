import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

export const PROJECT_ID = 'spotz-373c3';
export const DEMO_SPOT_CREATOR_ID = 'spotz-demo-creator';
export const DEMO_SPOT_BATCH_ID = 'spotz-global-screenshot-demo-2026-05';
export const BATCH_LIMIT = 450;

const FIREBASE_CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const __dirname = dirname(fileURLToPath(import.meta.url));
const demoSpotsPath = join(__dirname, '..', 'src', 'data', 'demoSpots.json');

function getServiceAccountPath() {
  return process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS || '';
}

async function getFirebaseCliRefreshToken() {
  const configPaths = [
    join(homedir(), '.config', 'configstore', 'firebase-tools.json'),
    process.env.APPDATA ? join(process.env.APPDATA, 'configstore', 'firebase-tools.json') : '',
  ].filter(Boolean);

  for (const configPath of configPaths) {
    try {
      const config = JSON.parse(await readFile(configPath, 'utf8'));
      const refreshToken = config.tokens?.refresh_token;

      if (typeof refreshToken === 'string' && refreshToken) {
        return refreshToken;
      }
    } catch {
      // Try the next known Firebase CLI config location.
    }
  }

  return '';
}

async function getAccessTokenFromRefreshToken(refreshToken) {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: FIREBASE_CLI_CLIENT_ID,
    client_secret: FIREBASE_CLI_CLIENT_SECRET,
    grant_type: 'refresh_token',
    scope: 'https://www.googleapis.com/auth/cloud-platform',
  });
  const response = await fetch('https://www.googleapis.com/oauth2/v3/token', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh Firebase CLI token: HTTP ${response.status}`);
  }

  return response.json();
}

async function getCredential() {
  const serviceAccountPath = getServiceAccountPath();

  if (serviceAccountPath) {
    const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));
    return cert(serviceAccount);
  }

  if (process.env.FIREBASE_ACCESS_TOKEN) {
    return {
      getAccessToken: async () => ({
        access_token: process.env.FIREBASE_ACCESS_TOKEN,
        expires_in: 3600,
      }),
    };
  }

  const refreshToken = await getFirebaseCliRefreshToken();

  if (!refreshToken) {
    throw new Error(
      'Missing credentials. Set FIREBASE_SERVICE_ACCOUNT_PATH, GOOGLE_APPLICATION_CREDENTIALS, FIREBASE_ACCESS_TOKEN, or run firebase login.'
    );
  }

  return {
    getAccessToken: async () => {
      const token = await getAccessTokenFromRefreshToken(refreshToken);

      return {
        access_token: token.access_token,
        expires_in: token.expires_in || 3600,
      };
    },
  };
}

export async function getAdminFirestore() {
  if (getApps().length === 0) {
    initializeApp({
      credential: await getCredential(),
      projectId: PROJECT_ID,
    });
  }

  return getFirestore();
}

export async function loadDemoSpotItems() {
  return JSON.parse(await readFile(demoSpotsPath, 'utf8'));
}

export function getCategoryIds(category) {
  return ['all', category];
}

export function getDemoSpotDocument(spot) {
  return {
    id: spot.id,
    title: spot.title,
    description: spot.description,
    category: spot.category,
    categoryId: spot.category,
    categoryIds: getCategoryIds(spot.category),
    bestTime: spot.bestTimeToShoot,
    bestTimeToShoot: spot.bestTimeToShoot,
    location: spot.locationName,
    locationName: spot.locationName,
    coordinates: {
      latitude: spot.latitude,
      longitude: spot.longitude,
    },
    latitude: spot.latitude,
    longitude: spot.longitude,
    images: spot.images,
    imageUrls: spot.images,
    imageStorageMode: 'hosted-demo-assets',
    creatorId: spot.creatorId,
    ownerId: spot.creatorId,
    createdBy: spot.creatorId,
    creatorUsername: spot.creatorUsername,
    creatorDisplayName: spot.creatorDisplayName,
    creatorAvatarUrl: '',
    creatorProfileImageUrl: '',
    creatorShowProfileImageInComments: false,
    visibility: 'public',
    isPublic: true,
    isPrivate: false,
    isRemoved: false,
    allowComments: false,
    favoriteCount: spot.favoriteCount,
    likeCount: spot.favoriteCount,
    isDemo: true,
    demoBatchId: DEMO_SPOT_BATCH_ID,
    demoSource: spot.imageCredit,
    createdAt: Timestamp.fromDate(new Date(spot.createdAt)),
    updatedAt: Timestamp.now(),
  };
}

export function getDemoCreatorDocument() {
  return {
    id: DEMO_SPOT_CREATOR_ID,
    userId: DEMO_SPOT_CREATOR_ID,
    username: 'spotzdemo',
    usernameLower: 'spotzdemo',
    normalizedUsername: 'spotzdemo',
    displayName: 'SPOTZ Demo',
    bio: 'Curated sample photo spots for SPOTZ screenshots and store review.',
    profileImageUrl: '',
    avatarUrl: '',
    showProfileImageInComments: false,
    isDemo: true,
    demoBatchId: DEMO_SPOT_BATCH_ID,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

export async function commitBatchIfNeeded(db, state, force = false) {
  if (state.operationCount === 0 || (!force && state.operationCount < BATCH_LIMIT)) {
    return;
  }

  await state.batch.commit();
  state.batch = db.batch();
  state.operationCount = 0;
}

export async function queueDeleteCollectionDocs(db, state, collectionRef) {
  const snapshot = await collectionRef.get();

  for (const documentSnapshot of snapshot.docs) {
    state.batch.delete(documentSnapshot.ref);
    state.operationCount += 1;
    await commitBatchIfNeeded(db, state);
  }
}
