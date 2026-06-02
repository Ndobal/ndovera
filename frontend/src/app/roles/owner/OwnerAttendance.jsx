import React, { useEffect, useState } from 'react';
import {
  getAttendanceMonthlyReport,
  getPeople,
  getStaffAttendance,
  getStaffAttendanceActivity,
  markStaffAttendance,
  getStudentAttendance,
  getClasses,
  getSchoolCalendar,
  runAttendanceAI,
} from '../../../features/school/services/schoolApi';
import SchoolCalendarBoard from '../../../features/school/components/SchoolCalendarBoard';
import TimetableBoard from '../../../features/school/components/TimetableBoard';

const TABS = ['Staff Attendance', 'Student Attendance', 'School Calendar', 'Timetable', 'Monthly Report', 'AI Analysis'];
const CARD = 'rounded-3xl p-6 bg-[#f5deb3] border border-[#c9a96e]/40';
const INNER = 'rounded-2xl p-4 bg-[#f0d090] border border-[#c9a96e]/30';
const BTN = 'bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-5 py-2.5 rounded-2xl text-sm transition-colors';
const TODAY = new Date().toISOString().slice(0, 10);
const CURRENT_MONTH = new Date().toISOString().slice(0, 7);

function statusColor(s) { return s === 'Present' ? 'text-emerald-700' : s === 'Late' ? 'text-amber-700' : 'text-red-700'; }

