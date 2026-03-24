import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { BadgeCheck, Download, FileUp, Lock, TrendingUp, ChevronDown, ChevronRight, Image as ImageIcon, Settings2, Check } from 'lucide-react';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';

import { useData } from '../../../hooks/useData';
import { resultSessions, studentResultSessions } from '../data/classroomExperience';
import { getOldResultAssets, getResultDocuments, type HistoryAssetRecord, type ResultDocumentRecord, type ResultSession, type StudentResultRecord, uploadResultDocument } from '../services/classroomApi';
import { formatRatingScale, getResultPageTwoVariant, getStoredResultManagementSettings } from '../../settings/services/resultManagement';
import { loadUser } from '../../../services/authLocal';

type ResultsCenterProps = {
  role: string;
   selectedClassName?: string;
   selectedClassSection?: string;
   schoolName?: string;
   schoolLogoUrl?: string | null;
   schoolPrimaryColor?: string;
};

type ResultSubjectRow = ResultSession['terms'][number]['subjects'][number];

type NurseryProgressSection = {
   id: string;
   title: string;
   items: Array<{ no: string; text: string; status: 'not_yet' | 'progressing' | 'yes' }>;
};

type NurserySkillSection = {
   category: string;
   items: Array<{ label: string; rating: string }>;
};

type GradeCognitiveSection = {
   id: string;
   title: string;
   items?: Array<{ label: string; rating: number }>;
   content?: Array<{ sub: string; items: Array<{ label: string; rating: number }> }>;
};

