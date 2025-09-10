import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AuthWrapper from './AuthWrapper';
import AuthLoading from './AuthLoading';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { currentUser, loading } = useAuth();

  // Show loading screen while checking authentication
  if (loading) {
    return <AuthLoading />;
  }

  // Show authentication forms if not logged in
  if (!currentUser) {
    return <AuthWrapper />;
  }

  // User is authenticated, show the protected content
  return <>{children}</>;
};

export default ProtectedRoute;