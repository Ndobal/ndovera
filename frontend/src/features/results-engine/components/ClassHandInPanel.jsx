import React, { useState } from 'react';
import { reviewCa, scheduleClassHandIn, submitSubjectToClassTeacher, submitTeacherResults } from '../service/resultEngineService';
import { RESULT_BODY, RESULT_BUTTON, RESULT_HEADING, RESULT_INNER_SURFACE, RESULT_INPUT, RESULT_LABEL, RESULT_SECONDARY_BUTTON, RESULT_SURFACE } from './resultSheetTheme';
import { askConfirm, askText } from '../../../shared/components/AppDialog';

// The end of the score sheet. Subject teachers submit each subject to the class
// teacher; the class teacher (or assistant) can correct any subject, return one to
// its teacher, and hands the whole class in once — now or at a set time — when every
// student has every score. Students who join after the hand-in are scored and handed
// in the same way.

const SUBJECT_STATUS = {
  submitted: { label: 'Submitted to the class teacher', tone: 'bg-sky-100 text-sky-900' },
  section_approved: { label: 'Approved by the section head', tone: 'bg-sky-100 text-sky-900' },
  approved: { label: 'Approved — locked', tone: 'bg-emerald-100 text-emerald-900' },
  returned: { label: 'Returned for correction', tone: 'bg-rose-100 text-rose-900' },
};

const fmt = value => {
  try { return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); } catch { return String(value || ''); }
};

