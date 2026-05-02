import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import LoginForm from '../components/LoginForm';

export default function LoginPage({ onLogin }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleSuccess = auth => {
    onLogin?.(auth);
    const targetPath = location.state?.from && location.state.from !== '/login'
      ? location.state.from
      : `/roles/${auth.user?.role || 'student'}`;

    navigate(targetPath, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <LoginForm onSuccess={handleSuccess} />
      </div>
    </div>
  );
}
