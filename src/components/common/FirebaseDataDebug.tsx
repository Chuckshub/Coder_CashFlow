import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getSharedFirebaseService } from '../../services/firebaseServiceSharedWrapper';
import { getSharedClientPaymentService } from '../../services/clientPaymentServiceShared';
import { db } from '../../services/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

const FirebaseDataDebug: React.FC = () => {
  const { currentUser } = useAuth();
  const [debugInfo, setDebugInfo] = useState<{
    transactions: any[];
    estimates: any[];
    sessions: any[];
    clientPayments: any[];
    loadingState: string;
    errors: string[];
  }>(
    {
      transactions: [],
      estimates: [],
      sessions: [],
      clientPayments: [],
      loadingState: 'idle',
      errors: []
    }
  );

  const runDebugCheck = async () => {
    if (!currentUser) {
      setDebugInfo(prev => ({
        ...prev,
        errors: ['No authenticated user']
      }));
      return;
    }

    setDebugInfo(prev => ({ ...prev, loadingState: 'loading', errors: [] }));

    try {
      console.log('🔍 Starting Firebase debug check...');
      
      // Test direct Firebase access
      console.log('🔍 Testing direct Firebase access...');
      const transactionQuery = query(
        collection(db, 'shared_transactions'),
        orderBy('date', 'desc')
      );
      
      const transactionSnapshot = await getDocs(transactionQuery);
      const directTransactions: any[] = [];
      
      transactionSnapshot.forEach(doc => {
        const data = doc.data();
        directTransactions.push({
          id: doc.id,
          ...data,
          date: data.date?.toDate?.()?.toISOString() || 'No date'
        });
      });
      
      console.log('✅ Direct Firebase query result:', directTransactions.length, 'transactions');
      
      // Test shared service
      console.log('🔍 Testing shared service...');
      const sharedService = getSharedFirebaseService(currentUser.uid);
      const serviceTransactions = await sharedService.loadTransactions();
      console.log('✅ Shared service result:', serviceTransactions.length, 'transactions');
      
      // Test estimates
      console.log('🔍 Testing estimates...');
      const serviceEstimates = await sharedService.loadEstimates();
      console.log('✅ Shared service estimates:', serviceEstimates.length, 'estimates');
      
      // Test sessions
      console.log('🔍 Testing sessions...');
      const serviceSessions = await sharedService.loadAllSessions();
      console.log('✅ Shared service sessions:', serviceSessions.length, 'sessions');
      
      // Test client payments
      console.log('🔍 Testing client payments...');
      const clientPaymentService = getSharedClientPaymentService(currentUser.uid, 'current_session');
      const serviceClientPayments = await clientPaymentService.getClientPayments();
      console.log('✅ Shared service client payments:', serviceClientPayments.length, 'client payments');
      
      setDebugInfo({
        transactions: serviceTransactions,
        estimates: serviceEstimates,
        sessions: serviceSessions,
        clientPayments: serviceClientPayments,
        loadingState: 'success',
        errors: []
      });
      
    } catch (error) {
      console.error('💥 Debug check error:', error);
      setDebugInfo(prev => ({
        ...prev,
        loadingState: 'error',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }));
    }
  };

  useEffect(() => {
    if (currentUser) {
      runDebugCheck();
    }
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <h3 className="font-semibold text-yellow-800">Firebase Debug - No User</h3>
        <p className="text-yellow-700">Please log in to debug Firebase data access.</p>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-blue-800">Firebase Data Debug</h3>
        <button
          onClick={runDebugCheck}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          disabled={debugInfo.loadingState === 'loading'}
        >
          {debugInfo.loadingState === 'loading' ? 'Loading...' : 'Refresh Debug'}
        </button>
      </div>
      
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <strong>User ID:</strong> {currentUser.uid.substring(0, 8)}...
          </div>
          <div>
            <strong>User Email:</strong> {currentUser.email}
          </div>
        </div>
        
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white p-3 rounded border">
            <strong className="text-green-700">Transactions:</strong>
            <div className="text-lg font-bold">{debugInfo.transactions.length}</div>
            {debugInfo.transactions.length > 0 && (
              <div className="text-xs mt-1 text-gray-600">
                Latest: {debugInfo.transactions[0]?.date?.toLocaleDateString()}
              </div>
            )}
          </div>
          
          <div className="bg-white p-3 rounded border">
            <strong className="text-blue-700">Estimates:</strong>
            <div className="text-lg font-bold">{debugInfo.estimates.length}</div>
          </div>
          
          <div className="bg-white p-3 rounded border">
            <strong className="text-purple-700">Sessions:</strong>
            <div className="text-lg font-bold">{debugInfo.sessions.length}</div>
          </div>
          
          <div className="bg-white p-3 rounded border">
            <strong className="text-orange-700">Client Payments:</strong>
            <div className="text-lg font-bold">{debugInfo.clientPayments.length}</div>
          </div>
        </div>
        
        {debugInfo.errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded p-3">
            <strong className="text-red-700">Errors:</strong>
            <ul className="list-disc list-inside text-red-600 mt-1">
              {debugInfo.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}
        
        {debugInfo.transactions.length > 0 && (
          <details className="bg-white border rounded p-3">
            <summary className="cursor-pointer font-semibold text-gray-700">
              Sample Transaction Data (click to expand)
            </summary>
            <pre className="text-xs mt-2 bg-gray-50 p-2 rounded overflow-auto max-h-40">
              {JSON.stringify(debugInfo.transactions.slice(0, 2), null, 2)}
            </pre>
          </details>
        )}
        
        <div className="text-xs text-gray-500 mt-2">
          Status: {debugInfo.loadingState} | Last check: {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

export default FirebaseDataDebug;
