import React, { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import ForgotPasswordForm from './ForgotPasswordForm';

type AuthView = 'login' | 'register' | 'forgot-password';

const AuthWrapper: React.FC = () => {
  const [currentView, setCurrentView] = useState<AuthView>('login');

  const switchToLogin = () => setCurrentView('login');
  const switchToRegister = () => setCurrentView('register');
  const switchToForgotPassword = () => setCurrentView('forgot-password');

  switch (currentView) {
    case 'register':
      return <RegisterForm onSwitchToLogin={switchToLogin} />;
    
    case 'forgot-password':
      return <ForgotPasswordForm onBackToLogin={switchToLogin} />;
    
    case 'login':
    default:
      return (
        <LoginForm 
          onSwitchToRegister={switchToRegister}
          onForgotPassword={switchToForgotPassword}
        />
      );
  }
};

export default AuthWrapper;