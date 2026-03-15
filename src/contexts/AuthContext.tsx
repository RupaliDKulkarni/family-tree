import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, isConfigured } from '../services/firebase';
import { clearFolderCache } from '../services/GoogleDriveProvider';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoggedIn: boolean;
  isAuthLoading: boolean;
  isFirebaseConfigured: boolean;
  accessToken: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapUser(firebaseUser: User | null): AuthUser | null {
  if (!firebaseUser) return null;
  return {
    uid: firebaseUser.uid,
    displayName: firebaseUser.displayName,
    email: firebaseUser.email,
    photoURL: firebaseUser.photoURL,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(isConfigured);

  useEffect(() => {
    if (!auth || !isConfigured) {
      setIsAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(mapUser(firebaseUser));
      if (firebaseUser) {
        try {
          const tokenResult = await firebaseUser.getIdToken();
          // For Google OAuth access token, we need to get it from the credential
          // The access token is stored during sign-in; on refresh we re-fetch
          const stored = sessionStorage.getItem('gapi_access_token');
          if (stored) {
            setAccessToken(stored);
          }
          void tokenResult; // Firebase ID token available if needed
        } catch {
          setAccessToken(null);
        }
      } else {
        setAccessToken(null);
        sessionStorage.removeItem('gapi_access_token');
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = useCallback(async () => {
    if (!auth || !isConfigured) {
      console.warn('Firebase is not configured. Add your config to .env file.');
      return;
    }

    const provider = new GoogleAuthProvider();
    provider.addScope(DRIVE_SCOPE);

    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken || null;
      if (token) {
        setAccessToken(token);
        sessionStorage.setItem('gapi_access_token', token);
      }
      setUser(mapUser(result.user));
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        console.error('Sign-in failed:', error);
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!auth) return;
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setAccessToken(null);
      sessionStorage.removeItem('gapi_access_token');
      clearFolderCache();
    } catch (error) {
      console.error('Sign-out failed:', error);
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isLoggedIn: !!user,
      isAuthLoading,
      isFirebaseConfigured: isConfigured,
      accessToken,
      signIn,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
