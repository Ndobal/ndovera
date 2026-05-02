import React, { useMemo, useState } from 'react';
import { getResultEngineState, getParentResult } from '../service/resultEngineService';

export default function ParentResultView() {
  const [state] = useState(getResultEngineState());
  const [activeChildId, setActiveChildId] = useState(state.students[0]?.id || 'stu-001');

  const result = useMemo(() => getParentResult(activeChildId), [activeChildId]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <section className="glass-surface rounded-3xl p-6">
        <p className="micro-label neon-subtle">Parent Dashboard</p>
        <h1 className="text-3xl command-title neon-title">Results</h1>
        <p className="text-slate-300 mt-1">Official records from CA Score Sheet • {result.term}</p>
      </section>

      <section className="glass-surface rounded-3xl p-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          {state.students.map(student => (
            <button
              key={student.id}
              onClick={() => setActiveChildId(student.id)}
              className={activeChildId === student.id
                ? 'px-4 py-2 rounded-2xl bg-indigo-500/30 border border-indigo-300/40 text-white'
                : 'px-4 py-2 rounded-2xl bg-slate-900/30 border border-white/10 text-slate-200'}
            >
              {student.name}
            </button>
          ))}
        </div>

        {!result.published && (
          <div className="rounded-2xl border border-amber-300/30 bg-amber-500/20 p-4 text-amber-100 text-sm">
            Results are not released yet. Teachers are still finalizing CA sheet entries.
          </div>
        )}

        {result.published && !result.hosApproved && (
          <div className="rounded-2xl border border-amber-300/30 bg-amber-500/20 p-4 text-amber-100 text-sm">
            Results are awaiting HoS approval and are not visible to parents yet.
          </div>
        )}

        {result.visibleToStudent && result.lockedByFees && (
          <div className="rounded-2xl border border-rose-300/30 bg-rose-500/20 p-4 text-rose-100 text-sm">
            Result locked: school fees not cleared for this child.
          </div>
        )}

        {result.visibleToStudent && !result.lockedByFees && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="glass-chip rounded-2xl p-4"><p className="micro-label accent-indigo">Child</p><p className="text-slate-100 font-semibold mt-1">{result.student.name}</p></div>
              <div className="glass-chip rounded-2xl p-4"><p className="micro-label accent-emerald">Average</p><p className="text-slate-100 font-semibold mt-1">{result.average}%</p></div>
              <div className="glass-chip rounded-2xl p-4"><p className="micro-label accent-amber">Published</p><p className="text-slate-100 font-semibold mt-1">{new Date(result.publishedAt).toLocaleString()}</p></div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-left">
                    <th className="micro-label py-2 pr-4">Subject</th>
                    <th className="micro-label py-2 pr-4">CA</th>
                    <th className="micro-label py-2 pr-4">Exam</th>
                    <th className="micro-label py-2 pr-4">Total</th>
                    <th className="micro-label py-2">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map(row => (
                    <tr key={row.subject} className="border-t border-white/10">
                      <td className="py-2 pr-4 text-slate-100">{row.subject}</td>
                      <td className="py-2 pr-4 mono-metric text-slate-100">{row.ca}</td>
                      <td className="py-2 pr-4 mono-metric text-slate-100">{row.exam}</td>
                      <td className="py-2 pr-4 mono-metric text-slate-100">{row.total}</td>
                      <td className="py-2 command-title accent-emerald">{row.grade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
