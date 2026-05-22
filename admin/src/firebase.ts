import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyC6afhVMAHyvex2hG6nPy4nt_lIGcWcEs0',
  authDomain: 'spotz-373c3.firebaseapp.com',
  projectId: 'spotz-373c3',
  storageBucket: 'spotz-373c3.firebasestorage.app',
  messagingSenderId: '173156871249',
  appId: '1:173156871249:web:5d85fc3af5ea599ee8dc70',
  measurementId: 'G-V67B96145T',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
