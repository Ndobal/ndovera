import React, { useCallback, useEffect, useState } from 'react';
import { listSchoolChampionshipQuestions, submitChampionshipQuestion } from './services/championshipApi';
import { BODY, BTN_PRIMARY, BTN_SECONDARY, CARD, INPUT, LABEL, MUTED, PANEL } from './championshipUi';

// School question contributions (championship.md sections 13–14).
//
// A school submits questions into a moderated pool. Two things are made visible here that the
// spec cares about: the submission is checked before it is accepted (so a school is told
// immediately what is wrong rather than discovering it at moderation), and a question is
// clearly not usable until a human has approved it.

const STATUS_TONE = {
  submitted: 'bg-[#c9a96e] text-[#191970]',
  ai_screened: 'bg-[#191970] text-white',
  approved: 'bg-[#1a5c38] text-white',
  banked: 'bg-[#1a5c38] text-white',
  rejected: 'bg-[#800020] text-[#b5e3f4]',
};

const STATUS_LABEL = {
  submitted: 'Awaiting review',
  ai_screened: 'Awaiting moderation',
  approved: 'Approved',
  banked: 'In the question bank',
  rejected: 'Rejected',
};

const EMPTY_FORM = {
  type: 'objective',
  subject: '',
  classLevel: '',
  topic: '',
  prompt: '',
  options: ['', '', '', ''],
  answer: '',
  explanation: '',
  tags: [],
};

const TAG_LABEL = {
  competition_only: 'Competition only',
  school_assessment: 'School assessment',
  practice: 'Practice',
  revision: 'Revision',
  quiz: 'Quiz',
  championship: 'Championship',
  restricted: 'Restricted',
};

