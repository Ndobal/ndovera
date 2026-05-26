import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SparklesIcon, ArrowPathIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { askAiTutor, getAiAccess } from '../services/aiTutorApi';

const currencyFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

const teachingRoleKeys = new Set([
  'teacher',
  'classteacher',
  'hod',
  'hodassistant',
  'principal',
  'headteacher',
  'nurseryhead',
  'examofficer',
  'sportsmaster',
]);

function buildWelcomeMessage(roleTitle, isTeachingRole) {
  return [{
    id: 'welcome',
    role: 'assistant',
    text: isTeachingRole
      ? `Ndovera AI is live for ${roleTitle}. Ask for lesson framing, assessments, reports, parent communication, or general professional help in one running chat.`
      : `Ndovera AI is live for ${roleTitle}. Ask for notices, summaries, operations planning, professional writing, or general support in one running chat.`,
  }];
}

function buildPromptStarters(isTeachingRole) {
  if (isTeachingRole) {
    return [
      'Draft a 40-minute lesson opener on photosynthesis for JSS2.',
      'Create 5 revision questions with answers on fractions.',
      'Rewrite this parent update in a calm professional tone.',
      'Suggest 3 interventions for a weak learner this week.',
    ];
  }

  return [
    'Turn this rough note into a professional staff notice.',
    'Create a simple checklist for today\'s operational tasks.',
    'Summarize this report in five clear bullet points.',
    'Draft a polite follow-up message about a pending issue.',
  ];
}

function resolveSourceLabel(source) {
  if (source === 'free') return 'Free Daily Request';
  if (source === 'school_credits') return 'School Credit';
  if (source === 'individual_credits') return 'Individual Credit';
  return 'Workers AI';
}

function toApiMessages(messages) {
  return messages
    .filter(message => message.role === 'user' || message.role === 'assistant')
    .map(message => ({ role: message.role, content: message.text }))
    .slice(-12);
}

