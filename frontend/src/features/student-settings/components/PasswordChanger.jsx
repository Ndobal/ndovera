import React, { useState } from 'react';
import { changePassword } from '../service/settingsService';

export default function PasswordChanger() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [status, setStatus] = useState(null);

  const save = async () => {
    try {
      await changePassword({ current, next });
      setStatus({ ok: true, msg: 'Password changed' });
      setCurrent(''); setNext('');
    } catch (e) {
      setStatus({ ok: false, msg: e.message });
    }
  };

  return (
    <div className="glass-surface rounded-3xl p-5 space-y-3">
      <p className="micro-label neon-subtle">Change Password</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input type="password" placeholder="Current password" value={current} onChange={e => setCurrent(e.target.value)} className="p-2 bg-slate-900/40 rounded-xl" />
        <input type="password" placeholder="New password" value={next} onChange={e => setNext(e.target.value)} className="p-2 bg-slate-900/40 rounded-xl" />
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} className="px-4 py-2 rounded-2xl bg-emerald-500/20">Update Password</button>
        {status && <p className={status.ok ? 'text-emerald-300' : 'text-rose-300'}>{status.msg}</p>}
      </div>
    </div>
  );
}
