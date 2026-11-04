import React, { useCallback, useEffect, useState } from 'react';
import { addCustomExamTopics, answerExamRequest, createCustomExam, downloadExamRequestFile, getCustomExams, getExamRequests, joinExamRequest, updateCustomExam } from '../../../features/showcase/showcaseApi';

// Exams people have asked for, with the curriculum they sent. The note is shown to the person who asked.
// Starting an exam makes it build at night; nobody sees it until it has enough checked questions.

const CARD = 'rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900';
const BODY = 'text-sm text-slate-700 dark:text-slate-200';
const LABEL = 'block text-xs font-bold text-slate-700 dark:text-slate-200';
const FIELD = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/20 dark:bg-slate-800 dark:text-white';
const PRIMARY = 'rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-black text-white disabled:opacity-60';
const SECONDARY = 'rounded-xl border border-slate-400 bg-white px-3 py-1.5 text-xs font-black text-slate-800 dark:border-white/30 dark:bg-slate-800 dark:text-white';
const INNER = 'space-y-2 rounded-2xl bg-slate-100 p-3 dark:bg-white/5';
const TITLE = 'font-black text-slate-900 dark:text-white';
const SMALL = 'text-xs font-semibold text-slate-700 dark:text-slate-300';
const TABS = [['new', 'New'], ['reviewing', 'Reading'], ['building', 'Building'], ['ready', 'Ready'], ['declined', 'Declined']];
const STATUS_WORDS = { building: 'Building, hidden from buyers', live: 'On sale', paused: 'Stopped, off sale' };

function StartExam({ item, exams, onDone, onNotice }) {
  const [form, setForm] = useState({ label: item.examName, section: ['primary', 'junior', 'senior'].includes(item.section) ? item.section : 'senior', country: item.scope === 'global' ? '' : item.country, subjects: item.subjects || '', priceNaira: '3000', minStock: '150', mcqOptions: '4', mockQuestions: '50', mockMinutes: '60' });
  const [joinKey, setJoinKey] = useState('');
  const set = name => event => setForm(current => ({ ...current, [name]: event.target.value }));
  const start = event => {
    event.preventDefault();
    createCustomExam({ ...form, requestId: item.id }).then(onDone).catch(error => onNotice(error.message));
  };
  const join = () => joinExamRequest(item.id, joinKey).then(onDone).catch(error => onNotice(error.message));
  return (
    <div className="space-y-3 rounded-2xl border border-slate-300 p-3 dark:border-white/20">
      <form onSubmit={start} className="space-y-2" aria-label={`Start building ${item.examName}`}>
        <p className={TITLE}>Build this exam</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={LABEL}>Exam name<input className={FIELD} value={form.label} onChange={set('label')} /></label>
          <label className={LABEL}>Level
            <select className={FIELD} value={form.section} onChange={set('section')}>
              <option value="primary">Primary</option><option value="junior">Junior secondary</option><option value="senior">Senior secondary</option>
            </select>
          </label>
          <label className={LABEL}>Sold in (empty for everyone)<input className={FIELD} value={form.country} onChange={set('country')} /></label>
          <label className={LABEL}>Pass price in naira<input type="number" min="100" className={FIELD} value={form.priceNaira} onChange={set('priceNaira')} /></label>
          <label className={LABEL}>Checked questions before sale<input type="number" min="30" className={FIELD} value={form.minStock} onChange={set('minStock')} /></label>
          <label className={LABEL}>Options per question<input type="number" min="3" max="5" className={FIELD} value={form.mcqOptions} onChange={set('mcqOptions')} /></label>
          <label className={LABEL}>Mock questions<input type="number" min="10" className={FIELD} value={form.mockQuestions} onChange={set('mockQuestions')} /></label>
          <label className={LABEL}>Mock minutes<input type="number" min="10" className={FIELD} value={form.mockMinutes} onChange={set('mockMinutes')} /></label>
        </div>
        <label className={LABEL}>Main subjects, separated by commas<input className={FIELD} value={form.subjects} onChange={set('subjects')} /></label>
        <button type="submit" className={PRIMARY}>Start building</button>
      </form>
      {exams.length ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className={LABEL}>Or join an exam already started
            <select className={FIELD} value={joinKey} onChange={event => setJoinKey(event.target.value)}>
              <option value="">Choose…</option>
              {exams.map(exam => <option key={exam.key} value={exam.key}>{exam.label}</option>)}
            </select>
          </label>
          <button type="button" disabled={!joinKey} onClick={join} className={SECONDARY}>Join</button>
        </div>
      ) : null}
    </div>
  );
}

