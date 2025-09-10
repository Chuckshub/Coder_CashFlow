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
  calculateRollingCashflows,
  DEFAULT_ROLLING_CONFIG
} from '../utils/rollingTimeline';
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
import { getCurrentUserId } from '../contexts/AuthContext';
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

  // Actions
  loadTransactions: (rawTransactions: RawTransaction[]) => Promise<void>;
  addEstimate: (estimate: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateEstimate: (id: string, updates: Partial<Estimate>) => Promise<void>;
  deleteEstimate: (id: string) => Promise<void>;
  createSession: (name: string, startingBalance: number) => Promise<void>;
  renameSession: (sessionId: string, newName: string) => Promise<{ success: boolean; error?: string; data?: string }>;
  loadSessions: () => Promise<void>;
  switchSession: (session: FirebaseCashflowSession) => void;
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
  estimates: [],
  weeklyCashflows: [],
  activeScenario: 'base',
  availableScenarios: ['base'],
  rollingConfig: {
    pastWeeks: 4,
    futureWeeks: 8,
    currentDate: new Date()
  },
  categories: {
    inflow: [],
    outflow: []
  },
  startingBalance: 0
};

export const useCashflowDataWithFirebase = (): UseCashflowDataWithFirebaseReturn => {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [sessions, setSessions] = useState<FirebaseCashflowSession[]>([]);
  const [currentSession, setCurrentSession] = useState<FirebaseCashflowSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = getCurrentUserId();
  const isFirebaseEnabled = isFirebaseAvailable();
  const hasValidAuth = !!(userId && isFirebaseEnabled);

  // Load existing sessions on mount
  useEffect(() => {
    if (!hasValidAuth) {
      console.log('⚠️ No authenticated user or Firebase not available');
      return;
    }
    
    console.log('🚀 App starting up, Firebase enabled:', isFirebaseEnabled);
    
    const initializeSessions = async () => {
      if (!isFirebaseEnabled) {
        console.log('⚠️ Firebase not enabled, sessions will not be loaded');
        return;
      }
      
      console.log('📂 Attempting to load sessions...');
      try {
        const result = await getCashflowSessions(userId);
        console.log('📂 Session load result:', result);
        
        if (result.success) {
          console.log(`✅ Found ${result.data.length} sessions`);
          setSessions(result.data);
          
          // Log each session for debugging
          result.data.forEach((session, index) => {
            console.log(`📋 Session ${index + 1}:`, {
              id: session.id,
              name: session.name,
              isActive: session.isActive,
              transactionCount: session.transactionCount,
              estimateCount: session.estimateCount
            });
          });
          
          // Auto-load the most recent active session
          const activeSession = result.data.find(s => s.isActive) || result.data[0];
          if (activeSession) {
            console.log('🔄 Auto-loading session:', activeSession.name);
            // Load session data inline to avoid dependency issues
            console.log('📋 Loading session data for:', activeSession.id);
            
            setIsLoading(true);
            const [transactionsResult, estimatesResult] = await Promise.all([
              getTransactions(activeSession.id),
              getEstimates(activeSession.id)
            ]);
            
            console.log('📊 Transaction result:', transactionsResult.success ? `${transactionsResult.data.length} transactions` : transactionsResult.error);
            console.log('📊 Estimates result:', estimatesResult.success ? `${estimatesResult.data.length} estimates` : estimatesResult.error);
            
            if (transactionsResult.success && estimatesResult.success) {
              setCurrentSession(activeSession);
              
              setState(prev => ({
                ...prev,
                transactions: transactionsResult.data,
                estimates: estimatesResult.data,
                startingBalance: activeSession.startingBalance
              }));
              
              console.log('✅ Session loaded successfully:', {
                transactions: transactionsResult.data.length,
                estimates: estimatesResult.data.length,
                startingBalance: activeSession.startingBalance
              });
            } else {
              const errorMessage = !transactionsResult.success 
                ? transactionsResult.error.message 
                : !estimatesResult.success 
                ? estimatesResult.error.message
                : 'Unknown error';
              console.error('❌ Failed to load session data:', errorMessage);
              setError(`Failed to load session data: ${errorMessage}`);
            }
            setIsLoading(false);
          } else {
            console.log('ℹ️ No sessions to auto-load');
          }
        } else {
          console.error('❌ Failed to load sessions:', result.error);
          setError(`Failed to load sessions: ${result.error.message}`);
        }
      } catch (error: any) {
        console.error('💥 Error loading sessions:', error);
        setError(`Error loading sessions: ${error.message}`);
      }
    };
    
    initializeSessions();
  }, [isFirebaseEnabled, hasValidAuth]);

  // Subscribe to real-time estimate updates
  useEffect(() => {
    if (isFirebaseEnabled && currentSession) {
      console.log('🔄 Setting up real-time estimates subscription for session:', currentSession.id);
      const unsubscribe = subscribeToEstimates(currentSession.id, (estimates) => {
        console.log('🔄 Received real-time estimate update:', estimates.length, 'estimates');
        setState(prev => ({ ...prev, estimates }));
      });
      
      return unsubscribe || undefined;
    }
  }, [isFirebaseEnabled, currentSession]);

  const switchSession = useCallback((session: FirebaseCashflowSession) => {
    setCurrentSession(session);
    console.log('🔄 Switched to session:', session.name);
  }, []);

  const createNewSession = useCallback(async (name: string, startingBalance: number) => {
    if (!hasValidAuth) {
      console.log('⚠️ Cannot create session: No authenticated user');
      return;
    }
    
    setIsSaving(true);
    try {
      console.log('🔥 Calling createCashflowSession...');
      const result = await createCashflowSession(
        userId!, 
        name.trim(),
        '', // description is optional, empty string
        startingBalance
      );
      if (result.success) {
        console.log('✅ Session created successfully, ID:', result.data);
        await loadSessions();
        // Find and switch to the new session
        const newSession = sessions.find(s => s.id === result.data);
        if (newSession) {
          setCurrentSession(newSession);
        }
      } else {
        console.error('❌ Failed to create session:', result.error);
        setError(`Failed to create session: ${result.error.message}`);
      }
    } catch (error: any) {
      console.error('💥 Error creating session:', error);
      const errorMessage = error.message || 'Unknown error occurred';
      setError(`Error creating session: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  }, [hasValidAuth, userId, state.startingBalance, sessions]);

  const renameSession = useCallback(async (sessionId: string, newName: string) => {
    if (!hasValidAuth || !sessionId.trim() || !newName.trim()) {
      console.log('⚠️ Cannot rename session: Invalid parameters');
      return { success: false, error: 'Invalid session ID or name' };
    }
    
    setIsSaving(true);
    try {
      // Find the session to rename
      const sessionToRename = sessions.find(s => s.id === sessionId);
      if (!sessionToRename) {
        throw new Error('Session not found');
      }
      
      // Update the session name
      const updatedSession = {
        ...sessionToRename,
        name: newName.trim(),
        updatedAt: new Date().toISOString()
      };
      
      const result = await createCashflowSession(
        userId!,
        newName.trim(),
        sessionToRename.description || '',
        sessionToRename.startingBalance
      );
      if (result.success) {
        console.log('✅ Session renamed successfully:', newName);
        // Reload sessions to get updated list
        const sessionsResult = await getCashflowSessions(userId!);
        if (sessionsResult.success) {
          setSessions(sessionsResult.data);
        }
        
        // Update current session if it was the one being renamed
        if (currentSession?.id === sessionId) {
          setCurrentSession(updatedSession);
        }
        
        return { success: true, data: result.data };
      } else {
        console.error('❌ Failed to rename session:', result.error);
        setError(`Failed to rename session: ${result.error.message}`);
        return { success: false, error: result.error.message };
      }
    } catch (error: any) {
      console.error('💥 Error renaming session:', error);
      const errorMessage = error.message || 'Unknown error occurred';
      setError(`Error renaming session: ${errorMessage}`);
      return { success: false, error: errorMessage };
    } finally {
      setIsSaving(false);
    }
  }, [hasValidAuth, userId, sessions, currentSession]);

  const loadSessions = useCallback(async () => {
    if (!hasValidAuth) {
      console.log('⚠️ Cannot load sessions: No authenticated user');
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await getCashflowSessions(userId!);
      if (result.success) {
        console.log(`✅ Found ${result.data.length} sessions`);
        setSessions(result.data);
      } else {
        console.error('❌ Failed to load sessions:', result.error);
        setError(`Failed to load sessions: ${result.error.message}`);
      }
    } catch (err) {
      console.error('❌ Error loading sessions:', err);
      setError('Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  }, [hasValidAuth, userId]);

  const loadTransaction = useCallback(async (sessionId: string) => {
    console.log('📋 Loading session data for:', sessionId);
    
    if (!isFirebaseEnabled) {
      console.log('⚠️ Firebase not enabled, cannot load session');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('💾 Fetching transactions and estimates...');
      const [transactionsResult, estimatesResult] = await Promise.all([
        getTransactions(sessionId),
        getEstimates(sessionId)
      ]);
      
      console.log('📊 Transaction result:', transactionsResult.success ? `${transactionsResult.data.length} transactions` : transactionsResult.error);
      console.log('📊 Estimates result:', estimatesResult.success ? `${estimatesResult.data.length} estimates` : estimatesResult.error);

      if (transactionsResult.success && estimatesResult.success) {
        const session = sessions.find(s => s.id === sessionId);
        console.log('🎯 Found session:', session ? session.name : 'Not found in sessions list');
        
        setCurrentSession(session || null);
        
        setState(prev => ({
          ...prev,
          transactions: transactionsResult.data,
          estimates: estimatesResult.data,
          startingBalance: session?.startingBalance || 0
        }));
        
        console.log('✅ Session loaded successfully:', {
          transactions: transactionsResult.data.length,
          estimates: estimatesResult.data.length,
          startingBalance: session?.startingBalance || 0
        });
      } else {
        const errorMessage = !transactionsResult.success 
          ? transactionsResult.error.message 
          : !estimatesResult.success 
          ? estimatesResult.error.message
          : 'Unknown error';
        console.error('❌ Failed to load session data:', errorMessage);
        setError(`Failed to load session data: ${errorMessage}`);
      }
    } catch (error: any) {
      console.error('💥 Error loading session:', error);
      setError(`Error loading session: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [isFirebaseEnabled, sessions]);

  const loadTransactions = useCallback(async (rawTransactions: RawTransaction[]) => {
    if (!hasValidAuth) {
      console.log('⚠️ Cannot load transactions: No authenticated user');
      return;
    }
    
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
  }, [isFirebaseEnabled, userId, currentSession, sessions, hasValidAuth]);

  const addEstimate = useCallback(async (estimateData: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!hasValidAuth) {
      console.log('⚠️ Cannot add estimate: No authenticated user');
      return;
    }
    
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
  }, [userId, currentSession, hasValidAuth]);

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
      return calculateRollingCashflows(
        state.transactions,
        state.estimates,
        state.startingBalance,
        state.activeScenario,
        state.rollingConfig
      );
    } catch (err) {
      console.error('Error calculating rolling cashflows:', err);
      return [];
    }
  }, [state.transactions, state.estimates, state.startingBalance, state.activeScenario, state.rollingConfig]);

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

  // Fallback return for unauthenticated users
  if (!hasValidAuth) {
    return {
      transactions: [],
      estimates: [],
      weeklyCashflows: [],
      sessions: [],
      currentSession: null,
      isLoading: false,
      isSaving: false,
      error: userId ? 'Firebase not available' : 'No authenticated user',
      loadTransactions: async () => {},
      addEstimate: async () => {},
      updateEstimate: async () => {},
      deleteEstimate: async () => {},
      createSession: async () => {},
      renameSession: async () => ({ success: false, error: 'Firebase not available' }),
      loadSessions: async () => {},
      switchSession: () => {},
      clearError: () => {},
      reset: () => {},
      startingBalance: 0,
      totalActualInflow: 0,
      totalActualOutflow: 0,
      totalEstimatedInflow: 0,
      totalEstimatedOutflow: 0
    };
  }

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

    // Actions
    loadTransactions,
    addEstimate,
    updateEstimate: updateEstimateById,
    deleteEstimate: deleteEstimateById,
    createSession: createNewSession,
    renameSession,
    loadSessions,
    switchSession,
    clearError,
    reset: () => {
      setState(INITIAL_STATE);
      setSessions([]);
      setCurrentSession(null);
      setError(null);
    },
    
    // Computed values
    startingBalance: state.startingBalance,
    ...computedValues
  };
};