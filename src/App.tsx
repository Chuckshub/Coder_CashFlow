import React, { useState } from 'react';
import { RawTransaction } from './types';
import CSVUpload from './components/DataImport/CSVUpload';
import CashflowTable from './components/CashflowTable/CashflowTable';
import SessionManager from './components/SessionManager/SessionManager';
import FirebaseDebug from './components/common/FirebaseDebug';
import UserHeader from './components/common/UserHeader';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import { useCashflowDataWithFirebase } from './hooks/useCashflowDataWithFirebase';

function App() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <AppContent />
      </ProtectedRoute>
      <FirebaseDebug />
    </AuthProvider>
  );
}

function AppContent() {
  const [activeView, setActiveView] = useState<'upload' | 'cashflow'>('upload');
  const {
    transactions,
    estimates,
    weeklyCashflows,
    sessions,
    currentSession,
    isLoading,
    isSaving,
    error,
    loadTransactions,
    addEstimate,
    updateEstimate,
    deleteEstimate,
    createSession,
    loadSessions,
    switchSession,
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
    console.error('App error:', errorMessage);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="h-8 w-8 bg-blue-600 rounded flex items-center justify-center">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Coder CashFlow</h1>
            </div>
            
            {/* Navigation */}
            <div className="flex items-center space-x-6">
              <nav className="flex space-x-4">
                <button
                  onClick={() => setActiveView('upload')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeView === 'upload'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Upload Data
                </button>
                <button
                  onClick={() => setActiveView('cashflow')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeView === 'cashflow'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Cashflow Table
                </button>
              </nav>
              
              <UserHeader />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-red-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
              <button
                onClick={clearError}
                className="text-red-400 hover:text-red-600"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Session Manager */}
        {sessions.length > 0 && (
          <div className="mb-6">
            <SessionManager
              sessions={sessions}
              currentSession={currentSession}
              onCreateSession={createSession}
              onSwitchSession={switchSession}
              isLoading={isLoading}
              isSaving={isSaving}
            />
          </div>
        )}

        {/* Content based on active view */}
        {activeView === 'upload' && (
          <div className="px-4 sm:px-0">
            <CSVUpload onDataParsed={handleDataParsed} onError={handleError} />
          </div>
        )}

        {activeView === 'cashflow' && weeklyCashflows.length > 0 && (
          <div className="px-4 sm:px-0">
            <CashflowTable
              weeklyCashflows={weeklyCashflows}
              onAddEstimate={addEstimate}
              onUpdateEstimate={updateEstimate}
              onDeleteEstimate={deleteEstimate}
            />
          </div>
        )}

        {/* Show message if no data */}
        {activeView === 'cashflow' && weeklyCashflows.length === 0 && (
          <div className="px-4 sm:px-0">
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No cashflow data</h3>
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

        {/* Loading overlay */}
        {(isLoading || isSaving) && (
          <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 shadow-xl">
              <div className="flex items-center space-x-4">
                <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-gray-900 font-medium">
                  {isSaving ? 'Saving data...' : 'Loading...'}
                </span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;