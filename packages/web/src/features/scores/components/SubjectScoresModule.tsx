import React, { useState, useMemo } from 'react';
import { Save, Download, Upload, AlertCircle, FileSpreadsheet, CheckCircle2, History, ChevronDown } from 'lucide-react';

type StudentScore = {
  id: string;
  name: string;
  homework: number | null;
  quiz: number | null;
  project: number | null;
  exam: number | null;
};

const initialStudents: StudentScore[] = [
  { id: 'STU001', name: 'Amaka Eze', homework: 18, quiz: 15, project: 20, exam: null },
  { id: 'STU002', name: 'Boluwatife Ade', homework: null, quiz: 12, project: 18, exam: null },
  { id: 'STU003', name: 'Chinedu Okoro', homework: 20, quiz: 18, project: 25, exam: 68 },
  { id: 'STU004', name: 'Danielle Okafor', homework: 15, quiz: null, project: null, exam: null },
  { id: 'STU005', name: 'Emmanuel Bassey', homework: 19, quiz: 19, project: 22, exam: 71 },
];

export default function SubjectScoresModule({ role }: { role?: string }) {      
  const [students, setStudents] = useState<StudentScore[]>(initialStudents);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>('Today, 09:41 AM');

  // Weights configuration
  const caWeights = { homework: 20, quiz: 20, project: 20 }; // Max CA = 60
  const maxExam = 40; // Max Exam = 40
  // total 100

  const handleScoreChange = (id: string, field: keyof StudentScore, value: string) => {
    const numValue = value === '' ? null : Number(value);
    setStudents(prev => prev.map(s => s.id === id ? { ...s, [field]: numValue } : s));
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setLastSaved(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }));
    }, 800);
  };

  const calculateTotalCA = (s: StudentScore) => {
    let total = 0;
    if (s.homework !== null) total += s.homework;
    if (s.quiz !== null) total += s.quiz;
    if (s.project !== null) total += s.project;
    return total;
  };

  const calculateTermTotal = (s: StudentScore) => {
    return calculateTotalCA(s) + (s.exam || 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
         <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Subject Scores (CA) Entry</h2>
            <p className="text-sm text-slate-400 mt-1">Live grading sheet with auto-calculations and weight validation.</p>
         </div>
         <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition">
               <History size={16} /> Version History
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 rounded-xl text-sm font-semibold transition border border-sky-500/20">
               <Download size={16} /> Offline CSV
            </button>
         </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
         <div className="flex items-center gap-6">
            <div>
               <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Subject</p>
               <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-semibold text-white">Mathematics</span>
                  <ChevronDown size={14} className="text-slate-400" />
               </div>
            </div>
            <div className="w-px h-8 bg-slate-800" />
            <div>
               <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Class Section</p>
               <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-semibold text-white">JSS 3A</span>
                  <ChevronDown size={14} className="text-slate-400" />
               </div>
            </div>
            <div className="w-px h-8 bg-slate-800" />
            <div>
               <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">CA Configuration</p>
               <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-semibold text-slate-300">HW ({caWeights.homework}) • Quiz ({caWeights.quiz}) • Proj ({caWeights.project})</span>
               </div>
            </div>
         </div>
         
         <div className="flex flex-col items-end">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</p>
            {lastSaved ? (
               <div className="flex items-center gap-1.5 mt-1 text-emerald-400 text-xs font-bold">
                  <CheckCircle2 size={14} /> Draft Saved ({lastSaved})
               </div>
            ) : (
               <div className="mt-1 text-slate-400 text-xs font-bold">Unsaved changes</div>
            )}
         </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
               <thead>
                  <tr className="bg-slate-800/50 border-b border-slate-800 text-[11px] uppercase tracking-widest text-slate-400 font-bold">
                     <th className="p-4 w-12 text-center">#</th>
                     <th className="p-4 min-w-50">Student Name</th>
                     <th className="p-4 text-center min-w-[100px]">Homework <span className="block text-[9px] text-slate-500">Max {caWeights.homework}</span></th>
                     <th className="p-4 text-center min-w-[100px]">Quiz <span className="block text-[9px] text-slate-500">Max {caWeights.quiz}</span></th>
                     <th className="p-4 text-center min-w-[100px]">Project <span className="block text-[9px] text-slate-500">Max {caWeights.project}</span></th>
                     <th className="p-4 bg-slate-800 text-center font-black min-w-[100px]">Total CA <span className="block text-[9px] text-sky-400">/ 60</span></th>
                     <th className="p-4 text-center border-l border-slate-800 bg-slate-900/50 min-w-[100px]">Final Exam <span className="block text-[9px] text-slate-500">Max {maxExam}</span></th>
                     <th className="p-4 bg-slate-800 text-center font-black min-w-[100px]">Term Total <span className="block text-[9px] text-emerald-400">/ 100</span></th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-800 text-sm">
                  {students.map((sys, idx) => {
                     const totalCA = calculateTotalCA(sys);
                     const termTotal = calculateTermTotal(sys);
                     const isMissing = sys.homework === null || sys.quiz === null || sys.project === null;

                     return (
                        <tr key={sys.id} className="hover:bg-slate-800/20 transition-colors">
                           <td className="p-4 text-center text-slate-500 font-mono text-xs">{idx + 1}</td>
                           <td className="p-4">
                              <div className="flex items-center gap-2">
                                 <span className="font-semibold text-white">{sys.name}</span>
                                 {isMissing && (
                                    <span title="Missing scores"><AlertCircle size={14} className="text-orange-500" /></span>
                                 )}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">{sys.id}</div>
                           </td>
                           <td className="p-4">
                              <input 
                                 type="number" 
                                 max={caWeights.homework}
                                 min={0}
                                 value={sys.homework ?? ''}
                                 onChange={(e) => handleScoreChange(sys.id, 'homework', e.target.value)}
                                 className={`w-full bg-slate-950 border rounded-lg px-2 py-2 text-center text-white focus:outline-none focus:ring-1 focus:ring-sky-500 transition ${sys.homework === null ? 'border-orange-500/50 bg-orange-500/5' : 'border-slate-700'}`}
                              />
                           </td>
                           <td className="p-4">
                              <input 
                                 type="number" 
                                 max={caWeights.quiz}
                                 min={0}
                                 value={sys.quiz ?? ''}
                                 onChange={(e) => handleScoreChange(sys.id, 'quiz', e.target.value)}
                                 className={`w-full bg-slate-950 border rounded-lg px-2 py-2 text-center text-white focus:outline-none focus:ring-1 focus:ring-sky-500 transition ${sys.quiz === null ? 'border-orange-500/50 bg-orange-500/5' : 'border-slate-700'}`}
                              />
                           </td>
                           <td className="p-4">
                              <input 
                                 type="number" 
                                 max={caWeights.project}
                                 min={0}
                                 value={sys.project ?? ''}
                                 onChange={(e) => handleScoreChange(sys.id, 'project', e.target.value)}
                                 className={`w-full bg-slate-950 border rounded-lg px-2 py-2 text-center text-white focus:outline-none focus:ring-1 focus:ring-sky-500 transition ${sys.project === null ? 'border-orange-500/50 bg-orange-500/5' : 'border-slate-700'}`}
                              />
                           </td>
                           <td className="p-4 bg-slate-800/30 text-center font-mono font-bold text-sky-400">
                              {totalCA}
                           </td>
                           <td className="p-4 border-l border-slate-800 bg-slate-900/50">
                              <input 
                                 type="number" 
                                 max={maxExam}
                                 min={0}
                                 value={sys.exam ?? ''}
                                 onChange={(e) => handleScoreChange(sys.id, 'exam', e.target.value)}
                                 className={`w-full bg-slate-950 border rounded-lg px-2 py-2 text-center text-white focus:outline-none focus:ring-1 focus:ring-sky-500 transition ${sys.exam === null ? 'border-slate-700' : 'border-slate-600'}`}
                                 placeholder="-"
                              />
                           </td>
                           <td className={`p-4 bg-slate-800/30 text-center font-mono font-bold ${termTotal > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                              {termTotal > 0 ? termTotal : '-'}
                           </td>
                        </tr>
                     );
                  })}
               </tbody>
            </table>
         </div>
         <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between">
            <p className="text-xs text-slate-400">Scores auto-save every 60 seconds.</p>
            <button 
               onClick={handleSave}
               disabled={isSaving}
               className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-lg disabled:opacity-50"
            >
               {isSaving ? <CheckCircle2 size={16} className="animate-pulse" /> : <Save size={16} />}
               {isSaving ? 'Saving...' : 'Save Draft'}
            </button>
         </div>
      </div>
    </div>
  );
}
