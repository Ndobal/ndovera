import React, { useMemo, useState, useEffect } from 'react';
import StudentSectionShell from './StudentSectionShell';
import { getStoredAuth } from '../../../features/auth/services/authApi';
import { getSession, getStudentAttendance } from '../../../features/school/services/schoolApi';

function stateScore(state) {
  if (!state) return 0;
  const s = state.toLowerCase();
  if (s.startsWith('present')) return 1;
  if (s.startsWith('late')) return 0.5;
  return 0; // absent/other
}

function niceBadge(state) {
  const s = (state || '').toLowerCase();
  if (s.startsWith('present')) return { label: 'Present', cls: 'px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-300' };
  if (s.startsWith('late')) return { label: 'Late', cls: 'px-3 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-700 border border-sky-300' };
  if (s.startsWith('excused')) return { label: 'Excused', cls: 'px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 border border-indigo-300' };
  return { label: state || 'Unknown', cls: 'px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-300' };
}

function normalizeStatus(state) {
  const s = (state || '').toLowerCase();
  if (s.startsWith('present')) return 'Present';
  if (s.startsWith('late')) return 'Late';
  if (s.startsWith('excused')) return 'Excused';
  if (s.startsWith('absent')) return 'Absent';
  return state || 'Unknown';
}

function downloadCSV(rows) {
  const header = 'Day,State\n';
  const body = rows.map(r => `${r.day.replace(/,/g, '')},"${r.state.replace(/"/g, '""')}"`).join('\n');
  const blob = new Blob([header + body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'attendance.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function StudentAttendance() {
  const storedAuth = getStoredAuth();
  const storedUser = storedAuth?.user || JSON.parse(localStorage.getItem('authUser') || '{}');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [termWindow, setTermWindow] = useState({ startDate: '', endDate: '', term: '' });

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const sessionData = await getSession().catch(() => null);
        const activeSession = sessionData?.session || {};
        const from = String(activeSession.startDate || '').trim();
        const to = String(activeSession.endDate || '').trim();
        if (mounted) {
          setTermWindow({
            startDate: from,
            endDate: to,
            term: String(activeSession.term || '').trim(),
          });
        }

        const filters = from && to ? { from, to } : { limit: 365 };
        const data = await getStudentAttendance(filters);
        if (mounted && data && Array.isArray(data.records)) {
          const rows = data.records.map(r => ({
            id: r.id,
            date: (r.date || '').toString().slice(0, 10),
            status: normalizeStatus(r.status),
            notes: r.notes || '',
            recordedBy: r.recordedBy || '',
            classId: r.classId || '',
          }));
          setRecords(rows);
        }
      } catch {
        setRecords([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, []);

  const attendanceWindowLabel = useMemo(() => {
    if (!termWindow.startDate || !termWindow.endDate) return 'Attendance timeline';
    const start = new Date(`${termWindow.startDate}T00:00:00`);
    const end = new Date(`${termWindow.endDate}T00:00:00`);
    const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${termWindow.term ? `${termWindow.term} • ` : ''}${startLabel} to ${endLabel}`;
  }, [termWindow]);

  // build calendar heatmap for the active term window
  const heatmap = useMemo(() => {
    const recordMap = new Map(records.map(record => [record.date, record]));
    const days = [];
    const start = termWindow.startDate ? new Date(`${termWindow.startDate}T00:00:00`) : (() => {
      const fallback = new Date();
      fallback.setDate(fallback.getDate() - 29);
      return fallback;
    })();
    const end = termWindow.endDate ? new Date(`${termWindow.endDate}T00:00:00`) : new Date();

    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const iso = cursor.toISOString().slice(0, 10);
      const rec = recordMap.get(iso);
      days.push({ date: iso, status: rec ? rec.status : null, notes: rec ? rec.notes : null, recordedBy: rec ? rec.recordedBy : null, id: rec ? rec.id : null });
    }
    return days;
  }, [records, termWindow]);

  const summary = useMemo(() => {
    const totals = { present: 0, late: 0, absent: 0 };
    let score = 0;
    records.forEach(r => {
      const s = (r.status || '').toLowerCase();
      if (s.startsWith('present')) totals.present += 1;
      else if (s.startsWith('late')) totals.late += 1;
      else totals.absent += 1;
      score += stateScore(r.status);
    });
    const pct = Math.round((score / (records.length || 1)) * 100);
    return { totals, pct };
  }, [records]);

  if (loading) return <StudentSectionShell title="Attendance" subtitle="Check your school attendance record."><div className="p-6">Loading…</div></StudentSectionShell>;

  return (
    <StudentSectionShell title="Attendance" subtitle={storedUser.className ? `Attendance record for ${storedUser.className}` : 'Check your school attendance record.'}>
      <div className="wheat-card glass-surface rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4 gap-4">
          <div>
            <p className="burgundy-text text-slate-100 mb-1">This term attendance</p>
            <div className="flex items-baseline gap-3">
              <div className="text-3xl font-extrabold mono-metric burgundy-text text-slate-100">{summary.pct}%</div>
              <div className="space-x-2">
                <span className="glass-chip px-3 py-1 rounded-full text-xs">Present: <strong className="ml-1 burgundy-text">{summary.totals.present}</strong></span>
                <span className="glass-chip px-3 py-1 rounded-full text-xs">Late: <strong className="ml-1 burgundy-text">{summary.totals.late}</strong></span>
                <span className="glass-chip px-3 py-1 rounded-full text-xs">Absent: <strong className="ml-1 burgundy-text">{summary.totals.absent}</strong></span>
              </div>
            </div>
          </div>

          <div className="ml-auto">
            <button onClick={() => downloadCSV(records.map(r => ({ day: r.date, state: r.status || 'Unknown' })))} className="burgundy-text px-3 py-2 rounded-xl bg-indigo-500/25 border border-indigo-300/30 text-white">Export CSV</button>
          </div>
        </div>

        {/* Heatmap */}
        <div className="mb-4">
          <div className="text-sm burgundy-text text-slate-300 mb-2">{attendanceWindowLabel}</div>
          <div className="grid grid-cols-10 gap-2">
            {heatmap.map(cell => {
              const s = (cell.status || '').toLowerCase();
              const cellClass = s.startsWith('present')
                ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                : s.startsWith('late')
                  ? 'bg-sky-100 border-sky-300 text-sky-800'
                  : s.startsWith('excused')
                    ? 'bg-indigo-100 border-indigo-300 text-indigo-800'
                    : cell.status
                      ? 'bg-rose-100 border-rose-300 text-rose-800'
                      : 'bg-slate-100 border-slate-300 text-slate-600';
              const shortDate = cell.date ? new Date(cell.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
              return (
                <button key={cell.date} onClick={() => setSelected(cell)} title={`${cell.date} — ${cell.status || 'No data'}`} className={`h-12 w-full rounded border flex items-center justify-center ${cellClass}`}>
                  <span className="text-[9px] font-semibold burgundy-text leading-none">{shortDate}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recent list */}
        <div className="space-y-2">
          {records.slice(0, 14).map(item => {
            const badge = niceBadge(item.status);
            return (
              <div key={item.date} className="wheat-card rounded-2xl border border-white/10 p-3 bg-slate-900/30 flex items-center justify-between gap-3">
                <div>
                  <div className="burgundy-text text-slate-100 font-medium">{item.date}</div>
                  {item.notes && <div className="burgundy-text text-xs neon-subtle mt-1">{item.notes}</div>}
                  {item.recordedBy && <div className="burgundy-text text-[11px] neon-subtle mt-1">Marked by {item.recordedBy}</div>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={badge.cls}>{badge.label}</span>
                  <button onClick={() => setSelected(item)} className="px-3 py-1 rounded-xl bg-slate-800/30 border border-white/10 text-sm">Details</button>
                </div>
              </div>
            );
          })}
          {records.length === 0 && (
            <div className="wheat-card rounded-2xl border border-dashed border-white/10 p-4 bg-slate-900/20 text-center">
              <p className="micro-label accent-amber burgundy-text">No live attendance records</p>
              <p className="mt-2 text-sm burgundy-text text-slate-300">Attendance history will appear here once your school syncs student attendance data.</p>
            </div>
          )}
        </div>

        {/* modal/drill-down */}
        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setSelected(null)} />
            <div className="relative z-60 max-w-md w-full glass-surface rounded-2xl p-4">
              <h3 className="text-lg font-bold mb-2">{selected.date}</h3>
              <div className="mb-2">Status: <strong>{selected.status || 'No data'}</strong></div>
              {selected.recordedBy && <div className="mb-2">Marked by: <strong>{selected.recordedBy}</strong></div>}
              {selected.notes && (
                <div className="mb-3">
                  <label className="block text-sm mb-1">Notes</label>
                  <div className="wheat-input w-full rounded-xl bg-slate-900/40 border border-white/10 px-3 py-2 text-sm text-slate-100 whitespace-pre-wrap">{selected.notes}</div>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button onClick={() => setSelected(null)} className="px-3 py-2 rounded-xl bg-slate-700/30">Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </StudentSectionShell>
  );
}
