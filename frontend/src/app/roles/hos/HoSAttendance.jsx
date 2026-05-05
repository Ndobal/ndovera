import React, { useEffect, useState } from 'react';
import { getAttendance } from '../../../features/school/services/schoolApi';

const STATUSES = ['All', 'present', 'absent', 'late'];

export default function HoSAttendance({ auth }) {
  const [records, setRecords] = useState([]);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    getAttendance()
      .then((data) => setRecords(data?.records || data?.attendance || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'All' ? records : records.filter((r) => r.status === filter);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">Attendance</h1>
        <p className="text-[#191970] dark:text-slate-300 mt-1 text-sm">
          School-wide attendance records.
        </p>
      </div>

      <div className="flex gap-3 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-2xl text-sm font-semibold border transition-colors capitalize ${
              filter === s
                ? 'bg-[#800020] text-[#f5deb3] border-[#800020]'
                : 'bg-[#f5deb3] text-[#800020] border-[#c9a96e]/40 hover:bg-[#efd4a0] dark:bg-slate-900/30 dark:text-slate-400 dark:border-white/10'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        {loading ? (
          <p className="text-[#800020] dark:text-slate-400">Loading...</p>
        ) : error ? (
          <p className="text-[#800000] dark:text-slate-100">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="text-[#800020] dark:text-slate-400">No attendance records found.</p>
        ) : (
          <>
            <p className="text-xs text-[#800020] dark:text-slate-400 mb-4 font-semibold uppercase">
              {filtered.length} record{filtered.length !== 1 ? 's' : ''} — Export handled per classroom.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#c9a96e]/40 dark:border-white/10">
                    <th className="text-left py-2 pr-4 text-[#800020] dark:text-slate-400 font-semibold">Student ID</th>
                    <th className="text-left py-2 pr-4 text-[#800020] dark:text-slate-400 font-semibold">Status</th>
                    <th className="text-left py-2 pr-4 text-[#800020] dark:text-slate-400 font-semibold">Date</th>
                    <th className="text-left py-2 text-[#800020] dark:text-slate-400 font-semibold">Classroom</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={r.id || i} className="border-b border-[#c9a96e]/20 dark:border-white/5">
                      <td className="py-2 pr-4 text-[#191970] dark:text-slate-300">{r.studentId || '—'}</td>
                      <td className="py-2 pr-4 text-[#191970] dark:text-slate-300 capitalize">{r.status || '—'}</td>
                      <td className="py-2 pr-4 text-[#191970] dark:text-slate-300">{r.date || '—'}</td>
                      <td className="py-2 text-[#191970] dark:text-slate-300">{r.classroomId || '—'}</td>
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
