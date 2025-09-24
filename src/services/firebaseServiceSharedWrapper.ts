import { Transaction, RawTransaction, Estimate } from '../types';
import { SharedTransactionManager, SharedEstimateManager, SharedSessionMetadata } from './firebaseServiceShared';
import { v4 as uuidv4 } from 'uuid';
import { doc, setDoc, Timestamp, collection, query, where, orderBy, getDocs, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

// ============================================================================
// SHARED FIREBASE SERVICE WRAPPER
// ============================================================================

/**
 * This service wraps the shared Firebase services to maintain compatibility
 * with the existing application interface while using shared collections.
 * 
 * Instead of user-specific collections, all data is stored in shared collections
 * that are accessible to all authenticated users.
 */

export interface SimpleBankBalance {
  id: string;
  date: Date;
  amount: number;
  source: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SimpleFirebaseService {
  uploadTransactions(
    transactions: Transaction[],
    userName: string,
    userEmail: string,
    onProgress?: (uploaded: number, total: number, duplicates: number) => void
  ): Promise<{
    success: boolean;
    message: string;
    uploaded: number;
    duplicates: number;
    errors: string[];
  }>;

  loadTransactions(): Promise<Transaction[]>;
  
  saveEstimate(
    estimate: Estimate,
    userName: string,
    userEmail: string
  ): Promise<{ success: boolean; message: string; error?: string }>;
  
  loadEstimates(): Promise<Estimate[]>;
  
  deleteEstimate(estimateId: string): Promise<{ success: boolean; message: string; error?: string }>;
  
  saveBankBalance(
    balance: SimpleBankBalance
  ): Promise<{ success: boolean; message: string; error?: string }>;
  
  loadBankBalances(): Promise<Map<number, number>>;
  
  deleteBankBalance(weekNumber: number): Promise<{ success: boolean; message: string; error?: string }>;
  
  // New shared-specific methods
  loadAllSessions(): Promise<SharedSessionMetadata[]>;
  createSession(name: string, startingBalance: number): Promise<string>;
  switchToSession(sessionId: string): void;
}

class SharedFirebaseServiceImpl implements SimpleFirebaseService {
  private userId: string;
  private currentSessionId: string;
  private transactionManager: SharedTransactionManager;
  private estimateManager: SharedEstimateManager;

  constructor(userId: string, initialSessionId?: string) {
    this.userId = userId;
    this.currentSessionId = initialSessionId || 'default_session';
    this.transactionManager = new SharedTransactionManager(this.userId, this.currentSessionId);
    this.estimateManager = new SharedEstimateManager(this.userId, this.currentSessionId);
  }

  switchToSession(sessionId: string): void {
    this.currentSessionId = sessionId;
    this.transactionManager = new SharedTransactionManager(this.userId, this.currentSessionId);
    this.estimateManager = new SharedEstimateManager(this.userId, this.currentSessionId);
    console.log('✅ Switched to shared session:', sessionId);
  }

  async uploadTransactions(
    transactions: Transaction[],
    userName: string,
    userEmail: string,
    onProgress?: (uploaded: number, total: number, duplicates: number) => void
  ): Promise<{
    success: boolean;
    message: string;
    uploaded: number;
    duplicates: number;
    errors: string[];
  }> {
    console.log('🚀 SharedFirebaseService.uploadTransactions - Starting shared upload...');
    
    try {
      const result = await this.transactionManager.uploadTransactions(
        transactions,
        onProgress ? (progress) => {
          onProgress(progress.completed, progress.total, 0); // Legacy interface
        } : undefined
      );
      
      return {
        success: result.success,
        message: result.success 
          ? `Successfully uploaded ${result.uploaded} transactions to shared collection (${result.duplicates} duplicates skipped)`
          : `Upload failed: ${result.errors.join(', ')}`,
        uploaded: result.uploaded,
        duplicates: result.duplicates,
        errors: result.errors
      };
    } catch (error) {
      console.error('💥 Shared transaction upload error:', error);
      return {
        success: false,
        message: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        uploaded: 0,
        duplicates: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  async loadTransactions(): Promise<Transaction[]> {
    console.log('📥 SharedFirebaseService.loadTransactions - Loading from shared collection...');
    return await this.transactionManager.loadTransactions();
  }

  async saveEstimate(
    estimate: Estimate,
    userName: string,
    userEmail: string
  ): Promise<{ success: boolean; message: string; error?: string }> {
    console.log('💾 SharedFirebaseService.saveEstimate - Saving to shared collection...');
    
    try {
      await this.estimateManager.saveEstimate(estimate);
      return {
        success: true,
        message: `Estimate saved to shared collection by ${userName}`
      };
    } catch (error) {
      console.error('💥 Shared estimate save error:', error);
      return {
        success: false,
        message: 'Failed to save estimate to shared collection',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async loadEstimates(): Promise<Estimate[]> {
    console.log('📥 SharedFirebaseService.loadEstimates - Loading from shared collection...');
    return await this.estimateManager.loadEstimates();
  }

  async deleteEstimate(estimateId: string): Promise<{ success: boolean; message: string; error?: string }> {
    console.log('🗑️ SharedFirebaseService.deleteEstimate - Deleting from shared collection...');
    
    try {
      await this.estimateManager.deleteEstimate(estimateId);
      return {
        success: true,
        message: 'Estimate deleted from shared collection'
      };
    } catch (error) {
      console.error('💥 Shared estimate delete error:', error);
      return {
        success: false,
        message: 'Failed to delete estimate from shared collection',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async saveBankBalance(
    balance: SimpleBankBalance
  ): Promise<{ success: boolean; message: string; error?: string }> {
    console.log('💾 SharedFirebaseService.saveBankBalance - Saving to shared collection...');
    
    try {
      const docRef = doc(db, 'shared_bank_balances', balance.id);
      const firebaseData = {
        id: balance.id,
        weekNumber: parseInt(balance.id.split('_')[1]) || 0, // Extract week number from ID
        date: Timestamp.fromDate(balance.date),
        amount: balance.amount,
        source: balance.source,
        userId: balance.userId,
        createdAt: Timestamp.fromDate(balance.createdAt),
        updatedAt: Timestamp.fromDate(balance.updatedAt)
      };
      
      await setDoc(docRef, firebaseData);
      console.log('✅ Bank balance saved to shared collection:', balance.id);
      
      return {
        success: true,
        message: 'Bank balance saved to shared collection'
      };
    } catch (error) {
      console.error('💥 Error saving bank balance:', error);
      return {
        success: false,
        message: 'Failed to save bank balance',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async loadBankBalances(): Promise<Map<number, number>> {
    console.log('📥 SharedFirebaseService.loadBankBalances - Loading from shared collection...');
    
    try {
      const q = query(
        collection(db, 'shared_bank_balances'),
        where('userId', '==', this.userId),
        orderBy('weekNumber', 'asc')
      );
      
      const snapshot = await getDocs(q);
      const bankBalances = new Map<number, number>();
      
      snapshot.forEach(doc => {
        const data = doc.data();
        bankBalances.set(data.weekNumber, data.amount);
      });
      
      console.log(`✅ Loaded ${bankBalances.size} bank balances from shared collection`);
      return bankBalances;
      
    } catch (error) {
      console.error('💥 Error loading bank balances:', error);
      return new Map();
    }
  }

  async deleteBankBalance(weekNumber: number): Promise<{ success: boolean; message: string; error?: string }> {
    console.log(`🗑️ SharedFirebaseService.deleteBankBalance - Deleting week ${weekNumber}`);
    
    try {
      // Query for the balance to delete
      const q = query(
        collection(db, 'shared_bank_balances'),
        where('userId', '==', this.userId),
        where('weekNumber', '==', weekNumber)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return {
          success: true,
          message: 'No bank balance found to delete'
        };
      }
      
      // Delete all matching documents
      const batch = writeBatch(db);
      snapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log(`✅ Deleted bank balance for week ${weekNumber}`);
      
      return {
        success: true,
        message: `Bank balance deleted for week ${weekNumber}`
      };
    } catch (error) {
      console.error('💥 Error deleting bank balance:', error);
      return {
        success: false,
        message: 'Failed to delete bank balance',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async loadAllSessions(): Promise<SharedSessionMetadata[]> {
    console.log('📥 SharedFirebaseService.loadAllSessions - Loading all shared sessions...');
    return await this.transactionManager.loadAllSessions();
  }

  async createSession(name: string, startingBalance: number): Promise<string> {
    console.log('✨ SharedFirebaseService.createSession - Creating new shared session...');
    return await this.transactionManager.createSharedSession(name, startingBalance);
  }
}

// Service factory with session management
const serviceInstances = new Map<string, SharedFirebaseServiceImpl>();
let globalCurrentSession = 'default_session';

export const getSharedFirebaseService = (userId: string, sessionId?: string): SimpleFirebaseService => {
  const effectiveSessionId = sessionId || globalCurrentSession;
  const serviceKey = `${userId}_${effectiveSessionId}`;
  
  if (!serviceInstances.has(serviceKey)) {
    console.log('🔧 Creating new shared Firebase service instance for:', serviceKey);
    serviceInstances.set(serviceKey, new SharedFirebaseServiceImpl(userId, effectiveSessionId));
  } else {
    console.log('♻️ Reusing existing shared Firebase service instance for:', serviceKey);
  }
  
  return serviceInstances.get(serviceKey)!;
};

// Global session management
export const setGlobalSession = (sessionId: string): void => {
  console.log('🌍 Setting global shared session to:', sessionId);
  globalCurrentSession = sessionId;
  // Clear existing service instances to force recreation with new session
  serviceInstances.clear();
};

export const getCurrentGlobalSession = (): string => {
  return globalCurrentSession;
};

// Initialize default session
export const initializeDefaultSharedSession = async (userId: string): Promise<string> => {
  console.log('🚀 Initializing default shared session for user:', userId);
  
  try {
    const service = getSharedFirebaseService(userId);
    const sessions = await service.loadAllSessions();
    
    if (sessions.length === 0) {
      console.log('📝 No shared sessions found, creating default session...');
      const defaultSessionId = await service.createSession('Default Shared Session', 0);
      setGlobalSession(defaultSessionId);
      return defaultSessionId;
    } else {
      console.log(`📋 Found ${sessions.length} shared sessions, using most recent...`);
      const mostRecentSession = sessions[0]; // Already sorted by updatedAt desc
      setGlobalSession(mostRecentSession.id);
      return mostRecentSession.id;
    }
  } catch (error) {
    console.error('💥 Error initializing default shared session:', error);
    // Fall back to default session ID
    const fallbackSessionId = 'default_session';
    setGlobalSession(fallbackSessionId);
    return fallbackSessionId;
  }
};
