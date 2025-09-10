import { useState, useEffect, useCallback, useMemo } from 'react';
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
import {
  createCashflowSession,
  getCashflowSessions,
  saveTransactions,
  getTransactions,
  saveEstimate,
  updateEstimate,
  deleteEstimate,
  getEstimates,
  subscribeToEstimates,
  clearSessionData
} from '../services/database';
import { isFirebaseAvailable, FirebaseCashflowSession } from '../services/firebase';
import { v4 as uuidv4 } from 'uuid';

interface UseCashflowDataWithFirebaseReturn {
  // State
  transactions: Transaction[];
  estimates: Estimate[];
  weeklyCashflows: WeeklyCashflow[];
  sessions: FirebaseCashflowSession[];
  currentSession: FirebaseCashflowSession | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  isFirebaseEnabled: boolean;

  // Actions
  loadTransactions: (rawTransactions: RawTransaction[]) => Promise<void>;
  addEstimate: (estimate: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateEstimateById: (id: string, updates: Partial<Estimate>) => Promise<void>;
  deleteEstimateById: (id: string) => Promise<void>;
  createNewSession: (name: string, description?: string) => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  clearCurrentSession: () => Promise<void>;
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

// Simple user ID for demo purposes (in production, use Firebase Auth)
const getUserId = (): string => {
  let userId = localStorage.getItem('cashflow_user_id');
  if (!userId) {
    userId = uuidv4();
    localStorage.setItem('cashflow_user_id', userId);
  }
  return userId;
};

export const useCashflowDataWithFirebase = (): UseCashflowDataWithFirebaseReturn => {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [sessions, setSessions] = useState<FirebaseCashflowSession[]>([]);
  const [currentSession, setCurrentSession] = useState<FirebaseCashflowSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId] = useState(() => getUserId());
  const isFirebaseEnabled = isFirebaseAvailable();

  // Load existing sessions on mount
  useEffect(() => {
    if (isFirebaseEnabled) {
      loadSessions();
    }
  }, [isFirebaseEnabled]);

  // Subscribe to real-time estimate updates
  useEffect(() => {
    if (isFirebaseEnabled && currentSession) {
      const unsubscribe = subscribeToEstimates(currentSession.id, (estimates) => {
        setState(prev => ({ ...prev, estimates }));
      });
      
      return unsubscribe || undefined;
    }
  }, [isFirebaseEnabled, currentSession]);

  const loadSessions = async () => {
    if (!isFirebaseEnabled) return;
    
    try {
      const result = await getCashflowSessions(userId);
      if (result.success) {
        setSessions(result.data);
        // Auto-load the most recent active session
        const activeSession = result.data.find(s => s.isActive) || result.data[0];
        if (activeSession) {
          await loadSession(activeSession.id);
        }
      } else {
        console.error('Failed to load sessions:', result.error);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const createNewSession = useCallback(async (name: string, description?: string) => {
    if (!isFirebaseEnabled) {
      setError('Firebase is not available. Data will only be stored locally.');
      return;
    }

    setIsSaving(true);
    try {
      const result = await createCashflowSession(userId, name, description, state.startingBalance);
      if (result.success) {
        // Mark other sessions as inactive
        sessions.forEach(async (session) => {
          if (session.isActive) {
            // In a real app, you'd update this in Firebase too
          }
        });
        
        // Reload sessions to get the new one
        await loadSessions();
      } else {
        setError(`Failed to create session: ${result.error.message}`);
      }
    } catch (error: any) {
      setError(`Error creating session: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [isFirebaseEnabled, userId, state.startingBalance, sessions]);

  const loadSession = useCallback(async (sessionId: string) => {
    if (!isFirebaseEnabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const [transactionsResult, estimatesResult] = await Promise.all([
        getTransactions(sessionId),
        getEstimates(sessionId)
      ]);

      if (transactionsResult.success && estimatesResult.success) {
        const session = sessions.find(s => s.id === sessionId);
        setCurrentSession(session || null);
        
        setState(prev => ({
          ...prev,
          transactions: transactionsResult.data,
          estimates: estimatesResult.data,
          startingBalance: session?.startingBalance || 0
        }));
      } else {
        const errorMessage = !transactionsResult.success 
          ? transactionsResult.error.message 
          : !estimatesResult.success 
          ? estimatesResult.error.message
          : 'Unknown error';
        setError(`Failed to load session data: ${errorMessage}`);
      }
    } catch (error: any) {
      setError(`Error loading session: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [isFirebaseEnabled, sessions]);

  const loadTransactions = useCallback(async (rawTransactions: RawTransaction[]) => {
    setIsLoading(true);
    setError(null);

    try {
      // Convert and categorize transactions (same as before)
      const processedTransactions = rawTransactions.map(convertToTransaction);
      const categorizedTransactions = categorizeTransactions(processedTransactions);
      const sortedTransactions = [...categorizedTransactions].sort(
        (a, b) => b.date.getTime() - a.date.getTime()
      );

      const startingBalance = rawTransactions.length > 0
        ? Math.max(...rawTransactions.map(t => t.Balance))
        : 0;

      // Extract categories
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

      // Update local state
      setState(prev => ({
        ...prev,
        transactions: sortedTransactions,
        startingBalance,
        categories: {
          inflow: inflowCategories,
          outflow: outflowCategories
        }
      }));

      // Handle Firebase saving
      if (isFirebaseEnabled) {
        setIsSaving(true);
        
        let sessionToUse = currentSession;
        
        // Create a new session if we don't have one
        if (!sessionToUse) {
          console.log('🆕 Creating new session for imported transactions');
          const sessionName = `Import ${new Date().toLocaleDateString()}`;
          const result = await createCashflowSession(
            userId, 
            sessionName, 
            `Imported ${rawTransactions.length} transactions`,
            startingBalance
          );
          
          if (result.success) {
            const newSessionId = result.data;
            console.log('✅ New session created:', newSessionId);
            
            // Find the new session in our sessions list (reload sessions to get the new one)
            const sessionsResult = await getCashflowSessions(userId);
            if (sessionsResult.success) {
              setSessions(sessionsResult.data);
              sessionToUse = sessionsResult.data.find(s => s.id === newSessionId) || null;
              
              if (sessionToUse) {
                setCurrentSession(sessionToUse);
              }
            }
          } else {
            console.error('❌ Failed to create session:', result.error);
            setError(`Failed to create session: ${result.error.message}`);
            setIsSaving(false);
            return;
          }
        }
        
        // Now save transactions to the session
        if (sessionToUse) {
          console.log('💾 Saving transactions to session:', sessionToUse.id);
          const saveResult = await saveTransactions(sortedTransactions, userId, sessionToUse.id);
          if (!saveResult.success) {
            console.error('❌ Failed to save transactions to Firebase:', saveResult.error);
            setError(`Warning: Failed to save to cloud: ${saveResult.error.message}`);
          } else {
            console.log('✅ Transactions saved successfully');
          }
        }
        
        setIsSaving(false);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process transactions';
      setError(errorMessage);
      console.error('Error processing transactions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isFirebaseEnabled, userId, currentSession, sessions]);

  const addEstimate = useCallback(async (estimateData: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newEstimate: Estimate = {
      ...estimateData,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Update local state immediately for optimistic updates
    setState(prev => ({
      ...prev,
      estimates: [...prev.estimates, newEstimate]
    }));

    // Save to Firebase if available
    if (isFirebaseEnabled && currentSession) {
      setIsSaving(true);
      const result = await saveEstimate(newEstimate, userId, currentSession.id);
      if (!result.success) {
        // Rollback optimistic update
        setState(prev => ({
          ...prev,
          estimates: prev.estimates.filter(e => e.id !== newEstimate.id)
        }));
        setError(`Failed to save estimate: ${result.error.message}`);
      }
      setIsSaving(false);
    }
  }, [isFirebaseEnabled, userId, currentSession]);

  const updateEstimateById = useCallback(async (id: string, updates: Partial<Estimate>) => {
    // Update local state immediately
    setState(prev => ({
      ...prev,
      estimates: prev.estimates.map(estimate =>
        estimate.id === id
          ? { ...estimate, ...updates, updatedAt: new Date() }
          : estimate
      )
    }));

    // Save to Firebase if available
    if (isFirebaseEnabled) {
      setIsSaving(true);
      const result = await updateEstimate(id, updates);
      if (!result.success) {
        setError(`Failed to update estimate: ${result.error.message}`);
        // In a real app, you might want to rollback the optimistic update
      }
      setIsSaving(false);
    }
  }, [isFirebaseEnabled]);

  const deleteEstimateById = useCallback(async (id: string) => {
    // Store the estimate for potential rollback
    const estimateToDelete = state.estimates.find(e => e.id === id);
    
    // Update local state immediately
    setState(prev => ({
      ...prev,
      estimates: prev.estimates.filter(estimate => estimate.id !== id)
    }));

    // Delete from Firebase if available
    if (isFirebaseEnabled) {
      setIsSaving(true);
      const result = await deleteEstimate(id);
      if (!result.success) {
        // Rollback optimistic update
        if (estimateToDelete) {
          setState(prev => ({
            ...prev,
            estimates: [...prev.estimates, estimateToDelete]
          }));
        }
        setError(`Failed to delete estimate: ${result.error.message}`);
      }
      setIsSaving(false);
    }
  }, [isFirebaseEnabled, state.estimates]);

  const clearCurrentSession = useCallback(async () => {
    if (!isFirebaseEnabled || !currentSession) return;

    setIsSaving(true);
    try {
      const result = await clearSessionData(currentSession.id);
      if (result.success) {
        setState(INITIAL_STATE);
      } else {
        setError(`Failed to clear session: ${result.error.message}`);
      }
    } catch (error: any) {
      setError(`Error clearing session: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [isFirebaseEnabled, currentSession]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
    setCurrentSession(null);
    setError(null);
    setIsLoading(false);
    setIsSaving(false);
  }, []);

  // Calculate weekly cashflows (same as before)
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

  // Computed values (same as before)
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
    sessions,
    currentSession,
    isLoading,
    isSaving,
    error,
    isFirebaseEnabled,

    // Actions
    loadTransactions,
    addEstimate,
    updateEstimateById,
    deleteEstimateById,
    createNewSession,
    loadSession,
    clearCurrentSession,
    clearError,
    reset,

    // Computed values
    startingBalance: state.startingBalance,
    ...computedValues
  };
};