import React, { useEffect, useState } from 'react';
import { getPeople, getStaffAttendance, markStaffAttendance, getStudentAttendance, markStudentAttendance, getClasses, runAttendanceAI } from '../../../features/school/services/schoolApi';

const TABS = ['Staff Attendance', 'Student Attendance', 'AI Analysis'];
const CARD = 'rounded-3xl p-6 bg-[#f5deb3] border border-[#c9a96e]/40';
const INNER = 'rounded-2xl p-4 bg-[#f0d090] border border-[#c9a96e]/30';
const BTN = 'bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-5 py-2.5 rounded-2xl text-sm transition-colors';
const TODAY = new Date().toISOString().slice(0, 10);

function statusColor(s) { return s === 'Present' ? 'text-emerald-700' : s === 'Late' ? 'text-amber-700' : 'text-red-700'; }

function StaffAttendanceTab() {
  const [date, setDate] = useState(TODAY);
  const [staff, setStaff] = useState([]);
  const [records, setRecords] = useState({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }
  useEffect(() => {
    Promise.all([getPeople(), getStaffAttendance(date)])
      .then(([p, a]) => {
        setStaff((p?.people || []).filter(u => !['student', 'parent'].includes(u.role)));
        const m = {}; (a?.records || []).forEach(r => { m[r.staffId || r.userId] = r.status; }); setRecords(m);
      }).catch(() => {}).finally(() => setLoading(false));
  }, [date]);
  async function handleMark(staffId, status) {
    try { await markStaffAttendance({ staffId, date, status }); setRecords(r => ({...r, [staffId]: status})); showToast(`Marked ${status}`); } catch (e) { showToast(e.message); }
  }
  const counts = staff.reduce((acc, s) => { const st = records[s.id]; acc[st || 'Unmarked'] = (acc[st || 'Unmarked'] || 0) + 1; return acc; }, {});
  return (
    <div className="space-y-4">
      {toast && <div className="fixed top-6 right-6 z-50 bg-[#1a5c38] text-[#f5deb3] font-bold px-5 py-3 rounded-2xl shadow-xl">{toast}</div>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[['Present', 'text-emerald-700'], ['Absent', 'text-red-700'], ['Late', 'text-amber-700'], ['Unmarked', 'text-[#191970]']].map(([k, cls]) => (
          <div key={k} className={CARD}><p className="text-xs text-[#800020] uppercase font-semibold">{k}</p><p className={`text-2xl font-bold mt-1 ${cls}`}>{counts[k] || 0}</p></div>
        ))}
      </div>
      <div className={CARD}><div className="flex items-center gap-4 mb-4"><h2 className="text-lg font-bold text-[#800000]">Staff Attendance</h2><input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-xl border border-[#c9a96e]/40 p-2 text-[#191970] text-sm" /></div>
        {loading ? <p className="text-[#800020] text-sm">Loading...</p> :
          <div className="space-y-2">{staff.map(s => (
            <div key={s.id} className={`${INNER} flex items-center justify-between gap-3`}>
              <div><p className="text-[#191970] font-medium">{s.name}</p><p className="text-xs text-[#800020]">{s.role}</p></div>
              <div className="flex items-center gap-2">
                {records[s.id] && <span className={`text-xs font-semibold ${statusColor(records[s.id])}`}>{records[s.id]}</span>}
                <select value={records[s.id] || ''} onChange={e => e.target.value && handleMark(s.id, e.target.value)} className="rounded-xl border border-[#c9a96e]/40 p-1.5 text-[#191970] text-xs"><option value="">Mark…</option><option>Present</option><option>Absent</option><option>Late</option></select>
              </div>
            </div>))}
          </div>}
      </div>
    </div>
  );
}

function StudentAttendanceTab() {
  const [date, setDate] = useState(TODAY);
  const [classId, setClassId] = useState('');
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }
  useEffect(() => { getClasses().then(d => setClasses(d?.classes || [])).catch(() => {}); }, []);
  useEffect(() => {
    if (!date) return;
    setLoading(true);
    Promise.all([getPeople(), getStudentAttendance(date, classId)])
      .then(([p, a]) => {
        let s = (p?.people || []).filter(u => u.role === 'student');
        if (classId) s = s.filter(u => u.classId === classId);
        setStudents(s);
        const m = {}; (a?.records || []).forEach(r => { m[r.studentId || r.userId] = r.status; }); setRecords(m);
      }).catch(() => {}).finally(() => setLoading(false));
  }, [date, classId]);
  async function handleMark(studentId, status) {
    try { await markStudentAttendance({ studentId, date, status, classId }); setRecords(r => ({...r, [studentId]: status})); showToast(`Marked ${status}`); } catch (e) { showToast(e.message); }
  }
  const counts = students.reduce((acc, s) => { const st = records[s.id]; acc[st || 'Unmarked'] = (acc[st || 'Unmarked'] || 0) + 1; return acc; }, {});
  return (
    <div className="space-y-4">
      {toast && <div className="fixed top-6 right-6 z-50 bg-[#1a5c38] text-[#f5deb3] font-bold px-5 py-3 rounded-2xl shadow-xl">{toast}</div>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[['Present', 'text-emerald-700'], ['Absent', 'text-red-700'], ['Late', 'text-amber-700'], ['Unmarked', 'text-[#191970]']].map(([k, cls]) => (
          <div key={k} className={CARD}><p className="text-xs text-[#800020] uppercase font-semibold">{k}</p><p className={`text-2xl font-bold mt-1 ${cls}`}>{counts[k] || 0}</p></div>
        ))}
      </div>
      <div className={CARD}>
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <h2 className="text-lg font-bold text-[#800000]">Student Attendance</h2>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-xl border border-[#c9a96e]/40 p-2 text-[#191970] text-sm" />
          <select value={classId} onChange={e => setClassId(e.target.value)} className="rounded-xl border border-[#c9a96e]/40 p-2 text-[#191970] text-sm"><option value="">All Classes</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.arm ? ` ${c.arm}` : ''}</option>)}</select>
        </div>
        {loading ? <p className="text-[#800020] text-sm">Loading...</p> : students.length === 0 ? <p className="text-[#800020] text-sm">No students found{classId ? ' for this class' : ''}.</p> :
          <div className="space-y-2">{students.map(s => (
            <div key={s.id} className={`${INNER} flex items-center justify-between gap-3`}>
              <div><p className="text-[#191970] font-medium">{s.name}</p><p className="text-xs text-[#800020]">{s.className || s.classId || '—'}</p></div>
              <div className="flex items-center gap-2">
                {records[s.id] && <span className={`text-xs font-semibold ${statusColor(records[s.id])}`}>{records[s.id]}</span>}
                <select value={records[s.id] || ''} onChange={e => e.target.value && handleMark(s.id, e.target.value)} className="rounded-xl border border-[#c9a96e]/40 p-1.5 text-[#191970] text-xs"><option value="">Mark…</option><option>Present</option><option>Absent</option><option>Late</option></select>
              </div>
            </div>))}
          </div>}
      </div>
    </div>
  );
}

