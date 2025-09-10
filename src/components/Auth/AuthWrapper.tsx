import React, { useState } from 'react';
import LoginForm from './LoginForm';
import { useAuth } from '../../contexts/AuthContext';
import AuthLoading from './AuthLoading';

const AuthWrapper: React.FC = () => {
  const { currentUser, loading } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');

  if (loading) {
    return <AuthLoading />;
  }

  if (currentUser) {
    return null; // User is authenticated, ProtectedRoute will handle the app
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Coder CashFlow
          </h1>
          <p className="text-gray-600">
            Please sign in to access your cashflow management
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-xl p-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
};

export default AuthWrapper;