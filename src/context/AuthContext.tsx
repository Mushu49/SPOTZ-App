import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type ActionCodeSettings,
  type User as FirebaseUser,
} from '@firebase/auth';
import { doc, getDoc, onSnapshot, runTransaction, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../services/firebase';
import { deleteAccountData } from '../services/accountDeletion';
import { upsertPublicCreatorProfile } from '../services/publicProfiles';
import { clearPersistedImagesAsync } from '../utils/images';

const AUTH_SESSION_KEY = '@spotz_auth_session';
const ACCOUNT_DELETION_RECENT_LOGIN_WINDOW_MS = 5 * 60 * 1000;
const REMEMBER_ME_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const USERNAME_TAKEN_MESSAGE = 'This username is already taken.';
const USERNAME_FORMAT_MESSAGE = 'Username can only use letters, numbers, and underscores.';
const USERNAME_NOT_FOUND_MESSAGE = 'No account found with that username.';
const PASSWORD_RESET_CONTINUE_URL = 'https://spotzapp.app/';
const FOUNDER_PROGRAM_MAX_FOUNDERS = 500;
const FOUNDER_PRO_MONTHS = 24;
export const CURRENT_TERMS_VERSION = '2026-05-20';

const PASSWORD_RESET_ACTION_CODE_SETTINGS: ActionCodeSettings = {
  url: PASSWORD_RESET_CONTINUE_URL,
  handleCodeInApp: false,
};

type AuthSession = {
  uid: string;
  rememberMe: boolean;
  createdAt: number;
  expiresAt: number | null;
};

type PendingSession = {
  rememberMe: boolean;
  allowAuthState: boolean;
};

export type AccountBanStatus = {
  isBanned: boolean;
  banReason?: string;
  bannedAt?: Date;
  bannedBy?: string;
};

type AuthContextType = {
  firebaseUser: FirebaseUser | null;
  isAuthLoading: boolean;
  isTermsLoading: boolean;
  isBanLoading: boolean;
  hasAcceptedTerms: boolean;
  accountBan: AccountBanStatus;
  login: (identifier: string, password: string, rememberMe: boolean) => Promise<void>;
  signUp: (username: string, email: string, password: string) => Promise<void>;
  acceptTerms: () => Promise<void>;
  declineTerms: () => Promise<void>;
  sendResetEmail: (email: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const activeAccountBan: AccountBanStatus = {
  isBanned: false,
};

function getAuthErrorMessage(error: unknown) {
  const code = getErrorCode(error);
  const rawMessage = getErrorMessage(error);

  if (error instanceof Error) {
    if (
      error.message === USERNAME_TAKEN_MESSAGE ||
      error.message === USERNAME_FORMAT_MESSAGE ||
      error.message === USERNAME_NOT_FOUND_MESSAGE
    ) {
      return error.message;
    }
  }

  switch (code) {
    case 'auth/email-already-in-use':
      return 'That email is already connected to a SPOTZ account.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Email or password is incorrect.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/operation-not-allowed':
      return 'Email/password login is not enabled for this Firebase project.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again in a little while.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/requires-recent-login':
      return 'For your security, please log out and log back in, then return to Delete Account.';
    case 'permission-denied':
    case 'firestore/permission-denied':
      return 'Firestore permission denied. Check rules for users and usernames during testing.';
    default:
      return rawMessage || 'Something went wrong. Please try again.';
  }
}

function getPasswordResetErrorMessage(error: unknown) {
  switch (getErrorCode(error)) {
    case 'auth/invalid-email':
      return 'Enter a valid email address, like name@example.com.';
    case 'auth/too-many-requests':
      return 'Too many reset attempts. Wait a few minutes, then try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/operation-not-allowed':
      return 'Password reset is not enabled for this Firebase project.';
    case 'auth/unauthorized-continue-uri':
    case 'auth/invalid-continue-uri':
    case 'auth/missing-continue-uri':
      return 'Password reset is not configured correctly. Please try again later.';
    default:
      return getAuthErrorMessage(error);
  }
}

function getErrorCode(error: unknown) {
  if (typeof error === 'object' && error && 'code' in error) {
    return String((error as { code?: string }).code);
  }

  return '';
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message?: string }).message);
  }
  if (typeof error === 'string') return error;
  return '';
}

