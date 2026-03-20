import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Check, X, Clock, UserCheck } from 'lucide-react';

const mockStudents = [
  { id: 'stu_01', name: 'Adekunle Gold' },
  { id: 'stu_02', name: 'Bisi Adebayo' },
  { id: 'stu_03', name: 'Chinedu Okoro' },
  { id: 'stu_04', name: 'Damilola Adeyemi' },
  { id: 'stu_05', name: 'Emeka Nwosu' },
  { id: 'stu_06', name: 'Fatima Bello' },
  { id: 'stu_07', name: 'Gbenga Adekunle' },
  { id: 'stu_08', name: 'Habiba Ibrahim' },
];

enum AttendanceStatus {
  PRESENT = 'Present',
  ABSENT = 'Absent',
  LATE = 'Late',
  EXCUSED = 'Excused',
  UNMARKED = 'Unmarked',
}

const AttendanceButton = ({ status, currentStatus, setStatus }) => {
  const isActive = status === currentStatus;
  const styles = {
    [AttendanceStatus.PRESENT]: `bg-emerald-500/10 text-emerald-400 ${isActive ? 'ring-2 ring-emerald-500' : ''}`,
    [AttendanceStatus.ABSENT]: `bg-rose-500/10 text-rose-400 ${isActive ? 'ring-2 ring-rose-500' : ''}`,
    [AttendanceStatus.LATE]: `bg-amber-500/10 text-amber-400 ${isActive ? 'ring-2 ring-amber-500' : ''}`,
    [AttendanceStatus.EXCUSED]: `bg-indigo-500/10 text-indigo-400 ${isActive ? 'ring-2 ring-indigo-500' : ''}`,
  };
  const icons = {
    [AttendanceStatus.PRESENT]: <Check className="w-4 h-4" />,
    [AttendanceStatus.ABSENT]: <X className="w-4 h-4" />,
    [AttendanceStatus.LATE]: <Clock className="w-4 h-4" />,
    [AttendanceStatus.EXCUSED]: <UserCheck className="w-4 h-4" />,
  };

  return (
    <button 
      onClick={() => setStatus(status)}
      className={`flex items-center justify-center gap-2 w-24 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${styles[status]} hover:ring-2`}>
      {icons[status]}
      {status}
    </button>
  );
};

export default function AttendanceModule({ role }) {
  const [attendance, setAttendance] = useState({});

  const setStudentStatus = (studentId, status) => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const summary = {
    present: Object.values(attendance).filter(s => s === AttendanceStatus.PRESENT).length,
    absent: Object.values(attendance).filter(s => s === AttendanceStatus.ABSENT).length,
    late: Object.values(attendance).filter(s => s === AttendanceStatus.LATE).length,
  };

  return (
    <div>
        <header className="flex items-center justify-between mb-8">
            <div>
                <h1 className="text-2xl font-bold text-slate-100">Class Attendance</h1>
                <p className="text-sm text-slate-400">SS3, Second Term - Mathematics</p>
            </div>
            <div className="flex items-center gap-2 p-1 bg-slate-800 rounded-lg">
                <button className="p-2 rounded-md hover:bg-slate-700"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-sm font-bold text-slate-200 px-4">Feb 26, 2026</span>
                <button className="p-2 rounded-md hover:bg-slate-700"><ChevronRight className="w-4 h-4" /></button>
            </div>
        </header>

        <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
                <p className="text-3xl font-bold text-emerald-400">{summary.present}</p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Present</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
                <p className="text-3xl font-bold text-rose-400">{summary.absent}</p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Absent</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
                <p className="text-3xl font-bold text-amber-400">{summary.late}</p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Late</p>
            </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="p-4 border-b border-slate-800">
                <h3 className="font-bold text-slate-100">Student List</h3>
            </div>
            <table className="w-full">
                <tbody className="divide-y divide-slate-800">
                    {mockStudents.map(student => (
                        <tr key={student.id}>
                            <td className="p-4 text-sm font-medium text-slate-200">{student.name}</td>
                            <td className="p-4">
                                <div className="flex items-center gap-2">
                                    <AttendanceButton status={AttendanceStatus.PRESENT} currentStatus={attendance[student.id]} setStatus={(status) => setStudentStatus(student.id, status)} />
                                    <AttendanceButton status={AttendanceStatus.ABSENT} currentStatus={attendance[student.id]} setStatus={(status) => setStudentStatus(student.id, status)} />
                                    <AttendanceButton status={AttendanceStatus.LATE} currentStatus={attendance[student.id]} setStatus={(status) => setStudentStatus(student.id, status)} />
                                    <AttendanceButton status={AttendanceStatus.EXCUSED} currentStatus={attendance[student.id]} setStatus={(status) => setStudentStatus(student.id, status)} />
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
  );
}
