import React, { useState, useCallback, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import UserHeader from './components/common/UserHeader';
import CSVUpload from './components/DataImport/CSVUpload';
import CashflowTable from './components/CashflowTable/CashflowTable';
import { RawTransaction, Transaction, Estimate, WeeklyCashflow } from './types';
import { formatCurrency, generate13Weeks } from './utils/dateUtils';
import { v4 as uuidv4 } from 'uuid';
import {
  saveTransactions,
  getUserTransactions,
  getTransactionSummary
} from './services/transactionDatabase';

type ActiveView = 'upload' | 'cashflow';

// Simple weekly cashflow calculation for database approach
function calculateSimpleWeeklyCashflows(
  transactions: Transaction[],
  estimates: Estimate[],
  startingBalance: number
): WeeklyCashflow[] {
  const weeks = generate13Weeks();
  const weeklyCashflows: WeeklyCashflow[] = [];
  let runningBalance = startingBalance;
  
  weeks.forEach((weekStart, index) => {
    const weekNumber = index + 1;
    
    // For simplicity, just distribute transactions evenly across weeks
    // In a full implementation, you'd filter by actual week dates
    const weeklyTransactions = transactions.slice(
      index * Math.floor(transactions.length / 13), 
      (index + 1) * Math.floor(transactions.length / 13)
    );
    
    const actualInflow = weeklyTransactions
      .filter(t => t.type === 'inflow')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const actualOutflow = weeklyTransactions
      .filter(t => t.type === 'outflow')
      .reduce((sum, t) => sum + t.amount, 0);
    
    // Get estimates for this week
    const weekEstimates = estimates.filter(e => e.weekNumber === weekNumber);
    
    const estimatedInflow = weekEstimates
      .filter(e => e.type === 'inflow')
      .reduce((sum, e) => sum + e.amount, 0);
    
    const estimatedOutflow = weekEstimates
      .filter(e => e.type === 'outflow')
      .reduce((sum, e) => sum + e.amount, 0);
    
    const netCashflow = (actualInflow + estimatedInflow) - (actualOutflow + estimatedOutflow);
    runningBalance += netCashflow;
    
    const totalInflow = actualInflow + estimatedInflow;
    const totalOutflow = actualOutflow + estimatedOutflow;
    
    // Determine week status (simplified)
    const now = new Date();
    let weekStatus: 'past' | 'current' | 'future' = 'future';
    if (weekStart <= now && now <= new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000)) {
      weekStatus = 'current';
    } else if (weekStart < now) {
      weekStatus = 'past';
    }
    
    weeklyCashflows.push({
      weekNumber,
      weekStart,
      weekEnd: new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000),
      weekStatus,
      actualInflow,
      actualOutflow,
      estimatedInflow,
      estimatedOutflow,
      totalInflow,
      totalOutflow,
      netCashflow,
      runningBalance,
      estimates: weekEstimates,
      transactions: weeklyTransactions
    });
  });
  
  return weeklyCashflows;
}

