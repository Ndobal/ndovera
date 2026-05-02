import React from 'react';

export default function ExamSession({ questions, answers, onAnswerChange }) {
  return (
    <div className="space-y-6">
      {questions.map(q => (
        <div key={q.id} className="rounded-xl border border-white/10 p-4 bg-slate-900/20">
          <p className="text-slate-100 font-medium mb-2">{q.text}</p>
          {q.choices && q.choices.map(c => (
            <label key={c} className="flex items-center gap-2">
              <input
                type="radio"
                name={q.id}
                value={c}
                checked={answers[q.id] === c}
                onChange={() => onAnswerChange(q.id, c)}
              />
              <span className="text-slate-200">{c}</span>
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}