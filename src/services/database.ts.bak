import {
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import {
  db,
  auth,
  isFirebaseAvailable,
  COLLECTIONS
} from './firebase';
import { Transaction, Estimate } from '../types';

// Firebase document interfaces
interface FirebaseCashflowSession {
  id: string;
  name: string;
  description: string;
  startDate: string; // ISO string
  endDate: string; // ISO string
  scenarios: string[];
  activeScenario: string;
  startingBalance: number;
  transactionCount: number;
  estimateCount: number;
  isActive: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

interface FirebaseTransaction {
  id: string;
  hash: string;
  userId: string;
  sessionId: string;
  date: any; // Firestore timestamp
  description: string;
  amount: number;
  type: 'inflow' | 'outflow';
  category: string;
  subcategory?: string;
  balance: number;
  rawData: any;
  createdAt: any;
  updatedAt: any;
}

interface FirebaseEstimate {
  id: string;
  userId: string;
  sessionId: string;
  amount: number;
  type: 'inflow' | 'outflow';
  category: string;
  description: string;
  notes?: string;
  weekDate: string; // ISO string for specific week
  scenario: string; // scenario name
  isRecurring: boolean;
  recurringType?: 'weekly' | 'bi-weekly' | 'monthly';
  createdAt: string;
  updatedAt: string;
}

interface FirebaseUserSettings {
  id: string;
  userId: string;
  theme: string;
  currency: string;
  dateFormat: string;
  createdAt: string;
  updatedAt: string;
}

// Types for database operations
export interface DatabaseError {
  code: string;
  message: string;
}

export type DatabaseResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: DatabaseError;
};

// Helper function to handle database operations
export const withFirebase = async <T>(
  operation: () => Promise<T>
): Promise<DatabaseResult<T>> => {
  if (!isFirebaseAvailable()) {
    return {
      success: false,
      error: {
        code: 'firebase-unavailable',
        message: 'Firebase is not configured or available'
      }
    };
  }

  try {
    const data = await operation();
    return { success: true, data };
  } catch (error: any) {
    console.error('Database operation failed:', error);
    return {
      success: false,
      error: {
        code: error.code || 'unknown-error',
        message: error.message || 'An unknown error occurred'
      }
    };
  }
};

// Convert between Firebase and app interfaces
const sessionFromFirebase = (firebaseSession: FirebaseCashflowSession): any => ({
  id: firebaseSession.id,
  name: firebaseSession.name,
  description: firebaseSession.description,
  timeRange: {
    startDate: new Date(firebaseSession.startDate),
    endDate: new Date(firebaseSession.endDate)
  },
  scenarios: firebaseSession.scenarios,
  activeScenario: firebaseSession.activeScenario,
  startingBalance: firebaseSession.startingBalance,
  transactionCount: firebaseSession.transactionCount,
  estimateCount: firebaseSession.estimateCount,
  isActive: firebaseSession.isActive,
  createdAt: new Date(firebaseSession.createdAt),
  updatedAt: new Date(firebaseSession.updatedAt)
});

// Convert between local types and Firebase types
const transactionToFirebase = (
  transaction: Transaction,
  userId: string,
  sessionId: string
): Omit<FirebaseTransaction, 'id'> => {
  const baseData = {
    userId,
    sessionId,
    hash: transaction.hash,
    date: transaction.date.toISOString(),
    description: transaction.description,
    amount: transaction.amount,
    type: transaction.type,
    category: transaction.category,
    balance: transaction.balance,
    rawData: transaction.originalData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // Only add subcategory if it's not undefined (Firestore doesn't accept undefined values)
  if (transaction.subcategory !== undefined) {
    (baseData as any).subcategory = transaction.subcategory;
  }
  
  return baseData;
};

const transactionFromFirebase = (firebaseTransaction: FirebaseTransaction): Transaction => ({
  id: firebaseTransaction.id,
  hash: firebaseTransaction.hash || '', // Add hash field with fallback
  date: new Date(firebaseTransaction.date),
  description: firebaseTransaction.description,
  amount: firebaseTransaction.amount,
  type: firebaseTransaction.type,
  category: firebaseTransaction.category,
  subcategory: firebaseTransaction.subcategory,
  balance: firebaseTransaction.balance,
  originalData: firebaseTransaction.rawData
});

const estimateToFirebase = (
  estimate: Estimate,
  userId: string,
  sessionId: string
): Omit<FirebaseEstimate, 'id'> => {
  const baseData = {
    userId,
    sessionId,
    amount: estimate.amount,
    type: estimate.type,
    category: estimate.category,
    description: estimate.description,
    weekDate: estimate.weekDate.toISOString(),
    scenario: estimate.scenario,
    isRecurring: estimate.isRecurring,
    createdAt: estimate.createdAt.toISOString(),
    updatedAt: estimate.updatedAt.toISOString()
  };
  
  // Only add optional fields if they're not undefined (Firestore doesn't accept undefined values)
  if (estimate.notes !== undefined) {
    (baseData as any).notes = estimate.notes;
  }
  
  if (estimate.recurringType !== undefined) {
    (baseData as any).recurringType = estimate.recurringType;
  }
  
  return baseData;
};

const estimateFromFirebase = (firebaseEstimate: FirebaseEstimate): Estimate => ({
  id: firebaseEstimate.id,
  amount: firebaseEstimate.amount,
  type: firebaseEstimate.type,
  category: firebaseEstimate.category,
  description: firebaseEstimate.description,
  notes: firebaseEstimate.notes,
  weekDate: new Date(firebaseEstimate.weekDate),
  scenario: firebaseEstimate.scenario,
  isRecurring: firebaseEstimate.isRecurring,
  recurringType: firebaseEstimate.recurringType,
  createdAt: new Date(firebaseEstimate.createdAt),
  updatedAt: new Date(firebaseEstimate.updatedAt)
});

// Cashflow Session Management
export const createCashflowSession = async (
  userId: string, 
  name: string, 
  description: string, 
  startingBalance: number,
  timeRange?: {
    startDate: Date;
    endDate: Date;
  },
  scenarios: string[] = ['base']
): Promise<DatabaseResult<string>> => {
  return withFirebase(async () => {
    const sessionRef = doc(collection(db, 'cashflow_sessions'));
    const now = new Date();
    
    // Default time range: current date to 1 year forward
    const defaultTimeRange = {
      startDate: new Date(),
      endDate: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
    };
    
    const finalTimeRange = timeRange || defaultTimeRange;
    
    const sessionData: Omit<FirebaseCashflowSession, 'id'> = {
      name,
      description,
      startDate: finalTimeRange.startDate.toISOString(),
      endDate: finalTimeRange.endDate.toISOString(),
      scenarios,
      activeScenario: scenarios[0] || 'base',
      startingBalance,
      transactionCount: 0,
      estimateCount: 0,
      isActive: true,
      userId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    await setDoc(sessionRef, sessionData);
    return sessionRef.id;
  });
};

export const getCashflowSessions = async (userId: string): Promise<DatabaseResult<any[]>> => {
  return withFirebase(async () => {
    const q = query(
      collection(db, 'cashflow_sessions'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const sessions = querySnapshot.docs.map(doc => {
      const data = doc.data() as Omit<FirebaseCashflowSession, 'id'>;
      return sessionFromFirebase({ ...data, id: doc.id });
    });
    
    return sessions;
  });
};

export const updateCashflowSession = async (
  sessionId: string,
  updates: Partial<Omit<FirebaseCashflowSession, 'id' | 'userId' | 'createdAt'>>
): Promise<DatabaseResult<void>> => {
  return withFirebase(async () => {
    const sessionRef = doc(db, COLLECTIONS.CASHFLOW_SESSIONS, sessionId);
    await updateDoc(sessionRef, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
  });
};

// Transaction Management
export const saveTransactions = async (
  transactions: Transaction[],
  userId: string,
  sessionId: string
): Promise<DatabaseResult<void>> => {
  return withFirebase(async () => {
    const batch = writeBatch(db);
    
    transactions.forEach(transaction => {
      const docRef = doc(collection(db, COLLECTIONS.TRANSACTIONS));
      const firebaseTransaction = {
        id: docRef.id,
        ...transactionToFirebase(transaction, userId, sessionId)
      };
      batch.set(docRef, firebaseTransaction);
    });

    await batch.commit();
    
    // Update session transaction count
    await updateCashflowSession(sessionId, {
      transactionCount: transactions.length
    });
  });
};

export const getTransactions = async (
  sessionId: string
): Promise<DatabaseResult<Transaction[]>> => {
  return withFirebase(async () => {
    const q = query(
      collection(db, COLLECTIONS.TRANSACTIONS),
      where('sessionId', '==', sessionId),
      orderBy('date', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data() as FirebaseTransaction;
      return transactionFromFirebase({ ...data, id: doc.id });
    });
  });
};

// Estimate Management
export const saveEstimate = async (
  estimate: Estimate,
  userId: string,
  sessionId: string
): Promise<DatabaseResult<string>> => {
  return withFirebase(async () => {
    const estimateData = estimateToFirebase(estimate, userId, sessionId);
    const docRef = await addDoc(collection(db, COLLECTIONS.ESTIMATES), estimateData);
    return docRef.id;
  });
};

export const updateEstimate = async (
  estimateId: string,
  updates: Partial<Estimate>
): Promise<DatabaseResult<void>> => {
  return withFirebase(async () => {
    const estimateRef = doc(db, COLLECTIONS.ESTIMATES, estimateId);
    const updateData: any = {
      updatedAt: new Date().toISOString()
    };
    
    // Only update provided fields
    if (updates.amount !== undefined) updateData.amount = updates.amount;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.weekDate !== undefined) updateData.weekDate = updates.weekDate.toISOString();
    if (updates.scenario !== undefined) updateData.scenario = updates.scenario;
    if (updates.isRecurring !== undefined) updateData.isRecurring = updates.isRecurring;
    if (updates.recurringType !== undefined) updateData.recurringType = updates.recurringType;
    
    await updateDoc(estimateRef, updateData);
  });
};

export const deleteEstimate = async (
  estimateId: string
): Promise<DatabaseResult<void>> => {
  return withFirebase(async () => {
    const estimateRef = doc(db, COLLECTIONS.ESTIMATES, estimateId);
    await deleteDoc(estimateRef);
  });
};

export const getEstimates = async (
  sessionId: string
): Promise<DatabaseResult<Estimate[]>> => {
  return withFirebase(async () => {
    const q = query(
      collection(db, COLLECTIONS.ESTIMATES),
      where('sessionId', '==', sessionId),
      orderBy('weekNumber', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data() as FirebaseEstimate;
      return estimateFromFirebase({ ...data, id: doc.id });
    });
  });
};

// Real-time subscriptions
export const subscribeToEstimates = (
  sessionId: string,
  callback: (estimates: Estimate[]) => void
): Unsubscribe | null => {
  if (!isFirebaseAvailable()) return null;
  
  const q = query(
    collection(db, COLLECTIONS.ESTIMATES),
    where('sessionId', '==', sessionId),
    orderBy('weekNumber', 'asc')
  );
  
  return onSnapshot(q, (querySnapshot) => {
    const estimates = querySnapshot.docs.map(doc => {
      const data = doc.data() as FirebaseEstimate;
      return estimateFromFirebase({ ...data, id: doc.id });
    });
    callback(estimates);
  });
};

// User Settings Management
export const getUserSettings = async (
  userId: string
): Promise<DatabaseResult<FirebaseUserSettings | null>> => {
  return withFirebase(async () => {
    const userSettingsRef = doc(db, COLLECTIONS.USER_SETTINGS, userId);
    const docSnap = await getDoc(userSettingsRef);
    
    if (docSnap.exists()) {
      return { ...docSnap.data(), userId } as FirebaseUserSettings;
    } else {
      return null;
    }
  });
};

export const saveUserSettings = async (
  settings: FirebaseUserSettings
): Promise<DatabaseResult<void>> => {
  return withFirebase(async () => {
    const userSettingsRef = doc(db, COLLECTIONS.USER_SETTINGS, settings.userId);
    await updateDoc(userSettingsRef, {
      ...settings,
      updatedAt: new Date().toISOString()
    });
  });
};

// Utility functions
export const clearSessionData = async (
  sessionId: string
): Promise<DatabaseResult<void>> => {
  return withFirebase(async () => {
    const batch = writeBatch(db);
    
    // Delete all transactions in session
    const transactionsQuery = query(
      collection(db, COLLECTIONS.TRANSACTIONS),
      where('sessionId', '==', sessionId)
    );
    const transactionsSnapshot = await getDocs(transactionsQuery);
    transactionsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Delete all estimates in session
    const estimatesQuery = query(
      collection(db, COLLECTIONS.ESTIMATES),
      where('sessionId', '==', sessionId)
    );
    const estimatesSnapshot = await getDocs(estimatesQuery);
    estimatesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
  });
};

export const getSessionStats = async (
  sessionId: string
): Promise<DatabaseResult<{ transactionCount: number; estimateCount: number }>> => {
  return withFirebase(async () => {
    const [transactionsResult, estimatesResult] = await Promise.all([
      getDocs(query(
        collection(db, COLLECTIONS.TRANSACTIONS),
        where('sessionId', '==', sessionId)
      )),
      getDocs(query(
        collection(db, COLLECTIONS.ESTIMATES),
        where('sessionId', '==', sessionId)
      ))
    ]);
    
    return {
      transactionCount: transactionsResult.size,
      estimateCount: estimatesResult.size
    };
  });
};