import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  Timestamp,
  writeBatch,
  getDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { Transaction, RawTransaction } from '../types';
import { 
  createTransactionHashFromRaw, 
  createTransactionHashFromProcessed,
  filterDuplicateTransactions
} from '../utils/transactionHash';
import { convertToTransaction } from '../utils/csvParser';
import { categorizeTransactions } from '../utils/transactionCategorizer';

const COLLECTIONS = {
  TRANSACTIONS: 'transactions',
  USER_TRANSACTIONS: (userId: string) => `users/${userId}/transactions`
};

export interface DatabaseTransaction {
  id: string;
  hash: string;
  date: string; // ISO string
  description: string;
  amount: number;
  type: 'inflow' | 'outflow';
  category: string;
  subcategory?: string;
  balance: number;
  userId: string;
  createdAt: string;
  originalData: {
    Details: 'CREDIT' | 'DEBIT';
    'Posting Date': string;
    Description: string;
    Amount: number;
    Type: string;
    Balance: number;
    'Check or Slip #': string;
  };
}

/**
 * Convert Transaction to database format
 */
function transactionToDatabase(transaction: Transaction, userId: string): DatabaseTransaction {
  const dbTransaction: any = {
    id: transaction.id,
    hash: transaction.hash || createTransactionHashFromProcessed(transaction),
    date: transaction.date.toISOString(),
    description: transaction.description,
    amount: transaction.amount,
    type: transaction.type,
    category: transaction.category,
    balance: transaction.balance,
    userId,
    createdAt: new Date().toISOString(),
    originalData: transaction.originalData
  };
  
  // Only add subcategory if it exists (Firestore doesn't allow undefined)
  if (transaction.subcategory !== undefined && transaction.subcategory !== null) {
    dbTransaction.subcategory = transaction.subcategory;
  }
  
  return dbTransaction as DatabaseTransaction;
}

/**
 * Convert database format to Transaction
 */
function databaseToTransaction(dbTransaction: DatabaseTransaction): Transaction {
  return {
    id: dbTransaction.id,
    hash: dbTransaction.hash,
    date: new Date(dbTransaction.date),
    description: dbTransaction.description,
    amount: dbTransaction.amount,
    type: dbTransaction.type,
    category: dbTransaction.category,
    subcategory: dbTransaction.subcategory || undefined, // Handle missing subcategory
    balance: dbTransaction.balance,
    originalData: dbTransaction.originalData
  };
}

/**
 * Get all transactions for a user
 */
export const getUserTransactions = async (userId: string): Promise<Transaction[]> => {
  try {
    const transactionsRef = collection(db, COLLECTIONS.USER_TRANSACTIONS(userId));
    const q = query(transactionsRef, orderBy('date', 'desc'));
    const querySnapshot = await getDocs(q);
    
    const transactions: Transaction[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data() as DatabaseTransaction;
      transactions.push(databaseToTransaction(data));
    });
    
    return transactions;
  } catch (error) {
    console.error('Error getting user transactions:', error);
    throw new Error('Failed to load transactions');
  }
};

/**
 * Check if transactions with given hashes already exist
 */
export const checkExistingTransactionHashes = async (
  userId: string,
  hashes: string[]
): Promise<Set<string>> => {
  if (hashes.length === 0) return new Set();
  
  try {
    const transactionsRef = collection(db, COLLECTIONS.USER_TRANSACTIONS(userId));
    const q = query(transactionsRef, where('hash', 'in', hashes));
    const querySnapshot = await getDocs(q);
    
    const existingHashes = new Set<string>();
    querySnapshot.forEach((doc) => {
      const data = doc.data() as DatabaseTransaction;
      existingHashes.add(data.hash);
    });
    
    return existingHashes;
  } catch (error) {
    console.error('Error checking existing transaction hashes:', error);
    return new Set(); // Return empty set on error to allow processing
  }
};

/**
 * Save transactions to database with duplicate checking
 */
