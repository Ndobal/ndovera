import React, { useEffect, useState } from 'react';
import { getAllAudits } from '../service/settingsService';

export default function AuditViewer({ token }) {
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const list = await getAllAudits(token || (window.__dev_token__ || ''));
      if (!mounted) return;
      setAudits(list || []);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [token]);

  if (loading) return <div className="glass-surface rounded-3xl p-6">Loading audit…</div>;

  return (
    <div className="glass-surface rounded-3xl p-6">
      <h3 className="command-title">Audit Log</h3>
      <div className="space-y-3 mt-4">
        {audits.map(a => (
          <div key={a.id} className="p-3 rounded-lg bg-slate-900/20">
            <div className="flex justify-between">
              <div className="text-slate-100 font-semibold">{a.action}</div>
              <div className="text-xs text-slate-300">{new Date(a.ts).toLocaleString()}</div>
            </div>
            <div className="text-sm text-slate-300 mt-2">Student: {a.studentId}</div>
            <pre className="text-xs text-slate-400 mt-2">{JSON.stringify(a.data, null, 2)}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
