import { initializeApp, getApp, getApps } from 'firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore';
import {
  getAuth,
  initializeAuth,
  type Auth,
  type Persistence,
} from '@firebase/auth';

const defaultFirebaseConfig = {
  apiKey: 'AIzaSyC6afhVMAHyvex2hG6nPy4nt_lIGcWcEs0',
  authDomain: 'spotz-373c3.firebaseapp.com',
  projectId: 'spotz-373c3',
  storageBucket: 'spotz-373c3.firebasestorage.app',
  messagingSenderId: '173156871249',
  appId: '1:173156871249:web:5d85fc3af5ea599ee8dc70',
  measurementId: 'G-V67B96145T',
};

const firebaseConfig = defaultFirebaseConfig;

export const isFirebaseConfigured = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.storageBucket,
  firebaseConfig.messagingSenderId,
  firebaseConfig.appId,
].every(Boolean);

export const firebaseApp = isFirebaseConfigured
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

function getAsyncStoragePersistence(storage: typeof AsyncStorage): Persistence {
  class AsyncStoragePersistence {
    static type = 'LOCAL';
    readonly type = 'LOCAL' as const;

    async _isAvailable() {
      try {
        await storage.setItem('@spotz_auth_storage_test', '1');
        await storage.removeItem('@spotz_auth_storage_test');
        return true;
      } catch {
        return false;
      }
    }

    _set(key: string, value: unknown) {
      return storage.setItem(key, JSON.stringify(value));
    }

    async _get<T>(key: string): Promise<T | null> {
      const json = await storage.getItem(key);
      return json ? JSON.parse(json) as T : null;
    }

    _remove(key: string) {
      return storage.removeItem(key);
    }

    _addListener() {}

    _removeListener() {}
  }

  return AsyncStoragePersistence as unknown as Persistence;
}

function initializeFirebaseAuth(): Auth | null {
  if (!firebaseApp) return null;

  try {
    return initializeAuth(firebaseApp, {
      persistence: getAsyncStoragePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(firebaseApp);
  }
}

function initializeFirebaseFirestore(): Firestore | null {
  if (!firebaseApp) return null;

  if (Platform.OS !== 'android') {
    return getFirestore(firebaseApp);
  }

  try {
    return initializeFirestore(firebaseApp, {
      experimentalForceLongPolling: true,
    });
  } catch {
    return getFirestore(firebaseApp);
  }
}

export const auth = initializeFirebaseAuth();
export const db = initializeFirebaseFirestore();
