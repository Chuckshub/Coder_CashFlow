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
// FIREBASE DATA ARCHITECTURE
// ============================================================================

/**
 * Collection Structure:
 * 
 * /users/{userId}/
 *   - profile: UserProfile
 *   - sessions/{sessionId}/
 *     - metadata: SessionMetadata  
 *     - transactions/{transactionId}: FirebaseTransaction
 *     - estimates/{estimateId}: FirebaseEstimate
 *     - settings: SessionSettings
 * 
 * This structure provides:
 * - User isolation
 * - Session-based organization
 * - Efficient querying
 * - Scalable architecture
 */

// ============================================================================
// FIREBASE DATA INTERFACES
// ============================================================================

export interface FirebaseTransaction {
  id: string;
  hash: string;
  userId: string;
  sessionId: string;
  date: Timestamp;
  description: string;
  amount: number;
  type: 'inflow' | 'outflow';
  category: string;
  subcategory?: string; // Optional field - only present if has value
  balance: number;
  originalData: RawTransaction;
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SessionMetadata {
  id: string;
  userId: string;
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
// TRANSACTION MANAGEMENT
// ============================================================================

export class TransactionManager {
  private userId: string;
  private sessionId: string;

  constructor(userId: string, sessionId: string) {
    this.userId = userId;
    this.sessionId = sessionId;
  }

  private getCollectionPath(): string {
    return `users/${this.userId}/sessions/${this.sessionId}/transactions`;
  }

  /**
   * Bulk upload transactions with comprehensive error handling and progress tracking
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
    console.log('🚀 TransactionManager.uploadTransactions - Starting upload of', transactions.length, 'transactions');
    
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
      // Step 1: Check for existing transactions to prevent duplicates
      console.log('🔍 Checking for duplicate transactions...');
      const existingHashes = await this.getExistingHashes();
      console.log('📊 Found', existingHashes.size, 'existing transaction hashes');

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
      console.log('💾 Starting atomic transaction upload...');
      
      try {
        await runTransaction(db, async (transaction) => {
          const collectionRef = collection(db, this.getCollectionPath());
          console.log('📁 Collection path:', this.getCollectionPath());
          
          // Prepare all documents
          const docs = newTransactions.map(trans => {
            const docRef = doc(collectionRef, trans.id);
            
            // Validate document ID is Firebase-safe
            if (!trans.id || trans.id.length === 0 || trans.id.includes('/')) {
              throw new Error(`Invalid document ID: ${trans.id}`);
            }
            
            const firebaseData: FirebaseTransaction = {
              id: trans.id,
              hash: trans.hash || '',
              userId: this.userId,
              sessionId: this.sessionId,
              date: Timestamp.fromDate(trans.date),
              description: trans.description,
              amount: trans.amount,
              type: trans.type,
              category: trans.category,
              balance: trans.balance,
              originalData: trans.originalData,
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now()
            };
            
            // Only add subcategory if it has a value (Firebase doesn't allow undefined)
            if (trans.subcategory !== undefined && trans.subcategory !== null && trans.subcategory !== '') {
              firebaseData.subcategory = trans.subcategory;
            }
            
            return { ref: docRef, data: firebaseData };
          });

          console.log('✅ Prepared', docs.length, 'documents for atomic write');
          console.log('📄 Sample doc ID:', docs[0]?.ref.id);
          console.log('📄 Sample doc path:', docs[0]?.ref.path);

          // Write all documents atomically
          docs.forEach(({ ref, data }, index) => {
            try {
              transaction.set(ref, data);
              if (index < 3) {
                console.log(`📝 Writing doc ${index + 1}:`, ref.id);
              }
            } catch (error) {
              console.error(`❌ Error writing doc ${index + 1}:`, ref.id, error);
              throw error;
            }
          });

          console.log('💾 All documents added to atomic transaction');
        });
        
        console.log('✅ Atomic transaction completed successfully');
        
      } catch (error) {
        const errorMessage = `Atomic transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error('💥 Atomic transaction error:', error);
        console.error('💥 Error details:', {
          name: (error as Error)?.name,
          message: (error as Error)?.message,
          code: (error as any)?.code,
          stack: (error as Error)?.stack?.substring(0, 500)
        });
        result.errors.push(errorMessage);
        return result;
      }

      result.uploaded = newTransactions.length;
      result.uploadedIds = newTransactions.map(t => t.id);
      result.success = true;

      // Step 4: Update session metadata
      await this.updateSessionMetadata();
      
      // Step 5: Immediate verification
      console.log('🔍 Immediate verification - checking if documents exist...');
      try {
        const verificationQuery = await getDocs(collection(db, this.getCollectionPath()));
        console.log('🔍 VERIFICATION: Found', verificationQuery.size, 'documents after upload');
        
        if (verificationQuery.size < newTransactions.length) {
          console.warn('⚠️ VERIFICATION WARNING: Expected', newTransactions.length, 'documents, found', verificationQuery.size);
          console.warn('⚠️ This suggests some documents may not have been written');
        } else {
          console.log('✅ VERIFICATION PASSED: All documents appear to be written');
        }
        
        // Sample a few document IDs
        const foundIds: string[] = [];
        verificationQuery.forEach(doc => {
          foundIds.push(doc.id);
        });
        
        console.log('📄 First 3 document IDs found:', foundIds.slice(0, 3));
        
      } catch (verificationError) {
        console.error('❌ Verification failed:', verificationError);
      }

      console.log('🎉 Upload completed successfully:', result);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
      console.error('💥 Transaction upload failed:', error);
      result.errors.push(`Upload failed: ${errorMessage}`);
      return result;
    }
  }

  /**
   * Get all existing transaction hashes for duplicate detection
   */
  private async getExistingHashes(): Promise<Set<string>> {
    try {
      const q = query(
        collection(db, this.getCollectionPath()),
        where('hash', '!=', '')
      );
      
      const snapshot = await getDocs(q);
      const hashes = new Set<string>();
      
      snapshot.forEach(doc => {
        const data = doc.data() as FirebaseTransaction;
        if (data.hash) {
          hashes.add(data.hash);
        }
      });
      
      return hashes;
    } catch (error) {
      console.error('Error fetching existing hashes:', error);
      return new Set();
    }
  }

  /**
   * Load all transactions from Firebase
   */
  async loadTransactions(): Promise<Transaction[]> {
    console.log('📥 TransactionManager.loadTransactions - Loading transactions...');
    
    if (!db) {
      console.error('Firebase not initialized');
      return [];
    }

    try {
      const q = query(
        collection(db, this.getCollectionPath()),
        orderBy('date', 'desc')
      );
      
      const snapshot = await getDocs(q);
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
            subcategory: data.subcategory, // Will be undefined if not present, which is correct
            balance: data.balance,
            originalData: data.originalData
          };
          
          transactions.push(transaction);
        } catch (error) {
          console.error('Error converting transaction:', doc.id, error);
        }
      });
      
