import React, { useState, useEffect } from 'react';
import { ChevronDown, Save, Calculator, Lock, Settings2, AlertCircle, Sparkles, PenTool, CheckCircle } from 'lucide-react';
import { Role } from '../types';
import { fetchWithAuth } from '../services/apiClient';
import { BillingLockBanner } from '../components/BillingLockBanner';
import { useBillingLock } from '../hooks/useBillingLock';

// Mock Data for Development
const MOCK_CLASSES = ['JSS 1 Gold', 'JSS 1 Silver', 'JSS 2 Gold', 'JSS 2 Silver', 'SS 1 Science', 'SS 1 Art'];
const MOCK_SUBJECTS = ['Mathematics', 'English Language', 'Basic Science', 'Social Studies', 'Computer Science'];
const MOCK_STUDENTS = [
  { id: 'student_s1', name: 'Alice Johnson', ca1: 8, ca2: 7, midTerm: 15, exam: 45, height: 1.5, weight: 45, affective: { punctuality: 5, neatness: 4 }, comment: '', headComment: '', teacherSignature: 'A. Johnson', headSignature: 'Pending' },
  { id: 'student_s2', name: 'Bob Williams', ca1: 9, ca2: 8, midTerm: 18, exam: 52, height: 1.48, weight: 42, affective: { punctuality: 5, neatness: 5 }, comment: '', headComment: '', teacherSignature: 'A. Johnson', headSignature: 'Pending' },
  { id: 'student_s3', name: 'Charlie Brown', ca1: 6, ca2: 5, midTerm: 12, exam: 30, height: 1.52, weight: 48, affective: { punctuality: 3, neatness: 3 }, comment: '', headComment: '', teacherSignature: 'A. Johnson', headSignature: 'Pending' },
];

const AFFECTIVE_TRAITS = ['Punctuality', 'Neatness', 'Politeness', 'Honesty', 'Initiative', 'Self-Control', 'Teamwork'];
const SCORESHEET_STORAGE_KEY = 'ndovera_scoresheet_state_v2';

type NurseryProgressSection = {
  id: string;
  title: string;
  items: Array<{ no: string; text: string; status: 'not_yet' | 'progressing' | 'yes' }>;
};

type GradeCognitiveSection = {
  id: string;
  title: string;
  items?: Array<{ label: string; rating: number }>;
  content?: Array<{ sub: string; items: Array<{ label: string; rating: number }> }>;
};

type StudentPageTwoRecord = {
  variant: 'none' | 'nursery-progress' | 'grade-cognitive';
  affectiveTraits: string[];
  physical: { height?: number | null; weight?: number | null };
  nurseryProgressSections?: NurseryProgressSection[];
  gradeCognitiveSections?: GradeCognitiveSection[];
};

function inferScoreSheetSection(className: string) {
  const normalized = className.trim().toLowerCase();
  if (/(early explorers|reception|pre[- ]school|preschool|nursery)/.test(normalized)) return 'pre-school';
  if (/(grade|primary|basic)/.test(normalized)) return 'primary';
  if (/(jss|junior secondary)/.test(normalized)) return 'junior-secondary';
  if (/(sss|senior secondary)/.test(normalized)) return 'senior-secondary';
  return 'primary';
}

function defaultNurseryProgressSections(): NurseryProgressSection[] {
  return [
    {
      id: '1',
      title: 'Language & Communication',
      items: [
        { no: '1', text: 'Follows simple spoken instructions', status: 'progressing' },
        { no: '2', text: 'Responds to stories, songs, and rhymes', status: 'progressing' },
        { no: '3', text: 'Attempts early reading and sound recognition', status: 'progressing' },
      ],
    },
    {
      id: '2',
      title: 'Numeracy & Discovery',
      items: [
        { no: '1', text: 'Counts objects with confidence', status: 'progressing' },
        { no: '2', text: 'Identifies shapes, colours, and patterns', status: 'progressing' },
        { no: '3', text: 'Participates in guided discovery activities', status: 'progressing' },
      ],
    },
    {
      id: '3',
      title: 'Personal, Social & Emotional Development',
      items: [
        { no: '1', text: 'Shows confidence in class participation', status: 'progressing' },
        { no: '2', text: 'Relates respectfully with classmates', status: 'progressing' },
        { no: '3', text: 'Manages routines with little support', status: 'progressing' },
      ],
    },
    {
      id: '4',
      title: 'Creative & Physical Expression',
      items: [
        { no: '1', text: 'Participates in music, art, and role play', status: 'progressing' },
        { no: '2', text: 'Handles learning materials carefully', status: 'progressing' },
        { no: '3', text: 'Shows balance and coordination during activities', status: 'progressing' },
      ],
    },
  ];
}

function defaultGradeCognitiveSections(): GradeCognitiveSection[] {
  return [
    {
      id: 'A',
      title: '(COGNITIVE)',
      content: [
        {
          sub: 'LANGUAGE SKILLS',
          items: [
            { label: 'Reading Fluency', rating: 3 },
            { label: 'Listening Comprehension', rating: 3 },
            { label: 'Speaking Confidence', rating: 3 },
          ],
        },
        {
          sub: 'MATHEMATICS SKILLS',
          items: [
            { label: 'Number Sense', rating: 3 },
            { label: 'Problem Solving', rating: 3 },
            { label: 'Measurement & Patterns', rating: 3 },
          ],
        },
      ],
    },
    {
      id: 'B',
      title: 'PERSONAL SOCIAL AND EMOTIONAL DEVELOPMENT',
      items: [
        { label: 'Punctuality', rating: 3 },
        { label: 'Neatness', rating: 3 },
        { label: 'Politeness', rating: 3 },
        { label: 'Teamwork', rating: 3 },
      ],
    },
    {
      id: 'C',
      title: 'CREATIVE DEVELOPMENT',
      items: [
        { label: 'Artistic Expression', rating: 3 },
        { label: 'Music & Rhythm', rating: 3 },
        { label: 'Practical Creativity', rating: 3 },
      ],
    },
  ];
}

