import React, { useState } from 'react';
import { Subject, Role, Assignment, Question, AssignmentAnswer, Submission } from '../types';
import { ClipboardList, Plus, Trash2, Clock, ArrowLeft, Send, CheckCircle2, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AssessmentBuilder } from './AssessmentBuilder';
import { AssessmentViewer } from './AssessmentViewer';
import { fetchWithAuth } from '../../../../services/apiClient';

interface Props {
  subject: Subject;
  role: Role;
  onUpdate: (subject: Subject) => void;
  isDarkMode: boolean;
}

export function AssignmentTab({ subject, role, onUpdate, isDarkMode }: Props) {
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  // Create State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);

  // Take State
  const [answers, setAnswers] = useState<Record<string, any>>({});

  const canEdit = ['teacher', 'hos', 'owner', 'ict', 'sectional_head'].includes(role);
  const isStudent = role === 'student';

  const currentStudentId = 'student-123';
  const currentStudentName = 'Alex Johnson';

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate || !canEdit || questions.length === 0) return;

    try {
      const totalPoints = questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);
      
      const payload = {
        subject_id: parseInt(subject.id),
        title: title.trim(),
        description: description.trim(),
        due_date: new Date(dueDate).toISOString(),
        points: totalPoints > 0 ? totalPoints : 100,
        questions
      };

      await fetchWithAuth('/api/classroom/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      // Trigger refresh in parent
      onUpdate(subject);

      setTitle('');
      setDescription('');
      setDueDate('');
      setQuestions([]);
      setView('list');
    } catch (error) {
      console.error('Error saving assignment:', error);
      alert('Failed to save assignment. Please try again.');
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) return;
    onUpdate({
      ...subject,
      assignments: subject.assignments.filter(a => a.id !== id)
    });
  };

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmitWork = (assignmentId: string) => {
    if (!isStudent) return;

    const assignment = subject.assignments.find(a => a.id === assignmentId);
    if (!assignment) return;

    let totalScore = 0;

    const formattedAnswers: AssignmentAnswer[] = Object.entries(answers).map(([questionId, value]) => {
      const q = assignment.questions.find(q => q.id === questionId);
      let isCorrect = false;
      let score = 0;

      if (q && q.correctAnswer) {
        if (q.type === 'multiple_choice' || q.type === 'true_false' || q.type === 'short_answer') {
          isCorrect = String(value).toLowerCase().trim() === String(q.correctAnswer).toLowerCase().trim();
        } else if (q.type === 'checkboxes') {
          const correctArr = (q.correctAnswer as string[]) || [];
          const valArr = (value as string[]) || [];
          isCorrect = correctArr.length === valArr.length && correctArr.every(c => valArr.includes(c));
        } else if (q.type === 'matching') {
          const valObj = (value as Record<string, string>) || {};
          isCorrect = q.matchingPairs?.every(p => valObj[p.left] === p.right) ?? false;
        }
        
        if (isCorrect) {
          score = q.points;
          totalScore += score;
        }
      }

      return {
        questionId,
        value,
        isCorrect,
        score
      };
    });

    const newSubmission: Submission = {
      id: Date.now().toString(),
      studentId: currentStudentId,
      studentName: currentStudentName,
      answers: formattedAnswers,
      submittedAt: new Date().toISOString(),
      totalScore
    };

    const updatedAssignments = subject.assignments.map(a => {
      if (a.id === assignmentId) {
        return {
          ...a,
          submissions: [...(a.submissions || []), newSubmission]
        };
      }
      return a;
    });

    onUpdate({
      ...subject,
      assignments: updatedAssignments
    });
    
    setAnswers({});
    setView('list');
    setSelectedAssignmentId(null);
  };

  if (view === 'create' && canEdit) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setView('list')}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <h2 className="text-lg font-bold">Assignment Builder</h2>
        </div>

        <form onSubmit={handleSaveAssignment} className="space-y-4">
          <div className="glass-panel rounded-xl p-4 space-y-3">
            <div>
              <label className="block text-[10px] font-bold mb-1 uppercase tracking-wider text-stone-500 dark:text-stone-400">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Midterm Essay"
                className={`w-full px-3 py-2 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 transition-all ${
                  isDarkMode ? 'bg-white/5 border border-white/10 text-white' : 'bg-stone-50 border border-stone-200 text-stone-900'
                }`}
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold mb-1 uppercase tracking-wider text-stone-500 dark:text-stone-400">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Assignment details and instructions..."
                rows={2}
                className={`w-full px-3 py-2 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 transition-all resize-none ${
                  isDarkMode ? 'bg-white/5 border border-white/10 text-white' : 'bg-stone-50 border border-stone-200 text-stone-900'
                }`}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold mb-1 uppercase tracking-wider text-stone-500 dark:text-stone-400">Due Date</label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 transition-all ${
                  isDarkMode ? 'bg-white/5 border border-white/10 text-white scheme-dark' : 'bg-stone-50 border border-stone-200 text-stone-900'
                }`}
                required
              />
            </div>
          </div>

          <AssessmentBuilder questions={questions} onChange={setQuestions} isDarkMode={isDarkMode} />

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={!title.trim() || !dueDate || questions.length === 0}
              className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${
                !title.trim() || !dueDate || questions.length === 0
                  ? 'opacity-50 cursor-not-allowed bg-stone-200 text-stone-400 dark:bg-white/5 dark:text-stone-500'
                  : isDarkMode
                    ? 'bg-white text-black hover:bg-stone-200 shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                    : 'bg-amber-500 text-white hover:bg-amber-600 shadow-md'
              }`}
            >
              Assign to Class
            </button>
          </div>
        </form>
      </motion.div>
    );
  }

  if (view === 'detail' && selectedAssignmentId) {
    const assignment = subject.assignments.find(a => a.id === selectedAssignmentId);
    if (!assignment) {
      setView('list');
      return null;
    }

    const mySubmission = assignment.submissions?.find(s => s.studentId === currentStudentId);
    const isPastDue = new Date(assignment.dueDate) < new Date();

    // Convert submission answers back to Record<string, any> for Viewer
    const submissionAnswers = mySubmission?.answers?.reduce((acc, ans) => {
      acc[ans.questionId] = ans.value;
      return acc;
    }, {} as Record<string, any>) || {};

    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
        <button
          onClick={() => setView('list')}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Assignments
        </button>

        <div className="glass-panel rounded-xl p-5 dark:border dark:border-[#1d4e89]/30 dark:bg-[#0b1f4d]">
          <div className="flex items-start gap-3 mb-4">
            <div className={`p-2.5 rounded-lg shrink-0 ${isDarkMode ? 'border border-[#facc15]/15 bg-[#17336b] text-[#fef3c7]' : 'bg-amber-100 text-amber-600'}`}>
              <ClipboardList className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <h2 className="text-lg font-bold text-stone-900 dark:text-[16px] dark:font-extrabold dark:text-sky-300 leading-tight">{assignment.title}</h2>
                <span className="text-sm font-bold text-stone-900 dark:text-[16px] dark:font-extrabold dark:text-sky-300">{assignment.points} pts</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  isPastDue ? 'bg-red-100 text-red-700 dark:bg-sky-500/10 dark:text-sky-300' : 'bg-emerald-100 text-emerald-700 dark:bg-sky-500/10 dark:text-sky-300'
                }`}>
                  <Clock className="w-3 h-3" />
                  Due {new Date(assignment.dueDate).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </div>
              </div>
            </div>
          </div>
          
          {assignment.description && (
            <div className="whitespace-pre-wrap rounded-xl border border-stone-100 bg-stone-50/50 p-4 text-sm leading-7 text-stone-700 dark:border-sky-300/20 dark:bg-sky-500/10 dark:text-[16px] dark:font-extrabold dark:text-sky-300">
              {assignment.description}
            </div>
          )}
        </div>

        {isStudent ? (
          <div className="glass-panel rounded-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold flex items-center gap-2 text-stone-900 dark:text-[16px] dark:font-extrabold dark:text-sky-300">
                {mySubmission ? 'Your Submission' : 'Take Assignment'}
                {mySubmission && <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 text-[9px] uppercase tracking-wider">Turned In</span>}
              </h3>
              {mySubmission && mySubmission.totalScore !== undefined && (
                <div className="rounded-lg bg-stone-100 px-3 py-1 text-sm font-bold dark:bg-[#17336b] dark:text-white">
                  Score: <span className="text-emerald-600 dark:text-emerald-400">{mySubmission.totalScore}</span> / {assignment.points}
                </div>
              )}
            </div>
            
            <AssessmentViewer 
              questions={assignment.questions} 
              answers={mySubmission ? submissionAnswers : answers} 
              onChange={handleAnswerChange} 
              readonly={!!mySubmission} 
              isDarkMode={isDarkMode} 
              showGrading={!!mySubmission}
              variant="assignment"
            />

            {!mySubmission && (
              <div className="flex justify-end mt-6 pt-4 border-t border-stone-100 dark:border-white/10">
                <button
                  onClick={() => handleSubmitWork(assignment.id)}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                    isDarkMode
                      ? 'bg-white text-black hover:bg-stone-200 shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                      : 'bg-amber-500 text-white hover:bg-amber-600 shadow-md'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  Turn In Assignment
                </button>
              </div>
            )}
            
            {mySubmission && (
              <div className="mt-6 pt-4 border-t border-stone-100 dark:border-white/10 text-[10px] text-stone-500 dark:text-stone-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Submitted on {new Date(mySubmission.submittedAt).toLocaleString()}
              </div>
            )}
          </div>
        ) : (
          <div className="glass-panel rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                Student Submissions
              </h3>
              <div className="text-[10px] font-bold px-2 py-1 rounded-md bg-stone-100 dark:bg-[#17336b] text-stone-600 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                <Users className="w-3 h-3" />
                {assignment.submissions?.length || 0} Turned In
              </div>
            </div>

            {(!assignment.submissions || assignment.submissions.length === 0) ? (
              <div className="text-center py-8 text-xs text-stone-500 dark:text-stone-400 border border-dashed border-stone-200 dark:border-white/10 rounded-lg">
                No submissions yet.
              </div>
            ) : (
              <div className="space-y-4">
                {assignment.submissions.map(sub => {
                  const subAnswers = sub.answers?.reduce((acc, ans) => {
                    acc[ans.questionId] = ans.value;
                    return acc;
                  }, {} as Record<string, any>) || {};

                  return (
                    <div key={sub.id} className="bg-stone-50 dark:bg-[#102a63] border border-stone-200 dark:border-[#1d4e89]/30 rounded-xl p-4">
                      <div className="flex justify-between items-center mb-4 pb-2 border-b border-stone-200 dark:border-white/10">
                        <span className="text-sm font-bold text-stone-900 dark:text-white">{sub.studentName}</span>
                        <div className="flex items-center gap-3">
                          {sub.totalScore !== undefined && (
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              Score: {sub.totalScore} / {assignment.points}
                            </span>
                          )}
                          <span className="text-[10px] font-medium text-stone-500 dark:text-stone-300">
                            {new Date(sub.submittedAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      
                      <AssessmentViewer 
                        questions={assignment.questions} 
                        answers={subAnswers} 
                        readonly={true} 
                        isDarkMode={isDarkMode} 
                        showGrading={true}
                        variant="assignment"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </motion.div>
    );
  }

  // List View
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Assignments</h2>
        {canEdit && (
          <button
            onClick={() => setView('create')}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
              isDarkMode
                ? 'bg-white text-black hover:bg-stone-200 shadow-[0_0_10px_rgba(255,255,255,0.2)]'
                : 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Create
          </button>
        )}
      </div>

      <div className="space-y-2.5">
        {subject.assignments.length === 0 ? (
          <div className="glass-panel rounded-xl p-8 text-center flex flex-col items-center justify-center">
            <div className={`p-3 rounded-full mb-3 ${isDarkMode ? 'bg-white/5 text-stone-400' : 'bg-stone-100 text-stone-500'}`}>
              <ClipboardList className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold mb-1">No Assignments</h3>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 max-w-xs">
              {canEdit ? 'Create assignments to evaluate your students.' : 'You have no pending assignments for this subject.'}
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {subject.assignments.map((assignment) => {
              const isPastDue = new Date(assignment.dueDate) < new Date();
              const mySubmission = isStudent ? assignment.submissions?.find(s => s.studentId === currentStudentId) : null;
              const submissionCount = assignment.submissions?.length || 0;
              
              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={assignment.id}
                  onClick={() => {
                    setSelectedAssignmentId(assignment.id);
                    setView('detail');
                  }}
                  className="glass-panel rounded-xl p-3 md:p-4 group relative cursor-pointer hover:bg-stone-50/50 dark:bg-[#0b1f4d] dark:hover:bg-[#102a63] transition-colors border border-transparent hover:border-stone-200 dark:border-[#1d4e89]/25 dark:hover:border-[#facc15]/20"
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg shrink-0 ${isDarkMode ? 'border border-[#facc15]/15 bg-[#17336b] text-[#fef3c7]' : 'bg-amber-100 text-amber-600'}`}>
                      <ClipboardList className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                        <h3 className="text-sm font-bold truncate pr-8 text-stone-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-[#fde68a] transition-colors">{assignment.title}</h3>
                        <div className="flex items-center gap-2">
                          {isStudent && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                              mySubmission 
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' 
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-[#fde68a]'
                            }`}>
                              {mySubmission ? 'Turned In' : 'Assigned'}
                            </span>
                          )}
                          {!isStudent && submissionCount > 0 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
                              {submissionCount} Turned In
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-stone-900 dark:text-[#fef3c7] bg-stone-100 dark:bg-[#17336b] px-1.5 py-0.5 rounded">
                            {assignment.points} pts
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          isPastDue 
                            ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' 
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                        }`}>
                          <Clock className="w-3 h-3" />
                          Due {new Date(assignment.dueDate).toLocaleString(undefined, { 
                            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
                          })}
                        </div>
                      </div>

                      {assignment.description && (
                        <p className="text-[11px] text-stone-600 dark:text-white line-clamp-1">
                          {assignment.description}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {canEdit && (
                    <button
                      onClick={(e) => handleDelete(assignment.id, e)}
                      className="absolute top-3 right-3 p-1.5 opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-500 transition-all rounded-md hover:bg-red-50 dark:hover:bg-red-500/10"
                      title="Delete Assignment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