function AIAttendanceTab() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  async function analyse() {
    setLoading(true); setResult(null); setError('');
    try { const r = await runAttendanceAI(); setResult(r?.analysis || r); }
    catch (e) { setError(e.message || 'Analysis failed.'); } finally { setLoading(false); }
  }
  return (
    <div className="space-y-4">
      <div className={CARD}><h2 className="text-lg font-bold text-[#800000] mb-2">AI Attendance Analysis</h2>
        <p className="text-[#191970] text-sm mb-4">Get AI insights on attendance patterns and at-risk students.</p>
        <button onClick={analyse} disabled={loading} className={BTN}>{loading ? 'Analysing…' : '✦ Analyse Attendance'}</button>
      </div>
      {loading && <div className={CARD}><div className="flex items-center gap-3"><div className="w-5 h-5 border-2 border-[#800020] border-t-transparent rounded-full animate-spin" /><p className="text-[#191970] text-sm">Analysing attendance data…</p></div></div>}
      {error && <div className={CARD}><p className="text-[#800000] text-sm">{error.includes('AI') || error.includes('key') ? 'AI analysis requires configuration. Please contact Ndovera support.' : error}</p></div>}
      {result && <div className="space-y-4">
        {result.weeklyRate && <div className={CARD}><p className="text-xs text-[#800020] uppercase font-semibold">This Week</p><p className="text-2xl font-bold text-[#1a5c38] mt-1">{result.weeklyRate}</p></div>}
        {result.monthlyRate && <div className={CARD}><p className="text-xs text-[#800020] uppercase font-semibold">This Month</p><p className="text-2xl font-bold text-[#800000] mt-1">{result.monthlyRate}</p></div>}
        {result.atRiskStudents?.length > 0 && <div className={CARD}><h3 className="font-bold text-[#800000] mb-3">At-Risk Students (below 75%)</h3><div className="space-y-2">{result.atRiskStudents.map((s, i) => <div key={i} className={`${INNER} text-[#191970] text-sm`}>{s}</div>)}</div></div>}
        {result.suggestions?.length > 0 && <div className={CARD}><h3 className="font-bold text-[#800000] mb-3">Suggestions</h3><ul className="space-y-2">{result.suggestions.map((s, i) => <li key={i} className={`${INNER} text-[#191970] text-sm flex items-start gap-2`}><span className="text-[#1a5c38] font-bold mt-0.5">→</span>{s}</li>)}</ul></div>}
      </div>}
    </div>
  );
}

export default function OwnerAttendance({ auth }) {
  const [tab, setTab] = useState(0);
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="rounded-3xl p-6 bg-[#f5deb3] border border-[#c9a96e]/40"><h1 className="text-2xl font-bold text-[#800000]">Attendance</h1><p className="text-[#191970] mt-1 text-sm">Manage staff and student attendance with AI insights.</p></div>
      <div className="flex flex-wrap gap-2">{TABS.map((t, i) => <button key={t} onClick={() => setTab(i)} className={`px-5 py-2 rounded-2xl text-sm font-semibold transition-colors ${tab === i ? 'bg-[#800020] text-[#f5deb3]' : 'bg-[#f5deb3] text-[#800020] border border-[#c9a96e]/40 hover:bg-[#f0d090]'}`}>{t}</button>)}</div>
      {tab === 0 && <StaffAttendanceTab />}
      {tab === 1 && <StudentAttendanceTab />}
      {tab === 2 && <AIAttendanceTab />}
    </div>
  );
}
