import { useState, useCallback, useMemo } from 'react';
import { 
  Transaction, 
  RawTransaction, 
  Estimate, 
  WeeklyCashflow, 
  AppState 
} from '../types';
import { 
  convertToTransaction, 
  parseDate 
} from '../utils/csvParser';
import { 
  categorizeTransactions 
} from '../utils/transactionCategorizer';
import { 
  calculateWeeklyCashflows 
} from '../utils/dateUtils';
import { v4 as uuidv4 } from 'uuid';

interface UseCashflowDataReturn {
  // State
  transactions: Transaction[];
  estimates: Estimate[];
  weeklyCashflows: WeeklyCashflow[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadTransactions: (rawTransactions: RawTransaction[]) => void;
  addEstimate: (estimate: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateEstimate: (id: string, updates: Partial<Estimate>) => void;
  deleteEstimate: (id: string) => void;
  clearError: () => void;
  reset: () => void;
  
  // Computed values
  startingBalance: number;
  totalActualInflow: number;
  totalActualOutflow: number;
  totalEstimatedInflow: number;
  totalEstimatedOutflow: number;
}

const INITIAL_STATE: AppState = {
  transactions: [],
  weeklyCashflows: [],
  estimates: [],
  categories: {
    inflow: [],
    outflow: []
  },
  currentWeek: 1,
  startingBalance: 0
};

export const useCashflowData = (): UseCashflowDataReturn => {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load and process transactions from CSV
  const loadTransactions = useCallback((rawTransactions: RawTransaction[]) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Convert raw transactions to processed format
      const processedTransactions = rawTransactions.map(convertToTransaction);
      
      // Categorize transactions
      const categorizedTransactions = categorizeTransactions(processedTransactions);
      
      // Sort by date (newest first for display, but we'll use chronological for calculations)
      const sortedTransactions = [...categorizedTransactions].sort(
        (a, b) => b.date.getTime() - a.date.getTime()
      );
      
      // Calculate starting balance from the most recent transaction's balance
      const startingBalance = rawTransactions.length > 0 
        ? Math.max(...rawTransactions.map(t => t.Balance))
        : 0;
      
      // Extract unique categories
      const inflowCategories = Array.from(new Set(
        categorizedTransactions
          .filter(t => t.type === 'inflow')
          .map(t => t.category)
      ));
      
      const outflowCategories = Array.from(new Set(
        categorizedTransactions
          .filter(t => t.type === 'outflow')
          .map(t => t.category)
      ));
      
      setState(prev => ({
        ...prev,
        transactions: sortedTransactions,
        startingBalance,
        categories: {
          inflow: inflowCategories,
          outflow: outflowCategories
        }
      }));
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process transactions';
      setError(errorMessage);
      console.error('Error processing transactions:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Add new estimate
  const addEstimate = useCallback((estimateData: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newEstimate: Estimate = {
      ...estimateData,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    setState(prev => ({
      ...prev,
      estimates: [...prev.estimates, newEstimate]
    }));
  }, []);

  // Update existing estimate
  const updateEstimate = useCallback((id: string, updates: Partial<Estimate>) => {
    setState(prev => ({
      ...prev,
      estimates: prev.estimates.map(estimate => 
        estimate.id === id 
          ? { ...estimate, ...updates, updatedAt: new Date() }
          : estimate
      )
    }));
  }, []);

  // Delete estimate
  const deleteEstimate = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      estimates: prev.estimates.filter(estimate => estimate.id !== id)
    }));
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Reset state
  const reset = useCallback(() => {
    setState(INITIAL_STATE);
    setError(null);
    setIsLoading(false);
  }, []);

  // Calculate weekly cashflows
  const weeklyCashflows = useMemo(() => {
    if (state.transactions.length === 0) {
      return [];
    }
    
    try {
      return calculateWeeklyCashflows(
        state.transactions,
        state.estimates,
        state.startingBalance
      );
    } catch (err) {
      console.error('Error calculating weekly cashflows:', err);
      return [];
    }
  }, [state.transactions, state.estimates, state.startingBalance]);

  // Computed values
  const computedValues = useMemo(() => {
    const totalActualInflow = state.transactions
      .filter(t => t.type === 'inflow')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalActualOutflow = state.transactions
      .filter(t => t.type === 'outflow')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalEstimatedInflow = state.estimates
      .filter(e => e.type === 'inflow')
      .reduce((sum, e) => sum + e.amount, 0);
    
    const totalEstimatedOutflow = state.estimates
      .filter(e => e.type === 'outflow')
      .reduce((sum, e) => sum + e.amount, 0);
    
    return {
      totalActualInflow,
      totalActualOutflow,
      totalEstimatedInflow,
      totalEstimatedOutflow
    };
  }, [state.transactions, state.estimates]);

  return {
    // State
    transactions: state.transactions,
    estimates: state.estimates,
    weeklyCashflows,
    isLoading,
    error,
    
    // Actions
    loadTransactions,
    addEstimate,
    updateEstimate,
    deleteEstimate,
    clearError,
    reset,
    
    // Computed values
    startingBalance: state.startingBalance,
    ...computedValues
  };
};