function DatabaseApp() {
  const { currentUser } = useAuth();
  const [activeView, setActiveView] = useState<ActiveView>('upload');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadStats, setUploadStats] = useState<{
    saved: number;
    duplicates: number;
    errors: string[];
  } | null>(null);

  // Load transactions on mount and when user changes
  useEffect(() => {
    if (currentUser?.uid) {
      loadTransactionsFromDatabase();
    }
  }, [currentUser?.uid]);

  const loadTransactionsFromDatabase = useCallback(async () => {
    if (!currentUser?.uid) return;
    
    setIsLoadingTransactions(true);
    setError(null);
    
    try {
      console.log('📋 Loading transactions from database...');
      const dbTransactions = await getUserTransactions(currentUser.uid);
      setTransactions(dbTransactions);
      console.log(`✅ Loaded ${dbTransactions.length} transactions from database`);
      
      if (dbTransactions.length > 0) {
        setActiveView('cashflow');
      }
    } catch (error: any) {
      const errorMsg = `Failed to load transactions: ${error.message}`;
      console.error('💥', errorMsg);
      setError(errorMsg);
    } finally {
      setIsLoadingTransactions(false);
    }
  }, [currentUser?.uid]);

  // Calculate weekly cashflows
  const weeklyCashflows: WeeklyCashflow[] = React.useMemo(() => {
    if (transactions.length === 0) return [];
    
    try {
      const startingBalance = transactions.length > 0 
        ? Math.max(...transactions.map(t => t.balance))
        : 0;
      
      return calculateSimpleWeeklyCashflows(transactions, estimates, startingBalance);
    } catch (error) {
      console.error('Error calculating weekly cashflows:', error);
      return [];
    }
  }, [transactions, estimates]);

  const handleCSVUpload = useCallback(async (rawTransactions: RawTransaction[]) => {
    if (!currentUser?.uid) {
      setError('User not authenticated');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setUploadStats(null);
    
    try {
      console.log('📊 Processing and saving', rawTransactions.length, 'transactions to database...');
      
      // Save to database with duplicate checking
      const results = await saveTransactions(rawTransactions, currentUser.uid);
      setUploadStats(results);
      
      if (results.errors.length > 0) {
        setError(`Upload completed with errors: ${results.errors.join(', ')}`);
      }
      
      // Reload transactions from database to get the updated data
      await loadTransactionsFromDatabase();
      
    } catch (error: any) {
      const errorMsg = `Upload failed: ${error.message}`;
      console.error('💥', errorMsg);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.uid, loadTransactionsFromDatabase]);

  const handleCSVError = useCallback((error: string) => {
    setError(`CSV Error: ${error}`);
  }, []);

  const addEstimate = useCallback(async (estimateData: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'>) => {
    // For now, store estimates in memory (could be extended to database later)
    const newEstimate: Estimate = {
      ...estimateData,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    setEstimates(prev => [...prev, newEstimate]);
  }, []);

  const updateEstimate = useCallback(async (id: string, updates: Partial<Estimate>) => {
    setEstimates(prev => 
      prev.map(estimate => 
        estimate.id === id 
          ? { ...estimate, ...updates, updatedAt: new Date() }
          : estimate
      )
    );
  }, []);

  const deleteEstimate = useCallback(async (id: string) => {
    setEstimates(prev => prev.filter(estimate => estimate.id !== id));
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                <span className="text-white font-bold text-lg">$</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Coder CashFlow</h1>
              <div className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded">
                Database Mode (Hash-Protected)
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <nav className="flex space-x-1">
                <button
                  onClick={() => setActiveView('upload')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeView === 'upload'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Upload Data
                </button>
                <button
                  onClick={() => setActiveView('cashflow')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeView === 'cashflow'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  disabled={transactions.length === 0}
                >
                  Cashflow Table
                </button>
              </nav>
              
              <UserHeader />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-8">
        {/* Error Display */}
        {error && (
          <div className="mb-6 mx-4 sm:mx-0">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                  <button
                    onClick={clearError}
                    className="text-sm text-red-600 hover:text-red-500 mt-2 underline"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Stats Display */}
        {uploadStats && (
          <div className="mb-6 mx-4 sm:mx-0">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-blue-800 mb-2">Upload Results</h3>
              <div className="grid grid-cols-2 gap-4 text-sm text-blue-700">
                <div>
                  <span className="font-medium text-green-700">✅ Saved:</span> {uploadStats.saved} new transactions
                </div>
                <div>
                  <span className="font-medium text-yellow-700">🔄 Duplicates:</span> {uploadStats.duplicates} skipped
                </div>
              </div>
              {uploadStats.errors.length > 0 && (
                <div className="mt-2 text-sm text-red-700">
                  <span className="font-medium">❌ Errors:</span> {uploadStats.errors.join(', ')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Data Summary */}
        {(transactions.length > 0 || isLoadingTransactions) && (
          <div className="mb-6 mx-4 sm:mx-0">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Your Data (Database)</h3>
                  {isLoadingTransactions ? (
                    <div className="flex items-center text-blue-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      <span className="text-sm">Loading from database...</span>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">
                      Transactions: {transactions.length} • 
                      Estimates: {estimates.length} • 
                      Balance: {formatCurrency(
                        transactions.length > 0 ? Math.max(...transactions.map(t => t.balance)) : 0
                      )}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {(isLoading || isLoadingTransactions) && (
                    <div className="flex items-center text-blue-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      <span className="text-sm">
                        {isLoading ? 'Processing...' : 'Loading...'}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={loadTransactionsFromDatabase}
                    disabled={isLoadingTransactions}
                    className="text-sm text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
                  >
                    🔄 Refresh
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload View */}
        {activeView === 'upload' && (
          <div className="px-4 sm:px-0">
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="text-sm font-medium text-green-800 mb-1">🔒 Hash-Protected Uploads</h3>
              <p className="text-sm text-green-700">
                Each transaction is hashed using date + amount + description to prevent duplicates.
                You can safely upload the same file multiple times.
              </p>
            </div>
            <CSVUpload
              onDataParsed={handleCSVUpload}
              onError={handleCSVError}
            />
          </div>
        )}

        {/* Cashflow Table View */}
        {activeView === 'cashflow' && weeklyCashflows.length > 0 && (
          <div className="px-4 sm:px-0">
            <CashflowTable
              weeklyCashflows={weeklyCashflows}
              transactions={transactions}
              onAddEstimate={addEstimate}
              onUpdateEstimate={updateEstimate}
              onDeleteEstimate={deleteEstimate}
            />
          </div>
        )}

        {/* No Data Message */}
        {activeView === 'cashflow' && transactions.length === 0 && !isLoadingTransactions && (
          <div className="px-4 sm:px-0">
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No transaction data in database</h3>
              <p className="mt-1 text-sm text-gray-500">
                Upload your transaction data to get started with cashflow projections.
              </p>
              <div className="mt-6">
                <button
                  onClick={() => setActiveView('upload')}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Upload Transaction Data
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <DatabaseApp />
      </ProtectedRoute>
    </AuthProvider>
  );
}

export default App;