import React, { useEffect, useState } from 'react';
import { getSettings, blockUser, unblockUser } from '../service/settingsService';

export default function PrivacySettings() {
  const [blocked, setBlocked] = useState([]);
  const [id, setId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const s = await getSettings();
      if (!mounted) return;
      setBlocked((s.privacy && s.privacy.blocked) || []);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const add = async () => {
    if (!id) return;
    const next = await blockUser(id);
    setBlocked(next);
    setId('');
  };

  const rem = async (x) => {
    const next = await unblockUser(x);
    setBlocked(next);
  };

  if (loading) return <div className="glass-surface rounded-3xl p-5">Loading…</div>;

  return (
    <div className="glass-surface rounded-3xl p-5 space-y-3">
      <p className="micro-label neon-subtle">Privacy</p>
      <div className="space-y-2">
        {blocked.length === 0 && <p className="text-slate-300 text-sm">No blocked users</p>}
        {blocked.map(b => (
          <div key={b} className="flex items-center justify-between p-2 bg-slate-900/20 rounded-lg">
            <div className="text-slate-100">{b}</div>
            <button onClick={() => rem(b)} className="px-3 py-1 rounded-2xl bg-rose-500/20">Unblock</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={id} onChange={e => setId(e.target.value)} placeholder="User id to block" className="p-2 wheat-input dark:bg-slate-900/40 dark:text-slate-100 rounded-xl" />
        <button onClick={add} className="px-3 py-1 rounded-2xl bg-emerald-500/20">Block</button>
      </div>
    </div>
  );
}