function isPermissionDeniedError(error: unknown) {
  return getErrorCode(error).includes('permission-denied');
}

function logAuthError(action: string, error: unknown) {
  console.error(`[Auth] ${action} failed`, {
    code: getErrorCode(error) || 'unknown',
    message: getErrorMessage(error) || String(error),
    stack: error instanceof Error ? error.stack : undefined,
    error,
  });
}

function getNormalizedUsername(username: string) {
  return username.trim().toLowerCase();
}

type FirestoreDate = { toDate?: () => Date } | Date | string | number | null | undefined;

function getDate(value: FirestoreDate) {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value.toDate) return value.toDate();
  if (typeof value === 'object') return undefined;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function addMonths(date: Date, months: number) {
  const nextDate = new Date(date);
  const originalDay = nextDate.getDate();

  nextDate.setMonth(nextDate.getMonth() + months);

  if (nextDate.getDate() !== originalDay) {
    nextDate.setDate(0);
  }

  return nextDate;
}

async function getAccountBanStatus(uid: string): Promise<AccountBanStatus> {
  if (!db || !uid) return activeAccountBan;

  const userSnapshot = await getDoc(doc(db, 'users', uid));

  if (!userSnapshot.exists()) return activeAccountBan;

  const data = userSnapshot.data();
  const isBanned = data.isBanned === true;

  return {
    isBanned,
    banReason: isBanned && typeof data.banReason === 'string' ? data.banReason.trim() : undefined,
    bannedAt: isBanned ? getDate(data.bannedAt) : undefined,
    bannedBy: isBanned && typeof data.bannedBy === 'string' ? data.bannedBy.trim() : undefined,
  };
}

function getAccountBanStatusFromData(data: Record<string, unknown>): AccountBanStatus {
  const isBanned = data.isBanned === true;

  return {
    isBanned,
    banReason: isBanned && typeof data.banReason === 'string' ? data.banReason.trim() : undefined,
    bannedAt: isBanned ? getDate(data.bannedAt as FirestoreDate) : undefined,
    bannedBy: isBanned && typeof data.bannedBy === 'string' ? data.bannedBy.trim() : undefined,
  };
}

function validateUsername(username: string) {
  const cleanUsername = username.trim();
  const normalizedUsername = getNormalizedUsername(cleanUsername);

  if (!cleanUsername || cleanUsername.length > 20 || !/^[A-Za-z0-9_]+$/.test(cleanUsername)) {
    throw new Error(USERNAME_FORMAT_MESSAGE);
  }

  return { cleanUsername, normalizedUsername };
}

async function getStoredSession() {
  const storedSession = await AsyncStorage.getItem(AUTH_SESSION_KEY);
  return storedSession ? JSON.parse(storedSession) as AuthSession : null;
}

