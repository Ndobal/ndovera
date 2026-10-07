import React, { useState } from 'react';
import { handInCa, reviewCa } from '../service/resultEngineService';
import { normalizeCaComponentDefinitions } from '../utils/resultEngineTransforms';
import { RESULT_BODY, RESULT_BUTTON, RESULT_HEADING, RESULT_INNER_SURFACE, RESULT_LABEL, RESULT_SECONDARY_BUTTON, RESULT_SURFACE } from './resultSheetTheme';

// C.A. hand-in on the score sheet. A subject teacher hands in each C.A. (or all
// of them) by its deadline; the section head approves or returns it; the HoS or
// Owner gives final approval, which locks it into the result.

const STATUS = {
  submitted: { label: 'Handed in — awaiting the section head', tone: 'bg-amber-100 text-amber-900' },
  section_approved: { label: 'Approved by the section head — awaiting the HoS', tone: 'bg-sky-100 text-sky-900' },
  approved: { label: 'Approved — locked into the result', tone: 'bg-emerald-100 text-emerald-900' },
  returned: { label: 'Returned for correction', tone: 'bg-rose-100 text-rose-900' },
};

export default function CaHandInPanel({ sheet, onSheet }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const components = [...normalizeCaComponentDefinitions(sheet.settings).map(component => ({ key: component.key, label: component.label })), { key: 'all', label: 'All C.A.' }];
  const submissions = sheet.caSubmissions || [];
  const permissions = sheet.permissions || {};
  const subjects = sheet.subjects || [];
  if (!components.length || (!subjects.length && !submissions.length)) return null;

  async function run(key, action, success) {
    setBusy(key); setError(''); setMessage('');
    try { onSheet(await action()); setMessage(success); } catch (err) { setError(err.message || 'Something went wrong.'); } finally { setBusy(''); }
  }
  const find = (subjectId, key) => submissions.find(item => item.subjectId === subjectId && item.componentKey === key);

  return (
    <section className={`${RESULT_SURFACE} space-y-3 p-5`} aria-label="C.A. hand-in">
      <div>
        <p className={`micro-label ${RESULT_LABEL}`}>C.A. hand-in</p>
        <p className={`mt-1 text-sm ${RESULT_BODY}`}>
          Enter every student's score, then hand each C.A. in for review. Once handed in it is locked for you; your section head approves it, and the HoS or Owner&apos;s approval puts it into the result.
        </p>
      </div>
      {subjects.map(subject => (
        <div key={subject.id} className={`${RESULT_INNER_SURFACE} p-3`}>
          <p className={`text-sm font-black ${RESULT_HEADING}`}>{subject.name}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {components.map(component => {
              const submission = find(subject.id, component.key);
              const canHandIn = (!submission || submission.status === 'returned') && !sheet.submitted && !sheet.published;
              if (!submission && !canHandIn) return null;
              return (
                <div key={component.key} className="flex flex-wrap items-center gap-1 rounded-xl border border-[#7cc4e8]/40 px-2 py-1 text-xs">
                  <span className={`font-bold ${RESULT_HEADING}`}>{component.label}</span>
                  {submission && <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS[submission.status]?.tone || ''}`}>{STATUS[submission.status]?.label || submission.status}</span>}
                  {submission?.returnNote && submission.status === 'returned' && <span className="text-rose-800">“{submission.returnNote}”</span>}
                  {canHandIn && (
                    <button type="button" disabled={Boolean(busy)} className={RESULT_BUTTON}
                      onClick={() => run(`${subject.id}:${component.key}`, () => handInCa(sheet, subject.id, component.key), `${component.label} for ${subject.name} handed in.`)}>
                      {busy === `${subject.id}:${component.key}` ? 'Handing in…' : submission ? 'Hand in again' : 'Hand in'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {permissions.canReviewCa && submissions.length > 0 && (
        <div className={`${RESULT_INNER_SURFACE} space-y-2 p-3`}>
          <p className={`micro-label ${RESULT_LABEL}`}>To review</p>
          {submissions.map(submission => (
            <div key={submission.id} className={`flex flex-wrap items-center justify-between gap-2 text-sm ${RESULT_BODY}`}>
              <span>
                <strong>{submission.subjectName}</strong> · {submission.componentLabel} · {submission.teacherName}
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[submission.status]?.tone || ''}`}>{STATUS[submission.status]?.label || submission.status}</span>
              </span>
              <span className="flex flex-wrap gap-1">
                {submission.status === 'submitted' && !permissions.canApproveCa && (
                  <button type="button" disabled={Boolean(busy)} className={RESULT_BUTTON} onClick={() => run(submission.id, () => reviewCa(sheet, submission.id, 'section_approve'), 'Approved for the section.')}>Approve</button>
                )}
                {permissions.canApproveCa && ['submitted', 'section_approved'].includes(submission.status) && (
                  <button type="button" disabled={Boolean(busy)} className={RESULT_BUTTON} onClick={() => run(submission.id, () => reviewCa(sheet, submission.id, 'approve'), 'Approved — locked into the result.')}>Final approval</button>
                )}
                {submission.status !== 'returned' && (submission.status !== 'approved' || permissions.canApproveCa) && (
                  <button type="button" disabled={Boolean(busy)} className={RESULT_SECONDARY_BUTTON} onClick={() => {
                    const note = window.prompt('What needs correcting?');
                    if (note) run(submission.id, () => reviewCa(sheet, submission.id, 'return', note), 'Returned to the teacher.');
                  }}>Return</button>
                )}
              </span>
            </div>
          ))}
          {permissions.canEditApprovedCa && <p className={`text-xs ${RESULT_BODY}`}>You can correct handed-in or approved scores on the sheet; give the reason in the box above the sheet — it is kept in the override log.</p>}
        </div>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}
      {message && <p role="status" className="text-sm font-semibold text-emerald-700">{message}</p>}
    </section>
  );
}
