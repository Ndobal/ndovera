import React from 'react';

export default function BroadsheetTable({ rows = [], title = 'Broadsheet Ranking' }) {
  return (
    <section className="glass-surface rounded-3xl p-6">
      <h2 className="text-xl command-title neon-title mb-4">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead>
            <tr className="text-left">
              <th className="micro-label py-2 pr-4">Rank</th>
              <th className="micro-label py-2 pr-4">Student</th>
              <th className="micro-label py-2 pr-4">Class</th>
              <th className="micro-label py-2 pr-4">Attendance</th>
              <th className="micro-label py-2 pr-4">Average</th>
              <th className="micro-label py-2">Grade</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.studentId} className="border-t border-white/10">
                <td className="py-2 pr-4 text-slate-100">#{row.rank}</td>
                <td className="py-2 pr-4 text-slate-100 font-semibold">{row.studentName}</td>
                <td className="py-2 pr-4 text-slate-300">{row.className}</td>
                <td className="py-2 pr-4 mono-metric text-slate-100">{row.attendance}%</td>
                <td className="py-2 pr-4 mono-metric text-slate-100">{row.average}%</td>
                <td className="py-2 command-title accent-emerald">{row.grade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
