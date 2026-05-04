import React, { useMemo, useState, useEffect } from 'react';
import StudentSectionShell from './StudentSectionShell';

function stateScore(state) {
  if (!state) return 0;
  const s = state.toLowerCase();
  if (s.startsWith('present')) return 1;
  if (s.startsWith('late')) return 0.5;
  return 0; // absent/other
}

function niceBadge(state) {
  const s = (state || '').toLowerCase();
  if (s.startsWith('present')) return { label: 'Present', cls: 'glass-chip accent-emerald text-emerald-700' };
  if (s.startsWith('late')) return { label: 'Late', cls: 'glass-chip accent-amber text-amber-600' };
  return { label: state || 'Unknown', cls: 'glass-chip accent-rose text-rose-600' };
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
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // selected day detail

  const studentId = localStorage.getItem('userId') || 'current_student';

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const resp = await fetch(`/api/attendance?studentId=${encodeURIComponent(studentId)}&limit=365`);
        if (!resp.ok) throw new Error('Fetch failed');
        const data = await resp.json();
        if (mounted && data && Array.isArray(data.records)) {
          // normalize rows to { date, status, reason }
          const rows = data.records.map(r => ({ id: r.id, date: (r.date || '').toString().slice(0,10), status: r.status, reason: r.reason }));
          setRecords(rows);
        }
      } catch (err) {
        setRecords([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [studentId]);

  // build calendar heatmap for last 30 days
  const heatmap = useMemo(() => {
    const days = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = d.toISOString().slice(0,10);
      const rec = records.find(r => r.date === iso);
      days.push({ date: iso, status: rec ? rec.status : null, reason: rec ? rec.reason : null, id: rec ? rec.id : null });
    }
    return days;
  }, [records]);

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

  const saveDetail = async (payload) => {
    try {
      if (payload.id) {
        await fetch(`/api/attendance/${payload.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: payload.status, reason: payload.reason }) });
      } else {
        await fetch('/api/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId, date: payload.date, status: payload.status, reason: payload.reason, recordedBy: studentId }) });
      }
      // refresh
      const resp = await fetch(`/api/attendance?studentId=${encodeURIComponent(studentId)}&limit=365`);
      const data = await resp.json();
      const rows = data.records.map(r => ({ id: r.id, date: (r.date || '').toString().slice(0,10), status: r.status, reason: r.reason }));
      setRecords(rows);
      setSelected(null);
    } catch (err) {
      console.error('Save failed', err && err.message);
      // leave selected open
    }
  };

  if (loading) return <StudentSectionShell title="Attendance" subtitle="Check your school attendance record."><div className="p-6">Loading…</div></StudentSectionShell>;

  return (
    <StudentSectionShell title="Attendance" subtitle="Check your school attendance record.">
      <div className="glass-surface rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4 gap-4">
          <div>
            <p className="text-slate-100 mb-1">This term attendance</p>
            <div className="flex items-baseline gap-3">
              <div className="text-3xl font-extrabold mono-metric text-slate-100">{summary.pct}%</div>
              <div className="space-x-2">
                <span className="glass-chip px-3 py-1 rounded-full text-xs">Present: <strong className="ml-1">{summary.totals.present}</strong></span>
                <span className="glass-chip px-3 py-1 rounded-full text-xs">Late: <strong className="ml-1">{summary.totals.late}</strong></span>
                <span className="glass-chip px-3 py-1 rounded-full text-xs">Absent: <strong className="ml-1">{summary.totals.absent}</strong></span>
              </div>
            </div>
          </div>

          <div className="ml-auto">
            <button onClick={() => downloadCSV(records.map(r => ({ day: r.date, state: r.status || 'Unknown' })))} className="px-3 py-2 rounded-xl bg-indigo-500/25 border border-indigo-300/30 text-white">Export CSV</button>
          </div>
        </div>

        {/* Heatmap */}
        <div className="mb-4">
          <div className="text-sm text-slate-300 mb-2">Last 30 days</div>
          <div className="grid grid-cols-10 gap-2">
            {heatmap.map(cell => {
              const s = (cell.status || '').toLowerCase();
              const bg = s.startsWith('present') ? 'bg-emerald-400' : s.startsWith('late') ? 'bg-amber-400' : cell.status ? 'bg-rose-400' : 'bg-slate-700/30';
              return (
                <button key={cell.date} onClick={() => setSelected(cell)} title={`${cell.date} — ${cell.status || 'No data'}`} className={`h-6 w-6 rounded ${bg} border border-white/10`} />
              );
            })}
          </div>
        </div>

        {/* Recent list */}
        <div className="space-y-2">
          {records.slice(0, 14).map(item => {
            const badge = niceBadge(item.status);
            return (
              <div key={item.date} className="rounded-2xl border border-white/10 p-3 bg-slate-900/30 flex items-center justify-between">
                <div>
                  <div className="text-slate-100 font-medium">{item.date}</div>
                  {item.reason && <div className="text-xs neon-subtle mt-1">{item.reason}</div>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={badge.cls}>{badge.label}</span>
                  <button onClick={() => setSelected(item)} className="px-3 py-1 rounded-xl bg-slate-800/30 border border-white/10 text-sm">Details</button>
                </div>
              </div>
            );
          })}
          {records.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 p-4 bg-slate-900/20 text-center">
              <p className="micro-label accent-amber">No live attendance records</p>
              <p className="mt-2 text-sm text-slate-300">Attendance history will appear here once your school syncs student attendance data.</p>
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
              <div className="mb-3">
                <label className="block text-sm mb-1">Reason / Notes</label>
                <textarea defaultValue={selected.reason || ''} id="attendance-reason" className="w-full rounded-xl bg-slate-900/40 border border-white/10 px-3 py-2 text-sm text-slate-100" />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setSelected(null)} className="px-3 py-2 rounded-xl bg-slate-700/30">Close</button>
                <button onClick={async () => {
                  const reason = document.getElementById('attendance-reason').value;
                  const payload = { id: selected.id, date: selected.date, status: selected.status || 'Absent', reason };
                  await saveDetail(payload);
                }} className="px-3 py-2 rounded-xl bg-emerald-500/30">Save</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </StudentSectionShell>
  );
}
