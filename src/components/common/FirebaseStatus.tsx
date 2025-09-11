import React from 'react';
import { isFirebaseAvailable } from '../../services/firebase';

interface FirebaseStatusProps {
  showDetails?: boolean;
}

const FirebaseStatus: React.FC<FirebaseStatusProps> = ({ showDetails = false }) => {
  const firebaseAvailable = isFirebaseAvailable();
  
  const requiredEnvVars = [
    'REACT_APP_FIREBASE_API_KEY',
    'REACT_APP_FIREBASE_AUTH_DOMAIN',
    'REACT_APP_FIREBASE_PROJECT_ID',
    'REACT_APP_FIREBASE_STORAGE_BUCKET',
    'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
    'REACT_APP_FIREBASE_APP_ID'
  ];
  
  const envStatus = requiredEnvVars.map(key => ({
    key,
    hasValue: !!process.env[key],
    isPlaceholder: process.env[key]?.includes('test_') || process.env[key]?.includes('your_')
  }));
  
  const missingVars = envStatus.filter(item => !item.hasValue);
  const placeholderVars = envStatus.filter(item => item.hasValue && item.isPlaceholder);
  
  if (!showDetails && firebaseAvailable) {
    return (
      <div className="flex items-center space-x-2 text-green-600 text-sm">
        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        <span>Firebase Connected</span>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg border p-4 mb-4">
      <div className="flex items-center space-x-2 mb-3">
        <div className={`w-3 h-3 rounded-full ${
          firebaseAvailable ? 'bg-green-500' : 'bg-red-500'
        }`}></div>
        <h3 className="font-semibold text-gray-900">
          Firebase Status: {firebaseAvailable ? 'Connected' : 'Disconnected'}
        </h3>
      </div>
      
      {!firebaseAvailable && (
        <div className="space-y-3">
          {missingVars.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <h4 className="font-medium text-red-800 mb-2">Missing Environment Variables:</h4>
              <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                {missingVars.map(({ key }) => (
                  <li key={key}>{key}</li>
                ))}
              </ul>
            </div>
          )}
          
          {placeholderVars.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <h4 className="font-medium text-yellow-800 mb-2">Placeholder Values Detected:</h4>
              <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                {placeholderVars.map(({ key }) => (
                  <li key={key}>{key}</li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <h4 className="font-medium text-blue-800 mb-2">Setup Instructions:</h4>
            <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
              <li>Create a Firebase project at <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="underline">console.firebase.google.com</a></li>
              <li>Go to Project Settings → General → Your apps</li>
              <li>Add a web app or copy existing config</li>
              <li>Create a <code className="bg-blue-100 px-1 rounded">.env.local</code> file in your project root</li>
              <li>Add the Firebase configuration variables to the file</li>
              <li>Restart your development server</li>
            </ol>
          </div>
        </div>
      )}
      
      {showDetails && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <h4 className="font-medium text-gray-700 mb-2">Environment Variables Status:</h4>
          <div className="grid grid-cols-1 gap-2 text-sm">
            {envStatus.map(({ key, hasValue, isPlaceholder }) => (
              <div key={key} className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  hasValue && !isPlaceholder ? 'bg-green-500' : 
                  hasValue && isPlaceholder ? 'bg-yellow-500' : 'bg-red-500'
                }`}></div>
                <span className={`${
                  hasValue && !isPlaceholder ? 'text-green-700' : 
                  hasValue && isPlaceholder ? 'text-yellow-700' : 'text-red-700'
                }`}>
                  {key}: {hasValue ? (isPlaceholder ? 'Placeholder' : 'Set') : 'Missing'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FirebaseStatus;
