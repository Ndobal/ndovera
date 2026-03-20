import React, { useState, useEffect } from 'react';
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

// Simplified local types to avoid importing archive shared types
type CASubject = { subjectId: string; subjectName: string; caScores: number[]; examScore: number; total: number };
type CASpreadsheetEntry = { studentId: string; studentName: string; classId: string; session: string; term: string; subjects: CASubject[]; grandTotal: number; status: string; sectionalHeadApproved?: boolean };

type ComputedResult = any;

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
  subjects: MOCK_SUBJECTS.map(s => ({ subjectId: s.id, subjectName: s.name, caScores: [0,0,0], examScore: 0, total: 0 })),
  grandTotal: 0,
  status: 'Draft',
  sectionalHeadApproved: false
};

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

export default function ResultEngineModule({ role }: { role?: string }) {
  const [view, setView] = useState<'scoresheet' | 'result'>('scoresheet');
  const [scoresheet, setScoresheet] = useState<CASpreadsheetEntry>(INITIAL_SCORESHEET);
  const [computedResult, setComputedResult] = useState<ComputedResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('ndovera_scoresheet');
    if (saved) {
      try { setScoresheet(JSON.parse(saved)); } catch(e){ }
    }
  }, []);

  const saveToLocal = (data: CASpreadsheetEntry) => localStorage.setItem('ndovera_scoresheet', JSON.stringify(data));

  const handleScoreChange = (subjectIndex: number, scoreType: 'ca' | 'exam', scoreIndex: number, value: string) => {
    if (scoresheet.status !== 'Draft') return;
    const numValue = Math.min(100, Math.max(0, parseInt(value) || 0));
    const newScoresheet = { ...scoresheet };
    const subject = newScoresheet.subjects[subjectIndex];
    if (scoreType === 'ca') subject.caScores[scoreIndex] = numValue; else subject.examScore = numValue;
    subject.total = subject.caScores.reduce((a,b)=>a+b,0) + subject.examScore;
    newScoresheet.grandTotal = newScoresheet.subjects.reduce((acc,s)=>acc+s.total,0);
    setScoresheet(newScoresheet); saveToLocal(newScoresheet);
    setIsSaving(true); setTimeout(()=>setIsSaving(false),800);
  };

  const handleCompute = () => {
    if (!scoresheet.sectionalHeadApproved) { alert('Sectional Head must approve CA scores before computation.'); return; }
    const result: ComputedResult = { studentName: scoresheet.studentName, subjects: scoresheet.subjects.map((s,i)=>({ subjectId: s.subjectId, subjectName: s.subjectName, scores: { ca1: s.caScores[0], ca2: s.caScores[1], assignment: s.caScores[2], exam: s.examScore, total: s.total }, grade: calculateGrade(s.total), position: i+1 })), attendance: { present: 88, total: 90 }, overallPosition: 1, classAverage: 82.5 };
    setComputedResult(result); setScoresheet({ ...scoresheet, status: 'Computed' }); setView('result');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Result Engine</h2>
          <p className="text-sm text-slate-400">Source-of-truth academic computation & reporting.</p>
        </div>
        <div>
          <button onClick={()=>setView('scoresheet')} className={`px-4 py-2 rounded ${view==='scoresheet'? 'bg-emerald-600 text-white':''}`}>CA Scoresheet</button>
          <button onClick={()=>setView('result')} disabled={!computedResult} className={`px-4 py-2 rounded ml-2 ${view==='result'? 'bg-emerald-600 text-white':''}`}>Report Card</button>
        </div>
      </div>

      {view === 'scoresheet' ? (
        <div className="bg-slate-900 p-6 rounded-2xl">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-400 text-xs">
                <th className="px-4 py-2">S/N</th>
                <th className="px-4 py-2">Subject</th>
                <th className="px-4 py-2 text-center">CA1</th>
                <th className="px-4 py-2 text-center">CA2</th>
                <th className="px-4 py-2 text-center">Assign</th>
                <th className="px-4 py-2 text-center">Exam</th>
                <th className="px-4 py-2 text-center">Total</th>
                <th className="px-4 py-2 text-center">Grade</th>
              </tr>
            </thead>
            <tbody>
              {scoresheet.subjects.map((subject, idx)=> (
                <tr key={subject.subjectId} className="bg-slate-800">
                  <td className="px-4 py-2">{idx+1}</td>
                  <td className="px-4 py-2 font-bold">{subject.subjectName}</td>
                  {[0,1,2].map(i => (
                    <td key={i} className="px-2 py-2 text-center"><input type="number" value={subject.caScores[i]||''} onChange={(e)=>handleScoreChange(idx,'ca',i,e.target.value)} className="w-12 p-1 text-center rounded"/></td>
                  ))}
                  <td className="px-4 py-2 text-center"><input type="number" value={subject.examScore||''} onChange={(e)=>handleScoreChange(idx,'exam',0,e.target.value)} className="w-16 p-1 text-center rounded"/></td>
                  <td className="px-4 py-2 text-center font-black">{subject.total}</td>
                  <td className="px-4 py-2 text-center">{calculateGrade(subject.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-slate-400">Approval chain: Teacher → Sectional → HoS</div>
            <div>
              {!scoresheet.sectionalHeadApproved && <button onClick={()=>{ setScoresheet({...scoresheet, sectionalHeadApproved:true}); saveToLocal(scoresheet); }} className="px-4 py-2 bg-emerald-600 text-white rounded">Approve CA Scores</button>}
              {scoresheet.sectionalHeadApproved && <button onClick={handleCompute} className="px-4 py-2 bg-emerald-600 text-white rounded ml-2">Compute Results</button>}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-2xl">
          <h3 className="text-lg font-bold">Report Card - {computedResult?.studentName}</h3>
          <table className="w-full mt-4">
            <thead>
              <tr className="bg-slate-100 text-slate-600 text-xs">
                <th className="px-4 py-2">Subject</th>
                <th className="px-4 py-2 text-center">CA</th>
                <th className="px-4 py-2 text-center">Exam</th>
                <th className="px-4 py-2 text-center">Total</th>
                <th className="px-4 py-2 text-center">Grade</th>
              </tr>
            </thead>
            <tbody>
              {computedResult?.subjects.map((s:any)=>(
                <tr key={s.subjectId} className="border-b">
                  <td className="px-4 py-2 font-bold">{s.subjectName}</td>
                  <td className="px-4 py-2 text-center">{s.scores.ca1+s.scores.ca2+s.scores.assignment}</td>
                  <td className="px-4 py-2 text-center">{s.scores.exam}</td>
                  <td className="px-4 py-2 text-center font-black">{s.scores.total}</td>
                  <td className="px-4 py-2 text-center">{s.grade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
