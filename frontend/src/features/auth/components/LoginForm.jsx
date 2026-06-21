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

    const formData = new FormData(event.currentTarget);
    const submittedCredentials = {
      id: String(formData.get('id') || formState.id || '').trim(),
      password: String(formData.get('password') || formState.password || ''),
    };

    setFormState(submittedCredentials);

    try {
      const auth = await login(submittedCredentials);
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
      <form onSubmit={handleSubmit} autoComplete="on" className="rounded-[28px] border border-[#c9a96e]/45 bg-[#fff8ed] p-6 shadow-[0_18px_50px_rgba(128,0,0,0.1)] sm:p-7 dark:border-[#bf00ff]/35 dark:bg-[#800000]/30">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#800020] dark:text-[#bf00ff]">Secure Sign In</p>
          <p className="text-base leading-7 text-[#191970] dark:text-[#39ff14]">Use your account email and password to access your assigned dashboard.</p>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-[#bf00ff]">Email</span>
            <input
              name="id"
              type="email"
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={formState.id}
              onChange={handleChange}
              className="w-full rounded-2xl border border-[#c9a96e]/45 bg-[#fffdf8] px-4 py-3 text-[#191970] outline-none transition focus:border-[#800000] focus:ring-4 focus:ring-[#b5e3f4] dark:border-[#bf00ff]/40 dark:bg-[#2a001f]/70 dark:text-white dark:focus:border-[#00ffff] dark:focus:ring-[#00ffff]/20"
              placeholder="you@ndovera.com"
              required
            />
          </label>

          <label className="block space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-[#bf00ff]">Password</span>
              <button
                type="button"
                onClick={openResetDialog}
                className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1a5c38] transition hover:text-[#154a2e] dark:text-[#00ffff] dark:hover:text-white"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={formState.password}
                onChange={handleChange}
                className="w-full rounded-2xl border border-[#c9a96e]/45 bg-[#fffdf8] px-4 py-3 pr-20 text-[#191970] outline-none transition focus:border-[#800000] focus:ring-4 focus:ring-[#b5e3f4] dark:border-[#bf00ff]/40 dark:bg-[#2a001f]/70 dark:text-white dark:focus:border-[#00ffff] dark:focus:ring-[#00ffff]/20"
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(current => !current)}
                className="absolute inset-y-0 right-3 flex items-center text-xs font-semibold uppercase tracking-[0.14em] text-[#800020] transition hover:text-[#1a5c38] dark:text-[#bf00ff] dark:hover:text-[#00ffff]"
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
          className="mt-5 w-full rounded-2xl bg-[#1a5c38] px-4 py-3 text-[#b5e3f4] font-bold transition-colors hover:bg-[#154a2e] disabled:cursor-not-allowed disabled:opacity-70 dark:bg-[#00ffff] dark:text-black dark:hover:bg-[#7ffcff]"
        >
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </button>

        <div className="mt-4 text-center">
          <p className="text-sm text-[#191970] dark:text-[#39ff14]">Don't have an account?</p>
          <a
            href="/register-school"
            className="mt-2 inline-block w-full rounded-2xl border border-[#800000] px-4 py-3 text-[#800020] font-semibold text-center transition-colors hover:bg-[#b5e3f4] dark:border-[#bf00ff] dark:text-[#bf00ff] dark:hover:bg-[#2a001f]"
          >
            Register Your School
          </a>
        </div>
      </form>

      {isResetDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
          <div className="w-full max-w-md rounded-[28px] border border-[#c9a96e]/45 bg-[#fff8ed] p-6 shadow-[0_28px_80px_rgba(128,0,0,0.22)] dark:border-[#bf00ff]/35 dark:bg-[#800000]/35">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#800020] dark:text-[#bf00ff]">Reset Password</p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-[#800000] dark:text-[#0000ff]">Enter your email</h3>
              </div>
              <button
                type="button"
                onClick={closeResetDialog}
                className="rounded-full border border-[#c9a96e]/45 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#800020] transition hover:border-[#800000] hover:text-[#800000] dark:border-[#bf00ff]/35 dark:text-[#bf00ff] dark:hover:text-white"
              >
                Close
              </button>
            </div>

            <form onSubmit={handlePasswordReset} className="mt-5 space-y-4">
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-[#bf00ff]">Email</span>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={event => setResetEmail(event.target.value)}
                  className="w-full rounded-2xl border border-[#c9a96e]/45 bg-[#fffdf8] px-4 py-3 text-[#191970] outline-none transition focus:border-[#800000] focus:ring-4 focus:ring-[#b5e3f4] dark:border-[#bf00ff]/40 dark:bg-[#2a001f]/70 dark:text-white dark:focus:border-[#00ffff] dark:focus:ring-[#00ffff]/20"
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
                className="w-full rounded-2xl bg-[#1a5c38] px-4 py-3 font-bold text-[#b5e3f4] transition hover:bg-[#154a2e] disabled:cursor-not-allowed disabled:opacity-70 dark:bg-[#00ffff] dark:text-black dark:hover:bg-[#7ffcff]"
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