// datetime-local wants local time without a zone.
function localInputValue(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function ClassHandInPanel({ sheet, onSheet, onSaveDraft, saving = false }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [when, setWhen] = useState(() => localInputValue(new Date(Date.now() + 3600_000)));
  const permissions = sheet.permissions || {};
  const subjects = sheet.subjects || [];
  const submissions = sheet.caSubmissions || [];
  const missing = sheet.missingScores || [];
  const missingCount = Number(sheet.missingCount || missing.length || 0);
  const isPractice = sheet.mode === 'practice';
  const lateStudents = (sheet.students || []).filter(student => student.late && student.rows.some(row => !row.missing));
  const canForce = Boolean(permissions.canApproveCa);

  async function run(key, action, success) {
    setBusy(key); setError(''); setMessage('');
    try { onSheet(await action()); if (success) setMessage(success); } catch (err) { setError(err.message || 'Something went wrong.'); } finally { setBusy(''); }
  }

  const subjectSubmission = subjectId => submissions.find(item => item.subjectId === subjectId && item.componentKey === 'all')
    || submissions.find(item => item.subjectId === subjectId && item.status !== 'returned');
  const missingFor = subjectId => missing.filter(item => item.subjectId === subjectId);

  async function handIn(force = false) {
    if (force && !await askConfirm(`${missingCount} score${missingCount === 1 ? ' is' : 's are'} still missing. Hand the class in anyway?`)) return;
    run('handin', () => submitTeacherResults(sheet, { force }), isPractice ? 'Practice sheet handed in.' : 'Class results handed in for HoS approval.');
  }

  function schedule() {
    const at = new Date(when);
    if (Number.isNaN(at.getTime())) { setError('Choose a date and time.'); return; }
    run('schedule', () => scheduleClassHandIn(sheet, at.toISOString()), `Hand-in scheduled for ${fmt(at)}. If any score is still missing then, it will not go through and this sheet will say why.`);
  }

  return (
    <section className={`${RESULT_SURFACE} space-y-4 p-5`} aria-label="Hand in">
      <div>
        <p className={`micro-label ${RESULT_LABEL}`}>Hand in</p>
        <p className={`mt-1 text-sm ${RESULT_BODY}`}>
          {permissions.canHandIn
            ? 'Subject teachers submit their subjects to you. You can correct any score, return a subject to its teacher, and hand the whole class in once every student has every score.'
            : 'Submit each of your subjects to the class teacher once every student has a score. The class teacher can correct them and hands the class in.'}
        </p>
      </div>

      {sheet.handInNote && <p role="alert" className="rounded-xl bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900">{sheet.handInNote}</p>}

      <div className={`${RESULT_INNER_SURFACE} divide-y divide-[#7cc4e8]/30 p-0`}>
        {subjects.map(subject => {
          const submission = subjectSubmission(subject.id);
          const status = submission ? SUBJECT_STATUS[submission.status] : null;
          const subjectMissing = missingFor(subject.id);
          const mine = permissions.canSubmitSubjects && subject.ownSubject;
          const canSubmit = mine && !sheet.submitted && !sheet.published && (!submission || submission.status === 'returned');
          return (
            <div key={subject.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <p className={`text-sm font-black ${RESULT_HEADING}`}>{subject.name}</p>
                <p className={`text-xs ${RESULT_BODY}`}>
                  {subjectMissing.length ? `${subjectMissing.length} student${subjectMissing.length === 1 ? '' : 's'} without a score` : 'Every student has a score'}
                  {submission?.teacherName ? ` · ${submission.teacherName}` : ''}
                  {submission?.submittedAt ? ` · ${fmt(submission.submittedAt)}` : ''}
                </p>
                {submission?.status === 'returned' && submission.returnNote && <p className="text-xs text-rose-800">“{submission.returnNote}”</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {status ? <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.tone}`}>{status.label}</span>
                  : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">Not submitted</span>}
                {canSubmit && (
                  <button type="button" disabled={Boolean(busy) || saving || subjectMissing.length > 0} className={RESULT_BUTTON}
                    title={subjectMissing.length ? `Missing: ${subjectMissing.slice(0, 6).map(item => item.studentName).join(', ')}` : undefined}
                    onClick={() => run(`s:${subject.id}`, () => submitSubjectToClassTeacher(sheet, subject.id), `${subject.name} submitted to the class teacher.`)}>
                    {busy === `s:${subject.id}` ? 'Submitting…' : submission ? 'Submit again' : 'Submit to class teacher'}
                  </button>
                )}
                {permissions.canReturnSubjects && submission?.status === 'submitted' && !sheet.submitted && (
                  <button type="button" disabled={Boolean(busy)} className={RESULT_SECONDARY_BUTTON} onClick={async () => {
                    const note = await askText(`What should the ${subject.name} teacher correct?`);
                    if (note) run(`r:${submission.id}`, () => reviewCa(sheet, submission.id, 'return', note), `${subject.name} returned to its teacher.`);
                  }}>Return</button>
                )}
              </div>
            </div>
          );
        })}
        {!subjects.length && <p className={`px-4 py-3 text-sm ${RESULT_BODY}`}>No subjects on this sheet.</p>}
      </div>

      {permissions.canHandIn && (
        <div className={`${RESULT_INNER_SURFACE} space-y-3 p-4`}>
          {sheet.published ? (
            <p className={`text-sm font-semibold ${RESULT_HEADING}`}>Published{sheet.publishedAt ? ` on ${fmt(sheet.publishedAt)}` : ''}.</p>
          ) : sheet.submitted ? (
            <>
              <p className={`text-sm font-semibold ${RESULT_HEADING}`}>Handed in{sheet.submittedAt ? ` on ${fmt(sheet.submittedAt)}` : ''} — awaiting the HoS.</p>
              {lateStudents.length > 0 && (
                <div className="space-y-2">
                  <p className={`text-sm ${RESULT_BODY}`}>Scored since the hand-in: {lateStudents.map(student => student.name).join(', ')}.</p>
                  <button type="button" disabled={Boolean(busy) || saving} className={RESULT_BUTTON} onClick={() => handIn(false)}>
                    {busy === 'handin' ? 'Handing in…' : 'Hand in their scores'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <p className={`text-sm font-semibold ${missingCount ? 'text-amber-800' : 'text-emerald-800'}`}>
                {missingCount ? `${missingCount} score${missingCount === 1 ? ' is' : 's are'} still missing. Every student needs every score before the class is handed in.` : 'Every student has every score. Ready to hand in.'}
              </p>
              {missingCount > 0 && (
                <ul className={`max-h-40 list-disc overflow-y-auto pl-5 text-xs ${RESULT_BODY}`}>
                  {missing.slice(0, 60).map(item => <li key={`${item.studentId}-${item.subjectId}`}>{item.studentName} — {item.subjectName}</li>)}
                </ul>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" disabled={Boolean(busy) || saving || missingCount > 0} className={RESULT_BUTTON} onClick={() => handIn(false)}>
                  {busy === 'handin' ? 'Handing in…' : 'Hand in'}
                </button>
                {onSaveDraft && <button type="button" disabled={Boolean(busy) || saving} className={RESULT_SECONDARY_BUTTON} onClick={onSaveDraft}>{saving ? 'Saving…' : 'Save as draft'}</button>}
                {canForce && missingCount > 0 && <button type="button" disabled={Boolean(busy) || saving} className={RESULT_SECONDARY_BUTTON} onClick={() => handIn(true)}>Hand in anyway</button>}
              </div>
              {!isPractice && (
                <div className="flex flex-wrap items-end gap-2 border-t border-[#7cc4e8]/30 pt-3">
                  <label className="block">
                    <span className={`micro-label ${RESULT_LABEL}`}>Schedule hand-in</span>
                    <input type="datetime-local" value={when} onChange={event => setWhen(event.target.value)} className={`mt-1 ${RESULT_INPUT}`} />
                  </label>
                  <button type="button" disabled={Boolean(busy) || saving} className={RESULT_SECONDARY_BUTTON} onClick={schedule}>{busy === 'schedule' ? 'Scheduling…' : 'Schedule'}</button>
                  {sheet.scheduledHandInAt && (
                    <span className={`text-sm ${RESULT_BODY}`}>
                      Scheduled for <strong>{fmt(sheet.scheduledHandInAt)}</strong>{sheet.scheduledHandInName ? ` by ${sheet.scheduledHandInName}` : ''}.{' '}
                      <button type="button" className="font-bold text-[#2447d8] underline" disabled={Boolean(busy)} onClick={() => run('unschedule', () => scheduleClassHandIn(sheet, null), 'Schedule cancelled.')}>Cancel</button>
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Section heads and the HoS still approve submitted subjects for the compliance record. */}
      {permissions.canReviewCa && submissions.some(item => ['submitted', 'section_approved'].includes(item.status)) && (
        <div className={`${RESULT_INNER_SURFACE} space-y-2 p-4`}>
          <p className={`micro-label ${RESULT_LABEL}`}>To approve</p>
          {submissions.filter(item => ['submitted', 'section_approved'].includes(item.status)).map(submission => (
            <div key={submission.id} className={`flex flex-wrap items-center justify-between gap-2 text-sm ${RESULT_BODY}`}>
              <span><strong>{submission.subjectName}</strong> · {submission.componentLabel} · {submission.teacherName}</span>
              <span className="flex flex-wrap gap-1">
                {submission.status === 'submitted' && !permissions.canApproveCa && (
                  <button type="button" disabled={Boolean(busy)} className={RESULT_BUTTON} onClick={() => run(submission.id, () => reviewCa(sheet, submission.id, 'section_approve'), 'Approved for the section.')}>Approve</button>
                )}
                {permissions.canApproveCa && (
                  <button type="button" disabled={Boolean(busy)} className={RESULT_BUTTON} onClick={() => run(submission.id, () => reviewCa(sheet, submission.id, 'approve'), 'Approved.')}>Approve</button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {!permissions.canHandIn && onSaveDraft && !sheet.submitted && (
        <button type="button" disabled={Boolean(busy) || saving} className={RESULT_SECONDARY_BUTTON} onClick={onSaveDraft}>{saving ? 'Saving…' : 'Save as draft'}</button>
      )}

      {error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}
      {message && <p role="status" className="text-sm font-semibold text-emerald-700">{message}</p>}
    </section>
  );
}
