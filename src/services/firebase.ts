import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Validate that all required config is present
const validateConfig = () => {
  const requiredKeys = [
    'REACT_APP_FIREBASE_API_KEY',
    'REACT_APP_FIREBASE_AUTH_DOMAIN', 
    'REACT_APP_FIREBASE_PROJECT_ID',
    'REACT_APP_FIREBASE_STORAGE_BUCKET',
    'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
    'REACT_APP_FIREBASE_APP_ID'
  ];
  
  const missing = requiredKeys.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.warn('Missing Firebase environment variables:', missing.join(', '));
    console.warn('Firebase will be disabled. Add these to your Vercel environment variables.');
    return false;
  }
  
  return true;
};

// Initialize Firebase
let app: any = null;
let db: any = null;
let auth: any = null;
let isFirebaseEnabled = false;

if (validateConfig()) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    isFirebaseEnabled = true;
    
    console.log('Firebase initialized successfully');
    
    // Connect to emulators in development
    if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_FIREBASE_EMULATORS === 'true') {
      try {
        connectFirestoreEmulator(db, 'localhost', 8080);
        connectAuthEmulator(auth, 'http://localhost:9099');
        console.log('Connected to Firebase emulators');
      } catch (error) {
        console.log('Firebase emulators not available, using production');
      }
    }
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    isFirebaseEnabled = false;
  }
} else {
  console.log('Firebase disabled - environment variables not configured');
}

// Export Firebase services
export { db, auth, isFirebaseEnabled };
export default app;

// Helper function to check if Firebase is available
export const isFirebaseAvailable = (): boolean => {
  return isFirebaseEnabled && db !== null;
};

// Collection names
export const COLLECTIONS = {
  USERS: 'users',
  TRANSACTIONS: 'transactions',
  ESTIMATES: 'estimates',
  CASHFLOW_SESSIONS: 'cashflow_sessions',
  USER_SETTINGS: 'user_settings'
} as const;

// Data structure interfaces for Firebase
export interface FirebaseTransaction {
  id: string;
  userId: string;
  sessionId: string;
  date: string; // ISO string
  description: string;
  amount: number;
  type: 'inflow' | 'outflow';
  category: string;
  subcategory?: string;
  balance: number;
  rawData: any; // Original CSV data
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface FirebaseEstimate {
  id: string;
  userId: string;
  sessionId: string;
  amount: number;
  type: 'inflow' | 'outflow';
  category: string;
  description: string;
  notes?: string;
  weekNumber: number;
  isRecurring: boolean;
  recurringType?: 'weekly' | 'bi-weekly' | 'monthly';
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface FirebaseCashflowSession {
  id: string;
  userId: string;
  name: string;
  description?: string;
  startingBalance: number;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  isActive: boolean;
  transactionCount: number;
  estimateCount: number;
  dateRange: {
    start: string; // ISO string
    end: string; // ISO string
  } | null;
}

export interface FirebaseUserSettings {
  userId: string;
  defaultCurrency: string;
  dateFormat: string;
  weekStartsOn: number; // 0 = Sunday, 1 = Monday
  defaultCategories: {
    inflow: string[];
    outflow: string[];
  };
  notifications: {
    emailEnabled: boolean;
    weeklyReports: boolean;
    lowBalanceAlerts: boolean;
    lowBalanceThreshold: number;
  };
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}