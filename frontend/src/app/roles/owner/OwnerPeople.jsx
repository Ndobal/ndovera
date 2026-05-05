import React, { useEffect, useState } from 'react';
import { getPeople } from '../../../features/school/services/schoolApi';

const FILTERS = ['All', 'Teachers', 'Admin'];

export default function OwnerPeople({ auth }) {
  const [people, setPeople] = useState([]);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    getPeople()
      .then((data) => setPeople(data?.people || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = people.filter((p) => {
    if (filter === 'Teachers') return (p.role || '').toLowerCase() === 'teacher';
    if (filter === 'Admin') return ['admin', 'owner', 'accountant', 'hos'].includes((p.role || '').toLowerCase());
    return true;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">People</h1>
        <p className="text-[#191970] dark:text-slate-300 mt-1 text-sm">
          All staff enrolled in your institution.
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-2xl text-sm font-semibold border transition-colors ${
              filter === f
                ? 'bg-[#800020] text-[#f5deb3] border-[#800020]'
                : 'bg-[#f5deb3] text-[#800020] border-[#c9a96e]/40 dark:bg-slate-900/30 dark:text-slate-400 dark:border-white/10 hover:bg-[#efd4a0]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        {loading ? (
          <p className="text-[#800020] dark:text-slate-400">Loading...</p>
        ) : error ? (
          <p className="text-[#800000] dark:text-slate-100">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="text-[#800020] dark:text-slate-400">
            No staff found. Staff will appear once enrolled.
          </p>
        ) : (
          <>
            <p className="text-xs text-[#800020] dark:text-slate-400 mb-4 font-semibold uppercase">
              {filtered.length} {filter === 'All' ? 'total' : filter.toLowerCase()}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#c9a96e]/40 dark:border-white/10">
                    <th className="text-left py-2 pr-4 text-[#800020] dark:text-slate-400 font-semibold">Name</th>
                    <th className="text-left py-2 pr-4 text-[#800020] dark:text-slate-400 font-semibold">Email</th>
                    <th className="text-left py-2 text-[#800020] dark:text-slate-400 font-semibold">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-b border-[#c9a96e]/20 dark:border-white/5">
                      <td className="py-2 pr-4 text-[#191970] dark:text-slate-300">{p.name || '—'}</td>
                      <td className="py-2 pr-4 text-[#191970] dark:text-slate-300">{p.email || '—'}</td>
                      <td className="py-2 text-[#191970] dark:text-slate-300 capitalize">{p.role || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
