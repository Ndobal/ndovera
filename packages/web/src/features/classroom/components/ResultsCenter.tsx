import { useMemo, useState, useRef } from 'react';
import { BadgeCheck, Download, Lock, TrendingUp, ChevronDown, Image as ImageIcon, Settings2, Check } from 'lucide-react';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';

import { useData } from '../../../hooks/useData';
import { resultSessions, studentResultSessions } from '../data/classroomExperience';
import { type ResultSession } from '../services/classroomApi';

type ResultsCenterProps = {
  role: string;
};

export function ResultsCenter({ role }: ResultsCenterProps) {
  const teacherView = role === 'Teacher' || role === 'School Admin' || role === 'HoS' || role === 'Owner' || role === 'ICT' || role === 'ICT Manager';
  const canCustomize = ['HoS', 'Owner', 'ICT', 'ICT Manager', 'School Admin'].includes(role);
  const documentRef = useRef<HTMLDivElement>(null);
  
  // Customization States
  const [showConfig, setShowConfig] = useState(false);
  const [examType, setExamType] = useState<'end-term' | 'mid-term'>('end-term');
  const [schoolColor, setSchoolColor] = useState('#0f172a');
  const [logoSize, setLogoSize] = useState(64);
  const [logoPos, setLogoPos] = useState(50);
  const [ratingScale, setRatingScale] = useState('A: 70-100 (Excellent) | B: 60-69 (Very Good) | C: 50-59 (Credit) | D: 40-49 (Pass) | E: 0-39 (Fail)');
  const [affectiveTraits, setAffectiveTraits] = useState('Punctuality, Neatness, Politeness, Honesty, Initiative, Self-Control, Teamwork');
  const [logoUrl, setLogoUrl] = useState('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0MDAgNDAwIj4KICA8cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzBEOEFCQyIgLz4KICA8dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2ZmZmZmZiIgZm9udC1zaXplPSIyMDAiIGZvbnQtZmFtaWx5PSJBcmlhbCxHZW5ldmEsc2Fucy1zZXJpZiI+TkQ8L3RleHQ+Cjwvc3ZnPg==');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const handleDownloadPDF = async () => {
    if (!documentRef.current || isGenerating) return;
    try {
       setIsGenerating(true);
       
       const nodeWidth = documentRef.current.offsetWidth;
       const nodeHeight = documentRef.current.offsetHeight;
       
       const imgData = await toJpeg(documentRef.current, {
           quality: 1,
           pixelRatio: 2,
           style: {
               backgroundColor: '#ffffff',
           }
       });
       
       const pdf = new jsPDF('p', 'mm', 'a4');
       
       const pdfWidth = pdf.internal.pageSize.getWidth();
       const pdfHeight = (nodeHeight * pdfWidth) / nodeWidth;
       
       pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
       pdf.save(`Result_${activeSession?.session?.replace(/\//g, '-')}_${activeTerm?.name || 'Term'}.pdf`);
    } catch (err: any) {
       console.error("Failed to generate PDF:", err);
       alert(`An error occurred generating the document layout: ${err?.message || err}`);
    } finally {
       setIsGenerating(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!documentRef.current || isGenerating) return;
    try {
       setIsGenerating(true);
       
       const imgData = await toJpeg(documentRef.current, {
           quality: 1,
           pixelRatio: 2,
           style: {
               backgroundColor: '#ffffff',
           }
       });
       
       const link = document.createElement('a');
       link.download = `Result_${activeSession?.session?.replace(/\//g, '-')}_${activeTerm?.name || 'Term'}.jpg`;
       link.href = imgData;
       link.click();
    } catch (err: any) {
       console.error("Failed to generate Image:", err);
       alert(`An error occurred saving the image. Try checking external image links: ${err?.message || err}`);
    } finally {
       setIsGenerating(false);
    }
  };

  const [selectedStudentIndex, setSelectedStudentIndex] = useState(0);
   const savedScoreSheet = useMemo(() => {
      try {
         const raw = localStorage.getItem('ndovera_scoresheet_state_v2');
         if (!raw) return null;
         const parsed = JSON.parse(raw);
         if (!Array.isArray(parsed?.scores) || !parsed.scores.length) return null;
         return parsed;
      } catch {
         return null;
      }
   }, []);

   const teacherStudents = useMemo(() => {
      if (!savedScoreSheet?.scores?.length) return studentResultSessions;
      return savedScoreSheet.scores.map((student: any) => {
         const total = Math.round((student.ca1 || 0) + (student.ca2 || 0) + (student.midTerm || 0) + (student.exam || 0));
         const grade = total >= 70 ? 'A' : total >= 60 ? 'B' : total >= 50 ? 'C' : total >= 40 ? 'D' : 'F';
         const remark = total >= 70 ? 'Excellent' : total >= 60 ? 'Very Good' : total >= 50 ? 'Credit' : total >= 40 ? 'Pass' : 'Fail';
         return {
            id: student.id,
            name: student.name,
            sessions: [
               {
                  session: '2025/2026',
                  feeStatus: 'Paid',
                  outstanding: 'N0',
                  terms: [
                     {
                        name: 'Term 3',
                        summary: {
                           average: `${total}%`,
                           grade,
                           position: 'Pending',
                           attendance: 'Pending',
                           promotion: total >= 40 ? 'Promoted' : 'Pending review',
                           teacherRemark: student.comment || 'No class teacher remark entered yet.',
                           principalRemark: student.headComment || 'No HoS remark entered yet.',
                           teacherSignature: student.teacherSignature || 'Pending',
                           principalSignature: student.headSignature || 'Pending',
                        },
                        subjects: [
                           {
                              subject: savedScoreSheet.selectedSubject || 'Selected Subject',
                              ca: Math.round((student.ca1 || 0) + (student.ca2 || 0) + (student.midTerm || 0)),
                              exam: student.exam || 0,
                              total,
                              grade,
                              remark,
                           },
                        ],
                        trend: [String(Math.max(total - 8, 0)), String(Math.max(total - 4, 0)), String(total)],
                     },
                  ],
               },
            ],
         };
      });
   }, [savedScoreSheet]);

   const selectedStudentData = teacherStudents[selectedStudentIndex] || teacherStudents[0];
  const { data } = useData<{ sessions: ResultSession[] }>('/api/classroom/results');

  const sessions = useMemo(() => {
    if (teacherView) return selectedStudentData.sessions;
    return data?.sessions?.length ? data.sessions : resultSessions;
  }, [data, teacherView, selectedStudentData]);
  
  // Sort sessions newest first (assuming format YYYY/YYYY)
  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => b.session.localeCompare(a.session));
  }, [sessions]);

  const [activeSessionId, setActiveSessionId] = useState<string>(sortedSessions[0]?.session || '');
  const activeSession = useMemo(() => sortedSessions.find(s => s.session === activeSessionId) || sortedSessions[0], [sortedSessions, activeSessionId]);

  // Sort terms newest first (e.g. Term 3, Term 2, Term 1)
  const sortedTerms = useMemo(() => {
    if (!activeSession) return [];
    return [...activeSession.terms].sort((a, b) => {
      const numA = parseInt(a.name.replace(/\D/g, '') || '0', 10);
      const numB = parseInt(b.name.replace(/\D/g, '') || '0', 10);
      return numB - numA;
    });
  }, [activeSession]);

  const [activeTermName, setActiveTermName] = useState<string>(sortedTerms[0]?.name || '');
  const activeTerm = useMemo(() => sortedTerms.find(t => t.name === activeTermName) || sortedTerms[0], [sortedTerms, activeTermName]);

  // Handle term switch when session changes
  useMemo(() => {
    if (sortedTerms.length > 0 && !sortedTerms.find(t => t.name === activeTermName)) {
      setActiveTermName(sortedTerms[0].name);
    }
  }, [sortedTerms, activeTermName]);

  const downloadText = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!sessions.length) {
    return (
      <div className="flex h-64 items-center justify-center rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <p className="text-slate-500 dark:text-slate-400">No official records available yet.</p>
      </div>
    );
  }

  const isLocked = activeSession?.feeStatus === 'Unpaid';

   return (
      <div className="space-y-6 h-[calc(100vh-200px)] overflow-y-auto pr-1 custom-scrollbar">
      {/* Navigation & Selectors */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-4">
        {/* Level 2: Term Tabs Inside Session */}
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-none flex-1">
          {sortedTerms.map(term => (
            <button
              key={term.name}
              onClick={() => setActiveTermName(term.name)}
              className={`whitespace-nowrap rounded-full px-6 py-2.5 text-sm font-medium transition-colors ${
                activeTermName === term.name
                  ? 'bg-sky-50 text-sky-700 border-2 border-sky-300 font-bold shadow-sm dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/50'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 shadow-sm dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'
              }`}
            >
              {term.name}
            </button>
          ))}
        </div>

        <div className="flex gap-4">
          {/* Student Selector for Teachers */}
          {teacherView && (
            <div className="relative min-w-50 shrink-0">
              <select
                value={selectedStudentIndex}
                onChange={(e) => setSelectedStudentIndex(Number(e.target.value))}
                className="w-full appearance-none rounded-full border border-slate-200 bg-white px-5 py-2.5 pr-10 text-sm font-bold text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              >
                                    {teacherStudents.map((student: any, idx: number) => (
                  <option key={student.id} value={idx}>{student.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
            </div>
          )}

          {/* Level 1: Session Selector */}
          <div className="relative min-w-50 shrink-0">
            <select
              value={activeSessionId}
              onChange={(e) => setActiveSessionId(e.target.value)}
              className="w-full appearance-none rounded-full border border-slate-200 bg-white px-5 py-2.5 pr-10 text-sm font-bold text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            >
              {sortedSessions.map(s => (
                <option key={s.session} value={s.session}>Session {s.session}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
          </div>
        </div>
      </div>

      {/* Level 3: Exam Type Tabs */}
      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setExamType('mid-term')}
          className={`px-4 py-2 border-b-2 text-sm font-bold transition-all ${
            examType === 'mid-term' 
              ? 'border-sky-500 text-sky-600 dark:border-sky-400 dark:text-sky-300' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
          }`}
        >
          Mid-Term Result
        </button>
        <button
          onClick={() => setExamType('end-term')}
          className={`px-4 py-2 border-b-2 text-sm font-bold transition-all ${
            examType === 'end-term' 
              ? 'border-sky-500 text-sky-600 dark:border-sky-400 dark:text-sky-300' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
          }`}
        >
          {activeTermName.toLowerCase().includes('3') ? 'Terminal & Cumulative Result' : 'End of Term Result'}
        </button>
      </div>

      {/* Fee Gating Logic */}
      {isLocked ? (
        <section className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 p-12 text-center shadow-sm dark:bg-slate-800 dark:border-slate-700">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
            <Lock className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Result Locked</h3>
          <p className="mt-2 max-w-md text-slate-600 dark:text-slate-400">
            This result is currently locked due to outstanding fee balances. Once the balance is cleared, the result will unlock instantly.
          </p>
          <div className="mt-6 rounded-2xl bg-white p-4 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-700">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Outstanding Balance</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{activeSession.outstanding}</p>
          </div>
          <button type="button" className="mt-6 rounded-full bg-sky-600 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 transition dark:bg-sky-500 dark:hover:bg-sky-600">
            Pay Now
          </button>
        </section>
      ) : activeTerm ? (
        <div className="space-y-6">
          {/* Settings Overlay for Teachers */}
          {canCustomize && showConfig && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm mb-6 print:hidden dark:bg-slate-800 dark:border-slate-700">
               <h3 className="text-sm font-bold text-slate-800 mb-4 border-b pb-2 dark:text-slate-200 dark:border-slate-700">Document Customization</h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1 dark:text-slate-400">School Color</label>
                    <input type="color" value={schoolColor} onChange={e => setSchoolColor(e.target.value)} className="w-full h-8 cursor-pointer rounded" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1 dark:text-slate-400">Logo Size: {logoSize}px</label>
                    <input type="range" min="30" max="150" value={logoSize} onChange={e => setLogoSize(Number(e.target.value))} className="w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1 dark:text-slate-400">Logo Position: {logoPos}%</label>
                    <input type="range" min="0" max="100" value={logoPos} onChange={e => setLogoPos(Number(e.target.value))} className="w-full" />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1 dark:text-slate-400">Rating Scale Key</label>
                    <input type="text" value={ratingScale} onChange={e => setRatingScale(e.target.value)} className="w-full border border-slate-200 rounded px-3 py-1.5 text-sm dark:bg-slate-900 dark:border-slate-700 dark:text-white" />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1 dark:text-slate-400">Affective Domain Traits (comma separated)</label>
                    <input type="text" value={affectiveTraits} onChange={e => setAffectiveTraits(e.target.value)} className="w-full border border-slate-200 rounded px-3 py-1.5 text-sm dark:bg-slate-900 dark:border-slate-700 dark:text-white" />
                  </div>
               </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 transition-opacity">
            {canCustomize && (
             <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 shadow-sm print:hidden mr-auto dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700"
             >
               <Settings2 className="h-4 w-4" />
               Customize
             </button>
            )}
             <button
              type="button"
              onClick={handleDownloadImage}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm print:hidden disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700"
            >
              <ImageIcon className="h-4 w-4" />
              {isGenerating ? "Processing..." : "Save as Image"}
            </button>
             <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm print:hidden disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700"
            >
              <Download className="h-4 w-4" />
              {isGenerating ? "Processing..." : "Print / Save as PDF"}
            </button>
          </div>

          {/* Full A4 Printable Canvas */}
          <div className="w-full overflow-x-auto pb-8 flex justify-center bg-stone-100 dark:bg-stone-900/50 p-4 rounded-xl">
            <div ref={documentRef} className="relative w-[210mm] h-[297mm] overflow-hidden shadow-2xl print:shadow-none print:m-0 print:p-0 result-theme bg-white" style={{ backgroundColor: '#ffffff' }}>
              <style>{`
               .result-theme {
                  --tw-border-opacity: 1;
               }
               .result-theme * {
                  border-color: ${schoolColor} !important;
               }
               .result-theme .stamp-mock, .result-theme .stamp-mock * {
                  border-color: #ef4444 !important;
                  color: #ef4444 !important;
               }
               .result-theme .text-slate-900,
               .result-theme .text-slate-800,
               .result-theme .text-slate-700,
               .result-theme .text-slate-600,
               .result-theme .text-slate-500 {
                  color: ${schoolColor} !important;
               }
               .result-theme th.text-white,
               .result-theme th.text-white > *,
               .result-theme .force-white {
                 color: #ffffff !important;
               }
               .result-theme .bg-slate-50,
               .result-theme .bg-slate-100 {
                  background-color: ${schoolColor}10 !important;
               }
               .result-theme .bg-white {
                  background-color: ${schoolColor}03 !important;
               }
            `}</style>
            
            {/* Background Pattern & Watermark */}
            <div 
               className="absolute inset-0 pointer-events-none z-0" 
               style={{ backgroundImage: `radial-gradient(${schoolColor}15 1px, transparent 1px)`, backgroundSize: '16px 16px' }} 
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-10 select-none">
               <img src={logoUrl} alt="Watermark" className="w-112.5 h-112.5 object-contain grayscale-20 opacity-50" />
            </div>

            <div className="relative z-10 p-5">
               {/* Header / Letterhead */}
               <header className="border-b-[3px] pb-2 mb-2 flex items-center justify-between" style={{ borderColor: schoolColor }}>
                  <div className="flex items-center gap-4">
                     <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center overflow-hidden border-2" style={{ borderColor: schoolColor }}>
                        <span className="text-xl font-black text-white mix-blend-difference">NA</span>
                     </div>
                     <div className="text-left">
                        <h1 className="text-3xl font-black uppercase tracking-widest font-serif" style={{ color: schoolColor }}>Ndovera Academy</h1>
                        <p className="text-xs font-semibold tracking-widest mt-0.5 uppercase" style={{ color: `${schoolColor}CC` }}>Excellence, Innovation, Character</p>
                        <p className="text-[10px] text-slate-600 mt-1 font-medium">123 Education Boulevard, Knowledge City | info@ndovera.edu | +234 800 000 0000</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-4">
                     <div className="text-white force-white px-3 py-2 rounded text-xs font-bold uppercase tracking-widest text-center shadow-sm" style={{ backgroundColor: schoolColor }}>
                        Official<br/>Academic<br/>Record
                     </div>
                     <div className="w-17.5 h-20 bg-slate-100 border-2 rounded flex flex-col items-center justify-center overflow-hidden" style={{ borderColor: schoolColor }}>
                        <div className="w-8 h-8 rounded-full bg-slate-200 mb-1" />
                        <div className="w-12 h-6 rounded-t-full bg-slate-200" />
                     </div>
                  </div>
               </header>

               {/* Student & Term Information - Full Borders */}
               <section className="mb-2.5 overflow-hidden border border-slate-900 rounded-sm" style={{ backgroundColor: `${schoolColor}15` }}>
                  <table className="w-full text-xs text-left">
                     <tbody>
                        <tr className="divide-x divide-slate-900 border-b border-slate-900">
                           <td className="p-2 border-r border-slate-900"><span className="font-bold text-slate-600 mr-2 uppercase text-[11px]">Name:</span> <span className="uppercase font-bold text-slate-900">{teacherView ? selectedStudentData.name : selectedStudentData.name}</span></td>
                           <td className="p-2"><span className="font-bold text-slate-600 mr-2 uppercase text-[11px]">Session:</span> <span className="font-bold text-slate-900">{activeSession.session}</span></td>
                        </tr>
                        <tr className="divide-x divide-slate-900 border-b border-slate-900">
                           <td className="p-2 border-r border-slate-900"><span className="font-bold text-slate-600 mr-2 uppercase text-[11px]">Class:</span> <span className="font-bold text-slate-900">JSS 3A</span></td>
                           <td className="p-2"><span className="font-bold text-slate-600 mr-2 uppercase text-[11px]">Term:</span> <span className="font-bold text-slate-900">{activeTerm.name}</span></td>
                        </tr>
                        <tr className="divide-x divide-slate-900">
                           <td className="p-2 border-r border-slate-900"><span className="font-bold text-slate-600 mr-2 uppercase text-[11px]">Admission No:</span> <span className="font-bold text-slate-900">NDV/2021/001</span></td>
                           <td className="p-2"><span className="font-bold text-slate-600 mr-2 uppercase text-[11px]">Attendance:</span> <span className="font-bold text-slate-900">Present: 110 out of 120</span></td>
                        </tr>
                     </tbody>
                  </table>
               </section>

               {/* Student Performance Summary */}
               <section className="grid grid-cols-4 gap-0 border border-slate-900 text-sm mb-2 rounded-sm overflow-hidden">
                  <div className="border-r border-slate-900 p-1.5 text-center" style={{ backgroundColor: `${schoolColor}15` }}>
                     <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: schoolColor }}>Overall Avg</p>
                     <p className="text-base font-black mt-0.5 text-slate-900">{activeTerm.summary.average}</p>
                  </div>
                  <div className="border-r border-slate-900 p-1.5 text-center bg-white">
                     <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: schoolColor }}>Grade</p>
                     <p className="text-base font-black mt-0.5 text-slate-900">{activeTerm.summary.grade}</p>
                  </div>
                  <div className="border-r border-slate-900 p-1.5 text-center" style={{ backgroundColor: `${schoolColor}15` }}>
                     <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: schoolColor }}>Position</p>
                     <p className="text-base font-black mt-0.5 text-slate-900">{(activeTerm as any).allowPosition !== false ? activeTerm.summary.position : 'N/A'}</p>
                  </div>
                  <div className="p-1.5 text-center bg-white flex flex-col items-center justify-center relative">
                     {(activeTerm.name.toLowerCase().includes('3')) ? (
                       <div className={`mt-0.5 border-[3px] rounded-sm px-3 py-1 inline-block transform -rotate-6 shadow-sm z-10 ${
                         (activeTerm.summary.promotion || 'Promoted').toLowerCase() === 'promoted' 
                           ? 'border-emerald-500 text-emerald-600 bg-emerald-50' 
                           : 'border-amber-500 text-amber-600 bg-amber-50'
                       }`}>
                         <p className="text-xs font-black uppercase tracking-widest stamp-mock">{(activeTerm.summary.promotion || 'Promoted')}</p>
                       </div>
                     ) : (
                       <>
                         <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: schoolColor }}>Status</p>
                         <p className="text-sm font-black mt-1 uppercase whitespace-nowrap overflow-hidden text-ellipsis text-slate-900">{activeTerm.summary.promotion || 'Pass'}</p>
                       </>
                     )}
                  </div>
               </section>

               {/* Cognitive Report (Full Borders) */}
               <section className="mb-2 flex gap-3">
                  <div className="flex-1">
                     <div className="mb-1">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-white force-white px-3 py-1 inline-block border border-slate-900 rounded-sm shadow-sm" style={{ backgroundColor: schoolColor }}>Cognitive Report</h3>
                     </div>
                     <table className="w-full text-xs text-left border-collapse border border-slate-900">
                        <thead className="text-white" style={{ backgroundColor: schoolColor }}>
                           {examType === 'mid-term' ? (
                             <tr>
                                <th className="border border-slate-900 px-2 py-1 font-bold uppercase tracking-wider text-white text-left" style={{ color: '#ffffff' }}>Subject</th>
                                <th className="border border-slate-900 px-1 py-1 font-bold uppercase tracking-wider text-center w-24 text-white" style={{ color: '#ffffff' }}>Mid-Term (20)</th>
                                <th className="border border-slate-900 px-1 py-1 font-bold uppercase tracking-wider text-center w-16 text-white" style={{ color: '#ffffff' }}>Grade</th>
                                <th className="border border-slate-900 px-2 py-1 font-bold uppercase tracking-wider w-32 text-white" style={{ color: '#ffffff' }}>Ext. Remark</th>
                             </tr>
                           ) : activeTerm.name.toLowerCase().includes('3') ? (
                             <tr>
                                <th className="border border-slate-900 px-2 py-1 font-bold uppercase tracking-wider text-white text-left" style={{ color: '#ffffff' }}>Subject</th>
                                <th className="border border-slate-900 px-1 py-1 font-bold uppercase text-[9px] tracking-wider text-center w-10 text-white" style={{ color: '#ffffff' }}>1st Term</th>
                                <th className="border border-slate-900 px-1 py-1 font-bold uppercase text-[9px] tracking-wider text-center w-10 text-white" style={{ color: '#ffffff' }}>2nd Term</th>
                                <th className="border border-slate-900 px-1 py-1 font-bold uppercase text-[9px] tracking-wider text-center w-10 text-white" style={{ color: '#ffffff' }}>3rd Term</th>
                                <th className="border border-slate-900 px-1 py-1 font-bold uppercase text-[9px] tracking-wider text-center w-12 bg-black/10 text-white" style={{ color: '#ffffff' }}>Cum. Total</th>
                                <th className="border border-slate-900 px-1 py-1 font-bold uppercase text-[9px] tracking-wider text-center w-10 text-white" style={{ color: '#ffffff' }}>Cum. Avg</th>
                                <th className="border border-slate-900 px-1 py-1 font-bold uppercase tracking-wider text-center w-12 text-white" style={{ color: '#ffffff' }}>Grade</th>
                                <th className="border border-slate-900 px-2 py-1 font-bold uppercase tracking-wider w-24 text-white" style={{ color: '#ffffff' }}>Remark</th>
                             </tr>
                           ) : (
                             <tr>
                                <th className="border border-slate-900 px-2 py-1 font-bold uppercase tracking-wider text-white text-left" style={{ color: '#ffffff' }}>Subject</th>
                                <th className="border border-slate-900 px-1 py-1 font-bold uppercase tracking-wider text-center w-12 text-white" style={{ color: '#ffffff' }}>CA</th>
                                <th className="border border-slate-900 px-1 py-1 font-bold uppercase tracking-wider text-center w-12 text-white" style={{ color: '#ffffff' }}>Exam</th>
                                <th className="border border-slate-900 px-1 py-1 font-bold uppercase tracking-wider text-center w-12 bg-black/10 text-white" style={{ color: '#ffffff' }}>Total</th>
                                <th className="border border-slate-900 px-1 py-1 font-bold uppercase tracking-wider text-center w-16 text-white" style={{ color: '#ffffff' }}>Grade</th>
                                <th className="border border-slate-900 px-2 py-1 font-bold uppercase tracking-wider w-32 text-white" style={{ color: '#ffffff' }}>Remark</th>
                             </tr>
                           )}
                        </thead>
                        <tbody style={{ backgroundColor: `${schoolColor}10` }}>
                                        {activeTerm.subjects.map((subject: any, idx: number) => {
                             const isCum = activeTerm.name.toLowerCase().includes('3') && examType === 'end-term';
                                           const t1 = activeSession.terms.find((t: any) => t.name.includes('1'))?.subjects.find((s: any) => s.subject === subject.subject)?.total || 0;
                                           const t2 = activeSession.terms.find((t: any) => t.name.includes('2'))?.subjects.find((s: any) => s.subject === subject.subject)?.total || 0;
                             const t3 = subject.total || 0;
                             const cumTotal = t1 + t2 + t3;
                             const divisor = [t1, t2, t3].filter(x => x > 0).length || 1;
                             const cumAvg = (cumTotal / divisor).toFixed(1);

                             // Helper to display inputs for mid-terms if teacher
                             const isMidTerm = examType === 'mid-term';
                             const c_ca = subject.ca || 0;
                             // Recalculated for display or if teacher view
                             
                             return (
                                <tr key={idx} className="h-[1.1rem] even:bg-black/5 text-[10px]">
                                   <td className="border border-slate-900 px-2 py-0 font-bold text-slate-900">{subject.subject || '\u00A0'}</td>
                                   
                                   {isMidTerm ? (
                                     <>
                                       <td className="border border-slate-900 px-1 py-0 text-center font-bold text-slate-800">
                                         {teacherView ? (
                                            <input type="number" defaultValue={(c_ca / 40) * 20} className="w-full bg-white/50 text-center border-b border-sky-300 focus:outline-none" />
                                         ) : subject.subject ? ((c_ca / 40) * 20).toFixed(0) : ''}
                                       </td>
                                       <td className="border border-slate-900 px-1 py-0 text-center font-black" style={{ color: schoolColor }}>{subject.subject ? subject.grade : ''}</td>
                                       <td className="border border-slate-900 px-2 py-0 text-slate-900 text-[9px] uppercase font-bold truncate max-w-32">{subject.subject ? subject.remark : ''}</td>
                                     </>
                                   ) : isCum ? (
                                     <>
                                       <td className="border border-slate-900 px-1 py-0 text-center font-bold text-slate-800">{subject.subject ? t1 || '-' : ''}</td>
                                       <td className="border border-slate-900 px-1 py-0 text-center font-bold text-slate-800">{subject.subject ? t2 || '-' : ''}</td>
                                       <td className="border border-slate-900 px-1 py-0 text-center font-bold text-slate-800">{subject.subject ? t3 || '-' : ''}</td>
                                       <td className="border border-slate-900 px-1 py-0 text-center font-black bg-black/5">{subject.subject ? cumTotal : ''}</td>
                                       <td className="border border-slate-900 px-1 py-0 text-center">{subject.subject ? cumAvg : ''}</td>
                                       <td className="border border-slate-900 px-1 py-0 text-center font-black" style={{ color: schoolColor }}>{subject.subject ? subject.grade : ''}</td>
                                       <td className="border border-slate-900 px-2 py-0 text-slate-900 text-[9px] uppercase font-bold truncate max-w-20">{subject.subject ? subject.remark : ''}</td>
                                     </>
                                   ) : (
                                     <>
                                       <td className="border border-slate-900 px-1 py-0 text-center font-bold text-slate-800">{subject.subject ? subject.ca : ''}</td>
                                       <td className="border border-slate-900 px-1 py-0 text-center font-bold text-slate-800">{subject.subject ? subject.exam : ''}</td>
                                       <td className="border border-slate-900 px-1 py-0 text-center font-black bg-black/5">{subject.subject ? subject.total : ''}</td>
                                       <td className="border border-slate-900 px-1 py-0 text-center font-black" style={{ color: schoolColor }}>{subject.subject ? subject.grade : ''}</td>
                                       <td className="border border-slate-900 px-2 py-0 text-slate-900 text-[9px] uppercase font-bold truncate max-w-32">{subject.subject ? subject.remark : ''}</td>
                                     </>
                                   )}
                                </tr>
                             );
                           })}
                        </tbody>
                     </table>
                  </div>
                  {/* Rating Column Layout */}
                  <div className="w-32 flex mt-8 flex-col gap-1 shrink-0">
                     <div className="border border-slate-900 rounded-sm shadow-sm p-2 text-[9px]" style={{ backgroundColor: `${schoolColor}15` }}>
                        <div className="font-black text-center mb-1.5 border-b border-slate-900 pb-1" style={{ color: schoolColor }}>GRADING KEY</div>
                        <div className="flex flex-col gap-1.5 font-bold text-slate-900 mt-1.5">
                           {ratingScale.split('|').map((item, i) => (
                              <div key={i}>{item.trim()}</div>
                           ))}
                        </div>
                     </div>
                  </div>
               </section>

               {/* Next section: Affective & Psychomotor / Physical */}
                 <div className={`grid ${examType === 'mid-term' ? 'grid-cols-1 max-w-2xl mx-auto' : 'grid-cols-2'} gap-3 mb-2 break-inside-avoid`}>
                  {/* Affective Form */}
                  <section className="flex gap-3">
                     <div className="flex-1">
                        <h3 className="text-xs font-bold uppercase tracking-widest mb-1 border-b-2 pb-0.5" style={{ borderColor: schoolColor, color: schoolColor }}>Affective Domain</h3>
                        <div className="border border-slate-900 rounded-sm" style={{ backgroundColor: `${schoolColor}15` }}>
                           <table className="w-full text-[10px]">
                              <thead style={{ backgroundColor: schoolColor }} className="text-white">
                                 <tr className="border-b border-slate-900 mb-1">
                                    <th className="text-left font-bold p-1 pl-2 uppercase text-white" style={{ color: '#ffffff' }}>Trait</th>
                                    <th className="text-center font-bold p-1 text-white" style={{ color: '#ffffff' }}>5</th>
                                    <th className="text-center font-bold p-1 text-white" style={{ color: '#ffffff' }}>4</th>
                                    <th className="text-center font-bold p-1 text-white" style={{ color: '#ffffff' }}>3</th>
                                    <th className="text-center font-bold p-1 text-white" style={{ color: '#ffffff' }}>2</th>
                                    <th className="text-center font-bold p-1 text-white" style={{ color: '#ffffff' }}>1</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-400">
                                 {affectiveTraits.split(',').map(t => t.trim()).filter(Boolean).map((trait, i) => {
                                    // Simple mock ratings
                                    const rating = [5, 5, 4, 5, 5, 4, 3, 4, 5, 5][i % 10];
                                    return (
                                    <tr key={i} className="even:bg-white/50 h-4">
                                       <td className="p-0.5 pl-2 text-slate-900 font-bold">{trait}</td>
                                       {[5, 4, 3, 2, 1].map((val) => (
                                          <td key={val} className="p-0.5 text-center border-l border-slate-400">
                                             <div className={`w-3 h-3 mx-auto flex items-center justify-center`}>
                                                {val === rating ? (
                                                   <Check strokeWidth={4} className="w-3 h-3" style={{ color: schoolColor }} />
                                                ) : null}
                                             </div>
                                          </td>
                                       ))}
                                    </tr>
                                    );
                                 })}
                              </tbody>
                           </table>
                        </div>
                     </div>
                     {/* Traits Key Column */}
                     <div className="w-24 mt-6 flex flex-col shrink-0">
                         <div className="border border-slate-900 rounded-sm p-1.5 text-[8px] font-bold text-slate-900" style={{ backgroundColor: `${schoolColor}15` }}>
                            <div className="text-center font-black border-b border-slate-900 pb-0.5 mb-1 uppercase" style={{ color: schoolColor }}>Key</div>
                            <ul className="space-y-1">
                               <li>5 - Excellent</li>
                               <li>4 - Very Good</li>
                               <li>3 - Good</li>
                               <li>2 - Fair</li>
                               <li>1 - Poor</li>
                            </ul>
                         </div>
                     </div>
                  </section>

                  {/* Physical Development & Psychomotor */}
                  {examType !== 'mid-term' && (
                    <section>
                        <h3 className="text-xs font-bold uppercase tracking-widest mb-1 border-b-2 pb-0.5" style={{ borderColor: schoolColor, color: schoolColor }}>Physical Development</h3>
                        <div className="border border-slate-900 rounded-sm p-3 space-y-2 bg-white">
                           <div className="flex justify-between items-center border-b border-dotted border-slate-300 pb-1">
                               <span className="text-[10px] font-bold text-slate-800 uppercase">Height (Beg. Term)</span>
                               <span className="text-[11px] font-black">1.52 m</span>
                           </div>
                           <div className="flex justify-between items-center border-b border-dotted border-slate-300 pb-1">
                               <span className="text-[10px] font-bold text-slate-800 uppercase">Height (End Term)</span>
                               <span className="text-[11px] font-black">1.54 m</span>
                           </div>
                           <div className="flex justify-between items-center border-b border-dotted border-slate-300 pb-1">
                               <span className="text-[10px] font-bold text-slate-800 uppercase">Weight (Beg. Term)</span>
                               <span className="text-[11px] font-black">42 kg</span>
                           </div>
                           <div className="flex justify-between items-center">
                               <span className="text-[10px] font-bold text-slate-800 uppercase">Weight (End Term)</span>
                               <span className="text-[11px] font-black">43.5 kg</span>
                           </div>
                        </div>
                    </section>
                  )}                 </div>
               {/* Comments and Signatures */}
               <section className="space-y-3 break-inside-avoid text-xs">
                  <div className="border border-slate-900 p-2 relative rounded-sm bg-slate-50">
                     <p className="text-[9px] font-bold uppercase tracking-widest absolute -top-2 left-4 px-1" style={{ backgroundColor: '#f8fafc', color: schoolColor }}>Class Teacher's Remark</p>
                     <p className="italic text-slate-900 text-[11px] leading-snug font-serif font-bold">"{activeTerm.summary.teacherRemark}"</p>
                  </div>
                  
                  <div className="border border-slate-900 p-2 relative rounded-sm bg-slate-50">
                     <p className="text-[9px] font-bold uppercase tracking-widest absolute -top-2 left-4 px-1" style={{ backgroundColor: '#f8fafc', color: schoolColor }}>Sectional Head / Principal's Remark</p>
                     <p className="italic text-slate-900 text-[11px] leading-snug font-serif font-bold">"{activeTerm.summary.principalRemark}"</p>
                  </div>

                  <div className="pt-0">
                     <div className="grid grid-cols-3 gap-8">
                        {/* Class Teacher Sig */}
                        <div className="text-center mt-2">
                           <div className="h-6 flex items-end justify-center mb-0.5">
                              {/* Signature Mock */}
                              <span style={{ fontFamily: 'cursive' }} className="text-lg opacity-60 italic text-slate-800">{activeTerm.summary.teacherSignature || 'Pending'}</span>
                           </div>
                           <div className="border-t border-slate-900 pt-0.5">
                              <p className="text-[9px] font-bold uppercase">Class Teacher</p>
                           </div>
                        </div>

                        {/* Sectional Head Sig */}
                        <div className="text-center mt-2">
                           <div className="h-6 flex items-end justify-center mb-0.5">
                              {/* Same signature if combined, otherwise different */}
                              <span style={{ fontFamily: 'cursive' }} className="text-lg opacity-60 italic text-slate-800">{activeTerm.summary.sectionalSignature || activeTerm.summary.principalSignature || 'Pending'}</span>
                           </div>
                           <div className="border-t border-slate-900 pt-0.5">
                              <p className="text-[9px] font-bold uppercase">Sectional Head</p>
                           </div>
                        </div>

                        {/* HOS / Owner Sig */}
                        <div className="text-center mt-2 relative">
                           <div className="h-6 flex items-end justify-center mb-0.5 relative z-10">
                              <span style={{ fontFamily: 'cursive' }} className="text-xl opacity-80 italic text-slate-900">{activeTerm.summary.principalSignature || 'Pending'}</span>
                           </div>
                           {/* Realistic Stamp Mock */}
                           <div className="absolute -top-3 right-4 w-12 h-12 border-2 flex items-center justify-center rounded-full rotate-[-15deg] pointer-events-none z-0 stamp-mock" style={{ opacity: 0.6 }}>
                              <div className="w-10 h-10 border border-dashed rounded-full flex flex-col items-center justify-center stamp-mock">
                                 <span className="text-[4px] font-black tracking-widest leading-none stamp-mock uppercase max-w-[90%] text-center overflow-hidden">NDOVERA<br/>ACADEMY</span>
                                 <span className="text-[5px] font-black tracking-widest leading-none mt-0.5 stamp-mock">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-')}</span>
                              </div>
                           </div>
                           <div className="border-t border-slate-900 pt-0.5 relative z-10">
                              <p className="text-[9px] font-bold uppercase">HOS / School Owner</p>
                           </div>
                        </div>
                     </div>
                  </div>
                  
                  {/* Info Note & Barcode */}
                  <div className="mt-2 flex justify-between items-end border-t border-slate-200 pt-1">
                     <div className="text-left text-[8px] text-slate-500 font-mono leading-tight">
                        <span className="font-bold text-slate-700">NOTICE:</span> This is Ndovera Academy's official transcript. <br/>Any alteration renders this document invalid.
                     </div>
                     <div className="flex flex-col items-center gap-1">
                        <div className="grid h-12 w-12 grid-cols-3 gap-0.5 rounded-md border-2 border-slate-900 bg-white p-0.75 shadow-sm">
                          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((cell) => (
                            <div key={cell} className={`${[0,1,2,3,5,6,7,8].includes(cell) ? 'bg-slate-900' : 'bg-white'} rounded-[1px]`} />
                          ))}
                        </div>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[6px] tracking-[0.25em] text-slate-700 font-mono uppercase border border-slate-300">Scan to Verify</span>
                     </div>
                  </div>
               </section>
            </div>
          </div>
          </div>
        </div>
      ) : null}

         {teacherView && examType === 'mid-term' ? (
            <div className="space-y-4">
               <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm dark:border-amber-900/50 dark:bg-amber-900/10 mb-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div>
                     <h3 className="text-lg font-bold text-slate-900 dark:text-white">Mid-Term Publisher</h3>
                     <p className="text-sm text-slate-600 dark:text-slate-400">Review the Mid-Term scores. Upon submission, it will be moved to the Sectional Head for approval.</p>
                  </div>
                  <button className="whitespace-nowrap px-6 py-3 rounded-full bg-slate-900 text-white font-bold text-sm shadow hover:bg-slate-800 transition-colors">
                     Submit For Approval
                  </button>
               </div>
            </div>
         ) : null}
    </div>
  );
}