function formatMonthLabel(month) {
  if (!month) return 'This month';
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function buildAvatarSrc(person) {
  const seed = encodeURIComponent(person?.name || person?.displayId || person?.userId || person?.role || 'Ndovera');
  return person?.avatarUrl || person?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
}

function MetricCard({ label, value, accent = 'text-[#800000]' }) {
  return (
    <div className={CARD}>
      <p className="text-xs text-[#800020] uppercase font-semibold">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent}`}>{value}</p>
    </div>
  );
}

function RecognitionCard({ title, description, recipient, badge }) {
  if (!recipient) return null;

  return (
    <div className={`${INNER} flex items-start gap-4`}>
      <img
        src={buildAvatarSrc(recipient)}
        alt={recipient.name || title}
        className="h-16 w-16 rounded-2xl object-cover border border-[#c9a96e]/40 bg-white"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-bold text-[#800000]">{title}</h3>
          {badge ? <span className="rounded-full bg-[#800020] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#f5deb3]">{badge}</span> : null}
        </div>
        <p className="mt-1 text-sm font-semibold text-[#191970]">{recipient.name}</p>
        <p className="text-xs uppercase tracking-wide text-[#800020]">{recipient.role || 'user'}</p>
        {description ? <p className="mt-2 text-sm text-[#191970]">{description}</p> : null}
      </div>
    </div>
  );
}

function formatClockTime(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function StaffAttendanceTab() {
  const [date, setDate] = useState(TODAY);
  const [staff, setStaff] = useState([]);
  const [events, setEvents] = useState([]);
  const [records, setRecords] = useState({});
  const [holiday, setHoliday] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  function load() {
    setLoading(true);
    Promise.all([
      getPeople(),
      getStaffAttendance(date),
      getStaffAttendanceActivity({ date, limit: 500 }).catch(() => ({ events: [] })),
      getSchoolCalendar({ from: date, to: date }).catch(() => ({ holidays: [] })),
    ])
      .then(([p, a, activity, calendar]) => {
        setStaff((p?.people || []).filter(u => !['student', 'parent', 'ami'].includes(String(u.role || '').toLowerCase())));
        const m = {}; (a?.records || []).forEach(r => { m[r.staffId || r.userId] = r.status; }); setRecords(m);
        setEvents((activity?.events || []).filter(ev => ev.action === 'sign-in'));
        setHoliday((calendar?.holidays || []).find(h => h.date === date) || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(load, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleMark(staffId, status) {
    try { await markStaffAttendance({ staffId, date, status }); setRecords(r => ({ ...r, [staffId]: status })); showToast(`Marked ${status}`); } catch (e) { showToast(e.message); }
  }

  const staffById = staff.reduce((acc, s) => { acc[s.id] = s; return acc; }, {});

  // First sign-in per staff member, ordered by arrival time (earliest first).
  const firstByStaff = new Map();
  [...events]
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .forEach(ev => { if (!firstByStaff.has(ev.staffId)) firstByStaff.set(ev.staffId, ev); });
  const arrivals = Array.from(firstByStaff.values());

  const signedInIds = new Set(arrivals.map(ev => ev.staffId));
  const notSignedIn = staff.filter(s => !signedInIds.has(s.id));
  const onTimeCount = arrivals.filter(ev => !ev.isLate).length;
  const lateCount = arrivals.filter(ev => ev.isLate).length;
  const firstArrival = arrivals[0];
  const firstStaff = firstArrival ? staffById[firstArrival.staffId] : null;

  return (
    <div className="space-y-4">
      {toast && <div className="fixed top-6 right-6 z-50 bg-[#1a5c38] text-[#f5deb3] font-bold px-5 py-3 rounded-2xl shadow-xl">{toast}</div>}

      <div className={CARD}>
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-lg font-bold text-[#800000]">Staff Attendance Summary</h2>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-xl border border-[#c9a96e]/40 p-2 text-[#191970] text-sm" />
          <p className="text-xs text-[#191970]">Teaching and non-teaching staff, in order of arrival.</p>
        </div>
      </div>

      {holiday ? (
        <div className="rounded-3xl p-6 bg-[#fdeccb] border border-[#c9a96e]/50">
          <p className="text-xs font-bold uppercase tracking-wide text-[#800020]">{holiday.type === 'break' ? 'School Break' : 'Public Holiday'}{holiday.source === 'national' ? ' · National' : ''}</p>
          <p className="text-2xl font-bold text-[#800000] mt-1">{holiday.title}</p>
          <p className="text-sm text-[#191970] mt-1">No attendance is required today. Staff are not marked absent on this day.</p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={CARD}><p className="text-xs text-[#800020] uppercase font-semibold">First In</p><p className="text-base font-bold text-emerald-700 mt-1 truncate">{firstStaff?.name || '—'}</p><p className="text-xs text-[#191970]">{firstArrival ? formatClockTime(firstArrival.createdAt) : 'No sign-ins yet'}</p></div>
        <div className={CARD}><p className="text-xs text-[#800020] uppercase font-semibold">On Time</p><p className="text-2xl font-bold text-emerald-700 mt-1">{onTimeCount}</p></div>
        <div className={CARD}><p className="text-xs text-[#800020] uppercase font-semibold">Late</p><p className="text-2xl font-bold text-amber-700 mt-1">{lateCount}</p></div>
        <div className={CARD}><p className="text-xs text-[#800020] uppercase font-semibold">{holiday ? 'Not Required' : 'Not Signed In'}</p><p className="text-2xl font-bold text-[#191970] mt-1">{notSignedIn.length}</p></div>
      </div>

      <div className={CARD}>
        <h3 className="text-base font-bold text-[#800000] mb-3">Arrival Order</h3>
        {loading ? <p className="text-[#800020] text-sm">Loading…</p> : arrivals.length === 0 ? <p className="text-[#800020] text-sm">No staff have signed in for this day yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#800020] font-semibold border-b border-[#c9a96e]/40">
                  <th className="pb-2 pr-4">#</th>
                  <th className="pb-2 pr-4">Staff</th>
                  <th className="pb-2 pr-4">Role</th>
                  <th className="pb-2 pr-4">Time In</th>
                  <th className="pb-2 pr-4">Method</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {arrivals.map((ev, i) => {
                  const member = staffById[ev.staffId];
                  return (
                    <tr key={ev.id || ev.staffId} className="border-b border-[#c9a96e]/20">
                      <td className="py-2 pr-4 font-bold text-[#800000]">{i === 0 ? '🥇 1st' : ordinal(i + 1)}</td>
                      <td className="py-2 pr-4 text-[#191970] font-semibold">{member?.name || ev.staffId}</td>
                      <td className="py-2 pr-4 text-[#191970] capitalize">{member?.role || '—'}</td>
                      <td className="py-2 pr-4 text-[#191970] font-mono">{formatClockTime(ev.createdAt)}</td>
                      <td className="py-2 pr-4 text-[#191970] capitalize">{String(ev.method || '').replace(/_/g, ' ') || '—'}</td>
                      <td className="py-2">{ev.isLate
                        ? <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Late{ev.lateMinutes ? ` · ${ev.lateMinutes}m` : ''}</span>
                        : <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">On time</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && notSignedIn.length > 0 ? (
        <div className={CARD}>
          <h3 className="text-base font-bold text-[#800000] mb-1">{holiday ? 'Staff (attendance not required today)' : 'Not Signed In'}</h3>
          <p className="text-xs text-[#191970] mb-3">{holiday ? 'These staff are not marked absent because today is a holiday/break.' : 'Staff who have not self-marked. You can record their status manually if needed.'}</p>
          <div className="space-y-2">
            {notSignedIn.map(s => (
              <div key={s.id} className={`${INNER} flex items-center justify-between gap-3`}>
                <div><p className="text-[#191970] font-medium">{s.name}</p><p className="text-xs text-[#800020] capitalize">{s.role}</p></div>
                <div className="flex items-center gap-2">
                  {records[s.id] && <span className={`text-xs font-semibold ${statusColor(records[s.id])}`}>{records[s.id]}</span>}
                  {!holiday ? (
                    <select value={records[s.id] || ''} onChange={e => e.target.value && handleMark(s.id, e.target.value)} className="rounded-xl border border-[#c9a96e]/40 p-1.5 text-[#191970] text-xs"><option value="">Mark…</option><option>Present</option><option>Absent</option><option>Late</option><option>Excused</option></select>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
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
  const counts = students.reduce((acc, s) => { const st = records[s.id]; acc[st || 'Unmarked'] = (acc[st || 'Unmarked'] || 0) + 1; return acc; }, {});
  return (
    <div className="space-y-4">
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
        <div className={`${INNER} mb-4 text-sm text-[#191970]`}>
          Only the assigned class teacher can mark student attendance. Owner and HoS access here is view-only.
        </div>
        {loading ? <p className="text-[#800020] text-sm">Loading...</p> : students.length === 0 ? <p className="text-[#800020] text-sm">No students found{classId ? ' for this class' : ''}.</p> :
          <div className="space-y-2">{students.map(s => (
            <div key={s.id} className={`${INNER} flex items-center justify-between gap-3`}>
              <div><p className="text-[#191970] font-medium">{s.name}</p><p className="text-xs text-[#800020]">{s.className || s.classId || '—'}</p></div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold ${statusColor(records[s.id] || 'Unmarked')}`}>{records[s.id] || 'Unmarked'}</span>
              </div>
            </div>))}
          </div>}
      </div>
    </div>
  );
}

function MonthlyReportTab({ month }) {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    getAttendanceMonthlyReport({ month })
      .then(result => {
        if (!cancelled) {
          setReport(result?.report || null);
        }
      })
      .catch(loadError => {
        if (!cancelled) {
          setError(loadError.message || 'Could not load the monthly attendance report.');
          setReport(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [month]);

  const recognitions = report?.recognitions || [];
  const amiAwards = report?.amiAwards || [];
  const birthdays = report?.birthdays || [];
  const atRiskStudents = report?.atRiskStudents || [];
  const lateStaff = report?.lateStaff || [];

  return (
    <div className="space-y-4">
      <div className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#800000]">Monthly Attendance & Recognition</h2>
            <p className="mt-1 text-sm text-[#191970]">Leadership summary for {formatMonthLabel(month)} with birthdays, punctuality, activity, and risk tracking.</p>
          </div>
          <span className="rounded-full bg-[#800020] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#f5deb3]">{formatMonthLabel(month)}</span>
        </div>
      </div>

      {loading ? <div className={CARD}><p className="text-sm text-[#800020]">Loading monthly report…</p></div> : null}
      {error ? <div className={CARD}><p className="text-sm text-[#800000]">{error}</p></div> : null}

      {!loading && !error && report ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Student Attendance" value={`${Math.round(report?.studentSummary?.attendanceRate || 0)}%`} accent="text-[#1a5c38]" />
            <MetricCard label="Weekly Snapshot" value={`${Math.round(report?.studentSummary?.weeklyAttendanceRate || 0)}%`} accent="text-[#191970]" />
            <MetricCard label="Staff Attendance" value={`${Math.round(report?.staffSummary?.attendanceRate || 0)}%`} accent="text-[#800000]" />
            <MetricCard label="At-Risk Students" value={report?.studentSummary?.atRiskCount || 0} accent="text-amber-700" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={CARD}>
              <h3 className="text-lg font-bold text-[#800000] mb-3">Automatic School Recognition</h3>
              <p className="mb-3 text-sm text-[#191970]">Birthdays, attendance, and punctuality highlights here are generated directly from this school&apos;s records.</p>
              <div className="space-y-3">
                {recognitions.length ? recognitions.map(item => (
                  <RecognitionCard
                    key={item.key}
                    title={item.title}
                    description={item.description}
                    recipient={item.recipient}
                    badge="School"
                  />
                )) : <p className="text-sm text-[#800020]">No calculated recognitions yet for this month.</p>}
              </div>
            </div>

            <div className={CARD}>
              <h3 className="text-lg font-bold text-[#800000] mb-3">Optional AMI Spotlight Awards</h3>
              <p className="mb-3 text-sm text-[#191970]">These awards are separate from the school&apos;s automatic attendance and birthday recognitions.</p>
              <div className="space-y-3">
                {amiAwards.length ? amiAwards.map(item => (
                  <RecognitionCard
                    key={item.id}
                    title={item.awardTitle}
                    description={item.description || 'Award attached by AMI for this school.'}
                    recipient={item.recipient}
                    badge="AMI"
                  />
                )) : <p className="text-sm text-[#800020]">No AMI awards attached for this month.</p>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className={CARD}>
              <h3 className="text-lg font-bold text-[#800000] mb-3">School Birthdays</h3>
              <p className="mb-3 text-sm text-[#191970]">Automatically gathered from learner and staff birth records inside this school.</p>
              <div className="space-y-3">
                {birthdays.length ? birthdays.map(person => (
                  <div key={`${person.userId}-${person.birthdayDate}`} className={`${INNER} flex items-center gap-3`}>
                    <img src={buildAvatarSrc(person)} alt={person.name} className="h-12 w-12 rounded-2xl object-cover border border-[#c9a96e]/40 bg-white" />
                    <div className="min-w-0">
                      <p className="font-semibold text-[#191970]">{person.name}</p>
                      <p className="text-xs uppercase tracking-wide text-[#800020]">{person.role || 'user'} • {person.birthdayLabel}</p>
                      {person.ageTurning ? <p className="text-xs text-[#191970]">Turning {person.ageTurning}</p> : null}
                    </div>
                  </div>
                )) : <p className="text-sm text-[#800020]">No birthdays are recorded for this month yet.</p>}
              </div>
            </div>

            <div className={CARD}>
              <h3 className="text-lg font-bold text-[#800000] mb-3">At-Risk Students</h3>
              <div className="space-y-3">
                {atRiskStudents.length ? atRiskStudents.map(student => (
                  <div key={student.userId} className={INNER}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#191970]">{student.name}</p>
                        <p className="text-xs uppercase tracking-wide text-[#800020]">{student.role || 'student'}</p>
                      </div>
                      <span className="text-sm font-bold text-red-700">{Math.round(student.attendanceRate)}%</span>
                    </div>
                    <p className="mt-2 text-xs text-[#191970]">Present: {student.presentCount} • Late: {student.lateCount} • Absent: {student.absentCount}</p>
                  </div>
                )) : <p className="text-sm text-[#800020]">No students are below the 75% attendance threshold this month.</p>}
              </div>
            </div>

            <div className={CARD}>
              <h3 className="text-lg font-bold text-[#800000] mb-3">Late Staff Watch</h3>
              <div className="space-y-3">
                {lateStaff.length ? lateStaff.map(staffMember => (
                  <div key={staffMember.userId} className={INNER}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#191970]">{staffMember.name}</p>
                        <p className="text-xs uppercase tracking-wide text-[#800020]">{staffMember.role || 'staff'}</p>
                      </div>
                      <span className="text-sm font-bold text-amber-700">{staffMember.lateCount} late</span>
                    </div>
                    <p className="mt-2 text-xs text-[#191970]">Minutes lost: {staffMember.lateMinutes} • Charges: ₦{Number(staffMember.lateCharges || 0).toLocaleString()}</p>
                  </div>
                )) : <p className="text-sm text-[#800020]">No late staff entries were recorded this month.</p>}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function AIAttendanceTab({ month }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setResult(null);
    setError('');
  }, [month]);

  async function analyse() {
    setLoading(true); setResult(null); setError('');
    try { const r = await runAttendanceAI({ month }); setResult(r?.analysis || r); }
    catch (e) { setError(e.message || 'Analysis failed.'); } finally { setLoading(false); }
  }
  return (
    <div className="space-y-4">
      <div className={CARD}><h2 className="text-lg font-bold text-[#800000] mb-2">AI Attendance Analysis</h2>
        <p className="text-[#191970] text-sm mb-4">Get month-specific attendance coaching, recognition prompts, and risk signals for {formatMonthLabel(month)}.</p>
        <button onClick={analyse} disabled={loading} className={BTN}>{loading ? 'Analysing…' : '✦ Analyse Attendance'}</button>
      </div>
      {loading && <div className={CARD}><div className="flex items-center gap-3"><div className="w-5 h-5 border-2 border-[#800020] border-t-transparent rounded-full animate-spin" /><p className="text-[#191970] text-sm">Analysing attendance data…</p></div></div>}
      {error && <div className={CARD}><p className="text-[#800000] text-sm">{error.includes('AI') || error.includes('key') ? 'AI analysis requires configuration. Please contact Ndovera support.' : error}</p></div>}
      {result && <div className="space-y-4">
        {result.weeklyRate && <div className={CARD}><p className="text-xs text-[#800020] uppercase font-semibold">This Week</p><p className="text-2xl font-bold text-[#1a5c38] mt-1">{result.weeklyRate}</p></div>}
        {result.monthlyRate && <div className={CARD}><p className="text-xs text-[#800020] uppercase font-semibold">This Month</p><p className="text-2xl font-bold text-[#800000] mt-1">{result.monthlyRate}</p></div>}
        {result.atRiskStudents?.length > 0 && <div className={CARD}><h3 className="font-bold text-[#800000] mb-3">At-Risk Students (below 75%)</h3><div className="space-y-2">{result.atRiskStudents.map((s, i) => <div key={i} className={`${INNER} text-[#191970] text-sm`}>{s}</div>)}</div></div>}
        {result.teacherPatterns ? <div className={CARD}><h3 className="font-bold text-[#800000] mb-3">Teacher Pattern</h3><div className={`${INNER} text-[#191970] text-sm`}>{result.teacherPatterns}</div></div> : null}
        {result.suggestions?.length > 0 && <div className={CARD}><h3 className="font-bold text-[#800000] mb-3">Suggestions</h3><ul className="space-y-2">{result.suggestions.map((s, i) => <li key={i} className={`${INNER} text-[#191970] text-sm flex items-start gap-2`}><span className="text-[#1a5c38] font-bold mt-0.5">→</span>{s}</li>)}</ul></div>}
        {result.report?.recognitions?.length > 0 ? <div className={CARD}><h3 className="font-bold text-[#800000] mb-3">Recognition Signals</h3><div className="space-y-2">{result.report.recognitions.map(item => <div key={item.key} className={`${INNER} text-[#191970] text-sm`}><span className="font-semibold text-[#800000]">{item.title}:</span> {item.recipient?.name}</div>)}</div></div> : null}
      </div>}
    </div>
  );
}

export default function OwnerAttendance({ auth }) {
  const [tab, setTab] = useState(0);
  const [month, setMonth] = useState(CURRENT_MONTH);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="rounded-3xl p-6 bg-[#f5deb3] border border-[#c9a96e]/40">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#800000]">Attendance</h1>
            <p className="text-[#191970] mt-1 text-sm">Manage staff and student attendance, monthly celebrations, and AI leadership insights.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#800020]">Report Month</label>
            <input type="month" value={month} onChange={e => setMonth(e.target.value || CURRENT_MONTH)} className="rounded-xl border border-[#c9a96e]/40 p-2 text-[#191970] text-sm" />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">{TABS.map((t, i) => <button key={t} onClick={() => setTab(i)} className={`px-5 py-2 rounded-2xl text-sm font-semibold transition-colors ${tab === i ? 'bg-[#800020] text-[#f5deb3]' : 'bg-[#f5deb3] text-[#800020] border border-[#c9a96e]/40 hover:bg-[#f0d090]'}`}>{t}</button>)}</div>
      {tab === 0 && <StaffAttendanceTab />}
      {tab === 1 && <StudentAttendanceTab />}
      {tab === 2 && <SchoolCalendarBoard />}
      {tab === 3 && <TimetableBoard />}
      {tab === 4 && <MonthlyReportTab month={month} />}
      {tab === 5 && <AIAttendanceTab month={month} />}
    </div>
  );
}
