import { useState, useMemo, useEffect } from 'react';
import { Printer, Sparkles, AlertTriangle, ShieldCheck, Settings, BookOpen, Clock, User, RefreshCw, Wrench, Plus, Trash2, Lock, Unlock } from 'lucide-react';

type Section = 'Primary' | 'Secondary';
type Day = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
type TimeSlot = string;

interface ClassData {
  id: string;
  name: string;
}

interface AssignedSlot {
  subject: string;
  teacher: string;
  isClash?: boolean;
}

// A nested map: Day -> TimeSlot -> ClassId -> AssignedSlot
type TimetableStore = Record<Day, Record<string, Record<string, AssignedSlot>>>;

const DAYS: Day[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const PRIMARY_CLASSES: ClassData[] = [
  { id: 'p1', name: 'Basic 1' },
  { id: 'p2', name: 'Basic 2' },
  { id: 'p3', name: 'Basic 3' },
];

const SECONDARY_CLASSES: ClassData[] = [
  { id: 'j1', name: 'JSS 1' },
  { id: 'j2', name: 'JSS 2' },
  { id: 's1', name: 'SS 1' },
];

const AVAILABLE_SUBJECTS = [
  { sub: 'Mathematics', teacher: 'Mr. John' },
  { sub: 'English', teacher: 'Mrs. Sarah' },
  { sub: 'Basic Science', teacher: 'Dr. Mike' },
  { sub: 'Social Studies', teacher: 'Mr. David' },
  { sub: 'P.E', teacher: 'Coach Emma' },
  { sub: 'Computer', teacher: 'Miss Jane' },
  { sub: 'Agric', teacher: 'Mr. Paul' },
  { sub: 'Civic', teacher: 'Mrs. Mary' }
];

type AdvancedRule = {
  id: number;
  type: 'pinned' | 'periods_per_week';
  subject: string;
  day?: Day;
  count?: number;
};

export function TimetableStudio({ role = 'School Admin' }: { role?: string }) {
  const [activeSection, setActiveSection] = useState<Section>('Secondary');
  const [timetable, setTimetable] = useState<TimetableStore>({} as TimetableStore);
  const [isGenerating, setIsGenerating] = useState(false);
  const [clashCount, setClashCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  const [showRules, setShowRules] = useState(false);
  const [rules, setRules] = useState({
    periodsPerDay: 8,
    includeWeekends: false,
    maxConsecutivePeriodsForTeacher: 3,
    startTime: '08:00',
    periodDuration: 40,
    morningDrill: 0,
    assembly: 0,
    rollCall: 0,
    breaks: [
      { id: 1, afterPeriod: 3, duration: 30, name: 'Break' },
      { id: 2, afterPeriod: 6, duration: 30, name: 'Break 2' }
    ]
  });

  const TIME_SLOTS = useMemo(() => {
    let currentMins = (() => {
      const [h, m] = rules.startTime.split(':').map(Number);
      return h * 60 + m;
    })();

    const formatTime = (mins: number) => {
      const h = Math.floor(mins / 60) % 24;
      const m = mins % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const slots: string[] = [];
    const addSlot = (dur: number, label: string) => {
      if (dur <= 0) return;
      const startStr = formatTime(currentMins);
      currentMins += dur;
      const endStr = formatTime(currentMins);
      slots.push(`${startStr} - ${endStr}${label ? ` (${label})` : ''}`);
    };

    addSlot(rules.morningDrill, 'Morning Drill');
    addSlot(rules.assembly, 'Assembly');
    addSlot(rules.rollCall, 'Roll Call');

    for (let i = 1; i <= rules.periodsPerDay; i++) {
      addSlot(rules.periodDuration, '');
      const brk = rules.breaks.find(b => b.afterPeriod === i);
      if (brk) addSlot(brk.duration, brk.name);
    }

    return slots;
  }, [rules]);

  const [advancedRules, setAdvancedRules] = useState<AdvancedRule[]>([
    { id: 1, type: 'pinned', subject: 'P.E', day: 'Friday' },
    { id: 2, type: 'periods_per_week', subject: 'Mathematics', count: 4 }
  ]);

  const addRule = () => {
    const used = advancedRules.filter(r => r.type === 'periods_per_week').map(r => r.subject);
    const available = AVAILABLE_SUBJECTS.find(s => !used.includes(s.sub));
    const nextSub = available ? available.sub : AVAILABLE_SUBJECTS[0].sub;
    setAdvancedRules([...advancedRules, { id: Date.now(), type: 'periods_per_week', subject: nextSub, count: 2 }]);
  };
  
  const removeRule = (id: number) => {
    setAdvancedRules(advancedRules.filter(r => r.id !== id));
  };
  
  const updateRule = (id: number, updates: Partial<AdvancedRule>) => {
    setAdvancedRules(advancedRules.map(r => {
      if (r.id === id) {
        const nextRule = { ...r, ...updates };
        // if type changed, try to pivot to an unused subject
        if (updates.type) {
          const used = advancedRules.filter(ar => ar.id !== id && ar.type === updates.type).map(ar => ar.subject);
          if (used.includes(nextRule.subject)) {
            const available = AVAILABLE_SUBJECTS.find(s => !used.includes(s.sub));
            if (available) nextRule.subject = available.sub;
          }
        }
        return nextRule;
      }
      return r;
    }));
  };

  const activeClasses = activeSection === 'Primary' ? PRIMARY_CLASSES : SECONDARY_CLASSES;

  const isMaster = ['Super Admin', 'School Admin', 'HOS'].includes(role);
  const isTeacher = role === 'Teacher';
  const isLearnerOrParent = role === 'Student' || role === 'Parent';

  // Mock Active User Metadata
  const mockTeacherName = 'Mrs. Sarah';
  const mockStudentClassId = 'j1';

  const autoGenerateTimetable = (delay = 1500) => {
    setIsGenerating(true);
    setTimeout(() => {
      const generated: TimetableStore = {} as TimetableStore;
      let detectedClashes = 0;

      // Track Subject Counts per Class to enforce 'periods_per_week' constraint
      const classSubjectCounts: Record<string, Record<string, number>> = {};
      [...PRIMARY_CLASSES, ...SECONDARY_CLASSES].forEach(cls => {
        classSubjectCounts[cls.id] = {};
        AVAILABLE_SUBJECTS.forEach(s => classSubjectCounts[cls.id][s.sub] = 0);
      });

      const pinnedRules = advancedRules.filter(r => r.type === 'pinned');
      const maxCountRules = advancedRules.filter(r => r.type === 'periods_per_week');

      DAYS.forEach(day => {
        generated[day] = {};
        TIME_SLOTS.forEach(slot => {
          generated[day][slot] = {};
          
          if (slot.includes('(')) {
            const label = slot.split('(')[1]?.replace(')', '') || 'Break';
            [...PRIMARY_CLASSES, ...SECONDARY_CLASSES].forEach(cls => {
              generated[day][slot][cls.id] = { subject: label, teacher: '' };
            });
            return;
          }

          const usedTeachersForSlot = new Set<string>();

          [...PRIMARY_CLASSES, ...SECONDARY_CLASSES].forEach(cls => {
            // Apply constraints
            let allowedSubjects = AVAILABLE_SUBJECTS.filter(s => {
              // 1. Cannot use a teacher already teaching in this slot
              if (usedTeachersForSlot.has(s.teacher)) return false;
              
              // 2. Check if reached max periods per week
              const countRule = maxCountRules.find(r => r.subject === s.sub);
              if (countRule && countRule.count) {
                if (classSubjectCounts[cls.id][s.sub] >= countRule.count) {
                  return false;
                }
              }
              
              // 3. Check if subject is pinned to a specific day
              const pinRule = pinnedRules.find(r => r.subject === s.sub);
              if (pinRule && pinRule.day !== day) {
                return false;
              }
              
              return true;
            });

            // Fallback 1: Ignore pinning and max count constraints just to resolve a teacher clash
            if (allowedSubjects.length === 0) {
              allowedSubjects = AVAILABLE_SUBJECTS.filter(s => !usedTeachersForSlot.has(s.teacher));
            }

            if (allowedSubjects.length > 0) {
              const randomSubject = allowedSubjects[Math.floor(Math.random() * allowedSubjects.length)];
              usedTeachersForSlot.add(randomSubject.teacher);
              classSubjectCounts[cls.id][randomSubject.sub]++;
              generated[day][slot][cls.id] = { subject: randomSubject.sub, teacher: randomSubject.teacher, isClash: false };
            } else {
              // Complete deadlock: all teachers are busy. Mark as clash.
              detectedClashes++;
              generated[day][slot][cls.id] = { subject: AVAILABLE_SUBJECTS[0].sub, teacher: AVAILABLE_SUBJECTS[0].teacher, isClash: true };
            }
          });
        });
      });

      setTimetable(generated);
      setClashCount(detectedClashes);
      setIsGenerating(false);
    }, delay);
  };

  // Auto-fill on mount so non-master users actually see something
  useEffect(() => {
    if (Object.keys(timetable).length === 0) {
      autoGenerateTimetable(0);
    }
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const printIndividualClass = (cls: ClassData) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let tableHtml = `
      <table style="width: 100%; border-collapse: collapse; text-align: center; text-transform: uppercase;">
        <thead>
          <tr style="background-color: #f1f5f9;">
            <th style="border: 1px solid #cbd5e1; padding: 12px; width: 100px;">Day</th>
            ${TIME_SLOTS.map(t => `<th style="border: 1px solid #cbd5e1; padding: 12px;">${t}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
    `;

    DAYS.forEach(day => {
      tableHtml += `<tr><td style="border: 1px solid #cbd5e1; padding: 12px; font-weight: bold; background-color: #f8fafc;">${day}</td>`;
      TIME_SLOTS.forEach(time => {
        if (time.includes('(')) {
          const label = time.split('(')[1]?.replace(')', '') || 'BREAK';
          tableHtml += `<td style="border: 1px solid #cbd5e1; padding: 12px; background-color: #f1f5f9; color: #94a3b8; font-weight: bold;">${label.toUpperCase()}</td>`;
        } else {
          const cell = getCell(day, time, cls.id);
          if (cell) {
            tableHtml += `<td style="border: 1px solid #cbd5e1; padding: 12px;">
              <div style="font-weight: bold; color: #0f172a;">${cell.subject}</div>
              <div style="font-size: 11px; color: #64748b; margin-top: 4px;">${cell.teacher}</div>
            </td>`;
          } else {
            tableHtml += `<td style="border: 1px solid #cbd5e1; padding: 12px; color: #cbd5e1;">-</td>`;
          }
        }
      });
      tableHtml += `</tr>`;
    });

    tableHtml += `</tbody></table>`;

    printWindow.document.write(`
      <html>
        <head>
          <title>Timetable - ${cls.name}</title>
          <style>
            @media print {\n        @page { size: A4 landscape; margin: 0; padding: 0; }
              @page { size: A4 landscape; margin: 15mm; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 2cm; font-family: sans-serif; }
            }
            body { font-family: ui-sans-serif, system-ui, sans-serif; padding: 40px; color: #0f172a; }
            .header { text-align: center; margin-bottom: 30px; }
            .school-name { font-size: 24px; font-weight: bold; margin: 0; text-transform: uppercase; }
            .class-name { font-size: 14px; font-weight: 600; color: #64748b; margin-top: 8px; text-transform: uppercase; }
            .print-btn { display: inline-block; padding: 10px 20px; background-color: #0284c7; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; margin-bottom: 20px;}
            @media print {\n        @page { size: A4 landscape; margin: 0; padding: 0; } .print-btn { display: none; } }
          </style>
        </head>
        <body>
          <button class="print-btn" onclick="window.print()">Print This Timetable</button>
          <div class="header">
            <h1 class="school-name">Ndovera School Timetable</h1>
            <div class="class-name">Class: ${cls.name}</div>
          </div>
          ${tableHtml}
          <script>
            // Auto open print dialog when loaded
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const getCell = (day: Day, time: TimeSlot, classId: string) => {
    if (!timetable[day] || !timetable[day][time]) return null;
    return timetable[day][time][classId];
  };

  // Renders the specific schedule for a teacher across the week
  const renderTeacherView = () => {
    return (
      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-sm min-w-max">
        <div className="mb-6 flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-tight text-slate-900">Ndovera School Timetable</h1>
            <p className="text-sm font-medium text-slate-500 uppercase">Instructor: {mockTeacherName} - GENERATED DRAFT</p>
          </div>
          <button onClick={handlePrint} className="no-print inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">
            <Printer size={16} /> Print Timetable
          </button>
        </div>

        <table className="w-full border-collapse border border-slate-300 text-left text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="border border-slate-300 p-3 font-bold text-slate-800 w-28 bg-white">Day</th>
              {TIME_SLOTS.map(time => (
                <th key={time} className="border border-slate-300 p-3 font-bold text-slate-800 text-center whitespace-nowrap min-w-30">
                  {time}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map(day => (
              <tr key={day}>
                <td className="border border-slate-300 p-4 font-bold text-slate-900 bg-slate-50 uppercase tracking-widest text-center whitespace-nowrap">
                  {day}
                </td>
                {TIME_SLOTS.map(time => {
                  const isBreak = time.includes('(');
                  if (isBreak) {
                    const label = time.split('(')[1]?.replace(')', '') || 'BREAK';
                    return (
                      <td key={time} className="border border-slate-300 bg-slate-100 p-2 text-center text-slate-400 font-bold tracking-widest uppercase">
                        {label}
                      </td>
                    );
                  }
                  
                  // Find if teacher has a class in this slot
                  let scheduledClass = null;
                  let scheduledSubject = null;
                  
                  if (timetable[day] && timetable[day][time]) {
                    [...PRIMARY_CLASSES, ...SECONDARY_CLASSES].forEach(cls => {
                      const assignment = timetable[day][time][cls.id];
                      if (assignment && assignment.teacher === mockTeacherName) {
                        scheduledClass = cls.name;
                        scheduledSubject = assignment.subject;
                      }
                    });
                  }

                  return (
                    <td key={time} className={`border border-slate-300 p-3 ${scheduledClass ? 'bg-sky-50 border-sky-100' : 'bg-white'}`}>
                      {scheduledClass ? (
                        <div className="flex flex-col items-center text-center gap-1">
                          <span className="font-bold text-sky-900">{scheduledClass}</span>
                          <span className="text-[11px] font-semibold text-sky-700 bg-white px-2 py-0.5 rounded border border-sky-100">{scheduledSubject}</span>
                        </div>
                      ) : (
                        <div className="flex justify-center text-slate-300">-</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Renders the specific schedule for a learner's class
  const renderLearnerView = () => {
    const studentClass = [...PRIMARY_CLASSES, ...SECONDARY_CLASSES].find(c => c.id === mockStudentClassId)!;
    
    if (Object.keys(timetable).length === 0 || isGenerating) {
      return (
        <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200 shadow-sm min-h-100">
          <Settings className={`mb-4 h-12 w-12 opacity-20 ${isGenerating ? 'animate-spin' : ''}`} />
          <p className="text-lg font-medium">{isGenerating ? 'School is generating your timetable...' : 'No Timetable Posted Yet'}</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-sm min-w-max">
        <div className="mb-6 flex justify-between items-center bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100/50">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-tight text-slate-900">Ndovera School Timetable</h1>
            <p className="text-sm font-medium text-slate-500 uppercase">Class: {studentClass.name}</p>
          </div>
          <button onClick={handlePrint} className="no-print inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 shadow-sm">
            <Printer size={16} /> Print Schedule
          </button>
        </div>

        <table className="w-full border-collapse border border-slate-300 text-left text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="border border-slate-300 p-3 font-bold text-slate-800 w-28 bg-white">Day</th>
              {TIME_SLOTS.map(time => (
                <th key={time} className="border border-slate-300 p-3 font-bold text-slate-800 text-center whitespace-nowrap min-w-30">
                  {time}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map(day => (
              <tr key={day}>
                <td className="border border-slate-300 p-4 font-bold text-slate-900 bg-slate-50 uppercase tracking-widest text-center whitespace-nowrap">
                  {day}
                </td>
                {TIME_SLOTS.map(time => {
                  const isBreak = time.includes('(');
                  if (isBreak) {
                    const label = time.split('(')[1]?.replace(')', '') || 'BREAK';
                    return (
                      <td key={time} className="border border-slate-300 bg-slate-100 p-2 text-center text-slate-400 font-bold tracking-widest uppercase">
                        {label}
                      </td>
                    );
                  }
                  
                  const cell = getCell(day, time, studentClass.id);

                  return (
                    <td key={time} className="border border-slate-300 p-3 bg-white">
                      {cell ? (
                        <div className="flex flex-col items-center text-center gap-1">
                          <span className="font-bold text-slate-900">{cell.subject}</span>
                          <span className="text-[11px] font-medium text-slate-500">{cell.teacher}</span>
                        </div>
                      ) : (
                        <div className="flex justify-center text-slate-300">-</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-full">
      {/* Printer styles override: strictly landscape A4 */}
      <style>{`
        @media print {\n        @page { size: A4 landscape; margin: 0; padding: 0; }
          @page { size: A4 landscape; margin: 10mm; }
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
      
      <div id="print-area" className="print:p-8 print:w-full print:bg-white">
        {isTeacher ? renderTeacherView() : isLearnerOrParent ? renderLearnerView() : (
          <>
            {/* Master Control Panel */}
            <div className="no-print rounded-3xl border border-slate-200 bg-white p-5 shadow-sm mb-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Master Timetable Studio</h2>
                  <p className="text-sm text-slate-600">Auto-generate clash-free schedules for Primary and Secondary sections.</p>
                </div>
                
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowRules(!showRules)}
                    className={`inline-flex items-center gap-2 rounded-2xl border px-5 py-2 text-sm font-semibold transition-colors ${showRules ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                  >
                    <Settings className="h-4 w-4" />
                    Rules Configuration
                  </button>

                  <select 
                    value={activeSection} 
                    onChange={(e) => setActiveSection(e.target.value as Section)}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold outline-none focus:border-sky-400"
                  >
                    <option value="Primary">Primary Section</option>
                    <option value="Secondary">Secondary Section</option>
                  </select>

                  <button 
                    onClick={() => autoGenerateTimetable(1500)}
                    disabled={isGenerating}
                    className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 disabled:opacity-50"
                  >
                    {Object.keys(timetable).length > 0 ? (
                       <>
                         <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                         {isGenerating ? 'Computing...' : 'Regenerate'}
                       </>
                    ) : (
                       <>
                         <Sparkles className="h-4 w-4" />
                         {isGenerating ? 'Computing...' : 'Auto-Generate Schedule'}
                       </>
                    )}
                  </button>

                  {clashCount > 0 && (
                    <button 
                      onClick={() => autoGenerateTimetable(1500)}
                      disabled={isGenerating}
                      className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-500 disabled:opacity-50"
                    >
                      <Wrench className="h-4 w-4" />
                      Auto-fix Clashes
                    </button>
                  )}

                  <button 
                    onClick={handlePrint}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
                  >
                    <Printer className="h-4 w-4" />
                    Print A4
                  </button>
                </div>
              </div>

              {/* Rules Configuration Panel */}
              {showRules && (
                <div className="mt-5 border-t border-slate-100 pt-5">
                  <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">School Routine & Durations</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-4">
                    <div className="group rounded-xl border border-fuchsia-900/40 bg-slate-950 p-3 shadow-md shadow-fuchsia-900/10 transition-all hover:border-fuchsia-700/60">
                      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-emerald-400">Start Time</label>
                      <input 
                        type="time" 
                        value={rules.startTime}
                        onChange={e => setRules({...rules, startTime: e.target.value})}
                        className="w-full rounded-lg border border-fuchsia-900/60 bg-black/50 px-2.5 py-1.5 text-xs font-bold text-fuchsia-50 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400" 
                      />
                    </div>
                    <div className="group rounded-xl border border-fuchsia-900/40 bg-slate-950 p-3 shadow-md shadow-fuchsia-900/10 transition-all hover:border-fuchsia-700/60">
                      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-emerald-400">Period Duration (mins)</label>
                      <input 
                        type="number" 
                        value={rules.periodDuration}
                        onChange={e => setRules({...rules, periodDuration: parseInt(e.target.value) || 0})}
                        className="w-full rounded-lg border border-fuchsia-900/60 bg-black/50 px-2.5 py-1.5 text-xs font-bold text-fuchsia-50 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400" 
                      />
                    </div>
                    <div className="group rounded-xl border border-fuchsia-900/40 bg-slate-950 p-3 shadow-md shadow-fuchsia-900/10 transition-all hover:border-fuchsia-700/60">
                      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-emerald-400">Periods / Day</label>
                      <input 
                        type="number" 
                        value={rules.periodsPerDay}
                        onChange={e => setRules({...rules, periodsPerDay: parseInt(e.target.value) || 0})}
                        className="w-full rounded-lg border border-fuchsia-900/60 bg-black/50 px-2.5 py-1.5 text-xs font-bold text-fuchsia-50 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400" 
                      />
                    </div>
                    <div className="group rounded-xl border border-fuchsia-900/40 bg-slate-950 p-3 shadow-md shadow-fuchsia-900/10 transition-all hover:border-fuchsia-700/60">
                      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-emerald-400">Roll Call (mins)</label>
                      <input 
                        type="number" 
                        value={rules.rollCall}
                        onChange={e => setRules({...rules, rollCall: parseInt(e.target.value) || 0})}
                        className="w-full rounded-lg border border-fuchsia-900/60 bg-black/50 px-2.5 py-1.5 text-xs font-bold text-fuchsia-50 outline-none focus:border-emerald-400" 
                      />
                    </div>
                    <div className="group rounded-xl border border-fuchsia-900/40 bg-slate-950 p-3 shadow-md shadow-fuchsia-900/10 transition-all hover:border-fuchsia-700/60">
                      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-emerald-400">Assembly (mins)</label>
                      <input 
                        type="number" 
                        value={rules.assembly}
                        onChange={e => setRules({...rules, assembly: parseInt(e.target.value) || 0})}
                        className="w-full rounded-lg border border-fuchsia-900/60 bg-black/50 px-2.5 py-1.5 text-xs font-bold text-fuchsia-50 outline-none focus:border-emerald-400" 
                      />
                    </div>
                    <div className="group rounded-xl border border-fuchsia-900/40 bg-slate-950 p-3 shadow-md shadow-fuchsia-900/10 transition-all hover:border-fuchsia-700/60">
                      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-emerald-400">Morning Drill (mins)</label>
                      <input 
                        type="number" 
                        value={rules.morningDrill}
                        onChange={e => setRules({...rules, morningDrill: parseInt(e.target.value) || 0})}
                        className="w-full rounded-lg border border-fuchsia-900/60 bg-black/50 px-2.5 py-1.5 text-xs font-bold text-fuchsia-50 outline-none focus:border-emerald-400" 
                      />
                    </div>
                    <div className="group rounded-xl border border-fuchsia-900/40 bg-slate-950 p-3 shadow-md shadow-fuchsia-900/10 transition-all hover:border-fuchsia-700/60">
                      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-emerald-400">Max Consec. Periods</label>
                      <input 
                        type="number" 
                        value={rules.maxConsecutivePeriodsForTeacher}
                        onChange={e => setRules({...rules, maxConsecutivePeriodsForTeacher: parseInt(e.target.value) || 0})}
                        className="w-full rounded-lg border border-fuchsia-900/60 bg-black/50 px-2.5 py-1.5 text-xs font-bold text-fuchsia-50 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400" 
                      />
                    </div>

                    <div className="group rounded-xl border border-fuchsia-900/40 bg-slate-950 p-3 shadow-md shadow-fuchsia-900/10 transition-all hover:border-fuchsia-700/60 flex flex-col justify-center">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <div className="relative flex items-center justify-center">
                          <input 
                            type="checkbox" 
                            checked={rules.includeWeekends}
                            onChange={e => setRules({...rules, includeWeekends: e.target.checked})}
                            className="peer h-4 w-4 appearance-none rounded-sm border border-fuchsia-700/50 bg-black/50 outline-none checked:border-emerald-500 checked:bg-emerald-500 transition-all cursor-pointer" 
                          />
                          <svg className="pointer-events-none absolute h-2.5 w-2.5 text-slate-950 opacity-0 peer-checked:opacity-100" viewBox="0 0 14 10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1.5 5.5 4.5 8.5 12.5 1.5"></polyline></svg>
                        </div>
                        <span className="text-xs font-bold text-fuchsia-100">Include Weekends</span>
                      </label>
                    </div>

                    <div className="md:col-span-2 lg:col-span-2 group rounded-xl border border-fuchsia-900/40 bg-slate-950 p-3 shadow-md shadow-fuchsia-900/10 transition-all hover:border-fuchsia-700/60">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-emerald-400">Manage Breaks</label>
                        <button 
                          onClick={() => setRules({...rules, breaks: [...rules.breaks, { id: Date.now(), afterPeriod: 4, duration: 30, name: 'Short Break' }]})}
                          className="text-[9px] font-bold text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded bg-emerald-500/20"
                        >+ ADD BREAK</button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {rules.breaks.map(b => (
                          <div key={b.id} className="flex items-center gap-1.5 bg-black/50 border border-fuchsia-900/50 p-1.5 rounded-lg">
                            <input value={b.name} onChange={e => setRules({...rules, breaks: rules.breaks.map(br => br.id === b.id ? {...br, name: e.target.value} : br)})} className="w-16 bg-transparent text-[10px] text-fuchsia-100 outline-none" placeholder="Break Name" />
                            <span className="text-[9px] text-slate-500">after P</span>
                            <input type="number" value={b.afterPeriod} onChange={e => setRules({...rules, breaks: rules.breaks.map(br => br.id === b.id ? {...br, afterPeriod: parseInt(e.target.value) || 1} : br)})} className="w-8 bg-slate-900 text-center text-[10px] text-fuchsia-100 rounded border border-fuchsia-900/30 outline-none" />
                            <span className="text-[9px] text-slate-500">for</span>
                            <input type="number" value={b.duration} onChange={e => setRules({...rules, breaks: rules.breaks.map(br => br.id === b.id ? {...br, duration: parseInt(e.target.value) || 0} : br)})} className="w-10 bg-slate-900 text-center text-[10px] text-fuchsia-100 rounded border border-fuchsia-900/30 outline-none" />
                            <span className="text-[9px] text-slate-500">m</span>
                            <button onClick={() => setRules({...rules, breaks: rules.breaks.filter(br => br.id !== b.id)})} className="ml-1 text-slate-500 hover:text-rose-400"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Advanced Subject Rules */}
                  <div className="mt-4 border-t border-fuchsia-900/30 pt-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Advanced Subject Rules</h4>
                      <button 
                        onClick={addRule} 
                        className="flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-1 text-[9px] font-bold text-emerald-300 border border-emerald-500/30 transition-colors hover:bg-emerald-500/40"
                      >
                        <Plus className="h-3 w-3" /> ADD RULE
                      </button>
                    </div>
                    <div className="grid gap-2">
                      {advancedRules.map(rule => {
                        const usedSubjects = advancedRules
                          .filter(r => r.type === rule.type && r.id !== rule.id)
                          .map(r => r.subject);
                        
                        const availableSubjects = AVAILABLE_SUBJECTS.filter(s => 
                          s.sub === rule.subject || !usedSubjects.includes(s.sub)
                        );

                        return (
                        <div key={rule.id} className="group relative flex items-center gap-2 rounded-lg border border-fuchsia-900/30 bg-slate-950 p-2 shadow-sm">
                          <select 
                            value={rule.type} 
                            onChange={e => updateRule(rule.id, { type: e.target.value as any })}
                            className="rounded border border-fuchsia-900/50 bg-black/50 px-2 py-1 text-[10px] font-bold text-fuchsia-200 outline-none focus:border-emerald-400"
                          >
                            <option value="periods_per_week">Periods/Week</option>
                            <option value="pinned">Pin to Day</option>
                          </select>

                          <select 
                            value={rule.subject} 
                            onChange={e => updateRule(rule.id, { subject: e.target.value })}
                            className="rounded border border-fuchsia-900/50 bg-black/50 px-2 py-1 text-[10px] font-bold text-emerald-400 outline-none focus:border-emerald-400 flex-1"
                          >
                            {availableSubjects.map(s => <option key={s.sub} value={s.sub}>{s.sub}</option>)}
                          </select>

                          {rule.type === 'periods_per_week' ? (
                            <input 
                              type="number" 
                              value={rule.count || 1} 
                              onChange={e => updateRule(rule.id, { count: parseInt(e.target.value) || 1 })}
                              className="w-16 rounded border border-fuchsia-900/50 bg-black/50 px-2 py-1 text-[10px] font-bold text-fuchsia-100 outline-none focus:border-emerald-400 text-center" 
                              placeholder="Count"
                            />
                          ) : (
                            <select 
                              value={rule.day} 
                              onChange={e => updateRule(rule.id, { day: e.target.value as Day })}
                              className="w-24 rounded border border-fuchsia-900/50 bg-black/50 px-2 py-1 text-[10px] font-bold text-fuchsia-100 outline-none focus:border-emerald-400"
                            >
                              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          )}

                          <button 
                            onClick={() => removeRule(rule.id)}
                            className="rounded p-1 text-slate-600 transition-colors hover:bg-rose-500/20 hover:text-rose-400"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )})}
                      {advancedRules.length === 0 && (
                        <div className="rounded-lg border border-dashed border-fuchsia-900/30 p-3 text-center text-[10px] text-slate-500">
                          No advanced rules added. Generator will map subjects randomly.
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Regenerate Action */}
                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={() => autoGenerateTimetable(500)}
                      disabled={isGenerating}
                      className="flex items-center gap-2 rounded-lg bg-emerald-500 px-6 py-2 text-xs font-bold text-white shadow hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                    >
                      <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                      {isGenerating ? 'GENERATING...' : 'REGENERATE'}
                    </button>
                  </div>
                </div>
              )}

              {/* Dashboard / Metrics */}
              {Object.keys(timetable).length > 0 && !isGenerating && (
                <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-4 border-t border-slate-100 pt-5">
                  <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-3">
                    <ShieldCheck className="h-8 w-8 text-emerald-600" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Status</p>
                      <p className="font-semibold text-emerald-900">{clashCount === 0 ? 'Clash-Free' : 'Clash Detected'}</p>
                    </div>
                  </div>
                  
                  {clashCount > 0 && (
                    <div className="flex items-center gap-3 rounded-2xl bg-rose-50 p-3">
                      <AlertTriangle className="h-8 w-8 text-rose-600" />
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-rose-700">Conflicts</p>
                        <p className="font-semibold text-rose-900">{clashCount} overlap{clashCount > 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Printable Area - A4 Landscape Grid for Master */}
            <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-sm min-w-max">
              <div className="mb-6 flex items-start justify-between">
                <div className="w-32"></div> {/* Spacer for centering */}
                <div className="text-center flex-1">
                  <h1 className="text-2xl font-bold uppercase tracking-tight text-slate-900">Ndovera School Timetable</h1>
                  <p className="text-sm font-semibold text-slate-500 uppercase">{activeSection} SECTION - GENERATED DRAFT</p>
                </div>
                <div className="w-32 flex justify-end">
                  <button 
                    onClick={handlePrint}
                    className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow hover:bg-slate-800 transition-colors shrink-0"
                  >
                    <Printer className="h-4 w-4" />
                    Print A4
                  </button>
                </div>
              </div>

              {Object.keys(timetable).length === 0 || isGenerating ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400">
                  <Settings className={`mb-4 h-12 w-12 opacity-20 ${isGenerating ? 'animate-spin' : ''}`} />
                  <p className="text-lg font-medium">{isGenerating ? 'Computing...' : 'No Timetable Generated'}</p>
                </div>
              ) : (
                <table className="w-full border-collapse border border-slate-300 text-left text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="border border-slate-300 p-3 font-bold text-slate-800 w-24">Day</th>
                      <th className="border border-slate-300 p-3 font-bold text-slate-800 bg-white w-24">Class</th>
                      {TIME_SLOTS.map(time => (
                        <th key={time} className="border border-slate-300 p-3 font-bold text-slate-800 text-center whitespace-nowrap min-w-30">
                          {time}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map(day => (
                      activeClasses.map((cls, classIdx) => (
                        <tr key={`${day}-${cls.id}`} className={classIdx === activeClasses.length - 1 ? 'border-b-[3px] border-b-slate-400' : ''}>
                          {classIdx === 0 && (
                            <td 
                              rowSpan={activeClasses.length} 
                              className="border border-slate-300 bg-slate-50 p-3 font-bold text-slate-900 text-center uppercase tracking-widest align-middle flex-col"
                            >
                              <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }} className="py-4">
                                {day}
                              </span>
                            </td>
                          )}
                          
                          <td className="border border-slate-300 bg-white p-3 font-bold text-slate-800 whitespace-nowrap align-middle">
                            <div className="flex items-center justify-between gap-3">
                              <span>{cls.name}</span>
                              <button 
                                onClick={() => printIndividualClass(cls)}
                                title="Print this class only"
                                className="no-print rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-sky-50 hover:text-sky-600 transition-colors"
                              >
                                <Printer size={14} />
                              </button>
                            </div>
                          </td>

                          {TIME_SLOTS.map(time => {
                            const cell = getCell(day, time, cls.id);
                            const isBreak = time.includes('(');

                            if (isBreak && classIdx === 0) {
                              const label = time.split('(')[1]?.replace(')', '').split('').join(' ') || 'B R E A K';
                              return (
                                <td 
                                  key={`${day}-${time}`} 
                                  rowSpan={activeClasses.length}
                                  className="border border-slate-300 bg-slate-100 p-2 text-center text-slate-500 font-bold tracking-widest uppercase align-middle"
                                >
                                  <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{label}</span>
                                </td>
                              );
                            } else if (isBreak) {
                              return null; 
                            }

                            return (
                              <td 
                                key={`${day}-${time}-${cls.id}`} 
                                className={`border border-slate-300 p-3 ${cell?.isClash ? 'bg-rose-100' : 'bg-white hover:bg-slate-50 transition-colors cursor-pointer'}`}
                              >
                                {cell ? (
                                  <div className="flex flex-col items-center text-center">
                                    <span className={`font-semibold ${cell.isClash ? 'text-rose-900' : 'text-slate-900'}`}>{cell.subject}</span>
                                    <span className={`text-[11px] mt-1 ${cell.isClash ? 'text-rose-700 font-bold' : 'text-slate-500'}`}>{cell.teacher}</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
