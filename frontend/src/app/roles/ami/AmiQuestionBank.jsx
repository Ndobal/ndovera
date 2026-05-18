import React, { useCallback, useEffect, useState } from 'react';
import { getStoredAuth } from '../../../features/auth/services/authApi';
import { getApiBase } from '../../../config/apiBase';

const apiBase = getApiBase('');

const SURFACE = 'rounded-[2rem] border border-[#c9a96e]/40 bg-[#f5deb3] dark:bg-[#800000]/30 p-5 shadow-sm';
const SUB_SURFACE = 'rounded-2xl border border-[#c9a96e]/30 bg-[#f0d090] dark:bg-[#800000]/20 p-4';
const LABEL = 'text-xs font-semibold uppercase tracking-[0.15em] text-[#800020] dark:text-[#bf00ff]';
const TITLE = 'text-xl font-bold text-[#800000] dark:text-[#0000ff]';
const BODY = 'text-sm text-[#191970] dark:text-[#39ff14]';
const INPUT = 'mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#f5deb3] dark:bg-slate-900 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none focus:border-[#800020]';
const PRIMARY_BUTTON = 'bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-5 py-2 rounded-2xl text-sm transition-colors disabled:opacity-60 dark:bg-[#00ffff] dark:text-black dark:hover:bg-[#00e5e5]';
const DANGER_BUTTON = 'bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition-colors';

const QUESTION_TYPES = [
  { value: 'mcq', label: 'Multiple Choice (MCQ)' },
  { value: 'true_false', label: 'True / False' },
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'essay', label: 'Essay' },
  { value: 'fill_blank', label: 'Fill in the Blank' },
];

const SUBJECT_LEVELS = [
  'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6',
  'JSS 1', 'JSS 2', 'JSS 3', 'SS 1', 'SS 2', 'SS 3',
];

