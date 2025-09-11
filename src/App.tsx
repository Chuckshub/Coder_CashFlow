import React, { useState, useCallback, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import UserHeader from './components/common/UserHeader';
import CSVUpload from './components/DataImport/CSVUpload';
import FirebaseStatus from './components/common/FirebaseStatus';
import EstimateCreatorModal from './components/common/EstimateCreatorModal';
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
import { getSimpleFirebaseService } from './services/firebaseServiceSimple';

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

  // Modal state for estimate creator information
  const [estimateModalState, setEstimateModalState] = useState<{
    isOpen: boolean;
    estimateId: string;
  }>({ isOpen: false, estimateId: '' });

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

  // Load estimates from Firebase
  const loadEstimatesFromDatabase = useCallback(async () => {
    if (!currentUser?.uid) return;
    
    console.log('📥 Loading estimates from Firebase...');
    
    try {
      const firebaseService = getSimpleFirebaseService(currentUser.uid);
      const loadedEstimates = await firebaseService.loadEstimates();
      setEstimates(loadedEstimates);
      console.log('✅ Loaded', loadedEstimates.length, 'estimates from Firebase');
    } catch (error: any) {
      console.error('💥 Error loading estimates:', error);
      setError(`Failed to load estimates: ${error.message}`);
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
    
    // Also load estimates
    loadEstimatesFromDatabase();
    
    return () => {
      console.log('🗏 Cleaning up transaction subscription');
      unsubscribe();
    };
  }, [currentUser?.uid, loadTransactionsFromDatabase, loadEstimatesFromDatabase]);

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
        
        // FORCE CACHE REFRESH after successful upload
        console.log('🔄 FORCING cache refresh and data reload...');
        const dataLoader = getSimpleDataLoader(currentUser.uid);
        
        // Invalidate cache
        dataLoader.invalidateCache('transactions');
        
        // Force reload with real-time enabled
        setTimeout(async () => {
          console.log('🔄 Reloading transactions after successful upload...');
          await dataLoader.loadTransactions(true, true);
        }, 1000); // Small delay to ensure Firebase has processed the writes
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

  // Add estimate with Firebase and user tracking
  const addEstimate = useCallback(async (estimate: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!currentUser?.uid) {
      setError('User not authenticated');
      return;
    }

    const newEstimate: Estimate = {
      ...estimate,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      const firebaseService = getSimpleFirebaseService(currentUser.uid);
      const result = await firebaseService.saveEstimate(
        newEstimate, 
        currentUser.displayName || '', 
        currentUser.email || ''
      );
      
      if (result.success) {
        console.log('✅ Estimate saved to Firebase:', newEstimate.id);
        // Reload estimates to get updated list
        await loadEstimatesFromDatabase();
      } else {
        setError(result.error || 'Failed to save estimate');
      }
    } catch (error: any) {
      console.error('💥 Error adding estimate:', error);
      setError(`Failed to add estimate: ${error.message}`);
    }
  }, [currentUser?.uid, currentUser?.displayName, currentUser?.email, loadEstimatesFromDatabase]);

  // Update estimate with Firebase
  const updateEstimate = useCallback(async (id: string, updates: Partial<Estimate>) => {
    if (!currentUser?.uid) {
      setError('User not authenticated');
      return;
    }

    try {
      // Find the existing estimate
      const existingEstimate = estimates.find(e => e.id === id);
      if (!existingEstimate) {
        setError('Estimate not found');
        return;
      }

      const updatedEstimate: Estimate = {
        ...existingEstimate,
        ...updates,
        updatedAt: new Date()
      };

      const firebaseService = getSimpleFirebaseService(currentUser.uid);
      const result = await firebaseService.saveEstimate(
        updatedEstimate,
        currentUser.displayName || '',
        currentUser.email || ''
      );
      
      if (result.success) {
        console.log('✅ Estimate updated in Firebase:', id);
        // Reload estimates to get updated list
        await loadEstimatesFromDatabase();
      } else {
        setError(result.error || 'Failed to update estimate');
      }
    } catch (error: any) {
      console.error('💥 Error updating estimate:', error);
      setError(`Failed to update estimate: ${error.message}`);
    }
  }, [currentUser?.uid, currentUser?.displayName, currentUser?.email, estimates, loadEstimatesFromDatabase]);

  // Delete estimate from Firebase
  const deleteEstimate = useCallback(async (id: string) => {
    if (!currentUser?.uid) {
      setError('User not authenticated');
      return;
    }

    try {
      const firebaseService = getSimpleFirebaseService(currentUser.uid);
      const result = await firebaseService.deleteEstimate(id);
      
      if (result.success) {
        console.log('✅ Estimate deleted from Firebase:', id);
        // Reload estimates to get updated list
        await loadEstimatesFromDatabase();
      } else {
        setError(result.error || 'Failed to delete estimate');
      }
    } catch (error: any) {
      console.error('💥 Error deleting estimate:', error);
      setError(`Failed to delete estimate: ${error.message}`);
    }
  }, [currentUser?.uid, loadEstimatesFromDatabase]);

  // Refresh all data (for debugging/manual reload)
  const refreshAllData = useCallback(async () => {
    console.log('🔄 Manual refresh all data triggered');
    if (!currentUser?.uid) {
      console.warn('No user authenticated for refresh');
      return;
    }

    try {
      // Reload transactions
      console.log('🔄 Refreshing transactions...');
      await loadTransactionsFromDatabase();
      
      // Reload estimates  
      console.log('🔄 Refreshing estimates...');
      await loadEstimatesFromDatabase();
      
      console.log('✅ All data refreshed successfully');
    } catch (error: any) {
      console.error('💥 Error refreshing data:', error);
      setError(`Failed to refresh data: ${error.message}`);
    }
  }, [currentUser?.uid, loadTransactionsFromDatabase, loadEstimatesFromDatabase]);

  // Handle estimate click to show creator info
  const handleEstimateClick = useCallback((estimateId: string) => {
    console.log('🔍 Opening estimate creator modal for:', estimateId);
    setEstimateModalState({ isOpen: true, estimateId });
  }, []);

  // Close estimate modal
  const closeEstimateModal = useCallback(() => {
    setEstimateModalState({ isOpen: false, estimateId: '' });
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

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
                onClick={refreshAllData}
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
                 dataLoadingState.isError ? `Error: ${dataLoadingState.errorMessage}` :
                 dataLoadingState.hasData ? `${transactions.length} transactions` : 'No data loaded'}
              </span>
              {dataLoadingState.lastUpdated && (
                <span className="text-gray-400">
                  Updated {dataLoadingState.lastUpdated.toLocaleTimeString()}
                </span>
              )}
              {/* Debug reload button */}
              <button
                onClick={async () => {
                  console.log('🔄 Manual reload triggered...');
                  const dataLoader = getSimpleDataLoader(currentUser?.uid || '');
                  dataLoader.invalidateCache();
                  await dataLoader.loadTransactions(true, true);
                }}
                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                title="Force reload transactions"
              >
                🔄 Reload
              </button>
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
                onEstimateClick={handleEstimateClick}
                onRefreshData={refreshAllData}
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

      {/* Estimate Creator Modal */}
      <EstimateCreatorModal
        isOpen={estimateModalState.isOpen}
        onClose={closeEstimateModal}
        estimateId={estimateModalState.estimateId}
        userId={currentUser?.uid || ''}
      />
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