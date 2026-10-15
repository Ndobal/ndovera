import React, { useCallback, useEffect, useState } from 'react';
import RichContent from '../../shared/rich/RichContent';
import ReadAloud from '../../shared/components/ReadAloud';
import { getAssignedClasses } from '../classroom/classroomService';
import {
  CATEGORY_STYLES, POST_TYPES, addMembers, createClub, createPost, findPeople, getClub, listClubs, listWork, markWork, removeMember,
  setLeader, submitWork, updateClub, uploadClubFile, withdrawPost,
} from './clubsApi';
import { askConfirm } from '../../shared/components/AppDialog';

// Clubs: extracurricular activities for students and staff. Patrons (teachers) run a
// club — members, notes, videos, images, documents, links, announcements, assignments
// and quizzes; students read and watch (notes offline too), hand in work and take
// quizzes. The Owner and Head of School see and can run every club.

const CARD = 'rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/70';
const FIELD = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/20 dark:bg-slate-900 dark:text-slate-100';
const LABEL = 'block text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400';
const PRIMARY = 'rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-50';
const SECONDARY = 'rounded-2xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/20 dark:text-slate-200 dark:hover:bg-white/5';
const DANGER = 'text-xs font-bold text-rose-700 underline dark:text-rose-300';

const when = value => (value ? new Date(value).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const ROLE_LABEL = { patron: 'Patron', leader: 'Club leader', member: 'Member', manager: 'School leadership' };

function Notice({ notice, onClose }) {
  if (!notice?.text) return null;
  return (
    <div role={notice.tone === 'error' ? 'alert' : 'status'} className={`flex items-start justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-semibold ${notice.tone === 'error' ? 'bg-rose-50 text-rose-800 dark:bg-rose-500/15 dark:text-rose-100' : 'bg-emerald-50 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-100'}`}>
      <span>{notice.text}</span>{onClose ? <button type="button" onClick={onClose} aria-label="Dismiss">✕</button> : null}
    </div>
  );
}

/** Upload one or more files; calls onAdd with each uploaded file. */
function FilePicker({ clubId, accept, multiple = true, label = 'Attach files', onAdd, onError }) {
  const [busy, setBusy] = useState(false);
  return (
    <label className={`${SECONDARY} inline-flex cursor-pointer items-center gap-2`}>
      {busy ? 'Uploading…' : `📎 ${label}`}
      <input type="file" className="sr-only" accept={accept} multiple={multiple} disabled={busy} onChange={async event => {
        const files = [...(event.target.files || [])];
        event.target.value = '';
        if (!files.length) return;
        setBusy(true);
        try { for (const file of files) onAdd(await uploadClubFile(clubId, file)); } catch (err) { onError?.(err.message); } finally { setBusy(false); }
      }} />
    </label>
  );
}

function FileList({ files, onRemove }) {
  if (!files?.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {files.map((file, index) => (
        <li key={`${file.url}-${index}`} className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200">
          <a href={file.url} target="_blank" rel="noopener noreferrer" className="underline">{file.name}</a>
          {onRemove ? <button type="button" onClick={() => onRemove(index)} aria-label={`Remove ${file.name}`}>✕</button> : null}
        </li>
      ))}
    </ul>
  );
}

// ─── Writing a post ──────────────────────────────────────────────────────────

const blankQuestion = () => ({ id: `q${Math.random().toString(36).slice(2, 9)}`, type: 'mcq', prompt: '', options: ['', '', '', ''], answer: 0, marks: 1 });

function QuizBuilder({ questions, onChange }) {
  const set = (index, patch) => onChange(questions.map((question, i) => (i === index ? { ...question, ...patch } : question)));
  return (
    <div className="space-y-3">
      {questions.map((question, index) => (
        <fieldset key={question.id} className="space-y-2 rounded-2xl border border-slate-200 p-3 dark:border-white/10">
          <legend className="px-1 text-xs font-black text-slate-500">Question {index + 1}</legend>
          <div className="flex flex-wrap gap-2">
            <select aria-label={`Question ${index + 1} type`} className={`${FIELD} w-auto`} value={question.type} onChange={event => set(index, { type: event.target.value, answer: event.target.value === 'short' ? '' : 0 })}>
              <option value="mcq">Multiple choice</option><option value="truefalse">True / False</option><option value="short">Short answer</option>
            </select>
            <label className="flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300">Marks
              <input type="number" min="1" max="20" className={`${FIELD} w-20`} value={question.marks} onChange={event => set(index, { marks: event.target.value })} />
            </label>
            <button type="button" className={`${DANGER} ml-auto`} onClick={() => onChange(questions.filter((_, i) => i !== index))}>Remove</button>
          </div>
          <textarea aria-label={`Question ${index + 1}`} rows={2} className={FIELD} placeholder="The question" value={question.prompt} onChange={event => set(index, { prompt: event.target.value })} />
          {question.type === 'mcq' && (
            <div className="space-y-1">
              {question.options.map((option, optionIndex) => (
                <div key={optionIndex} className="flex items-center gap-2">
                  <input type="radio" name={`answer-${question.id}`} aria-label={`Option ${optionIndex + 1} is correct`} checked={Number(question.answer) === optionIndex} onChange={() => set(index, { answer: optionIndex })} />
                  <input className={FIELD} placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`} value={option} onChange={event => set(index, { options: question.options.map((value, i) => (i === optionIndex ? event.target.value : value)) })} />
                </div>
              ))}
              {question.options.length < 6 && <button type="button" className="text-xs font-bold text-indigo-700 underline dark:text-indigo-300" onClick={() => set(index, { options: [...question.options, ''] })}>+ Option</button>}
              <p className="text-xs text-slate-500">Tick the correct option.</p>
            </div>
          )}
          {question.type === 'truefalse' && (
            <div className="flex gap-4 text-sm">
              {['True', 'False'].map((label, optionIndex) => <label key={label} className="flex items-center gap-1"><input type="radio" name={`answer-${question.id}`} checked={Number(question.answer) === optionIndex} onChange={() => set(index, { answer: optionIndex })} /> {label} is correct</label>)}
            </div>
          )}
          {question.type === 'short' && <input className={FIELD} placeholder="Accepted answers, separated by | (e.g. Abuja | Abuja city)" value={question.answer} onChange={event => set(index, { answer: event.target.value })} />}
        </fieldset>
      ))}
      <button type="button" className={SECONDARY} onClick={() => onChange([...questions, blankQuestion()])}>+ Add question</button>
    </div>
  );
}

function Composer({ clubId, onPosted, onNotice }) {
  const [kind, setKind] = useState('');
  const [form, setForm] = useState({ title: '', body: '', url: '', files: [], dueAt: '', maxScore: 10 });
  const [questions, setQuestions] = useState([blankQuestion()]);
  const [busy, setBusy] = useState(false);
  const reset = () => { setKind(''); setForm({ title: '', body: '', url: '', files: [], dueAt: '', maxScore: 10 }); setQuestions([blankQuestion()]); };
  const set = patch => setForm(current => ({ ...current, ...patch }));
  const accept = kind === 'video' ? 'video/*' : kind === 'image' ? 'image/*' : undefined;

  async function post() {
    setBusy(true);
    try {
      const payload = { kind, ...form, files: form.files, ...(kind === 'quiz' ? { questions: questions.map(question => ({ ...question, options: question.options.filter(Boolean) })) } : {}) };
      const result = await createPost(clubId, payload);
      onPosted(result.post);
      reset();
    } catch (err) { onNotice({ text: err.message, tone: 'error' }); } finally { setBusy(false); }
  }

  if (!kind) {
    return (
      <section className={CARD} aria-label="Share with the club">
        <p className="mb-3 font-black text-slate-900 dark:text-white">Share with the club</p>
        <div className="flex flex-wrap gap-2">
          {POST_TYPES.map(([value, label]) => <button key={value} type="button" className={SECONDARY} onClick={() => setKind(value)}>{label}</button>)}
        </div>
      </section>
    );
  }
  const typeLabel = POST_TYPES.find(([value]) => value === kind)?.[1] || kind;
  return (
    <section className={`${CARD} space-y-3`} aria-label={`New ${kind}`}>
      <div className="flex items-center gap-2"><h3 className="flex-1 text-lg font-black text-slate-900 dark:text-white">{typeLabel}</h3><button type="button" className={SECONDARY} onClick={reset}>Cancel</button></div>
      <label className={LABEL}>Title<input className={`${FIELD} mt-1`} value={form.title} onChange={event => set({ title: event.target.value })} /></label>
      {['note', 'announcement', 'assignment', 'quiz', 'video', 'image', 'document', 'link'].includes(kind) && (
        <label className={LABEL}>{kind === 'note' ? 'The note (headings with #, lists with -, **bold**; tables and maths work as in class notes)' : kind === 'assignment' ? 'What to do' : kind === 'quiz' ? 'Instructions (optional)' : 'Description (optional)'}
          <textarea rows={kind === 'note' ? 12 : 4} className={`${FIELD} mt-1 font-mono`} value={form.body} onChange={event => set({ body: event.target.value })} />
        </label>
      )}
      {kind === 'note' && form.body.trim() && (
        <details className="rounded-2xl bg-slate-50 p-3 dark:bg-white/5"><summary className="cursor-pointer text-sm font-bold">Preview</summary><div className="prose mt-2 max-w-none dark:prose-invert"><RichContent text={form.body} /></div></details>
      )}
      {['video', 'link'].includes(kind) && <label className={LABEL}>{kind === 'video' ? 'Video link (YouTube or any https link) — or upload below' : 'Link (https://…)'}<input className={`${FIELD} mt-1`} value={form.url} onChange={event => set({ url: event.target.value })} placeholder="https://" /></label>}
      {['note', 'video', 'image', 'document', 'assignment', 'announcement'].includes(kind) && (
        <div className="space-y-2">
          <FilePicker clubId={clubId} accept={accept} label={kind === 'video' ? 'Upload a video (up to 200 MB)' : kind === 'image' ? 'Upload images' : 'Attach files'} onAdd={file => set({ files: [...form.files, file] })} onError={text => onNotice({ text, tone: 'error' })} />
          <FileList files={form.files} onRemove={index => set({ files: form.files.filter((_, i) => i !== index) })} />
        </div>
      )}
      {['assignment', 'quiz'].includes(kind) && (
        <div className="flex flex-wrap gap-3">
          <label className={LABEL}>Due (optional)<input type="date" className={`${FIELD} mt-1`} value={form.dueAt} onChange={event => set({ dueAt: event.target.value })} /></label>
          {kind === 'assignment' && <label className={LABEL}>Marked out of<input type="number" min="1" className={`${FIELD} mt-1 w-28`} value={form.maxScore} onChange={event => set({ maxScore: event.target.value })} /></label>}
        </div>
      )}
      {kind === 'quiz' && <QuizBuilder questions={questions} onChange={setQuestions} />}
      <button type="button" className={PRIMARY} disabled={busy || !form.title.trim()} onClick={post}>{busy ? 'Posting…' : 'Post to the club'}</button>
    </section>
  );
}

// ─── Reading a post ──────────────────────────────────────────────────────────

function NoteBody({ post }) {
  const ref = React.useRef(null);
  return (
    <div className="space-y-3">
      <ReadAloud key={post.id} label="Read aloud" targetRef={ref} title={post.title} sourceId={`club-post:${post.id}`} />
      <div ref={ref} className="prose max-w-none dark:prose-invert"><RichContent text={post.body} /></div>
    </div>
  );
}

function Media({ post }) {
  const videos = post.files.filter(file => /^video\//.test(file.type) || /\.(mp4|webm|mov|m4v)$/i.test(file.name));
  const images = post.files.filter(file => /^image\//.test(file.type) || /\.(png|jpe?g|gif|webp)$/i.test(file.name));
  const others = post.files.filter(file => !videos.includes(file) && !images.includes(file));
  return (
    <div className="space-y-3">
      {post.kind === 'video' && post.embedUrl && (
        <div className="aspect-video overflow-hidden rounded-2xl bg-black"><iframe title={post.title} src={post.embedUrl} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" allowFullScreen /></div>
      )}
      {post.kind === 'video' && post.url && !post.embedUrl && <a href={post.url} target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-700 underline dark:text-indigo-300">▶ Watch the video</a>}
      {videos.map(file => <video key={file.url} controls preload="metadata" className="w-full rounded-2xl bg-black" src={file.url}><track kind="captions" /></video>)}
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map(file => <a key={file.url} href={file.url} target="_blank" rel="noopener noreferrer"><img src={file.url} alt={file.name} loading="lazy" className="h-40 w-full rounded-2xl object-cover" /></a>)}
        </div>
      )}
      {post.kind === 'link' && post.url && <a href={post.url} target="_blank" rel="noopener noreferrer" className="break-all font-bold text-indigo-700 underline dark:text-indigo-300">🔗 {post.url}</a>}
      <FileList files={others} />
    </div>
  );
}

function QuizTaker({ clubId, post, mine, onDone, onNotice }) {
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  if (mine) {
    const byId = new Map((mine.review || []).map(item => [item.questionId, item]));
    return (
      <div className="space-y-3">
        <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-lg font-black text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-100">You scored {mine.score} / {mine.total}</p>
        <ol className="space-y-2">
          {post.questions.map((question, index) => {
            const review = byId.get(question.id);
            const show = value => (question.type === 'short' ? String(value ?? '—') : (question.options[Number(value)] ?? '—'));
            return (
              <li key={question.id} className={`rounded-2xl p-3 text-sm ${review?.correct ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-rose-50 dark:bg-rose-500/10'}`}>
                <p className="font-bold">{index + 1}. {question.prompt}</p>
                <p>Your answer: {show(review?.given)} {review?.correct ? '✓' : '✗'}</p>
                {!review?.correct && <p>Correct answer: {question.type === 'short' ? String(review?.answer || '').split('|')[0] : question.options[Number(review?.answer)]}</p>}
              </li>
            );
          })}
        </ol>
      </div>
    );
  }
  return (
    <form className="space-y-3" onSubmit={async event => {
      event.preventDefault();
      if (!await askConfirm('Hand in your answers? You can take this quiz once.')) return;
      setBusy(true);
      try { const result = await submitWork(clubId, post.id, { answers }); onDone(result.submission); } catch (err) { onNotice({ text: err.message, tone: 'error' }); } finally { setBusy(false); }
    }}>
      <ol className="space-y-3">
        {post.questions.map((question, index) => (
          <li key={question.id} className="rounded-2xl bg-slate-50 p-3 dark:bg-white/5">
            <p className="mb-2 text-sm font-bold text-slate-900 dark:text-white">{index + 1}. {question.prompt} <span className="text-xs font-semibold text-slate-500">({question.marks} mark{question.marks === 1 ? '' : 's'})</span></p>
            {question.type === 'short'
              ? <input aria-label={`Answer to question ${index + 1}`} className={FIELD} value={answers[question.id] || ''} onChange={event => setAnswers(current => ({ ...current, [question.id]: event.target.value }))} />
              : (
                <div className="space-y-1">
                  {question.options.map((option, optionIndex) => (
                    <label key={optionIndex} className="flex items-center gap-2 text-sm"><input type="radio" name={`take-${post.id}-${question.id}`} checked={answers[question.id] === optionIndex} onChange={() => setAnswers(current => ({ ...current, [question.id]: optionIndex }))} /> {option}</label>
                  ))}
                </div>
              )}
          </li>
        ))}
      </ol>
      <button type="submit" className={PRIMARY} disabled={busy}>{busy ? 'Handing in…' : 'Hand in'}</button>
    </form>
  );
}

function AssignmentHandIn({ clubId, post, mine, onDone, onNotice }) {
  const [text, setText] = useState(mine?.answerText || '');
  const [files, setFiles] = useState(mine?.files || []);
  const [busy, setBusy] = useState(false);
  if (mine?.markedAt) {
    return (
      <div className="space-y-2 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-950 dark:bg-emerald-500/15 dark:text-emerald-50">
        <p className="text-lg font-black">Marked: {mine.score} / {mine.total}</p>
        {mine.feedback ? <p><strong>Feedback:</strong> {mine.feedback}</p> : null}
        {mine.answerText ? <p className="whitespace-pre-wrap opacity-80">{mine.answerText}</p> : null}
        <FileList files={mine.files} />
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {mine && <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Handed in {when(mine.submittedAt)} — you can change it until it is marked.</p>}
      <textarea aria-label="Your answer" rows={6} className={FIELD} placeholder="Write your answer here…" value={text} onChange={event => setText(event.target.value)} />
      <FilePicker clubId={clubId} label="Attach your work" onAdd={file => setFiles(current => [...current, file])} onError={message => onNotice({ text: message, tone: 'error' })} />
      <FileList files={files} onRemove={index => setFiles(current => current.filter((_, i) => i !== index))} />
      <button type="button" className={PRIMARY} disabled={busy || (!text.trim() && !files.length)} onClick={async () => {
        setBusy(true);
        try { const result = await submitWork(clubId, post.id, { answerText: text, files }); onDone(result.submission); } catch (err) { onNotice({ text: err.message, tone: 'error' }); } finally { setBusy(false); }
      }}>{busy ? 'Handing in…' : mine ? 'Update my work' : 'Hand in'}</button>
    </div>
  );
}

function WorkReview({ clubId, post, onNotice }) {
  const [data, setData] = useState(null);
  const [marks, setMarks] = useState({});
  const load = useCallback(() => listWork(clubId, post.id).then(setData).catch(err => onNotice({ text: err.message, tone: 'error' })), [clubId, post.id, onNotice]);
  useEffect(() => { load(); }, [load]);
  if (!data) return <p role="status" className="text-sm">Loading work…</p>;
  return (
    <div className="space-y-3">
      {data.notHandedIn.length > 0 && <p className="text-sm text-slate-600 dark:text-slate-300"><strong>Not handed in:</strong> {data.notHandedIn.join(', ')}</p>}
      {!data.submissions.length ? <p className="text-sm">Nobody has handed in yet.</p> : (
        <ul className="space-y-2">
          {data.submissions.map(item => (
            <li key={item.id} className="space-y-2 rounded-2xl bg-slate-50 p-3 text-sm dark:bg-white/5">
              <p className="font-bold text-slate-900 dark:text-white">{item.studentName} <span className="text-xs font-semibold text-slate-500">· {when(item.submittedAt)}</span></p>
              {post.kind === 'quiz' ? <p className="font-black">{item.score} / {item.total}</p> : (
                <>
                  {item.answerText ? <p className="whitespace-pre-wrap">{item.answerText}</p> : null}
                  <FileList files={item.files} />
                  <div className="flex flex-wrap items-end gap-2">
                    <label className={LABEL}>Score / {post.maxScore}<input type="number" min="0" max={post.maxScore} className={`${FIELD} mt-1 w-24`} value={marks[item.id]?.score ?? item.score ?? ''} onChange={event => setMarks(current => ({ ...current, [item.id]: { ...current[item.id], score: event.target.value } }))} /></label>
                    <label className={`${LABEL} flex-1`}>Feedback<input className={`${FIELD} mt-1`} value={marks[item.id]?.feedback ?? item.feedback ?? ''} onChange={event => setMarks(current => ({ ...current, [item.id]: { ...current[item.id], feedback: event.target.value } }))} /></label>
                    <button type="button" className={PRIMARY} onClick={async () => {
                      try {
                        await markWork(clubId, item.id, { score: Number(marks[item.id]?.score ?? item.score), feedback: marks[item.id]?.feedback ?? item.feedback });
                        onNotice({ text: `Marked ${item.studentName}.`, tone: 'ok' });
                        load();
                      } catch (err) { onNotice({ text: err.message, tone: 'error' }); }
                    }}>{item.markedAt ? 'Update mark' : 'Save mark'}</button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PostCard({ clubId, post, page, onWithdraw, onWork, onNotice }) {
  const [open, setOpen] = useState(['note', 'announcement'].includes(post.kind) && post.body.length < 1500);
  const [reviewing, setReviewing] = useState(false);
  const isWork = ['assignment', 'quiz'].includes(post.kind);
  const typeLabel = POST_TYPES.find(([value]) => value === post.kind)?.[1] || post.kind;
  const mine = !page.canManage ? page.work[post.id] : null;
  const summary = page.canManage ? page.work[post.id] : null;
  return (
    <article className={`${CARD} ${post.kind === 'announcement' ? 'border-amber-300 bg-amber-50/60 dark:border-amber-400/30 dark:bg-amber-400/5' : ''}`}>
      <header className="mb-2 flex flex-wrap items-start gap-2">
        <div className="flex-1">
          <p className="text-xs font-black uppercase tracking-wide text-indigo-600 dark:text-cyan-300">{typeLabel}</p>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">{post.title}</h3>
          <p className="text-xs text-slate-500">{post.createdByName} · {when(post.createdAt)}{post.dueAt ? ` · due ${new Date(post.dueAt).toLocaleDateString()}` : ''}{post.maxScore ? ` · out of ${post.maxScore}` : ''}</p>
        </div>
        {isWork && !page.canManage && <span className={`rounded-full px-3 py-1 text-xs font-black ${mine ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>{mine ? (mine.score !== null ? `${mine.score} / ${mine.total}` : 'Handed in') : 'To do'}</span>}
        {isWork && page.canManage && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{summary?.handedIn || 0} handed in{summary?.unmarked ? ` · ${summary.unmarked} to mark` : ''}</span>}
        {page.canManage && <button type="button" className={DANGER} onClick={() => onWithdraw(post)}>Remove</button>}
      </header>
      {post.kind === 'note' ? (open ? <NoteBody post={post} /> : <button type="button" className={SECONDARY} onClick={() => setOpen(true)}>Open the note</button>)
        : post.body ? <div className="prose mb-3 max-w-none dark:prose-invert"><RichContent text={post.body} /></div> : null}
      {post.kind === 'note' && open ? <div className="mt-3"><FileList files={post.files} /></div> : null}
      {['video', 'image', 'document', 'link', 'announcement', 'assignment'].includes(post.kind) && <Media post={post} />}
      {isWork && !page.canManage && (
        <div className="mt-3">
          {post.kind === 'quiz'
            ? (mine || open ? <QuizTaker clubId={clubId} post={post} mine={mine} onDone={submission => onWork(post.id, submission)} onNotice={onNotice} /> : <button type="button" className={PRIMARY} onClick={() => setOpen(true)}>Take the quiz ({post.questions.length} question{post.questions.length === 1 ? '' : 's'})</button>)
            : <AssignmentHandIn clubId={clubId} post={post} mine={mine} onDone={submission => onWork(post.id, submission)} onNotice={onNotice} />}
        </div>
      )}
      {isWork && page.canManage && (
        <div className="mt-3">
          {post.kind === 'quiz' && <details className="mb-2 text-sm"><summary className="cursor-pointer font-bold">Questions and answers</summary><ol className="mt-2 list-decimal space-y-1 pl-5">{post.questions.map(question => <li key={question.id}>{question.prompt} — <strong>{question.type === 'short' ? question.answer : question.options[Number(question.answer)]}</strong></li>)}</ol></details>}
          {reviewing ? <WorkReview clubId={clubId} post={post} onNotice={onNotice} /> : <button type="button" className={SECONDARY} onClick={() => setReviewing(true)}>{post.kind === 'quiz' ? 'See scores' : 'See and mark work'}</button>}
        </div>
      )}
    </article>
  );
}

// ─── Members ─────────────────────────────────────────────────────────────────

function Members({ clubId, page, onChanged, onNotice }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  useEffect(() => { if (page.canManage) getAssignedClasses().then(data => setClasses(data?.classes || [])).catch(() => setClasses([])); }, [page.canManage]);
  useEffect(() => {
    if (!page.canManage || q.trim().length < 2) { setFound([]); return undefined; }
    const timer = setTimeout(() => findPeople(clubId, { q }).then(data => setFound(data.people || [])).catch(() => setFound([])), 300);
    return () => clearTimeout(timer);
  }, [clubId, q, page.canManage]);
  const run = async (action, message) => { try { const result = await action(); onChanged(result.members); if (message) onNotice({ text: message, tone: 'ok' }); } catch (err) { onNotice({ text: err.message, tone: 'error' }); } };
  return (
    <div className="space-y-4">
      {page.canManage && (
        <section className={`${CARD} space-y-3`} aria-label="Add members">
          <p className="font-black text-slate-900 dark:text-white">Add members</p>
          <input aria-label="Find a student or staff member" className={FIELD} placeholder="Type a name — students join as members, staff as patrons" value={q} onChange={event => setQ(event.target.value)} />
          {found.length > 0 && (
            <ul className="space-y-1">
              {found.map(person => (
                <li key={person.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-white/5">
                  <span className="flex-1">{person.name} <span className="text-xs text-slate-500">· {person.role === 'student' ? `Student${person.className ? `, ${person.className}` : ''}` : 'Staff'}</span></span>
                  {person.inClub ? <span className="text-xs font-bold text-emerald-700">In the club</span> : <button type="button" className={PRIMARY} onClick={() => run(() => addMembers(clubId, [person]), `${person.name} added.`)}>Add</button>}
                </li>
              ))}
            </ul>
          )}
          {classes.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <select aria-label="Add a whole class" className={`${FIELD} w-auto`} value={classId} onChange={event => setClassId(event.target.value)}>
                <option value="">Add a whole class…</option>
                {classes.map(item => <option key={item.id} value={item.id}>{item.className || item.name}</option>)}
              </select>
              <button type="button" className={SECONDARY} disabled={!classId} onClick={async () => {
                const data = await findPeople(clubId, { classId }).catch(err => { onNotice({ text: err.message, tone: 'error' }); return null; });
                const people = (data?.people || []).filter(person => !person.inClub);
                if (!people.length) { onNotice({ text: 'Everyone in that class is already in the club (or the class has no students this session).', tone: 'ok' }); return; }
                if (await askConfirm(`Add ${people.length} student${people.length === 1 ? '' : 's'} to the club?`)) run(() => addMembers(clubId, people), `${people.length} student(s) added.`);
              }}>Add class</button>
            </div>
          )}
        </section>
      )}
      <section className={CARD} aria-label="Members">
        <p className="mb-2 font-black text-slate-900 dark:text-white">{page.members.length} in the club</p>
        <ul className="divide-y divide-slate-100 dark:divide-white/10">
          {page.members.map(member => (
            <li key={member.userId} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="flex-1 font-semibold text-slate-900 dark:text-white">{member.name}{member.className ? <span className="text-xs font-normal text-slate-500"> · {member.className}</span> : null}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${member.role === 'patron' ? 'bg-indigo-100 text-indigo-900' : member.role === 'leader' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'}`}>{ROLE_LABEL[member.role] || member.role}</span>
              {page.canManage && member.role !== 'patron' && <button type="button" className="text-xs font-bold text-indigo-700 underline dark:text-indigo-300" onClick={() => run(() => setLeader(clubId, member.userId, member.role !== 'leader'))}>{member.role === 'leader' ? 'Make member' : 'Make leader'}</button>}
              {page.canManage && <button type="button" className={DANGER} onClick={async () => { if (await askConfirm(`Remove ${member.name} from the club?`)) run(() => removeMember(clubId, member.userId), `${member.name} removed.`); }}>Remove</button>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ─── One club ────────────────────────────────────────────────────────────────

function ClubView({ clubId, isManager, onBack }) {
  const [page, setPage] = useState(null);
  const [tab, setTab] = useState('feed');
  const [notice, setNotice] = useState(null);
  const [editing, setEditing] = useState(false);
  const load = useCallback(() => getClub(clubId).then(setPage).catch(err => setNotice({ text: err.message, tone: 'error' })), [clubId]);
  useEffect(() => { load(); }, [load]);
  const onNotice = useCallback(value => setNotice(value), []);
  if (!page) return <div className="space-y-3"><button type="button" className={SECONDARY} onClick={onBack}>← All clubs</button>{notice ? <Notice notice={notice} /> : <p role="status">Loading the club…</p>}</div>;
  const work = page.posts.filter(post => ['assignment', 'quiz'].includes(post.kind));
  const feed = tab === 'work' ? work : page.posts;
  const gradient = CATEGORY_STYLES[page.club.category] || CATEGORY_STYLES.Other;
  return (
    <div className="space-y-4">
      <button type="button" className={SECONDARY} onClick={onBack}>← All clubs</button>
      <header className={`rounded-[2rem] bg-gradient-to-br ${gradient} p-6 text-white shadow-xl`}>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/75">{page.club.category}{page.club.status === 'closed' ? ' · Closed' : ''}</p>
        <h1 className="text-3xl font-black">{page.club.name}</h1>
        {page.club.description ? <p className="mt-1 max-w-3xl text-white/90">{page.club.description}</p> : null}
        <p className="mt-2 text-sm font-semibold text-white/85">{page.club.meeting ? `🗓️ ${page.club.meeting} · ` : ''}{page.members.length} member{page.members.length === 1 ? '' : 's'} · You: {ROLE_LABEL[page.myRole] || 'Member'}</p>
        {page.offline ? <p className="mt-2 inline-block rounded-full bg-amber-300 px-3 py-1 text-xs font-bold text-amber-950">📴 Offline — showing what was saved on this device</p> : null}
        {page.canManage && <button type="button" className="mt-3 rounded-2xl bg-white/20 px-3 py-1.5 text-sm font-bold hover:bg-white/30" onClick={() => setEditing(value => !value)}>{editing ? 'Close' : 'Edit club'}</button>}
      </header>
      <Notice notice={notice} onClose={() => setNotice(null)} />
      {editing && <ClubForm initial={page.club} isManager={isManager} onSaved={club => { setPage(current => ({ ...current, club })); setEditing(false); setNotice({ text: 'Club saved.', tone: 'ok' }); }} onCancel={() => setEditing(false)} clubId={clubId} />}
      <div className="flex gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-white/5" role="tablist" aria-label="Club">
        {[['feed', '📰 Feed'], ['work', `✍️ Assignments & quizzes${work.length ? ` (${work.length})` : ''}`], ['members', '👥 Members']].map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`flex-1 rounded-xl px-3 py-2 text-sm font-black ${tab === key ? 'bg-white text-indigo-700 shadow dark:bg-slate-800 dark:text-cyan-300' : 'text-slate-600 dark:text-slate-300'}`}>{label}</button>
        ))}
      </div>
      {tab === 'members' ? <Members clubId={clubId} page={page} onChanged={members => setPage(current => ({ ...current, members }))} onNotice={onNotice} /> : (
        <div className="space-y-4">
          {page.canManage && !page.offline && tab === 'feed' && <Composer clubId={clubId} onNotice={onNotice} onPosted={() => { setNotice({ text: 'Posted to the club.', tone: 'ok' }); load(); }} />}
          {!feed.length ? <p className={`${CARD} text-sm text-slate-600 dark:text-slate-300`}>{tab === 'work' ? 'No assignments or quizzes yet.' : page.canManage ? 'Nothing here yet — share a note, a video or a quiz above.' : 'Nothing here yet. Your patrons will share notes, videos and activities here.'}</p>
            : feed.map(post => (
              <PostCard key={post.id} clubId={clubId} post={post} page={page} onNotice={onNotice}
                onWork={(postId, submission) => setPage(current => ({ ...current, work: { ...current.work, [postId]: submission } }))}
                onWithdraw={async target => {
                  if (!await askConfirm(`Remove "${target.title}" from the club?`)) return;
                  try { await withdrawPost(clubId, target.id); load(); } catch (err) { setNotice({ text: err.message, tone: 'error' }); }
                }} />
            ))}
        </div>
      )}
    </div>
  );
}

function ClubForm({ initial, categories, isManager, onSaved, onCancel, clubId }) {
  const [form, setForm] = useState({ name: initial?.name || '', category: initial?.category || 'Other', meeting: initial?.meeting || '', description: initial?.description || '', status: initial?.status || 'active', joinAsPatron: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = patch => setForm(current => ({ ...current, ...patch }));
  const list = categories || Object.keys(CATEGORY_STYLES);
  return (
    <section className={`${CARD} space-y-3`} aria-label={clubId ? 'Edit club' : 'Start a club'}>
      <h2 className="text-lg font-black text-slate-900 dark:text-white">{clubId ? 'Edit club' : 'Start a club'}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={LABEL}>Name<input className={`${FIELD} mt-1`} value={form.name} onChange={event => set({ name: event.target.value })} placeholder="e.g. Press Club" /></label>
        <label className={LABEL}>Kind<select className={`${FIELD} mt-1`} value={form.category} onChange={event => set({ category: event.target.value })}>{list.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className={LABEL}>When it meets<input className={`${FIELD} mt-1`} value={form.meeting} onChange={event => set({ meeting: event.target.value })} placeholder="e.g. Wednesdays, 2–3pm, Room 4" /></label>
        {clubId && isManager && <label className={LABEL}>Status<select className={`${FIELD} mt-1`} value={form.status} onChange={event => set({ status: event.target.value })}><option value="active">Active</option><option value="closed">Closed</option></select></label>}
      </div>
      <label className={LABEL}>About the club<textarea rows={3} className={`${FIELD} mt-1`} value={form.description} onChange={event => set({ description: event.target.value })} /></label>
      {!clubId && isManager && <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"><input type="checkbox" checked={form.joinAsPatron} onChange={event => set({ joinAsPatron: event.target.checked })} /> I will also be a patron of this club</label>}
      {error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className={PRIMARY} disabled={busy || form.name.trim().length < 2} onClick={async () => {
          setBusy(true); setError('');
          try { const result = clubId ? await updateClub(clubId, form) : await createClub(form); onSaved(result.club); } catch (err) { setError(err.message); } finally { setBusy(false); }
        }}>{busy ? 'Saving…' : clubId ? 'Save' : 'Create club'}</button>
        <button type="button" className={SECONDARY} onClick={onCancel}>Cancel</button>
      </div>
    </section>
  );
}

// ─── All clubs ───────────────────────────────────────────────────────────────

export default function ClubsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(() => { try { return new URLSearchParams(window.location.search).get('club') || ''; } catch { return ''; } });
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => listClubs().then(result => { setData(result); setError(''); }).catch(err => setError(err.message)), []);
  useEffect(() => { load(); }, [load]);

  if (open) return <div className="mx-auto max-w-5xl p-4 md:p-8"><ClubView clubId={open} isManager={Boolean(data?.isManager)} onBack={() => { setOpen(''); load(); }} /></div>;
  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
      <section className="rounded-[2rem] bg-gradient-to-br from-indigo-700 via-violet-700 to-fuchsia-700 p-6 text-white shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/75">Extracurricular</p>
        <h1 className="text-3xl font-black">Clubs</h1>
        <p className="mt-1 max-w-2xl text-white/90">{data?.isManager ? 'Every club in the school: start one, name its patrons, and see what each club is doing.' : data?.canCreate ? 'The clubs you run or belong to. Start a club and you become its patron.' : 'Your clubs: notes, videos, activities, assignments and quizzes — notes stay readable offline.'}</p>
        {data?.canCreate && !creating && <button type="button" className="mt-4 rounded-2xl bg-white px-5 py-2.5 font-black text-indigo-700" onClick={() => setCreating(true)}>+ Start a club</button>}
        {data?.offline ? <p className="mt-3 inline-block rounded-full bg-amber-300 px-3 py-1 text-sm font-bold text-amber-950">📴 Offline — showing saved clubs</p> : null}
      </section>
      {error && <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</p>}
      {creating && <ClubForm categories={data?.categories} isManager={Boolean(data?.isManager)} onCancel={() => setCreating(false)} onSaved={club => { setCreating(false); setOpen(club.id); }} />}
      {!data && !error ? <p role="status">Loading clubs…</p> : null}
      {data && !data.clubs.length ? (
        <p className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-slate-600 dark:border-white/20 dark:text-slate-300">{data.canCreate ? 'No clubs yet. Start the first one.' : 'You are not in a club yet. Your teachers add students to clubs.'}</p>
      ) : null}
      {data?.clubs?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.clubs.map(club => (
            <button key={club.id} type="button" onClick={() => setOpen(club.id)} className="overflow-hidden rounded-3xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md dark:border-white/10 dark:bg-slate-900/70">
              <div className={`bg-gradient-to-br ${CATEGORY_STYLES[club.category] || CATEGORY_STYLES.Other} p-4 text-white`}>
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">{club.category}{club.status === 'closed' ? ' · Closed' : ''}</p>
                <h2 className="text-xl font-black">{club.name}</h2>
              </div>
              <div className="space-y-1 p-4 text-sm text-slate-600 dark:text-slate-300">
                {club.meeting ? <p>🗓️ {club.meeting}</p> : null}
                <p>👥 {club.members} member{club.members === 1 ? '' : 's'} · {club.patrons} patron{club.patrons === 1 ? '' : 's'}</p>
                <p>📰 {club.posts} post{club.posts === 1 ? '' : 's'}{club.lastPostAt ? ` · latest ${new Date(club.lastPostAt).toLocaleDateString()}` : ''}</p>
                {club.myRole ? <p className="font-bold text-indigo-700 dark:text-cyan-300">You: {ROLE_LABEL[club.myRole] || club.myRole}</p> : null}
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
