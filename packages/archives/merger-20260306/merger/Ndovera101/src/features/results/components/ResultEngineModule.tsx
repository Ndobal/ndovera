import React, { useState, useEffect, useMemo } from 'react';
import { 
  Table, 
  Save, 
  Send, 
  CheckCircle, 
  Lock, 
  FileText, 
  Printer, 
  Download, 
  Sparkles, 
  AlertCircle, 
  ChevronRight, 
  Search,
  History,
  ShieldCheck,
  QrCode,
  PenTool,
  Settings
} from 'lucide-react';
import { UserRole } from '../../../shared/types';
import { CASpreadsheetEntry, ComputedResult, AffectiveScore, PsychomotorScore } from '../../../shared/types';
import { motion, AnimatePresence } from 'motion/react';

// --- MOCK DATA ---
const MOCK_SUBJECTS = [
  { id: 'sub1', name: 'Mathematics' },
  { id: 'sub2', name: 'English Language' },
  { id: 'sub3', name: 'Physics' },
  { id: 'sub4', name: 'Chemistry' },
  { id: 'sub5', name: 'Biology' },
  { id: 'sub6', name: 'Agric Science' },
  { id: 'sub7', name: 'Economics' },
  { id: 'sub8', name: 'Civic Education' },
];

const INITIAL_SCORESHEET: CASpreadsheetEntry = {
  studentId: 's1',
  studentName: 'John Doe',
  classId: 'c1',
  session: '2025/2026',
  term: 'First Term',
  subjects: MOCK_SUBJECTS.map(s => ({
    subjectId: s.id,
    subjectName: s.name,
    caScores: [0, 0, 0], // CA1, CA2, Assignment
    examScore: 0,
    total: 0
  })),
  grandTotal: 0,
  teacherSigned: false,
  sectionalHeadApproved: false,
  hosApproved: false,
  status: 'Draft',
  signatures: {}
};

// --- UTILS ---
const calculateGrade = (score: number) => {
  if (score >= 75) return 'A1';
  if (score >= 70) return 'B2';
  if (score >= 65) return 'B3';
  if (score >= 60) return 'C4';
  if (score >= 55) return 'C5';
  if (score >= 50) return 'C6';
  if (score >= 45) return 'D7';
  if (score >= 40) return 'E8';
  return 'F9';
};

