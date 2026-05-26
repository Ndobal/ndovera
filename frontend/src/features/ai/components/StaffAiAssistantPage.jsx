import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowPathIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
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

function resolveSourceLabel(source) {
  if (source === 'free') return 'Free Daily Request';
  if (source === 'school_credits') return 'School Credit';
  if (source === 'individual_credits') return 'Individual Credit';
  return 'Workers AI';
}

function resolveTopbarToneClasses(tone) {
  if (tone === 'free') {
    return 'border-[#1a5c38]/25 bg-[#1a5c38]/12 text-[#1a5c38] dark:border-[#39ff14]/35 dark:bg-[#39ff14]/10 dark:text-[#39ff14]';
  }

  if (tone === 'credits') {
    return 'border-[#191970]/20 bg-[#191970]/10 text-[#191970] dark:border-[#00ffff]/35 dark:bg-[#0000ff]/16 dark:text-[#00ffff]';
  }

  if (tone === 'billing') {
    return 'border-[#800020]/20 bg-[#800020]/10 text-[#800020] dark:border-[#bf00ff]/35 dark:bg-[#bf00ff]/12 dark:text-[#ffb8ff]';
  }

  if (tone === 'price') {
    return 'border-[#8b5a00]/20 bg-[#f3d38a]/45 text-[#8b5a00] dark:border-[#ffb347]/35 dark:bg-[#ffb347]/12 dark:text-[#ffd27a]';
  }

  if (tone === 'blocked') {
    return 'border-[#800000]/20 bg-[#800000]/10 text-[#800000] dark:border-[#ff5f8d]/35 dark:bg-[#ff5f8d]/10 dark:text-[#ff9dbc]';
  }

  if (tone === 'replies') {
    return 'border-[#800000]/20 bg-[#fff1e8] text-[#800000] dark:border-white/25 dark:bg-white/10 dark:text-white';
  }

  return 'border-[#800000]/12 bg-white/72 text-[#800000] dark:border-[#bf00ff]/20 dark:bg-[#191970]/35 dark:text-white';
}

function toApiMessages(messages) {
  return messages
    .filter(message => message.role === 'user' || message.role === 'assistant')
    .map(message => ({ role: message.role, content: message.text }))
    .slice(-12);
}

