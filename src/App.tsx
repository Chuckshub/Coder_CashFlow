import React, { useState, useCallback, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import UserHeader from './components/common/UserHeader';
import CSVUpload from './components/DataImport/CSVUpload';
import FirebaseStatus from './components/common/FirebaseStatus';
import CashflowTable from './components/CashflowTable/CashflowTable';
import { Transaction, Estimate, WeeklyCashflow, RawTransaction } from './types';
import { formatCurrency, generate13Weeks } from './utils/dateUtils';
import { v4 as uuidv4 } from 'uuid';
import { 
  processRawTransactionsSimple, 
  PipelineProgress, 
  PipelineResult 
} from './services/csvToFirebasePipelineSimple';
import { getSimpleDataLoader, DataLoadingState } from './services/dataLoaderSimple';
import { testFirebaseConnection } from './utils/firebaseTest';

type ActiveView = 'upload' | 'cashflow';

// Calculate weekly cashflows from transactions and estimates
function calculateWeeklyCashflows(
  transactions: Transaction[],
  estimates: Estimate[],
  startingBalance: number
): WeeklyCashflow[] {
  try {
    if (transactions.length === 0 && estimates.length === 0) {
      return [];
    }

    const weekDates = generate13Weeks();
    let runningBalance = startingBalance;

    return weekDates.map((weekStartDate, index) => {
      const weekNumber = index + 1;
      
      // Calculate week end date (6 days after start)
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekEndDate.getDate() + 6);
      weekEndDate.setHours(23, 59, 59, 999);

      // Get transactions for this week
      const weekTransactions = transactions.filter(
        (t) => t.date >= weekStartDate && t.date <= weekEndDate
      );

      // Get estimates for this week
      const weekEstimates = estimates.filter(
        (e) => e.weekNumber === weekNumber
      );

      // Calculate actual amounts
      const actualInflow = weekTransactions
        .filter((t) => t.type === 'inflow')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const actualOutflow = weekTransactions
        .filter((t) => t.type === 'outflow')
        .reduce((sum, t) => sum + t.amount, 0);

      // Calculate estimated amounts
      const estimatedInflow = weekEstimates
        .filter((e) => e.type === 'inflow')
        .reduce((sum, e) => sum + e.amount, 0);
      
      const estimatedOutflow = weekEstimates
        .filter((e) => e.type === 'outflow')
        .reduce((sum, e) => sum + e.amount, 0);

      const totalInflow = actualInflow + estimatedInflow;
      const totalOutflow = actualOutflow + estimatedOutflow;
      const netCashflow = totalInflow - totalOutflow;
      
      runningBalance += netCashflow;
      
      // Determine week status
      const now = new Date();
      let weekStatus: 'past' | 'current' | 'future';
      if (weekEndDate < now) {
        weekStatus = 'past';
      } else if (weekStartDate <= now && now <= weekEndDate) {
        weekStatus = 'current';
      } else {
        weekStatus = 'future';
      }

      const weeklyCashflow: WeeklyCashflow = {
        weekNumber,
        weekStart: weekStartDate,
        weekEnd: weekEndDate,
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
        transactions: weekTransactions,
      };

      return weeklyCashflow;
    });
  } catch (error) {
    console.error('💥 Error calculating weekly cashflows:', error);
    return [];
  }
}

