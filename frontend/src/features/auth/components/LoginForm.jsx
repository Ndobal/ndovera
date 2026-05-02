import React, { useState } from 'react';
import { login } from '../services/authApi';

const initialState = {
  id: '',
  password: '',
};

export default function LoginForm({ onSuccess }) {
  const [formState, setFormState] = useState(initialState);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = event => {
    const { name, value } = event.target;
    setFormState(current => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async event => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const auth = await login(formState);
      setFormState(initialState);
      onSuccess?.(auth);
    } catch (submitError) {
      setError(submitError.message || 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-surface rounded-3xl p-8 md:p-10 space-y-5 border border-white/10 shadow-2xl">
      <div>
        <p className="micro-label neon-subtle mb-2">Secure Sign In</p>
        <h1 className="text-3xl command-title neon-title">NDOVERA Portal</h1>
        <p className="text-slate-600 dark:text-slate-300 mt-2">Use your account email and password to access your assigned dashboard.</p>
      </div>

      <label className="block space-y-2">
        <span className="micro-label">Email</span>
        <input
          name="id"
          type="email"
          autoComplete="username"
          value={formState.id}
          onChange={handleChange}
          className="w-full rounded-2xl px-4 py-3 bg-slate-900/5 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
          placeholder="you@ndovera.com"
          required
        />
      </label>

      <label className="block space-y-2">
        <span className="micro-label">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          value={formState.password}
          onChange={handleChange}
          className="w-full rounded-2xl px-4 py-3 bg-slate-900/5 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
          placeholder="Enter your password"
          required
        />
      </label>

      {error && (
        <div className="rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-2xl px-4 py-3 bg-emerald-500/85 hover:bg-emerald-500 text-slate-950 font-semibold transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}