function createDefaultPageTwoRecord(className: string, student: typeof MOCK_STUDENTS[number]): StudentPageTwoRecord {
  const section = inferScoreSheetSection(className);
  if (section === 'pre-school') {
    return {
      variant: 'nursery-progress',
      affectiveTraits: [...AFFECTIVE_TRAITS],
      physical: { height: student.height || null, weight: student.weight || null },
      nurseryProgressSections: defaultNurseryProgressSections(),
    };
  }
  if (section === 'primary') {
    return {
      variant: 'grade-cognitive',
      affectiveTraits: [...AFFECTIVE_TRAITS],
      physical: { height: student.height || null, weight: student.weight || null },
      gradeCognitiveSections: defaultGradeCognitiveSections(),
    };
  }
  return {
    variant: 'none',
    affectiveTraits: [...AFFECTIVE_TRAITS],
    physical: { height: student.height || null, weight: student.weight || null },
  };
}

function canRoleApplySectionalApproval(role: Role, className: string) {
  const section = inferScoreSheetSection(className);
  if (section === 'pre-school') return ['Nursery Head', 'Head of Section', 'Sectional Head'].includes(role);
  if (section === 'primary') return ['Head Teacher', 'Head of Section', 'Sectional Head'].includes(role);
  if (section === 'junior-secondary') return ['Junior School Principal', 'Principal', 'Head of Section', 'Sectional Head'].includes(role);
  if (section === 'senior-secondary') return ['Principal', 'Head of Section', 'Sectional Head'].includes(role);
  return false;
}

