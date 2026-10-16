import React, { useEffect, useState } from 'react';
import { getTeacherResultPreview } from '../service/resultEngineService';
import ResultRecordViewer from './ResultRecordViewer';
import { RESULT_BODY, RESULT_INPUT, RESULT_LABEL, RESULT_SECONDARY_BUTTON, RESULT_SURFACE } from './resultSheetTheme';

/**
 * Shows staff each student's result exactly as the student will see it once
 * published: same engine, same sheet design, built from the saved score sheet.
 */
export default function ResultPreviewPanel({ sheet, refreshKey = 0, initialStudentId = '' }) {
  const [preview, setPreview] = useState(null);
  const [studentId, setStudentId] = useState(initialStudentId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const classId = sheet?.classId;
  const mode = sheet?.mode;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const next = await getTeacherResultPreview(sheet);
        if (cancelled) return;
        setPreview(next);
        setStudentId(current => (next.students.some(student => student.id === current) ? current : (next.students[0]?.id || '')));
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Unable to build the result preview.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
    // The sheet object changes on every keystroke; the preview follows saved data only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, mode, refreshKey, reloadKey]);

  const records = (preview?.publications || []).filter(record => record.student?.id === studentId);
  const students = preview?.students || [];
  const position = students.findIndex(student => student.id === studentId);

  return (
    <section className="space-y-4">
      <div className={`${RESULT_SURFACE} flex flex-wrap items-center justify-between gap-3 px-5 py-4`}>
        <div className="min-w-0">
          <p className={`micro-label ${RESULT_LABEL}`}>Student view</p>
          <p className={`mt-1 text-sm ${RESULT_BODY}`}>
            Each student's result exactly as the student, their parents and teachers will see it once published — built from the <strong>saved</strong> score sheet by the same engine.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {students.length > 0 && (
            <>
              <button type="button" onClick={() => setStudentId(students[position - 1]?.id || studentId)} disabled={position <= 0} className={RESULT_SECONDARY_BUTTON}>← Previous</button>
              <select value={studentId} onChange={event => setStudentId(event.target.value)} className={`${RESULT_INPUT} min-w-[220px]`} aria-label="Student to preview">
                {students.map(student => (
                  <option key={student.id} value={student.id}>{student.name || student.id}</option>
                ))}
              </select>
              <span className={`text-xs ${RESULT_BODY}`}>{position + 1} of {students.length}</span>
              <button type="button" onClick={() => setStudentId(students[position + 1]?.id || studentId)} disabled={position < 0 || position >= students.length - 1} className={RESULT_SECONDARY_BUTTON}>Next →</button>
            </>
          )}
          <button type="button" onClick={() => setReloadKey(key => key + 1)} disabled={loading} className={RESULT_SECONDARY_BUTTON}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <section className={`${RESULT_SURFACE} p-6 text-sm text-[#800020] dark:text-[#ffffff]`}>{error}</section>}

      {!loading && !error && (
        <ResultRecordViewer
          records={records}
          selectedRecordId={records[0]?.id || ''}
          emptyMessage="No student has saved scores yet. Enter and save CA scores, then come back to see each student's result."
        />
      )}
    </section>
  );
}
