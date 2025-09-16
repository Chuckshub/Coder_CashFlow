import React, { useState, useEffect } from 'react';
import { getCampfireService } from '../../services/campfireService';
import { CampfireInvoice } from '../../types';
import { formatCurrency } from '../../utils/dateUtils';

interface TestResults {
  apiTest: { success: boolean; message: string; invoiceCount?: number };
  invoices: CampfireInvoice[];
  error: string | null;
  loading: boolean;
}

const CampfireTest: React.FC = () => {
  const [results, setResults] = useState<TestResults>({
    apiTest: { success: false, message: 'Not tested' },
    invoices: [],
    error: null,
    loading: false
  });

  const campfireService = getCampfireService();

  const runTests = async () => {
    console.log('🧪 Starting Campfire integration tests...');
    setResults(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Test 1: API Connection
      console.log('🔌 Testing API connection...');
      const apiTest = await campfireService.testConnection();
      console.log('API Test Result:', apiTest);

      setResults(prev => ({ ...prev, apiTest }));

      if (!apiTest.success) {
        setResults(prev => ({ ...prev, loading: false }));
        return;
      }

      // Test 2: Fetch Invoices
      console.log('📄 Fetching invoices...');
      const invoices = await campfireService.fetchAllOpenInvoices();
      console.log(`Fetched ${invoices.length} invoices`);

      setResults(prev => ({ ...prev, invoices }));
      
      // Complete the test
      setResults(prev => ({ 
        ...prev,
        loading: false 
      }));

    } catch (error) {
      console.error('💥 Test error:', error);
      setResults(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false 
      }));
    }
  };

  const clearResults = () => {
    setResults({
      apiTest: { success: false, message: 'Not tested' },
      invoices: [],
      error: null,
      loading: false
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            🔥 Campfire Integration Test
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Test the Campfire API connection and client payment projections
          </p>
        </div>

        <div className="p-6">
          {/* Control Buttons */}
          <div className="flex space-x-3 mb-6">
            <button
              onClick={runTests}
              disabled={results.loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {results.loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Running Tests...
                </>
              ) : (
                <>
                  🧪 Run Tests
                </>
              )}
            </button>
            <button
              onClick={clearResults}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Clear Results
            </button>
          </div>

          {/* Configuration Status */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Configuration Status</h3>
            <div className="bg-gray-50 rounded-md p-3">
              <div className="flex items-center">
                <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                  campfireService.isConfigured() ? 'bg-green-500' : 'bg-red-500'
                }`}></span>
                <span className="text-sm">
                  Campfire API: {campfireService.isConfigured() ? 'Configured' : 'Not Configured'}
                </span>
              </div>
              {!campfireService.isConfigured() && (
                <div className="mt-2 text-xs text-red-600">
                  ⚠️ Set REACT_APP_CAMPFIRE_API_KEY environment variable
                </div>
              )}
            </div>
          </div>

          {/* Test Results */}
          <div className="space-y-4">
            {/* API Connection Test */}
            <div className="bg-gray-50 rounded-md p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">
                🔌 API Connection Test
              </h4>
              <div className="flex items-center">
                <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                  results.apiTest.success ? 'bg-green-500' : 'bg-red-500'
                }`}></span>
                <span className="text-sm">{results.apiTest.message}</span>
                {results.apiTest.invoiceCount !== undefined && (
                  <span className="ml-2 text-xs text-gray-600">
                    ({results.apiTest.invoiceCount} total invoices)
                  </span>
                )}
              </div>
            </div>

            {/* Invoices */}
            {results.invoices.length > 0 && (
              <div className="bg-green-50 rounded-md p-4">
                <h4 className="text-sm font-medium text-green-800 mb-2">
                  📄 Open Invoices ({results.invoices.length})
                </h4>
                <div className="max-h-48 overflow-y-auto">
                  <div className="space-y-2">
                    {results.invoices.slice(0, 5).map((invoice) => (
                      <div key={invoice.id} className="text-xs bg-white rounded p-2">
                        <div className="flex justify-between">
                          <span className="font-medium">{invoice.client_name}</span>
                          <span className="font-medium text-green-700">
                            {formatCurrency(invoice.amount_due)}
                          </span>
                        </div>
                        <div className="text-gray-600 mt-1">
                          #{invoice.invoice_number} - Due: {new Date(invoice.due_date).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                    {results.invoices.length > 5 && (
                      <div className="text-xs text-gray-500 text-center py-2">
                        ... and {results.invoices.length - 5} more invoices
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 text-sm font-medium text-green-800">
                  Total Amount Due: {formatCurrency(
                    results.invoices.reduce((sum, inv) => sum + inv.amount_due, 0)
                  )}
                </div>
              </div>
            )}

            {/* Error */}
            {results.error && (
              <div className="bg-red-50 rounded-md p-4">
                <h4 className="text-sm font-medium text-red-800 mb-2">
                  ❌ Error
                </h4>
                <div className="text-sm text-red-700">
                  {results.error}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampfireTest;