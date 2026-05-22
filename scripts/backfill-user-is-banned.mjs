import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const PROJECT_ID = 'spotz-373c3';
const BATCH_LIMIT = 450;
const shouldWrite = process.argv.includes('--yes-backfill-is-banned');
const FIREBASE_CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

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

async function getFirebaseCliAccessToken() {
  if (process.env.FIREBASE_ACCESS_TOKEN) {
    return process.env.FIREBASE_ACCESS_TOKEN;
  }

  const refreshToken = await getFirebaseCliRefreshToken();

  if (!refreshToken) {
    throw new Error(
      'Missing credentials. Set FIREBASE_SERVICE_ACCOUNT_PATH, GOOGLE_APPLICATION_CREDENTIALS, FIREBASE_ACCESS_TOKEN, or run firebase login.'
    );
  }

  const token = await getAccessTokenFromRefreshToken(refreshToken);
  return token.access_token;
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

async function requestFirestore(accessToken, path, init = {}) {
  const response = await fetch(`https://firestore.googleapis.com/v1/${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Firestore REST request failed: HTTP ${response.status} ${body}`);
  }

  return response.json();
}

async function runWithFirebaseCliAuth() {
  const accessToken = await getFirebaseCliAccessToken();
  const documents = [];
  let pageToken = '';

  do {
    const params = new URLSearchParams({ pageSize: '300' });

    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const result = await requestFirestore(
      accessToken,
      `projects/${PROJECT_ID}/databases/(default)/documents/users?${params.toString()}`
    );

    documents.push(...(result.documents || []));
    pageToken = result.nextPageToken || '';
  } while (pageToken);

  const docsMissingIsBanned = documents.filter((document) => !document.fields?.isBanned);

  console.log(`Scanned ${documents.length} user document(s).`);
  console.log(`Will update ${docsMissingIsBanned.length} user document(s) missing isBanned.`);
  console.log('Users with isBanned: true will not be changed.');

  if (!shouldWrite) {
    console.log('Dry run only. Re-run with --yes-backfill-is-banned to apply the backfill.');
    return;
  }

  let updatedCount = 0;

  for (let index = 0; index < docsMissingIsBanned.length; index += BATCH_LIMIT) {
    const chunk = docsMissingIsBanned.slice(index, index + BATCH_LIMIT);

    await requestFirestore(
      accessToken,
      `projects/${PROJECT_ID}/databases/(default)/documents:commit`,
      {
        method: 'POST',
        body: JSON.stringify({
          writes: chunk.map((document) => ({
            update: {
              name: document.name,
              fields: {
                isBanned: { booleanValue: false },
              },
            },
            updateMask: {
              fieldPaths: ['isBanned'],
            },
            updateTransforms: [
              {
                fieldPath: 'updatedAt',
                setToServerValue: 'REQUEST_TIME',
              },
            ],
            currentDocument: {
              exists: true,
            },
          })),
        }),
      }
    );

    updatedCount += chunk.length;
  }

  console.log(`Backfill complete. Updated ${updatedCount} user document(s).`);
}

async function runWithServiceAccount() {
  if (getApps().length === 0) {
    initializeApp({
      credential: await getCredential(),
      projectId: PROJECT_ID,
    });
  }

  const db = getFirestore();
  const snapshot = await db.collection('users').get();
  const docsMissingIsBanned = snapshot.docs.filter((userDoc) => !Object.hasOwn(userDoc.data(), 'isBanned'));

  console.log(`Scanned ${snapshot.size} user document(s).`);
  console.log(`Will update ${docsMissingIsBanned.length} user document(s) missing isBanned.`);
  console.log('Users with isBanned: true will not be changed.');

  if (!shouldWrite) {
    console.log('Dry run only. Re-run with --yes-backfill-is-banned to apply the backfill.');
    return;
  }

  let batch = db.batch();
  let operationCount = 0;
  let updatedCount = 0;

  for (const userDoc of docsMissingIsBanned) {
    batch.update(userDoc.ref, {
      isBanned: false,
      updatedAt: FieldValue.serverTimestamp(),
    });
    operationCount += 1;
    updatedCount += 1;

    if (operationCount >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      operationCount = 0;
    }
  }

  if (operationCount > 0) {
    await batch.commit();
  }

  console.log(`Backfill complete. Updated ${updatedCount} user document(s).`);
}

async function main() {
  if (getServiceAccountPath()) {
    await runWithServiceAccount();
    return;
  }

  await runWithFirebaseCliAuth();
}

main().catch((error) => {
  console.error('[Backfill] Failed to backfill users.isBanned', error);
  process.exitCode = 1;
});
