import React from 'react';

function normalizeQuestionType(value) {
  return String(value || 'mcq').trim().toLowerCase();
}

function updateCrossMatchAnswer(currentAnswer, leftItem, rightItem) {
  const next = Array.isArray(currentAnswer) ? currentAnswer.filter(pair => pair.left !== leftItem) : [];
  if (rightItem) {
    next.push({ left: leftItem, right: rightItem });
  }
  return next;
}

function isAnswerEmpty(question, answer) {
  const type = normalizeQuestionType(question.type);
  if (type === 'crossmatching') return !Array.isArray(answer) || answer.length === 0;
  return answer === undefined || answer === null || String(answer).trim() === '';
}

export default function ExamSession({ questions, answers, onAnswerChange }) {
  return (
    <div className="space-y-6">
      {questions.map(q => (
        <div key={q.id} className="rounded-xl border border-white/10 p-4 bg-slate-900/20">
          {q.passage && <p className="text-sm text-slate-300 whitespace-pre-wrap mb-3">{q.passage}</p>}
          <p className="text-slate-100 font-medium mb-2">{q.text || q.prompt}</p>
          {q.imageUrl && (
            <img src={q.imageUrl} alt="Question" className="mb-3 max-h-56 rounded-xl border border-white/10 object-contain" />
          )}

          {['mcq', 'truefalse'].includes(normalizeQuestionType(q.type)) && (Array.isArray(q.options) ? q.options : q.choices || []).map(option => (
            <label key={option} className="flex items-center gap-2 py-1">
              <input
                type="radio"
                name={q.id}
                value={option}
                checked={String(answers[q.id] || '') === String(option)}
                onChange={() => onAnswerChange(q.id, option)}
              />
              <span className="text-slate-200">{option}</span>
            </label>
          ))}

          {['shortanswer', 'fillgaps', 'essay', 'comprehension', 'longanswer', 'picture'].includes(normalizeQuestionType(q.type)) && (
            <textarea
              value={String(answers[q.id] || '')}
              onChange={event => onAnswerChange(q.id, event.target.value)}
              rows={normalizeQuestionType(q.type) === 'essay' || normalizeQuestionType(q.type) === 'longanswer' || normalizeQuestionType(q.type) === 'comprehension' ? 6 : 3}
              placeholder={normalizeQuestionType(q.type) === 'fillgaps' ? 'Enter your answers in order, separated by commas.' : 'Type your answer here.'}
              className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-slate-100"
            />
          )}

          {normalizeQuestionType(q.type) === 'crossmatching' && (
            <div className="space-y-3">
              {(q.left || []).map(leftItem => {
                const selectedAnswer = (Array.isArray(answers[q.id]) ? answers[q.id] : []).find(pair => pair.left === leftItem)?.right || '';
                return (
                  <label key={leftItem} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-slate-200">{leftItem}</span>
                    <select
                      value={selectedAnswer}
                      onChange={event => onAnswerChange(q.id, updateCrossMatchAnswer(answers[q.id], leftItem, event.target.value))}
                      className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-slate-100"
                    >
                      <option value="">Select match</option>
                      {(q.right || []).map(rightItem => (
                        <option key={rightItem} value={rightItem}>{rightItem}</option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
          )}

          {isAnswerEmpty(q, answers[q.id]) && (
            <p className="mt-3 text-xs text-slate-500">Answer this question before submitting the full exam.</p>
          )}
        </div>
      ))}
    </div>
  );
}