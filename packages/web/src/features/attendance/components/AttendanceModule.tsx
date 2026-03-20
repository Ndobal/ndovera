import StaffAttendance from './StaffAttendance';
import ParentAttendance from './ParentAttendance';
import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, Clock3, School, ShieldCheck, TriangleAlert, Users, X, AlertCircle } from 'lucide-react';

import { teacherAttendanceRegister, teacherAttendanceSettings } from '../../classroom/data/classroomExperience';
import { fetchWithAuth } from '../../../services/apiClient';

type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused';
type AttendanceState = Record<string, { morning: AttendanceStatus; afternoon: AttendanceStatus }>;
type AttendanceStudent = {
  id: string;
  name: string;
  roll: string;
  risk: string;
  status: AttendanceStatus;
  classId?: string;
  className?: string;
};

const statusPalette: Record<string, string> = {
  Present: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Absent: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  Late: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Excused: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

const riskPalette: Record<string, string> = {
  Normal: 'text-emerald-400',
  Watchlist: 'text-amber-400',
  'At Risk': 'text-rose-400',
};

function StudentAttendance({ role }: { role?: string }) {
  const [mode, setMode] = useState<'Class-wide' | 'Subject-specific'>('Class-wide');
  const [selectedClass, setSelectedClass] = useState('JSS 1 Gold');
  const [selectedSubject, setSelectedSubject] = useState('Integrated Classroom');
  const [register, setRegister] = useState<AttendanceStudent[]>(teacherAttendanceRegister.map((student) => ({
    ...student,
    status: student.status as AttendanceStatus,
  })));
  const [attendance, setAttendance] = useState<AttendanceState>(() =>
    Object.fromEntries(teacherAttendanceRegister.map((student) => [student.id, { morning: student.status as AttendanceStatus, afternoon: student.status as AttendanceStatus }])),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const canExport = role === 'HOS' || role === 'HoS' || role === 'Owner' || role === 'ICT Manager';

  useEffect(() => {
    let mounted = true;
    const loadStudents = async () => {
      try {
        const students = await fetchWithAuth('/api/students');
        if (!mounted || !Array.isArray(students) || !students.length) return;
        const mapped = students.map((student: any, index: number) => ({
          id: student.id,
          name: student.name,
          roll: String(index + 1).padStart(3, '0'),
          risk: teacherAttendanceRegister[index]?.risk || 'Normal',
          status: (teacherAttendanceRegister[index]?.status as AttendanceStatus) || 'Present',
          classId: student.class_id,
          className: student.class_name,
        }));
        setRegister(mapped);
        setSelectedClass((current) => {
          const available = mapped.map((student: AttendanceStudent) => student.className).filter(Boolean);
          return available.includes(current) ? current : available[0] || current;
        });
        setAttendance((current) => {
          const next: AttendanceState = {};
          mapped.forEach((student: AttendanceStudent) => {
            next[student.id] = current[student.id] || { morning: student.status, afternoon: student.status };
          });
          return next;
        });
      } catch {
        // keep fallback register when live students are unavailable
      }
    };

    loadStudents();
    return () => {
      mounted = false;
    };
  }, []);

  const visibleRegister = useMemo(() => {
    const filtered = register.filter((student) => !student.className || student.className === selectedClass);
    return filtered.length ? filtered : register;
  }, [register, selectedClass]);

  const classOptions = useMemo(() => {
    const liveOptions = Array.from(new Set(register.map((student) => student.className).filter(Boolean))) as string[];
    return liveOptions.length ? liveOptions : ['JSS 1 Gold', 'JSS 2 Blue', 'SS 1 Science'];
  }, [register]);

  const summary = useMemo(() => {
    const values = visibleRegister.flatMap((student) => {
      const value = attendance[student.id];
      return value ? [value.morning, value.afternoon] : [];
    });
    return {
      present: values.filter((value) => value === 'Present').length,
      absent: values.filter((value) => value === 'Absent').length,
      late: values.filter((value) => value === 'Late').length,
      excused: values.filter((value) => value === 'Excused').length,
    };
  }, [attendance]);

  const canSwitchMode = role === 'School Admin' || role === 'HOS' || role === 'HoS' || role === 'Teacher' || role === 'Super Admin';

  const handleMark = (studentId: string, session: 'morning' | 'afternoon', status: AttendanceStatus) => {
    setAttendance((current) => ({
      ...current,
      [studentId]: {
        ...current[studentId],
        [session]: status,
      },
    }));
  };

  const submitRegister = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitMessage(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const records = visibleRegister.map((student) => ({
        student_id: student.id,
        class_id: student.classId || selectedClass,
        date: today,
        morningStatus: attendance[student.id]?.morning || 'Present',
        afternoonStatus: attendance[student.id]?.afternoon || 'Present',
      }));
      await fetchWithAuth('/api/attendance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ records }),
      });
      setSubmitMessage('Attendance register submitted successfully.');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to submit attendance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusIcons: Record<AttendanceStatus, React.ReactNode> = {
    Present: <Check className="h-3.5 w-3.5" />,
    Absent: <X className="h-3.5 w-3.5" />,
    Late: <Clock3 className="h-3.5 w-3.5" />,
    Excused: <AlertCircle className="h-3.5 w-3.5" />,
  };

  return (
    <div className="space-y-6">
      <section className="card-compact">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-500">Attendance engine</p>
            <h2 className="mt-2 text-xl font-bold text-white">Class-first attendance with optional subject mode</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-400">
              Attendance is taken per class by default. Subject-specific attendance is only used when the school decides to enable it.
              All teachers may mark attendance if the school grants school-wide attendance rights, while class teachers retain review and override powers.
            </p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-xs text-zinc-400">
            <p className="font-bold uppercase tracking-wider text-white">Policy</p>
            <p className="mt-2">{teacherAttendanceSettings.policy}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        <div className="card-mini flex items-center gap-3">
          <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Present</p>
            <p className="text-base font-mono font-bold text-white">{summary.present}</p>
          </div>
        </div>
        <div className="card-mini flex items-center gap-3">
          <div className="rounded-xl bg-rose-500/10 p-2 text-rose-400">
            <TriangleAlert className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Absent</p>
            <p className="text-base font-mono font-bold text-white">{summary.absent}</p>
          </div>
        </div>
        <div className="card-mini flex items-center gap-3">
          <div className="rounded-xl bg-amber-500/10 p-2 text-amber-400">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Late</p>
            <p className="text-base font-mono font-bold text-white">{summary.late}</p>
          </div>
        </div>
        <div className="card-mini flex items-center gap-3">
          <div className="rounded-xl bg-blue-500/10 p-2 text-blue-400">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Excused</p>
            <p className="text-base font-mono font-bold text-white">{summary.excused}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="card-compact">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                Attendance mode
                <select
                  value={mode}
                  onChange={(event) => setMode(event.target.value as 'Class-wide' | 'Subject-specific')}
                  disabled={!canSwitchMode}
                  className="mt-2 w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                >
                  <option>Class-wide</option>
                  <option>Subject-specific</option>
                </select>
              </label>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                Class
                <select
                  value={selectedClass}
                  onChange={(event) => setSelectedClass(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                >
                  {classOptions.map((className) => (
                    <option key={className}>{className}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                Subject scope
                <select
                  value={selectedSubject}
                  onChange={(event) => setSelectedSubject(event.target.value)}
                  disabled={mode === 'Class-wide'}
                  className="mt-2 w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option>Integrated Classroom</option>
                  <option>Mathematics</option>
                  <option>English Language</option>
                  <option>Biology</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-xl border border-white/5 bg-white/5 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-300 transition-all hover:bg-white/10">
                Save draft
              </button>
              <button type="button" onClick={submitRegister} disabled={isSubmitting} className="rounded-xl bg-emerald-600 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70">
                {isSubmitting ? 'Submitting…' : 'Submit register'}
              </button>
            </div>
          </div>

          {submitMessage ? <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{submitMessage}</div> : null}
          {submitError ? <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{submitError}</div> : null}

          <div className="mt-5 overflow-hidden rounded-2xl border border-white/5">
            <table className="w-full text-left">
              <thead className="bg-white/5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Roll</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3">Morning</th>
                  <th className="px-4 py-3">Afternoon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-transparent">
                {visibleRegister.map((student) => (
                  <tr key={student.id} className="align-top">
                    <td className="px-4 py-4 text-xs font-mono text-zinc-500">{student.roll}</td>
                    <td className="px-4 py-4">
                      <p className="text-sm font-semibold text-white">{student.name}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-widest text-zinc-500">{selectedClass}</p>
                    </td>
                    <td className={`px-4 py-4 text-xs font-bold uppercase tracking-wider ${riskPalette[student.risk]}`}>
                      {student.risk}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {(Object.keys(statusPalette) as AttendanceStatus[]).map((status) => (
                          <button
                            key={`${student.id}_morning_${status}`}
                            type="button"
                            onClick={() => handleMark(student.id, 'morning', status)}
                            className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${statusPalette[status]} ${attendance[student.id]?.morning === status ? 'ring-2 ring-white/40' : 'opacity-80 hover:opacity-100'}`}
                          >
                            <span className="inline-flex items-center gap-1">{statusIcons[status]} {status}</span>
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {(Object.keys(statusPalette) as AttendanceStatus[]).map((status) => (
                          <button
                            key={`${student.id}_afternoon_${status}`}
                            type="button"
                            onClick={() => handleMark(student.id, 'afternoon', status)}
                            className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${statusPalette[status]} ${attendance[student.id]?.afternoon === status ? 'ring-2 ring-white/40' : 'opacity-80 hover:opacity-100'}`}
                          >
                            <span className="inline-flex items-center gap-1">{statusIcons[status]} {status}</span>
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card-compact">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <School className="h-4 w-4 text-emerald-500" />
              Engine settings
            </div>
            <p className="mt-3 text-sm text-zinc-400">{teacherAttendanceSettings.schoolChoice}</p>
            <ul className="mt-4 space-y-2 text-xs text-zinc-400">
              {teacherAttendanceSettings.alerts.map((alert) => (
                <li key={alert}>• {alert}</li>
              ))}
            </ul>
          </div>

          <div className="card-compact">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <TriangleAlert className="h-4 w-4 text-amber-400" />
              At-risk watch
            </div>
            <div className="mt-3 space-y-3">
              {visibleRegister.filter((student) => student.risk !== 'Normal').map((student) => (
                <div key={`risk_${student.id}`} className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-sm text-zinc-300">
                  <p className="font-semibold text-white">{student.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-zinc-500">{student.risk}</p>
                  <p className="mt-2 text-xs text-zinc-400">Escalate if absence or lateness continues for three or more records.</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card-compact bg-emerald-600/5 border-emerald-500/10">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
              Archive and export
            </div>
            <p className="mt-3 text-sm text-zinc-400">
              {canExport
                ? 'Export access is enabled for this role. Use HoS, Owner, or ICT Manager access for attendance exports and audit review.'
                : 'Students, teachers, and parents cannot print or export attendance records. Only HoS, Owner, or ICT Manager can export attendance records.'}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}


export default function AttendanceModule({ role }: { role?: string }) {
  const [activeTab, setActiveTab] = useState('student');

  return (
    <div className="space-y-6">
      <div className="flex space-x-4 border-b border-slate-700/50">
        <button
          onClick={() => setActiveTab('student')}
          className={`pb-2 px-1 ${activeTab === 'student' ? 'border-b-2 border-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          Student Attendance
        </button>
        {role !== 'Student' && role !== 'Parent' && (
          <>
            <button
              onClick={() => setActiveTab('staff')}
              className={`pb-2 px-1 ${activeTab === 'staff' ? 'border-b-2 border-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Staff Attendance
            </button>
            <button
              onClick={() => setActiveTab('parent')}
              className={`pb-2 px-1 ${activeTab === 'parent' ? 'border-b-2 border-indigo-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Parent Attendance
            </button>
          </>
        )}
      </div>

      {activeTab === 'student' && <StudentAttendance role={role} />}
      {activeTab === 'staff' && <StaffAttendance role={role} />}
      {activeTab === 'parent' && <ParentAttendance />}
    </div>
  );
}