      console.log('📊 Loaded', transactions.length, 'transactions from Firebase');
      return transactions;
      
    } catch (error) {
      console.error('💥 Error loading transactions:', error);
      return [];
    }
  }

  /**
   * Update session metadata after transaction changes
   */
  private async updateSessionMetadata(): Promise<void> {
    try {
      const transactions = await this.loadTransactions();
      
      const metadata: Partial<SessionMetadata> = {
        transactionCount: transactions.length,
        updatedAt: Timestamp.now()
      };

      if (transactions.length > 0) {
        const dates = transactions.map(t => t.date).sort((a, b) => a.getTime() - b.getTime());
        metadata.dateRange = {
          start: Timestamp.fromDate(dates[0]),
          end: Timestamp.fromDate(dates[dates.length - 1])
        };
      }

      const sessionRef = doc(db, `users/${this.userId}/sessions/${this.sessionId}`);
      await updateDoc(sessionRef, metadata);
      
      console.log('✅ Session metadata updated');
    } catch (error) {
      console.error('Error updating session metadata:', error);
    }
  }

  /**
   * Delete all transactions (for testing/reset)
   */
  async clearAllTransactions(): Promise<void> {
    console.log('🗑️ Clearing all transactions...');
    
    try {
      const snapshot = await getDocs(collection(db, this.getCollectionPath()));
      const batch = writeBatch(db);
      
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      await this.updateSessionMetadata();
      
      console.log('✅ All transactions cleared');
    } catch (error) {
      console.error('Error clearing transactions:', error);
      throw error;
    }
  }

  /**
   * Real-time listener for transactions
   */
  subscribeToTransactions(callback: (transactions: Transaction[]) => void): () => void {
    console.log('👂 Setting up real-time transaction listener...');
    
    const q = query(
      collection(db, this.getCollectionPath()),
      orderBy('date', 'desc')
    );
    
    return onSnapshot(q, (snapshot) => {
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
            subcategory: data.subcategory, // Will be undefined if not present, which is correct
            balance: data.balance,
            originalData: data.originalData
          };
          
          transactions.push(transaction);
        } catch (error) {
          console.error('Error converting transaction in listener:', doc.id, error);
        }
      });
      
      console.log('🔄 Real-time update:', transactions.length, 'transactions');
      callback(transactions);
    }, (error) => {
      console.error('Real-time listener error:', error);
    });
  }
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

