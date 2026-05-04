import React, { useMemo, useState } from 'react';
import { assignmentData } from '../data/classroomData';
import { createTextDownload } from '../shared/classroomHelpers';

export default function AssignmentsTab() {
  const [assignmentTab, setAssignmentTab] = useState('normal');
  const [quizAnswers, setQuizAnswers] = useState({});
  const [matchingAnswers, setMatchingAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [matchingSubmitted, setMatchingSubmitted] = useState(false);
  const [retakeEnabled, setRetakeEnabled] = useState(true);

  const randomizedQuizQuestions = useMemo(() => {
    const source = [...assignmentData.quiz.questions];
    return source.map(question => {
      if (question.type !== 'mcq') return question;
      const options = [...question.options];
      for (let index = options.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [options[index], options[randomIndex]] = [options[randomIndex], options[index]];
      }
      return { ...question, options };
    });
  }, []);

  const quizScore = useMemo(() => {
    const totalMcq = assignmentData.quiz.questions.filter(question => question.type === 'mcq').length;
    const correct = assignmentData.quiz.questions.filter(question => question.type === 'mcq' && quizAnswers[question.id] === question.answer).length;
    return { correct, totalMcq, percent: totalMcq ? Math.round((correct / totalMcq) * 100) : 0 };
  }, [quizAnswers]);

  const matchingScore = useMemo(() => {
    const total = assignmentData.matching.pairs.length;
    const correct = assignmentData.matching.pairs.filter(pair => matchingAnswers[pair.left] === pair.right).length;
    return { total, correct, percent: total ? Math.round((correct / total) * 100) : 0 };
  }, [matchingAnswers]);

  const exportAssignmentAnalytics = () => {
    const csv = [
      ['Metric', 'Value'],
      ['Quiz Auto-Graded Score', `${quizScore.percent}%`],
      ['Matching Score', `${matchingScore.percent}%`],
      ['Late Penalty Rule', assignmentData.policy.latePenalty],
      ['Retake Enabled', retakeEnabled ? 'Yes' : 'No'],
    ];
    const content = csv.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    createTextDownload('assignment-analytics.csv', content);
  };

  const hasAssignments = assignmentData.normal.length > 0 || assignmentData.quiz.questions.length > 0 || assignmentData.matching.pairs.length > 0;

  if (!hasAssignments) {
    return (
      <section className="glass-surface rounded-3xl p-5 text-center">
        <p className="micro-label accent-amber">No live assignments</p>
        <p className="mt-2 text-slate-300">Assignments will appear here when teachers publish real classwork and assessments.</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="glass-surface rounded-3xl p-5 space-y-3">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'normal', label: 'Normal Assignment' },
            { id: 'quiz', label: 'Quiz Assignment' },
            { id: 'matching', label: 'Matching Assignment' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setAssignmentTab(tab.id)} className={assignmentTab === tab.id ? 'px-4 py-2 rounded-2xl bg-indigo-500/30 border border-indigo-300/40 text-white' : 'px-4 py-2 rounded-2xl bg-slate-900/30 border border-white/10 text-slate-200'}>{tab.label}</button>
          ))}
        </div>

        {assignmentTab === 'normal' && (
          <div className="space-y-3">
            {assignmentData.normal.map(item => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-900/30 p-4 space-y-2">
                <p className="text-slate-100 font-semibold">{item.title}</p>
                <p className="neon-subtle text-sm">Due: {item.due}</p>
                <p className="micro-label accent-indigo">Rubric: {item.rubric}</p>
                <div className="flex flex-wrap gap-2">
                  <button className="px-3 py-1 rounded-xl border border-white/10 bg-slate-900/40 text-sm text-slate-100">Attach File</button>
                  <button className="px-3 py-1 rounded-xl border border-white/10 bg-slate-900/40 text-sm text-slate-100">Write Response</button>
                  <button className="px-3 py-1 rounded-xl border border-emerald-300/30 bg-emerald-500/20 text-sm text-emerald-100">Submit</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {assignmentTab === 'quiz' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-slate-900/30 p-4">
              <p className="text-slate-100 font-semibold">{assignmentData.quiz.title}</p>
              <p className="neon-subtle text-sm">Time Limit: {assignmentData.quiz.durationMins} mins • Auto-grade for MCQ • Essay manual grading</p>
              <p className="micro-label mt-1 accent-amber">Anti-cheat shuffle enabled</p>
            </div>

            {randomizedQuizQuestions.map(question => (
              <div key={question.id} className="rounded-2xl border border-white/10 bg-slate-900/30 p-4 space-y-2">
                <p className="text-slate-100 font-semibold">{question.text}</p>
                {question.type === 'mcq' && (
                  <div className="space-y-2">
                    {question.options.map(option => (
                      <label key={option} className="flex items-center gap-2 text-sm text-slate-200">
                        <input type="radio" name={question.id} checked={quizAnswers[question.id] === option} onChange={() => setQuizAnswers(prev => ({ ...prev, [question.id]: option }))} />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                )}
                {question.type === 'short' && <input value={quizAnswers[question.id] || ''} onChange={event => setQuizAnswers(prev => ({ ...prev, [question.id]: event.target.value }))} className="w-full rounded-xl bg-slate-900/40 border border-white/10 px-3 py-2 text-sm text-slate-100" placeholder="Type short answer" />}
                {question.type === 'essay' && <textarea value={quizAnswers[question.id] || ''} onChange={event => setQuizAnswers(prev => ({ ...prev, [question.id]: event.target.value }))} className="w-full min-h-[80px] rounded-xl bg-slate-900/40 border border-white/10 px-3 py-2 text-sm text-slate-100" placeholder="Type essay response" />}
              </div>
            ))}

            <button onClick={() => setQuizSubmitted(true)} className="px-4 py-2 rounded-xl bg-emerald-500/30 border border-emerald-300/40 text-white font-semibold">Submit Quiz</button>
            {quizSubmitted && <div className="rounded-2xl border border-white/10 bg-slate-900/30 p-4 space-y-1"><p className="text-slate-100">Auto-Graded MCQ Score: {quizScore.correct}/{quizScore.totalMcq} ({quizScore.percent}%)</p><p className="micro-label accent-indigo">Essay responses pending teacher review</p></div>}
          </div>
        )}

        {assignmentTab === 'matching' && (
          <div className="space-y-3">
            <p className="text-slate-200">Match each item from Column A to Column B. Auto-graded on submit.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-slate-900/30 p-4 space-y-2"><p className="micro-label accent-indigo">Column A</p>{assignmentData.matching.pairs.map(pair => <p key={pair.left} className="text-slate-100">{pair.left}</p>)}</div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/30 p-4 space-y-2">
                <p className="micro-label accent-amber">Column B</p>
                {assignmentData.matching.pairs.map(pair => (
                  <div key={pair.left} className="space-y-1">
                    <p className="text-xs text-slate-300">{pair.left}</p>
                    <select value={matchingAnswers[pair.left] || ''} onChange={event => setMatchingAnswers(prev => ({ ...prev, [pair.left]: event.target.value }))} className="w-full rounded-xl bg-slate-900/40 border border-white/10 px-3 py-2 text-sm text-slate-100">
                      <option value="">Select answer</option>
                      {assignmentData.matching.pairs.map(option => <option key={option.right} value={option.right}>{option.right}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => setMatchingSubmitted(true)} className="px-4 py-2 rounded-xl bg-emerald-500/30 border border-emerald-300/40 text-white">Submit Matching</button>
            {matchingSubmitted && <p className="micro-label accent-emerald">Matching Score: {matchingScore.correct}/{matchingScore.total} ({matchingScore.percent}%)</p>}
          </div>
        )}
      </section>

      <section className="glass-surface rounded-3xl p-5 space-y-3">
        <h3 className="text-xl command-title neon-title">Advanced Assignment Features</h3>
        <div className="rounded-2xl border border-white/10 bg-slate-900/30 p-4 space-y-2">
          <p className="text-sm text-slate-200">Late Penalty Rule: {assignmentData.policy.latePenalty}</p>
          <p className="text-sm text-slate-200">Retake Policy: {assignmentData.policy.retake}</p>
          <p className="text-sm text-slate-200">Integrity Control: {assignmentData.policy.antiCheat}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setRetakeEnabled(prev => !prev)} className="px-3 py-1 rounded-xl border border-white/10 bg-slate-900/40 text-sm text-slate-100">Retake: {retakeEnabled ? 'Enabled' : 'Disabled'}</button>
            <button onClick={exportAssignmentAnalytics} className="px-3 py-1 rounded-xl border border-indigo-300/40 bg-indigo-500/20 text-sm text-indigo-100">Export Results</button>
          </div>
        </div>
      </section>
    </div>
  );
}
