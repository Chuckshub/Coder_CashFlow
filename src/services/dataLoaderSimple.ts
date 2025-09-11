import { Transaction } from '../types';
import { getSimpleFirebaseService } from './firebaseServiceSimple';

// ============================================================================
// SIMPLIFIED DATA LOADER
// ============================================================================

export interface DataLoadingState {
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  lastUpdated?: Date;
  hasData: boolean;
}

export interface CachedData<T> {
  data: T;
  timestamp: Date;
  isStale: boolean;
}

type DataChangeCallback<T> = (data: T, state: DataLoadingState) => void;

export class SimpleDataLoader {
  private userId: string;
  private cache: Map<string, CachedData<any>> = new Map();
  private listeners: Map<string, Set<DataChangeCallback<any>>> = new Map();
  private unsubscribeFunctions: Map<string, () => void> = new Map();
  private cacheExpiryMs: number = 5 * 60 * 1000; // 5 minutes

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Load transactions (MUCH SIMPLER!)
   */
  async loadTransactions(
    forceRefresh: boolean = false,
    enableRealTime: boolean = true
  ): Promise<{ data: Transaction[]; state: DataLoadingState }> {
    const cacheKey = 'transactions';
    
    // Check cache first
    if (!forceRefresh && this.isCacheValid(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      console.log('💾 Using cached transactions:', cached.data.length);
      
      return {
        data: cached.data,
        state: {
          isLoading: false,
          isError: false,
          lastUpdated: cached.timestamp,
          hasData: cached.data.length > 0
        }
      };
    }

    console.log('📥 Loading transactions with SIMPLIFIED loader...');
    
    const state: DataLoadingState = {
      isLoading: true,
      isError: false,
      hasData: false
    };

    // Notify listeners of loading state
    this.notifyListeners(cacheKey, [], state);

    try {
      const firebaseService = getSimpleFirebaseService(this.userId);
      const transactions = await firebaseService.loadTransactions();
      
      // Update cache
      this.updateCache(cacheKey, transactions);
      
      const finalState: DataLoadingState = {
        isLoading: false,
        isError: false,
        lastUpdated: new Date(),
        hasData: transactions.length > 0
      };

      // Set up real-time listener if requested
      if (enableRealTime && !this.unsubscribeFunctions.has(cacheKey)) {
        console.log('👂 Setting up SIMPLIFIED real-time listener...');
        
        const unsubscribe = firebaseService.subscribeToTransactions((updatedTransactions) => {
          console.log('🔄 SIMPLIFIED real-time update:', updatedTransactions.length, 'transactions');
          
          // Update cache
          this.updateCache(cacheKey, updatedTransactions);
          
          // Notify listeners
          this.notifyListeners(cacheKey, updatedTransactions, {
            isLoading: false,
            isError: false,
            lastUpdated: new Date(),
            hasData: updatedTransactions.length > 0
          });
        });
        
        this.unsubscribeFunctions.set(cacheKey, unsubscribe);
      }
      
      // Notify listeners
      this.notifyListeners(cacheKey, transactions, finalState);
      
      console.log('✅ SIMPLIFIED transactions loaded:', transactions.length);
      
      return {
        data: transactions,
        state: finalState
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load transactions';
      console.error('💥 SIMPLIFIED loader error:', error);
      
      const errorState: DataLoadingState = {
        isLoading: false,
        isError: true,
        errorMessage,
        hasData: false
      };
      
      this.notifyListeners(cacheKey, [], errorState);
      
      return {
        data: [],
        state: errorState
      };
    }
  }

  /**
   * Subscribe to transaction updates (SIMPLIFIED!)
   */
  subscribeToTransactions(callback: DataChangeCallback<Transaction[]>): () => void {
    return this.subscribe('transactions', callback);
  }

  /**
   * Generic subscription method
   */
  private subscribe<T>(key: string, callback: DataChangeCallback<T>): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    
    this.listeners.get(key)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.listeners.delete(key);
          
          // Clean up Firebase listener
          const unsubscribe = this.unsubscribeFunctions.get(key);
          if (unsubscribe) {
            unsubscribe();
            this.unsubscribeFunctions.delete(key);
            console.log('🗏 SIMPLIFIED cleanup for:', key);
          }
        }
      }
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners<T>(key: string, data: T, state: DataLoadingState): void {
    const callbacks = this.listeners.get(key);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data, state);
        } catch (error) {
          console.error('Error in listener callback:', error);
        }
      });
    }
  }

  /**
   * Update cache
   */
  private updateCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: new Date(),
      isStale: false
    });
  }

  /**
   * Check cache validity
   */
  private isCacheValid(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    
    const age = Date.now() - cached.timestamp.getTime();
    return age < this.cacheExpiryMs && !cached.isStale;
  }

  /**
   * Invalidate cache
   */
  invalidateCache(key?: string): void {
    if (key) {
      const cached = this.cache.get(key);
      if (cached) {
        cached.isStale = true;
      }
      console.log('🗋 SIMPLIFIED cache invalidated for:', key);
    } else {
      this.cache.forEach(cached => {
        cached.isStale = true;
      });
      console.log('🗋 SIMPLIFIED all cache invalidated');
    }
  }

  /**
   * Clear all
   */
  clearAll(): void {
    console.log('🧹 SIMPLIFIED data loader cleanup...');
    
    this.unsubscribeFunctions.forEach((unsubscribe, key) => {
      unsubscribe();
      console.log('🗏 SIMPLIFIED unsubscribed from:', key);
    });
    
    this.cache.clear();
    this.listeners.clear();
    this.unsubscribeFunctions.clear();
    
    console.log('✅ SIMPLIFIED data loader cleared');
  }

  /**
   * Refresh all data
   */
  async refreshAll(): Promise<void> {
    console.log('🔄 SIMPLIFIED refresh all data...');
    
    this.invalidateCache();
    
    if (this.listeners.has('transactions')) {
      await this.loadTransactions(true, true);
    }
    
    console.log('✅ SIMPLIFIED refresh complete');
  }
}

// ============================================================================
// SIMPLIFIED SINGLETON FACTORY
// ============================================================================

let simpleDataLoaderInstance: SimpleDataLoader | null = null;

export const getSimpleDataLoader = (userId: string): SimpleDataLoader => {
  if (!simpleDataLoaderInstance || simpleDataLoaderInstance['userId'] !== userId) {
    if (simpleDataLoaderInstance) {
      simpleDataLoaderInstance.clearAll();
    }
    
    simpleDataLoaderInstance = new SimpleDataLoader(userId);
    console.log('🆕 Created SIMPLIFIED DataLoader for user:', userId);
  }
  
  return simpleDataLoaderInstance;
};

export const resetSimpleDataLoader = (): void => {
  if (simpleDataLoaderInstance) {
    simpleDataLoaderInstance.clearAll();
  }
  simpleDataLoaderInstance = null;
  console.log('🧹 SIMPLIFIED DataLoader reset');
};
