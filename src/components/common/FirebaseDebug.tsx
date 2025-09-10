import React from 'react';
import { isFirebaseAvailable } from '../../services/firebase';

const FirebaseDebug: React.FC = () => {
  const envVars = {
    NODE_ENV: process.env.NODE_ENV,
    REACT_APP_FIREBASE_API_KEY: process.env.REACT_APP_FIREBASE_API_KEY ? `${process.env.REACT_APP_FIREBASE_API_KEY.substring(0, 10)}...` : 'undefined',
    REACT_APP_FIREBASE_AUTH_DOMAIN: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || 'undefined',
    REACT_APP_FIREBASE_PROJECT_ID: process.env.REACT_APP_FIREBASE_PROJECT_ID || 'undefined',
    REACT_APP_FIREBASE_STORAGE_BUCKET: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || 'undefined',
    REACT_APP_FIREBASE_MESSAGING_SENDER_ID: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || 'undefined',
    REACT_APP_FIREBASE_APP_ID: process.env.REACT_APP_FIREBASE_APP_ID ? `${process.env.REACT_APP_FIREBASE_APP_ID.substring(0, 10)}...` : 'undefined',
  };

  const isAvailable = isFirebaseAvailable();

  if (process.env.NODE_ENV === 'production') {
    // Only show in development or if there are issues
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-md text-xs z-50">
      <div className="flex items-center mb-2">
        <div className={`w-3 h-3 rounded-full mr-2 ${
          isAvailable ? 'bg-green-500' : 'bg-red-500'
        }`}></div>
        <strong>Firebase Status: {isAvailable ? 'Connected' : 'Disconnected'}</strong>
      </div>
      
      <div className="space-y-1 text-gray-600">
        {Object.entries(envVars).map(([key, value]) => (
          <div key={key} className="flex justify-between">
            <span className="font-mono text-xs">{key}:</span>
            <span className={`font-mono text-xs ml-2 ${
              value === 'undefined' ? 'text-red-500' : 'text-green-600'
            }`}>
              {value}
            </span>
          </div>
        ))}
      </div>
      
      <div className="mt-2 pt-2 border-t border-gray-200">
        <p className="text-gray-500 text-xs">
          Check browser console for detailed Firebase logs
        </p>
      </div>
    </div>
  );
};

export default FirebaseDebug;