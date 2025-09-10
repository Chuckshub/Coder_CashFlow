import React, { useState } from 'react';
import { RawTransaction } from './types';
import { useCashflowData } from './hooks/useCashflowData';
import CSVUpload from './components/DataImport/CSVUpload';
import CashflowTable from './components/CashflowTable/CashflowTable';
import { formatCurrency } from './utils/dateUtils';

type AppView = 'home' | 'import' | 'dashboard';

function App() {
  const [currentView, setCurrentView] = useState<AppView>('home');
  const {
    transactions,
    estimates,
    weeklyCashflows,
    isLoading,
    error,
    loadTransactions,
    addEstimate,
    updateEstimate,
    deleteEstimate,
    clearError,
    reset,
    startingBalance,
    totalActualInflow,
    totalActualOutflow
  } = useCashflowData();

  const handleDataParsed = (rawTransactions: RawTransaction[]) => {
    loadTransactions(rawTransactions);
    setCurrentView('dashboard');
  };

  const handleError = (errorMessage: string) => {
    console.error('CSV Error:', errorMessage);
  };

  const renderNavigation = () => (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gray-900">
              Coder CashFlow
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setCurrentView('home')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                currentView === 'home'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              Home
            </button>
            <button
              onClick={() => setCurrentView('import')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                currentView === 'import'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              Import Data
            </button>
            {transactions.length > 0 && (
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentView === 'dashboard'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                Dashboard
              </button>
            )}
            {transactions.length > 0 && (
              <button
                onClick={reset}
                className="px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );

  const renderHome = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl md:text-6xl">
            13-Week Cashflow
            <span className="block text-blue-600">Management</span>
          </h1>
          <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            Upload your transaction data, categorize cash flows, and create accurate 
            13-week projections with drag-and-drop estimate management.
          </p>
          <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
            <div className="rounded-md shadow">
              <button
                onClick={() => setCurrentView('import')}
                className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 md:py-4 md:text-lg md:px-10 transition-colors"
              >
                Get Started
              </button>
            </div>
            <div className="mt-3 rounded-md shadow sm:mt-0 sm:ml-3">
              <button
                onClick={() => setCurrentView('dashboard')}
                disabled={transactions.length === 0}
                className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-blue-600 bg-white hover:bg-gray-50 md:py-4 md:text-lg md:px-10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                View Dashboard
              </button>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mt-16">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="pt-6">
              <div className="flow-root bg-white rounded-lg px-6 pb-8">
                <div className="-mt-6">
                  <div className="inline-flex items-center justify-center p-3 bg-blue-500 rounded-md shadow-lg">
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">
                    CSV Data Import
                  </h3>
                  <p className="mt-5 text-base text-gray-500">
                    Upload and parse transaction data with automatic categorization based on your business rules.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <div className="flow-root bg-white rounded-lg px-6 pb-8">
                <div className="-mt-6">
                  <div className="inline-flex items-center justify-center p-3 bg-green-500 rounded-md shadow-lg">
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">
                    13-Week Projections
                  </h3>
                  <p className="mt-5 text-base text-gray-500">
                    View comprehensive cashflow projections with running balance calculations and visual insights.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <div className="flow-root bg-white rounded-lg px-6 pb-8">
                <div className="-mt-6">
                  <div className="inline-flex items-center justify-center p-3 bg-purple-500 rounded-md shadow-lg">
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                    </svg>
                  </div>
                  <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">
                    Estimate Management
                  </h3>
                  <p className="mt-5 text-base text-gray-500">
                    Add estimates for each week with drag-and-drop functionality and detailed notes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Future login placeholder */}
        <div className="mt-16 text-center">
          <p className="text-sm text-gray-500">
            Future Integration: Firebase Authentication & Data Persistence
          </p>
        </div>
      </div>
    </div>
  );

  const renderImport = () => (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Import Transaction Data</h2>
          <p className="mt-2 text-gray-600">
            Upload your CSV file to get started with cashflow analysis
          </p>
        </div>
        
        <CSVUpload 
          onDataParsed={handleDataParsed}
          onError={handleError}
        />
        
        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Import Error</h3>
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
        )}
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Summary Cards */}
        {transactions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500">Starting Balance</div>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(startingBalance)}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500">Total Inflows</div>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(totalActualInflow)}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500">Total Outflows</div>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(totalActualOutflow)}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500">Net Cashflow</div>
              <div className={`text-2xl font-bold ${
                (totalActualInflow - totalActualOutflow) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(totalActualInflow - totalActualOutflow)}
              </div>
            </div>
          </div>
        )}
        
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : transactions.length > 0 ? (
          <CashflowTable
            weeklyCashflows={weeklyCashflows}
            onAddEstimate={addEstimate}
            onUpdateEstimate={updateEstimate}
            onDeleteEstimate={deleteEstimate}
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
                onClick={() => setCurrentView('import')}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Import Data
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {renderNavigation()}
      
      {currentView === 'home' && renderHome()}
      {currentView === 'import' && renderImport()}
      {currentView === 'dashboard' && renderDashboard()}
    </div>
  );
}

export default App;