import React, { useState } from 'react';
import { Subject, Role, Classwork, Submission, Question, AssignmentAnswer } from '../types';
import { FileText, Plus, Trash2, Calendar, ArrowLeft, Send, CheckCircle2, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AssessmentBuilder } from './AssessmentBuilder';
import { AssessmentViewer } from './AssessmentViewer';

interface Props {
  subject: Subject;
  role: Role;
  onUpdate: (subject: Subject) => void;
  isDarkMode: boolean;
}

export function ClassworkTab({ subject, role, onUpdate, isDarkMode }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedClassworkId, setSelectedClassworkId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});

  const canEdit = ['teacher', 'hos', 'owner', 'ict', 'sectional_head'].includes(role);
  const isStudent = role === 'student';

  // Mock student data for demonstration
  const currentStudentId = 'student-123';
  const currentStudentName = 'Alex Johnson';

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !canEdit) return;

    const newCw: Classwork = {
      id: Date.now().toString(),
      title: title.trim(),
      description: description.trim(),
      date: new Date().toISOString(),
      questions: questions.length > 0 ? questions : undefined,
      submissions: []
    };

    onUpdate({
      ...subject,
      classworks: [newCw, ...subject.classworks]
    });
    
    setTitle('');
    setDescription('');
    setQuestions([]);
    setIsAdding(false);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) return;
    onUpdate({
      ...subject,
      classworks: subject.classworks.filter(cw => cw.id !== id)
    });
    if (selectedClassworkId === id) {
      setSelectedClassworkId(null);
    }
  };

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmitWork = (classworkId: string) => {
    if (!isStudent) return;

    const cw = subject.classworks.find(c => c.id === classworkId);
    if (!cw) return;

    let totalScore = 0;
    let formattedAnswers: AssignmentAnswer[] = [];

    if (cw.questions && cw.questions.length > 0) {
      formattedAnswers = Object.entries(answers).map(([questionId, value]) => {
        const q = cw.questions!.find(q => q.id === questionId);
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
    } else {
      // Legacy support for text-only submission
      formattedAnswers = [{
        questionId: 'legacy-text',
        value: answers['legacy-text'] || ''
      }];
    }

    const newSubmission: Submission = {
      id: Date.now().toString(),
      studentId: currentStudentId,
      studentName: currentStudentName,
      answers: formattedAnswers,
      submittedAt: new Date().toISOString(),
      totalScore: cw.questions ? totalScore : undefined
    };

    const updatedClassworks = subject.classworks.map(c => {
      if (c.id === classworkId) {
        return {
          ...c,
          submissions: [...(c.submissions || []), newSubmission]
        };
      }
      return c;
    });

    onUpdate({
      ...subject,
      classworks: updatedClassworks
    });
    
    setAnswers({});
  };

  if (selectedClassworkId) {
    const cw = subject.classworks.find(c => c.id === selectedClassworkId);
    if (!cw) {
      setSelectedClassworkId(null);
      return null;
    }

    const mySubmission = cw.submissions?.find(s => s.studentId === currentStudentId);
    const hasQuestions = cw.questions && cw.questions.length > 0;
    const maxScore = hasQuestions ? cw.questions!.reduce((sum, q) => sum + (Number(q.points) || 0), 0) : 0;

    // Convert submission answers back to Record<string, any> for Viewer
    const submissionAnswers = mySubmission?.answers?.reduce((acc, ans) => {
      acc[ans.questionId] = ans.value;
      return acc;
    }, {} as Record<string, any>) || {};

    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="space-y-4"
      >
        <button
          onClick={() => setSelectedClassworkId(null)}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Classwork
        </button>

        <div className="glass-panel rounded-xl p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className={`p-2.5 rounded-lg flex-shrink-0 ${isDarkMode ? 'bg-white/10 text-white' : 'bg-amber-100 text-amber-600'}`}>
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <h2 className="text-lg font-bold text-stone-900 dark:text-white leading-tight">{cw.title}</h2>
                {hasQuestions && <span className="text-sm font-bold text-stone-900 dark:text-white">{maxScore} pts</span>}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-stone-500 dark:text-stone-400 mt-1">
                <Calendar className="w-3 h-3" />
                {new Date(cw.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>
          
          {cw.description && (
            <div className="text-xs text-stone-700 dark:text-stone-300 whitespace-pre-wrap bg-stone-50/50 dark:bg-white/5 p-4 rounded-lg border border-stone-100 dark:border-white/5">
              {cw.description}
            </div>
          )}
        </div>

        {isStudent ? (
          <div className="glass-panel rounded-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                Your Work
                {mySubmission && <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 text-[9px] uppercase tracking-wider">Turned In</span>}
              </h3>
              {mySubmission && mySubmission.totalScore !== undefined && hasQuestions && (
                <div className="text-sm font-bold px-3 py-1 rounded-lg bg-stone-100 dark:bg-white/10">
                  Score: <span className="text-emerald-600 dark:text-emerald-400">{mySubmission.totalScore}</span> / {maxScore}
                </div>
              )}
            </div>
            
            {hasQuestions ? (
              <AssessmentViewer 
                questions={cw.questions!} 
                answers={mySubmission ? submissionAnswers : answers} 
                onChange={handleAnswerChange} 
                readonly={!!mySubmission} 
                isDarkMode={isDarkMode} 
                showGrading={!!mySubmission}
              />
            ) : (
              mySubmission ? (
                <div className="bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-lg p-4">
                  <p className="text-xs text-stone-700 dark:text-stone-300 whitespace-pre-wrap">{submissionAnswers['legacy-text'] || mySubmission.content}</p>
                </div>
              ) : (
                <textarea
                  value={answers['legacy-text'] || ''}
                  onChange={(e) => handleAnswerChange('legacy-text', e.target.value)}
                  placeholder="Type your answer or submission here..."
                  rows={5}
                  className={`w-full px-3 py-2.5 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 transition-all resize-none ${
                    isDarkMode
                      ? 'bg-white/5 border border-white/10 focus:border-transparent text-white placeholder-stone-500 focus:ring-white/20'
                      : 'bg-stone-50 border border-stone-200 focus:border-transparent text-stone-900 placeholder-stone-400 focus:ring-amber-500/50'
                  }`}
                />
              )
            )}

            {!mySubmission && (
              <div className="flex justify-end mt-6 pt-4 border-t border-stone-100 dark:border-white/10">
                <button
                  onClick={() => handleSubmitWork(cw.id)}
                  disabled={!hasQuestions && !answers['legacy-text']}
                  className={`px-5 py-2 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
                    (!hasQuestions && !answers['legacy-text'])
                      ? 'opacity-50 cursor-not-allowed bg-stone-200 text-stone-400 dark:bg-white/5 dark:text-stone-500'
                      : isDarkMode
                        ? 'bg-white text-black hover:bg-stone-200 shadow-[0_0_10px_rgba(255,255,255,0.2)]'
                        : 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  Turn In
                </button>
              </div>
            )}

            {mySubmission && (
              <div className="mt-6 pt-4 border-t border-stone-100 dark:border-white/10 text-[10px] text-stone-500 dark:text-stone-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
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
              <div className="text-[10px] font-medium px-2 py-1 rounded-md bg-stone-100 dark:bg-white/10 text-stone-600 dark:text-stone-300 flex items-center gap-1.5">
                <Users className="w-3 h-3" />
                {cw.submissions?.length || 0} Turned In
              </div>
            </div>

            {(!cw.submissions || cw.submissions.length === 0) ? (
              <div className="text-center py-8 text-xs text-stone-500 dark:text-stone-400 border border-dashed border-stone-200 dark:border-white/10 rounded-lg">
                No submissions yet.
              </div>
            ) : (
              <div className="space-y-4">
                {cw.submissions.map(sub => {
                  const subAnswers = sub.answers?.reduce((acc, ans) => {
                    acc[ans.questionId] = ans.value;
                    return acc;
                  }, {} as Record<string, any>) || {};

                  return (
                    <div key={sub.id} className="bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl p-4">
                      <div className="flex justify-between items-center mb-4 pb-2 border-b border-stone-200 dark:border-white/10">
                        <span className="text-sm font-bold text-stone-900 dark:text-white">{sub.studentName}</span>
                        <div className="flex items-center gap-3">
                          {sub.totalScore !== undefined && hasQuestions && (
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              Score: {sub.totalScore} / {maxScore}
                            </span>
                          )}
                          <span className="text-[10px] font-medium text-stone-500 dark:text-stone-400">
                            {new Date(sub.submittedAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      
                      {hasQuestions ? (
                        <AssessmentViewer 
                          questions={cw.questions!} 
                          answers={subAnswers} 
                          readonly={true} 
                          isDarkMode={isDarkMode} 
                          showGrading={true}
                        />
                      ) : (
                        <p className="text-[11px] text-stone-700 dark:text-stone-300 whitespace-pre-wrap">{subAnswers['legacy-text'] || sub.content}</p>
                      )}
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Classwork</h2>
        {canEdit && (
          <button
            onClick={() => setIsAdding(!isAdding)}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
              isDarkMode
                ? 'bg-white text-black hover:bg-stone-200 shadow-[0_0_10px_rgba(255,255,255,0.2)]'
                : 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            {isAdding ? 'Cancel' : 'Create'}
          </button>
        )}
      </div>

      <AnimatePresence>
        {isAdding && canEdit && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleAdd} className="glass-panel rounded-xl p-4 space-y-4 mb-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold mb-1 uppercase tracking-wider text-stone-500 dark:text-stone-400">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Chapter 1 Reading"
                    className={`w-full px-3 py-2 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 transition-all ${
                      isDarkMode
                        ? 'bg-white/5 border border-white/10 focus:border-transparent text-white placeholder-stone-500 focus:ring-white/20'
                        : 'bg-stone-50 border border-stone-200 focus:border-transparent text-stone-900 placeholder-stone-400 focus:ring-amber-500/50'
                    }`}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold mb-1 uppercase tracking-wider text-stone-500 dark:text-stone-400">Description (Optional)</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Instructions for the classwork..."
                    rows={3}
                    className={`w-full px-3 py-2 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 transition-all resize-none ${
                      isDarkMode
                        ? 'bg-white/5 border border-white/10 focus:border-transparent text-white placeholder-stone-500 focus:ring-white/20'
                        : 'bg-stone-50 border border-stone-200 focus:border-transparent text-stone-900 placeholder-stone-400 focus:ring-amber-500/50'
                    }`}
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-stone-200 dark:border-white/10">
                <AssessmentBuilder questions={questions} onChange={setQuestions} isDarkMode={isDarkMode} />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={!title.trim()}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    !title.trim()
                      ? 'opacity-50 cursor-not-allowed bg-stone-200 text-stone-400 dark:bg-white/5 dark:text-stone-500'
                      : isDarkMode
                        ? 'bg-white text-black hover:bg-stone-200 shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                        : 'bg-amber-500 text-white hover:bg-amber-600 shadow-md'
                  }`}
                >
                  Post Classwork
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2.5">
        {subject.classworks.length === 0 ? (
          <div className="glass-panel rounded-xl p-8 text-center flex flex-col items-center justify-center">
            <div className={`p-3 rounded-full mb-3 ${isDarkMode ? 'bg-white/5 text-stone-400' : 'bg-stone-100 text-stone-500'}`}>
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold mb-1">No Classwork Yet</h3>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 max-w-xs">
              {canEdit ? 'Click "Create" to assign materials to your students.' : 'Your teacher hasn\'t posted any classwork yet.'}
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {subject.classworks.map((cw) => {
              const mySubmission = isStudent ? cw.submissions?.find(s => s.studentId === currentStudentId) : null;
              const submissionCount = cw.submissions?.length || 0;
              const hasQuestions = cw.questions && cw.questions.length > 0;
              const maxScore = hasQuestions ? cw.questions!.reduce((sum, q) => sum + (Number(q.points) || 0), 0) : 0;

              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={cw.id}
                  onClick={() => setSelectedClassworkId(cw.id)}
                  className="glass-panel rounded-xl p-3 md:p-4 group relative cursor-pointer hover:bg-stone-50/50 dark:hover:bg-white/[0.02] transition-colors border border-transparent hover:border-stone-200 dark:hover:border-white/10"
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg flex-shrink-0 ${isDarkMode ? 'bg-white/10 text-white' : 'bg-amber-100 text-amber-600'}`}>
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                        <h3 className="text-sm font-bold truncate pr-8 text-stone-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">{cw.title}</h3>
                        <div className="flex items-center gap-2">
                          {isStudent && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                              mySubmission 
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' 
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                            }`}>
                              {mySubmission ? 'Turned In' : 'Assigned'}
                            </span>
                          )}
                          {!isStudent && submissionCount > 0 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
                              {submissionCount} Turned In
                            </span>
                          )}
                          {hasQuestions && (
                            <span className="text-[10px] font-bold text-stone-900 dark:text-white bg-stone-100 dark:bg-white/10 px-1.5 py-0.5 rounded">
                              {maxScore} pts
                            </span>
                          )}
                          <div className="flex items-center gap-1 text-[9px] font-medium text-stone-500 dark:text-stone-400 whitespace-nowrap">
                            <Calendar className="w-3 h-3" />
                            {new Date(cw.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                      </div>
                      {cw.description && (
                        <p className="text-[11px] text-stone-600 dark:text-stone-300 line-clamp-1">
                          {cw.description}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {canEdit && (
                    <button
                      onClick={(e) => handleDelete(cw.id, e)}
                      className="absolute top-3 right-3 p-1.5 opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-500 transition-all rounded-md hover:bg-red-50 dark:hover:bg-red-500/10"
                      title="Delete Classwork"
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
