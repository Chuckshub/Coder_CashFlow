import {
  collection,
  doc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { db } from './firebase';
import { Transaction, RawTransaction, Estimate } from '../types';

// ============================================================================
// SHARED FIREBASE DATA ARCHITECTURE
// ============================================================================

/**
 * Shared Collection Structure:
 * 
 * /shared_transactions/{transactionId}: SharedFirebaseTransaction
 * /shared_estimates/{estimateId}: SharedFirebaseEstimate
 * /shared_sessions/{sessionId}: SharedSessionMetadata
 * /user_profiles/{userId}: UserProfile
 * 
 * This structure provides:
 * - Shared data access for all authenticated users
 * - Session-based organization that's globally accessible
 * - User tracking for audit purposes
 * - Scalable architecture for team collaboration
 */

// ============================================================================
// SHARED FIREBASE DATA INTERFACES
// ============================================================================

export interface SharedFirebaseTransaction {
  id: string;
  hash: string;
  sessionId: string;
  date: Timestamp;
  description: string;
  amount: number;
  type: 'inflow' | 'outflow';
  category: string;
  subcategory?: string;
  balance: number;
  originalData: RawTransaction;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string; // User ID who created this transaction
  lastModifiedBy: string; // User ID who last modified
}

export interface SharedFirebaseEstimate {
  id: string;
  sessionId: string;
  amount: number;
  type: 'inflow' | 'outflow';
  category: string;
  description: string;
  notes?: string;
  weekNumber: number;
  isRecurring: boolean;
  recurringType?: 'weekly' | 'bi-weekly' | 'monthly';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string; // User ID who created this estimate
  lastModifiedBy: string; // User ID who last modified
}

export interface SharedSessionMetadata {
  id: string;
  name: string;
  description?: string;
  startingBalance: number;
  isActive: boolean;
  transactionCount: number;
  estimateCount: number;
  dateRange: {
    start: Timestamp | null;
    end: Timestamp | null;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string; // User ID who created this session
  lastModifiedBy: string; // User ID who last modified
  collaborators: string[]; // Array of user IDs who have access
}

export interface UserProfile {
  userId: string;
  email: string;
  displayName?: string;
  defaultCurrency: string;
  activeSessionId?: string;
  totalSessions: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// SHARED TRANSACTION MANAGEMENT
// ============================================================================

export class SharedTransactionManager {
  private currentUserId: string;
  private sessionId: string;

  constructor(currentUserId: string, sessionId: string) {
    this.currentUserId = currentUserId;
    this.sessionId = sessionId;
  }

  private getTransactionCollectionPath(): string {
    return 'shared_transactions';
  }

  private getEstimateCollectionPath(): string {
    return 'shared_estimates';
  }

  private getSessionCollectionPath(): string {
    return 'shared_sessions';
  }

  /**
   * Bulk upload transactions to shared collection
   */
  async uploadTransactions(
    transactions: Transaction[],
    onProgress?: (progress: { completed: number; total: number; errors: string[] }) => void
  ): Promise<{
    success: boolean;
    uploaded: number;
    duplicates: number;
    errors: string[];
    uploadedIds: string[];
  }> {
    console.log('🚀 SharedTransactionManager.uploadTransactions - Starting upload of', transactions.length, 'transactions');
    
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
      // Step 1: Check for existing transactions to prevent duplicates (within this session)
      console.log('🔍 Checking for duplicate transactions in session...');
      const existingHashes = await this.getExistingHashesForSession();
      console.log('📊 Found', existingHashes.size, 'existing transaction hashes in session');

      // Step 2: Filter out duplicates
      const newTransactions = transactions.filter(transaction => {
        if (transaction.hash && existingHashes.has(transaction.hash)) {
          result.duplicates++;
          return false;
        }
        return true;
      });

      console.log('📈 After duplicate filtering:', newTransactions.length, 'new transactions,', result.duplicates, 'duplicates');

      if (newTransactions.length === 0) {
        result.success = true;
        console.log('✅ No new transactions to upload');
        return result;
      }

      // Step 3: Use Firebase Transaction for atomic upload
      console.log('💾 Starting atomic transaction upload to shared collection...');
      
      try {
        await runTransaction(db, async (transaction) => {
          const collectionRef = collection(db, this.getTransactionCollectionPath());
          console.log('📁 Collection path:', this.getTransactionCollectionPath());
          
          // Prepare all documents for shared collection
          const docs = newTransactions.map(trans => {
            const docRef = doc(collectionRef, trans.id);
            
            // Validate document ID is Firebase-safe
            if (!trans.id || trans.id.length === 0 || trans.id.includes('/')) {
              throw new Error(`Invalid document ID: ${trans.id}`);
            }
            
            const firebaseData: SharedFirebaseTransaction = {
              id: trans.id,
              hash: trans.hash || '',
              sessionId: this.sessionId,
              date: Timestamp.fromDate(trans.date),
              description: trans.description,
              amount: trans.amount,
              type: trans.type,
              category: trans.category,
              balance: trans.balance,
              originalData: trans.originalData,
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
              createdBy: this.currentUserId,
              lastModifiedBy: this.currentUserId
            };
            
            // Only add subcategory if it has a value
            if (trans.subcategory !== undefined && trans.subcategory !== null && trans.subcategory !== '') {
              firebaseData.subcategory = trans.subcategory;
            }
            
            return { ref: docRef, data: firebaseData };
          });

          console.log('✅ Prepared', docs.length, 'documents for shared collection atomic write');

          // Write all documents atomically
          docs.forEach(({ ref, data }, index) => {
            try {
              transaction.set(ref, data);
              if (index < 3) {
                console.log(`📝 Writing doc ${index + 1} to shared collection:`, ref.id);
              }
            } catch (error) {
              console.error(`❌ Error writing doc ${index + 1}:`, ref.id, error);
              throw error;
            }
          });

          console.log('💾 All documents added to shared collection atomic transaction');
        });
        
        console.log('✅ Shared collection atomic transaction completed successfully');
        
      } catch (error) {
        const errorMessage = `Shared collection atomic transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error('💥 Shared collection atomic transaction error:', error);
        result.errors.push(errorMessage);
        return result;
      }

      result.uploaded = newTransactions.length;
      result.uploadedIds = newTransactions.map(t => t.id);
      result.success = true;

      // Step 4: Update session metadata in shared collection
      await this.updateSharedSessionMetadata();
      
      console.log('🎉 Shared upload completed successfully:', result);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
      console.error('💥 Shared transaction upload failed:', error);
      result.errors.push(`Shared upload failed: ${errorMessage}`);
      return result;
    }
  }

  /**
   * Get all existing transaction hashes for this session to prevent duplicates
   */
  private async getExistingHashesForSession(): Promise<Set<string>> {
    try {
      // TEMPORARY: Remove sessionId filter to avoid composite index requirement
      // TODO: Add back sessionId filter once Firebase indexes are created
      const q = query(
        collection(db, this.getTransactionCollectionPath()),
        // where('sessionId', '==', this.sessionId), // Temporarily commented out
        where('hash', '!=', '')
      );
      
      const snapshot = await getDocs(q);
      const hashes = new Set<string>();
      
      snapshot.forEach(doc => {
        const data = doc.data() as SharedFirebaseTransaction;
        if (data.hash) {
          hashes.add(data.hash);
        }
      });
      
      return hashes;
    } catch (error) {
      console.error('Error fetching existing hashes from shared collection:', error);
      return new Set();
    }
  }

  /**
   * Load all transactions from shared collection for this session
   */
  async loadTransactions(): Promise<Transaction[]> {
    console.log('📥 SharedTransactionManager.loadTransactions - Loading transactions from shared collection...');
    
    if (!db) {
      console.error('Firebase not initialized');
      return [];
    }

    try {
      // TEMPORARY: Remove sessionId filter to avoid composite index requirement
      // TODO: Add back sessionId filter once Firebase indexes are created
      const q = query(
        collection(db, this.getTransactionCollectionPath()),
        // where('sessionId', '==', this.sessionId), // Temporarily commented out
        orderBy('date', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const transactions: Transaction[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data() as SharedFirebaseTransaction;
        
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
          console.error('Error converting shared transaction:', doc.id, error);
        }
      });
      
      console.log('📊 Loaded', transactions.length, 'transactions from shared collection for session:', this.sessionId);
      return transactions;
      
    } catch (error) {
      console.error('💥 Error loading transactions from shared collection:', error);
      return [];
    }
  }

  /**
   * Update session metadata in shared collection
   */
  private async updateSharedSessionMetadata(): Promise<void> {
    try {
      const transactions = await this.loadTransactions();
      
      const sessionDocRef = doc(db, this.getSessionCollectionPath(), this.sessionId);
      
      const metadata: Partial<SharedSessionMetadata> = {
        transactionCount: transactions.length,
        updatedAt: Timestamp.now(),
        lastModifiedBy: this.currentUserId
      };
      
      // Calculate date range from transactions
      if (transactions.length > 0) {
        const dates = transactions.map(t => t.date);
        const startDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const endDate = new Date(Math.max(...dates.map(d => d.getTime())));
        
        metadata.dateRange = {
          start: Timestamp.fromDate(startDate),
          end: Timestamp.fromDate(endDate)
        };
      }
      
      await updateDoc(sessionDocRef, metadata);
      console.log('✅ Updated shared session metadata');
      
    } catch (error) {
      console.error('Error updating shared session metadata:', error);
    }
  }

  /**
   * Load all sessions from shared collection (visible to all authenticated users)
   */
  async loadAllSessions(): Promise<SharedSessionMetadata[]> {
    console.log('📥 Loading all sessions from shared collection...');
    
    if (!db) {
      console.error('Firebase not initialized');
      return [];
    }

    try {
      const q = query(
        collection(db, this.getSessionCollectionPath()),
        orderBy('updatedAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const sessions: SharedSessionMetadata[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data() as SharedSessionMetadata;
        sessions.push(data);
      });
      
      console.log('📊 Loaded', sessions.length, 'sessions from shared collection');
      return sessions;
      
    } catch (error) {
      console.error('💥 Error loading sessions from shared collection:', error);
      return [];
    }
  }

  /**
   * Create a new session in shared collection
   */
  async createSharedSession(name: string, startingBalance: number): Promise<string> {
    if (!db) {
      throw new Error('Firebase not initialized');
    }

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    const sessionDocRef = doc(db, this.getSessionCollectionPath(), sessionId);

    const sessionData: SharedSessionMetadata = {
      id: sessionId,
      name,
      description: '',
      startingBalance,
      isActive: true,
      transactionCount: 0,
      estimateCount: 0,
      dateRange: {
        start: null,
        end: null
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: this.currentUserId,
      lastModifiedBy: this.currentUserId,
      collaborators: [this.currentUserId] // Start with creator as collaborator
    };

    await setDoc(sessionDocRef, sessionData);
    console.log('✅ Created new shared session:', sessionId);
    
    return sessionId;
  }
}

// ============================================================================
// SHARED ESTIMATE MANAGEMENT
// ============================================================================

export class SharedEstimateManager {
  private currentUserId: string;
  private sessionId: string;

  constructor(currentUserId: string, sessionId: string) {
    this.currentUserId = currentUserId;
    this.sessionId = sessionId;
  }

  private getCollectionPath(): string {
    return 'shared_estimates';
  }

  /**
   * Save estimate to shared collection
   */
  async saveEstimate(estimate: Estimate): Promise<void> {
    if (!db) {
      throw new Error('Firebase not initialized');
    }

    console.log('💾 SharedEstimateManager.saveEstimate - Saving estimate:', {
      estimateId: estimate.id,
      sessionId: this.sessionId,
      userId: this.currentUserId,
      description: estimate.description,
      amount: estimate.amount
    });

    const docRef = doc(db, this.getCollectionPath(), estimate.id);
    
    const firebaseData: SharedFirebaseEstimate = {
      id: estimate.id,
      sessionId: this.sessionId,
      amount: estimate.amount,
      type: estimate.type,
      category: estimate.category,
      description: estimate.description,
      notes: estimate.notes,
      weekNumber: estimate.weekNumber,
      isRecurring: estimate.isRecurring,
      recurringType: estimate.recurringType,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: this.currentUserId,
      lastModifiedBy: this.currentUserId
    };

    await setDoc(docRef, firebaseData);
    console.log('✅ SharedEstimateManager - Estimate saved to shared collection:', estimate.id);
  }

  /**
   * Load all estimates from shared collection for this session
   */
  async loadEstimates(): Promise<Estimate[]> {
    console.log('📥 SharedEstimateManager.loadEstimates - Loading from shared collection...', {
      sessionId: this.sessionId,
      userId: this.currentUserId,
      collectionPath: this.getCollectionPath()
    });
    
    if (!db) {
      console.error('Firebase not initialized');
      return [];
    }

    try {
      // TEMPORARY: Remove sessionId filter to avoid composite index requirement
      // TODO: Add back sessionId filter once Firebase indexes are created
      const q = query(
        collection(db, this.getCollectionPath()),
        // where('sessionId', '==', this.sessionId), // Temporarily commented out
        orderBy('weekNumber', 'asc')
      );
      
      console.log('🔍 SharedEstimateManager - Executing query (sessionId filter disabled)');
      const snapshot = await getDocs(q);
      const estimates: Estimate[] = [];
      
      console.log('📊 SharedEstimateManager - Raw query results:', snapshot.size, 'documents');
      
      snapshot.forEach(doc => {
        const data = doc.data() as SharedFirebaseEstimate;
        
        console.log('📝 Processing estimate document:', {
          docId: doc.id,
          estimateId: data.id,
          sessionId: data.sessionId,
          description: data.description,
          amount: data.amount
        });
        
        const estimate: Estimate = {
          id: data.id,
          amount: data.amount,
          type: data.type,
          category: data.category,
          description: data.description,
          notes: data.notes,
          weekNumber: data.weekNumber,
          isRecurring: data.isRecurring,
          recurringType: data.recurringType,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate()
        };
        
        estimates.push(estimate);
      });
      
      console.log('✅ SharedEstimateManager - Loaded', estimates.length, 'estimates from shared collection');
      return estimates;
      
    } catch (error) {
      console.error('💥 Error loading estimates from shared collection:', error);
      return [];
    }
  }

  /**
   * Delete estimate from shared collection
   */
  async deleteEstimate(estimateId: string): Promise<void> {
    if (!db) {
      throw new Error('Firebase not initialized');
    }

    const docRef = doc(db, this.getCollectionPath(), estimateId);
    await deleteDoc(docRef);
    console.log('✅ Deleted estimate from shared collection:', estimateId);
  }
}
