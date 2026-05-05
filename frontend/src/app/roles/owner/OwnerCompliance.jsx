import React, { useEffect, useState } from 'react';
import { getAuditLog } from '../../../features/school/services/schoolApi';

export default function OwnerCompliance({ auth }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    getAuditLog()
      .then((data) => setEvents(data?.logs || data?.events || data?.results || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">Compliance</h1>
        <p className="text-[#191970] dark:text-slate-300 mt-1 text-sm">
          Audit trail and compliance events for your institution.
        </p>
      </div>

      <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        {loading ? (
          <p className="text-[#800020] dark:text-slate-400">Loading...</p>
        ) : error ? (
          <p className="text-[#800000] dark:text-slate-100">{error}</p>
        ) : events.length === 0 ? (
          <p className="text-[#800020] dark:text-slate-400">No compliance events recorded yet.</p>
        ) : (
          <>
            <p className="text-xs text-[#800020] dark:text-slate-400 mb-4 font-semibold uppercase">
              {events.length} event{events.length !== 1 ? 's' : ''}
            </p>
            <div className="space-y-3">
              {events.map((ev, i) => (
                <div
                  key={ev.id || i}
                  className="rounded-2xl p-4 bg-[#f0d090] dark:bg-slate-800/40 border border-[#c9a96e]/30 dark:border-white/5"
                >
                  <p className="text-[#800020] dark:text-slate-400 font-semibold text-sm">{ev.action || 'Event'}</p>
                  {ev.data && (
                    <p className="text-[#191970] dark:text-slate-300 text-sm mt-1 truncate">{typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data)}</p>
                  )}
                  {ev.createdAt && (
                    <p className="text-xs text-[#800020]/70 dark:text-slate-500 mt-1">{new Date(ev.createdAt).toLocaleString()}</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
