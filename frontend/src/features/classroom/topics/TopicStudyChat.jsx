import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AiAnswer from '../../ai/AiAnswer';
import { askAiTutor } from '../../ai/services/aiTutorApi';
import { readChatSession, writeChatSession, clearChatSession } from '../../ai/services/chatSessionStorage';

// "Study with Ndovera AI" for one topic. The server attaches the topic's
// context (school, class, subject, topic, term and the teacher's notes) to
// every turn, and the earlier turns travel with each question, so "give me
// another example" stays on this topic without the student repeating it.

const QUICK_ACTIONS = [
  { label: 'Explain this Topic', prompt: 'Explain this topic to me clearly, starting from what I need to know first.' },
  { label: 'Teach Me Step by Step', prompt: 'Teach me this topic step by step. Stop after each step and check I understand before moving on.' },
  { label: 'Simplify It', prompt: 'Explain this topic again in simpler words, as if I am meeting it for the first time.' },
  { label: 'Give Examples', prompt: 'Give me clear worked examples for this topic.' },
  { label: 'Test My Understanding', prompt: 'Ask me three short questions to test my understanding of this topic. Wait for my answers before telling me if I am right.' },
  { label: 'Practice Questions', prompt: 'Give me practice questions on this topic, with the answers listed separately at the end.' },
];

export default function TopicStudyChat({ classId, topic, subjectName, onClose }) {
  const sessionKey = `topic.${classId}.${topic.id}`;
  const [messages, setMessages] = useState(() => readChatSession(sessionKey, { messages: [] }).messages || []);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  useEffect(() => { writeChatSession(sessionKey, { messages }); }, [sessionKey, messages]);
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }); }, [messages, sending]);
  useEffect(() => {
    function onKey(event) { if (event.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function send(text) {
    const prompt = String(text || '').trim();
    if (!prompt || sending) return;
    const history = messages.map(message => ({ role: message.role, content: message.text })).slice(-12);
    setMessages(current => [...current, { id: `u${Date.now()}`, role: 'user', text: prompt }]);
    setInput('');
    setSending(true);
    setError('');
    try {
      const data = await askAiTutor({ prompt, mode: 'Topic Study', messages: [...history, { role: 'user', content: prompt }], topicContext: { classId, topicId: topic.id } });
      if (!data?.answer) throw new Error(data?.message || 'Ndovera AI did not answer. Please try again.');
      setMessages(current => [...current, { id: `a${Date.now()}`, role: 'assistant', text: data.answer }]);
    } catch (err) {
      setError(err.message || 'Ndovera AI could not answer right now.');
    } finally {
      setSending(false);
    }
  }

  function restart() {
    clearChatSession(sessionKey);
    setMessages([]);
    setError('');
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#f4fbfe] dark:bg-slate-950" role="dialog" aria-modal="true" aria-label={`Study ${topic.name} with Ndovera AI`}>
      <header className="flex flex-wrap items-center gap-2 border-b border-[#7cc4e8]/40 bg-white px-4 py-3 pt-[calc(0.75rem+var(--safe-top,0px))] dark:border-white/10 dark:bg-slate-900">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold uppercase tracking-wide text-[#2447d8]">Study with Ndovera AI{subjectName ? ` · ${subjectName}` : ''}</p>
          <h2 className="truncate text-lg font-extrabold text-[#191970] dark:text-white">{topic.name}</h2>
        </div>
        {messages.length > 0 && <button type="button" onClick={restart} className="rounded-xl px-3 py-1.5 text-xs font-semibold text-[#800020] hover:underline">Start again</button>}
        <button type="button" onClick={onClose} className="rounded-xl bg-[#800020] px-3 py-1.5 text-xs font-bold text-[#b5e3f4]">Close</button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <p className="rounded-xl bg-[#cfecf7]/50 px-3 py-2 text-xs text-[#191970] dark:bg-slate-800 dark:text-slate-200">
            Ndovera AI uses your teacher&apos;s notes for this topic first and tells you when it is adding its own explanation. Your teacher and your marks decide when the topic is complete.
          </p>
          {messages.length === 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {QUICK_ACTIONS.map(action => (
                <button key={action.label} type="button" onClick={() => send(action.prompt)} disabled={sending}
                  className="rounded-2xl border border-[#7cc4e8]/50 bg-white px-4 py-3 text-left text-sm font-bold text-[#191970] shadow-sm transition hover:border-[#2447d8] disabled:opacity-60 dark:border-white/10 dark:bg-slate-900 dark:text-white">
                  {action.label}
                </button>
              ))}
            </div>
          )}
          {messages.map(message => (
            message.role === 'user'
              ? <p key={message.id} className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[#2447d8] px-4 py-2.5 text-sm text-white">{message.text}</p>
              : <div key={message.id} className="max-w-full rounded-2xl rounded-bl-md border border-[#7cc4e8]/40 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-slate-900"><AiAnswer text={message.text} /></div>
          ))}
          {sending && <p role="status" className="text-sm font-semibold text-[#2447d8]">Ndovera AI is thinking…</p>}
          {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>}
          <div ref={endRef} />
        </div>
      </div>

      {messages.length > 0 && (
        <div className="flex gap-2 overflow-x-auto border-t border-[#7cc4e8]/30 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-900">
          {QUICK_ACTIONS.slice(2).map(action => (
            <button key={action.label} type="button" onClick={() => send(action.prompt)} disabled={sending}
              className="shrink-0 rounded-full border border-[#7cc4e8]/50 px-3 py-1 text-xs font-semibold text-[#191970] disabled:opacity-60 dark:text-white">{action.label}</button>
          ))}
        </div>
      )}
      <form onSubmit={event => { event.preventDefault(); send(input); }} className="flex gap-2 border-t border-[#7cc4e8]/40 bg-white p-3 pb-[calc(0.75rem+var(--safe-bottom,0px))] dark:border-white/10 dark:bg-slate-900">
        <label className="sr-only" htmlFor="topic-study-input">Ask a question about {topic.name}</label>
        <input id="topic-study-input" value={input} onChange={event => setInput(event.target.value)} disabled={sending}
          placeholder={`Ask anything about ${topic.name}…`}
          className="min-w-0 flex-1 rounded-xl border border-[#7cc4e8]/50 px-3 py-2 text-[15px] text-[#191970] outline-none focus:border-[#2447d8] dark:bg-slate-800 dark:text-white" />
        <button type="submit" disabled={sending || !input.trim()} className="rounded-xl bg-[#2447d8] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Ask</button>
      </form>
    </div>,
    document.body,
  );
}