function DatabaseApp() {
  const { currentUser } = useAuth();
  const [activeView, setActiveView] = useState<ActiveView>('upload');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<PipelineProgress | null>(null);
  const [uploadResult, setUploadResult] = useState<PipelineResult | null>(null);

  // New state for real-time data loading
  const [dataLoadingState, setDataLoadingState] = useState<DataLoadingState>({
    isLoading: false,
    isError: false,
    hasData: false
  });

  // Load transactions using the new data loader
  const loadTransactionsFromDatabase = useCallback(async () => {
    if (!currentUser?.uid) return;
    
    console.log('📥 Loading transactions using new DataLoader...');
    setIsLoadingTransactions(true);
    
    try {
      const dataLoader = getSimpleDataLoader(currentUser.uid);
      
      const { data, state } = await dataLoader.loadTransactions(false, true);
      
      setTransactions(data);
      setDataLoadingState(state);
      
      if (state.isError) {
        setError(state.errorMessage || 'Failed to load transactions');
      } else {
        setError(null);
      }
      
    } catch (error: any) {
      console.error('💥 Error loading transactions:', error);
      setError(`Failed to load transactions: ${error.message}`);
    } finally {
      setIsLoadingTransactions(false);
    }
  }, [currentUser?.uid]);

  // Set up real-time transaction subscription
  useEffect(() => {
    if (!currentUser?.uid) return;
    
    console.log('👂 Setting up real-time transaction subscription...');
    
    const dataLoader = getSimpleDataLoader(currentUser.uid);
    
    const unsubscribe = dataLoader.subscribeToTransactions((data, state) => {
      console.log('🔄 Real-time transaction update in App:', data.length, 'transactions');
      setTransactions(data);
      setDataLoadingState(state);
      
      if (state.isError) {
        setError(state.errorMessage || 'Transaction sync error');
      } else if (!state.isLoading) {
        setError(null);
      }
    });
    
    // Initial load
    loadTransactionsFromDatabase();
    
    return () => {
      console.log('🗏 Cleaning up transaction subscription');
      unsubscribe();
    };
  }, [currentUser?.uid, loadTransactionsFromDatabase]);

  // Calculate weekly cashflows when data changes
  const weeklyCashflows = React.useMemo(() => {
    if (transactions.length === 0 && estimates.length === 0) {
      return [];
    }
    
    console.log('📊 Recalculating weekly cashflows with', transactions.length, 'transactions and', estimates.length, 'estimates');
    return calculateWeeklyCashflows(transactions, estimates, 0);
  }, [transactions, estimates]);

  // Handle CSV data parsing using simplified pipeline
  const handleCSVDataParsed = useCallback(async (rawTransactions: RawTransaction[]) => {
    console.log('🚀 Processing CSV data with SIMPLIFIED pipeline...', rawTransactions.length, 'transactions');
    
    if (!currentUser?.uid) {
      setError('User not authenticated');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setUploadProgress(null);
    setUploadResult(null);
    
    try {
      const result = await processRawTransactionsSimple(
        rawTransactions,
        currentUser.uid
      );
      
      setUploadResult(result);
      
      if (result.errors.length > 0) {
        console.warn('⚠️ Upload completed with errors:', result.errors);
        setError(`Upload completed with ${result.errors.length} errors. Check console for details.`);
      } else {
        console.log('✅ SIMPLIFIED upload completed successfully');
      }
      
      // Data will update automatically via real-time subscription
      console.log('🔄 Waiting for real-time updates...');
      
    } catch (error: any) {
      const errorMsg = `SIMPLIFIED upload failed: ${error.message}`;
      console.error('💥 SIMPLIFIED CSV processing error:', error);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
      setUploadProgress(null);
    }
  }, [currentUser?.uid]);

  // Handle CSV upload errors
  const handleCSVError = useCallback((errorMessage: string) => {
    console.error('💥 CSV error:', errorMessage);
    setError(errorMessage);
    setIsLoading(false);
    setUploadProgress(null);
  }, []);

  // Add estimate
  const addEstimate = useCallback(async (estimate: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newEstimate: Estimate = {
      ...estimate,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setEstimates(prev => [...prev, newEstimate]);
  }, []);

  // Update estimate
  const updateEstimate = useCallback(async (id: string, updates: Partial<Estimate>) => {
    setEstimates(prev => prev.map(estimate => 
      estimate.id === id 
        ? { ...estimate, ...updates, updatedAt: new Date() }
        : estimate
    ));
  }, []);

  // Delete estimate
  const deleteEstimate = useCallback(async (id: string) => {
    setEstimates(prev => prev.filter(estimate => estimate.id !== id));
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Refresh all data
  const refreshData = useCallback(async () => {
    if (!currentUser?.uid) return;
    
    console.log('🔄 Refreshing all data...');
    const dataLoader = getSimpleDataLoader(currentUser.uid);
    await dataLoader.refreshAll();
  }, [currentUser?.uid]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">Coder Cashflow</h1>
              <span className="text-sm text-gray-500">
                v3.0 - Simplified Firebase (No Sessions!)
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={refreshData}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              >
                🔄 Refresh
              </button>
              <UserHeader />
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeView === 'cashflow'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Cashflow Table
              </button>
            </nav>
            
            {/* Real-time Status */}
            <div className="flex items-center space-x-2 text-xs">
              <div className={`w-2 h-2 rounded-full ${
                dataLoadingState.isLoading ? 'bg-yellow-400 animate-pulse' :
                dataLoadingState.isError ? 'bg-red-400' :
                dataLoadingState.hasData ? 'bg-green-400' : 'bg-gray-400'
              }`}></div>
              <span className="text-gray-500">
                {dataLoadingState.isLoading ? 'Syncing...' :
                 dataLoadingState.isError ? 'Error' :
                 dataLoadingState.hasData ? `${transactions.length} transactions` : 'No data'}
              </span>
              {dataLoadingState.lastUpdated && (
                <span className="text-gray-400">
                  Updated {dataLoadingState.lastUpdated.toLocaleTimeString()}
                </span>
              )}
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
                  <div className="mt-2 text-sm text-red-700">
                    <div className="font-medium mb-1">Error Details:</div>
                    <div className="bg-red-100 p-2 rounded text-xs font-mono whitespace-pre-wrap">
                      {error}
                    </div>
                    
                    <button
                      onClick={clearError}
                      className="text-sm text-red-600 hover:text-red-500 mt-3 underline"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Progress Display */}
        {uploadProgress && (
          <div className="mb-6 mx-4 sm:mx-0">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-blue-800 mb-2">Processing CSV...</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-700">{uploadProgress.message}</span>
                  <span className="text-blue-600">{Math.round(uploadProgress.progress)}%</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress.progress}%` }}
                  ></div>
                </div>
                {uploadProgress.total > 0 && (
                  <div className="text-xs text-blue-600">
                    {uploadProgress.completed} / {uploadProgress.total} items processed
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Upload Results Display */}
        {uploadResult && (
          <div className="mb-6 mx-4 sm:mx-0">
            <div className={`border rounded-md p-4 ${
              uploadResult.success 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <h3 className={`text-sm font-medium mb-2 ${
                uploadResult.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {uploadResult.success ? '✅ Upload Completed' : '❌ Upload Failed'}
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-2">
                <div className="text-green-700">
                  <span className="font-medium">✅ Uploaded:</span> {uploadResult.uploaded}
                </div>
                <div className="text-yellow-700">
                  <span className="font-medium">🔄 Duplicates:</span> {uploadResult.duplicates}
                </div>
                <div className="text-blue-700">
                  <span className="font-medium">📁 Total:</span> {uploadResult.totalProcessed}
                </div>
                <div className="text-gray-700">
                  <span className="font-medium">⏱️ Time:</span> {uploadResult.processingTimeMs}ms
                </div>
              </div>
              
              {uploadResult.errors.length > 0 && (
                <div className="mt-3 p-3 bg-red-100 border border-red-200 rounded">
                  <div className="font-medium text-red-800 mb-2">❌ Errors ({uploadResult.errors.length}):</div>
                  <div className="space-y-1">
                    {uploadResult.errors.slice(0, 5).map((error, index) => (
                      <div key={index} className="text-xs text-red-700 bg-red-50 p-2 rounded font-mono">
                        {error}
                      </div>
                    ))}
                    {uploadResult.errors.length > 5 && (
                      <div className="text-xs text-red-600">...and {uploadResult.errors.length - 5} more errors</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Upload View */}
        {activeView === 'upload' && (
          <div className="px-4 sm:px-0">
            <FirebaseStatus showDetails={true} />
            
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="text-sm font-medium text-green-800 mb-1">🆕 Simplified Architecture</h3>
              <p className="text-sm text-green-700">
                Much cleaner Firebase structure: users/&#123;userId&#125;/transactions/&#123;hash&#125;<br/>
                No sessions, no complexity - just user isolation + hash-based deduplication!
              </p>
            </div>
            
            <CSVUpload
              onDataParsed={handleCSVDataParsed}
              onError={handleCSVError}
            />
          </div>
        )}

        {/* Cashflow Table View */}
        {activeView === 'cashflow' && (
          <div className="px-4 sm:px-0">
            {weeklyCashflows.length > 0 ? (
              <CashflowTable
                weeklyCashflows={weeklyCashflows}
                transactions={transactions}
                onAddEstimate={addEstimate}
                onUpdateEstimate={updateEstimate}
                onDeleteEstimate={deleteEstimate}
              />
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                <div className="text-gray-400 text-4xl mb-4">📊</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Cashflow Data</h3>
                <p className="text-gray-600 mb-4">
                  {dataLoadingState.isLoading 
                    ? 'Loading your transaction data...'
                    : 'Upload some transaction data to see your cashflow projections.'}
                </p>
                {!dataLoadingState.isLoading && (
                  <button
                    onClick={() => setActiveView('upload')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Upload Data
                  </button>
                )}
              </div>
            )}
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