export default function StaffAiAssistantPage({ roleKey = 'teacher', roleTitle = 'Staff Dashboard' }) {
  const isTeachingRole = teachingRoleKeys.has(String(roleKey || '').trim().toLowerCase());
  const promptStarters = useMemo(() => buildPromptStarters(isTeachingRole), [isTeachingRole]);
  const [accessPayload, setAccessPayload] = useState(null);
  const [messages, setMessages] = useState(() => buildWelcomeMessage(roleTitle, isTeachingRole));
  const [input, setInput] = useState('');
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');
  const transcriptRef = useRef(null);

  const access = accessPayload?.access || null;
  const analyticsCards = useMemo(() => {
    if (!access) return [];

    return [
      {
        label: 'Free Left',
        value: `${access.usage.remainingFreeRequests}/${access.usage.dailyFreeRequests}`,
        helper: 'Daily AI requests before credits are used.',
      },
      {
        label: 'Available Credits',
        value: String(access.wallet.availableCredits || 0),
        helper: access.policy.billingModel === 'school' ? 'School wallet is active.' : 'Individual wallet is active.',
      },
      {
        label: 'Billing Mode',
        value: access.policy.billingModel === 'school' ? 'School Sponsored' : 'Individual Billing',
        helper: 'AI access uses the same live billing policy as the rest of the platform.',
      },
      {
        label: 'Credit Price',
        value: access.policy.pricePerCreditNaira > 0 ? currencyFormatter.format(access.policy.pricePerCreditNaira) : 'Not Set',
        helper: `${messages.filter(message => message.role === 'assistant').length} assistant messages in this chat.`,
      },
    ];
  }, [access, messages]);

  const quotaBlocked = access
    && Number(access.usage?.remainingFreeRequests || 0) <= 0
    && Number(access.wallet?.availableCredits || 0) <= 0;

  useEffect(() => {
    let active = true;

    async function loadAccess() {
      setLoadingAccess(true);
      try {
        const data = await getAiAccess();
        if (!active) return;
        setAccessPayload(data);
        setError('');
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message || 'Could not load AI access.');
      } finally {
        if (active) {
          setLoadingAccess(false);
        }
      }
    }

    loadAccess();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!transcriptRef.current) return;
    transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [messages, error]);

  async function sendMessage(prefilledPrompt = '') {
    const prompt = String(prefilledPrompt || input).trim();
    if (!prompt || asking || quotaBlocked) return;

    const userMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      text: prompt,
    };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput('');
    setError('');
    setAsking(true);

    try {
      const data = await askAiTutor({
        prompt,
        messages: toApiMessages(nextMessages),
        mode: isTeachingRole ? 'Teaching Assistant' : 'Staff Assistant',
      });
      setMessages(current => ([
        ...current,
        {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          text: data.answer,
          source: data.source,
          chargedCredits: data.chargedCredits || 0,
        },
      ]));
      setAccessPayload(current => ({ ...(current || {}), access: data.access, management: current?.management || {} }));
    } catch (askError) {
      setError(askError.message || 'Could not process the AI request.');
      if (askError.data?.access) {
        setAccessPayload(current => ({ ...(current || {}), access: askError.data.access, management: current?.management || {} }));
      }
    } finally {
      setAsking(false);
    }
  }

  function handleComposerKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function resetChat() {
    setMessages(buildWelcomeMessage(roleTitle, isTeachingRole));
    setInput('');
    setError('');
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col overflow-hidden px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2rem] border border-[#800000]/15 bg-[#f5deb3]/95 shadow-[0_24px_54px_rgba(128,0,0,0.12)] dark:border-[#bf00ff]/30 dark:bg-[#800000]/72">
        <header className="border-b border-[#800000]/10 bg-[#fff8ea]/90 px-4 py-4 backdrop-blur md:px-6 dark:border-[#bf00ff]/20 dark:bg-[#170018]/90">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#1a5c38]/20 bg-[#1a5c38]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1a5c38] dark:border-[#00ffff]/25 dark:bg-[#00ffff]/10 dark:text-[#00ffff]">
                  <SparklesIcon className="h-4 w-4" />
                  Workers AI
                </span>
                <span className="rounded-full border border-[#800000]/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#800000] dark:border-[#bf00ff]/25 dark:text-white">
                  {roleTitle}
                </span>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#800020] dark:text-[#bf00ff]">AI Workspace</p>
                <h1 className="mt-2 text-3xl font-semibold text-[#800000] dark:text-[#0000ff]">AI Assistant</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#191970] dark:text-[#39ff14]">
                  A ChatGPT-style workspace for teachers and staff to ask questions, refine drafts, and keep a running conversation without leaving the dashboard.
                </p>
              </div>
            </div>

            <div className="grid max-w-full grid-cols-2 gap-3 xl:w-[420px]">
              {(loadingAccess ? [{ label: 'Status', value: 'Loading...', helper: 'Fetching AI access.' }] : analyticsCards).map(card => (
                <div key={card.label} className="rounded-3xl border border-[#800000]/10 bg-white/60 px-4 py-3 dark:border-[#bf00ff]/20 dark:bg-[#191970]/35">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#800020] dark:text-[#bf00ff]">{card.label}</p>
                  <p className="mt-2 text-lg font-semibold text-[#800000] dark:text-white">{card.value}</p>
                  <p className="mt-1 text-xs leading-5 text-[#191970] dark:text-[#39ff14]">{card.helper}</p>
                </div>
              ))}
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="hidden min-h-0 flex-col gap-4 border-r border-[#800000]/10 bg-[#fff8ea]/55 p-4 xl:flex dark:border-[#bf00ff]/20 dark:bg-[#180013]/55">
            <section className="rounded-[1.75rem] border border-[#800000]/10 bg-white/65 p-4 dark:border-[#bf00ff]/20 dark:bg-[#191970]/35">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#800020] dark:text-[#bf00ff]">Prompt Starters</p>
              <div className="mt-3 flex flex-col gap-2">
                {promptStarters.map(prompt => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendMessage(prompt)}
                    className="rounded-2xl border border-[#800000]/10 bg-[#fdf8f0] px-3 py-3 text-left text-sm leading-6 text-[#191970] transition hover:border-[#1a5c38]/30 hover:bg-white dark:border-[#bf00ff]/20 dark:bg-[#210022] dark:text-white dark:hover:border-[#00ffff]/35"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[#800000]/10 bg-white/65 p-4 dark:border-[#bf00ff]/20 dark:bg-[#191970]/35">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#800020] dark:text-[#bf00ff]">How To Use</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[#191970] dark:text-[#39ff14]">
                <li>Keep follow-up questions in the same chat so the assistant retains context.</li>
                <li>Paste rough notes, messages, or report text and ask for a cleaner draft.</li>
                <li>The assistant can suggest language and structure, but it does not submit or publish anything for you.</li>
              </ul>
            </section>
          </aside>

          <section className="flex min-h-0 flex-col">
            <div ref={transcriptRef} className="flex-1 overflow-y-auto px-4 py-5 md:px-6">
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
                {quotaBlocked ? (
                  <div className="rounded-[1.75rem] border border-[#1a5c38]/20 bg-[#e4f4e6] px-5 py-4 text-sm text-[#1a5c38] dark:border-[#00ffff]/20 dark:bg-[#03181a] dark:text-[#7df9ff]">
                    <p className="font-semibold uppercase tracking-[0.18em]">AI Access Paused</p>
                    <p className="mt-2 leading-6">Your free requests are finished and no credits are available right now. Ask the school AI manager to top up or adjust the billing policy before sending another prompt.</p>
                  </div>
                ) : null}

                {messages.map(message => {
                  const isUser = message.role === 'user';
                  return (
                    <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[92%] rounded-[1.75rem] px-4 py-3 shadow-sm sm:max-w-[82%] ${isUser
                        ? 'bg-[#1a5c38] text-[#f5deb3] dark:bg-[#00ffff] dark:text-black'
                        : 'border border-[#800000]/10 bg-white/75 text-[#191970] dark:border-[#bf00ff]/20 dark:bg-[#191970]/35 dark:text-white'
                      }`}>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">
                          <span>{isUser ? 'You' : 'Ndovera AI'}</span>
                          {!isUser && message.source ? <span>{resolveSourceLabel(message.source)}</span> : null}
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{message.text}</p>
                        {!isUser && message.chargedCredits > 0 ? (
                          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">
                            {message.chargedCredits} credit used for this answer.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-[#800000]/10 bg-[#fff8ea]/92 p-4 backdrop-blur md:p-5 dark:border-[#bf00ff]/20 dark:bg-[#170018]/90">
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
                <div className="flex flex-wrap gap-2 xl:hidden">
                  {promptStarters.map(prompt => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendMessage(prompt)}
                      className="rounded-full border border-[#800000]/15 bg-white/70 px-3 py-2 text-left text-xs font-semibold leading-5 text-[#800000] dark:border-[#bf00ff]/20 dark:bg-[#191970]/35 dark:text-white"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                {error ? (
                  <div className="rounded-2xl border border-red-300/60 bg-red-50 px-4 py-3 text-sm font-semibold text-[#800000] dark:border-[#ff5f8d]/35 dark:bg-[#4a0014] dark:text-white">
                    {error}
                  </div>
                ) : null}

                <div className="rounded-[1.75rem] border border-[#800000]/15 bg-white/72 p-3 dark:border-[#bf00ff]/20 dark:bg-[#191970]/35">
                  <textarea
                    value={input}
                    onChange={event => setInput(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    rows={4}
                    placeholder={isTeachingRole
                      ? 'Ask for lesson ideas, professional replies, revision help, classroom communication, or any follow-up question.'
                      : 'Ask for reports, notices, summaries, planning help, professional writing, or any follow-up question.'}
                    className="w-full resize-none border-0 bg-transparent px-2 py-2 text-[15px] leading-7 text-[#191970] outline-none placeholder:text-[#191970]/55 dark:text-white dark:placeholder:text-white/45"
                  />

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#800000]/10 px-2 pt-3 dark:border-[#bf00ff]/20">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-[#bf00ff]">
                      Press Enter to send. Shift + Enter for a new line.
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={resetChat}
                        className="inline-flex items-center gap-2 rounded-2xl border border-[#800000]/20 px-4 py-3 text-sm font-semibold text-[#800000] dark:border-[#bf00ff]/25 dark:text-white"
                      >
                        <ArrowPathIcon className="h-4 w-4" />
                        New Chat
                      </button>
                      <button
                        type="button"
                        onClick={() => sendMessage()}
                        disabled={asking || loadingAccess || !input.trim() || quotaBlocked}
                        className="inline-flex items-center gap-2 rounded-2xl bg-[#1a5c38] px-5 py-3 text-sm font-bold text-[#f5deb3] transition hover:bg-[#154a2e] disabled:opacity-60 dark:bg-[#00ffff] dark:text-black dark:hover:bg-[#7dfcff]"
                      >
                        <PaperAirplaneIcon className="h-4 w-4" />
                        {asking ? 'Thinking...' : 'Send'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}