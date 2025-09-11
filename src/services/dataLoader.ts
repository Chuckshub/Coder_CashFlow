import { Transaction, Estimate } from '../types';
import { getFirebaseService } from './firebaseService';

// ============================================================================
// DATA LOADER WITH CACHING AND REAL-TIME UPDATES
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

export class DataLoader {
  private userId: string;
  private cache: Map<string, CachedData<any>> = new Map();
  private listeners: Map<string, Set<DataChangeCallback<any>>> = new Map();
  private unsubscribeFunctions: Map<string, () => void> = new Map();
  private cacheExpiryMs: number = 5 * 60 * 1000; // 5 minutes

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Load transactions with caching and real-time updates
   */
  async loadTransactions(
    forceRefresh: boolean = false,
    enableRealTime: boolean = true
  ): Promise<{ data: Transaction[]; state: DataLoadingState }> {
    const cacheKey = 'transactions';
    
    // Check cache first (unless force refresh)
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

    console.log('📥 Loading transactions from Firebase...');
    
    const state: DataLoadingState = {
      isLoading: true,
      isError: false,
      hasData: false
    };

    // Notify listeners of loading state
    this.notifyListeners(cacheKey, [], state);

    try {
      const firebaseService = getFirebaseService(this.userId);
      await firebaseService.initialize();
      
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
        console.log('👂 Setting up real-time transaction listener...');
        
        const unsubscribe = firebaseService.subscribeToTransactions((updatedTransactions) => {
          console.log('🔄 Real-time transaction update received:', updatedTransactions.length);
          
          // Update cache with real-time data
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
      
      // Notify listeners of success
      this.notifyListeners(cacheKey, transactions, finalState);
      
      console.log('✅ Transactions loaded successfully:', transactions.length);
      
      return {
        data: transactions,
        state: finalState
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load transactions';
      console.error('💥 Error loading transactions:', error);
      
      const errorState: DataLoadingState = {
        isLoading: false,
        isError: true,
        errorMessage,
        hasData: false
      };
      
      // Notify listeners of error
      this.notifyListeners(cacheKey, [], errorState);
      
      return {
        data: [],
        state: errorState
      };
    }
  }

  /**
   * Subscribe to transaction updates
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
          
          // Clean up Firebase listener if no more subscribers
          const unsubscribe = this.unsubscribeFunctions.get(key);
          if (unsubscribe) {
            unsubscribe();
            this.unsubscribeFunctions.delete(key);
            console.log('🗏 Cleaned up Firebase listener for:', key);
          }
        }
      }
    };
  }

  /**
   * Notify all listeners of data changes
   */
  private notifyListeners<T>(key: string, data: T, state: DataLoadingState): void {
    const callbacks = this.listeners.get(key);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data, state);
        } catch (error) {
          console.error('Error in data listener callback:', error);
        }
      });
    }
  }

  /**
   * Update cache with new data
   */
  private updateCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: new Date(),
      isStale: false
    });
  }

  /**
   * Check if cached data is still valid
   */
  private isCacheValid(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    
    const age = Date.now() - cached.timestamp.getTime();
    return age < this.cacheExpiryMs && !cached.isStale;
  }

  /**
   * Invalidate cache for a specific key
   */
  invalidateCache(key?: string): void {
    if (key) {
      const cached = this.cache.get(key);
      if (cached) {
        cached.isStale = true;
      }
      console.log('🗋 Cache invalidated for:', key);
    } else {
      // Invalidate all cache
      this.cache.forEach(cached => {
        cached.isStale = true;
      });
      console.log('🗋 All cache invalidated');
    }
  }

  /**
   * Clear all cache and listeners
   */
  clearAll(): void {
    console.log('🧽 Clearing all data loader state...');
    
    // Unsubscribe from all Firebase listeners
    this.unsubscribeFunctions.forEach((unsubscribe, key) => {
      unsubscribe();
      console.log('🗏 Unsubscribed from:', key);
    });
    
    this.cache.clear();
    this.listeners.clear();
    this.unsubscribeFunctions.clear();
    
    console.log('✅ Data loader cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    keys: string[];
    totalItems: number;
    validItems: number;
    staleItems: number;
  } {
    const keys = Array.from(this.cache.keys());
    let validItems = 0;
    let staleItems = 0;
    
    keys.forEach(key => {
      if (this.isCacheValid(key)) {
        validItems++;
      } else {
        staleItems++;
      }
    });
    
    return {
      keys,
      totalItems: this.cache.size,
      validItems,
      staleItems
    };
  }

  /**
   * Force refresh all cached data
   */
  async refreshAll(): Promise<void> {
    console.log('🔄 Refreshing all cached data...');
    
    this.invalidateCache();
    
    // Reload transactions if there are listeners
    if (this.listeners.has('transactions')) {
      await this.loadTransactions(true, true);
    }
    
    console.log('✅ All data refreshed');
  }
}

// ============================================================================
// SINGLETON DATA LOADER FACTORY
// ============================================================================

let dataLoaderInstance: DataLoader | null = null;

export const getDataLoader = (userId: string): DataLoader => {
  if (!dataLoaderInstance || dataLoaderInstance['userId'] !== userId) {
    // Clean up previous instance
    if (dataLoaderInstance) {
      dataLoaderInstance.clearAll();
    }
    
    dataLoaderInstance = new DataLoader(userId);
    console.log('🆕 Created new DataLoader for user:', userId);
  }
  
  return dataLoaderInstance;
};

export const resetDataLoader = (): void => {
  if (dataLoaderInstance) {
    dataLoaderInstance.clearAll();
  }
  dataLoaderInstance = null;
  console.log('🧽 DataLoader reset');
};
