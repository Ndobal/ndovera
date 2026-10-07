import React, { useState } from 'react';
import { PHASE_LABELS, SITTING_MODES } from './assessmentsApi';

// When the HOS approves an exam paper, they decide how it is written — printed,
// CBT for the whole paper, or CBT objectives with a printed theory section — and,
// for CBT, when it opens and closes and how long each student has.

const FIELD = 'mt-1 w-full rounded-xl border border-[#c9a96e]/45 bg-white px-3 py-2 text-sm text-[#191970]';

const local = value => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export function defaultDelivery(paper) {
  const mode = paper.objectiveCount && paper.theoryCount ? 'cbt_objective' : paper.objectiveCount ? 'cbt' : 'print';
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const minutes = mode === 'cbt_objective' ? Math.max(15, Math.min(90, paper.objectiveCount)) : Math.max(15, paper.durationMinutes || 60);
  return { mode, opensAt: local(tomorrow), closesAt: local(new Date(tomorrow.getTime() + (minutes + 60) * 60000)), durationMinutes: minutes, uniquePerStudent: Boolean(paper.secondary) };
}

/** The delivery as the server takes it (ISO times). */
export function deliveryPayload(delivery) {
  const iso = value => (value ? new Date(value).toISOString() : '');
  return { ...delivery, opensAt: iso(delivery.opensAt), closesAt: iso(delivery.closesAt), durationMinutes: Number(delivery.durationMinutes) || 0 };
}

export default function ExamDeliveryPanel({ paper, delivery, onChange, canSchedule }) {
  const [showHelp, setShowHelp] = useState(false);
  const set = patch => onChange({ ...delivery, ...patch });
  const modes = SITTING_MODES.filter(([key]) => (key !== 'cbt_objective' || (paper.objectiveCount && paper.theoryCount)) && (key === 'print' || canSchedule));
  return (
    <section aria-label="How this exam is written" className="space-y-3 rounded-2xl border border-[#1a5c38]/30 bg-[#f4fbf7] p-3 text-[#191970]">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-xs font-bold uppercase tracking-[0.12em] text-[#1a5c38]">How this exam is written</p>
        <button type="button" className="text-xs font-bold text-[#800020] underline" onClick={() => setShowHelp(open => !open)}>{showHelp ? 'Hide' : 'What happens next?'}</button>
      </div>
      <p className="text-sm">{paper.subjectName} · {paper.className} — {paper.objectiveCount} objective question{paper.objectiveCount === 1 ? '' : 's'} ({paper.objectiveMarks} marks) and {paper.theoryCount} theory question{paper.theoryCount === 1 ? '' : 's'} ({paper.theoryMarks} marks to be answered). Paper total {paper.paperTotal}.</p>
      {paper.sitting && <p className="rounded-xl bg-white px-3 py-2 text-sm">Already set up: <strong>{paper.sitting.modeLabel}</strong> · {PHASE_LABELS[paper.sitting.phase] || paper.sitting.phase}{paper.sitting.opensAt ? ` · ${new Date(paper.sitting.opensAt).toLocaleString()}` : ''}. Approving again replaces it while nobody has started.</p>}
      <div className="grid gap-2">
        {modes.map(([key, label, help]) => (
          <label key={key} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-2 text-sm ${delivery.mode === key ? 'border-[#1a5c38] bg-white' : 'border-[#c9a96e]/40'}`}>
            <input type="radio" name="exam-delivery" className="mt-1" checked={delivery.mode === key} onChange={() => set({ mode: key })} />
            <span><strong>{label}</strong><span className="block text-xs">{help}</span></span>
          </label>
        ))}
        {!canSchedule && <p className="text-xs text-amber-800">Only the Head of School or Owner can schedule a CBT. You can approve it for printing.</p>}
      </div>
      {delivery.mode !== 'print' && (
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="block text-xs font-bold text-[#800020]">Opens<input type="datetime-local" className={FIELD} value={delivery.opensAt} onChange={event => set({ opensAt: event.target.value })} /></label>
          <label className="block text-xs font-bold text-[#800020]">Closes<input type="datetime-local" className={FIELD} value={delivery.closesAt} onChange={event => set({ closesAt: event.target.value })} /></label>
          <label className="block text-xs font-bold text-[#800020]">Minutes per student<input type="number" min="1" max="600" className={FIELD} value={delivery.durationMinutes} onChange={event => set({ durationMinutes: event.target.value })} /></label>
          <label className="flex items-start gap-2 text-sm sm:col-span-3"><input type="checkbox" className="mt-1" checked={delivery.uniquePerStudent} onChange={event => set({ uniquePerStudent: event.target.checked })} /> <span>A unique paper for every student (questions and options in a different order){paper.secondary ? ' — on by default for secondary classes' : ''}</span></label>
        </div>
      )}
      {showHelp && (
        <ul className="list-disc space-y-1 pl-5 text-xs">
          <li>Students see the CBT on their Exams page only between the opening and closing times; once written, it disappears.</li>
          <li>Objectives mark themselves. The teacher enters the theory marks (or both, for a printed paper) on their Exams page and posts the scores.</li>
          <li>Posting puts each student's exam score in the CA score sheet — converted to the exam maximum if the school's result settings say so — and opens the paper in the student's Assignments tab with the answers and marking guide.</li>
        </ul>
      )}
    </section>
  );
}
