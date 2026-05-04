import React, { useEffect, useState } from 'react';

export default function AmiSettingsPage() {
  const [settings, setSettings]     = useState(null);
  const [devices, setDevices]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [notice, setNotice]         = useState('');
  const [pwForm, setPwForm]         = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [busy, setBusy]             = useState('');

  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch('/api/ami/settings', { headers })
      .then(r => r.json())
      .then(d => {
        setSettings(d.settings || d);
        setDevices(d.trustedDevices || d.devices || []);
        setMfaEnabled(d.settings?.mfaEnabled || d.mfaEnabled || false);
        setError('');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function changePassword(e) {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setError('New passwords do not match.'); return;
    }
    setBusy('pw'); setError(''); setNotice('');
    try {
      const res = await fetch('/api/ami/settings/change-password', {
        method: 'POST', headers,
        body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed.');
      setNotice('Password updated successfully.');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function toggleMfa() {
    setBusy('mfa'); setError(''); setNotice('');
    try {
      const res = await fetch('/api/ami/settings/mfa', {
        method: 'POST', headers,
        body: JSON.stringify({ enabled: !mfaEnabled }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed.');
      setMfaEnabled(!mfaEnabled);
      setNotice(`Multi-factor authentication ${!mfaEnabled ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function revokeDevice(deviceId) {
    setBusy(`device-${deviceId}`); setError(''); setNotice('');
    try {
      const res = await fetch(`/api/ami/settings/devices/${deviceId}/revoke`, {
        method: 'POST', headers, body: '{}',
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed.');
      setDevices(prev => prev.filter(dev => dev.id !== deviceId));
      setNotice('Device revoked.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <section className="glass-surface rounded-3xl p-6 border border-white/10">
        <p className="micro-label neon-subtle mb-2">AMI System Authority</p>
        <h1 className="text-3xl command-title neon-title mb-2">Security Settings</h1>
        <p className="text-slate-700 dark:text-slate-300 neon-subtle">
          Manage privileged credentials, multi-factor authentication, and trusted devices.
        </p>
        {error  && <div className="mt-4 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
        {notice && <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{notice}</div>}
      </section>

      {/* Account info */}
      {!loading && settings && (
        <section className="glass-surface rounded-3xl p-6 border border-white/10">
          <h2 className="text-xl command-title neon-title mb-4">Account</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {[
              { label: 'Username',      value: settings.username || settings.email || '—' },
              { label: 'Role',          value: settings.role || 'ami' },
              { label: 'Last Login',    value: settings.lastLogin ? new Date(settings.lastLogin).toLocaleString() : '—' },
              { label: 'MFA Status',    value: mfaEnabled ? 'Enabled' : 'Disabled' },
              { label: 'Account Since', value: settings.createdAt ? new Date(settings.createdAt).toLocaleDateString() : '—' },
            ].map(row => (
              <div key={row.label} className="rounded-2xl bg-slate-900/30 p-4">
                <p className="micro-label neon-subtle">{row.label}</p>
                <p className="mt-1 text-slate-100 font-semibold">{row.value}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Change password */}
      <section className="glass-surface rounded-3xl p-6 border border-white/10">
        <h2 className="text-xl command-title neon-title mb-4">Change Password</h2>
        <form onSubmit={changePassword} className="space-y-3 max-w-md">
          <input
            type="password"
            required
            placeholder="Current password"
            value={pwForm.currentPassword}
            onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
            className="w-full rounded-2xl border border-white/10 bg-slate-900/30 px-4 py-3 text-slate-900 dark:text-amber-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
          <input
            type="password"
            required
            placeholder="New password"
            value={pwForm.newPassword}
            onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
            className="w-full rounded-2xl border border-white/10 bg-slate-900/30 px-4 py-3 text-slate-900 dark:text-amber-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
          <input
            type="password"
            required
            placeholder="Confirm new password"
            value={pwForm.confirmPassword}
            onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
            className="w-full rounded-2xl border border-white/10 bg-slate-900/30 px-4 py-3 text-slate-900 dark:text-amber-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={busy === 'pw'}
            className="w-full rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 disabled:opacity-60"
          >
            {busy === 'pw' ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </section>

      {/* MFA */}
      <section className="glass-surface rounded-3xl p-6 border border-white/10">
        <h2 className="text-xl command-title neon-title mb-2">Multi-Factor Authentication</h2>
        <p className="text-sm neon-subtle mb-4">
          {mfaEnabled
            ? 'MFA is currently active. Your account requires a second factor on every login.'
            : 'MFA is disabled. Enabling it will require a second factor on every login.'}
        </p>
        <button
          onClick={toggleMfa}
          disabled={busy === 'mfa'}
          className={`rounded-2xl px-5 py-3 font-semibold text-sm disabled:opacity-60 transition-colors ${
            mfaEnabled
              ? 'border border-rose-400/40 text-rose-200 hover:bg-rose-500/10'
              : 'bg-emerald-500 text-slate-950'
          }`}
        >
          {busy === 'mfa' ? 'Updating…' : mfaEnabled ? 'Disable MFA' : 'Enable MFA'}
        </button>
      </section>

      {/* Trusted devices */}
      <section className="glass-surface rounded-3xl p-6 border border-white/10">
        <h2 className="text-xl command-title neon-title mb-4">Trusted Devices</h2>

        {loading && <p className="text-sm neon-subtle">Loading devices…</p>}

        {!loading && devices.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/30 p-4">
            <p className="micro-label accent-amber mb-1">No trusted devices</p>
            <p className="text-xs text-slate-400">Trusted devices will appear here once the backend serves them via <code>/api/ami/settings</code>.</p>
          </div>
        )}

        <div className="space-y-3">
          {devices.map(dev => (
            <div key={dev.id} className="rounded-2xl bg-slate-900/20 border border-white/5 px-4 py-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">{dev.name || dev.userAgent || 'Unknown device'}</p>
                <p className="text-xs neon-subtle mt-0.5">
                  {dev.ip && <span>IP: {dev.ip} · </span>}
                  Last seen: {dev.lastSeen ? new Date(dev.lastSeen).toLocaleString() : '—'}
                </p>
              </div>
              <button
                onClick={() => revokeDevice(dev.id)}
                disabled={busy === `device-${dev.id}`}
                className="rounded-2xl border border-rose-400/40 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/10 disabled:opacity-40 flex-shrink-0 transition-colors"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
