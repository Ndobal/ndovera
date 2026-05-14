import React, { useState } from 'react';
import { login, requestPasswordReset } from '../services/authApi';

const initialState = {
  id: '',
  password: '',
};

export default function LoginForm({ onSuccess }) {
  const [formState, setFormState] = useState(initialState);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);

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

  const openResetDialog = () => {
    setResetEmail(formState.id || '');
    setResetMessage('');
    setResetError('');
    setIsResetDialogOpen(true);
  };

  const closeResetDialog = () => {
    if (isResetSubmitting) return;
    setIsResetDialogOpen(false);
    setResetMessage('');
    setResetError('');
  };

  const handlePasswordReset = async event => {
    event.preventDefault();
    setResetError('');
    setResetMessage('');
    setIsResetSubmitting(true);

    try {
      const data = await requestPasswordReset(resetEmail);
      setResetMessage(data.message || 'Check your email for the reset link.');
    } catch (requestError) {
      setResetError(requestError.message || 'Could not request password reset.');
    } finally {
      setIsResetSubmitting(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} autoComplete="off" className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-7">
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
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={formState.id}
              onChange={handleChange}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              placeholder="you@ndovera.com"
              required
            />
          </label>

          <label className="block space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Password</span>
              <button
                type="button"
                onClick={openResetDialog}
                className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 transition hover:text-emerald-800"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
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

      {isResetDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
          <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_28px_80px_rgba(15,23,42,0.22)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Reset Password</p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Enter your email</h3>
              </div>
              <button
                type="button"
                onClick={closeResetDialog}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
              >
                Close
              </button>
            </div>

            <form onSubmit={handlePasswordReset} className="mt-5 space-y-4">
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Email</span>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={event => setResetEmail(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  placeholder="you@ndovera.com"
                  required
                />
              </label>

              {resetMessage ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {resetMessage}
                </div>
              ) : null}

              {resetError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {resetError}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isResetSubmitting}
                className="w-full rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isResetSubmitting ? 'Sending...' : 'Reset'}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
