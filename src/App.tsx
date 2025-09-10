import React, { useState } from 'react';
import { RawTransaction } from './types';
import CSVUpload from './components/DataImport/CSVUpload';
import CashflowTable from './components/CashflowTable/CashflowTable';
import SessionManager from './components/SessionManager/SessionManager';
import FirebaseDebug from './components/common/FirebaseDebug';
import { useCashflowDataWithFirebase } from './hooks/useCashflowDataWithFirebase';

function App() {
  const [activeView, setActiveView] = useState<'home' | 'cashflow'>('home');
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  
  const {
    transactions,
    estimates,
    weeklyCashflows,
    sessions,
    currentSession,
    isLoading,
    isSaving,
    error,
    isFirebaseEnabled,
    loadTransactions,
    addEstimate,
    updateEstimateById,
    deleteEstimateById,
    createNewSession,
    loadSession,
    clearCurrentSession,
    clearError,
    startingBalance,
    totalActualInflow,
    totalActualOutflow,
    totalEstimatedInflow,
    totalEstimatedOutflow
  } = useCashflowDataWithFirebase();

  const handleDataParsed = (rawTransactions: RawTransaction[]) => {
    loadTransactions(rawTransactions);
    setActiveView('cashflow');
  };

  const handleError = (errorMessage: string) => {
    console.error('CSV Error:', errorMessage);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SessionManager
        sessions={sessions}
        currentSession={currentSession}
        onCreateSession={createNewSession}
        onLoadSession={loadSession}
        onClearSession={clearCurrentSession}
        isFirebaseEnabled={isFirebaseEnabled}
        isSaving={isSaving}
      />
      
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 h-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
                <div className="mt-3">
                  <button
                    onClick={clearError}
                    className="text-sm font-medium text-red-800 hover:text-red-600"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {isLoading || isSaving ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">
              {isLoading ? 'Loading...' : 'Saving...'}
            </span>
          </div>
        ) : transactions.length > 0 ? (
          <CashflowTable
            weeklyCashflows={weeklyCashflows}
            transactions={transactions}
            onAddEstimate={addEstimate}
            onUpdateEstimate={updateEstimateById}
            onDeleteEstimate={deleteEstimateById}
          />
        ) : (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path d="M9 12h30m-15 0v12m-6 0h12" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No data imported</h3>
            <p className="mt-1 text-sm text-gray-500">
              Import your transaction data to start analyzing cashflow
            </p>
            <div className="mt-6">
              <button
                onClick={() => setShowCSVUpload(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Import Data
              </button>
            </div>
          </div>
        )}
      </div>
      
      {showCSVUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Import Transaction Data</h2>
              <button
                onClick={() => setShowCSVUpload(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <CSVUpload 
              onDataParsed={handleDataParsed}
              onError={handleError}
            />
          </div>
        </div>
      )}
      
      <FirebaseDebug />
    </div>
  );
}

export default App;