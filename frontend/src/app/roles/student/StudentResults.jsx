import React from 'react';
import StudentSectionShell from './StudentSectionShell';
import { getStudentResult } from '../../../features/results-engine';

export default function StudentResults() {
  const result = getStudentResult('stu-001');

  return (
    <StudentSectionShell title="Results" subtitle="See your scores and track your progress.">
      <div className="space-y-4">
        {!result.published && (
          <section className="glass-surface rounded-3xl p-6">
            <p className="text-slate-200">Results are not yet released. Your teachers are finalizing CA score sheet entries.</p>
            <p className="micro-label mt-3 accent-amber">State: Draft</p>
          </section>
        )}

        {result.published && !result.hosApproved && (
          <section className="glass-surface rounded-3xl p-6">
            <p className="text-slate-200">Results are published by teachers and awaiting HoS approval.</p>
            <p className="micro-label mt-3 accent-amber">State: Pending HoS Approval</p>
          </section>
        )}

        {result.visibleToStudent && result.lockedByFees && (
          <section className="glass-surface rounded-3xl p-6">
            <p className="text-slate-200">Result locked due to pending school fee clearance.</p>
            <p className="micro-label mt-3 accent-rose">State: Locked</p>
          </section>
        )}

        {result.visibleToStudent && !result.lockedByFees && (
          <>
            <section className="glass-surface rounded-3xl p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><p className="micro-label accent-indigo">Student</p><p className="text-slate-100 font-semibold mt-1">{result.student.name}</p></div>
              <div><p className="micro-label accent-emerald">Average</p><p className="text-slate-100 font-semibold mt-1">{result.average}%</p></div>
              <div><p className="micro-label accent-amber">Attendance Weight</p><p className="text-slate-100 font-semibold mt-1">{result.attendanceRate}%</p></div>
            </section>

            <div className="glass-surface rounded-3xl p-6 overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-left">
                    <th className="micro-label py-2 pr-4">Subject</th>
                    <th className="micro-label py-2 pr-4">CA</th>
                    <th className="micro-label py-2 pr-4">Exam</th>
                    <th className="micro-label py-2 pr-4">Raw</th>
                    <th className="micro-label py-2 pr-4">Weighted</th>
                    <th className="micro-label py-2">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map(row => (
                    <tr key={row.subject} className="border-t border-white/10">
                      <td className="py-3 pr-4 text-slate-100">{row.subject}</td>
                      <td className="py-3 pr-4 mono-metric">{row.ca}</td>
                      <td className="py-3 pr-4 mono-metric">{row.exam}</td>
                      <td className="py-3 pr-4 mono-metric">{row.rawTotal}</td>
                      <td className="py-3 pr-4 mono-metric">{row.total}</td>
                      <td className="py-3 command-title accent-emerald">{row.grade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </StudentSectionShell>
  );
}