export default function ResultEngineModule({ role }: { role: UserRole }) {
  const [view, setView] = useState<'scoresheet' | 'result'>('scoresheet');
  const [scoresheet, setScoresheet] = useState<CASpreadsheetEntry>(INITIAL_SCORESHEET);
  const [computedResult, setComputedResult] = useState<ComputedResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [watermarkConfig, setWatermarkConfig] = useState({
    opacity: 0.1,
    position: 'center',
    size: 'medium'
  });

  const isSubjectTeacher = role === UserRole.TEACHER;
  const isClassTeacher = [UserRole.TEACHER, UserRole.VICE_PRINCIPAL].includes(role); // Simplified for demo
  const isSectionalHead = [UserRole.PRINCIPAL, UserRole.HEAD_TEACHER, UserRole.NURSERY_HEAD].includes(role);
  const isHoS = role === UserRole.HOS || role === UserRole.PROPRIETOR || role === UserRole.SUPER_ADMIN;

  // --- PERSISTENCE ---
  useEffect(() => {
    const saved = localStorage.getItem('ndovera_scoresheet');
    if (saved) {
      try {
        setScoresheet(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load saved scoresheet", e);
      }
    }
  }, []);

  const saveToLocal = (data: CASpreadsheetEntry) => {
    localStorage.setItem('ndovera_scoresheet', JSON.stringify(data));
  };

  // --- HANDLERS ---
  const handleScoreChange = (subjectIndex: number, scoreType: 'ca' | 'exam', scoreIndex: number, value: string) => {
    if (scoresheet.status !== 'Draft' && !isHoS) return;

    const numValue = Math.min(100, Math.max(0, parseInt(value) || 0));
    const newScoresheet = { ...scoresheet };
    const subject = newScoresheet.subjects[subjectIndex];

    if (scoreType === 'ca') {
      subject.caScores[scoreIndex] = numValue;
    } else {
      subject.examScore = numValue;
    }

    subject.total = subject.caScores.reduce((a, b) => a + b, 0) + subject.examScore;
    newScoresheet.grandTotal = newScoresheet.subjects.reduce((acc, s) => acc + s.total, 0);
    
    setScoresheet(newScoresheet);
    saveToLocal(newScoresheet);
    
    // Auto-save simulation
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 1000);
  };

  const handleCompute = () => {
    if (!scoresheet.sectionalHeadApproved && !isHoS) {
      alert("Sectional Head must approve CA scores before computation.");
      return;
    }

    const result: ComputedResult = {
      studentId: scoresheet.studentId,
      studentName: scoresheet.studentName,
      term: scoresheet.term,
      session: scoresheet.session,
      classId: scoresheet.classId,
      classLevel: 'SS3',
      subjects: scoresheet.subjects.map((s, i) => ({
        subjectId: s.subjectId,
        subjectName: s.subjectName,
        scores: {
          ca1: s.caScores[0],
          ca2: s.caScores[1],
          assignment: s.caScores[2],
          exam: s.examScore,
          total: s.total
        },
        grade: calculateGrade(s.total),
        position: i + 1 // Mock position
      })),
      affective: [
        { name: 'Punctuality', score: 5 },
        { name: 'Neatness', score: 4 },
        { name: 'Honesty', score: 5 }
      ],
      psychomotor: [
        { name: 'Handwriting', score: 4 },
        { name: 'Sports', score: 3 },
        { name: 'Creativity', score: 5 }
      ],
      comments: {
        classTeacher: 'An excellent performance. Keep it up!',
        sectionalHead: 'Very impressive results. Well done.',
        hos: 'Outstanding academic achievement.'
      },
      signatures: {},
      source: 'CA_SCORESHEET',
      version: 1,
      locked: false,
      published: false,
      overallPosition: 1,
      classAverage: 82.5,
      attendance: { present: 88, total: 90 }
    };

    setComputedResult(result);
    setScoresheet({ ...scoresheet, status: 'Computed' });
    setView('result');
  };

  const handleDomainChange = (type: 'affective' | 'psychomotor', index: number, score: number) => {
    if (!computedResult || computedResult.locked) return;
    const newResult = { ...computedResult };
    if (type === 'affective') {
      newResult.affective[index].score = score;
    } else {
      newResult.psychomotor[index].score = score;
    }
    setComputedResult(newResult);
  };

  const handleCommentChange = (roleKey: keyof ComputedResult['comments'], value: string) => {
    if (!computedResult || computedResult.locked) return;
    const newResult = { ...computedResult };
    newResult.comments[roleKey] = value;
    setComputedResult(newResult);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Result Engine</h2>
          <p className="text-slate-500">Source-of-truth academic computation & reporting.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 flex gap-1">
            <button 
              onClick={() => setView('scoresheet')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${view === 'scoresheet' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              <Table className="w-3.5 h-3.5" />
              CA Scoresheet
            </button>
            <button 
              onClick={() => setView('result')}
              disabled={!computedResult}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${view === 'result' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50'}`}
            >
              <FileText className="w-3.5 h-3.5" />
              Report Card
            </button>
          </div>
          {view === 'result' && (
            <button className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">
              <Printer className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {view === 'scoresheet' ? (
          <motion.div 
            key="scoresheet"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Scoresheet Header Info */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Student Name</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{scoresheet.studentName}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Class / Section</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">SS3 / A</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Term / Session</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{scoresheet.term} • {scoresheet.session}</p>
              </div>
              <div className="flex items-center justify-end">
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  scoresheet.status === 'Draft' ? 'bg-slate-100 text-slate-600' :
                  scoresheet.status === 'Submitted' ? 'bg-amber-100 text-amber-600' :
                  'bg-emerald-100 text-emerald-600'
                }`}>
                  {scoresheet.status}
                </div>
              </div>
            </div>

            {/* Spreadsheet Table */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden relative">
              {/* Watermark Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.03] rotate-[-30deg]">
                <h1 className="text-[120px] font-black uppercase">NDOVERA ACADEMY</h1>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-16">S/N</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Subject</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">CA 1 (10)</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">CA 2 (10)</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Assign (10)</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Exam (70)</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Total (100)</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {scoresheet.subjects.map((subject, idx) => (
                      <tr key={subject.subjectId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                        <td className="px-6 py-4 text-xs text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{subject.subjectName}</p>
                        </td>
                        {[0, 1, 2].map(i => (
                          <td key={i} className="px-2 py-2 text-center">
                            <input 
                              type="number"
                              value={subject.caScores[i] || ''}
                              onChange={(e) => handleScoreChange(idx, 'ca', i, e.target.value)}
                              disabled={scoresheet.status !== 'Draft' && !isHoS}
                              className="w-16 p-2 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-emerald-500 focus:ring-0 text-center text-sm font-bold text-slate-700 dark:text-slate-300 transition-all disabled:opacity-50"
                            />
                          </td>
                        ))}
                        <td className="px-2 py-2 text-center">
                          <input 
                            type="number"
                            value={subject.examScore || ''}
                            onChange={(e) => handleScoreChange(idx, 'exam', 0, e.target.value)}
                            disabled={scoresheet.status !== 'Draft' && !isHoS}
                            className="w-20 p-2 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-emerald-500 focus:ring-0 text-center text-sm font-bold text-slate-700 dark:text-slate-300 transition-all disabled:opacity-50"
                          />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-sm font-black ${subject.total >= 40 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {subject.total}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-[10px] font-black px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-400">
                            {calculateGrade(subject.total)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 dark:bg-slate-800/50 font-black">
                      <td colSpan={6} className="px-6 py-4 text-right text-xs uppercase tracking-widest text-slate-500">Grand Total</td>
                      <td className="px-6 py-4 text-center text-emerald-600">{scoresheet.grandTotal}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Workflow Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-4">
                {isSaving && (
                  <div className="flex items-center gap-2 text-xs text-emerald-600 font-bold">
                    <Save className="w-3 h-3 animate-pulse" />
                    Auto-saving...
                  </div>
                )}
                <div className="flex -space-x-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold">
                      {i === 1 ? 'T' : i === 2 ? 'S' : 'H'}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500">Approval chain: Teacher → Sectional → HoS</p>
              </div>

              <div className="flex items-center gap-3">
                {isSubjectTeacher && scoresheet.status === 'Draft' && (
                  <button 
                    onClick={() => {
                      const updated = { ...scoresheet, status: 'Submitted' as const };
                      setScoresheet(updated);
                      saveToLocal(updated);
                    }}
                    className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Submit for Review
                  </button>
                )}
                {isSectionalHead && scoresheet.status === 'Submitted' && (
                  <button 
                    onClick={() => {
                      const updated = { ...scoresheet, status: 'Approved' as const, sectionalHeadApproved: true };
                      setScoresheet(updated);
                      saveToLocal(updated);
                    }}
                    className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all flex items-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Approve CA Scores
                  </button>
                )}
                {isClassTeacher && scoresheet.sectionalHeadApproved && scoresheet.status !== 'Computed' && (
                  <button 
                    onClick={handleCompute}
                    className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-200"
                  >
                    <Sparkles className="w-4 h-4" />
                    Compute Results
                  </button>
                )}
                {isHoS && scoresheet.status !== 'Draft' && (
                  <button 
                    onClick={() => {
                      const updated = { ...scoresheet, status: 'Draft' as const, sectionalHeadApproved: false };
                      setScoresheet(updated);
                      saveToLocal(updated);
                    }}
                    className="px-6 py-2.5 bg-rose-100 text-rose-600 rounded-xl text-sm font-bold hover:bg-rose-200 transition-all"
                  >
                    Re-open Scoresheet
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="result"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-4xl mx-auto"
          >
            {/* Report Card View */}
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative p-12 space-y-12">
              {/* Watermark */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.05] rotate-[-45deg]">
                <h1 className="text-[180px] font-black uppercase text-slate-900">NDOVERA</h1>
              </div>

              {/* Header */}
              <div className="relative z-10 flex items-start justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 bg-emerald-600 rounded-3xl flex items-center justify-center text-white font-black text-4xl shadow-xl">
                    N
                  </div>
                  <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">NDOVERA ACADEMY</h1>
                    <p className="text-sm font-bold text-emerald-600 uppercase tracking-widest">Excellence in Education</p>
                    <p className="text-xs text-slate-500 mt-2">123 School Road, Lagos, Nigeria • +234 800 NDOVERA</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="inline-block p-2 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <QrCode className="w-16 h-16 text-slate-800 dark:text-slate-200" />
                  </div>
                  <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase">Verify Result Online</p>
                </div>
              </div>

              {/* Student Bio */}
              <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-8 p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Student Name</p>
                  <p className="text-base font-black text-slate-900 dark:text-white">{computedResult?.studentName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Admission No</p>
                  <p className="text-base font-black text-slate-900 dark:text-white">NDV/2025/001</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Class</p>
                  <p className="text-base font-black text-slate-900 dark:text-white">{computedResult?.classLevel}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Term / Session</p>
                  <p className="text-base font-black text-slate-900 dark:text-white">{computedResult?.term} • {computedResult?.session}</p>
                </div>
              </div>

              {/* Academic Table */}
              <div className="relative z-10 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest">Subject</th>
                      <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-center">CA</th>
                      <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-center">Exam</th>
                      <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-center">Total</th>
                      <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-center">Grade</th>
                      <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-center">Pos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {computedResult?.subjects.map((s) => (
                      <tr key={s.subjectId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 text-sm font-bold text-slate-800 dark:text-slate-200">{s.subjectName}</td>
                        <td className="px-4 py-4 text-sm text-center text-slate-600 dark:text-slate-400">{s.scores.ca1 + s.scores.ca2 + s.scores.assignment}</td>
                        <td className="px-4 py-4 text-sm text-center text-slate-600 dark:text-slate-400">{s.scores.exam}</td>
                        <td className="px-4 py-4 text-sm font-black text-center text-emerald-600">{s.scores.total}</td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-xs font-black px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-slate-700 dark:text-slate-300">
                            {s.grade}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs text-center text-slate-400">{s.position}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Domains & Summary */}
              <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-6">
                  <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] border-b-2 border-emerald-600 pb-2 w-fit">Affective & Psychomotor</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {computedResult?.affective.map((a, idx) => (
                      <div key={a.name} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{a.name}</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map(i => (
                            <button 
                              key={i} 
                              onClick={() => handleDomainChange('affective', idx, i)}
                              disabled={computedResult?.locked}
                              className={`w-2 h-2 rounded-full transition-all ${i <= a.score ? 'bg-emerald-500 scale-125' : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300'}`} 
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-6">
                  <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] border-b-2 border-emerald-600 pb-2 w-fit">Performance Summary</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Overall Position:</span>
                      <span className="font-black text-emerald-600">{computedResult?.overallPosition}st out of 45</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Class Average:</span>
                      <span className="font-black text-slate-800 dark:text-white">{computedResult?.classAverage}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Attendance:</span>
                      <span className="font-black text-slate-800 dark:text-white">{computedResult?.attendance?.present} / {computedResult?.attendance?.total} days</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Comments & Signatures */}
              <div className="relative z-10 space-y-8 pt-8 border-t border-slate-100 dark:border-slate-800">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Class Teacher's Comment</p>
                    {isClassTeacher && !computedResult?.locked ? (
                      <textarea 
                        value={computedResult?.comments.classTeacher}
                        onChange={(e) => handleCommentChange('classTeacher', e.target.value)}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs italic text-slate-600 dark:text-slate-400 focus:ring-2 focus:ring-emerald-500"
                        rows={3}
                      />
                    ) : (
                      <p className="text-xs italic text-slate-600 dark:text-slate-400 leading-relaxed">"{computedResult?.comments.classTeacher}"</p>
                    )}
                    <div className="pt-4 flex flex-col items-center">
                      <div className="w-32 h-12 border-b border-slate-300 dark:border-slate-700 mb-2 flex items-center justify-center">
                        <PenTool className="w-6 h-6 text-slate-300" />
                      </div>
                      <p className="text-[10px] font-bold text-slate-500">Mr. John Doe</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sectional Head's Comment</p>
                    {isSectionalHead && !computedResult?.locked ? (
                      <textarea 
                        value={computedResult?.comments.sectionalHead}
                        onChange={(e) => handleCommentChange('sectionalHead', e.target.value)}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs italic text-slate-600 dark:text-slate-400 focus:ring-2 focus:ring-emerald-500"
                        rows={3}
                      />
                    ) : (
                      <p className="text-xs italic text-slate-600 dark:text-slate-400 leading-relaxed">"{computedResult?.comments.sectionalHead}"</p>
                    )}
                    <div className="pt-4 flex flex-col items-center">
                      <div className="w-32 h-12 border-b border-slate-300 dark:border-slate-700 mb-2 flex items-center justify-center">
                        <ShieldCheck className="w-6 h-6 text-slate-300" />
                      </div>
                      <p className="text-[10px] font-bold text-slate-500">Mrs. Sarah Smith</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">HoS Final Signature</p>
                    {isHoS && !computedResult?.locked ? (
                      <textarea 
                        value={computedResult?.comments.hos}
                        onChange={(e) => handleCommentChange('hos', e.target.value)}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs italic text-slate-600 dark:text-slate-400 focus:ring-2 focus:ring-emerald-500"
                        rows={3}
                      />
                    ) : (
                      <p className="text-xs italic text-slate-600 dark:text-slate-400 leading-relaxed">"{computedResult?.comments.hos}"</p>
                    )}
                    <div className="pt-4 flex flex-col items-center">
                      <div className="w-32 h-12 border-b-2 border-emerald-600 mb-2 flex items-center justify-center">
                        {computedResult?.locked ? (
                          <span className="font-serif italic text-xl text-slate-800 dark:text-white">Ndovera HoS</span>
                        ) : (
                          <Lock className="w-6 h-6 text-slate-300" />
                        )}
                      </div>
                      <p className="text-[10px] font-bold text-slate-500">Head of School</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Info */}
              <div className="relative z-10 pt-8 border-t border-slate-100 dark:border-slate-800 flex justify-between items-end">
                <div className="text-[8px] text-slate-400 space-y-1">
                  <p>REPORT GENERATED ON: {new Date().toLocaleString()}</p>
                  <p>VERSION: {computedResult?.version}.0 • SOURCE: {computedResult?.source}</p>
                  <p>© 2026 NDOVERA SCHOOL MANAGEMENT SYSTEM. ALL RIGHTS RESERVED.</p>
                </div>
                {isHoS && !computedResult?.locked && (
                  <button 
                    onClick={() => setComputedResult({ ...computedResult!, locked: true })}
                    className="px-8 py-3 bg-slate-900 dark:bg-black text-white rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center gap-2 shadow-xl"
                  >
                    <Lock className="w-4 h-4" />
                    Sign & Lock Result
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
