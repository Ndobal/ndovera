import React, { useState } from 'react';
import { 
  BookOpen, 
  CheckCircle, 
  Clock, 
  XCircle, 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Sparkles, 
  Layout, 
  List, 
  Calendar, 
  ChevronRight, 
  UserCheck, 
  AlertCircle,
  X,
  Zap,
  ChevronLeft,
  Download,
  Printer,
  Share2,
  ThumbsUp,
  MessageCircle
} from 'lucide-react';
import { UserRole, LessonNote, LessonPlan } from '../../../shared/types';
import { motion, AnimatePresence } from 'motion/react';
import { generateLessonNote } from '../../../shared/services/geminiService';

const MOCK_NOTES: LessonNote[] = [
  {
    id: 'ln1',
    teacherId: 't1',
    teacherName: 'Mr. John Doe',
    subject: 'Mathematics',
    classLevel: 'SS3',
    week: 2,
    topic: 'Calculus',
    subtopic: 'Differentiation from First Principles',
    content: {
      objectives: ['Define differentiation', 'Apply first principles to simple functions'],
      introduction: 'Recall the concept of slope of a line...',
      body: 'The derivative represents the instantaneous rate of change...',
      activities: ['Solve x^2 using first principles', 'Group discussion on limits'],
      assessment: ['Differentiate 3x^2 + 5', 'Explain the limit notation'],
      summary: 'Differentiation is the process of finding the derivative...',
      references: ['New General Mathematics for SS3', 'Khan Academy']
    },
    status: 'Approved',
    submissionDate: '2026-02-24'
  },
  {
    id: 'ln2',
    teacherId: 't2',
    teacherName: 'Mrs. Sarah Smith',
    subject: 'Physics',
    classLevel: 'SS2',
    week: 3,
    topic: 'Waves',
    subtopic: 'Properties of Waves',
    content: {
      objectives: ['List properties of waves', 'Explain reflection and refraction'],
      introduction: 'Observe the ripples in a pond...',
      body: 'Waves transfer energy without transferring matter...',
      activities: ['Ripple tank experiment', 'Wave simulation on tablet'],
      assessment: ['What is diffraction?', 'Calculate wave speed'],
      summary: 'Waves exhibit reflection, refraction, diffraction...',
      references: ['Senior Secondary Physics by P.N. Okeke']
    },
    status: 'Submitted',
    submissionDate: '2026-02-25'
  }
];

const MOCK_PLANS: LessonPlan[] = [
  {
    id: 'lp1',
    lessonNoteId: 'ln1',
    teacherId: 't1',
    duration: 40,
    entryBehaviour: 'Students have basic knowledge of algebra and limits.',
    setInduction: 'Show a video of a car accelerating and ask about speed at a specific point.',
    breakdown: [
      { time: 5, activity: 'Introduction & Set Induction' },
      { time: 15, activity: 'Explanation of First Principles' },
      { time: 10, activity: 'Group Practice' },
      { time: 5, activity: 'Questions & Answers' },
      { time: 5, activity: 'Summary & Evaluation' }
    ],
    teachingAids: ['Whiteboard', 'Graphing Calculator', 'Projector'],
    evaluation: 'Class quiz on differentiation',
    homework: 'Exercise 2.1 in textbook'
  }
];

type AcademicsTab = 'overview' | 'notes' | 'plans' | 'monitoring';

