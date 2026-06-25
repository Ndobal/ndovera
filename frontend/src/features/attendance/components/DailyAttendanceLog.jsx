import React, { useCallback, useEffect, useState } from 'react';
import { getDailyAttendanceLog } from '../../school/services/schoolApi';

function fmtTime(ts) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return '—'; }
}

function Row({ person }) {
  return (
    <tr className="border-b border-black/5 dark:border-white/5">
      <td className="px-3 py-2 font-medium text-[#191970] dark:text-slate-100">{person.name}</td>
      <td className="px-3 py-2 text-sm capitalize text-[#4a5578] dark:text-slate-400">{person.role}{person.className ? ` · ${person.className}` : ''}</td>
      <td className="px-3 py-2 text-sm text-[#191970] dark:text-slate-200">{fmtTime(person.time)}</td>
      <td className="px-3 py-2">
        {person.late
          ? <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Late{person.lateMinutes ? ` · ${person.lateMinutes}m` : ''}</span>
          : <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">On time</span>}
      </td>
    </tr>
  );
}

export default function DailyAttendanceLog() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState({ staff: [], students: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');

  const load = useCallback(async (forDate) => {
    setLoading(true); setError('');
    try {
      const result = await getDailyAttendanceLog(forDate);
      setData({ staff: result.staff || [], students: result.students || [], total: result.total || 0 });
    } catch (e) {
      setError(e.message || 'Could not load the attendance log.');
      setData({ staff: [], students: [], total: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(date); }, [date, load]);

  const rows = tab === 'staff' ? data.staff : tab === 'students' ? data.students : [...data.staff, ...data.students];

  return (
    <section className="rounded-3xl border border-[#c9a96e]/40 bg-white/70 p-5 shadow-[0_14px_34px_rgba(25,25,112,0.07)] dark:border-white/10 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-[#191970] dark:text-slate-100">Daily sign-in log</h2>
          <p className="text-sm text-[#4a5578] dark:text-slate-400">Everyone who signed in on the selected day.</p>
        </div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-xl border border-[#c9a96e]/40 bg-white px-3 py-2 text-sm text-[#191970] outline-none focus:ring-2 focus:ring-[#1a5c38] dark:border-white/10 dark:bg-slate-800 dark:text-slate-100" />
      </div>

      <div className="mt-4 flex gap-2">
        {[['all', `All (${data.total})`], ['staff', `Staff (${data.staff.length})`], ['students', `Students (${data.students.length})`]].map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${tab === key ? 'bg-[#191970] text-white' : 'bg-[#191970]/10 text-[#191970] dark:bg-white/10 dark:text-slate-200'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? <p className="text-sm text-[#4a5578] dark:text-slate-400">Loading…</p> : rows.length ? (
          <table className="w-full min-w-[480px] text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-[#800020] dark:text-slate-500">
                <th className="px-3 py-2">Name</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Signed in</th><th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>{rows.map(person => <Row key={`${person.type}-${person.id}-${person.time}`} person={person} />)}</tbody>
          </table>
        ) : <p className="py-6 text-center text-sm text-[#4a5578] dark:text-slate-400">No sign-ins recorded for this day yet.</p>}
      </div>
    </section>
  );
}