function QuestionForm({ onSubmitted, onError }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const setOption = (index, value) => setForm(current => ({
    ...current,
    options: current.options.map((option, position) => (position === index ? value : option)),
  }));

  function toggleTag(tag) {
    setForm(current => ({
      ...current,
      tags: current.tags.includes(tag) ? current.tags.filter(item => item !== tag) : [...current.tags, tag],
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    onError('');
    try {
      const payload = {
        ...form,
        options: form.type === 'objective' ? form.options.map(option => option.trim()).filter(Boolean) : [],
      };
      const result = await submitChampionshipQuestion(payload);
      setForm(EMPTY_FORM);
      onSubmitted(result);
    } catch (submitError) {
      onError(submitError.message || 'Could not submit that question.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={PANEL}>
      <p className={LABEL}>Contribute a question</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={LABEL}>Type</span>
          <select value={form.type} onChange={event => set('type', event.target.value)} className={INPUT}>
            <option value="objective">Objective (multiple choice)</option>
            <option value="theory">Theory (written answer)</option>
          </select>
        </label>
        <label className="block">
          <span className={LABEL}>Subject</span>
          <input value={form.subject} onChange={event => set('subject', event.target.value)} className={INPUT} placeholder="Mathematics" />
        </label>
        <label className="block">
          <span className={LABEL}>Class level</span>
          <input value={form.classLevel} onChange={event => set('classLevel', event.target.value)} className={INPUT} placeholder="JSS 2" />
        </label>
        <label className="block">
          <span className={LABEL}>Topic</span>
          <input value={form.topic} onChange={event => set('topic', event.target.value)} className={INPUT} placeholder="Fractions" />
        </label>
      </div>

      <label className="mt-3 block">
        <span className={LABEL}>Question</span>
        <textarea
          value={form.prompt}
          onChange={event => set('prompt', event.target.value)}
          rows={3}
          className={INPUT}
          placeholder="Write the question exactly as a student should see it."
          required
        />
      </label>

      {form.type === 'objective' ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {form.options.map((option, index) => (
            <label key={index} className="block">
              <span className={LABEL}>{`Option ${String.fromCharCode(65 + index)}`}</span>
              <input value={option} onChange={event => setOption(index, event.target.value)} className={INPUT} />
            </label>
          ))}
        </div>
      ) : null}

      <label className="mt-3 block">
        <span className={LABEL}>Answer</span>
        <input
          value={form.answer}
          onChange={event => set('answer', event.target.value)}
          className={INPUT}
          placeholder={form.type === 'objective' ? 'Must match one of the options exactly' : 'The expected answer'}
          required
        />
      </label>

      <label className="mt-3 block">
        <span className={LABEL}>Explanation (optional)</span>
        <textarea value={form.explanation} onChange={event => set('explanation', event.target.value)} rows={2} className={INPUT} />
      </label>

      <div className="mt-3">
        <span className={LABEL}>Usable for</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.keys(TAG_LABEL).map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                form.tags.includes(tag)
                  ? 'bg-[#800020] text-[#b5e3f4]'
                  : 'border border-[#c9a96e]/50 bg-white/70 text-[#191970] dark:border-white/15 dark:bg-slate-900/50 dark:text-slate-200'
              }`}
            >
              {TAG_LABEL[tag]}
            </button>
          ))}
        </div>
        <p className={`mt-2 ${MUTED}`}>
          Competition-only questions stay sealed until the competition they belong to has finished.
        </p>
      </div>

      <div className="mt-4">
        <button type="submit" className={BTN_PRIMARY} disabled={busy}>
          {busy ? 'Submitting…' : 'Submit question'}
        </button>
      </div>
    </form>
  );
}

export default function SchoolQuestionPool() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSchoolChampionshipQuestions();
      setSubmissions(Array.isArray(data?.submissions) ? data.submissions : []);
    } catch (loadError) {
      setSubmissions([]);
      setError(loadError.message || 'Could not load your submitted questions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function afterSubmit(result) {
    const verdict = result?.screening?.verdict;
    setNotice(
      verdict === 'flag'
        ? 'Question submitted. It has been marked for a closer human look before approval.'
        : 'Question submitted. It will appear in the bank once a moderator approves it.',
    );
    load();
  }

  return (
    <div className="space-y-4">
      {notice ? <p className="rounded-2xl border border-[#1a5c38]/40 bg-[#1a5c38]/10 px-4 py-3 text-sm font-semibold text-[#1a5c38] dark:text-emerald-200">{notice}</p> : null}
      {error ? <p className="rounded-2xl border border-[#800020]/40 bg-[#800020]/10 px-4 py-3 text-sm font-semibold text-[#800020] dark:text-rose-200">{error}</p> : null}

      <QuestionForm onSubmitted={afterSubmit} onError={setError} />

      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black text-[#191970] dark:text-slate-100">Questions this school has submitted</h2>
          <button type="button" onClick={load} className={BTN_SECONDARY}>Refresh</button>
        </div>

        {loading ? (
          <p className={`mt-3 ${MUTED}`}>Loading…</p>
        ) : submissions.length === 0 ? (
          <p className={`mt-3 ${BODY}`}>
            No questions submitted yet. Questions your school contributes are reviewed by NDOVERA and, once approved,
            join the question bank your teachers already use for exams and practice.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {submissions.map(submission => (
              <div key={submission.id} className="rounded-xl border border-[#c9a96e]/40 bg-white/70 px-4 py-3 dark:border-white/10 dark:bg-slate-900/50">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 font-bold text-[#191970] dark:text-slate-100">{submission.prompt}</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_TONE[submission.status] || STATUS_TONE.submitted}`}>
                    {STATUS_LABEL[submission.status] || submission.status}
                  </span>
                </div>
                <p className={`mt-1 ${MUTED}`}>
                  {[submission.subject, submission.classLevel, submission.topic, submission.difficulty].filter(Boolean).join(' • ') || 'Not classified yet'}
                </p>
                {submission.aiReport?.issues?.length ? (
                  <p className={`mt-2 ${MUTED}`}>
                    <span className="font-bold text-[#800020] dark:text-rose-300">Review notes:</span>{' '}
                    {submission.aiReport.issues.join('; ')}
                  </p>
                ) : null}
                {submission.moderatorNote ? (
                  <p className={`mt-1 ${MUTED}`}>
                    <span className="font-bold">Moderator:</span> {submission.moderatorNote}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
