import React, { useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import UserHeader from './components/common/UserHeader';
import CSVUpload from './components/DataImport/CSVUpload';
import CashflowTable from './components/CashflowTable/CashflowTable';
import { useDirectCashflowData } from './hooks/useDirectCashflowData';
import { RawTransaction } from './types';
import { formatCurrency } from './utils/dateUtils';

type ActiveView = 'upload' | 'cashflow';

function DirectApp() {
  const [activeView, setActiveView] = useState<ActiveView>('upload');
  const {
    transactions,
    estimates,
    weeklyCashflows,
    isLoading,
    isSaving,
    error,
    uploadCSVData,
    addEstimate,
    updateEstimateData,
    deleteEstimateData,
    clearError,
    totalTransactions,
    totalEstimates,
    startingBalance
  } = useDirectCashflowData();

  const handleCSVUpload = async (rawTransactions: RawTransaction[]) => {
    // This is not used anymore - CSV processing is handled in uploadCSVData
    console.log('Legacy CSV upload handler called');
  };

  const handleFileUpload = async (file: File) => {
    const result = await uploadCSVData(file);
    
    if (result.success) {
      const { stats } = result;
      alert(
        `Upload successful!\n` +
        `Total transactions: ${stats.total}\n` +
        `New transactions: ${stats.unique}\n` +
        `Duplicates skipped: ${stats.duplicates}`
      );
      
      if (stats.unique > 0) {
        setActiveView('cashflow');
      }
    } else {
      alert(`Upload failed: ${result.error}`);
    }
  };

  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <ProtectedRoute>
          {/* Header */}
          <div className="bg-white shadow-sm border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                    <span className="text-white font-bold text-lg">$</span>
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900">Coder CashFlow</h1>
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

            {/* Data Summary */}
            {transactions.length > 0 && (
              <div className="mb-6 mx-4 sm:mx-0">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">Data Summary</h3>
                      <p className="text-sm text-gray-600">
                        Transactions: {totalTransactions} • 
                        Estimates: {totalEstimates} • 
                        Balance: {formatCurrency(startingBalance)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {isLoading && (
                        <div className="flex items-center text-blue-600">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                          <span className="text-sm">Loading...</span>
                        </div>
                      )}
                      {isSaving && (
                        <div className="flex items-center text-green-600">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-2"></div>
                          <span className="text-sm">Saving...</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Upload View */}
            {activeView === 'upload' && (
              <div className="px-4 sm:px-0">
                <CSVUpload
                  onDataParsed={handleCSVUpload}
                  onError={(error) => console.error('CSV Error:', error)}
                  onFileUpload={handleFileUpload}
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
                  onUpdateEstimate={updateEstimateData}
                  onDeleteEstimate={deleteEstimateData}
                />
              </div>
            )}

            {/* No Data Message */}
            {activeView === 'cashflow' && transactions.length === 0 && (
              <div className="px-4 sm:px-0">
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
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
          </div>
        </ProtectedRoute>
      </div>
    </AuthProvider>
  );
}

export default DirectApp;