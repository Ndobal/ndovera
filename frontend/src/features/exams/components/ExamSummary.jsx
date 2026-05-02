import React from 'react';

export default function ExamSummary({ result, onRestart }) {
  if (!result) return null;
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Exam Completed</h2>
      <p className="text-lg">Score: {result.score} / {result.total}</p>
      <button onClick={onRestart} className="px-4 py-2 rounded-lg bg-indigo-500/30 text-indigo-100">
        Back to list
      </button>
    </div>
  );
}