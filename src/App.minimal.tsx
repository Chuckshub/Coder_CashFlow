import React, { useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import UserHeader from './components/common/UserHeader';

function MinimalApp() {
  const [message, setMessage] = useState('Direct approach loading...');

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
                  <UserHeader />
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="max-w-7xl mx-auto py-8">
            <div className="px-4 sm:px-0">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Direct Data Approach Test
                </h2>
                
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-md">
                    <p className="text-blue-800">{message}</p>
                  </div>
                  
                  <button
                    onClick={() => setMessage('Button clicked - React state working!')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Test React State
                  </button>
                  
                  <div className="mt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Next Steps:
                    </h3>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                      <li>✅ React app loads successfully</li>
                      <li>✅ Authentication working</li>
                      <li>✅ Basic UI components functional</li>
                      <li>🔄 Add CSV upload functionality</li>
                      <li>🔄 Add direct Firebase integration</li>
                      <li>🔄 Add cashflow table</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ProtectedRoute>
      </div>
    </AuthProvider>
  );
}

export default MinimalApp;