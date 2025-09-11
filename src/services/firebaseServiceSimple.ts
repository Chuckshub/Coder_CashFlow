import {
  collection,
  doc,
  getDocs,
  setDoc,
  writeBatch,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { Transaction, RawTransaction } from '../types';

// ============================================================================
// SIMPLIFIED FIREBASE ARCHITECTURE
// ============================================================================

/**
 * Collection Structure (MUCH SIMPLER!):
 * 
 * /users/{userId}/transactions/{transactionHash}
 * 
 * That's it! No sessions, no complexity, just:
 * - User isolation
 * - Hash-based duplicate prevention
 * - Direct transaction storage
 */

// ============================================================================
// SIMPLIFIED INTERFACES
// ============================================================================

export interface FirebaseTransaction {
  id: string;
  hash: string;
  userId: string;
  date: Timestamp;
  description: string;
  amount: number;
  type: 'inflow' | 'outflow';
  category: string;
  subcategory?: string; // Optional - only present if has value
  balance: number;
  originalData: RawTransaction;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// SIMPLIFIED FIREBASE SERVICE
// ============================================================================

export class SimpleFirebaseService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  private getCollectionPath(): string {
    return `users/${this.userId}/transactions`;
  }

  /**
   * Upload transactions - uses hash as document ID for automatic deduplication
   */
  async uploadTransactions(
    transactions: Transaction[]
  ): Promise<{
    success: boolean;
    uploaded: number;
    duplicates: number;
    errors: string[];
    uploadedIds: string[];
  }> {
    console.log('🚀 SimpleFirebaseService.uploadTransactions - Starting upload of', transactions.length, 'transactions');
    
    const result = {
      success: false,
      uploaded: 0,
      duplicates: 0,
      errors: [] as string[],
      uploadedIds: [] as string[]
    };

    if (!db) {
      result.errors.push('Firebase not initialized');
      return result;
    }

    if (transactions.length === 0) {
      result.success = true;
      return result;
    }

    try {
      console.log('💾 Starting batch upload...');
      
      const batch = writeBatch(db);
      const collectionRef = collection(db, this.getCollectionPath());
      
      for (const transaction of transactions) {
        if (!transaction.hash) {
          console.warn('⚠️ Transaction without hash, skipping:', transaction.id);
          continue;
        }

        // Use hash as document ID - automatic duplicate prevention!
        const docRef = doc(collectionRef, transaction.hash);
        
        const firebaseData: FirebaseTransaction = {
          id: transaction.id,
          hash: transaction.hash,
          userId: this.userId,
          date: Timestamp.fromDate(transaction.date),
          description: transaction.description,
          amount: transaction.amount,
          type: transaction.type,
          category: transaction.category,
          balance: transaction.balance,
          originalData: transaction.originalData,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };
        
        // Only add subcategory if it has a value
        if (transaction.subcategory !== undefined && transaction.subcategory !== null && transaction.subcategory !== '') {
          firebaseData.subcategory = transaction.subcategory;
        }
        
        batch.set(docRef, firebaseData);
        result.uploadedIds.push(transaction.hash);
      }
      
      console.log('✅ Prepared', result.uploadedIds.length, 'documents for batch write');
      console.log('📄 Sample doc hash:', result.uploadedIds[0]);
      
      // Commit the batch
      await batch.commit();
      console.log('✅ Batch commit completed successfully');
      
      result.uploaded = result.uploadedIds.length;
      result.success = true;
      
      // Immediate verification
      console.log('🔍 Verification - checking document count...');
      const verificationQuery = await getDocs(collectionRef);
      console.log('🔍 VERIFICATION: Found', verificationQuery.size, 'total documents in collection');
      
      console.log('🎉 Upload completed successfully:', result);
      return result;
      
    } catch (error) {
      const errorMessage = `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('💥 Upload error:', error);
      result.errors.push(errorMessage);
      return result;
    }
  }

  /**
   * Load all transactions for the user
   */
  async loadTransactions(): Promise<Transaction[]> {
    console.log('📥 Loading transactions from Firebase...');
    
    if (!db) {
      console.error('Firebase not initialized');
      return [];
    }

    try {
      const collectionRef = collection(db, this.getCollectionPath());
      const snapshot = await getDocs(collectionRef);
      
      console.log('📊 Found', snapshot.size, 'documents');
      
      const transactions: Transaction[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data() as FirebaseTransaction;
        
        try {
          const transaction: Transaction = {
            id: data.id,
            hash: data.hash,
            date: data.date.toDate(),
            description: data.description,
            amount: data.amount,
            type: data.type,
            category: data.category,
            subcategory: data.subcategory, // Will be undefined if not present
            balance: data.balance,
            originalData: data.originalData
          };
          
          transactions.push(transaction);
        } catch (error) {
          console.error('Error converting transaction:', doc.id, error);
        }
      });
      
      // Sort by date (newest first)
      transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      console.log('✅ Loaded', transactions.length, 'transactions');
      return transactions;
      
    } catch (error) {
      console.error('💥 Error loading transactions:', error);
      return [];
    }
  }

  /**
   * Real-time listener for transactions
   */
  subscribeToTransactions(callback: (transactions: Transaction[]) => void): () => void {
    console.log('👂 Setting up real-time transaction listener...');
    
    const collectionRef = collection(db, this.getCollectionPath());
    
    return onSnapshot(collectionRef, (snapshot) => {
      console.log('🔄 Real-time update - found', snapshot.size, 'documents');
      
      const transactions: Transaction[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data() as FirebaseTransaction;
        
        try {
          const transaction: Transaction = {
            id: data.id,
            hash: data.hash,
            date: data.date.toDate(),
            description: data.description,
            amount: data.amount,
            type: data.type,
            category: data.category,
            subcategory: data.subcategory,
            balance: data.balance,
            originalData: data.originalData
          };
          
          transactions.push(transaction);
        } catch (error) {
          console.error('Error converting transaction in listener:', doc.id, error);
        }
      });
      
      // Sort by date (newest first)
      transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      console.log('🔄 Real-time update complete:', transactions.length, 'transactions');
      callback(transactions);
    }, (error) => {
      console.error('Real-time listener error:', error);
    });
  }

  /**
   * Clear all transactions (for testing/reset)
   */
  async clearAllTransactions(): Promise<void> {
    console.log('🗑️ Clearing all transactions...');
    
    try {
      const collectionRef = collection(db, this.getCollectionPath());
      const snapshot = await getDocs(collectionRef);
      
      const batch = writeBatch(db);
      
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log('✅ All transactions cleared');
    } catch (error) {
      console.error('Error clearing transactions:', error);
      throw error;
    }
  }

  /**
   * Get transaction statistics
   */
  async getTransactionStats(): Promise<{
    total: number;
    inflows: number;
    outflows: number;
    totalInflow: number;
    totalOutflow: number;
    netCashflow: number;
  }> {
    const transactions = await this.loadTransactions();
    
    const inflows = transactions.filter(t => t.type === 'inflow');
    const outflows = transactions.filter(t => t.type === 'outflow');
    
    const totalInflow = inflows.reduce((sum, t) => sum + t.amount, 0);
    const totalOutflow = outflows.reduce((sum, t) => sum + t.amount, 0);
    
    return {
      total: transactions.length,
      inflows: inflows.length,
      outflows: outflows.length,
      totalInflow,
      totalOutflow,
      netCashflow: totalInflow - totalOutflow
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE FACTORY
// ============================================================================

let simpleFirebaseServiceInstance: SimpleFirebaseService | null = null;

export const getSimpleFirebaseService = (userId: string): SimpleFirebaseService => {
  if (!simpleFirebaseServiceInstance || simpleFirebaseServiceInstance['userId'] !== userId) {
    simpleFirebaseServiceInstance = new SimpleFirebaseService(userId);
    console.log('🆕 Created SimpleFirebaseService for user:', userId);
  }
  return simpleFirebaseServiceInstance;
};

export const resetSimpleFirebaseService = (): void => {
  simpleFirebaseServiceInstance = null;
  console.log('🧹 SimpleFirebaseService reset');
};
