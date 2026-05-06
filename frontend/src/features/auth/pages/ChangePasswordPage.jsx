import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { changePassword, getStoredAuth, persistAuth } from '../services/authApi';

function EyeIcon({ open }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 012.58-4.148M6.83 6.83A9.956 9.956 0 0112 5c4.478 0 8.268 2.943 9.542 7a9.97 9.97 0 01-1.37 2.67M6.83 6.83L3 3m3.83 3.83l10.34 10.34M3 3l18 18" />
    </svg>
  );
}

export default function ChangePasswordPage({ onLogin }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Get auth from location state (passed from login) or from localStorage
  const stateAuth = location.state?.auth;
  const storedAuth = getStoredAuth();
  const auth = stateAuth || storedAuth;
  const token = auth?.token;
  // Force-change flow: user was forced to change on first login — no currentPassword needed
  const isForceChange = auth?.user?.mustChangePassword === true;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!isForceChange && !currentPassword) {
      setError('Please enter your current password.');
      return;
    }
    setSaving(true);
    try {
      if (!token) {
        throw new Error('Your sign-in session has expired. Please log in again.');
      }
      const payload = { newPassword };
      if (!isForceChange) payload.currentPassword = currentPassword;
      const data = await changePassword(payload, token);
      const nextAuth = persistAuth(data);
      onLogin?.(nextAuth);
      navigate(`/roles/${data.user?.role || nextAuth.user?.role || 'student'}`, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5deb3] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-3xl p-8 bg-white border border-[#c9a96e]/40 shadow-xl dark:bg-slate-900 dark:border-white/10">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-black text-[#800000] dark:text-slate-100">
            {isForceChange ? 'Welcome!' : 'Change Password'}
          </h1>
          <p className="mt-2 text-sm text-[#191970] dark:text-slate-300">
            {isForceChange
              ? 'Please set your password before continuing.'
              : 'Enter your current password and choose a new one.'}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isForceChange && (
            <div>
              <label className="block text-xs font-semibold uppercase text-[#800020] dark:text-slate-400 mb-1">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-[#c9a96e]/40 dark:border-white/10 bg-[#f0d090] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-[#1a5c38]"
                  placeholder="Your current password"
                />
                <button type="button" onClick={() => setShowCurrent(v => !v)}
                  className="absolute inset-y-0 right-3 flex items-center text-[#800020] hover:text-[#1a5c38] transition-colors">
                  <EyeIcon open={showCurrent} />
                </button>
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold uppercase text-[#800020] dark:text-slate-400 mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-xl border border-[#c9a96e]/40 dark:border-white/10 bg-[#f0d090] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-[#1a5c38]"
                placeholder="At least 8 characters"
              />
              <button type="button" onClick={() => setShowNew(v => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-[#800020] hover:text-[#1a5c38] transition-colors">
                <EyeIcon open={showNew} />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-[#800020] dark:text-slate-400 mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-xl border border-[#c9a96e]/40 dark:border-white/10 bg-[#f0d090] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-[#1a5c38]"
                placeholder="Repeat your new password"
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-[#800020] hover:text-[#1a5c38] transition-colors">
                <EyeIcon open={showConfirm} />
              </button>
            </div>
          </div>
          {error && <p className="text-red-600 text-sm font-medium">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-4 py-3 rounded-2xl text-sm transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving...' : isForceChange ? 'Set Password & Continue' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