export class SessionManager {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Create a new session
   */
  async createSession(name: string, description?: string, startingBalance: number = 0): Promise<string> {
    console.log('🆕 Creating new session:', name);
    
    const sessionRef = doc(collection(db, `users/${this.userId}/sessions`));
    const sessionId = sessionRef.id;
    
    const sessionData: SessionMetadata = {
      id: sessionId,
      userId: this.userId,
      name,
      description,
      startingBalance,
      isActive: true,
      transactionCount: 0,
      estimateCount: 0,
      dateRange: {
        start: null,
        end: null
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    await setDoc(sessionRef, sessionData);
    
    console.log('✅ Session created:', sessionId);
    return sessionId;
  }

  /**
   * Get all sessions for user
   */
  async getSessions(): Promise<SessionMetadata[]> {
    const q = query(
      collection(db, `users/${this.userId}/sessions`),
      orderBy('updatedAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const sessions: SessionMetadata[] = [];
    
    snapshot.forEach(doc => {
      const data = doc.data() as SessionMetadata;
      sessions.push(data);
    });
    
    return sessions;
  }

  /**
   * Get active session or create default one
   */
  async getActiveSession(): Promise<string> {
    const sessions = await this.getSessions();
    const activeSession = sessions.find(s => s.isActive);
    
    if (activeSession) {
      return activeSession.id;
    }
    
    // Create default session
    return await this.createSession('Default Session', 'Auto-created default session');
  }
}

// ============================================================================
// MAIN FIREBASE SERVICE
// ============================================================================

export class FirebaseService {
  private userId: string;
  private sessionManager: SessionManager;
  private transactionManager?: TransactionManager;
  private currentSessionId?: string;

  constructor(userId: string) {
    this.userId = userId;
    this.sessionManager = new SessionManager(userId);
  }

  /**
   * Initialize service with active session
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing FirebaseService for user:', this.userId);
    
    this.currentSessionId = await this.sessionManager.getActiveSession();
    this.transactionManager = new TransactionManager(this.userId, this.currentSessionId);
    
    console.log('✅ FirebaseService initialized with session:', this.currentSessionId);
  }

  /**
   * Upload CSV transactions
   */
  async uploadCSVTransactions(
    transactions: Transaction[],
    onProgress?: (progress: { completed: number; total: number; errors: string[] }) => void
  ) {
    if (!this.transactionManager) {
      await this.initialize();
    }
    
    return this.transactionManager!.uploadTransactions(transactions, onProgress);
  }

  /**
   * Load all transactions
   */
  async loadTransactions(): Promise<Transaction[]> {
    if (!this.transactionManager) {
      await this.initialize();
    }
    
    return this.transactionManager!.loadTransactions();
  }

  /**
   * Subscribe to real-time transaction updates
   */
  subscribeToTransactions(callback: (transactions: Transaction[]) => void): () => void {
    if (!this.transactionManager) {
      throw new Error('Service not initialized');
    }
    
    return this.transactionManager.subscribeToTransactions(callback);
  }

  /**
   * Clear all data (for testing)
   */
  async clearAllData(): Promise<void> {
    if (!this.transactionManager) {
      await this.initialize();
    }
    
    await this.transactionManager!.clearAllTransactions();
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE FACTORY
// ============================================================================

let firebaseServiceInstance: FirebaseService | null = null;

export const getFirebaseService = (userId: string): FirebaseService => {
  if (!firebaseServiceInstance || firebaseServiceInstance['userId'] !== userId) {
    firebaseServiceInstance = new FirebaseService(userId);
  }
  return firebaseServiceInstance;
};

export const resetFirebaseService = (): void => {
  firebaseServiceInstance = null;
};