async function saveSession(uid: string, rememberMe: boolean) {
  const now = Date.now();
  const session: AuthSession = {
    uid,
    rememberMe,
    createdAt: now,
    expiresAt: rememberMe ? now + REMEMBER_ME_DURATION_MS : null,
  };

  await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

function wasRecentlySignedIn(user: FirebaseUser) {
  const lastSignInTime = user.metadata.lastSignInTime;
  if (!lastSignInTime) return false;

  const lastSignInMs = new Date(lastSignInTime).getTime();
  if (!Number.isFinite(lastSignInMs)) return false;

  return Date.now() - lastSignInMs <= ACCOUNT_DELETION_RECENT_LOGIN_WINDOW_MS;
}

async function clearLocalAccountData(uid: string) {
  await Promise.all([
    AsyncStorage.multiRemove([
      AUTH_SESSION_KEY,
      `@spotz_user_${uid}`,
      '@spotz_settings',
      '@spotz_device_id',
      '@spotz_onboarding_completed',
    ]),
    clearPersistedImagesAsync(),
  ]);
}

async function resolveLoginEmail(identifier: string) {
  const cleanIdentifier = identifier.trim();

  if (cleanIdentifier.includes('@')) return cleanIdentifier;
  if (!db) throw new Error('Firestore is not configured.');

  const normalizedUsername = getNormalizedUsername(cleanIdentifier);
  const usernameSnapshot = await getDoc(doc(db, 'usernames', normalizedUsername));

  if (!usernameSnapshot.exists()) {
    throw new Error(USERNAME_NOT_FOUND_MESSAGE);
  }

  const usernameData = usernameSnapshot.data();
  const usernameEmail = typeof usernameData.email === 'string' ? usernameData.email.trim() : '';

  if (usernameEmail) return usernameEmail;

  const userId = typeof usernameData.userId === 'string' ? usernameData.userId : '';
  if (!userId) throw new Error(USERNAME_NOT_FOUND_MESSAGE);

  const userSnapshot = await getDoc(doc(db, 'users', userId));
  const userEmail = userSnapshot.exists() && typeof userSnapshot.data().email === 'string'
    ? userSnapshot.data().email.trim()
    : '';

  if (!userEmail) throw new Error(USERNAME_NOT_FOUND_MESSAGE);

  return userEmail;
}

async function hasAcceptedCurrentTerms(uid: string) {
  if (!db || !uid) return false;

  const userSnapshot = await getDoc(doc(db, 'users', uid));

  if (!userSnapshot.exists()) return false;

  const data = userSnapshot.data();
  return data.acceptedTerms === true && data.acceptedTermsVersion === CURRENT_TERMS_VERSION;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isTermsLoading, setIsTermsLoading] = useState(false);
  const [isBanLoading, setIsBanLoading] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [accountBan, setAccountBan] = useState<AccountBanStatus>(activeAccountBan);
  const pendingSessionRef = useRef<PendingSession | null>(null);
  const activeNonRememberedSessionRef = useRef<string | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearExpiryTimer = useCallback(() => {
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  }, []);

  const logout = useCallback(async () => {
    clearExpiryTimer();
    activeNonRememberedSessionRef.current = null;
    await AsyncStorage.removeItem(AUTH_SESSION_KEY);
    setHasAcceptedTerms(false);
    setIsTermsLoading(false);
    setIsBanLoading(false);
    setAccountBan(activeAccountBan);
    if (auth) {
      await signOut(auth);
    }
    setFirebaseUser(null);
  }, [clearExpiryTimer]);

  const enforceSession = useCallback(async (user: FirebaseUser | null) => {
    clearExpiryTimer();

    if (!user) {
      setFirebaseUser(null);
      setHasAcceptedTerms(false);
      setIsTermsLoading(false);
      setIsBanLoading(false);
      setAccountBan(activeAccountBan);
      setIsAuthLoading(false);
      return;
    }

    if (pendingSessionRef.current) {
      if (!pendingSessionRef.current.allowAuthState) {
        setFirebaseUser(null);
        setIsAuthLoading(false);
        return;
      }

      setIsTermsLoading(true);
      setIsBanLoading(true);
      setFirebaseUser(user);
      try {
        const [hasAcceptedTermsResult, accountBanResult] = await Promise.all([
          hasAcceptedCurrentTerms(user.uid),
          getAccountBanStatus(user.uid),
        ]);
        setHasAcceptedTerms(hasAcceptedTermsResult);
        setAccountBan(accountBanResult);
      } catch (error) {
        console.error('Failed to check account status', error);
        setHasAcceptedTerms(false);
        setAccountBan(activeAccountBan);
      } finally {
        setIsTermsLoading(false);
        setIsBanLoading(false);
      }
      setIsAuthLoading(false);
      return;
    }

    const session = await getStoredSession();

    if (!session || session.uid !== user.uid) {
      await logout();
      setIsAuthLoading(false);
      return;
    }

    if (!session.rememberMe && activeNonRememberedSessionRef.current !== user.uid) {
      await logout();
      setIsAuthLoading(false);
      return;
    }

    if (session.expiresAt && session.expiresAt <= Date.now()) {
      await logout();
      setIsAuthLoading(false);
      return;
    }

    if (session.expiresAt) {
      expiryTimerRef.current = setTimeout(() => {
        logout().catch((error) => console.error('Failed to expire auth session', error));
      }, session.expiresAt - Date.now());
    }

    setIsTermsLoading(true);
    setIsBanLoading(true);
    setFirebaseUser(user);
    try {
      const [hasAcceptedTermsResult, accountBanResult] = await Promise.all([
        hasAcceptedCurrentTerms(user.uid),
        getAccountBanStatus(user.uid),
      ]);
      setHasAcceptedTerms(hasAcceptedTermsResult);
      setAccountBan(accountBanResult);
    } catch (error) {
      console.error('Failed to check account status', error);
      setHasAcceptedTerms(false);
      setAccountBan(activeAccountBan);
    } finally {
      setIsTermsLoading(false);
      setIsBanLoading(false);
    }
    setIsAuthLoading(false);
  }, [clearExpiryTimer, logout]);

  useEffect(() => {
    if (!auth || !isFirebaseConfigured) {
      setIsAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      enforceSession(user).catch((error) => {
        console.error('Failed to restore auth session', error);
        setFirebaseUser(null);
        setIsAuthLoading(false);
      });
    });

    return () => {
      clearExpiryTimer();
      unsubscribe();
    };
  }, [clearExpiryTimer, enforceSession]);

  useEffect(() => {
    if (!db || !firebaseUser?.uid) return;

    const unsubscribe = onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      (snapshot) => {
        const nextAccountBan = snapshot.exists()
          ? getAccountBanStatusFromData(snapshot.data())
          : activeAccountBan;

        setAccountBan(nextAccountBan);

        if (nextAccountBan.isBanned) {
          setHasAcceptedTerms(false);
          setIsTermsLoading(false);
          setIsBanLoading(false);
        }
      },
      (error) => {
        if (isPermissionDeniedError(error)) {
          return;
        }

        console.error('Failed to listen for account ban status', error);
      }
    );

    return unsubscribe;
  }, [firebaseUser?.uid]);

  const login = useCallback(async (identifier: string, password: string, rememberMe: boolean) => {
    if (!auth) throw new Error('Firebase Auth is not configured.');

    pendingSessionRef.current = { rememberMe, allowAuthState: true };

    try {
      const resolvedEmail = await resolveLoginEmail(identifier);
      const credential = await signInWithEmailAndPassword(auth, resolvedEmail, password);
      await saveSession(credential.user.uid, rememberMe);
      activeNonRememberedSessionRef.current = rememberMe ? null : credential.user.uid;
      setIsTermsLoading(true);
      setIsBanLoading(true);
      setFirebaseUser(credential.user);
      try {
        const [hasAcceptedTermsResult, accountBanResult] = await Promise.all([
          hasAcceptedCurrentTerms(credential.user.uid),
          getAccountBanStatus(credential.user.uid),
        ]);
        setHasAcceptedTerms(hasAcceptedTermsResult);
        setAccountBan(accountBanResult);
      } finally {
        setIsTermsLoading(false);
        setIsBanLoading(false);
      }
    } catch (error) {
      logAuthError('Login', error);
      throw new Error(getAuthErrorMessage(error));
    } finally {
      pendingSessionRef.current = null;
    }
  }, []);

  const signUp = useCallback(async (username: string, email: string, password: string) => {
    if (!auth) throw new Error('Firebase Auth is not configured.');
    if (!db) throw new Error('Firestore is not configured.');
    const firestore = db;

    const { cleanUsername, normalizedUsername } = validateUsername(username);
    const cleanEmail = email.trim();
    const usernameRef = doc(firestore, 'usernames', normalizedUsername);
    const founderProgramRef = doc(firestore, 'appConfig', 'founderProgram');

    const reservationId = `signup-${Date.now()}-${Math.round(Math.random() * 100000)}`;
    let createdUser: FirebaseUser | null = null;
    let hasReservedUsername = false;
    let hasCompletedProfile = false;

    try {
      await runTransaction(firestore, async (transaction) => {
        const usernameSnapshot = await transaction.get(usernameRef);

        if (usernameSnapshot.exists()) {
          throw new Error(USERNAME_TAKEN_MESSAGE);
        }

        transaction.set(usernameRef, {
          reservationId,
          status: 'pending',
          username: cleanUsername,
          originalUsername: cleanUsername,
          normalizedUsername,
          usernameLower: normalizedUsername,
          email: cleanEmail,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      hasReservedUsername = true;

      pendingSessionRef.current = { rememberMe: true, allowAuthState: false };
      const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      createdUser = credential.user;
      await updateProfile(credential.user, { displayName: cleanUsername });

      await runTransaction(firestore, async (transaction) => {
        const usernameSnapshot = await transaction.get(usernameRef);
        const usernameData = usernameSnapshot.exists() ? usernameSnapshot.data() : null;
        const founderProgramSnapshot = await transaction.get(founderProgramRef);

        if (
          !usernameSnapshot.exists() ||
          usernameData?.reservationId !== reservationId ||
          (usernameData?.userId && usernameData.userId !== credential.user.uid)
        ) {
          throw new Error(USERNAME_TAKEN_MESSAGE);
        }

        const founderProgramData = founderProgramSnapshot.exists() ? founderProgramSnapshot.data() : {};
        const maxFounders = Number(founderProgramData.maxFounders) || FOUNDER_PROGRAM_MAX_FOUNDERS;
        const claimedCount = Math.max(0, Number(founderProgramData.claimedCount) || 0);
        const shouldGrantFounder = claimedCount < maxFounders;
        const founderNumber = shouldGrantFounder ? claimedCount + 1 : null;
        const founderGrantedAtDate = new Date();
        const founderGrantedAt = shouldGrantFounder ? Timestamp.fromDate(founderGrantedAtDate) : null;
        const proUntil = shouldGrantFounder
          ? Timestamp.fromDate(addMonths(founderGrantedAtDate, FOUNDER_PRO_MONTHS))
          : null;

        if (shouldGrantFounder && founderNumber) {
          transaction.set(founderProgramRef, {
            maxFounders,
            claimedCount: founderNumber,
          }, { merge: true });
        }

        transaction.set(usernameRef, {
          userId: credential.user.uid,
          reservationId,
          status: 'active',
          username: cleanUsername,
          originalUsername: cleanUsername,
          normalizedUsername,
          usernameLower: normalizedUsername,
          email: credential.user.email || cleanEmail,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        transaction.set(doc(firestore, 'users', credential.user.uid), {
          id: credential.user.uid,
          userId: credential.user.uid,
          email: credential.user.email || cleanEmail,
          username: cleanUsername,
          usernameLower: normalizedUsername,
          normalizedUsername,
          displayName: cleanUsername,
          bio: '',
          profileImageUrl: '',
          avatarUrl: '',
          showProfileImageInComments: true,
          isBanned: false,
          isFounder: shouldGrantFounder,
          founderNumber,
          founderGrantedAt,
          proUntil,
          proSource: shouldGrantFounder ? 'founder' : null,
          acceptedTerms: true,
          acceptedTermsAt: serverTimestamp(),
          acceptedTermsVersion: CURRENT_TERMS_VERSION,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        transaction.set(doc(firestore, 'publicProfiles', credential.user.uid), {
          id: credential.user.uid,
          userId: credential.user.uid,
          username: cleanUsername,
          usernameLower: normalizedUsername,
          normalizedUsername,
          displayName: cleanUsername,
          bio: '',
          profileImageUrl: '',
          avatarUrl: '',
          showProfileImageInComments: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      hasCompletedProfile = true;

      await credential.user.reload();
      await saveSession(credential.user.uid, true);
      pendingSessionRef.current = { rememberMe: true, allowAuthState: true };
      setFirebaseUser(auth.currentUser || credential.user);
      setAccountBan(activeAccountBan);
      setHasAcceptedTerms(true);
      setIsTermsLoading(false);
      setIsBanLoading(false);
    } catch (error) {
      logAuthError('Sign up', error);
      if (createdUser && !hasCompletedProfile) {
        try {
          await deleteUser(createdUser);
        } catch (deleteError) {
          logAuthError('Incomplete sign-up cleanup', deleteError);
        }
      }
      if (hasReservedUsername && !hasCompletedProfile) {
        try {
          await runTransaction(firestore, async (transaction) => {
            const usernameSnapshot = await transaction.get(usernameRef);

            if (
              usernameSnapshot.exists() &&
              usernameSnapshot.data().reservationId === reservationId &&
              !usernameSnapshot.data().userId
            ) {
              transaction.delete(usernameRef);
            }
          });
        } catch (reservationCleanupError) {
          logAuthError('Username reservation cleanup', reservationCleanupError);
        }
      }
      if (auth.currentUser && !hasCompletedProfile) {
        try {
          await signOut(auth);
        } catch (signOutError) {
          logAuthError('Incomplete sign-up sign out', signOutError);
        }
      }
      setFirebaseUser(null);
      throw new Error(getAuthErrorMessage(error));
    } finally {
      pendingSessionRef.current = null;
    }
  }, []);

  const acceptTerms = useCallback(async () => {
    if (!auth?.currentUser) throw new Error('No authenticated user.');
    if (!db) throw new Error('Firestore is not configured.');

    setIsTermsLoading(true);

    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid), {
        acceptedTerms: true,
        acceptedTermsAt: serverTimestamp(),
        acceptedTermsVersion: CURRENT_TERMS_VERSION,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      await upsertPublicCreatorProfile({
        id: auth.currentUser.uid,
        username: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Photographer',
        displayName: auth.currentUser.displayName || undefined,
        showProfileImageInComments: true,
      });
      setHasAcceptedTerms(true);
    } finally {
      setIsTermsLoading(false);
    }
  }, []);

  const declineTerms = useCallback(async () => {
    await logout();
  }, [logout]);

  const sendResetEmail = useCallback(async (email: string) => {
    if (!auth) throw new Error('Firebase Auth is not configured.');

    try {
      await sendPasswordResetEmail(auth, email.trim(), PASSWORD_RESET_ACTION_CODE_SETTINGS);
    } catch (error) {
      logAuthError('Password reset', error);
      if (getErrorCode(error) === 'auth/user-not-found') {
        return;
      }
      throw new Error(getPasswordResetErrorMessage(error));
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!auth?.currentUser) throw new Error('No authenticated user.');
    if (!db) throw new Error('Firestore is not configured.');

    const currentUser = auth.currentUser;
    await currentUser.reload();

    if (!wasRecentlySignedIn(currentUser)) {
      throw new Error(getAuthErrorMessage({ code: 'auth/requires-recent-login' }));
    }

    try {
      clearExpiryTimer();
      await deleteAccountData(db, currentUser.uid);
      await clearLocalAccountData(currentUser.uid);
      await deleteUser(currentUser);
      activeNonRememberedSessionRef.current = null;
      setFirebaseUser(null);
      setHasAcceptedTerms(false);
      setIsTermsLoading(false);
      setIsBanLoading(false);
      setAccountBan(activeAccountBan);
    } catch (error) {
      logAuthError('Delete account', error);
      throw new Error(getAuthErrorMessage(error));
    }
  }, [clearExpiryTimer]);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        isAuthLoading,
        isTermsLoading,
        isBanLoading,
        hasAcceptedTerms,
        accountBan,
        login,
        signUp,
        acceptTerms,
        declineTerms,
        sendResetEmail,
        deleteAccount,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