function Request({ item, exams, onAnswer, onFile, onDone, onNotice }) {
  const [note, setNote] = useState(item.note);
  const [building, setBuilding] = useState(false);
  return (
    <li className={INNER}>
      <p className={TITLE}>{item.examName} · {item.scope === 'global' ? 'Everyone' : item.country}</p>
      <p className={SMALL}>{item.userName} ({item.userRole}), {item.schoolName} · {new Date(item.createdAt).toLocaleDateString()} · {item.section}{item.subjects ? ` · ${item.subjects}` : ''}</p>
      {item.curriculumNote ? <p className={`whitespace-pre-wrap ${BODY}`}>{item.curriculumNote}</p> : null}
      <div className="flex flex-wrap gap-2">
        {item.hasFile ? <button type="button" className={SECONDARY} onClick={() => onFile(item)}>Download {item.fileName}</button> : null}
        {item.link ? <a className={SECONDARY} href={item.link} target="_blank" rel="noreferrer noopener">Open their link</a> : null}
      </div>
      <label className={LABEL}>Note to the person who asked
        <textarea rows={2} className={FIELD} value={note} onChange={event => setNote(event.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        {!item.customExam ? <button type="button" aria-expanded={building} className={PRIMARY} onClick={() => setBuilding(current => !current)}>Build this exam</button> : null}
        {TABS.filter(([key]) => key !== item.status).map(([key, label]) => <button key={key} type="button" className={SECONDARY} onClick={() => onAnswer(item.id, key, note)}>Move to {label}</button>)}
      </div>
      {building ? <StartExam item={item} exams={exams} onDone={onDone} onNotice={onNotice} /> : null}
    </li>
  );
}

function ExamBeingBuilt({ exam, onChanged, onNotice }) {
  const [subject, setSubject] = useState('');
  const [topics, setTopics] = useState('');
  const [price, setPrice] = useState(String(exam.priceNaira));
  const [saved, setSaved] = useState('');
  const send = event => {
    event.preventDefault();
    addCustomExamTopics(exam.key, { subject, topics }).then(result => {
      setSaved(`Added ${result.added} ${result.subject} topics. Questions are written from them on Sunday and Wednesday nights.`);
      setTopics('');
      onChanged();
    }).catch(error => onNotice(error.message));
  };
  const change = body => updateCustomExam(exam.key, body).then(() => { setSaved('Saved.'); onChanged(); }).catch(error => onNotice(error.message));
  return (
    <li className={INNER}>
      <p className={TITLE}>{exam.label} · {exam.country || 'Everyone'}</p>
      <p className={SMALL}>{STATUS_WORDS[exam.status] || exam.status} · {exam.ready} of {exam.minStock} checked questions</p>
      {exam.stillNeeds.length ? <p className={SMALL}>Still needs: {exam.stillNeeds.map(item => `${item.subject} ${item.ready}/${item.needed}`).join(', ')}</p> : null}
      <p className={SMALL}>{exam.subjects.length ? `Curriculum in: ${exam.subjects.map(item => `${item.subject} (${item.topics} topics)`).join(', ')}` : 'No curriculum yet, so nothing is being written.'}</p>
      <form onSubmit={send} className="space-y-2" aria-label={`Curriculum for ${exam.label}`}>
        <label className={LABEL}>Subject<input className={FIELD} value={subject} onChange={event => setSubject(event.target.value)} /></label>
        <label className={LABEL}>Topics, one on each line
          <textarea rows={4} className={FIELD} value={topics} onChange={event => setTopics(event.target.value)} />
        </label>
        <button type="submit" disabled={!subject.trim() || !topics.trim()} className={PRIMARY}>Add topics</button>
      </form>
      <p className={SMALL}>For a long PDF, use Curriculum Library, Examination specifications, and choose {exam.key}. Reading a PDF there uses AI.</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className={LABEL}>Pass price in naira<input type="number" min="100" className={FIELD} value={price} onChange={event => setPrice(event.target.value)} /></label>
        <button type="button" className={SECONDARY} onClick={() => change({ priceNaira: Number(price) })}>Save price</button>
        {exam.status === 'paused'
          ? <button type="button" className={SECONDARY} onClick={() => change({ status: 'building' })}>Start again</button>
          : <button type="button" className={SECONDARY} onClick={() => change({ status: 'paused' })}>Stop{exam.status === 'live' ? ' selling' : ' building'}</button>}
      </div>
      {saved ? <p role="status" className={SMALL}>{saved}</p> : null}
    </li>
  );
}

export default function AmiExamRequests() {
  const [status, setStatus] = useState('new');
  const [items, setItems] = useState(null);
  const [exams, setExams] = useState([]);
  const [notice, setNotice] = useState('');
  const load = useCallback(() => getExamRequests(status).then(result => setItems(result.requests)).catch(error => setNotice(error.message)), [status]);
  const loadExams = useCallback(() => getCustomExams().then(result => setExams(result.exams)).catch(error => setNotice(error.message)), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadExams(); }, [loadExams]);
  const answer = (id, next, note) => answerExamRequest(id, { status: next, note }).then(load).catch(error => setNotice(error.message));
  const file = item => downloadExamRequestFile(item.id, item.fileName).catch(error => setNotice(error.message));
  const started = () => { load(); loadExams(); };
  return (
    <div className="space-y-4">
      <section className={`${CARD} space-y-3`} aria-label="Exam requests">
        <h2 className="text-lg font-black text-slate-900 dark:text-white">Exam requests</h2>
        <p className={BODY}>Exams people have asked for, and the curriculum they sent.</p>
        {notice ? <p role="status" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 dark:bg-rose-500/15 dark:text-rose-100">{notice}</p> : null}
        <div className="flex flex-wrap gap-2">
          {TABS.map(([key, label]) => <button key={key} type="button" aria-pressed={status === key} className={status === key ? PRIMARY : SECONDARY} onClick={() => setStatus(key)}>{label}</button>)}
        </div>
        {!items ? <p role="status" className={BODY}>Loading…</p> : items.length
          ? <ul className="space-y-2">{items.map(item => <Request key={`${item.id}-${item.status}`} item={item} exams={exams} onAnswer={answer} onFile={file} onDone={started} onNotice={setNotice} />)}</ul>
          : <p className={BODY}>No requests here.</p>}
      </section>
      <section className={`${CARD} space-y-3`} aria-label="Exams being built">
        <h2 className="text-lg font-black text-slate-900 dark:text-white">Exams being built</h2>
        <p className={BODY}>Nobody can see an exam here until it has enough checked questions. It then goes on sale by itself after the night check, and the people who asked are told.</p>
        {exams.length
          ? <ul className="space-y-2">{exams.map(exam => <ExamBeingBuilt key={exam.key} exam={exam} onChanged={loadExams} onNotice={setNotice} />)}</ul>
          : <p className={BODY}>None yet. Open a request and press Build this exam.</p>}
      </section>
    </div>
  );
}
