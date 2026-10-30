import React, { useCallback, useEffect, useState } from 'react';
import {
  dismissGrowthGap, draftGrowthAnswer, getGrowthCentre, getGrowthConversation,
  growthAnswerAction, growthConversationAction,
} from '../school/services/schoolApi';

// Growth Centre: the virtual consultants' conversations, the approved answers they use, the
// questions they could not answer, and how it is going. Ami sees Ndovera's; the Owner and Head
// of School see their school's admissions chat. The two never mix.

const CARD = 'rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const FIELD = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';
const LABEL = 'block text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300';
const PRIMARY = 'rounded-lg bg-[#191970] px-4 py-2 text-sm font-bold text-white disabled:opacity-50';
const SECONDARY = 'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-[#191970] disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white';
const MUTED = 'text-sm text-slate-700 dark:text-slate-300';
const STATUS = {
  open: ['With the consultant', 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100'],
  handover: ['Needs a person', 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100'],
  human: ['Staff replying', 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100'],
  closed: ['Closed', 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'],
  draft: ['Draft — not live', 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100'],
  approved: ['Approved — live', 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100'],
  retired: ['Retired', 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'],
};
const TABS = [['conversations', 'Conversations'], ['knowledge', 'Approved answers'], ['gaps', 'Unanswered questions'], ['stats', 'How it is going']];

function Chip({ status }) {
  const [label, className] = STATUS[status] || STATUS.open;
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${className}`}>{label}</span>;
}

function Conversation({ id, onChanged }) {
  const [data, setData] = useState(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(() => getGrowthConversation(id).then(setData).catch(err => setError(err.message)), [id]);
  useEffect(() => { load(); }, [load]);
  const act = async (action, body) => {
    setError('');
    try { await growthConversationAction(id, action, body); if (action === 'reply') setText(''); await load(); onChanged(); }
    catch (err) { setError(err.message); }
  };
  if (!data) return <p className={MUTED}>{error || 'Loading…'}</p>;
  const { conversation, messages } = data;
  return (
    <section className={`${CARD} space-y-3`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-black text-[#0b1f3a] dark:text-white">{conversation.visitor_name || 'Visitor (details not given yet)'}</h3>
          <p className={MUTED}>{[conversation.email, conversation.phone].filter(Boolean).join(' · ') || '—'}</p>
          <p className="text-xs text-slate-700 dark:text-slate-300">
            Consultant: {conversation.consultant} · Privacy notice agreed: {conversation.privacy_consent_at ? new Date(conversation.privacy_consent_at).toLocaleString() : 'not yet'} · Marketing: {conversation.marketing_consent ? `agreed ${new Date(conversation.marketing_consent_at).toLocaleDateString()}` : 'not agreed'}
          </p>
        </div>
        <Chip status={conversation.status} />
      </div>
      <ol className="max-h-96 space-y-2 overflow-auto">
        {messages.map((message, index) => (
          <li key={index} className={`rounded-lg p-2 text-sm ${message.sender === 'visitor' ? 'bg-indigo-50 text-slate-900 dark:bg-indigo-950 dark:text-slate-100' : 'bg-slate-50 text-slate-900 dark:bg-slate-800 dark:text-slate-100'}`}>
            <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">{message.sender === 'consultant' ? `${message.sender_name} · virtual consultant${message.source === 'knowledge' || message.source === 'cache' ? ' (approved answer)' : ''}` : message.sender === 'staff' ? `${message.sender_name} · staff` : message.sender === 'system' ? 'Notice' : conversation.visitor_name || 'Visitor'} · {new Date(message.created_at).toLocaleString()}</span>
            <span className="whitespace-pre-wrap">{message.body}</span>
          </li>
        ))}
      </ol>
      {error ? <p role="alert" className="text-sm font-semibold text-rose-800 dark:text-rose-200">{error}</p> : null}
      {conversation.status !== 'closed' ? (
        <>
          <label className={LABEL}>Reply as yourself (the consultant stops answering)<textarea rows={3} className={`${FIELD} normal-case`} value={text} onChange={event => setText(event.target.value)} /></label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={PRIMARY} disabled={!text.trim()} onClick={() => act('reply', { text })}>Send reply</button>
            {conversation.status !== 'human' ? <button type="button" className={SECONDARY} onClick={() => act('take-over')}>Take over</button> : null}
            <button type="button" className={SECONDARY} onClick={() => act('close')}>Close</button>
          </div>
        </>
      ) : null}
    </section>
  );
}

export default function GrowthCentrePage() {
  const [tab, setTab] = useState('conversations');
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('');
  const [openId, setOpenId] = useState('');
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => getGrowthCentre(filter).then(result => { setData(result); setError(''); }).catch(err => setError(err.message)), [filter]);
  useEffect(() => { load(); }, [load]);
  const act = async (action, message) => {
    setError(''); setNotice('');
    try { await action(); setNotice(message); await load(); } catch (err) { setError(err.message); }
  };
  const ndovera = data?.scope === 'ndovera';
  const chatLink = ndovera ? 'https://ndovera.com/api/growth/ndovera/chat' : '/chat on your school website';

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 text-slate-900 sm:p-6 dark:text-slate-100">
      <header className="rounded-2xl bg-[#191970] p-6 text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-200">Growth Centre</p>
        <h1 className="mt-1 text-2xl font-black">{ndovera ? 'Schools asking about Ndovera' : 'Admissions chat'}</h1>
        <p className="mt-2 text-sm text-slate-100">Rex, Zico, Vera and Nora are virtual consultants: they always say they are automated, answer only with the approved answers below, and pass everything else to you. Visitors chat at {chatLink}.</p>
      </header>
      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? PRIMARY : SECONDARY} onClick={() => setTab(key)}>{label}{key === 'gaps' && data?.gaps?.length ? ` (${data.gaps.length})` : ''}</button>)}
      </div>
      {error ? <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-200">{error}</p> : null}
      {notice ? <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">{notice}</p> : null}
      {!data && !error ? <p className={MUTED}>Loading…</p> : null}

      {data && tab === 'conversations' ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <section className={`${CARD} space-y-2`}>
            <label className={LABEL}>Show
              <select className={FIELD} value={filter} onChange={event => setFilter(event.target.value)}>
                <option value="">Every conversation</option><option value="handover">Needs a person</option><option value="human">Staff replying</option><option value="open">With the consultant</option><option value="closed">Closed</option>
              </select>
            </label>
            {!data.conversations.length ? <p className={MUTED}>No conversations yet.</p> : null}
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {data.conversations.map(item => (
                <li key={item.id}>
                  <button type="button" className="w-full py-2 text-left" onClick={() => setOpenId(item.id)}>
                    <span className="flex flex-wrap items-center gap-2"><b>{item.visitor_name || 'Visitor'}</b><Chip status={item.status} /></span>
                    <span className="block truncate text-sm text-slate-700 dark:text-slate-300">{item.first_question || '—'}</span>
                    <span className="block text-xs text-slate-700 dark:text-slate-300">{new Date(item.last_message_at).toLocaleString()} · {item.consultant}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          {openId ? <Conversation key={openId} id={openId} onChanged={load} /> : <p className={`${CARD} ${MUTED}`}>Choose a conversation.</p>}
        </div>
      ) : null}

      {data && tab === 'knowledge' ? (
        <section className="space-y-3">
          <p className={MUTED}>The consultants answer only with approved answers, word for word. A new or changed answer is a draft until someone else approves it (if you are the only manager, you approve your own). Every version is kept.</p>
          {draft ? (
            <form className={`${CARD} space-y-2`} onSubmit={event => { event.preventDefault(); act(async () => { await draftGrowthAnswer(draft); setDraft(null); }, 'Saved as a draft. It goes live when approved.'); }}>
              <label className={LABEL}>Question people ask<input required maxLength={300} className={FIELD} value={draft.question} onChange={event => setDraft({ ...draft, question: event.target.value })} /></label>
              <label className={LABEL}>Approved answer (shown exactly as written)<textarea required rows={4} maxLength={4000} className={`${FIELD} normal-case`} value={draft.answer} onChange={event => setDraft({ ...draft, answer: event.target.value })} /></label>
              <label className={LABEL}>Other words people use (comma separated)<input maxLength={400} className={FIELD} value={draft.keywords} onChange={event => setDraft({ ...draft, keywords: event.target.value })} /></label>
              <div className="flex gap-2"><button type="submit" className={PRIMARY}>Save draft</button><button type="button" className={SECONDARY} onClick={() => setDraft(null)}>Cancel</button></div>
            </form>
          ) : <button type="button" className={PRIMARY} onClick={() => setDraft({ question: '', answer: '', keywords: '' })}>+ New answer</button>}
          {data.knowledge.map(item => (
            <article key={item.id} className={`${CARD} space-y-1`}>
              <div className="flex flex-wrap items-center gap-2"><b>{item.question}</b><Chip status={item.status} /><span className="text-xs text-slate-700 dark:text-slate-300">Version {item.version}{item.approved_by_name ? ` · approved by ${item.approved_by_name} ${new Date(item.approved_at).toLocaleDateString()}` : item.created_by_name ? ` · drafted by ${item.created_by_name}` : ''}</span></div>
              <p className="whitespace-pre-wrap text-sm">{item.answer}</p>
              {item.keywords ? <p className="text-xs text-slate-700 dark:text-slate-300">Also matches: {item.keywords}</p> : null}
              <div className="flex flex-wrap gap-2">
                {item.status === 'draft' ? <button type="button" className={SECONDARY} onClick={() => act(() => growthAnswerAction(item.id, 'approve'), 'Approved. It is live now.')}>Approve</button> : null}
                {item.status === 'approved' ? <button type="button" className={SECONDARY} onClick={() => setDraft({ articleKey: item.article_key, question: item.question, answer: item.answer, keywords: item.keywords })}>Write a new version</button> : null}
                {item.status !== 'retired' ? <button type="button" className={SECONDARY} onClick={() => act(() => growthAnswerAction(item.id, 'retire'), 'Retired.')}>Retire</button> : null}
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {data && tab === 'gaps' ? (
        <section className="space-y-2">
          <p className={MUTED}>Questions the consultants had no approved answer for. Each one was passed to a person; write an answer so next time it is answered straight away.</p>
          {!data.gaps.length ? <p className={`${CARD} ${MUTED}`}>Nothing waiting.</p> : null}
          {data.gaps.map(gap => (
            <article key={gap.id} className={`${CARD} flex flex-wrap items-center justify-between gap-2`}>
              <span><b>{gap.question}</b><span className="block text-xs text-slate-700 dark:text-slate-300">Asked {gap.asked} time{gap.asked === 1 ? '' : 's'}</span></span>
              <span className="flex gap-2">
                <button type="button" className={SECONDARY} onClick={() => { setDraft({ question: gap.question, answer: '', keywords: '' }); setTab('knowledge'); }}>Write an answer</button>
                <button type="button" className={SECONDARY} onClick={() => act(() => dismissGrowthGap(gap.id), 'Set aside.')}>Set aside</button>
              </span>
            </article>
          ))}
        </section>
      ) : null}

      {data && tab === 'stats' ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[['Conversations (30 days)', data.stats.conversations], ['Left their details', data.stats.contacts], ['Answered from approved answers', data.stats.answeredFromKnowledge], ['Passed to a person', data.stats.handovers], ['Staff replying now', data.stats.withStaff], ['Agreed to marketing', data.stats.marketingConsents], ['Unanswered questions', data.stats.openGaps], ['Approved answers live', data.stats.approvedAnswers]].map(([label, value]) => (
            <div key={label} className={CARD}><p className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">{label}</p><p className="mt-1 text-2xl font-black text-[#191970] dark:text-white">{value}</p></div>
          ))}
          <div className={`${CARD} sm:col-span-2 lg:col-span-4`}>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">By consultant</p>
            <p className="mt-1 text-sm">{data.stats.byConsultant.length ? data.stats.byConsultant.map(item => `${item.consultant}: ${item.conversations}`).join(' · ') : 'No conversations yet.'}</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
