import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Transaction, 
  RawTransaction, 
  Estimate, 
  WeeklyCashflow 
} from '../types';
import { 
  convertToTransaction, 
  parseCSVFile 
} from '../utils/csvParser';
import { 
  categorizeTransactions 
} from '../utils/transactionCategorizer';
import { 
  calculateRollingCashflows 
} from '../utils/rollingTimeline';
import {
  saveTransactions,
  getUserTransactions,
  getTransactionsByHashes,
  saveEstimate,
  getUserEstimates,
  updateEstimate,
  deleteEstimate,
  subscribeToUserEstimates
} from '../services/directDatabase';
import {
  createTransactionHashFromRaw,
  filterDuplicateTransactions,
  getTransactionStats
} from '../utils/transactionHash';

interface UseDirectCashflowDataReturn {
  // Data
  transactions: Transaction[];
  estimates: Estimate[];
  weeklyCashflows: WeeklyCashflow[];
  
  // States
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  
  // Actions
  loadTransactionData: () => Promise<void>;
  uploadCSVData: (file: File) => Promise<{ success: boolean; stats: any; error?: string }>;
  addEstimate: (estimate: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateEstimateData: (id: string, updates: Partial<Estimate>) => Promise<void>;
  deleteEstimateData: (id: string) => Promise<void>;
  clearError: () => void;
  
  // Computed values
  startingBalance: number;
  totalTransactions: number;
  totalEstimates: number;
}

export const useDirectCashflowData = (): UseDirectCashflowDataReturn => {
  const { currentUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load all user transactions
  const loadTransactionData = useCallback(async () => {
    if (!currentUser?.uid) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('📊 Loading transactions for user:', currentUser.uid);
      const transactionsResult = await getUserTransactions(currentUser.uid);
      
      if (transactionsResult.success) {
        console.log(`✅ Loaded ${transactionsResult.data.length} transactions`);
        setTransactions(transactionsResult.data);
      } else {
        const errorMsg = `Failed to load transactions: ${transactionsResult.error.message}`;
        console.error('❌', errorMsg);
        setError(errorMsg);
      }
    } catch (error: any) {
      const errorMsg = `Error loading data: ${error.message}`;
      console.error('💥', errorMsg);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.uid]);

  // Upload CSV data with duplicate checking
  const uploadCSVData = useCallback(async (file: File) => {
    if (!currentUser?.uid) {
      return { success: false, stats: {}, error: 'No authenticated user' };
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      console.log('📤 Processing CSV file:', file.name);
      
      // Parse CSV file
      const rawTransactions = await parseCSVFile(file);
      console.log(`📋 Parsed ${rawTransactions.length} transactions from CSV`);
      
      // Convert to processed transactions
      const processedTransactions = rawTransactions.map(raw => {
        const transaction = convertToTransaction(raw);
        // Add hash for duplicate detection
        transaction.hash = createTransactionHashFromRaw(raw);
        return transaction;
      });
      
      // Categorize transactions
      const categorizedTransactions = categorizeTransactions(processedTransactions);
      
      // Check for duplicates against existing transactions
      const stats = getTransactionStats(categorizedTransactions, transactions);
      console.log('🔍 Duplicate check results:', stats);
      
      if (stats.unique > 0) {
        // Save only unique transactions
        const saveResult = await saveTransactions(currentUser.uid, stats.uniqueTransactions);
        
        if (saveResult.success) {
          console.log(`✅ Saved ${stats.unique} new transactions`);
          // Reload data to get updated list
          await loadTransactionData();
        } else {
          throw new Error(`Failed to save transactions: ${saveResult.error.message}`);
        }
      }
      
      return {
        success: true,
        stats: {
          total: stats.total,
          unique: stats.unique,
          duplicates: stats.duplicates,
          saved: stats.unique
        }
      };
    } catch (error: any) {
      const errorMsg = `CSV upload failed: ${error.message}`;
      console.error('💥', errorMsg);
      setError(errorMsg);
      return { success: false, stats: {}, error: errorMsg };
    } finally {
      setIsSaving(false);
    }
  }, [currentUser?.uid, transactions, loadTransactionData]);

  // Estimate management
  const addEstimate = useCallback(async (estimateData: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!currentUser?.uid) return;
    
    setIsSaving(true);
    try {
      const result = await saveEstimate(currentUser.uid, estimateData);
      if (!result.success) {
        throw new Error(result.error.message);
      }
      console.log('✅ Estimate added successfully');
    } catch (error: any) {
      console.error('❌ Failed to add estimate:', error);
      setError(`Failed to add estimate: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [currentUser?.uid]);

  const updateEstimateData = useCallback(async (id: string, updates: Partial<Estimate>) => {
    setIsSaving(true);
    try {
      const result = await updateEstimate(id, updates);
      if (!result.success) {
        throw new Error(result.error.message);
      }
      console.log('✅ Estimate updated successfully');
    } catch (error: any) {
      console.error('❌ Failed to update estimate:', error);
      setError(`Failed to update estimate: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  }, []);

  const deleteEstimateData = useCallback(async (id: string) => {
    setIsSaving(true);
    try {
      const result = await deleteEstimate(id);
      if (!result.success) {
        throw new Error(result.error.message);
      }
      console.log('✅ Estimate deleted successfully');
    } catch (error: any) {
      console.error('❌ Failed to delete estimate:', error);
      setError(`Failed to delete estimate: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Load data when user changes
  useEffect(() => {
    if (currentUser?.uid) {
      loadTransactionData();
    } else {
      setTransactions([]);
      setEstimates([]);
    }
  }, [currentUser?.uid, loadTransactionData]);

  // Subscribe to estimates updates
  useEffect(() => {
    if (!currentUser?.uid) return;
    
    console.log('🔔 Setting up estimates subscription');
    const unsubscribe = subscribeToUserEstimates(currentUser.uid, (newEstimates) => {
      console.log(`🔄 Received ${newEstimates.length} estimates from subscription`);
      setEstimates(newEstimates);
    });
    
    return unsubscribe || undefined;
  }, [currentUser?.uid]);

  // Calculate weekly cashflows
  const weeklyCashflows = useMemo(() => {
    if (transactions.length === 0) return [];
    
    try {
      const startingBalance = transactions.length > 0 
        ? Math.max(...transactions.map(t => t.balance))
        : 0;
      
      return calculateRollingCashflows(transactions, estimates, startingBalance);
    } catch (error) {
      console.error('Error calculating weekly cashflows:', error);
      return [];
    }
  }, [transactions, estimates]);

  // Computed values
  const computedValues = useMemo(() => {
    const startingBalance = transactions.length > 0 
      ? Math.max(...transactions.map(t => t.balance))
      : 0;
    
    return {
      startingBalance,
      totalTransactions: transactions.length,
      totalEstimates: estimates.length
    };
  }, [transactions, estimates]);

  return {
    // Data
    transactions,
    estimates,
    weeklyCashflows,
    
    // States
    isLoading,
    isSaving,
    error,
    
    // Actions
    loadTransactionData,
    uploadCSVData,
    addEstimate,
    updateEstimateData,
    deleteEstimateData,
    clearError,
    
    // Computed values
    ...computedValues
  };
};