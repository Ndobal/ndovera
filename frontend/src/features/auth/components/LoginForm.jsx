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
  const [showPassword, setShowPassword] = useState(false);

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
    <form onSubmit={handleSubmit} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-7">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Secure Sign In</p>
        <p className="text-base leading-7 text-slate-600">Use your account email and password to access your assigned dashboard.</p>
      </div>

      <div className="mt-5 space-y-4">
      <label className="block space-y-2">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Email</span>
        <input
          name="id"
          type="email"
          autoComplete="username"
          value={formState.id}
          onChange={handleChange}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          placeholder="you@ndovera.com"
          required
        />
      </label>

      <label className="block space-y-2">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Password</span>
        <div className="relative">
          <input
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={formState.password}
            onChange={handleChange}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-20 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            placeholder="Enter your password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(current => !current)}
            className="absolute inset-y-0 right-3 flex items-center text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 transition hover:text-emerald-700"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </label>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-5 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-white font-semibold transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? 'Signing in...' : 'Sign In'}
      </button>

      <div className="mt-4 text-center">
        <p className="text-sm text-slate-500">Don't have an account?</p>
        <a
          href="/register-school"
          className="mt-2 inline-block w-full rounded-2xl border border-emerald-600 px-4 py-3 text-emerald-700 font-semibold text-center transition-colors hover:bg-emerald-50"
        >
          Register Your School
        </a>
      </div>
    </form>
  );
}
