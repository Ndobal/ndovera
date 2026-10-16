import React, { useState } from 'react';
import { normalizeCaComponentDefinitions, resolveResultScoreModel } from '../utils/resultEngineTransforms';
import { RESULT_BODY, RESULT_BUTTON, RESULT_HEADING, RESULT_INNER_SURFACE, RESULT_LABEL, RESULT_SECONDARY_BUTTON, RESULT_SURFACE } from './resultSheetTheme';

// The score sheet's guidance — the live summary, the sheet layout and the workflow —
// shown once, a tip at a time, to each person. Closed tips stay in the Tips tab.

const SEEN_KEY = 'ndovera.scoreSheetTips.v1';

export function tipsSeen() {
  try { return window.localStorage.getItem(SEEN_KEY) === '1'; } catch { return true; }
}

function markSeen() {
  try { window.localStorage.setItem(SEEN_KEY, '1'); } catch { /* the tips just show again next time */ }
}

function buildTips(sheet) {
  const components = normalizeCaComponentDefinitions(sheet?.settings);
  const scoreModel = resolveResultScoreModel(sheet?.settings);
  const students = sheet?.students || [];
  const status = sheet?.published ? 'Published' : sheet?.submitted ? 'Handed in' : 'Draft';
  return [
    {
      key: 'summary',
      icon: '📡',
      title: 'Live sheet summary',
      body: (
        <>
          <p>{sheet?.classroom?.className || 'This class'} · {sheet?.period?.termName || 'Term'}{sheet?.period?.sessionName ? ` ${sheet.period.sessionName}` : ''} · <strong>{status}</strong></p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>{students.length}</strong> learner{students.length === 1 ? '' : 's'} on this sheet.</li>
            <li>Every score is held to C.A. {scoreModel.caMaxScore}, exam {scoreModel.examMaxScore}, total {scoreModel.totalMaxScore}.</li>
            <li>Only results the HoS publishes reach students and parents.</li>
          </ul>
        </>
      ),
    },
    {
      key: 'layout',
      icon: '🧮',
      title: 'Sheet layout',
      body: (
        <>
          <p>Each subject has its C.A. columns, which add up to the C.A. total, then the exam score, the total, the grade and the remark.</p>
          {components.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {components.map(component => (
                <span key={component.key} className="rounded-full border border-[#c9a96e]/45 bg-[#ade1f4] px-3 py-1 text-xs font-semibold dark:bg-black/20">{component.label} ({component.maxScore})</span>
              ))}
            </div>
          )}
        </>
      ),
    },
    {
      key: 'students',
      icon: '👩🏽‍🎓',
      title: 'One student at a time',
      body: <p>Pick a student from the tabs, or use <strong>Next</strong>. Their scores save when you press Next or Save as draft. A student with every score has a green tick.</p>,
    },
    {
      key: 'workflow',
      icon: '🔁',
      title: 'Workflow',
      body: (
        <ol className="list-decimal space-y-1 pl-5">
          <li><strong>Subject teachers</strong> enter scores and submit each subject to the class teacher.</li>
          <li><strong>The class teacher</strong> (or assistant) checks and corrects, then hands the whole class in — now or at a scheduled time — once every student has every score.</li>
          <li><strong>The HoS</strong> reviews and publishes. Students who join later are scored and handed in the same way.</li>
        </ol>
      ),
    },
  ];
}

/** `all` lists every tip (the Tips tab); otherwise one tip at a time until closed. */
export default function ScoreSheetTips({ sheet, all = false, onClose }) {
  const tips = buildTips(sheet);
  const [index, setIndex] = useState(0);

  if (all) {
    return (
      <section className={`${RESULT_SURFACE} space-y-3 p-5`} aria-label="Tips">
        <p className={`micro-label ${RESULT_LABEL}`}>Tips</p>
        {tips.map(tip => (
          <article key={tip.key} className={`${RESULT_INNER_SURFACE} p-4`}>
            <p className={`text-sm font-black ${RESULT_HEADING}`}><span className="mr-2">{tip.icon}</span>{tip.title}</p>
            <div className={`mt-2 text-sm ${RESULT_BODY}`}>{tip.body}</div>
          </article>
        ))}
      </section>
    );
  }

  const tip = tips[index];
  const close = () => { markSeen(); onClose?.(); };
  return (
    <section className={`${RESULT_SURFACE} relative border-[#2447d8]/40 p-5`} role="dialog" aria-label="Score sheet tip">
      <button type="button" onClick={close} aria-label="Close tips" className="absolute right-3 top-3 rounded-full px-2 text-lg font-bold text-[#2447d8]">×</button>
      <p className={`micro-label ${RESULT_LABEL}`}>Tip {index + 1} of {tips.length}</p>
      <p className={`mt-1 text-base font-black ${RESULT_HEADING}`}><span className="mr-2">{tip.icon}</span>{tip.title}</p>
      <div className={`mt-2 text-sm ${RESULT_BODY}`}>{tip.body}</div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {index > 0 && <button type="button" className={RESULT_SECONDARY_BUTTON} onClick={() => setIndex(index - 1)}>Back</button>}
        {index < tips.length - 1
          ? <button type="button" className={RESULT_BUTTON} onClick={() => setIndex(index + 1)}>Next tip</button>
          : <button type="button" className={RESULT_BUTTON} onClick={close}>Got it</button>}
        <span className={`text-xs ${RESULT_BODY}`}>You can read these again in the Tips tab.</span>
      </div>
    </section>
  );
}
