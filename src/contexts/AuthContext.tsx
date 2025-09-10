import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { auth, isFirebaseAvailable } from '../services/firebase';

interface AuthContextType {
  currentUser: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  updateUserProfile: (displayName: string) => Promise<void>;
  loading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const login = async (email: string, password: string): Promise<void> => {
    if (!isFirebaseAvailable() || !auth) {
      throw new Error('Firebase authentication not available');
    }

    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ User logged in successfully:', result.user.email);
    } catch (error: any) {
      console.error('❌ Login error:', error);
      throw new Error(getAuthErrorMessage(error.code));
    }
  };

  const register = async (email: string, password: string, displayName?: string): Promise<void> => {
    if (!isFirebaseAvailable() || !auth) {
      throw new Error('Firebase authentication not available');
    }

    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update profile with display name if provided
      if (displayName && result.user) {
        await updateProfile(result.user, { displayName });
      }
      
      console.log('✅ User registered successfully:', result.user.email);
    } catch (error: any) {
      console.error('❌ Registration error:', error);
      throw new Error(getAuthErrorMessage(error.code));
    }
  };

  const loginWithGoogle = async (): Promise<void> => {
    if (!isFirebaseAvailable() || !auth) {
      throw new Error('Firebase authentication not available');
    }

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      console.log('✅ Google login successful:', result.user.email);
    } catch (error: any) {
      console.error('❌ Google login error:', error);
      throw new Error(getAuthErrorMessage(error.code));
    }
  };

  const logout = async (): Promise<void> => {
    if (!isFirebaseAvailable() || !auth) {
      throw new Error('Firebase authentication not available');
    }

    try {
      await signOut(auth);
      console.log('✅ User logged out successfully');
    } catch (error: any) {
      console.error('❌ Logout error:', error);
      throw new Error('Failed to log out');
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    if (!isFirebaseAvailable() || !auth) {
      throw new Error('Firebase authentication not available');
    }

    try {
      await sendPasswordResetEmail(auth, email);
      console.log('✅ Password reset email sent to:', email);
    } catch (error: any) {
      console.error('❌ Password reset error:', error);
      throw new Error(getAuthErrorMessage(error.code));
    }
  };

  const updateUserProfile = async (displayName: string): Promise<void> => {
    if (!currentUser) {
      throw new Error('No user is currently logged in');
    }

    try {
      await updateProfile(currentUser, { displayName });
      console.log('✅ Profile updated successfully');
    } catch (error: any) {
      console.error('❌ Profile update error:', error);
      throw new Error('Failed to update profile');
    }
  };

  useEffect(() => {
    if (!isFirebaseAvailable() || !auth) {
      console.log('⚠️ Firebase auth not available, skipping auth state listener');
      setLoading(false);
      return;
    }

    console.log('🔐 Setting up auth state listener...');
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('🔄 Auth state changed:', user ? `User: ${user.email}` : 'No user');
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value: AuthContextType = {
    currentUser,
    login,
    register,
    logout,
    resetPassword,
    loginWithGoogle,
    updateUserProfile,
    loading,
    isAuthenticated: !!currentUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Helper function to get user-friendly error messages
const getAuthErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case 'auth/user-not-found':
      return 'No account found with this email address.';
    case 'auth/wrong-password':
      return 'Incorrect password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/too-many-requests':
      return 'Too many failed login attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed. Please try again.';
    case 'auth/cancelled-popup-request':
      return 'Only one popup request is allowed at a time.';
    default:
      return 'Authentication failed. Please try again.';
  }
};

// Helper function to get current user ID for database operations
export const getCurrentUserId = (): string | null => {
  if (!isFirebaseAvailable() || !auth?.currentUser) {
    return null;
  }
  return auth.currentUser.uid;
};

// Helper function to get current user email
export const getCurrentUserEmail = (): string | null => {
  if (!isFirebaseAvailable() || !auth?.currentUser) {
    return null;
  }
  return auth.currentUser.email;
};

// Helper function to get current user display name
export const getCurrentUserDisplayName = (): string | null => {
  if (!isFirebaseAvailable() || !auth?.currentUser) {
    return null;
  }
  return auth.currentUser.displayName;
};