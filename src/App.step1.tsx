import React, { useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import UserHeader from './components/common/UserHeader';
import CSVUpload from './components/DataImport/CSVUpload';
import { RawTransaction } from './types';

type ActiveView = 'upload' | 'test';

function Step1App() {
  const [activeView, setActiveView] = useState<ActiveView>('test');
  const [message, setMessage] = useState('Step 1: Basic app with CSV upload component');
  const [uploadResults, setUploadResults] = useState<string | null>(null);

  const handleCSVUpload = async (rawTransactions: RawTransaction[]) => {
    setUploadResults(`CSV parsed successfully! Found ${rawTransactions.length} transactions.`);
    console.log('CSV Upload successful:', rawTransactions.length, 'transactions');
  };

  const handleCSVError = (error: string) => {
    setUploadResults(`CSV Upload failed: ${error}`);
    console.error('CSV Upload error:', error);
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
                      onClick={() => setActiveView('test')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        activeView === 'test'
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Test
                    </button>
                    <button
                      onClick={() => setActiveView('upload')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        activeView === 'upload'
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Upload CSV
                    </button>
                  </nav>
                  <UserHeader />
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="max-w-7xl mx-auto py-8">
            <div className="px-4 sm:px-0">
              
              {activeView === 'test' && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Step 1: CSV Upload Test
                  </h2>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-md">
                      <p className="text-blue-800">{message}</p>
                    </div>
                    
                    <button
                      onClick={() => setMessage('Button clicked - React state working!')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 mr-4"
                    >
                      Test React State
                    </button>
                    
                    <button
                      onClick={() => setActiveView('upload')}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      Test CSV Upload
                    </button>
                    
                    {uploadResults && (
                      <div className={`p-4 rounded-md ${
                        uploadResults.includes('failed') 
                          ? 'bg-red-50 text-red-800'
                          : 'bg-green-50 text-green-800'
                      }`}>
                        <p>{uploadResults}</p>
                      </div>
                    )}
                    
                    <div className="mt-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Progress:
                      </h3>
                      <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                        <li>✅ React app loads successfully</li>
                        <li>✅ Authentication working</li>
                        <li>✅ Basic UI components functional</li>
                        <li>🔄 Testing CSV upload functionality</li>
                        <li>⏳ Add direct Firebase integration</li>
                        <li>⏳ Add cashflow table</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
              
              {activeView === 'upload' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                      CSV Upload Test
                    </h2>
                    <p className="text-gray-600 mb-4">
                      Upload your transaction CSV file to test parsing functionality.
                    </p>
                  </div>
                  
                  <CSVUpload
                    onDataParsed={handleCSVUpload}
                    onError={handleCSVError}
                  />
                  
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <button
                      onClick={() => setActiveView('test')}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                    >
                      ← Back to Test
                    </button>
                  </div>
                </div>
              )}
              
            </div>
          </div>
        </ProtectedRoute>
      </div>
    </AuthProvider>
  );
}

export default Step1App;