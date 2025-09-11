import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { Transaction, RawTransaction, Estimate } from '../types';

// ============================================================================
// SIMPLIFIED FIREBASE ARCHITECTURE
// ============================================================================

/**
 * Collection Structure (MUCH SIMPLER!):
 * 
 * /users/{userId}/transactions/{transactionHash}
 * /users/{userId}/estimates/{estimateId}
 * 
 * Simple, clean, and efficient:
 * - User isolation
 * - Hash-based duplicate prevention for transactions
 * - Direct estimate storage with user tracking
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

export interface FirebaseEstimate {
  id: string;
  userId: string;
  amount: number;
  type: 'inflow' | 'outflow';
  category: string;
  description: string;
  notes?: string; // Optional - only present if has value
  weekNumber: number;
  isRecurring: boolean;
  recurringType?: 'weekly' | 'bi-weekly' | 'monthly'; // Optional - only present if has value
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string; // User email or display name
  createdByUserId: string; // User ID for security
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

  private getEstimatesCollectionPath(): string {
    return `users/${this.userId}/estimates`;
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
    console.log('🔑 User ID:', this.userId);
    console.log('📁 Collection path:', this.getCollectionPath());
    
    if (!db) {
      console.error('Firebase not initialized');
      return [];
    }

    try {
      const collectionRef = collection(db, this.getCollectionPath());
      const snapshot = await getDocs(collectionRef);
      
      console.log('📊 Found', snapshot.size, 'documents');
      console.log('📁 Collection reference path:', collectionRef.path);
      
      const transactions: Transaction[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data() as FirebaseTransaction;
        console.log('📄 Processing doc:', doc.id, 'with data:', {
          id: data.id,
          description: data.description?.substring(0, 30) + '...',
          amount: data.amount,
          date: data.date?.toDate?.()?.toDateString?.()
        });
        
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
      if (transactions.length > 0) {
        console.log('📄 First transaction:', {
          id: transactions[0].id,
          description: transactions[0].description.substring(0, 50),
          date: transactions[0].date.toDateString(),
          amount: transactions[0].amount
        });
      }
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

  // ============================================================================
  // ESTIMATE MANAGEMENT
  // ============================================================================

  /**
   * Save an estimate with user tracking
   */
  async saveEstimate(estimate: Estimate, userDisplayName: string, userEmail: string): Promise<{ success: boolean; error?: string }> {
    console.log('💾 Saving estimate...', estimate.id, estimate.description);
    console.log('🔍 Raw estimate data:', {
      notes: estimate.notes,
      notesType: typeof estimate.notes,
      recurringType: estimate.recurringType,
      recurringTypeType: typeof estimate.recurringType
    });
    
    if (!db) {
      return { success: false, error: 'Firebase not initialized' };
    }

    try {
      const collectionRef = collection(db, this.getEstimatesCollectionPath());
      const docRef = doc(collectionRef, estimate.id);
      
      // Build Firebase estimate object step by step, avoiding undefined values entirely
      const firebaseEstimate: any = {
        id: estimate.id,
        userId: this.userId,
        amount: estimate.amount,
        type: estimate.type,
        category: estimate.category,
        description: estimate.description,
        weekNumber: estimate.weekNumber,
        isRecurring: estimate.isRecurring,
        createdAt: estimate.createdAt ? Timestamp.fromDate(estimate.createdAt) : Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: userDisplayName || userEmail || 'Unknown User',
        createdByUserId: this.userId
      };
      
      // Only add notes if it has a real value
      if (estimate.notes && estimate.notes.trim() !== '') {
        firebaseEstimate.notes = estimate.notes.trim();
        console.log('✅ Adding notes field:', estimate.notes.trim());
      } else {
        console.log('⚠️ Skipping notes field - value is:', estimate.notes);
      }
      
      // Only add recurringType if it has a real value
      if (estimate.recurringType) {
        firebaseEstimate.recurringType = estimate.recurringType;
        console.log('✅ Adding recurringType field:', estimate.recurringType);
      } else {
        console.log('⚠️ Skipping recurringType field - value is:', estimate.recurringType);
      }
      
      console.log('💾 Final Firebase document structure:');
      console.log('Fields to save:', Object.keys(firebaseEstimate));
      console.log('Has notes field:', 'notes' in firebaseEstimate);
      console.log('Has recurringType field:', 'recurringType' in firebaseEstimate);
      
      // Double-check for any undefined values
      const undefinedFields = Object.entries(firebaseEstimate)
        .filter(([key, value]) => value === undefined)
        .map(([key]) => key);
      
      if (undefinedFields.length > 0) {
        console.error('❌ Found undefined fields:', undefinedFields);
        return { success: false, error: `Cannot save estimate: found undefined fields: ${undefinedFields.join(', ')}` };
      }
      
      await setDoc(docRef, firebaseEstimate);
      console.log('✅ Estimate saved successfully:', estimate.id);
      
      return { success: true };
      
    } catch (error) {
      const errorMsg = `Failed to save estimate: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('💥 Error saving estimate:', error);
      console.error('💥 Full error object:', JSON.stringify(error, null, 2));
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Load all estimates for the user
   */
  async loadEstimates(): Promise<Estimate[]> {
    console.log('📥 Loading estimates from Firebase...');
    console.log('🔑 User ID:', this.userId);
    console.log('📁 Estimates collection path:', this.getEstimatesCollectionPath());
    
    if (!db) {
      console.error('Firebase not initialized');
      return [];
    }

    try {
      const collectionRef = collection(db, this.getEstimatesCollectionPath());
      const snapshot = await getDocs(collectionRef);
      
      console.log('📊 Found', snapshot.size, 'estimate documents');
      
      const estimates: Estimate[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data() as FirebaseEstimate;
        console.log('📄 Processing estimate doc:', doc.id, 'with data:', {
          description: data.description,
          amount: data.amount,
          weekNumber: data.weekNumber,
          createdBy: data.createdBy,
          hasNotes: !!data.notes,
          hasRecurringType: !!data.recurringType
        });
        
        try {
          const estimate: Estimate = {
            id: data.id,
            amount: data.amount,
            type: data.type,
            category: data.category,
            description: data.description,
            notes: data.notes, // Can be undefined - that's OK for the Estimate type
            weekNumber: data.weekNumber,
            isRecurring: data.isRecurring,
            recurringType: data.recurringType, // Can be undefined - that's OK for the Estimate type
            createdAt: data.createdAt.toDate(),
            updatedAt: data.updatedAt.toDate()
          };
          
          estimates.push(estimate);
        } catch (error) {
          console.error('Error converting estimate:', doc.id, error);
        }
      });
      
      // Sort by creation date (newest first)
      estimates.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      console.log('✅ Loaded', estimates.length, 'estimates');
      return estimates;
      
    } catch (error) {
      console.error('💥 Error loading estimates:', error);
      return [];
    }
  }

  /**
   * Delete an estimate
   */
  async deleteEstimate(estimateId: string): Promise<{ success: boolean; error?: string }> {
    console.log('🗑️ Deleting estimate:', estimateId);
    
    if (!db) {
      return { success: false, error: 'Firebase not initialized' };
    }

    try {
      const docRef = doc(db, this.getEstimatesCollectionPath(), estimateId);
      await deleteDoc(docRef);
      
      console.log('✅ Estimate deleted successfully:', estimateId);
      return { success: true };
      
    } catch (error) {
      const errorMsg = `Failed to delete estimate: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('💥 Error deleting estimate:', error);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Get estimate with creator information
   */
  async getEstimateWithCreator(estimateId: string): Promise<(Estimate & { createdBy: string; createdByUserId: string }) | null> {
    console.log('🔍 Getting estimate with creator info:', estimateId);
    
    if (!db) {
      console.error('Firebase not initialized');
      return null;
    }

    try {
      const collectionRef = collection(db, this.getEstimatesCollectionPath());
      const docSnap = await getDocs(collectionRef);
      
      let foundEstimate: (Estimate & { createdBy: string; createdByUserId: string }) | null = null;
      
      docSnap.forEach(doc => {
        if (doc.id === estimateId) {
          const data = doc.data() as FirebaseEstimate;
          const estimateWithCreator: Estimate & { createdBy: string; createdByUserId: string } = {
            id: data.id,
            amount: data.amount,
            type: data.type,
            category: data.category,
            description: data.description,
            notes: data.notes, // Can be undefined
            weekNumber: data.weekNumber,
            isRecurring: data.isRecurring,
            recurringType: data.recurringType, // Can be undefined
            createdAt: data.createdAt.toDate(),
            updatedAt: data.updatedAt.toDate(),
            createdBy: data.createdBy,
            createdByUserId: data.createdByUserId
          };
          foundEstimate = estimateWithCreator;
        }
      });
      
      console.log('✅ Retrieved estimate with creator info');
      return foundEstimate;
      
    } catch (error) {
      console.error('💥 Error getting estimate with creator:', error);
      return null;
    }
  }

  /**
   * Real-time listener for estimates
   */
  subscribeToEstimates(callback: (estimates: Estimate[]) => void): () => void {
    console.log('👂 Setting up real-time estimate listener...');
    
    const collectionRef = collection(db, this.getEstimatesCollectionPath());
    
    return onSnapshot(collectionRef, (snapshot) => {
      console.log('🔄 Real-time estimate update - found', snapshot.size, 'documents');
      
      const estimates: Estimate[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data() as FirebaseEstimate;
        
        try {
          const estimate: Estimate = {
            id: data.id,
            amount: data.amount,
            type: data.type,
            category: data.category,
            description: data.description,
            notes: data.notes, // Can be undefined
            weekNumber: data.weekNumber,
            isRecurring: data.isRecurring,
            recurringType: data.recurringType, // Can be undefined
            createdAt: data.createdAt.toDate(),
            updatedAt: data.updatedAt.toDate()
          };
          
          estimates.push(estimate);
        } catch (error) {
          console.error('Error converting estimate in listener:', doc.id, error);
        }
      });
      
      // Sort by creation date (newest first)
      estimates.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      console.log('🔄 Real-time estimate update complete:', estimates.length, 'estimates');
      callback(estimates);
    }, (error) => {
      console.error('Real-time estimate listener error:', error);
    });
  }

  /**
   * Clear all estimates (for testing/reset)
   */
  async clearAllEstimates(): Promise<void> {
    console.log('🗑️ Clearing all estimates...');
    
    try {
      const collectionRef = collection(db, this.getEstimatesCollectionPath());
      const snapshot = await getDocs(collectionRef);
      
      const batch = writeBatch(db);
      
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log('✅ All estimates cleared');
    } catch (error) {
      console.error('Error clearing estimates:', error);
      throw error;
    }
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