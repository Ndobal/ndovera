import React, { useState } from 'react';

export default function AdminPasswordReset({ onReset }) {
  const [targetId, setTargetId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [status, setStatus] = useState(null);

  const handleReset = async () => {
    setStatus(null);
    try {
      const token = localStorage.getItem('jwt'); // Assumes JWT is stored here
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ targetId, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');
      setStatus({ ok: true, msg: data.message || 'Password reset successful' });
      setTargetId(''); setNewPassword('');
      if (onReset) onReset(targetId);
    } catch (e) {
      setStatus({ ok: false, msg: e.message });
    }
  };

  return (
    <div className="glass-surface rounded-3xl p-5 space-y-3">
      <p className="micro-label neon-subtle">Admin Password Reset</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input type="text" placeholder="Target User ID" value={targetId} onChange={e => setTargetId(e.target.value)} className="p-2 bg-slate-900/40 rounded-xl" />
        <input type="password" placeholder="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="p-2 bg-slate-900/40 rounded-xl" />
      </div>
      <div className="flex items-center gap-3">
        <button onClick={handleReset} className="px-4 py-2 rounded-2xl bg-emerald-500/20">Reset Password</button>
        {status && <p className={status.ok ? 'text-emerald-300' : 'text-rose-300'}>{status.msg}</p>}
      </div>
    </div>
  );
}
