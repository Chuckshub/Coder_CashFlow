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
    console.log('📋 getUserTransactions called for userId:', userId);
    
    const transactionsRef = collection(db, COLLECTIONS.USER_TRANSACTIONS(userId));
    console.log('🗿 Collection path:', COLLECTIONS.USER_TRANSACTIONS(userId));
    
    // Try without orderBy first to see if that's causing issues
    const q = query(transactionsRef);
    console.log('🔍 Executing query...');
    
    const querySnapshot = await getDocs(q);
    console.log('📊 Query returned', querySnapshot.size, 'documents');
    
    const transactions: Transaction[] = [];
    querySnapshot.forEach((doc) => {
      console.log('📄 Processing doc:', doc.id);
      const data = doc.data() as DatabaseTransaction;
      console.log('📄 Doc data:', { id: data.id, description: data.description?.substring(0, 50) });
      transactions.push(databaseToTransaction(data));
    });
    
    console.log('✅ Processed', transactions.length, 'transactions');
    
    // Sort by date in memory instead of using Firestore orderBy
    transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
    
    return transactions;
  } catch (error) {
    console.error('💥 Error getting user transactions:', error);
    throw new Error('Failed to load transactions');
  }
};

/**
 * Check which transactions already exist in the database
 */
async function checkExistingTransactions(
  hashes: string[],
  userId: string
): Promise<Set<string>> {
  try {
    console.log('🔍 Checking', hashes.length, 'transaction hashes for duplicates');
    
    if (hashes.length === 0) return new Set();
    
    const existingHashes = new Set<string>();
    
    // Firestore IN operator supports max 30 values, so batch the queries
    const batchSize = 30;
    const batches: string[][] = [];
    
    for (let i = 0; i < hashes.length; i += batchSize) {
      batches.push(hashes.slice(i, i + batchSize));
    }
    
    console.log('📋 Splitting into', batches.length, 'batches of max 30 hashes each');
    
    // Process each batch
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`🔍 Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} hashes`);
      
      const q = query(
        collection(db, 'users', userId, 'transactions'),
        where('hash', 'in', batch)
      );
      
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach(doc => {
        const data = doc.data();
        if (data.hash) {
          existingHashes.add(data.hash);
        }
      });
    }
    
    console.log('✅ Found', existingHashes.size, 'existing transaction hashes');
    return existingHashes;
  } catch (error) {
    console.error('Error checking existing transaction hashes:', error);
    // Return empty set on error to avoid blocking saves
    return new Set();
  }
}

/**
 * Save transactions to database with duplicate checking
 */
