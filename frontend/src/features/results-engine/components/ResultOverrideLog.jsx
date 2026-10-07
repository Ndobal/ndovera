import React, { useEffect, useState } from 'react';
import { getTeacherResultAudit } from '../service/resultEngineService';
import { RESULT_BODY, RESULT_HEADING, RESULT_LABEL, RESULT_SURFACE, RESULT_TABLE_HEAD, RESULT_TABLE_ROW } from './resultSheetTheme';

const ROLE_LABELS = { hos: 'HoS', owner: 'Owner', ict: 'ICT', ict_manager: 'ICT', teacher: 'Class teacher', classteacher: 'Class teacher' };

function describeScores(scores) {
  if (!scores) return 'No score';
  return `CA ${scores.caScore ?? 0} · Exam ${scores.examScore ?? 0}`;
}

/** Every override on this sheet: who changed whose score, from what to what, and why. */
export default function ResultOverrideLog({ sheet, refreshKey = 0 }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const classId = sheet?.classId;
  const mode = sheet?.mode;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getTeacherResultAudit(sheet)
      .then(next => { if (!cancelled) setLogs(next); })
      .catch(loadError => { if (!cancelled) setError(loadError.message || 'Unable to load the override log.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, mode, refreshKey]);

  return (
    <section className={`${RESULT_SURFACE} p-6 space-y-4`}>
      <div>
        <p className={`micro-label ${RESULT_LABEL}`}>Override log</p>
        <p className={`mt-1 text-sm ${RESULT_BODY}`}>
          When a class teacher changes a subject teacher&apos;s scores, or the HoS/owner changes anyone&apos;s, it is recorded here. An overridden score can only be changed again by someone of the same or higher standing.
        </p>
      </div>
      {loading && <p className={`text-sm ${RESULT_BODY}`}>Loading…</p>}
      {error && <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p>}
      {!loading && !error && logs.length === 0 && <p className={`text-sm ${RESULT_BODY}`}>No overrides on this sheet.</p>}
      {!loading && logs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className={RESULT_TABLE_HEAD}>
              <tr className="text-left">
                <th className="micro-label py-3 px-3">When</th>
                <th className="micro-label py-3 px-3">Changed by</th>
                <th className="micro-label py-3 px-3">Student</th>
                <th className="micro-label py-3 px-3">Subject</th>
                <th className="micro-label py-3 px-3">Before</th>
                <th className="micro-label py-3 px-3">After</th>
                <th className="micro-label py-3 px-3">Reason</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className={RESULT_TABLE_ROW}>
                  <td className={`py-3 px-3 whitespace-nowrap ${RESULT_BODY}`}>{log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}</td>
                  <td className={`py-3 px-3 font-semibold ${RESULT_HEADING}`}>{log.actorName || 'Staff'} <span className={`block text-xs font-normal ${RESULT_BODY}`}>{ROLE_LABELS[log.actorRole] || log.actorRole}</span></td>
                  <td className={`py-3 px-3 ${RESULT_BODY}`}>{log.studentName}</td>
                  <td className={`py-3 px-3 ${RESULT_BODY}`}>{log.subjectName}</td>
                  <td className={`py-3 px-3 font-mono ${RESULT_BODY}`}>{describeScores(log.before)}</td>
                  <td className={`py-3 px-3 font-mono font-semibold ${RESULT_HEADING}`}>{describeScores(log.after)}</td>
                  <td className={`py-3 px-3 ${RESULT_BODY}`}>{log.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