export const ScoreSheetView = ({ role }: { role: Role }) => {
  if (['Student', 'Parent'].includes(role)) {
    return (
      <div className="flex h-screen items-center justify-center p-4 text-center">
        <div className="rounded-2xl bg-white p-8 shadow-sm dark:bg-slate-800">
          <Lock className="mx-auto mb-4 h-12 w-12 text-slate-300" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Access Restricted</h2>
          <p className="mt-2 text-slate-500">Only staff members can access score sheets.</p>
        </div>
      </div>
    );
  }

  const [selectedClass, setSelectedClass] = useState(MOCK_CLASSES[0]);
  const [selectedSubject, setSelectedSubject] = useState(MOCK_SUBJECTS[0]);
  const [scores, setScores] = useState(MOCK_STUDENTS);
  const [pageTwoRecords, setPageTwoRecords] = useState<Record<string, StudentPageTwoRecord>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'cognitive' | 'affective' | 'comments'>('cognitive');
  const [showConfig, setShowConfig] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const { softLockActive, overdueInvoice } = useBillingLock(role);
  const [examModeOpen, setExamModeOpen] = useState(false);

  // Configuration for Assessment Weights
  const [config, setConfig] = useState({
    ca1Max: 10,
    ca2Max: 10,
    midTermMax: 20, // The target weight for CA calculation
    examMax: 60,
    midTermOver100: true, // If true, teacher enters score over 100, system converts to midTermMax
  });

  const canEditConfig = ['HoS', 'School Admin', 'ICT Manager', 'Owner'].includes(role);
  const canToggleExamMode = ['HoS', 'School Admin', 'Owner'].includes(role);
  const canEditProtectedFields = canToggleExamMode || examModeOpen;
  const canApplySectionalApproval = canRoleApplySectionalApproval(role, selectedClass);
  const canApplyHosApproval = role === 'HoS';

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SCORESHEET_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (parsed?.selectedClass) setSelectedClass(parsed.selectedClass);
      if (parsed?.selectedSubject) setSelectedSubject(parsed.selectedSubject);
      if (Array.isArray(parsed?.scores)) setScores(parsed.scores);
      if (parsed?.pageTwoRecords && typeof parsed.pageTwoRecords === 'object') setPageTwoRecords(parsed.pageTwoRecords);
      if (parsed?.config) setConfig(parsed.config);
      if (typeof parsed?.examModeOpen === 'boolean') setExamModeOpen(parsed.examModeOpen);
    } catch {
      // ignore invalid local cache
    }
  }, []);

  const persistLocalState = (
    nextScores = scores,
    nextPageTwoRecords = pageTwoRecords,
    nextConfig = config,
    nextExamModeOpen = examModeOpen,
    nextSelectedClass = selectedClass,
    nextSelectedSubject = selectedSubject,
  ) => {
    localStorage.setItem(SCORESHEET_STORAGE_KEY, JSON.stringify({
      selectedClass: nextSelectedClass,
      selectedSubject: nextSelectedSubject,
      scores: nextScores,
      pageTwoRecords: nextPageTwoRecords,
      config: nextConfig,
      examModeOpen: nextExamModeOpen,
      savedAt: new Date().toISOString(),
    }));
  };

  const resolvePageTwoRecord = (student: typeof MOCK_STUDENTS[number], className = selectedClass) => {
    return pageTwoRecords[student.id] || createDefaultPageTwoRecord(className, student);
  };

  useEffect(() => {
    const nextPageTwoRecords = scores.reduce<Record<string, StudentPageTwoRecord>>((accumulator, student) => {
      accumulator[student.id] = resolvePageTwoRecord(student, selectedClass);
      return accumulator;
    }, {});
    setPageTwoRecords(nextPageTwoRecords);
    persistLocalState(scores, nextPageTwoRecords, config, examModeOpen, selectedClass, selectedSubject);
  }, [selectedClass]);

  const handleScoreChange = (id: string, field: string, value: string) => {
    if ((field === 'exam' || field === 'height' || field === 'weight') && !canEditProtectedFields) return;
    const numVal = Number(value) || 0;
    
    // Validate max based on configuration
    let max = 100;
    if (field === 'ca1') max = config.ca1Max;
    if (field === 'ca2') max = config.ca2Max;
    if (field === 'midTerm') max = config.midTermOver100 ? 100 : config.midTermMax;
    if (field === 'exam') max = config.examMax;

    // Psychomotor ranges
    if (field === 'height' || field === 'weight') max = 300; 

    setScores(prev => {
      const next = prev.map(student => 
        student.id === id ? { ...student, [field]: Math.min(numVal, max) } : student
      );
      const updatedStudent = next.find((student) => student.id === id);
      let nextPageTwoRecords = pageTwoRecords;
      if (updatedStudent && (field === 'height' || field === 'weight')) {
        nextPageTwoRecords = {
          ...pageTwoRecords,
          [id]: {
            ...resolvePageTwoRecord(updatedStudent),
            physical: {
              ...resolvePageTwoRecord(updatedStudent).physical,
              [field]: Math.min(numVal, max),
            },
          },
        };
        setPageTwoRecords(nextPageTwoRecords);
      }
      persistLocalState(next, nextPageTwoRecords);
      return next;
    });
  };

  const handleTraitChange = (id: string, trait: string, value: number) => {
    if (!canEditProtectedFields) return;
    setScores(prev => {
      const next = prev.map(student => 
        student.id === id ? { 
          ...student, 
          affective: { ...student.affective, [trait.toLowerCase()]: value } 
        } : student
      );
      persistLocalState(next);
      return next;
    });
  };

  const handleCommentChange = (id: string, field: 'comment' | 'headComment' | 'teacherSignature' | 'headSignature', text: string) => {
    const isHeadField = field === 'headComment' || field === 'headSignature';
    if (!isHeadField && !canEditProtectedFields) return;
    setScores(prev => {
      const next = prev.map(student => 
        student.id === id ? { ...student, [field]: text } : student
      );
      persistLocalState(next);
      return next;
    });
  };

  const updatePageTwoRecord = (studentId: string, updater: (current: StudentPageTwoRecord) => StudentPageTwoRecord) => {
    const student = scores.find((entry) => entry.id === studentId);
    if (!student || !canEditProtectedFields) return;
    const nextPageTwoRecords = {
      ...pageTwoRecords,
      [studentId]: updater(resolvePageTwoRecord(student)),
    };
    setPageTwoRecords(nextPageTwoRecords);
    persistLocalState(scores, nextPageTwoRecords);
  };

  const handleNurseryStatusChange = (studentId: string, sectionId: string, itemIndex: number, status: 'not_yet' | 'progressing' | 'yes') => {
    updatePageTwoRecord(studentId, (current) => ({
      ...current,
      nurseryProgressSections: (current.nurseryProgressSections || []).map((section) => (
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map((item, index) => (index === itemIndex ? { ...item, status } : item)),
            }
          : section
      )),
    }));
  };

  const handleGradeRatingChange = (studentId: string, sectionId: string, groupIndex: number | null, itemIndex: number, rating: number) => {
    updatePageTwoRecord(studentId, (current) => ({
      ...current,
      gradeCognitiveSections: (current.gradeCognitiveSections || []).map((section) => {
        if (section.id !== sectionId) return section;
        if (section.content && groupIndex !== null) {
          return {
            ...section,
            content: section.content.map((group, currentGroupIndex) => (
              currentGroupIndex === groupIndex
                ? {
                    ...group,
                    items: group.items.map((item, currentItemIndex) => (currentItemIndex === itemIndex ? { ...item, rating } : item)),
                  }
                : group
            )),
          };
        }
        return {
          ...section,
          items: (section.items || []).map((item, currentItemIndex) => (currentItemIndex === itemIndex ? { ...item, rating } : item)),
        };
      }),
    }));
  };

  const getMidTermCalculated = (rawScore: number) => {
    if (!config.midTermOver100) return rawScore;
    // precise calculation: (score / 100) * max
    return Number(((rawScore / 100) * config.midTermMax).toFixed(1));
  };

  const calculateTotalCA = (student: typeof MOCK_STUDENTS[0]) => {
    const mt = getMidTermCalculated(student.midTerm || 0);
    return Number(((student.ca1 || 0) + (student.ca2 || 0) + mt).toFixed(1));
  };

  const calculateTotal = (student: typeof MOCK_STUDENTS[0]) => {
    return Math.round(calculateTotalCA(student) + (student.exam || 0));
  };

  const calculateGrade = (total: number) => {
    if (total >= 70) return { grade: 'A', remark: 'Excellent', color: 'text-green-600 bg-green-50 border-green-200' };
    if (total >= 60) return { grade: 'B', remark: 'Very Good', color: 'text-blue-600 bg-blue-50 border-blue-200' };
    if (total >= 50) return { grade: 'C', remark: 'Credit', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' };
    if (total >= 40) return { grade: 'D', remark: 'Pass', color: 'text-orange-600 bg-orange-50 border-orange-200' };
    return { grade: 'F', remark: 'Fail', color: 'text-red-600 bg-red-50 border-red-200' };
  };

  const generateTeacherComment = (student: typeof MOCK_STUDENTS[number]) => {
    const total = calculateTotal(student);
    const punctuality = student.affective.punctuality || 3;
    const neatness = student.affective.neatness || 3;
    if (total >= 70) {
      return `${student.name} showed strong mastery in ${selectedSubject} and maintained a confident performance throughout the term. Keep sustaining this quality preparation and classroom discipline.`;
    }
    if (total >= 50) {
      return `${student.name} produced a steady performance in ${selectedSubject}. With better revision habits and more consistency in classwork, the learner can move into a stronger grade band.`;
    }
    return `${student.name} needs closer academic support in ${selectedSubject}. Extra guided practice, improved punctuality, and more careful study routines will help the learner improve next term.`;
  };

  const generateHeadComment = (student: typeof MOCK_STUDENTS[number]) => {
    const total = calculateTotal(student);
    if (total >= 70) return 'A very commendable result. Maintain this standard and continue to aim higher.';
    if (total >= 50) return 'A fair performance. More focus and consistency are expected in the next reporting period.';
    return 'Performance is below expectation. A stronger support plan and closer monitoring are required.';
  };

  const buildResultPayload = (student: typeof MOCK_STUDENTS[number]) => {
    const total = calculateTotal(student);
    const grade = calculateGrade(total);
    const totalCA = calculateTotalCA(student);
    const pageTwo = resolvePageTwoRecord(student);
    const classSection = inferScoreSheetSection(selectedClass);
    return {
      studentId: student.id,
      studentName: student.name,
      className: selectedClass,
      classSection,
      session: '2025/2026',
      term: 'Term 3',
      feeStatus: 'Paid',
      outstanding: 'N0',
      subject: {
        subject: selectedSubject,
        ca: Math.round(totalCA),
        exam: student.exam,
        total,
        grade: grade.grade,
        remark: grade.remark,
      },
      summary: {
        attendance: 'Pending',
        position: 'Pending',
        teacherRemark: student.comment || generateTeacherComment(student),
        principalRemark: student.headComment || generateHeadComment(student),
      },
      trend: [String(Math.max(total - 8, 0)), String(Math.max(total - 3, 0)), String(total)],
      pageTwo: {
        ...pageTwo,
        physical: {
          height: typeof student.height === 'number' ? student.height : pageTwo.physical.height ?? null,
          weight: typeof student.weight === 'number' ? student.weight : pageTwo.physical.weight ?? null,
        },
      },
    };
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      persistLocalState(scores);
      await Promise.all(scores.map((student) =>
        fetchWithAuth('/api/classroom/results', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(buildResultPayload(student)),
        }),
      ));
      setSaveMessage('Score sheet saved. Comments, signatures, and subject scores are now reflected in the result record.');
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Unable to save score sheet changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApproval = async (stage: 'sectional' | 'hos') => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      persistLocalState(scores, pageTwoRecords);
      await Promise.all(scores.map(async (student) => {
        await fetchWithAuth('/api/classroom/results', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(buildResultPayload(student)),
        });

        await fetchWithAuth(`/api/classroom/results/${encodeURIComponent(student.id)}/approve`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            session: '2025/2026',
            term: 'Term 3',
            remark: stage === 'hos' ? (student.headComment || generateHeadComment(student)) : undefined,
          }),
        });
      }));
      setSaveMessage(stage === 'hos' ? 'HoS approval applied on the persisted result records.' : 'Sectional approval applied on the persisted result records.');
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Unable to apply approval.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl">
        {softLockActive ? <div className="mb-6"><BillingLockBanner invoiceId={overdueInvoice?.id} dismissible={false} compact /></div> : null}
        {/* Header */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Continuous Assessment Score Sheet</h1>
            <p className="mt-1 text-slate-500">Record academic and behavioral performance for {selectedClass}.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold ${examModeOpen ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-300' : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-300'}`}>
              {examModeOpen ? 'Examination Mode Open' : 'Examination Mode Locked'}
            </div>
            {canToggleExamMode ? (
              <button
                onClick={() => {
                  const nextValue = !examModeOpen;
                  setExamModeOpen(nextValue);
                  persistLocalState(scores, pageTwoRecords, config, nextValue);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-4 py-2.5 text-sm font-semibold text-purple-700 shadow-sm hover:bg-purple-100 transition-all dark:border-purple-900/40 dark:bg-purple-900/10 dark:text-purple-300"
              >
                <Lock size={16} />
                {examModeOpen ? 'Close Examination Mode' : 'Open Examination Mode'}
              </button>
            ) : null}
            {canEditConfig && (
               <button
                onClick={() => setShowConfig(!showConfig)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
              >
                <Settings2 size={18} />
                <span className="hidden sm:inline">Config</span>
              </button>
            )}
            {canApplySectionalApproval ? (
              <button
                onClick={() => handleApproval('sectional')}
                disabled={softLockActive || isSaving}
                className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-700 shadow-sm hover:bg-sky-100 disabled:opacity-50 transition-all dark:border-sky-900/40 dark:bg-sky-900/10 dark:text-sky-300"
              >
                <CheckCircle size={16} />
                Apply Sectional Approval
              </button>
            ) : null}
            {canApplyHosApproval ? (
              <button
                onClick={() => handleApproval('hos')}
                disabled={softLockActive || isSaving}
                className="inline-flex items-center gap-2 rounded-xl border border-fuchsia-200 bg-fuchsia-50 px-4 py-2.5 text-sm font-semibold text-fuchsia-700 shadow-sm hover:bg-fuchsia-100 disabled:opacity-50 transition-all dark:border-fuchsia-900/40 dark:bg-fuchsia-900/10 dark:text-fuchsia-300"
              >
                <CheckCircle size={16} />
                Apply HoS Approval
              </button>
            ) : null}
             <button
              onClick={handleSave}
              disabled={softLockActive || isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-all"
            >
              <Save size={18} />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Configuration Panel */}
        {showConfig && canEditConfig && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700 animate-in fade-in slide-in-from-top-4">
             <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 border-b pb-2 dark:border-slate-700">Assessment Weight Configuration</h3>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                <div>
                   <label className="block text-xs font-semibold text-slate-600 mb-1.5 dark:text-slate-400">CA 1 Max Score</label>
                   <input 
                    type="number" 
                    value={config.ca1Max}
                    onChange={e => setConfig({...config, ca1Max: Number(e.target.value)})} 
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium dark:bg-slate-900 dark:border-slate-700" 
                   />
                </div>
                <div>
                   <label className="block text-xs font-semibold text-slate-600 mb-1.5 dark:text-slate-400">CA 2 Max Score</label>
                   <input 
                    type="number" 
                    value={config.ca2Max}
                    onChange={e => setConfig({...config, ca2Max: Number(e.target.value)})} 
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium dark:bg-slate-900 dark:border-slate-700" 
                   />
                </div>
                <div>
                   <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Mid-Term Max</label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={config.midTermOver100} 
                          onChange={e => setConfig({...config, midTermOver100: e.target.checked})}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                        />
                        <span className="text-[10px] text-slate-500">Over 100%?</span>
                      </label>
                   </div>
                   <input 
                    type="number" 
                    value={config.midTermMax}
                    onChange={e => setConfig({...config, midTermMax: Number(e.target.value)})} 
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium dark:bg-slate-900 dark:border-slate-700" 
                   />
                   {config.midTermOver100 && (
                     <p className="mt-1 text-[10px] text-slate-400">Input out of 100, converted to {config.midTermMax}</p>
                   )}
                </div>
                <div>
                   <label className="block text-xs font-semibold text-slate-600 mb-1.5 dark:text-slate-400">Exam Max Score</label>
                   <input 
                    type="number" 
                    value={config.examMax}
                    onChange={e => setConfig({...config, examMax: Number(e.target.value)})} 
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium dark:bg-slate-900 dark:border-slate-700" 
                   />
                </div>
                <div className="flex flex-col justify-end pb-2">
                   <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 dark:bg-slate-900 dark:border-slate-700">
                      <Calculator size={16} className="text-slate-400" />
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        Total: {config.ca1Max + config.ca2Max + config.midTermMax + config.examMax}%
                      </span>
                   </div>
                   {config.ca1Max + config.ca2Max + config.midTermMax + config.examMax !== 100 && (
                     <p className="mt-1 text-[10px] text-red-500 flex items-center gap-1">
                       <AlertCircle size={10} /> Total should be 100%
                     </p>
                   )}
                </div>
             </div>
          </div>
        )}

        {/* Filters & Tabs */}
        <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm border border-slate-100 dark:bg-slate-800 dark:border-slate-700">
          {!canEditProtectedFields ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-300">
              Examination mode is locked. Teachers can still enter CA scores, but exam scores, affective ratings, comments, and signatures remain locked until HoS opens examination mode.
            </div>
          ) : null}
          <div className="flex flex-col md:flex-row gap-6">
             {/* Selectors */}
             <div className="flex flex-1 gap-4">
                <div className="flex-1 min-w-35">
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wider">Class</label>
                    <div className="relative">
                    <select
                        value={selectedClass}
                        onChange={(e) => {
                          const nextClass = e.target.value;
                          setSelectedClass(nextClass);
                          persistLocalState(scores, pageTwoRecords, config, examModeOpen, nextClass, selectedSubject);
                        }}
                        className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-10 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
                    >
                        {MOCK_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                </div>
                <div className="flex-1 min-w-35">
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wider">Subject</label>
                    <div className="relative">
                    <select
                        value={selectedSubject}
                        onChange={(e) => {
                          const nextSubject = e.target.value;
                          setSelectedSubject(nextSubject);
                          persistLocalState(scores, pageTwoRecords, config, examModeOpen, selectedClass, nextSubject);
                        }}
                        className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-10 text-sm font-medium text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
                    >
                        {MOCK_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                </div>
             </div>

             {/* Mode Tabs */}
             <div className="flex bg-slate-100 p-1 rounded-xl self-end dark:bg-slate-900/50">
                <button
                  onClick={() => setActiveTab('cognitive')}
                  className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                    activeTab === 'cognitive' ? 'bg-white text-emerald-600 shadow-sm dark:bg-slate-800 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                  }`}
                >
                  Academic Scores
                </button>
                <button
                  onClick={() => setActiveTab('affective')}
                  className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                    activeTab === 'affective' ? 'bg-white text-emerald-600 shadow-sm dark:bg-slate-800 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                  }`}
                >
                  Affective & Psychomotor
                </button>
                <button
                  onClick={() => setActiveTab('comments')}
                  className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                    activeTab === 'comments' ? 'bg-white text-emerald-600 shadow-sm dark:bg-slate-800 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                  }`}
                >
                  Comments
                </button>
             </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Subject quick entry</span>
            {MOCK_SUBJECTS.map((subject) => (
              <button
                key={subject}
                type="button"
                onClick={() => {
                  setSelectedSubject(subject);
                  persistLocalState(scores, pageTwoRecords, config, examModeOpen, selectedClass, subject);
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                  selectedSubject === subject
                    ? 'bg-amber-500 text-slate-950 shadow-sm dark:bg-amber-300 dark:text-slate-950'
                    : 'bg-slate-100 text-slate-700 hover:bg-amber-100 hover:text-slate-950 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-amber-400/20 dark:hover:text-amber-50'
                }`}
              >
                {subject}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Use the quick subject strip to enter one subject after another for the same class, following the result-entry flow more closely.
          </p>
        </div>

        {/* Dynamic Content Area */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:bg-slate-800 dark:border-slate-700">
          
          {/* TAB 1: COGNITIVE SCORES */}
          {activeTab === 'cognitive' && (
            <div className="overflow-x-auto">
                <table className="w-full min-w-225 text-left text-sm">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 dark:bg-slate-900/50 dark:border-slate-700">
                    <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white sticky left-0 bg-slate-50 z-10 dark:bg-slate-900">Student Name</th>
                    <th className="px-4 py-4 font-semibold text-center text-slate-600 dark:text-slate-300">
                        <div>CA 1</div>
                        <div className="text-[10px] font-normal text-slate-400">/ {config.ca1Max}</div>
                    </th>
                    <th className="px-4 py-4 font-semibold text-center text-slate-600 dark:text-slate-300">
                        <div>CA 2</div>
                        <div className="text-[10px] font-normal text-slate-400">/ {config.ca2Max}</div>
                    </th>
                    <th className="px-4 py-4 font-semibold text-center text-blue-600 dark:text-blue-400">
                        <div>Mid-Term</div>
                        <div className="text-[10px] font-normal text-blue-400/70">
                           {config.midTermOver100 ? 'Score / 100' : `/ ${config.midTermMax}`}
                        </div>
                    </th>
                    <th className="px-4 py-4 font-semibold text-center text-slate-900 bg-amber-50/90 dark:text-amber-50 dark:bg-amber-300/12">
                        <div>Total CA</div>
                        <div className="text-[10px] font-normal text-slate-400">/ {config.ca1Max + config.ca2Max + config.midTermMax}</div>
                    </th>
                    <th className="px-4 py-4 font-semibold text-center text-purple-600 dark:text-purple-400">
                        <div>Exam</div>
                        <div className="text-[10px] font-normal text-purple-400/70">/ {config.examMax}</div>
                    </th>
                    <th className="px-6 py-4 font-semibold text-center text-slate-900 bg-amber-100/90 dark:text-amber-50 dark:bg-amber-300/18">Total</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {scores.map((student, index) => {
                    const totalCA = calculateTotalCA(student);
                    const totalScore = calculateTotal(student);
                    const gradeInfo = calculateGrade(totalScore);
                    const midTermCalc = getMidTermCalculated(student.midTerm || 0);

                    return (
                        <tr key={student.id} className="group transition-colors hover:bg-amber-100/70 dark:hover:bg-amber-300/12">
                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white sticky left-0 bg-white group-hover:bg-amber-100/70 dark:bg-slate-800 dark:group-hover:bg-amber-300/12">
                            <div className="flex items-center gap-3">
                            <span className="w-5 text-xs text-slate-400">{index + 1}</span>
                            {student.name}
                            </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                            <input
                            type="number"
                            min="0"
                            max={config.ca1Max}
                            value={student.ca1 || ''}
                            onChange={(e) => handleScoreChange(student.id, 'ca1', e.target.value)}
                            className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-sm font-medium text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                            />
                        </td>
                        <td className="px-4 py-3 text-center">
                            <input
                            type="number"
                            min="0"
                            max={config.ca2Max}
                            value={student.ca2 || ''}
                            onChange={(e) => handleScoreChange(student.id, 'ca2', e.target.value)}
                            className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-sm font-medium text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                            />
                        </td>
                        <td className="px-4 py-3 text-center bg-blue-50/10">
                            <div className="flex flex-col items-center gap-1">
                                <input
                                type="number"
                                min="0"
                                max={config.midTermOver100 ? 100 : config.midTermMax}
                                value={student.midTerm || ''}
                                onChange={(e) => handleScoreChange(student.id, 'midTerm', e.target.value)}
                                className="w-16 rounded-lg border border-blue-200 bg-blue-50/20 px-2 py-1.5 text-center text-sm font-bold text-blue-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300"
                                />
                                {config.midTermOver100 && (
                                    <span className="text-[10px] text-blue-400 font-medium">
                                        = {midTermCalc}
                                    </span>
                                )}
                            </div>
                        </td>
                        <td className="px-4 py-4 text-center text-sm font-black text-amber-800 bg-amber-50/80 dark:text-amber-100 dark:bg-amber-300/10">
                            {totalCA}
                        </td>
                        <td className="px-4 py-3 text-center bg-purple-50/10">
                            <input
                            type="number"
                            min="0"
                            max={config.examMax}
                            value={student.exam || ''}
                            onChange={(e) => handleScoreChange(student.id, 'exam', e.target.value)}
                            disabled={!canEditProtectedFields}
                            className="w-16 rounded-lg border border-purple-200 bg-purple-50/20 px-2 py-1.5 text-center text-sm font-bold text-purple-700 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:bg-purple-900/20 dark:border-purple-700 dark:text-purple-300"
                            />
                        </td>
                        <td className="px-6 py-4 text-center text-lg font-black text-slate-950 bg-amber-100/80 dark:text-amber-50 dark:bg-amber-300/16">
                            {totalScore}
                        </td>
                        </tr>
                    );
                    })}
                </tbody>
                </table>
            </div>
          )}

          {/* TAB 2: AFFECTIVE & PSYCHOMOTOR */}
          {activeTab === 'affective' && (
            <div className="space-y-6">
              <div className="overflow-x-auto">
                  <table className="w-full min-w-250 text-left text-sm">
                  <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 dark:bg-slate-900/50 dark:border-slate-700">
                         <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white sticky left-0 bg-slate-50 z-10 w-48 dark:bg-slate-900">Student Name</th>
                         {AFFECTIVE_TRAITS.map(trait => (
                           <th key={trait} className="px-2 py-4 font-semibold text-center text-slate-600 dark:text-slate-300 w-24">
                              <div className="whitespace-nowrap -rotate-45 origin-bottom-left translate-x-4 mb-2">{trait}</div>
                           </th>
                         ))}
                         <th className="px-4 py-4 font-semibold text-center text-blue-600 border-l border-slate-100 dark:border-slate-800 dark:text-blue-400">Height (m)</th>
                         <th className="px-4 py-4 font-semibold text-center text-blue-600 dark:text-blue-400">Weight (kg)</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {scores.map((student) => (
                          <tr key={student.id} className="group transition-colors hover:bg-amber-100/60 dark:hover:bg-amber-300/10">
                            <td className="px-6 py-4 font-bold text-slate-900 dark:text-white sticky left-0 bg-white group-hover:bg-amber-100/60 dark:bg-slate-800 dark:group-hover:bg-amber-300/10 border-r border-slate-100 dark:border-slate-800">
                                  {student.name}
                              </td>
                              {AFFECTIVE_TRAITS.map(trait => {
                                  const val = (student.affective as any)?.[trait.toLowerCase()] || 0;
                                  return (
                                      <td key={trait} className="px-2 py-3 text-center">
                                         <select 
                                           value={val}
                                           onChange={e => handleTraitChange(student.id, trait, Number(e.target.value))}
                                           disabled={!canEditProtectedFields}
                                           className={`w-12 h-8 rounded border text-center text-xs font-bold appearance-none cursor-pointer outline-none focus:ring-2 ring-emerald-500
                                             ${val >= 4 ? 'bg-green-50 text-green-700 border-green-200' : 
                                               val >= 3 ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                               val >= 2 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 
                                               'bg-slate-50 text-slate-400 border-slate-200'}
                                           `}
                                         >
                                             <option value="5">5</option>
                                             <option value="4">4</option>
                                             <option value="3">3</option>
                                             <option value="2">2</option>
                                             <option value="1">1</option>
                                         </select>
                                      </td>
                                  );
                              })}
                              <td className="px-4 py-3 text-center border-l border-slate-100 dark:border-slate-800 bg-blue-50/5">
                                  <input
                                      type="number"
                                      step="0.01"
                                      value={student.height || ''}
                                      placeholder="0.00"
                                      onChange={(e) => handleScoreChange(student.id, 'height', e.target.value)}
                                      disabled={!canEditProtectedFields}
                                      className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-sm font-medium text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                  />
                              </td>
                              <td className="px-4 py-3 text-center bg-blue-50/5">
                                  <input
                                      type="number"
                                      step="0.1"
                                      value={student.weight || ''}
                                      placeholder="0.0"
                                      onChange={(e) => handleScoreChange(student.id, 'weight', e.target.value)}
                                      disabled={!canEditProtectedFields}
                                      className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-sm font-medium text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                  />
                              </td>
                          </tr>
                      ))}
                  </tbody>
                  </table>
              </div>

              {['pre-school', 'primary'].includes(inferScoreSheetSection(selectedClass)) ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900/40">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-700 dark:text-slate-200">Dedicated Page 2 Form</h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {inferScoreSheetSection(selectedClass) === 'pre-school'
                          ? 'These nursery progress entries are now saved as their own structured page-two record.'
                          : 'These grade cognitive entries are now saved as their own structured page-two record.'}
                      </p>
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300">
                      {inferScoreSheetSection(selectedClass) === 'pre-school' ? 'Nursery Progress' : 'Grade Cognitive'}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {scores.map((student) => {
                      const pageTwoRecord = resolvePageTwoRecord(student);
                      return (
                        <div key={`${student.id}-page-two`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950/40">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white">{student.name}</h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400">Structured page-two entries saved with the result record.</p>
                            </div>
                            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Variant: {pageTwoRecord.variant}</div>
                          </div>

                          {pageTwoRecord.variant === 'nursery-progress' ? (
                            <div className="space-y-4">
                              {(pageTwoRecord.nurseryProgressSections || []).map((section) => (
                                <div key={`${student.id}-${section.id}`} className="rounded-xl border border-slate-200 dark:border-slate-700">
                                  <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{section.title}</div>
                                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {section.items.map((item, itemIndex) => (
                                      <div key={`${section.id}-${item.no}`} className="grid gap-3 px-3 py-3 md:grid-cols-[1fr,180px] md:items-center">
                                        <div className="text-sm text-slate-700 dark:text-slate-200">{item.text}</div>
                                        <select
                                          value={item.status}
                                          onChange={(e) => handleNurseryStatusChange(student.id, section.id, itemIndex, e.target.value as 'not_yet' | 'progressing' | 'yes')}
                                          disabled={!canEditProtectedFields}
                                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                        >
                                          <option value="not_yet">Not Yet</option>
                                          <option value="progressing">Progressing</option>
                                          <option value="yes">Yes</option>
                                        </select>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : pageTwoRecord.variant === 'grade-cognitive' ? (
                            <div className="space-y-4">
                              {(pageTwoRecord.gradeCognitiveSections || []).map((section) => (
                                <div key={`${student.id}-${section.id}`} className="rounded-xl border border-slate-200 dark:border-slate-700">
                                  <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{section.title}</div>
                                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {section.content ? section.content.map((group, groupIndex) => (
                                      <div key={`${section.id}-${group.sub}`}>
                                        <div className="bg-slate-100 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:bg-slate-900 dark:text-slate-400">{group.sub}</div>
                                        {group.items.map((item, itemIndex) => (
                                          <div key={`${group.sub}-${item.label}`} className="grid gap-3 px-3 py-3 md:grid-cols-[1fr,100px] md:items-center">
                                            <div className="text-sm text-slate-700 dark:text-slate-200">{item.label}</div>
                                            <select
                                              value={item.rating}
                                              onChange={(e) => handleGradeRatingChange(student.id, section.id, groupIndex, itemIndex, Number(e.target.value))}
                                              disabled={!canEditProtectedFields}
                                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                            >
                                              {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating}</option>)}
                                            </select>
                                          </div>
                                        ))}
                                      </div>
                                    )) : (section.items || []).map((item, itemIndex) => (
                                      <div key={`${section.id}-${item.label}`} className="grid gap-3 px-3 py-3 md:grid-cols-[1fr,100px] md:items-center">
                                        <div className="text-sm text-slate-700 dark:text-slate-200">{item.label}</div>
                                        <select
                                          value={item.rating}
                                          onChange={(e) => handleGradeRatingChange(student.id, section.id, null, itemIndex, Number(e.target.value))}
                                          disabled={!canEditProtectedFields}
                                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                        >
                                          {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating}</option>)}
                                        </select>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 3: COMMENTS */}
          {activeTab === 'comments' && (
             <div className="overflow-x-auto">
                 <table className="w-full min-w-200 text-left text-sm">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 dark:bg-slate-900/50 dark:border-slate-700">
                           <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white w-48">Student Name</th>
                           <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white">Class Teacher's Comment</th>
                           <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white">Head/Principal's Comment</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {scores.map((student) => (
                            <tr key={student.id} className="group hover:bg-slate-50 transition-colors dark:hover:bg-slate-800/50">
                                <td className="px-6 py-4 font-medium text-slate-900 dark:text-white align-top pt-6">
                                    {student.name}
                                    <div className="text-xs text-slate-500 mt-1 font-normal">Final Grade: <span className="font-bold">{calculateGrade(calculateTotal(student)).grade}</span></div>
                                </td>
                                <td className="px-6 py-4">
                                    <textarea
                                        value={student.comment}
                                        onChange={e => handleCommentChange(student.id, 'comment', e.target.value)}
                                        disabled={!canEditProtectedFields}
                                        placeholder="Enter remark about student performance..."
                                        className="w-full h-20 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                    />
                                    <div className="flex justify-end gap-2 mt-2">
                                        <button
                                          type="button"
                                          onClick={() => handleCommentChange(student.id, 'comment', generateTeacherComment(student))}
                                          disabled={!canEditProtectedFields}
                                          className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                                        >
                                          <Sparkles size={12} /> Auto-Generate with AI ✨
                                        </button>
                                    </div>
                                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
                                        <label className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                          <PenTool size={12} /> Class Teacher Signature
                                        </label>
                                        <input
                                          value={(student as any).teacherSignature || ''}
                                          onChange={e => handleCommentChange(student.id, 'teacherSignature', e.target.value)}
                                          disabled={!canEditProtectedFields}
                                          placeholder="Type signature or approval name"
                                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:bg-slate-950 dark:border-slate-700 dark:text-white"
                                        />
                                    </div>
                                </td>
                                <td className="px-6 py-4 bg-slate-50/50 dark:bg-slate-900/30">
                                    <textarea
                                        value={student.headComment}
                                        onChange={e => handleCommentChange(student.id, 'headComment', e.target.value)}
                                        disabled={!['HoS', 'School Admin', 'Owner'].includes(role)}
                                        placeholder={['HoS', 'School Admin', 'Owner'].includes(role) ? "Enter Principal's remark..." : "Reserved for Head of School"}
                                        className="w-full h-20 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none disabled:opacity-50 disabled:bg-slate-100 dark:bg-slate-900 dark:border-slate-700 dark:text-white dark:disabled:bg-slate-800"
                                    />
                                    <div className="mt-2 flex justify-end gap-2">
                                        {['HoS', 'School Admin', 'Owner'].includes(role) ? (
                                          <button
                                            type="button"
                                            onClick={() => handleCommentChange(student.id, 'headComment', generateHeadComment(student))}
                                            className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-medium"
                                          >
                                            <Sparkles size={12} /> Auto-Generate with AI ✨
                                          </button>
                                        ) : null}
                                    </div>
                                    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
                                        <label className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                          <PenTool size={12} /> HoS / Principal Signature
                                        </label>
                                        <input
                                          value={(student as any).headSignature || ''}
                                          onChange={e => handleCommentChange(student.id, 'headSignature', e.target.value)}
                                          disabled={!['HoS', 'School Admin', 'Owner'].includes(role)}
                                          placeholder="Approval signature"
                                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50 dark:bg-slate-950 dark:border-slate-700 dark:text-white"
                                        />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
             </div>
          )}

          {/* Footer */}
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between dark:bg-slate-900 dark:border-slate-700">
             <div className="text-xs text-slate-500">
               {activeTab === 'cognitive' && "Scores automatically saved locally. Click Save Changes to push to server."}
               {activeTab === 'affective' && "Rate traits on a scale of 1-5 (5 = Excellent, 1 = Poor)."}
               {activeTab === 'comments' && "Comments and signatures entered here become part of the student's result record."}
             </div>
             <div className="text-sm font-medium text-slate-600 dark:text-slate-400 w-fit ml-auto">
               Showing {scores.length} students
             </div>
          </div>
        </div>

        {saveMessage ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-300">
            {saveMessage}
          </div>
        ) : null}

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={softLockActive || isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-all"
          >
            <Save size={18} />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