function parsePercent(value?: string) {
   const normalized = String(value || '').replace(/[^\d.]+/g, '');
   const numeric = Number.parseFloat(normalized);
   return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeClassName(value?: string) {
   return String(value || '').trim();
}

function inferResultSection(selectedClassSection: string | undefined, className: string, subjects: ResultSubjectRow[]) {
   const normalizedSection = String(selectedClassSection || '').trim().toLowerCase();
   if (normalizedSection === 'pre-school' || normalizedSection === 'primary' || normalizedSection === 'junior-secondary' || normalizedSection === 'senior-secondary') {
      return normalizedSection as 'pre-school' | 'primary' | 'junior-secondary' | 'senior-secondary';
   }

   const normalized = className.toLowerCase();
   if (/(early explorers|\bexplorers\b|reception|pre-school|preschool|nursery|creche)/.test(normalized)) {
      return 'pre-school' as const;
   }
   if (/(grade|primary|basic)/.test(normalized)) {
      return 'primary' as const;
   }
   if (/(jss|jhs|junior secondary)/.test(normalized)) {
      return 'junior-secondary' as const;
   }
   if (/(sss|shs|senior secondary|ss\s*[123])/i.test(normalized)) {
      return 'senior-secondary' as const;
   }

   if (subjects.some((subject) => /phonics|handwriting|colour|colouring|number work/i.test(subject.subject))) {
      return 'pre-school' as const;
   }

   return 'primary' as const;
}

function isEarlyExplorersClass(className: string) {
   return /(^|\b)(early explorers|explorers)(\b|$)/i.test(className);
}

function buildSchoolInitials(value: string) {
   return value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'NS';
}

function scoreToFivePoint(score: number) {
   if (score >= 70) return 5;
   if (score >= 60) return 4;
   if (score >= 50) return 3;
   if (score >= 40) return 2;
   return 1;
}

function scoreToProgressStatus(score: number): 'not_yet' | 'progressing' | 'yes' {
   if (score >= 60) return 'yes';
   if (score >= 40) return 'progressing';
   return 'not_yet';
}

function fallbackScore(subjects: ResultSubjectRow[], averageScore: number, index: number) {
   return subjects[index % Math.max(subjects.length, 1)]?.total || averageScore;
}

function buildNurserySkillSections(subjects: ResultSubjectRow[], traitsText: string, averageScore: number): NurserySkillSection[] {
   const traits = traitsText.split(',').map((item) => item.trim()).filter(Boolean);
   const ratingLabels = ['Excellent', 'Very Good', 'Good', 'Emerging', 'Needs Support'];
   const resolveRating = (index: number) => ratingLabels[Math.max(0, 5 - scoreToFivePoint(fallbackScore(subjects, averageScore, index)))];

   return [
      {
         category: 'Communication & Early Literacy',
         items: [
            { label: 'Listens attentively during class activities', rating: resolveRating(0) },
            { label: 'Recognises letters and familiar sounds', rating: resolveRating(1) },
            { label: 'Expresses ideas with growing confidence', rating: resolveRating(2) },
         ],
      },
      {
         category: 'Numeracy & Discovery',
         items: [
            { label: 'Counts and sorts classroom objects correctly', rating: resolveRating(3) },
            { label: 'Identifies patterns, shapes, and colours', rating: resolveRating(4) },
            { label: 'Shows curiosity during guided exploration', rating: resolveRating(5) },
         ],
      },
      {
         category: 'Personal, Social & Creative Development',
         items: [
            { label: traits[0] || 'Works cooperatively with peers', rating: resolveRating(6) },
            { label: traits[1] || 'Follows simple classroom routines', rating: resolveRating(7) },
            { label: traits[2] || 'Participates in music and movement joyfully', rating: resolveRating(8) },
         ],
      },
   ];
}

function buildNurseryProgressSections(subjects: ResultSubjectRow[], traitsText: string, averageScore: number): NurseryProgressSection[] {
   const traits = traitsText.split(',').map((item) => item.trim()).filter(Boolean);
   const resolveStatus = (index: number) => scoreToProgressStatus(fallbackScore(subjects, averageScore, index));

   return [
      {
         id: '1',
         title: 'Language & Communication',
         items: [
            { no: '1', text: 'Follows simple spoken instructions', status: resolveStatus(0) },
            { no: '2', text: 'Responds to stories, songs, and rhymes', status: resolveStatus(1) },
            { no: '3', text: 'Attempts early reading and sound recognition', status: resolveStatus(2) },
         ],
      },
      {
         id: '2',
         title: 'Numeracy & Discovery',
         items: [
            { no: '1', text: 'Counts objects with confidence', status: resolveStatus(3) },
            { no: '2', text: 'Identifies shapes, colours, and patterns', status: resolveStatus(4) },
            { no: '3', text: 'Participates in guided discovery activities', status: resolveStatus(5) },
         ],
      },
      {
         id: '3',
         title: 'Personal, Social & Emotional Development',
         items: [
            { no: '1', text: traits[0] || 'Shows confidence in class participation', status: resolveStatus(6) },
            { no: '2', text: traits[1] || 'Relates respectfully with classmates', status: resolveStatus(7) },
            { no: '3', text: traits[2] || 'Manages routines with little support', status: resolveStatus(8) },
         ],
      },
      {
         id: '4',
         title: 'Creative & Physical Expression',
         items: [
            { no: '1', text: 'Participates in music, art, and role play', status: resolveStatus(9) },
            { no: '2', text: 'Handles learning materials carefully', status: resolveStatus(10) },
            { no: '3', text: 'Shows balance and coordination during activities', status: resolveStatus(11) },
         ],
      },
   ];
}

function buildGradeCognitiveSections(subjects: ResultSubjectRow[], traitsText: string, averageScore: number): GradeCognitiveSection[] {
   const lowerSubjectGroups = {
      language: subjects.filter((item) => /english|language|phonics|literature|french|verbal/i.test(item.subject)),
      mathematics: subjects.filter((item) => /mathematics|math|numeracy|further/i.test(item.subject)),
      creative: subjects.filter((item) => /creative|arts|music|drawing|cultural|home economics|basic tech|fine/i.test(item.subject)),
   };

   const toItems = (list: ResultSubjectRow[], fallbacks: string[], startIndex: number) => {
      const base = list.length
         ? list.slice(0, 4).map((item) => ({ label: item.subject, rating: scoreToFivePoint(item.total) }))
         : fallbacks.map((label, index) => ({ label, rating: scoreToFivePoint(fallbackScore(subjects, averageScore, startIndex + index)) }));
      return base;
   };

   const traits = traitsText.split(',').map((item) => item.trim()).filter(Boolean);

   return [
      {
         id: 'A',
         title: '(COGNITIVE)',
         content: [
            { sub: 'LANGUAGE SKILLS', items: toItems(lowerSubjectGroups.language, ['Reading Fluency', 'Listening Comprehension', 'Speaking Confidence'], 0) },
            { sub: 'MATHEMATICS SKILLS', items: toItems(lowerSubjectGroups.mathematics, ['Number Sense', 'Problem Solving', 'Measurement & Patterns'], 3) },
         ],
      },
      {
         id: 'B',
         title: 'PERSONAL SOCIAL AND EMOTIONAL DEVELOPMENT',
         items: (traits.length ? traits : ['Punctuality', 'Neatness', 'Politeness', 'Teamwork']).slice(0, 5).map((label, index) => ({
            label,
            rating: scoreToFivePoint(fallbackScore(subjects, averageScore, 6 + index)),
         })),
      },
      {
         id: 'C',
         title: 'CREATIVE DEVELOPMENT',
         items: toItems(lowerSubjectGroups.creative, ['Artistic Expression', 'Music & Rhythm', 'Practical Creativity'], 10),
      },
   ];
}

function EarlyExplorersResultPage({
   schoolColor,
   schoolName,
   className,
   studentName,
   sessionName,
   termName,
   teacherRemark,
   principalRemark,
   sectionHeadTitle,
   averageScore,
   traitsText,
   subjects,
}: {
   schoolColor: string;
   schoolName: string;
   className: string;
   studentName: string;
   sessionName: string;
   termName: string;
   teacherRemark: string;
   principalRemark: string;
   sectionHeadTitle: string;
   averageScore: number;
   traitsText: string;
   subjects: ResultSubjectRow[];
}) {
   const gradingScales = ['Excellent', 'Very Good', 'Good', 'Emerging', 'Needs Support'];
   const skillSections = buildNurserySkillSections(subjects, traitsText, averageScore);

   return (
      <div className="relative h-[297mm] w-[210mm] overflow-hidden bg-white shadow-2xl print:shadow-none result-theme">
         <div className="p-6 h-full flex flex-col text-gray-900">
            <header className="text-center border-b-4 pb-4" style={{ borderColor: schoolColor }}>
               <h1 className="text-3xl font-black uppercase tracking-[0.25em]" style={{ color: schoolColor }}>{schoolName}</h1>
               <p className="mt-2 inline-block rounded-full px-6 py-2 text-sm font-black uppercase tracking-[0.3em] text-white" style={{ backgroundColor: schoolColor }}>
                  Early Explorers Result
               </p>
               <p className="mt-2 text-[11px] font-bold uppercase text-slate-600">Session {sessionName} • {termName}</p>
            </header>

            <div className="mt-4 grid grid-cols-2 gap-3 text-[11px] font-bold uppercase">
               {[
                  ['Name', studentName],
                  ['Class', className],
                  ['Session', sessionName],
                  ['Term', termName],
               ].map(([label, value]) => (
                  <div key={label} className="flex justify-between border-b border-gray-300 py-1">
                     <span>{label}:</span>
                     <span className="text-right" style={{ color: schoolColor }}>{value}</span>
                  </div>
               ))}
            </div>

            <div className="mt-4 grow overflow-hidden">
               <table className="w-full border-collapse border border-black text-[10px]">
                  <thead>
                     <tr className="bg-gray-100">
                        <th className="border border-black p-1 text-left">SKILL ACCESSED</th>
                        {gradingScales.map((grade) => <th key={grade} className="border border-black p-1 text-[8px] w-16">{grade}</th>)}
                     </tr>
                  </thead>
                  <tbody>
                     {skillSections.map((section, sectionIndex) => (
                        <>
                           <tr key={`${section.category}-title`} className="bg-gray-50 font-bold border-t border-black">
                              <td colSpan={6} className="border border-black p-1">{sectionIndex + 1}. {section.category}</td>
                           </tr>
                           {section.items.map((item, itemIndex) => (
                              <tr key={`${section.category}-${itemIndex}`}>
                                 <td className="border border-black p-1 pl-4">{item.label}</td>
                                 {gradingScales.map((grade) => (
                                    <td key={grade} className="border border-black text-center text-xs font-bold">{item.rating === grade ? '✓' : ''}</td>
                                 ))}
                              </tr>
                           ))}
                        </>
                     ))}
                  </tbody>
               </table>
            </div>

            <div className="mt-4 space-y-4">
               <div className="border border-black">
                  <p className="border-b border-black bg-gray-100 p-1 text-center text-[10px] font-bold">PHYSICAL DEVELOPMENT</p>
                  <div className="grid grid-cols-4 text-[10px] text-center italic">
                     <div className="border-r border-black py-1">Height (Start): -</div>
                     <div className="border-r border-black py-1">Height (End): -</div>
                     <div className="border-r border-black py-1">Weight (Start): -</div>
                     <div className="py-1">Weight (End): -</div>
                  </div>
               </div>

               <div className="text-xs">
                  <p className="font-bold italic underline">Teacher&apos;s Comment:</p>
                  <p className="border-b border-black p-2 italic leading-tight">{teacherRemark}</p>
                  <p className="mt-2 font-bold italic underline">{sectionHeadTitle}&apos;s Remark:</p>
                  <p className="border-b border-black p-2 italic leading-tight">&quot;{principalRemark}&quot;</p>
               </div>
            </div>

            <div className="mt-auto grid grid-cols-2 gap-10 pt-6 text-[10px] font-bold uppercase text-center">
               <div className="border-t border-black pt-1">Parent&apos;s Signature & Date</div>
               <div className="border-t border-black pt-1">School Stamp & {sectionHeadTitle}&apos;s Signature</div>
            </div>
         </div>
      </div>
   );
}

function NurseryProgressReportPage({
   schoolColor,
   schoolName,
   className,
   studentName,
   termName,
   sessionName,
   sectionHeadTitle,
   averageScore,
   traitsText,
   subjects,
   sections,
}: {
   schoolColor: string;
   schoolName: string;
   className: string;
   studentName: string;
   termName: string;
   sessionName: string;
   sectionHeadTitle: string;
   averageScore: number;
   traitsText: string;
   subjects: ResultSubjectRow[];
   sections?: NurseryProgressSection[];
}) {
   const resolvedSections = sections?.length ? sections : buildNurseryProgressSections(subjects, traitsText, averageScore);

   return (
      <div className="relative h-[297mm] w-[210mm] overflow-hidden bg-white shadow-2xl print:shadow-none">
         <div className="p-6 h-full flex flex-col font-sans text-gray-800 border border-gray-300">
            <div className="text-center mb-6">
               <h1 className="text-3xl font-black uppercase" style={{ color: schoolColor }}>{schoolName}</h1>
               <div className="mt-2 inline-block rounded-full px-8 py-1 text-white font-bold tracking-tighter text-lg" style={{ backgroundColor: schoolColor }}>
                  NURSERY PROGRESS REPORT
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 border-b-2 border-black pb-4 uppercase text-xs font-bold">
               <div className="flex border-b border-gray-300">Name: <span className="ml-2" style={{ color: schoolColor }}>{studentName}</span></div>
               <div className="flex border-b border-gray-300">Term: <span className="ml-2">{termName}</span></div>
               <div className="flex border-b border-gray-300">Year: <span className="ml-2">{sessionName}</span></div>
               <div className="flex border-b border-gray-300">Class: <span className="ml-2">{className}</span></div>
            </div>

            <div className="grow">
               <table className="w-full border-collapse border-2 border-black text-[10px]">
                  <thead className="bg-gray-100 uppercase">
                     <tr className="border-b-2 border-black">
                        <th className="w-8 border-r border-black p-2">#</th>
                        <th className="border-r border-black p-2 text-left">Developmental Skills</th>
                        <th className="w-20 border-r border-black bg-red-50 p-2">Not Yet</th>
                        <th className="w-20 border-r border-black bg-yellow-50 p-2">Progressing</th>
                        <th className="w-20 bg-green-50 p-2">Yes</th>
                     </tr>
                  </thead>
                  <tbody>
                     {resolvedSections.map((section) => (
                        <>
                           <tr key={`${section.id}-title`} className="bg-gray-200 border-b border-black font-extrabold uppercase">
                              <td className="border-r border-black p-1 text-center">{section.id}</td>
                              <td colSpan={4} className="p-1">{section.title}</td>
                           </tr>
                           {section.items.map((item, index) => (
                              <tr key={`${section.id}-${index}`} className="border-b border-gray-300">
                                 <td className="border-r border-black p-1 text-center text-gray-400">{item.no}</td>
                                 <td className="border-r border-black p-1">{item.text}</td>
                                 <td className="border-r border-black text-center text-sm font-bold text-red-600">{item.status === 'not_yet' ? '✓' : ''}</td>
                                 <td className="border-r border-black text-center text-sm font-bold text-yellow-600">{item.status === 'progressing' ? '✓' : ''}</td>
                                 <td className="text-center text-sm font-bold text-green-600">{item.status === 'yes' ? '✓' : ''}</td>
                              </tr>
                           ))}
                        </>
                     ))}
                  </tbody>
               </table>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-12 text-xs text-center font-bold uppercase">
               <div className="border-t-2 border-black pt-2 italic">Class Teacher&apos;s Signature</div>
               <div className="border-t-2 border-black pt-2 italic">{sectionHeadTitle}&apos;s Signature</div>
            </div>
         </div>
      </div>
   );
}

function GradeCognitivePage2({
   schoolColor,
   schoolName,
   studentName,
   remark,
   sectionHeadTitle,
   traitsText,
   subjects,
   averageScore,
   sections,
}: {
   schoolColor: string;
   schoolName: string;
   studentName: string;
   remark: string;
   sectionHeadTitle: string;
   traitsText: string;
   subjects: ResultSubjectRow[];
   averageScore: number;
   sections?: GradeCognitiveSection[];
}) {
   const ratingLegend = [
      { level: 5, label: 'EXCELLENT' },
      { level: 4, label: 'GOOD' },
      { level: 3, label: 'ACCEPTABLE LEVEL' },
      { level: 2, label: 'BELOW ACCEPTABLE LEVEL' },
      { level: 1, label: 'POOR' },
   ];
   const resolvedSections = sections?.length ? sections : buildGradeCognitiveSections(subjects, traitsText, averageScore);

   return (
      <div className="relative h-[297mm] w-[210mm] overflow-hidden bg-white shadow-2xl print:shadow-none">
         <div className="p-6 h-full font-serif text-gray-900 border border-gray-400">
            <div className="flex justify-between items-start mb-6 border-b-2 border-black pb-4">
               <div className="w-2/3 pt-4">
                  <h1 className="text-2xl font-bold uppercase" style={{ color: schoolColor }}>{schoolName}</h1>
                  <p className="mt-2 text-lg font-extrabold italic underline">PAGE 2: COGNITIVE & DEVELOPMENTAL REPORT</p>
                  <div className="mt-4 flex items-center border-b border-black w-full uppercase">
                     <span className="mr-2 text-sm font-bold">Student Name:</span>
                     <span className="text-base">{studentName}</span>
                  </div>
               </div>

               <div className="w-48 border border-black p-1 bg-gray-50 text-[9px]">
                  <p className="font-bold text-center border-b border-black mb-1">PERFOMANCE LEVEL RATING</p>
                  {ratingLegend.map((item) => (
                     <div key={item.level} className="flex"><span className="w-4 font-bold">{item.level}</span><span>{item.label}</span></div>
                  ))}
               </div>
            </div>

            <div className="space-y-4">
               {resolvedSections.map((section) => (
                  <div key={section.id} className="border border-black overflow-hidden">
                     <div className="bg-gray-800 text-white p-1 text-center font-bold text-xs">{section.id}. {section.title}</div>
                     <table className="w-full text-[10px]">
                        <tbody>
                           {section.content ? section.content.map((subSection) => (
                              <>
                                 <tr key={`${section.id}-${subSection.sub}`} className="bg-gray-200 font-bold border-y border-black"><td colSpan={2} className="px-2">{subSection.sub}</td></tr>
                                 {subSection.items.map((item, index) => (
                                    <tr key={`${subSection.sub}-${index}`} className="border-b border-gray-200">
                                       <td className="p-1 pl-4 uppercase">{item.label}</td>
                                       <td className="w-12 border-l border-black text-center font-bold">{item.rating || '-'}</td>
                                    </tr>
                                 ))}
                              </>
                           )) : section.items?.map((item, index) => (
                              <tr key={`${section.id}-${index}`} className="border-b border-gray-200">
                                 <td className="p-1 pl-4 uppercase">{item.label}</td>
                                 <td className="w-12 border-l border-black text-center font-bold">{item.rating || '-'}</td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               ))}
            </div>

            <div className="mt-6 border-2 border-black p-2 min-h-20">
               <p className="text-[10px] font-bold uppercase underline">{sectionHeadTitle}&apos;s Remark & Stamp:</p>
               <p className="text-xs italic pt-2">{remark || 'An impressive outing. Keep up the hard work.'}</p>
            </div>

            <div className="mt-4 flex justify-end text-[10px] font-bold">
               <div className="w-40 border-t border-black text-center pt-1 uppercase">{sectionHeadTitle}</div>
            </div>
         </div>
      </div>
   );
}

export function ResultsCenter({ role, selectedClassName = '', selectedClassSection = '', schoolName: schoolNameProp, schoolLogoUrl, schoolPrimaryColor }: ResultsCenterProps) {
  const teacherView = role === 'Teacher' || role === 'School Admin' || role === 'HoS' || role === 'Owner' || role === 'ICT' || role === 'ICT Manager';
  const canCustomize = ['HoS', 'Owner', 'ICT', 'ICT Manager', 'School Admin'].includes(role);
   const canUploadResultFiles = ['Teacher', 'School Admin', 'HoS', 'Owner', 'ICT', 'ICT Manager'].includes(role);
  const documentRef = useRef<HTMLDivElement>(null);
   const resultUploadInputRef = useRef<HTMLInputElement>(null);
   const currentUser = useMemo(() => loadUser(), []);
   const { data: schoolWebsiteData } = useData<{ website?: Record<string, unknown> | null }>('/api/schools/website');
  
  // Customization States
  const [showConfig, setShowConfig] = useState(false);
  const [examType, setExamType] = useState<'end-term' | 'mid-term'>('end-term');
   const [schoolColor, setSchoolColor] = useState(schoolPrimaryColor?.trim() || '#0f172a');
  const [logoSize, setLogoSize] = useState(64);
  const [logoPos, setLogoPos] = useState(50);
  const [ratingScale, setRatingScale] = useState('A: 70-100 (Excellent) | B: 60-69 (Very Good) | C: 50-59 (Credit) | D: 40-49 (Pass) | E: 0-39 (Fail)');
  const [affectiveTraits, setAffectiveTraits] = useState('Punctuality, Neatness, Politeness, Honesty, Initiative, Self-Control, Teamwork');
   const [logoUrl, setLogoUrl] = useState(schoolLogoUrl?.trim() || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0MDAgNDAwIj4KICA8cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzBEOEFCQyIgLz4KICA8dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2ZmZmZmZiIgZm9udC1zaXplPSIyMDAiIGZvbnQtZmFtaWx5PSJBcmlhbCxHZW5ldmEsc2Fucy1zZXJpZiI+TkQ8L3RleHQ+Cjwvc3ZnPg==');
  const [isGenerating, setIsGenerating] = useState(false);
   const [resultDocuments, setResultDocuments] = useState<ResultDocumentRecord[]>([]);
   const [oldResultAssets, setOldResultAssets] = useState<HistoryAssetRecord[]>([]);
   const [oldResultsOpen, setOldResultsOpen] = useState(false);
   const [uploadState, setUploadState] = useState<{ resultBusy: boolean; message: string | null; error: string | null }>({ resultBusy: false, message: null, error: null });

   useEffect(() => {
      if (schoolPrimaryColor?.trim()) setSchoolColor(schoolPrimaryColor.trim());
   }, [schoolPrimaryColor]);

   useEffect(() => {
      if (schoolLogoUrl?.trim()) setLogoUrl(schoolLogoUrl.trim());
   }, [schoolLogoUrl]);
  
  const handleDownloadPDF = async () => {
    if (!documentRef.current || isGenerating) return;
    try {
       setIsGenerating(true);
       
       const nodeWidth = documentRef.current.offsetWidth;
      const nodeHeight = documentRef.current.scrollHeight;
       
       const imgData = await toJpeg(documentRef.current, {
           quality: 1,
           pixelRatio: 2,
           style: {
               backgroundColor: '#ffffff',
           }
       });
       
       const pdf = new jsPDF('p', 'mm', 'a4');
       
       const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfPageHeight = pdf.internal.pageSize.getHeight();
          const pdfHeight = (nodeHeight * pdfWidth) / nodeWidth;
       
       pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
          let heightLeft = pdfHeight - pdfPageHeight;
          let position = -pdfPageHeight;

          while (heightLeft > 0) {
             pdf.addPage();
             pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
             heightLeft -= pdfPageHeight;
             position -= pdfPageHeight;
          }

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
    const { data } = useData<{ sessions: ResultSession[]; studentResults?: StudentResultRecord[] }>('/api/classroom/results');
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
       if (Array.isArray(data?.studentResults) && data.studentResults.length) {
         return data.studentResults.map((student) => ({
            id: student.studentId,
            name: student.studentName,
            className: student.className,
            classSection: student.classSection,
            sessions: student.sessions,
         }));
       }
      if (!savedScoreSheet?.scores?.length) return studentResultSessions;
      return savedScoreSheet.scores.map((student: any) => {
         const total = Math.round((student.ca1 || 0) + (student.ca2 || 0) + (student.midTerm || 0) + (student.exam || 0));
         const grade = total >= 70 ? 'A' : total >= 60 ? 'B' : total >= 50 ? 'C' : total >= 40 ? 'D' : 'F';
         const remark = total >= 70 ? 'Excellent' : total >= 60 ? 'Very Good' : total >= 50 ? 'Credit' : total >= 40 ? 'Pass' : 'Fail';
         return {
            id: student.id,
            name: student.name,
            className: savedScoreSheet.selectedClass || savedScoreSheet.className || '',
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
	  }, [data?.studentResults, savedScoreSheet]);

   const selectedStudentData = teacherStudents[selectedStudentIndex] || teacherStudents[0];
   const selectedStudentId = teacherView ? selectedStudentData?.id : undefined;

   useEffect(() => {
      let active = true;
      getResultDocuments().then((payload) => {
         if (active) setResultDocuments(payload.documents || []);
      }).catch(() => {
         if (active) setResultDocuments([]);
      });
      return () => { active = false; };
   }, []);

   useEffect(() => {
      let active = true;
      getOldResultAssets(teacherView ? selectedStudentId : undefined).then((payload) => {
         if (active) setOldResultAssets(payload.assets || []);
      }).catch(() => {
         if (active) setOldResultAssets([]);
      });
      return () => { active = false; };
   }, [selectedStudentId, teacherView]);

   const visibleResultDocuments = useMemo(() => {
      if (teacherView) {
         return resultDocuments.filter((record) => record.studentId === selectedStudentId);
      }
      return resultDocuments;
   }, [resultDocuments, selectedStudentId, teacherView]);

   const visibleOldResultAssets = useMemo(() => {
      if (teacherView) return oldResultAssets;
      return oldResultAssets;
   }, [oldResultAssets, teacherView]);

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

   const hasSessions = sessions.length > 0;
   const hasResultsContent = hasSessions || visibleResultDocuments.length > 0;

  const isLocked = activeSession?.feeStatus === 'Unpaid';
   const displayClassName = normalizeClassName(
      selectedClassName
      || (selectedStudentData as any)?.className
      || (savedScoreSheet as any)?.selectedClass
      || (savedScoreSheet as any)?.className
   ) || 'Grade Class';
   const resultManagementSettings = getStoredResultManagementSettings(schoolWebsiteData?.website);
   const resultSection = inferResultSection(selectedClassSection, displayClassName, activeTerm?.subjects || []);
   const sectionSettings = resultManagementSettings[resultSection];
   const usesEarlyExplorersTemplate = isEarlyExplorersClass(displayClassName);
   const pageTwoVariant = getResultPageTwoVariant(resultSection, sectionSettings.applyPage2);
   const showSecondPage = examType === 'end-term' && pageTwoVariant !== 'none';
   const averageScore = parsePercent(activeTerm?.summary?.average);
    const activePageTwo = activeTerm?.pageTwo;
   const schoolName = schoolNameProp?.trim() || 'Ndovera Academy';
   const schoolInitials = buildSchoolInitials(schoolName);
   const templateId = sectionSettings.templateId;
   const usesFormalTemplate = templateId === 'tpl-2';
   const usesComprehensiveTemplate = templateId === 'tpl-3';
   const sectionHeadTitle = sectionSettings.sectionHeadTitle;
   const liveRatingScale = formatRatingScale(sectionSettings.gradingKey);
   const totalContinuousAssessment = sectionSettings.caWeights.reduce((sum, value) => sum + value, 0) + (sectionSettings.useMidTerm ? sectionSettings.midTermWeight : 0);

   useEffect(() => {
      setRatingScale(liveRatingScale);
   }, [liveRatingScale]);

    useEffect(() => {
      if (activePageTwo?.affectiveTraits?.length) {
         setAffectiveTraits(activePageTwo.affectiveTraits.join(', '));
      }
    }, [activePageTwo]);

      const handleResultFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
         const file = event.target.files?.[0];
         if (!file) return;
         setUploadState((current) => ({ ...current, resultBusy: true, error: null, message: null }));
         try {
            const response = await uploadResultDocument({
               file,
               studentRef: selectedStudentId,
               session: activeSession?.session,
               term: activeTerm?.name,
               schoolId: currentUser?.schoolId,
            });
            setResultDocuments((current) => [response.document, ...current]);
            setUploadState((current) => ({ ...current, resultBusy: false, message: `Result file linked to ${response.document.studentName}.`, error: null }));
         } catch (error) {
            setUploadState((current) => ({ ...current, resultBusy: false, message: null, error: error instanceof Error ? error.message : 'Result upload failed.' }));
         } finally {
            if (resultUploadInputRef.current) resultUploadInputRef.current.value = '';
         }
      };

      const resultCoverage = useMemo(() => {
         if (!teacherView || !teacherStudents.length) return null;
         const normalizedSession = String(activeSession?.session || '').trim().toLowerCase();
         const normalizedTerm = String(activeTerm?.name || '').trim().toLowerCase();
         const relevantDocuments = resultDocuments.filter((record) => {
            if (!normalizedSession && !normalizedTerm) return true;
            const sameSession = !normalizedSession || !record.session || String(record.session).trim().toLowerCase() === normalizedSession;
            const sameTerm = !normalizedTerm || !record.term || String(record.term).trim().toLowerCase() === normalizedTerm;
            return sameSession && sameTerm;
         });
         const uploadedStudentIds = new Set(relevantDocuments.map((record) => record.studentId));
         const uploadedStudents = teacherStudents.filter((student: any) => uploadedStudentIds.has(student.id));
         const missingStudents = teacherStudents.filter((student: any) => !uploadedStudentIds.has(student.id));
         return { uploadedStudents, missingStudents };
      }, [activeSession?.session, activeTerm?.name, resultDocuments, teacherStudents, teacherView]);

      if (!hasResultsContent) {
      return (
         <div className="flex h-64 items-center justify-center rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
            <p className="text-slate-500 dark:text-slate-400">No official records available yet.</p>
         </div>
      );
   }

   return (
      <div className="space-y-6 h-[calc(100vh-200px)] overflow-y-auto pr-1 custom-scrollbar">
         {(canUploadResultFiles || visibleResultDocuments.length || visibleOldResultAssets.length) ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:bg-slate-800 dark:border-slate-700">
               <div className="flex flex-col gap-4">
                  <div>
                     <p className="text-sm font-bold text-slate-950 dark:text-white">Result files</p>
                     <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Attach PDF, DOC, or DOCX result sheets to the correct learner using student name, email, or User ID. When a school old-result file matches this learner, it appears below as a collapsible old results tab.</p>
                     {uploadState.message ? <p className="mt-2 text-sm font-medium text-emerald-600 dark:text-emerald-300">{uploadState.message}</p> : null}
                     {uploadState.error ? <p className="mt-2 text-sm font-medium text-rose-600 dark:text-rose-300">{uploadState.error}</p> : null}
                  </div>
                  {canUploadResultFiles ? (
                     <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">Result upload pipeline</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Upload to the selected learner only. Matching accepts student name, email, NDOvera User ID, and filename hints.</p>
                        <input ref={resultUploadInputRef} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={handleResultFileSelected} />
                        <button type="button" onClick={() => resultUploadInputRef.current?.click()} disabled={uploadState.resultBusy || (teacherView && !selectedStudentId)} className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm disabled:opacity-60 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200">
                           <FileUp className="h-4 w-4" />
                           {uploadState.resultBusy ? 'Uploading result…' : 'Upload result file'}
                        </button>
                     </div>
                  ) : null}

                  {resultCoverage ? (
                     <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                           <div>
                              <p className="text-sm font-bold text-slate-900 dark:text-white">Upload coverage tracker</p>
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Tracking {activeTerm?.name || 'current term'} in {activeSession?.session || 'current session'}.</p>
                           </div>
                           <div className="flex gap-2 text-xs font-semibold">
                              <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">Uploaded: {resultCoverage.uploadedStudents.length}</span>
                              <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">Missing: {resultCoverage.missingStudents.length}</span>
                           </div>
                        </div>
                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                           <div>
                              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Uploaded students</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                 {resultCoverage.uploadedStudents.length ? resultCoverage.uploadedStudents.map((student: any) => (
                                    <span key={student.id} className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">{student.name}</span>
                                 )) : <span className="text-xs text-slate-500 dark:text-slate-400">No uploaded results tracked yet.</span>}
                              </div>
                           </div>
                           <div>
                              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Missing students</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                 {resultCoverage.missingStudents.length ? resultCoverage.missingStudents.map((student: any) => (
                                    <span key={student.id} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">{student.name}</span>
                                 )) : <span className="text-xs text-slate-500 dark:text-slate-400">All tracked students have uploaded results.</span>}
                              </div>
                           </div>
                        </div>
                     </div>
                  ) : null}
               </div>

               {visibleResultDocuments.length ? (
                  <div className="mt-5 grid gap-3 lg:grid-cols-2">
                     {visibleResultDocuments.map((document) => (
                        <a key={document.id} href={document.url} target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500/40 dark:hover:bg-sky-500/10">
                           <div className="flex items-start justify-between gap-3">
                              <div>
                                 <p className="font-bold text-slate-900 dark:text-white">{document.sourceName}</p>
                                 <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{document.studentName}{document.term ? ` • ${document.term}` : ''}{document.session ? ` • ${document.session}` : ''}</p>
                              </div>
                              <span className="rounded-full bg-slate-200/70 px-3 py-1 text-[11px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">Matched by {document.matchedBy}</span>
                           </div>
                           <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Uploaded by {document.uploadedByName} on {new Date(document.createdAt).toLocaleString()}</p>
                        </a>
                     ))}
                  </div>
               ) : null}

               {visibleOldResultAssets.length ? (
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                     <button type="button" onClick={() => setOldResultsOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 text-left">
                        <div>
                           <p className="text-sm font-bold text-slate-900 dark:text-white">Old results</p>
                           <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Matched historical results for this learner.</p>
                        </div>
                        <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                           {visibleOldResultAssets.length}
                           {oldResultsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </span>
                     </button>
                     {oldResultsOpen ? (
                        <div className="mt-3 space-y-3">
                           {visibleOldResultAssets.map((asset) => {
                              const mappedEntry = asset.mappedUsers.find((entry) => entry.status === 'mapped' && (!selectedStudentId || entry.matchedStudentId === selectedStudentId));
                              return (
                                 <a key={asset.id} href={asset.url} target="_blank" rel="noreferrer" className="block rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm transition hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-sky-500/40 dark:hover:bg-sky-500/10">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                       <p className="font-bold text-slate-900 dark:text-white">{asset.fileName}</p>
                                       <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${asset.status === 'processed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200'}`}>{asset.status === 'processed' ? 'Matched old result' : 'Review required'}</span>
                                    </div>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{asset.sourceType.toUpperCase()} • uploaded {new Date(asset.createdAt).toLocaleString()}</p>
                                    {mappedEntry?.payload ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Matched reference: {mappedEntry.ref}</p> : null}
                                 </a>
                              );
                           })}
                        </div>
                     ) : null}
                  </div>
               ) : null}
            </section>
         ) : null}

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
                  <div ref={documentRef} className="w-[210mm] space-y-4 print:space-y-0">
                  {!usesEarlyExplorersTemplate ? (
                  <div className="relative w-[210mm] h-[297mm] overflow-hidden shadow-2xl print:shadow-none print:m-0 print:p-0 result-theme bg-white" style={{ backgroundColor: usesFormalTemplate ? '#fcfcfa' : '#ffffff' }}>
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
               style={{ backgroundImage: usesFormalTemplate ? `repeating-linear-gradient(135deg, ${schoolColor}10 0 2px, transparent 2px 14px)` : `radial-gradient(${schoolColor}15 1px, transparent 1px)`, backgroundSize: usesFormalTemplate ? '18px 18px' : '16px 16px' }} 
            />
            <div className={`absolute inset-0 flex items-center justify-center pointer-events-none z-0 select-none ${usesFormalTemplate ? 'opacity-5' : 'opacity-10'}`}>
               <img src={logoUrl} alt="Watermark" className="w-112.5 h-112.5 object-contain grayscale-20 opacity-50" />
            </div>

            <div className="relative z-10 p-5">
               {/* Header / Letterhead */}
               <header className={`${usesFormalTemplate ? 'border-b-4' : 'border-b-[3px]'} pb-2 mb-2 flex items-center justify-between`} style={{ borderColor: schoolColor }}>
                  <div className="flex items-center gap-4">
                     <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center overflow-hidden border-2" style={{ borderColor: schoolColor }}>
                        <span className="text-xl font-black text-white mix-blend-difference">{schoolInitials}</span>
                     </div>
                     <div className="text-left">
                        <h1 className="text-3xl font-black uppercase tracking-widest font-serif" style={{ color: schoolColor }}>{schoolName}</h1>
                        <p className="text-xs font-semibold tracking-widest mt-0.5 uppercase" style={{ color: `${schoolColor}CC` }}>Excellence, Innovation, Character</p>
                        <p className="text-[10px] text-slate-600 mt-1 font-medium">{usesFormalTemplate ? 'Formal ledger layout applied from saved section settings.' : usesComprehensiveTemplate ? 'Comprehensive review layout applied from saved section settings.' : 'Classic grid layout applied from saved section settings.'}</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-4">
                     <div className="text-white force-white px-3 py-2 rounded text-xs font-bold uppercase tracking-widest text-center shadow-sm" style={{ backgroundColor: schoolColor }}>
                        {usesFormalTemplate ? 'Formal' : usesComprehensiveTemplate ? 'Comprehensive' : 'Official'}<br/>{usesFormalTemplate ? 'Result' : 'Academic'}<br/>{usesFormalTemplate ? 'Ledger' : 'Record'}
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
                           <td className="p-2 border-r border-slate-900"><span className="font-bold text-slate-600 mr-2 uppercase text-[11px]">Class:</span> <span className="font-bold text-slate-900">{displayClassName}</span></td>
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
                        <h3 className="text-sm font-bold uppercase tracking-widest text-white force-white px-3 py-1 inline-block border border-slate-900 rounded-sm shadow-sm" style={{ backgroundColor: schoolColor }}>{usesFormalTemplate ? 'Academic Ledger' : usesComprehensiveTemplate ? 'Comprehensive Review' : 'Cognitive Report'}</h3>
                     </div>
                     <table className="w-full text-xs text-left border-collapse border border-slate-900">
                        <thead className="text-white" style={{ backgroundColor: schoolColor }}>
                           {examType === 'mid-term' ? (
                             <tr>
                                <th className="border border-slate-900 px-2 py-1 font-bold uppercase tracking-wider text-white text-left" style={{ color: '#ffffff' }}>Subject</th>
                                <th className="border border-slate-900 px-1 py-1 font-bold uppercase tracking-wider text-center w-24 text-white" style={{ color: '#ffffff' }}>Mid-Term ({sectionSettings.midTermWeight})</th>
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
                                <th className="border border-slate-900 px-1 py-1 font-bold uppercase tracking-wider text-center w-12 text-white" style={{ color: '#ffffff' }}>CA ({totalContinuousAssessment})</th>
                                <th className="border border-slate-900 px-1 py-1 font-bold uppercase tracking-wider text-center w-12 text-white" style={{ color: '#ffffff' }}>Exam ({sectionSettings.examWeight})</th>
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
                        <div className="font-black text-center mb-1.5 border-b border-slate-900 pb-1" style={{ color: schoolColor }}>{usesFormalTemplate ? 'LEDGER SCALE' : usesComprehensiveTemplate ? 'RESULT SCALE' : 'GRADING KEY'}</div>
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
                     <p className="text-[9px] font-bold uppercase tracking-widest absolute -top-2 left-4 px-1" style={{ backgroundColor: '#f8fafc', color: schoolColor }}>{sectionHeadTitle}&apos;s Remark</p>
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
                              <p className="text-[9px] font-bold uppercase">{sectionHeadTitle}</p>
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
                                 <span className="text-[4px] font-black tracking-widest leading-none stamp-mock uppercase max-w-[90%] text-center overflow-hidden">{schoolInitials}</span>
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
                        <span className="font-bold text-slate-700">NOTICE:</span> This is {schoolName}&apos;s official transcript. <br/>Any alteration renders this document invalid.
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
               ) : (
                  <EarlyExplorersResultPage
                     schoolColor={schoolColor}
                     schoolName={schoolName}
                     className={displayClassName}
                     studentName={selectedStudentData.name}
                     sessionName={activeSession.session}
                     termName={activeTerm.name}
                     teacherRemark={activeTerm.summary.teacherRemark}
                     principalRemark={activeTerm.summary.principalRemark}
                     sectionHeadTitle={sectionHeadTitle}
                     averageScore={averageScore}
                     traitsText={affectiveTraits}
                     subjects={activeTerm.subjects}
                  />
               )}

               {showSecondPage ? (
                  pageTwoVariant === 'progress' ? (
                     <NurseryProgressReportPage
                        schoolColor={schoolColor}
                        schoolName={schoolName}
                        className={displayClassName}
                        studentName={selectedStudentData.name}
                        termName={activeTerm.name}
                        sessionName={activeSession.session}
                        sectionHeadTitle={sectionHeadTitle}
                        averageScore={averageScore}
                        traitsText={affectiveTraits}
                        subjects={activeTerm.subjects}
                        sections={activePageTwo?.nurseryProgressSections}
                     />
                  ) : pageTwoVariant === 'cognitive' ? (
                     <GradeCognitivePage2
                        schoolColor={schoolColor}
                        schoolName={schoolName}
                        studentName={selectedStudentData.name}
                        remark={activeTerm.summary.principalRemark}
                        sectionHeadTitle={sectionHeadTitle}
                        traitsText={affectiveTraits}
                        subjects={activeTerm.subjects}
                        averageScore={averageScore}
                        sections={activePageTwo?.gradeCognitiveSections}
                     />
                  ) : null
               ) : null}
               </div>
          </div>
        </div>
      ) : null}

         {teacherView && examType === 'mid-term' ? (
            <div className="space-y-4">
               <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm dark:border-amber-900/50 dark:bg-amber-900/10 mb-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div>
                     <h3 className="text-lg font-bold text-slate-900 dark:text-white">Mid-Term Publisher</h3>
                     <p className="text-sm text-slate-600 dark:text-slate-400">Review the Mid-Term scores. Upon submission, it will be moved to {sectionHeadTitle} for approval.</p>
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
