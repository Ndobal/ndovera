import React, { useEffect, useMemo, useState } from 'react';
import { getTimetable } from '../../school/services/schoolApi';
import { TIMETABLE_DAYS, entriesToDayGrid } from '../../school/components/timetableEngine';

// Student-facing weekly timetable: time across the top, days down the left side. Read-only.
export default function TimetableTab() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    getTimetable({})
      .then(data => {
        if (ignore) return;
        setEntries(Array.isArray(data?.entries) ? data.entries : []);
        setError('');
      })
      .catch(loadError => { if (!ignore) setError(loadError?.message || 'Could not load your timetable.'); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, []);

  const grid = useMemo(() => entriesToDayGrid(entries), [entries]);

  if (loading) {
    return <div className="glass-surface rounded-3xl p-6 text-sm text-slate-300">Loading your timetable…</div>;
  }

  if (error) {
    return <div className="glass-surface rounded-3xl p-6 text-sm text-rose-300">{error}</div>;
  }

  if (!grid.columns.length) {
    return (
      <div className="glass-surface rounded-3xl p-6 text-sm text-slate-300">
        Your class timetable has not been published yet. Check back once your school sets it up.
      </div>
    );
  }

  return (
    <div className="glass-surface rounded-3xl p-4 md:p-5">
      <h2 className="text-base md:text-lg command-title neon-title mb-3">Weekly Timetable</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse" style={{ minWidth: 640 }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border border-white/10 bg-indigo-500/30 p-2 text-left text-slate-100">Day</th>
              {grid.columns.map(column => (
                <th key={column.periodIndex} className={`border border-white/10 p-2 text-center ${column.isBreak ? 'bg-amber-500/25 text-amber-100' : 'bg-indigo-500/30 text-slate-100'}`}>
                  <div>{column.startTime}</div>
                  <div className="opacity-70">{column.endTime}</div>
                  {column.isBreak ? <div className="mt-0.5 text-[10px]">{column.label}</div> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIMETABLE_DAYS.map(day => {
              const row = grid.rows.find(item => item.day === day.n) || { cells: {} };
              return (
                <tr key={day.n}>
                  <td className="sticky left-0 z-10 border border-white/10 bg-slate-900/40 p-2 font-bold text-slate-100">{day.short}</td>
                  {grid.columns.map(column => {
                    if (column.isBreak) {
                      return <td key={column.periodIndex} className="border border-white/10 bg-amber-500/10 p-1 text-center text-[10px] font-semibold uppercase text-amber-200">{column.label}</td>;
                    }
                    const cell = row.cells[column.periodIndex];
                    return (
                      <td key={column.periodIndex} className="border border-white/10 bg-slate-900/20 p-1 text-center align-top">
                        {cell?.subjectName ? (
                          <div>
                            <p className="font-semibold text-slate-100">{cell.subjectName}</p>
                            {cell.teacherName ? <p className="text-[10px] text-slate-300">{cell.teacherName}</p> : null}
                          </div>
                        ) : <span className="text-slate-500">—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
