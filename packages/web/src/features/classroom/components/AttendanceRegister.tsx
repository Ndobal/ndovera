import React, { useState } from 'react';
import { User, Check, X, Clock, AlertCircle, Save, Calculator, ClipboardList } from 'lucide-react';
import { Role } from '../subject/types';

// Mock Data
const MOCK_STUDENTS = [
  { id: '1', name: 'Adewale Johnson', regNo: '001' },
  { id: '2', name: 'Chioma Okonkwo', regNo: '002' },
  { id: '3', name: 'Emeka Obi', regNo: '003' },
  { id: '4', name: 'Fatima Yusuf', regNo: '004' },
  { id: '5', name: 'Grace Oladipo', regNo: '005' },
  { id: '6', name: 'Hassan Bello', regNo: '006' },
  { id: '7', name: 'Ibrahim Sani', regNo: '007' },
  { id: '8', name: 'Joy Eke', regNo: '008' },
];

type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused';

interface AttendanceRecord {
  studentId: string;
  morning: AttendanceStatus;
  afternoon: AttendanceStatus;
}

export function AttendanceRegister({ role }: { role: Role }) {
  const [attendance, setAttendance] = useState<Record<string, { morning: AttendanceStatus; afternoon: AttendanceStatus }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize with Present if empty? Or leave blank. Let's leave blank to force selection or default to present?
  // Usually registers default to Present for ease.
  // extending state initialization
  useState(() => {
    const initial: any = {};
    MOCK_STUDENTS.forEach(s => {
      initial[s.id] = { morning: 'Present', afternoon: 'Present' };
    });
    setAttendance(initial);
  });

  const handleCreateInitialState = () => {
      const initial: any = {};
      MOCK_STUDENTS.forEach(s => {
        initial[s.id] = { morning: 'Present', afternoon: 'Present' };
      });
      setAttendance(initial);
  }
  // Effect to populate initial state if empty
  React.useEffect(() => {
      if (Object.keys(attendance).length === 0) {
          handleCreateInitialState();
      }
  }, []);


  const handleMark = (studentId: string, session: 'morning' | 'afternoon', status: AttendanceStatus) => {
    setAttendance(prev =>({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [session]: status
      }
    }));
  };

  const calculateWeeklyStats = () => {
    // Mock calculation based on current state (assuming this state represents a day, and we project for a week or this is the accumulation)
    // The requirement says "weekly calculation under the last students". 
    // This implies summarizing the week's attendance for the class. 
    // Since we only have one day's data here, we'll simulate "Year to Date" or "Week to Date" stats.
    
    const stats = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0
    };

    Object.values(attendance).forEach(record => {
      // Couny morning
      if (record.morning === 'Present') stats.present++;
      else if (record.morning === 'Absent') stats.absent++;
      else if (record.morning === 'Late') stats.late++;
      else if (record.morning === 'Excused') stats.excused++;

      // Count afternoon
      if (record.afternoon === 'Present') stats.present++;
      else if (record.afternoon === 'Absent') stats.absent++;
      else if (record.afternoon === 'Late') stats.late++;
      else if (record.afternoon === 'Excused') stats.excused++;
    });

    return stats;
  };

  const stats = calculateWeeklyStats();
  const totalSlots = MOCK_STUDENTS.length * 2; // Morning + Afternoon
  const attendancePercentage = Math.round(((stats.present + stats.late) / totalSlots) * 100) || 0;

  return (
    <div className="space-y-6 p-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-emerald-600" />
            Class Attendance Register
          </h2>
          <p className="text-sm text-slate-500 mt-1">Mark morning and afternoon roll call for today.</p>
        </div>
        <div className="flex gap-2">
            <button 
              onClick={() => setIsSubmitting(true)}
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Submit Register'}
              <Save className="w-4 h-4" />
            </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-semibold text-slate-700 w-16">S/N</th>
              <th className="px-6 py-4 font-semibold text-slate-700 min-w-50">Student Name</th>
              <th className="px-6 py-4 font-semibold text-center text-slate-700 min-w-75 border-l border-slate-200 bg-orange-50/50">
                Morning Session
                <div className="flex justify-center gap-4 mt-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                  <span className="w-6">All</span>
                  <span className="w-6">P</span>
                  <span className="w-6">A</span>
                  <span className="w-6">L</span>
                  <span className="w-6">E</span>
                </div>
              </th>
              <th className="px-6 py-4 font-semibold text-center text-slate-700 min-w-75 border-l border-slate-200 bg-blue-50/50">
                Afternoon Session
                <div className="flex justify-center gap-4 mt-2 text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                   <span className="w-6">All</span>
                  <span className="w-6">P</span>
                  <span className="w-6">A</span>
                  <span className="w-6">L</span>
                  <span className="w-6">E</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {MOCK_STUDENTS.map((student, index) => (
              <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 text-slate-500 font-medium">{index + 1}</td>
                <td className="px-6 py-4 font-medium text-slate-900">
                  {student.name}
                  <div className="text-xs text-slate-400 font-normal">Reg: {student.regNo}</div>
                </td>
                
                {/* Morning Session */}
                <td className="px-6 py-4 text-center border-l border-slate-200 bg-orange-50/10">
                  <div className="flex items-center justify-center gap-4">
                    <div className="w-6"></div> {/* Spacer for 'All' alignment */}
                    {(['Present', 'Absent', 'Late', 'Excused'] as const).map(status => (
                      <label key={status} className="cursor-pointer group relative">
                        <input
                          type="radio"
                          name={`morning-${student.id}`}
                          checked={attendance[student.id]?.morning === status}
                          onChange={() => handleMark(student.id, 'morning', status)}
                          className="peer sr-only"
                        />
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all
                          ${status === 'Present' ? 'peer-checked:bg-emerald-500 peer-checked:border-emerald-600 peer-checked:text-white border-slate-200 text-slate-300' : ''}
                          ${status === 'Absent' ? 'peer-checked:bg-rose-500 peer-checked:border-rose-600 peer-checked:text-white border-slate-200 text-slate-300' : ''}
                          ${status === 'Late' ? 'peer-checked:bg-amber-400 peer-checked:border-amber-500 peer-checked:text-white border-slate-200 text-slate-300' : ''}
                          ${status === 'Excused' ? 'peer-checked:bg-blue-500 peer-checked:border-blue-600 peer-checked:text-white border-slate-200 text-slate-300' : ''}
                          hover:bg-slate-100
                        `}>
                           {status === 'Present' && <Check size={14} strokeWidth={3} />}
                           {status === 'Absent' && <X size={14} strokeWidth={3} />}
                           {status === 'Late' && <Clock size={14} strokeWidth={3} />}
                           {status === 'Excused' && <AlertCircle size={14} strokeWidth={3} />}
                        </div>
                        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          {status}
                        </span>
                      </label>
                    ))}
                  </div>
                </td>

                {/* Afternoon Session */}
                <td className="px-6 py-4 text-center border-l border-slate-200 bg-blue-50/10">
                   <div className="flex items-center justify-center gap-4">
                    <div className="w-6"></div> {/* Spacer for 'All' alignment */}
                    {(['Present', 'Absent', 'Late', 'Excused'] as const).map(status => (
                      <label key={status} className="cursor-pointer group relative">
                        <input
                          type="radio"
                          name={`afternoon-${student.id}`}
                          checked={attendance[student.id]?.afternoon === status}
                          onChange={() => handleMark(student.id, 'afternoon', status)}
                          className="peer sr-only"
                        />
                         <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all
                          ${status === 'Present' ? 'peer-checked:bg-emerald-500 peer-checked:border-emerald-600 peer-checked:text-white border-slate-200 text-slate-300' : ''}
                          ${status === 'Absent' ? 'peer-checked:bg-rose-500 peer-checked:border-rose-600 peer-checked:text-white border-slate-200 text-slate-300' : ''}
                          ${status === 'Late' ? 'peer-checked:bg-amber-400 peer-checked:border-amber-500 peer-checked:text-white border-slate-200 text-slate-300' : ''}
                          ${status === 'Excused' ? 'peer-checked:bg-blue-500 peer-checked:border-blue-600 peer-checked:text-white border-slate-200 text-slate-300' : ''}
                          hover:bg-slate-100
                        `}>
                           {status === 'Present' && <Check size={14} strokeWidth={3} />}
                           {status === 'Absent' && <X size={14} strokeWidth={3} />}
                           {status === 'Late' && <Clock size={14} strokeWidth={3} />}
                           {status === 'Excused' && <AlertCircle size={14} strokeWidth={3} />}
                        </div>
                        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          {status}
                        </span>
                      </label>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Weekly Calculation / Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <Check size={20} />
              </div>
              <div>
                  <div className="text-2xl font-bold text-emerald-900">{stats.present}</div>
                  <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Present</div>
              </div>
          </div>
          <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                  <X size={20} />
              </div>
              <div>
                  <div className="text-2xl font-bold text-rose-900">{stats.absent}</div>
                  <div className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Absent</div>
              </div>
          </div>
          <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                  <Clock size={20} />
              </div>
              <div>
                  <div className="text-2xl font-bold text-amber-900">{stats.late}</div>
                  <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Late</div>
              </div>
          </div>
          <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <Calculator size={20} />
                </div>
                <div>
                    <div className="text-2xl font-bold text-blue-900">{attendancePercentage}%</div>
                    <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Weekly Rate</div>
                </div>
              </div>
              {attendancePercentage < 75 && (
                  <div className="text-xs font-bold text-rose-600 bg-rose-100 px-2 py-1 rounded">Low Attendance</div>
              )}
          </div>
      </div>
    </div>
  );
}


