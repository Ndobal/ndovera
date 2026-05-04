import React, { useMemo, useState } from 'react';
import {
  getBroadsheetRanking,
  getTeacherScoreSheet,
  publishResults,
  unpublishResults,
  upsertAttendance,
  upsertCAScore,
} from '../service/resultEngineService';
import BroadsheetTable from './BroadsheetTable';

export default function TeacherCAScoreSheet() {
  const initialSheet = getTeacherScoreSheet() || { rows: [], students: [], attendanceByStudent: {}, term: '' };
  const initialBroadsheet = getBroadsheetRanking() || { rows: [], term: '' };

  const [sheet, setSheet] = useState(initialSheet);
  const [broadsheet, setBroadsheet] = useState(initialBroadsheet);

  const groupedRows = useMemo(() => {
    const map = new Map();
    const rows = (sheet && Array.isArray(sheet.rows)) ? sheet.rows : [];
    rows.forEach(row => {
      if (!map.has(row.studentId)) map.set(row.studentId, []);
      map.get(row.studentId).push(row);
    });
    return map;
  }, [sheet]);

  const handleScoreChange = (studentId, subject, field, value) => {
    const current = sheet.rows.find(row => row.studentId === studentId && row.subject === subject);
    const nextCA = field === 'ca' ? value : (current?.ca ?? 0);
    const nextExam = field === 'exam' ? value : (current?.exam ?? 0);
    setSheet(upsertCAScore({ studentId, subject, ca: nextCA, exam: nextExam }));
    setBroadsheet(getBroadsheetRanking());
  };

  const handleAttendanceChange = (studentId, value) => {
    setSheet(upsertAttendance({ studentId, attendanceRate: value }));
    setBroadsheet(getBroadsheetRanking());
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <section className="glass-surface rounded-3xl p-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="micro-label neon-subtle">Teacher Dashboard</p>
          <h1 className="text-3xl command-title neon-title">CA Score Sheet</h1>
          <p className="text-slate-300 mt-1">Single Source of Truth for result computation • {sheet.term}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setSheet(unpublishResults());
              setBroadsheet(getBroadsheetRanking());
            }}
            className="px-4 py-2 rounded-2xl border border-amber-300/30 bg-amber-500/20 text-amber-100 text-sm"
          >
            Set Draft
          </button>
          <button
            onClick={() => {
              setSheet(publishResults());
              setBroadsheet(getBroadsheetRanking());
            }}
            className="px-4 py-2 rounded-2xl border border-emerald-300/30 bg-emerald-500/20 text-emerald-100 text-sm"
          >
            Publish Results
          </button>
        </div>
      </section>

      <section className="glass-surface rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <p className="micro-label accent-indigo">Result State: {sheet.published ? 'Published' : 'Draft'}</p>
          <div className="text-right">
            {sheet.publishedAt && <p className="text-xs text-slate-300">Published: {new Date(sheet.publishedAt).toLocaleString()}</p>}
            <p className="text-xs text-slate-300 mt-1">
              HoS Approval: {sheet.hosApproved
                ? `Approved${sheet.hosApprovedAt ? ` • ${new Date(sheet.hosApprovedAt).toLocaleString()}` : ''}`
                : 'Pending'}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {sheet.students.map(student => (
            <div key={student.id} className="rounded-2xl border border-white/10 p-4 bg-slate-900/30 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-slate-100 font-semibold">{student.name} • {student.className}</p>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-300">Attendance %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={sheet.attendanceByStudent[student.id] ?? 0}
                    onChange={event => handleAttendanceChange(student.id, event.target.value)}
                    className="w-20 rounded-xl bg-slate-900/50 border border-white/10 px-2 py-1 text-slate-100"
                  />
                  <span className={`glass-chip px-3 py-1 rounded-full micro-label ${student.feeCleared ? 'accent-emerald' : 'accent-rose'}`}>
                    {student.feeCleared ? 'Fee Cleared' : 'Fee Pending'}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="text-left">
                      <th className="micro-label py-2 pr-4">Subject</th>
                      <th className="micro-label py-2 pr-4">CA (40)</th>
                      <th className="micro-label py-2 pr-4">Exam (60)</th>
                      <th className="micro-label py-2 pr-4">Raw Total</th>
                      <th className="micro-label py-2 pr-4">Weighted</th>
                      <th className="micro-label py-2">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(groupedRows.get(student.id) || []).map(row => (
                      <tr key={`${row.studentId}-${row.subject}`} className="border-t border-white/10">
                        <td className="py-2 pr-4 text-slate-100">{row.subject}</td>
                        <td className="py-2 pr-4">
                          <input
                            type="number"
                            min={0}
                            max={40}
                            value={row.ca}
                            onChange={event => handleScoreChange(student.id, row.subject, 'ca', event.target.value)}
                            className="w-20 rounded-xl bg-slate-900/50 border border-white/10 px-2 py-1 text-slate-100"
                          />
                        </td>
                        <td className="py-2 pr-4">
                          <input
                            type="number"
                            min={0}
                            max={60}
                            value={row.exam}
                            onChange={event => handleScoreChange(student.id, row.subject, 'exam', event.target.value)}
                            className="w-20 rounded-xl bg-slate-900/50 border border-white/10 px-2 py-1 text-slate-100"
                          />
                        </td>
                        <td className="py-2 pr-4 mono-metric text-slate-100">{row.rawTotal}</td>
                        <td className="py-2 pr-4 mono-metric text-slate-100">{row.total}</td>
                        <td className="py-2 command-title accent-emerald">{row.grade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {sheet.students.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center bg-slate-900/20">
              <p className="micro-label accent-amber">No live result sheet</p>
              <p className="mt-2 text-sm text-slate-300">Student score rows will appear here after a real class roster and assessments are synced.</p>
            </div>
          )}
        </div>
      </section>

      <BroadsheetTable rows={broadsheet.rows} title="Broadsheet Ranking (Live Preview)" />
    </div>
  );
}
