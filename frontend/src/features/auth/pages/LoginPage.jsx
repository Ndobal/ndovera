import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
      <div className="w-full max-w-md space-y-5">
        <LoginForm onSuccess={handleSuccess} />
        <div className="glass-surface rounded-3xl p-6 border border-white/10 text-center">
          <p className="micro-label neon-subtle">New School?</p>
          <h2 className="text-xl command-title neon-title mt-2">Register Your School</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            Reserve your subdomain, create the owner account, and move into payment plus Ami approval.
          </p>
          <Link to="/register-school" className="inline-flex mt-4 rounded-2xl bg-indigo-500/85 px-4 py-3 font-semibold text-slate-950">
            Register A School
          </Link>
        </div>
      </div>
    </div>
  );
}
