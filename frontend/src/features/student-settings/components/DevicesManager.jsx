import React, { useEffect, useState } from 'react';
import { listDevices, addDevice, removeDevice } from '../service/settingsService';

export default function DevicesManager() {
  const [devices, setDevices] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const d = await listDevices();
      if (!mounted) return;
      setDevices(d || []);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const add = async () => {
    if (!name) return;
    const next = await addDevice({ name });
    setDevices(next);
    setName('');
  };

  const del = async (id) => {
    const next = await removeDevice(id);
    setDevices(next);
  };

  if (loading) return <div className="glass-surface rounded-3xl p-5">Loading…</div>;

  return (
    <div className="glass-surface rounded-3xl p-5 space-y-3">
      <p className="micro-label neon-subtle">Logged-in Devices</p>
      <div className="space-y-2">
        {devices.map(d => (
          <div key={d.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/20">
            <div>
              <div className="text-slate-100 font-semibold">{d.name}</div>
              <div className="text-xs text-slate-300">Last seen: {new Date(d.lastSeen).toLocaleString()}</div>
            </div>
            <div>
              <button onClick={() => del(d.id)} className="px-3 py-1 rounded-2xl bg-rose-500/20">Remove</button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="New device name" className="p-2 bg-slate-900/40 rounded-xl" />
        <button onClick={add} className="px-3 py-1 rounded-2xl bg-emerald-500/20">Add Device</button>
      </div>
    </div>
  );
}
