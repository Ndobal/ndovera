import React from 'react';
import {
  RESULT_BODY,
  RESULT_HEADING,
  RESULT_LABEL,
  RESULT_SURFACE,
  RESULT_TABLE_HEAD,
  RESULT_TABLE_ROW,
} from './resultSheetTheme';

export default function BroadsheetTable({ rows = [], title = 'Broadsheet Ranking' }) {
  return (
    <section className={`${RESULT_SURFACE} p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <p className={`micro-label ${RESULT_LABEL}`}>Ranking Preview</p>
          <h2 className={`text-xl command-title mt-2 ${RESULT_HEADING}`}>{title}</h2>
        </div>
        <p className={`max-w-xl text-sm ${RESULT_BODY}`}>Broadsheet ranking reflects the current live sheet preview and updates immediately as CA or exam totals change.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead className={RESULT_TABLE_HEAD}>
            <tr className="text-left">
              <th className="micro-label py-3 px-3">Rank</th>
              <th className="micro-label py-3 px-3">Student</th>
              <th className="micro-label py-3 px-3">Class</th>
              <th className="micro-label py-3 px-3">Attendance</th>
              <th className="micro-label py-3 px-3">Average</th>
              <th className="micro-label py-3 px-3">Grade</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.studentId} className={RESULT_TABLE_ROW}>
                <td className={`py-3 px-3 font-semibold ${RESULT_HEADING}`}>#{row.rank}</td>
                <td className={`py-3 px-3 font-semibold ${RESULT_HEADING}`}>{row.studentName}</td>
                <td className={`py-3 px-3 ${RESULT_BODY}`}>{row.className}</td>
                <td className={`py-3 px-3 ${RESULT_BODY}`}>{row.attendance}%</td>
                <td className={`py-3 px-3 font-semibold ${RESULT_BODY}`}>{row.average}%</td>
                <td className={`py-3 px-3 font-black ${RESULT_HEADING}`}>{row.grade}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr className={RESULT_TABLE_ROW}>
                <td colSpan={6} className={`py-6 px-3 text-center ${RESULT_BODY}`}>
                  Broadsheet rows will appear here once the live CA sheet has student entries.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