export default function AcademicsModule({ role, auras, deductAuras }: { role: UserRole; auras: number; deductAuras: (amount: number, reason: string) => boolean }) {
  const [activeTab, setActiveTab] = useState<AcademicsTab>('overview');
  const [notes, setNotes] = useState<LessonNote[]>(MOCK_NOTES);
  const [selectedNote, setSelectedNote] = useState<LessonNote | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genTopic, setGenTopic] = useState('');
  const [genSubject, setGenSubject] = useState('Mathematics');
  const [genClass, setGenClass] = useState('SS3');
  const [showGenModal, setShowGenModal] = useState(false);
  
  const isManagement = [UserRole.SUPER_ADMIN, UserRole.PROPRIETOR, UserRole.HOS, UserRole.PRINCIPAL, UserRole.HEAD_TEACHER].includes(role);
  const isTeacher = role === UserRole.TEACHER;
  const canApprove = isManagement;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Academic Management</h2>
          <p className="text-slate-500">Curriculum, lesson delivery, and academic quality control.</p>
        </div>
        {isTeacher && (
          <button 
            onClick={() => alert('Opening Lesson Note Editor...')}
            className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create New Note
          </button>
        )}
      </div>

      {/* Sub-navigation */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm w-fit overflow-x-auto">
        <button 
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'overview' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          <Layout className="w-3.5 h-3.5" />
          Overview
        </button>
        <button 
          onClick={() => setActiveTab('notes')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'notes' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          <FileText className="w-3.5 h-3.5" />
          Lesson Notes
        </button>
        <button 
          onClick={() => setActiveTab('plans')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'plans' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          <Calendar className="w-3.5 h-3.5" />
          Lesson Plans
        </button>
        {isManagement && (
          <button 
            onClick={() => setActiveTab('monitoring')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'monitoring' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Monitoring
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div 
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-lg"><BookOpen className="w-5 h-5" /></div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100">Total Lessons</h4>
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">142</p>
              <p className="text-xs text-slate-500 mt-1">Across all sections</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-50 dark:bg-amber-500/10 text-amber-600 rounded-lg"><Clock className="w-5 h-5" /></div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100">Pending Approval</h4>
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">18</p>
              <p className="text-xs text-slate-500 mt-1">Requires review</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-lg"><CheckCircle className="w-5 h-5" /></div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100">Approved Content</h4>
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">114</p>
              <p className="text-xs text-slate-500 mt-1">Ready for delivery</p>
            </div>
          </motion.div>
        )}

        {activeTab === 'notes' && (
          <motion.div 
            key="notes"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 dark:text-slate-100">Lesson Note Registry</h3>
                <div className="flex gap-2">
                  <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
                    <Search className="w-4 h-4" />
                  </button>
                  <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
                    <Filter className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Topic & Class</th>
                      <th className="px-6 py-4">Teacher</th>
                      <th className="px-6 py-4">Week</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {notes.map((note) => (
                      <tr key={note.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{note.topic}</p>
                          <p className="text-xs text-slate-500">{note.subject} • {note.classLevel}</p>
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{note.teacherName}</td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">Week {note.week}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase flex items-center gap-1 w-fit ${
                            note.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 
                            note.status === 'Submitted' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                          }`}>
                            {note.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => setSelectedNote(note)}
                            className="text-emerald-600 font-bold hover:underline"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* AI Assistant Promo */}
            {isTeacher && (
              <div className="bg-slate-900 dark:bg-black p-8 rounded-3xl text-white relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-xl font-bold">AI Lesson Assistant</h3>
                  </div>
                  <p className="text-slate-400 text-sm mb-6 max-w-md">
                    Generate structured lesson notes, objectives, and assessment questions in seconds using our school-safe AI.
                  </p>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setShowGenModal(true)}
                      className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      Generate Lesson Note
                    </button>
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Cost: 50 Auras</span>
                  </div>
                </div>
                <div className="absolute -bottom-12 -right-12 opacity-10">
                  <BookOpen className="w-64 h-64" />
                </div>
              </div>
            )}

            {/* AI Generation Modal */}
            {showGenModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2rem] overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800"
                >
                  <div className="p-8 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 rounded-lg">
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">AI Lesson Assistant</h3>
                      </div>
                      <button onClick={() => setShowGenModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Topic</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Simultaneous Equations" 
                          value={genTopic}
                          onChange={(e) => setGenTopic(e.target.value)}
                          className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 dark:text-slate-200" 
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase">Subject</label>
                          <select 
                            value={genSubject}
                            onChange={(e) => setGenSubject(e.target.value)}
                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 dark:text-slate-200"
                          >
                            <option>Mathematics</option>
                            <option>English Language</option>
                            <option>Biology</option>
                            <option>Chemistry</option>
                            <option>Physics</option>
                            <option>Economics</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase">Class Level</label>
                          <select 
                            value={genClass}
                            onChange={(e) => setGenClass(e.target.value)}
                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 dark:text-slate-200"
                          >
                            <option>SS3</option>
                            <option>SS2</option>
                            <option>SS1</option>
                            <option>JS3</option>
                            <option>JS2</option>
                            <option>JS1</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-bold text-emerald-900 dark:text-emerald-400 uppercase tracking-wider">Cost: 50 Auras</span>
                      </div>
                      <span className="text-xs text-slate-500">Your Balance: {auras} Auras</span>
                    </div>

                    <button 
                      disabled={!genTopic || isGenerating || auras < 50}
                      onClick={async () => {
                        setIsGenerating(true);
                        try {
                          if (deductAuras(50, `AI Lesson Note: ${genTopic}`)) {
                            const note = await generateLessonNote(genTopic, genSubject, genClass);
                            const newNote: LessonNote = {
                              id: Math.random().toString(36).substr(2, 9),
                              teacherId: '1',
                              teacherName: 'Dr. Ndobera',
                              subject: genSubject,
                              classLevel: genClass,
                              week: 5,
                              topic: note.topic,
                              subtopic: note.subtopic,
                              content: {
                                objectives: note.objectives,
                                introduction: note.introduction,
                                body: note.body,
                                activities: note.activities,
                                assessment: note.assessment,
                                summary: note.summary,
                                references: note.references
                              },
                              status: 'Draft',
                              submissionDate: new Date().toISOString()
                            };
                            setNotes(prev => [newNote, ...prev]);
                            setSelectedNote(newNote);
                            setShowGenModal(false);
                            setGenTopic('');
                          } else {
                            alert('Insufficient Auras! Enable Farming Mode to earn more.');
                          }
                        } catch (err) {
                          alert('Failed to generate lesson note. Please try again.');
                        } finally {
                          setIsGenerating(false);
                        }
                      }}
                      className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"
                    >
                      {isGenerating ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Generating with AI...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Generate Content
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'plans' && (
          <motion.div 
            key="plans"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {MOCK_PLANS.map((plan) => (
              <div key={plan.id} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-lg">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-100">Lesson Execution Plan</h4>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Duration: {plan.duration} mins</p>
                    </div>
                  </div>
                  <button className="text-emerald-600 font-bold text-xs hover:underline">Edit Plan</button>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Entry Behaviour</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{plan.entryBehaviour}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Time Breakdown</p>
                    {plan.breakdown.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <span className="text-[10px] font-bold text-emerald-600 w-12">{item.time}m</span>
                        <span className="text-xs text-slate-700 dark:text-slate-300">{item.activity}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layout className="w-4 h-4 text-slate-400" />
                      <span className="text-xs text-slate-500">{plan.teachingAids.length} Teaching Aids</span>
                    </div>
                    <button className="flex items-center gap-1 text-emerald-600 font-bold text-xs hover:underline">
                      Full Details
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <button className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-emerald-200 hover:text-emerald-600 transition-all">
              <Plus className="w-8 h-8" />
              <span className="text-sm font-bold">Create Execution Plan</span>
            </button>
          </motion.div>
        )}

        {activeTab === 'monitoring' && isManagement && (
          <motion.div 
            key="monitoring"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4">Submission Compliance</h4>
                <div className="flex items-center gap-8">
                  <div className="relative w-24 h-24">
                    <svg className="w-full h-full" viewBox="0 0 36 36">
                      <path className="text-slate-100 dark:text-slate-800" strokeDasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                      <path className="text-emerald-500" strokeDasharray="85, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-bold">85%</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">85% of teachers submitted on time.</p>
                    <p className="text-xs text-rose-500 font-bold">15% Late Submissions</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4">Quality Score</h4>
                <div className="flex items-center gap-8">
                  <div className="relative w-24 h-24">
                    <svg className="w-full h-full" viewBox="0 0 36 36">
                      <path className="text-slate-100 dark:text-slate-800" strokeDasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                      <path className="text-blue-500" strokeDasharray="92, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-bold">92%</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">Average approval rate for first-time submissions.</p>
                    <p className="text-xs text-emerald-500 font-bold">Excellent Compliance</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4">Teacher Compliance Leaderboard</h4>
              <div className="space-y-4">
                {[
                  { name: 'Mr. John Doe', score: 98, status: 'Excellent' },
                  { name: 'Mrs. Sarah Smith', score: 95, status: 'Excellent' },
                  { name: 'Mr. Peter Pan', score: 72, status: 'Needs Improvement' },
                ].map((t, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-xs font-bold">{t.name[0]}</div>
                      <span className="text-sm font-semibold">{t.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{t.score}%</p>
                      <p className={`text-[10px] font-bold uppercase ${t.score > 90 ? 'text-emerald-500' : 'text-rose-500'}`}>{t.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Note Detail Modal (Simplified for demo) */}
      {selectedNote && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{selectedNote.topic}</h3>
                <p className="text-xs text-slate-500">{selectedNote.subject} • {selectedNote.classLevel} • Week {selectedNote.week}</p>
              </div>
              <button 
                onClick={() => setSelectedNote(null)}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-400"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              <section>
                <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-3">Objectives</h4>
                <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
                  {selectedNote.content.objectives.map((obj, i) => <li key={i}>{obj}</li>)}
                </ul>
              </section>
              <section>
                <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-3">Introduction</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{selectedNote.content.introduction}</p>
              </section>
              <section>
                <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-3">Lesson Body</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{selectedNote.content.body}</p>
              </section>
              <div className="grid grid-cols-2 gap-6">
                <section>
                  <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-3">Activities</h4>
                  <ul className="list-disc list-inside text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    {selectedNote.content.activities.map((act, i) => <li key={i}>{act}</li>)}
                  </ul>
                </section>
                <section>
                  <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-3">Assessment</h4>
                  <ul className="list-disc list-inside text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    {selectedNote.content.assessment.map((ass, i) => <li key={i}>{ass}</li>)}
                  </ul>
                </section>
              </div>
            </div>
            {canApprove && selectedNote.status === 'Submitted' && (
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                <button className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors">Approve Note</button>
                <button className="flex-1 py-3 bg-rose-100 text-rose-600 rounded-xl font-bold hover:bg-rose-200 transition-colors">Reject Note</button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
