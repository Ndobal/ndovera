import React, { useCallback, useEffect, useState } from 'react';
import { answerExamRequest, downloadExamRequestFile, getExamRequests } from '../../../features/showcase/showcaseApi';

// Exams people have asked for, with the curriculum they sent. The note is shown to the person who asked.

const CARD = 'rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900';
const BODY = 'text-sm text-slate-700 dark:text-slate-200';
const FIELD = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/20 dark:bg-slate-800 dark:text-white';
const PRIMARY = 'rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-black text-white';
const SECONDARY = 'rounded-xl border border-slate-400 bg-white px-3 py-1.5 text-xs font-black text-slate-800 dark:border-white/30 dark:bg-slate-800 dark:text-white';
const TABS = [['new', 'New'], ['reviewing', 'Reading'], ['building', 'Building'], ['ready', 'Ready'], ['declined', 'Declined']];

function Request({ item, onAnswer, onFile }) {
  const [note, setNote] = useState(item.note);
  return (
    <li className="space-y-2 rounded-2xl bg-slate-100 p-3 dark:bg-white/5">
      <p className="font-black text-slate-900 dark:text-white">{item.examName} · {item.scope === 'global' ? 'Everyone' : item.country}</p>
      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{item.userName} ({item.userRole}), {item.schoolName} · {new Date(item.createdAt).toLocaleDateString()} · {item.section}{item.subjects ? ` · ${item.subjects}` : ''}</p>
      {item.curriculumNote ? <p className={`whitespace-pre-wrap ${BODY}`}>{item.curriculumNote}</p> : null}
      <div className="flex flex-wrap gap-2">
        {item.hasFile ? <button type="button" className={SECONDARY} onClick={() => onFile(item)}>Download {item.fileName}</button> : null}
        {item.link ? <a className={SECONDARY} href={item.link} target="_blank" rel="noreferrer noopener">Open their link</a> : null}
      </div>
      <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Note to the person who asked
        <textarea rows={2} className={FIELD} value={note} onChange={event => setNote(event.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        {TABS.filter(([key]) => key !== item.status).map(([key, label]) => <button key={key} type="button" className={key === 'declined' ? SECONDARY : PRIMARY} onClick={() => onAnswer(item.id, key, note)}>Move to {label}</button>)}
      </div>
    </li>
  );
}

export default function AmiExamRequests() {
  const [status, setStatus] = useState('new');
  const [items, setItems] = useState(null);
  const [notice, setNotice] = useState('');
  const load = useCallback(() => getExamRequests(status).then(result => setItems(result.requests)).catch(error => setNotice(error.message)), [status]);
  useEffect(() => { load(); }, [load]);
  const answer = (id, next, note) => answerExamRequest(id, { status: next, note }).then(load).catch(error => setNotice(error.message));
  const file = item => downloadExamRequestFile(item.id, item.fileName).catch(error => setNotice(error.message));
  return (
    <section className={`${CARD} space-y-3`} aria-label="Exam requests">
      <h2 className="text-lg font-black text-slate-900 dark:text-white">Exam requests</h2>
      <p className={BODY}>Exams people have asked for, and the curriculum they sent.</p>
      {notice ? <p role="status" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 dark:bg-rose-500/15 dark:text-rose-100">{notice}</p> : null}
      <div className="flex flex-wrap gap-2">
        {TABS.map(([key, label]) => <button key={key} type="button" aria-pressed={status === key} className={status === key ? PRIMARY : SECONDARY} onClick={() => setStatus(key)}>{label}</button>)}
      </div>
      {!items ? <p role="status" className={BODY}>Loading…</p> : items.length
        ? <ul className="space-y-2">{items.map(item => <Request key={`${item.id}-${item.status}`} item={item} onAnswer={answer} onFile={file} />)}</ul>
        : <p className={BODY}>No requests here.</p>}
    </section>
  );
}