export const saveTransactions = async (
  rawTransactions: RawTransaction[],
  userId: string
): Promise<{ saved: number; duplicates: number; errors: string[] }> => {
  console.log('🔄 saveTransactions called with', rawTransactions.length, 'transactions for userId:', userId);
  
  const results = {
    saved: 0,
    duplicates: 0,
    errors: [] as string[]
  };

  if (!db) {
    const error = 'Firebase database not initialized';
    console.error('❌', error);
    results.errors.push(error);
    return results;
  }

  if (!userId) {
    const error = 'User ID is required';
    console.error('❌', error);
    results.errors.push(error);
    return results;
  }

  if (rawTransactions.length === 0) {
    console.log('⚠️ No transactions to save');
    return results;
  }

  try {
    console.log('🔄 Processing', rawTransactions.length, 'raw transactions');
    
    // Convert and categorize transactions
    const processedTransactions = rawTransactions.map(convertToTransaction);
    console.log('✅ Converted', processedTransactions.length, 'transactions');
    
    const categorizedTransactions = categorizeTransactions(processedTransactions);
    console.log('✅ Categorized', categorizedTransactions.length, 'transactions');

    // Add hashes to transactions
    const transactionsWithHashes = categorizedTransactions.map(transaction => ({
      ...transaction,
      hash: transaction.hash || createTransactionHashFromProcessed(transaction)
    }));
    console.log('✅ Added hashes to', transactionsWithHashes.length, 'transactions');

    // Check for duplicates
    const newHashes = transactionsWithHashes.map(t => t.hash!).filter(Boolean);
    console.log('🔍 Checking', newHashes.length, 'hashes for duplicates');
    
    const existingHashes = await checkExistingTransactions(newHashes, userId);
    console.log('✅ Duplicate check completed, found', existingHashes.size, 'existing hashes');

    // Filter out duplicates
    const uniqueTransactions = transactionsWithHashes.filter(transaction => {
      if (!transaction.hash) {
        console.warn('⚠️ Transaction without hash:', transaction.id);
        return true; // Process transactions without hash
      }
      const isDuplicate = existingHashes.has(transaction.hash);
      if (isDuplicate) {
        results.duplicates++;
        console.log('🔄 Skipping duplicate:', transaction.hash.substring(0, 10) + '...');
      }
      return !isDuplicate;
    });
    
    console.log('📋 Found', results.duplicates, 'duplicates, saving', uniqueTransactions.length, 'new transactions');

    if (uniqueTransactions.length === 0) {
      console.log('⚠️ No new transactions to save after duplicate filtering');
      return results;
    }

    // CRITICAL: Batch write to database with detailed logging
    console.log('💾 STARTING CRITICAL BATCH WRITE OPERATION');
    const batch = writeBatch(db);
    const collectionPath = COLLECTIONS.USER_TRANSACTIONS(userId);
    const transactionsRef = collection(db, collectionPath);
    
    console.log('💾 Collection path:', collectionPath);
    console.log('💾 Collection reference created:', !!transactionsRef);
    console.log('💾 Batch created:', !!batch);
    console.log('💾 About to add', uniqueTransactions.length, 'transactions to batch');

    let batchItemsAdded = 0;
    uniqueTransactions.forEach((transaction, index) => {
      try {
        const docRef = doc(transactionsRef, transaction.id);
        const dbTransaction = transactionToDatabase(transaction, userId);
        
        console.log(`📄 [${index + 1}/${uniqueTransactions.length}] Adding to batch:`, {
          docId: transaction.id,
          docRef: !!docRef,
          dbTransaction: !!dbTransaction,
          description: transaction.description.substring(0, 30) + '...',
          amount: transaction.amount
        });
        
        batch.set(docRef, dbTransaction);
        batchItemsAdded++;
      } catch (error) {
        console.error(`❌ Error adding transaction ${index + 1} to batch:`, error);
        results.errors.push(`Failed to add transaction ${transaction.id}: ${error}`);
      }
    });
    
    console.log('💾 Successfully added', batchItemsAdded, 'items to batch');
    console.log('💾 COMMITTING BATCH - This is the critical moment...');
    
    // The critical batch commit
    const startTime = Date.now();
    await batch.commit();
    const endTime = Date.now();
    
    console.log('\u2705 BATCH COMMIT COMPLETED in', endTime - startTime, 'ms');
    console.log('\u2705 Should have written', batchItemsAdded, 'documents to', collectionPath);
    
    // IMMEDIATE VERIFICATION: Check if documents actually exist
    console.log('\ud83d\udd0d IMMEDIATE VERIFICATION: Checking if documents were actually written...');
    try {
      const verificationQuery = await getDocs(collection(db, collectionPath));
      console.log('\ud83d\udd0d VERIFICATION RESULT: Found', verificationQuery.size, 'documents in collection');
      
      if (verificationQuery.size !== batchItemsAdded) {
        console.error('\u274c VERIFICATION FAILED: Expected', batchItemsAdded, 'documents, found', verificationQuery.size);
      } else {
        console.log('\u2705 VERIFICATION PASSED: Document count matches expected');
      }
      
      // List some document IDs for verification
      const foundDocIds: string[] = [];
      verificationQuery.forEach(doc => {
        foundDocIds.push(doc.id);
        if (foundDocIds.length <= 3) {
          console.log('\ud83d\udcc4 VERIFICATION: Found doc ID:', doc.id);
        }
      });
      
    } catch (verificationError) {
      console.error('\u274c VERIFICATION ERROR:', verificationError);
    }
    
    results.saved = uniqueTransactions.length;
    console.log(`✅ saveTransactions completed - Results:`, results);
    
    return results;
    
  } catch (error) {
    const errorMessage = `Database save failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error('💥 CRITICAL ERROR in saveTransactions:', error);
    console.error('💥 Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    results.errors.push(errorMessage);
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

/**
 * Debug function to count documents in user's transaction collection
 */
export const debugCountUserTransactions = async (userId: string): Promise<number> => {
  try {
    console.log('🔍 DEBUG: Counting documents in collection:', COLLECTIONS.USER_TRANSACTIONS(userId));
    
    const transactionsRef = collection(db, COLLECTIONS.USER_TRANSACTIONS(userId));
    const snapshot = await getDocs(transactionsRef);
    
    console.log('🔍 DEBUG: Found', snapshot.size, 'documents in collection');
    
    // List first few document IDs
    const docIds: string[] = [];
    snapshot.forEach(doc => {
      docIds.push(doc.id);
      if (docIds.length <= 5) {
        console.log('📄 DEBUG: Document ID:', doc.id, 'Data keys:', Object.keys(doc.data()));
      }
    });
    
    return snapshot.size;
  } catch (error) {
    console.error('💥 DEBUG: Error counting documents:', error);
    return 0;
  }
};