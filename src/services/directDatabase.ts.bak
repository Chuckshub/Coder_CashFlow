import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db, isFirebaseAvailable } from './firebase';
import { Transaction, Estimate } from '../types';
import { DatabaseResult, withFirebase } from './database';

const COLLECTIONS = {
  TRANSACTIONS: 'transactions',
  ESTIMATES: 'estimates'
} as const;

// Transaction operations
export const saveTransactions = async (
  userId: string,
  transactions: Transaction[]
): Promise<DatabaseResult<string[]>> => {
  return withFirebase(async () => {
    const batch = writeBatch(db);
    const transactionIds: string[] = [];
    
    transactions.forEach((transaction) => {
      const docRef = doc(collection(db, COLLECTIONS.TRANSACTIONS));
      batch.set(docRef, {
        ...transaction,
        userId,
        date: Timestamp.fromDate(transaction.date),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      transactionIds.push(docRef.id);
    });
    
    await batch.commit();
    return transactionIds;
  });
};

export const getUserTransactions = async (
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<DatabaseResult<Transaction[]>> => {
  return withFirebase(async () => {
    let q = query(
      collection(db, COLLECTIONS.TRANSACTIONS),
      where('userId', '==', userId),
      orderBy('date', 'desc')
    );
    
    // Add date filtering if provided
    if (startDate) {
      q = query(q, where('date', '>=', Timestamp.fromDate(startDate)));
    }
    if (endDate) {
      q = query(q, where('date', '<=', Timestamp.fromDate(endDate)));
    }
    
    const querySnapshot = await getDocs(q);
    const transactions: Transaction[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      transactions.push({
        id: doc.id,
        hash: data.hash,
        date: data.date.toDate(),
        description: data.description,
        amount: data.amount,
        type: data.type,
        category: data.category,
        subcategory: data.subcategory,
        balance: data.balance,
        originalData: data.originalData
      });
    });
    
    return transactions;
  });
};

export const getTransactionsByHashes = async (
  userId: string,
  hashes: string[]
): Promise<DatabaseResult<Transaction[]>> => {
  return withFirebase(async () => {
    if (hashes.length === 0) return [];
    
    // Firestore 'in' queries have a limit of 10, so we need to batch
    const batchSize = 10;
    const batches: Promise<Transaction[]>[] = [];
    
    for (let i = 0; i < hashes.length; i += batchSize) {
      const batchHashes = hashes.slice(i, i + batchSize);
      const q = query(
        collection(db, COLLECTIONS.TRANSACTIONS),
        where('userId', '==', userId),
        where('hash', 'in', batchHashes)
      );
      
      const batchPromise = getDocs(q).then(querySnapshot => {
        const transactions: Transaction[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          transactions.push({
            id: doc.id,
            hash: data.hash,
            date: data.date.toDate(),
            description: data.description,
            amount: data.amount,
            type: data.type,
            category: data.category,
            subcategory: data.subcategory,
            balance: data.balance,
            originalData: data.originalData
          });
        });
        return transactions;
      });
      
      batches.push(batchPromise);
    }
    
    const results = await Promise.all(batches);
    return results.flat();
  });
};

// Estimate operations
export const saveEstimate = async (
  userId: string,
  estimate: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<DatabaseResult<string>> => {
  return withFirebase(async () => {
    const docRef = await addDoc(collection(db, COLLECTIONS.ESTIMATES), {
      ...estimate,
      userId,
      weekDate: Timestamp.fromDate(estimate.weekDate),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    return docRef.id;
  });
};

export const getUserEstimates = async (
  userId: string
): Promise<DatabaseResult<Estimate[]>> => {
  return withFirebase(async () => {
    const q = query(
      collection(db, COLLECTIONS.ESTIMATES),
      where('userId', '==', userId),
      orderBy('weekDate', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    const estimates: Estimate[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      estimates.push({
        id: doc.id,
        amount: data.amount,
        type: data.type,
        category: data.category,
        description: data.description,
        notes: data.notes,
        weekDate: data.weekDate.toDate(),
        scenario: data.scenario,
        isRecurring: data.isRecurring,
        recurringType: data.recurringType,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate()
      });
    });
    
    return estimates;
  });
};

export const updateEstimate = async (
  estimateId: string,
  updates: Partial<Estimate>
): Promise<DatabaseResult<void>> => {
  return withFirebase(async () => {
    const docRef = doc(db, COLLECTIONS.ESTIMATES, estimateId);
    const updateData: any = { ...updates };
    
    if (updates.weekDate) {
      updateData.weekDate = Timestamp.fromDate(updates.weekDate);
    }
    
    updateData.updatedAt = Timestamp.now();
    
    await updateDoc(docRef, updateData);
  });
};

export const deleteEstimate = async (
  estimateId: string
): Promise<DatabaseResult<void>> => {
  return withFirebase(async () => {
    await deleteDoc(doc(db, COLLECTIONS.ESTIMATES, estimateId));
  });
};

export const subscribeToUserEstimates = (
  userId: string,
  callback: (estimates: Estimate[]) => void
) => {
  if (!isFirebaseAvailable()) {
    console.warn('Firebase not available for estimates subscription');
    return null;
  }
  
  const q = query(
    collection(db, COLLECTIONS.ESTIMATES),
    where('userId', '==', userId),
    orderBy('weekDate', 'asc')
  );
  
  return onSnapshot(q, (querySnapshot) => {
    const estimates: Estimate[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      estimates.push({
        id: doc.id,
        amount: data.amount,
        type: data.type,
        category: data.category,
        description: data.description,
        notes: data.notes,
        weekDate: data.weekDate.toDate(),
        scenario: data.scenario,
        isRecurring: data.isRecurring,
        recurringType: data.recurringType,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate()
      });
    });
    
    callback(estimates);
  });
};