export const saveTransactions = async (
  rawTransactions: RawTransaction[],
  userId: string
): Promise<{ saved: number; duplicates: number; errors: string[] }> => {
  const results = {
    saved: 0,
    duplicates: 0,
    errors: [] as string[]
  };
  
  try {
    console.log('🔄 Processing', rawTransactions.length, 'raw transactions');
    
    // Convert raw transactions to processed transactions
    const processedTransactions = rawTransactions.map(raw => {
      const transaction = convertToTransaction(raw);
      transaction.hash = createTransactionHashFromRaw(raw);
      return transaction;
    });
    
    // Categorize transactions
    const categorizedTransactions = categorizeTransactions(processedTransactions);
    
    // Get hashes of new transactions
    const newHashes = categorizedTransactions.map(t => t.hash!).filter(Boolean);
    
    // Check which hashes already exist in database
    const existingHashes = await checkExistingTransactionHashes(userId, newHashes);
    
    // Filter out duplicates
    const uniqueTransactions = categorizedTransactions.filter(transaction => {
      if (!transaction.hash) return true; // Process transactions without hash
      return !existingHashes.has(transaction.hash);
    });
    
    results.duplicates = categorizedTransactions.length - uniqueTransactions.length;
    console.log(`📊 Found ${results.duplicates} duplicates, saving ${uniqueTransactions.length} new transactions`);
    
    if (uniqueTransactions.length === 0) {
      console.log('✅ No new transactions to save');
      return results;
    }
    
    // Batch write to database
    const batch = writeBatch(db);
    const transactionsRef = collection(db, COLLECTIONS.USER_TRANSACTIONS(userId));
    
    uniqueTransactions.forEach((transaction) => {
      const docRef = doc(transactionsRef, transaction.id);
      const dbTransaction = transactionToDatabase(transaction, userId);
      batch.set(docRef, dbTransaction);
    });
    
    await batch.commit();
    results.saved = uniqueTransactions.length;
    
    console.log(`✅ Successfully saved ${results.saved} transactions`);
    return results;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error saving transactions:', error);
    results.errors.push(`Save failed: ${errorMessage}`);
    return results;
  }
};

/**
 * Get transaction counts and summary
 */
export const getTransactionSummary = async (userId: string) => {
  try {
    const transactions = await getUserTransactions(userId);
    
    const summary = {
      total: transactions.length,
      inflow: transactions.filter(t => t.type === 'inflow').length,
      outflow: transactions.filter(t => t.type === 'outflow').length,
      totalInflow: transactions
        .filter(t => t.type === 'inflow')
        .reduce((sum, t) => sum + t.amount, 0),
      totalOutflow: transactions
        .filter(t => t.type === 'outflow')
        .reduce((sum, t) => sum + t.amount, 0),
      categories: {
        inflow: Array.from(new Set(transactions.filter(t => t.type === 'inflow').map(t => t.category))),
        outflow: Array.from(new Set(transactions.filter(t => t.type === 'outflow').map(t => t.category)))
      },
      dateRange: {
        earliest: transactions.length > 0 ? new Date(Math.min(...transactions.map(t => t.date.getTime()))) : null,
        latest: transactions.length > 0 ? new Date(Math.max(...transactions.map(t => t.date.getTime()))) : null
      }
    };
    
    return summary;
  } catch (error) {
    console.error('Error getting transaction summary:', error);
    throw error;
  }
};

/**
 * Delete all transactions for a user (for testing/reset)
 */
export const clearUserTransactions = async (userId: string): Promise<void> => {
  try {
    const transactionsRef = collection(db, COLLECTIONS.USER_TRANSACTIONS(userId));
    const querySnapshot = await getDocs(transactionsRef);
    
    const batch = writeBatch(db);
    querySnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log('✅ Cleared all user transactions');
  } catch (error) {
    console.error('Error clearing user transactions:', error);
    throw error;
  }
};