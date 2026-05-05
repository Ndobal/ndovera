import React from 'react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function HoSTimetable() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">Timetable</h1>
        <p className="text-[#191970] dark:text-slate-300 mt-1 text-sm">
          Timetable syncs from classroom assignments. No timetable data yet.
        </p>
      </div>

      <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        <p className="text-[#800020] dark:text-slate-400 text-sm mb-4">
          ℹ️ The timetable below will be populated automatically once classroom assignments and teacher schedules are created in the system.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="py-2 px-3 text-left text-[#800020] dark:text-slate-400 font-semibold border-b border-[#c9a96e]/40 dark:border-white/10">Period</th>
                {DAYS.map((d) => (
                  <th key={d} className="py-2 px-3 text-left text-[#800020] dark:text-slate-400 font-semibold border-b border-[#c9a96e]/40 dark:border-white/10">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map((p) => (
                <tr key={p} className="border-b border-[#c9a96e]/20 dark:border-white/5">
                  <td className="py-3 px-3 text-[#800020] dark:text-slate-400 font-semibold">Period {p}</td>
                  {DAYS.map((d) => (
                    <td key={d} className="py-3 px-3 text-[#191970]/40 dark:text-slate-600 text-xs italic">
                      —
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
