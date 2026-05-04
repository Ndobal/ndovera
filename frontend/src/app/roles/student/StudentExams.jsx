import React, { useEffect } from 'react';
import StudentSectionShell from './StudentSectionShell';
import ErrorPanel from '../../../shared/components/ErrorPanel';
import { useExamEngine } from '../../../features/exams/hooks/useExamEngine';
import ExamList from '../../../features/exams/components/ExamList';
import ExamSession from '../../../features/exams/components/ExamSession';
import ExamSummary from '../../../features/exams/components/ExamSummary';

export default function StudentExams() {
  const userId = localStorage.getItem('userId') || '';
  const {
    examList,
    currentExam,
    questions,
    answers,
    result,
    loading,
    error,
    loadExams,
    beginExam,
    recordAnswer,
    submit,
    reset,
  } = useExamEngine(userId);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  return (
    <StudentSectionShell title="Exams" subtitle="Your exam area is secure and time-based.">
      {loading && <p className="text-slate-400">Loading...</p>}
      {error && (
        <ErrorPanel title="Exam Error" message={error.message} onClose={() => { /* let hook clear error if needed */ }} />
      )}

      {!currentExam && !result && (
        <ExamList exams={examList} onStart={beginExam} />
      )}

      {currentExam && !result && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">{currentExam.title}</h2>
          <ExamSession questions={questions} answers={answers} onAnswerChange={recordAnswer} />
          <button
            onClick={submit}
            className="px-4 py-2 rounded-lg bg-indigo-500/30 text-indigo-100"
          >
            Submit Exam
          </button>
        </div>
      )}

      {result && <ExamSummary result={result} onRestart={reset} />}
    </StudentSectionShell>
  );
}