export default function StaffAiAssistantPage({ roleKey = 'teacher' }) {
  const isTeachingRole = teachingRoleKeys.has(String(roleKey || '').trim().toLowerCase());
  const [accessPayload, setAccessPayload] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');
  const transcriptRef = useRef(null);
  const composerRef = useRef(null);

  const access = accessPayload?.access || null;
  const assistantReplyCount = useMemo(
    () => messages.filter(message => message.role === 'assistant').length,
    [messages],
  );
  const hasConversation = messages.some(message => message.role === 'user');
  const topbarItems = useMemo(() => {
    if (!access) {
      return [{ key: 'status', label: loadingAccess ? 'Loading AI access...' : 'AI access unavailable', tone: 'neutral' }];
    }

    const remainingFreeRequests = Number(access.usage.remainingFreeRequests || 0);
    const availableCredits = Number(access.wallet.availableCredits || 0);
    const pricePerCreditNaira = Number(access.policy.pricePerCreditNaira || 0);

    return [
      {
        key: 'free',
        label: `Free Left ${remainingFreeRequests}/${access.usage.dailyFreeRequests}`,
        tone: remainingFreeRequests > 0 ? 'free' : 'blocked',
      },
      {
        key: 'credits',
        label: `Available Credits ${availableCredits}`,
        tone: availableCredits > 0 ? 'credits' : 'neutral',
      },
      {
        key: 'billing',
        label: `Billing ${access.policy.billingModel === 'school' ? 'School Sponsored' : 'Individual Billing'}`,
        tone: 'billing',
      },
      {
        key: 'price',
        label: `Price ${pricePerCreditNaira > 0 ? currencyFormatter.format(pricePerCreditNaira) : 'Not Set'}`,
        tone: pricePerCreditNaira > 0 ? 'price' : 'blocked',
      },
      { key: 'replies', label: `Replies ${assistantReplyCount}`, tone: 'replies' },
    ];
  }, [access, assistantReplyCount, loadingAccess]);

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

  useEffect(() => {
    if (!composerRef.current) return;

    composerRef.current.style.height = '100px';
    const nextHeight = Math.min(Math.max(composerRef.current.scrollHeight, 100), 240);
    composerRef.current.style.height = `${nextHeight}px`;
    composerRef.current.style.overflowY = composerRef.current.scrollHeight > 240 ? 'auto' : 'hidden';
  }, [input]);

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

  function handleComposerSubmit(event) {
    event.preventDefault();
    sendMessage();
  }

  function resetChat() {
    setMessages([]);
    setInput('');
    setError('');
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col overflow-hidden px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2rem] border border-[#800000]/15 bg-[#f5deb3]/95 shadow-[0_24px_54px_rgba(128,0,0,0.12)] dark:border-[#bf00ff]/30 dark:bg-[#800000]/72">
        <section className="flex min-h-0 flex-1 flex-col">
          <div ref={transcriptRef} className="flex-1 overflow-y-auto">
            <header className="sticky top-0 z-10 border-b border-[#800000]/10 bg-[#fff8ea]/92 backdrop-blur dark:border-[#bf00ff]/20 dark:bg-[#170018]/92">
              <div className="flex min-h-[30px] items-center gap-2 overflow-x-auto whitespace-nowrap px-3 py-2 md:px-4">
                {topbarItems.map(item => (
                  <span
                    key={item.key}
                    className={`inline-flex h-7 items-center rounded-full border px-3 text-[10px] font-semibold uppercase tracking-[0.16em] ${resolveTopbarToneClasses(item.tone)}`}
                  >
                    {item.label}
                  </span>
                ))}
              </div>
            </header>

            <div className="px-4 py-5 md:px-6">
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 pb-6">
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
          </div>

          <div className="shrink-0 border-t border-[#800000]/10 bg-[#fff8ea]/92 p-4 backdrop-blur md:p-5 dark:border-[#bf00ff]/20 dark:bg-[#170018]/90">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
              {error ? (
                <div className="rounded-2xl border border-red-300/60 bg-red-50 px-4 py-3 text-sm font-semibold text-[#800000] dark:border-[#ff5f8d]/35 dark:bg-[#4a0014] dark:text-white">
                  {error}
                </div>
              ) : null}

              <form onSubmit={handleComposerSubmit} className="rounded-[1.75rem] border border-[#800000]/15 bg-white/72 p-3 dark:border-[#bf00ff]/20 dark:bg-[#191970]/35">
                <textarea
                  ref={composerRef}
                  value={input}
                  onChange={event => setInput(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  rows={1}
                  placeholder={isTeachingRole
                    ? 'Message Ndovera AI about lesson planning, marking, revision, parent communication, or anything else you need.'
                    : 'Message Ndovera AI about notices, reports, planning, drafting, or anything else you need.'}
                  className="min-h-[100px] w-full max-h-[240px] resize-none border-0 bg-transparent px-2 py-2 text-[15px] leading-7 text-[#191970] outline-none placeholder:text-[#191970]/55 dark:text-white dark:placeholder:text-white/45"
                />

                <div className="mt-3 flex flex-wrap items-center justify-end gap-3 border-t border-[#800000]/10 px-2 pt-3 dark:border-[#bf00ff]/20">
                  {hasConversation ? (
                    <button
                      type="button"
                      onClick={resetChat}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[#800000]/20 px-4 py-3 text-sm font-semibold text-[#800000] dark:border-[#bf00ff]/25 dark:text-white"
                    >
                      <ArrowPathIcon className="h-4 w-4" />
                      New Chat
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    disabled={asking || loadingAccess || !input.trim() || quotaBlocked}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#1a5c38] px-5 py-3 text-sm font-bold text-[#f5deb3] transition hover:bg-[#154a2e] disabled:opacity-60 dark:bg-[#00ffff] dark:text-black dark:hover:bg-[#7dfcff]"
                  >
                    <PaperAirplaneIcon className="h-4 w-4" />
                    {asking ? 'Thinking...' : 'Send'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}