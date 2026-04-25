// Firebase Client SDK for browser-side operations
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  IdTokenResult,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Initialize Firebase (uses NEXT_PUBLIC_* env variables)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Validate config
if (!firebaseConfig.apiKey) {
  console.warn('[Firebase] Configuration missing. Add NEXT_PUBLIC_FIREBASE_* environment variables.');
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable offline persistence
export async function enableOfflinePersistence() {
  try {
    const { enableIndexedDbPersistence } = await import('firebase/firestore');
    await enableIndexedDbPersistence(db);
  } catch (error) {
    if ((error as any).code === 'failed-precondition') {
      console.warn('[Firebase] Multiple tabs open, persistence disabled');
    } else if ((error as any).code === 'unimplemented') {
      console.warn('[Firebase] Browser does not support offline persistence');
    } else {
      console.error('[Firebase] Persistence error:', error);
    }
  }
}

// Auth Helper Functions
export async function loginWithEmail(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function registerWithEmail(email: string, password: string): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function logout(): Promise<void> {
  await signOut(auth);
}

export async function getCurrentUser(): Promise<User | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export async function getIdToken(user: User): Promise<string> {
  return user.getIdToken();
}

export async function getIdTokenResult(user: User): Promise<IdTokenResult> {
  return user.getIdTokenResult();
}

// Hook wrapper for React (if needed separately)
export function useAuthState() {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return { user, loading };
}

// Store token in localStorage for API calls
export async function storeAuthToken(user: User) {
  const token = await user.getIdToken();
  localStorage.setItem('firebase_token', token);
  
  // Refresh token before expiry
  user.getIdTokenResult().then((result) => {
    const refreshIn = result.expirationTime.getTime() - Date.now() - 60000; // Refresh 1 min before expiry
    setTimeout(() => {
      storeAuthToken(user);
    }, refreshIn);
  });
}

// Get token for API calls
export function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('firebase_token');
  }
  return null;
}

// Clear stored token on logout
export function clearAuthToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('firebase_token');
  }
}

// Import React for hooks
import React from 'react';
