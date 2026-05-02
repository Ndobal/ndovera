import React from 'react';

export default function ExamList({ exams, onStart }) {
  if (!exams.length) {
    return <p className="text-center text-slate-400">No exams available</p>;
  }

  return (
    <div className="space-y-4">
      {exams.map(e => (
        <div key={e.id} className="rounded-xl border border-white/10 p-4 bg-slate-900/20 flex items-center justify-between">
          <div>
            <p className="text-slate-100 font-semibold">{e.title}</p>
            <p className="text-sm text-slate-400">{e.window}</p>
          </div>
          <button
            onClick={() => onStart(e.id)}
            className="px-4 py-2 rounded-lg bg-indigo-500/30 text-indigo-100"
          >
            Start
          </button>
        </div>
      ))}
    </div>
  );
}