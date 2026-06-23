import React, { useEffect, useMemo, useState } from 'react';
import { askAiTutor, getAiAccess } from '../services/aiTutorApi';
import { clearChatSession, readChatSession, writeChatSession } from '../services/chatSessionStorage';
import SmartChatDashboard from './SmartChatDashboard';

const currencyFormatter = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

const teachingRoleKeys = new Set(['teacher', 'classteacher', 'hod', 'hodassistant', 'principal', 'headteacher', 'nurseryhead', 'examofficer', 'sportsmaster']);

const TEACHING_SUGGESTIONS = [
  { label: '📚 Plan a lesson on fractions', prompt: 'Plan a 40-minute lesson on fractions for JSS1 with objectives and activities.' },
  { label: '📝 Create a 10-question quiz', prompt: 'Create a 10-question quiz with answers on photosynthesis.' },
  { label: '💬 Draft a parent message', prompt: 'Write a short, polite message to a parent about their child improving in class.' },
  { label: '🧠 Explain a tricky topic simply', prompt: 'Explain Newton’s laws of motion in simple terms for a 12-year-old.' },
];
const STAFF_SUGGESTIONS = [
  { label: '📢 Draft a staff notice', prompt: 'Draft a clear staff notice about a meeting tomorrow at 2pm.' },
  { label: '📊 Summarize a report', prompt: 'Help me summarize a termly activity report into 5 key points.' },
  { label: '🗓️ Plan my week', prompt: 'Help me plan my work week with priorities and time blocks.' },
  { label: '✉️ Write a professional email', prompt: 'Write a professional email requesting supplies for my department.' },
];

function resolveSourceLabel(source) {
  if (source === 'free') return 'Free request';
  if (source === 'school_credits') return 'School credit';
  if (source === 'individual_credits') return 'Personal credit';
  return '';
}

function toApiMessages(messages) {
  return messages.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({ role: m.role, content: m.text })).slice(-12);
}

export default function StaffAiAssistantPage({ roleKey = 'teacher' }) {
  const chatSessionKey = `staff-ai-assistant:${String(roleKey || 'teacher').trim().toLowerCase()}`;
  const isTeachingRole = teachingRoleKeys.has(String(roleKey || '').trim().toLowerCase());
  const [accessPayload, setAccessPayload] = useState(null);
  const [messages, setMessages] = useState(() => {
    const s = readChatSession(chatSessionKey, { messages: [] });
    return Array.isArray(s.messages) ? s.messages : [];
  });
  const [input, setInput] = useState('');
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');

  const access = accessPayload?.access || null;
  const assistantReplyCount = useMemo(() => messages.filter(m => m.role === 'assistant').length, [messages]);

  const statusChips = useMemo(() => {
    if (!access) return [{ label: loadingAccess ? 'Loading…' : 'AI unavailable', tone: 'neutral' }];
    const free = Number(access.usage.remainingFreeRequests || 0);
    const credits = Number(access.wallet.availableCredits || 0);
    const price = Number(access.policy.pricePerCreditNaira || 0);
    return [
      { label: `${free}/${access.usage.dailyFreeRequests} Free`, tone: free > 0 ? 'free' : 'blocked' },
      { label: `${credits} Credits`, tone: credits > 0 ? 'credits' : 'neutral' },
      { label: access.policy.billingModel === 'school' ? 'School billing' : 'Individual', tone: 'billing' },
      { label: `Price ${price > 0 ? currencyFormatter.format(price) : '—'}`, tone: price > 0 ? 'price' : 'blocked' },
      { label: `${assistantReplyCount} Replies`, tone: 'neutral' },
    ];
  }, [access, assistantReplyCount, loadingAccess]);

  const quotaBlocked = access && Number(access.usage?.remainingFreeRequests || 0) <= 0 && Number(access.wallet?.availableCredits || 0) <= 0;

  useEffect(() => {
    const s = readChatSession(chatSessionKey, { messages: [] });
    setMessages(Array.isArray(s.messages) ? s.messages : []);
    setInput(''); setError('');
  }, [chatSessionKey]);

  useEffect(() => { writeChatSession(chatSessionKey, { messages }); }, [chatSessionKey, messages]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingAccess(true);
      try { const data = await getAiAccess(); if (active) { setAccessPayload(data); setError(''); } }
      catch (e) { if (active) setError(e.message || 'Could not load AI access.'); }
      finally { if (active) setLoadingAccess(false); }
    })();
    return () => { active = false; };
  }, []);

  async function sendMessage(prefilledPrompt) {
    const prompt = String(prefilledPrompt || input).trim();
    if (!prompt || asking || quotaBlocked) return;
    const nextMessages = [...messages, { id: `user_${Date.now()}`, role: 'user', text: prompt }];
    setMessages(nextMessages); setInput(''); setError(''); setAsking(true);
    try {
      const data = await askAiTutor({ prompt, messages: toApiMessages(nextMessages), mode: isTeachingRole ? 'Teaching Assistant' : 'Staff Assistant' });
      setMessages(current => [...current, { id: `assistant_${Date.now()}`, role: 'assistant', text: data.answer, source: data.source, chargedCredits: data.chargedCredits || 0 }]);
      setAccessPayload(current => ({ ...(current || {}), access: data.access, management: current?.management || {} }));
    } catch (e) {
      setError(e.message || 'Could not process the AI request.');
      if (e.data?.access) setAccessPayload(current => ({ ...(current || {}), access: e.data.access, management: current?.management || {} }));
    } finally { setAsking(false); }
  }

  function resetChat() { setMessages([]); setInput(''); setError(''); clearChatSession(chatSessionKey); }

  return (
    <div className="mx-auto h-full min-h-0 w-full max-w-7xl p-3 pb-24 sm:p-4 md:pb-4 lg:p-6">
      <SmartChatDashboard
        aiName="Ndovera AI"
        subtitle={isTeachingRole ? 'Your teaching assistant — lessons, marking, parent messages & more' : 'Your staff assistant — notices, reports, planning & drafting'}
        messages={messages}
        input={input}
        onInputChange={setInput}
        onSend={sendMessage}
        sending={asking}
        placeholder={isTeachingRole ? 'Ask about lesson planning, marking, revision…' : 'Ask about notices, reports, planning, drafting…'}
        suggestions={isTeachingRole ? TEACHING_SUGGESTIONS : STAFF_SUGGESTIONS}
        statusChips={statusChips}
        onNewChat={resetChat}
        inputDisabled={quotaBlocked || loadingAccess}
        error={error}
        renderMeta={(m) => (
          <>
            {m.source ? <span>{resolveSourceLabel(m.source)}</span> : null}
            {m.chargedCredits > 0 ? <span>· {m.chargedCredits} credit</span> : null}
          </>
        )}
        blockedNotice={quotaBlocked ? (
          <div className="mx-auto mb-4 max-w-3xl rounded-2xl border border-amber-400/40 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-200">
            <p className="font-bold uppercase tracking-wide">AI access paused</p>
            <p className="mt-1 leading-6">Your free requests are finished and no credits are available. Ask the school AI manager to top up or adjust billing before sending another prompt.</p>
          </div>
        ) : null}
      />
    </div>
  );
}
