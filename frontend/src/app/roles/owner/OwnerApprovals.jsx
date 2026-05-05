import React, { useEffect, useState } from 'react';
import { getApprovals } from '../../../features/school/services/schoolApi';

export default function OwnerApprovals({ auth }) {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    getApprovals()
      .then((data) => setApprovals(data?.approvals || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">Approvals</h1>
        <p className="text-[#191970] dark:text-slate-300 mt-1 text-sm">
          Pending approval requests from staff and system events.
        </p>
      </div>

      <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        {loading ? (
          <p className="text-[#800020] dark:text-slate-400">Loading...</p>
        ) : error ? (
          <p className="text-[#800000] dark:text-slate-100">{error}</p>
        ) : approvals.length === 0 ? (
          <p className="text-[#800020] dark:text-slate-400">No pending approvals.</p>
        ) : (
          <div className="space-y-3">
            {approvals.map((a, i) => (
              <div
                key={a.id || i}
                className="rounded-2xl p-4 bg-[#f0d090] dark:bg-slate-800/40 border border-[#c9a96e]/30 dark:border-white/5 flex items-start justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[#800020] dark:text-slate-400 font-semibold text-sm">{a.action || 'Request'}</p>
                  {a.data && (
                    <p className="text-[#191970] dark:text-slate-300 text-sm mt-1 truncate">
                      {typeof a.data === 'string' ? a.data : JSON.stringify(a.data)}
                    </p>
                  )}
                  {a.createdAt && (
                    <p className="text-xs text-[#800020]/70 dark:text-slate-500 mt-1">{new Date(a.createdAt).toLocaleString()}</p>
                  )}
                </div>
                <button className="shrink-0 bg-[#1a5c38] dark:bg-emerald-700 hover:bg-[#154a2e] dark:hover:bg-emerald-600 text-[#f5deb3] font-bold dark:text-white px-4 py-2 rounded-2xl text-sm transition-colors">
                  Approve
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