async function apiFetch(path, options = {}) {
  const auth = getStoredAuth();
  const res = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}), ...(options.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

const EMPTY_FORM = { subject: '', classLevel: '', type: 'mcq', prompt: '', options: ['', '', '', ''], answer: '', explanation: '', imageUrl: '' };

export default function AmiQuestionBank() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showForm, setShowForm] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterSubject) params.set('subject', filterSubject);
    if (filterLevel) params.set('classLevel', filterLevel);
    if (filterType) params.set('type', filterType);
    const data = await apiFetch(`/api/question-bank?${params.toString()}`);
    setQuestions(data.questions || []);
    setLoading(false);
  }, [filterLevel, filterSubject, filterType]);

  useEffect(() => { reload().catch(() => setLoading(false)); }, [reload]);

  async function handleSave(e) {
    e.preventDefault(); setSaving(true); setSaveMsg('');
    try {
      const payload = {
        subject: form.subject,
        classLevel: form.classLevel || null,
        type: form.type,
        prompt: form.prompt,
        options: ['mcq', 'true_false'].includes(form.type) ? form.options.filter(Boolean) : null,
        answer: form.answer || null,
        explanation: form.explanation || null,
        imageUrl: form.imageUrl || null,
      };
      await apiFetch('/api/question-bank', { method: 'POST', body: JSON.stringify(payload) });
      setSaveMsg('Question saved!');
      setForm(EMPTY_FORM);
      setShowForm(false);
      await reload();
    } catch (err) { setSaveMsg(err.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this question?')) return;
    try { await apiFetch(`/api/question-bank/${id}`, { method: 'DELETE' }); await reload(); }
    catch (err) { alert(err.message); }
  }

  return (
    <div className="space-y-5 px-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={TITLE}>Question Bank</h2>
          <p className={`${BODY} mt-1`}>Manage default questions available to all teachers and students.</p>
        </div>
        <button type="button" onClick={() => { setShowForm(v => !v); setSaveMsg(''); }} className={PRIMARY_BUTTON}>
          {showForm ? 'Cancel' : '+ Add Question'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className={SURFACE + ' space-y-3'}>
          <p className={`${LABEL} mb-1`}>New Question</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={LABEL}>Subject *</label>
              <input required value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className={INPUT} placeholder="e.g. Mathematics" />
            </div>
            <div>
              <label className={LABEL}>Class Level</label>
              <select value={form.classLevel} onChange={e => setForm(f => ({ ...f, classLevel: e.target.value }))} className={INPUT}>
                <option value="">— All levels —</option>
                {SUBJECT_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Question Type *</label>
              <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value, options: ['', '', '', ''] }))} className={INPUT}>
                {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={LABEL}>Question Prompt *</label>
            <textarea required value={form.prompt} onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))} rows={3} className={INPUT} placeholder="Type the question here..." />
          </div>

          {form.type === 'mcq' && (
            <div>
              <label className={LABEL}>Options (one per line)</label>
              {form.options.map((opt, i) => (
                <input key={i} value={opt} onChange={e => { const o = [...form.options]; o[i] = e.target.value; setForm(f => ({ ...f, options: o })); }}
                  className={INPUT + ' mb-1'} placeholder={`Option ${String.fromCharCode(65 + i)}`} />
              ))}
            </div>
          )}

          {form.type === 'true_false' && (
            <div>
              <label className={LABEL}>Correct Answer</label>
              <select value={form.answer} onChange={e => setForm(f => ({ ...f, answer: e.target.value }))} className={INPUT}>
                <option value="">— Select —</option>
                <option value="True">True</option>
                <option value="False">False</option>
              </select>
            </div>
          )}

          {!['true_false'].includes(form.type) && (
            <div>
              <label className={LABEL}>Correct Answer / Model Answer</label>
              <input value={form.answer} onChange={e => setForm(f => ({ ...f, answer: e.target.value }))} className={INPUT} placeholder="Correct answer or expected response" />
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Explanation (optional)</label>
              <textarea value={form.explanation} onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))} rows={2} className={INPUT} placeholder="Why is this the correct answer?" />
            </div>
            <div>
              <label className={LABEL}>Image URL (optional)</label>
              <input value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} className={INPUT} placeholder="https://..." />
              {form.imageUrl && (
                <img src={form.imageUrl} alt="preview" className="mt-2 max-h-40 rounded-xl object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
              )}
            </div>
          </div>

          {saveMsg && <p className={`text-sm font-semibold ${saveMsg.includes('saved') ? 'text-[#1a5c38]' : 'text-red-600'}`}>{saveMsg}</p>}
          <button type="submit" disabled={saving} className={PRIMARY_BUTTON}>{saving ? 'Saving...' : 'Save Question'}</button>
        </form>
      )}

      {/* Filters */}
      <div className={SUB_SURFACE + ' flex flex-wrap gap-3 items-end'}>
        <div>
          <label className={LABEL}>Filter by Subject</label>
          <input value={filterSubject} onChange={e => setFilterSubject(e.target.value)} className={INPUT + ' w-40'} placeholder="Any" />
        </div>
        <div>
          <label className={LABEL}>Class Level</label>
          <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} className={INPUT + ' w-36'}>
            <option value="">All</option>
            {SUBJECT_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL}>Type</label>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className={INPUT + ' w-40'}>
            <option value="">All</option>
            {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <p className={`${BODY} self-end`}>{loading ? 'Loading...' : `${questions.length} question(s)`}</p>
      </div>

      {/* Question list */}
      <div className="space-y-3">
        {!loading && questions.length === 0 && (
          <div className={SUB_SURFACE}>
            <p className={BODY}>No questions found. Click "+ Add Question" to add the first one.</p>
          </div>
        )}
        {questions.map((q, idx) => (
          <div key={q.id} className={SUB_SURFACE}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex flex-wrap gap-2 mb-1">
                  <span className="rounded-full bg-[#800020] px-2 py-0.5 text-[10px] font-bold uppercase text-[#f5deb3] dark:bg-[#bf00ff]">{q.subject}</span>
                  {q.classLevel && <span className="rounded-full bg-[#191970] px-2 py-0.5 text-[10px] font-bold uppercase text-[#f5deb3] dark:bg-[#0000ff]">{q.classLevel}</span>}
                  <span className="rounded-full bg-[#1a5c38] px-2 py-0.5 text-[10px] font-bold uppercase text-[#f5deb3] dark:bg-[#00ffff] dark:text-black">{QUESTION_TYPES.find(t => t.value === q.type)?.label || q.type}</span>
                </div>
                <p className="font-semibold text-[#800000] dark:text-[#ffffff] text-sm">{idx + 1}. {q.prompt}</p>
                {q.imageUrl && <img src={q.imageUrl} alt="question" className="mt-2 max-h-32 rounded-xl object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                {q.options && Array.isArray(q.options) && (
                  <ul className="mt-1 space-y-0.5">
                    {q.options.map((opt, oi) => (
                      <li key={oi} className={`text-xs ${opt === q.answer ? 'font-bold text-[#1a5c38] dark:text-[#39ff14]' : 'text-[#191970] dark:text-slate-300'}`}>
                        {String.fromCharCode(65 + oi)}. {opt}{opt === q.answer ? ' ✓' : ''}
                      </li>
                    ))}
                  </ul>
                )}
                {q.answer && !Array.isArray(q.options) && (
                  <p className="mt-1 text-xs font-semibold text-[#1a5c38] dark:text-[#39ff14]">Answer: {q.answer}</p>
                )}
                {q.explanation && <p className="mt-1 text-xs italic text-[#800020] dark:text-[#bf00ff]">Explanation: {q.explanation}</p>}
              </div>
              <button type="button" onClick={() => handleDelete(q.id)} className={DANGER_BUTTON}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
