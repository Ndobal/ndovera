import React, { useCallback, useEffect, useState } from 'react';
import { PHASE_LABELS, listExamSittings, rescheduleExamSitting } from './assessmentsApi';
import { deliveryPayload } from './ExamDeliveryPanel';
import ExamMarking from './ExamMarking';

// Head of School / Owner: every approved exam — how it is written, when, and
// where marking stands. A CBT that has not opened yet can be moved.

const BTN = 'rounded-xl px-3 py-1.5 text-xs font-bold disabled:opacity-50';
const FIELD = 'mt-1 w-full rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970]';
const local = value => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

function Reschedule({ sitting, onSaved, onCancel }) {
  const [form, setForm] = useState({ opensAt: local(sitting.opensAt), closesAt: local(sitting.closesAt), durationMinutes: sitting.durationMinutes });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setError('');
    try { await rescheduleExamSitting(sitting.id, deliveryPayload({ ...form, mode: sitting.mode })); onSaved(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return (
    <div className="mt-2 grid gap-2 rounded-xl bg-[#f4fbf7] p-3 sm:grid-cols-4">
      <label className="text-xs font-bold text-[#800020]">Opens<input type="datetime-local" className={FIELD} value={form.opensAt} onChange={event => setForm({ ...form, opensAt: event.target.value })} /></label>
      <label className="text-xs font-bold text-[#800020]">Closes<input type="datetime-local" className={FIELD} value={form.closesAt} onChange={event => setForm({ ...form, closesAt: event.target.value })} /></label>
      <label className="text-xs font-bold text-[#800020]">Minutes per student<input type="number" min="1" className={FIELD} value={form.durationMinutes} onChange={event => setForm({ ...form, durationMinutes: event.target.value })} /></label>
      <div className="flex items-end gap-2">
        <button type="button" className={`${BTN} bg-[#1a5c38] text-[#b5e3f4]`} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save time'}</button>
        <button type="button" className={`${BTN} border border-[#c9a96e]/50 bg-white text-[#800020]`} onClick={onCancel}>Cancel</button>
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-rose-700 sm:col-span-4">{error}</p>}
    </div>
  );
}

export default function ExamSittingsBoard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState('');
  const [marking, setMarking] = useState('');
  const load = useCallback(() => listExamSittings().then(setData).catch(err => setError(err.message)), []);
  useEffect(() => { load(); }, [load]);

  if (marking) return <ExamMarking sittingId={marking} onBack={() => { setMarking(''); load(); }} />;
  return (
    <div className="space-y-2">
      <p className="text-sm text-[#191970] dark:text-slate-300">Exam papers are approved under Submit Work → review, where you choose printed paper, CBT, or CBT objectives with printed theory, and set the time.</p>
      {error && <p role="alert" className="font-semibold text-rose-700">{error}</p>}
      {!data ? <p role="status">Loading…</p> : !data.sittings.length ? <p className="text-sm text-[#800020]">No approved exams yet.</p> : (
        <ul className="space-y-2">
          {data.sittings.map(sitting => (
            <li key={sitting.id} className="rounded-2xl border border-[#c9a96e]/30 bg-[#ade1f4] p-3 text-[#191970] dark:bg-slate-800/40 dark:text-slate-200">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex-1"><strong>{sitting.title}</strong><span className="block text-xs">{sitting.className} · {sitting.subjectName} · {sitting.modeLabel}{sitting.opensAt ? ` · ${new Date(sitting.opensAt).toLocaleString()} – ${new Date(sitting.closesAt).toLocaleString()} · ${sitting.durationMinutes} min` : ''}{sitting.approvedByName ? ` · approved by ${sitting.approvedByName}` : ''}</span></span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold">{PHASE_LABELS[sitting.phase] || sitting.phase}</span>
                {data.canSchedule && sitting.phase === 'scheduled' && <button type="button" className={`${BTN} border border-[#c9a96e]/50 bg-white text-[#800020]`} onClick={() => setEditing(editing === sitting.id ? '' : sitting.id)}>Change time</button>}
                {['marking', 'posted'].includes(sitting.phase) && <button type="button" className={`${BTN} border border-[#c9a96e]/50 bg-white text-[#800020]`} onClick={() => setMarking(sitting.id)}>Marks</button>}
              </div>
              {editing === sitting.id && <Reschedule sitting={sitting} onSaved={() => { setEditing(''); load(); }} onCancel={() => setEditing('')} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
