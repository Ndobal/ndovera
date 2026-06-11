import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StudentSectionShell from './StudentSectionShell';
import { askAiTutor, getAiAccess } from '../../../features/ai/services/aiTutorApi';
import { readChatSession, writeChatSession } from '../../../features/ai/services/chatSessionStorage';

const modes = ['Explain Mode', 'Practice Mode', 'Weak Area Mode', 'Exam Review Mode'];
const currencyFormatter = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

const modeDescriptions = {
  'Explain Mode': 'Break concepts down in simple steps.',
  'Practice Mode': 'Generate questions and guided drills.',
  'Weak Area Mode': 'Focus on topics causing repeated mistakes.',
  'Exam Review Mode': 'Prepare for tests with revision-style prompts.',
};

function buildWelcomeMessage(viewerRole) {
  return [{
    id: 'welcome',
    role: 'assistant',
    mode: 'Explain Mode',
    text: viewerRole === 'parent'
      ? 'Ndovera AI is ready. Ask for lesson explanations, revision help, or weak-topic support so you can guide your child from the same workspace.'
      : 'Ndovera AI is ready. Ask for explanations, guided practice, weak-topic support, or exam review from this chat workspace.',
  }];
}

function resolveSourceLabel(source) {
  if (source === 'free') return 'Free Daily Request';
  if (source === 'school_credits') return 'School Credit';
  return 'Individual Credit';
}

function StudentProfessorAura({
  viewerRole = 'student',
  dashboardLabel = 'Student Dashboard',
  homePath = '/roles/student',
  tuckShopPath = '/roles/student/tuck-shop',
}) {
  const navigate = useNavigate();
  const chatSessionKey = `student-professor-aura:${String(viewerRole || 'student').trim().toLowerCase()}`;
  const persistedChatSession = readChatSession(chatSessionKey, {
    selectedMode: modes[0],
    messages: buildWelcomeMessage(viewerRole),
  });
  const [selectedMode, setSelectedMode] = useState(() => modes.includes(persistedChatSession.selectedMode) ? persistedChatSession.selectedMode : modes[0]);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(() => Array.isArray(persistedChatSession.messages) && persistedChatSession.messages.length
    ? persistedChatSession.messages
    : buildWelcomeMessage(viewerRole));
  const [accessPayload, setAccessPayload] = useState(null);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const transcriptRef = useRef(null);
  const composerRef = useRef(null);
  const containerRef = useRef(null);

  // Fullscreen reading mode for the AI workspace (enter/exit).
  useEffect(() => {
    function onFsChange() { setIsFullscreen(Boolean(document.fullscreenElement)); }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      containerRef.current?.requestFullscreen?.();
    }
  }

  const access = accessPayload?.access || null;
  const assistantReplyCount = useMemo(
    () => messages.filter(message => message.role === 'assistant').length,
    [messages],
  );

  useEffect(() => {
    const nextSession = readChatSession(chatSessionKey, {
      selectedMode: modes[0],
      messages: buildWelcomeMessage(viewerRole),
    });
    setSelectedMode(modes.includes(nextSession.selectedMode) ? nextSession.selectedMode : modes[0]);
    setMessages(Array.isArray(nextSession.messages) && nextSession.messages.length ? nextSession.messages : buildWelcomeMessage(viewerRole));
    setInput('');
    setError('');
  }, [chatSessionKey, viewerRole]);

  useEffect(() => {
    writeChatSession(chatSessionKey, {
      selectedMode,
      messages,
    });
  }, [chatSessionKey, messages, selectedMode]);

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

    composerRef.current.style.height = '0px';
    const nextHeight = Math.min(Math.max(composerRef.current.scrollHeight, 84), 220);
    composerRef.current.style.height = `${nextHeight}px`;
    composerRef.current.style.overflowY = composerRef.current.scrollHeight > 220 ? 'auto' : 'hidden';
  }, [input]);

  const shouldRefillInTuckShop = access?.policy?.billingModel === 'individual'
    && Number(access?.usage?.remainingFreeRequests || 0) <= 0
    && Number(access?.wallet?.availableCredits || 0) <= 0;

  const analyticsCards = useMemo(() => {
    if (!access) return [];

    return [
      {
        label: 'Free Left',
        value: `${access.usage.remainingFreeRequests}/${access.usage.dailyFreeRequests}`,
        helper: 'Daily requests before credits are used.',
      },
      {
        label: 'Available Credits',
        value: String(access.wallet.availableCredits || 0),
        helper: access.policy.billingModel === 'school' ? 'School wallet active.' : 'Personal AI wallet.',
      },
      {
        label: 'Billing Mode',
        value: access.policy.billingModel === 'school' ? 'School Sponsored' : 'Individual Billing',
        helper: access.policy.billingModel === 'school' ? 'School covers paid requests.' : 'Refill from tuck shop when empty.',
      },
      {
        label: 'Credit Price',
        value: access.policy.pricePerCreditNaira > 0 ? currencyFormatter.format(access.policy.pricePerCreditNaira) : 'Not Set',
        helper: `${assistantReplyCount} answers in this chat.`,
      },
    ];
  }, [access, assistantReplyCount]);

  const compactHeaderPills = useMemo(() => {
    if (!access) {
      return [{ key: 'status', label: loadingAccess ? 'Loading AI' : 'AI Unavailable' }];
    }

    return [
      {
        key: 'free',
        label: `${access.usage.remainingFreeRequests}/${access.usage.dailyFreeRequests} Free`,
      },
      {
        key: 'credits',
        label: `${access.wallet.availableCredits || 0} Credits`,
      },
      {
        key: 'billing',
        label: access.policy.billingModel === 'school' ? 'School Billing' : 'Individual Billing',
      },
    ];
  }, [access, loadingAccess]);

  function handleModeSelect(mode) {
    setSelectedMode(mode);
    setMobileMenuOpen(false);
  }

  async function ask() {
    const prompt = input.trim();
    if (!prompt || shouldRefillInTuckShop) return;

    setMessages(current => [...current, { id: `prompt_${Date.now()}`, role: 'user', text: prompt, mode: selectedMode }]);
    setAsking(true);
    setError('');
    setInput('');

    try {
      const data = await askAiTutor({ prompt, mode: selectedMode });
      setMessages(current => [...current, {
        id: `reply_${Date.now()}`,
        role: 'assistant',
        text: data.answer,
        mode: selectedMode,
        source: data.source,
        chargedCredits: data.chargedCredits || 0,
      }]);
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
      ask();
    }
  }

  return (
    <StudentSectionShell
      title="Ndovera AI"
      subtitle="Academic-only assistant with a chat workspace, live analytics, and tuck-shop refill guidance."
      dashboardLabel={dashboardLabel}
      compact
      hideHeader
      viewportLocked
      watermarkText="NDOVERA AI"
      diagonalWatermark
    >
      <div ref={containerRef} className="flex h-full min-h-0 flex-col overflow-hidden rounded-[2rem] border border-[#800000]/15 bg-[#f5deb3]/95 shadow-[0_24px_54px_rgba(128,0,0,0.12)] dark:border-[#bf00ff]/30 dark:bg-[#800000]/72">
        <header className="shrink-0 border-b border-[#800000]/10 bg-[#fff8ea]/90 backdrop-blur dark:border-[#bf00ff]/20 dark:bg-[#170018]/88">
          <div className="space-y-2 px-3 py-2.5 md:px-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(open => !open)}
                  className="inline-flex h-9 items-center rounded-2xl border border-[#800000]/20 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#800000] md:hidden dark:border-[#bf00ff]/25 dark:text-white"
                >
                  {mobileMenuOpen ? 'Close' : 'Menu'}
                </button>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  aria-label="Toggle fullscreen"
                  className="inline-flex h-9 items-center rounded-2xl border border-[#800000]/20 px-3 text-sm text-[#800000] md:hidden dark:border-[#00ffff]/25 dark:text-white"
                >
                  {isFullscreen ? '✕' : '⛶'}
                </button>
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-semibold uppercase tracking-[0.22em] text-[#800020] dark:text-[#bf00ff]">{dashboardLabel}</p>
                  <p className="truncate text-sm font-semibold text-[#800000] dark:text-white">Ndovera AI</p>
                </div>
              </div>

              <div className="flex max-w-[58%] items-center gap-2 overflow-x-auto pb-1">
                <span className="inline-flex h-8 items-center rounded-full border border-[#1a5c38]/25 bg-[#1a5c38]/10 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1a5c38] dark:border-[#00ffff]/25 dark:bg-[#00ffff]/10 dark:text-[#00ffff]">
                  {selectedMode.replace(' Mode', '')}
                </span>
                {compactHeaderPills.map(item => (
                  <span
                    key={item.key}
                    className="hidden h-8 items-center rounded-full border border-[#800000]/12 bg-white/70 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#800000] sm:inline-flex dark:border-[#bf00ff]/20 dark:bg-[#191970]/35 dark:text-white"
                  >
                    {item.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="hidden items-center justify-between gap-3 md:flex">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate(homePath)}
                  className="inline-flex h-8 items-center rounded-full border border-[#800000]/20 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#800000] dark:border-[#00ffff]/25 dark:text-white"
                >
                  Home
                </button>
                <button
                  type="button"
                  onClick={() => navigate(tuckShopPath)}
                  className="inline-flex h-8 items-center rounded-full border border-[#1a5c38]/25 bg-[#1a5c38]/10 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#1a5c38] dark:border-[#00ffff]/25 dark:bg-[#00ffff]/10 dark:text-[#00ffff]"
                >
                  Refill In Tuck Shop
                </button>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="inline-flex h-8 items-center rounded-full border border-[#800000]/20 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#800000] dark:border-[#00ffff]/25 dark:text-white"
                >
                  {isFullscreen ? '✕ Exit Fullscreen' : '⛶ Fullscreen'}
                </button>
              </div>

              <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1">
                {modes.map(mode => {
                  const active = selectedMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleModeSelect(mode)}
                      className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold transition ${active
                        ? 'border-[#1a5c38] bg-[#1a5c38] text-[#f5deb3] dark:border-[#00ffff] dark:bg-[#00ffff] dark:text-black'
                        : 'border-[#800000]/15 bg-white/55 text-[#800000] dark:border-[#bf00ff]/20 dark:bg-[#191970]/35 dark:text-white'
                      }`}
                    >
                      {mode.replace(' Mode', '')}
                    </button>
                  );
                })}
              </div>
            </div>

            {mobileMenuOpen ? (
              <div className="space-y-3 rounded-[1.75rem] border border-[#800000]/10 bg-white/65 p-3 md:hidden dark:border-[#bf00ff]/20 dark:bg-[#191970]/35">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(homePath)}
                    className="rounded-full border border-[#800000]/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#800000] dark:border-[#00ffff]/25 dark:text-white"
                  >
                    Home
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(tuckShopPath)}
                    className="rounded-full border border-[#1a5c38]/25 bg-[#1a5c38]/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#1a5c38] dark:border-[#00ffff]/25 dark:bg-[#00ffff]/10 dark:text-[#00ffff]"
                  >
                    Refill In Tuck Shop
                  </button>
                </div>

                <p className="text-sm leading-6 text-[#191970] dark:text-[#39ff14]">
                  A ChatGPT-style study workspace for lesson explanations, practice, weak-topic repair, and exam review. Social chat stays blocked here.
                </p>

                <div className="grid gap-2 sm:grid-cols-2">
                  {(loadingAccess ? [{ label: 'Status', value: 'Loading...', helper: 'Fetching AI access.' }] : analyticsCards).map(card => (
                    <div key={card.label} className="rounded-3xl border border-[#800000]/10 bg-[#fff8ea]/75 px-4 py-3 dark:border-[#bf00ff]/20 dark:bg-[#170018]/72">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#800020] dark:text-[#bf00ff]">{card.label}</p>
                      <p className="mt-1 text-base font-semibold text-[#800000] dark:text-white">{card.value}</p>
                      <p className="mt-1 text-xs leading-5 text-[#191970] dark:text-[#39ff14]">{card.helper}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {modes.map(mode => {
                    const active = selectedMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => handleModeSelect(mode)}
                        className={`rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition ${active
                          ? 'border-[#1a5c38] bg-[#1a5c38] text-[#f5deb3] dark:border-[#00ffff] dark:bg-[#00ffff] dark:text-black'
                          : 'border-[#800000]/15 bg-[#fff8ea]/75 text-[#800000] dark:border-[#bf00ff]/20 dark:bg-[#170018]/72 dark:text-white'
                        }`}
                      >
                        <span className="block leading-4">{mode.replace(' Mode', '')}</span>
                      </button>
                    );
                  })}
                </div>

                <p className="text-xs leading-5 text-[#191970] dark:text-[#39ff14]">{modeDescriptions[selectedMode]}</p>
              </div>
            ) : null}
          </div>
        </header>

        <div className={`grid min-h-0 flex-1 ${isFullscreen ? 'grid-cols-1' : 'xl:grid-cols-[minmax(0,1fr)_340px]'}`}>
          <section className="flex min-h-0 flex-col border-b border-[#800000]/10 xl:border-b-0 xl:border-r dark:border-[#bf00ff]/20">
            <div ref={transcriptRef} className="flex-1 overflow-y-auto px-4 py-5 md:px-6">
              <div className={`mx-auto flex min-h-full w-full flex-col justify-end gap-4 pb-2 ${isFullscreen ? 'max-w-5xl' : 'max-w-4xl'}`}>
                {shouldRefillInTuckShop ? (
                  <div className="rounded-[1.75rem] border border-[#1a5c38]/20 bg-[#e4f4e6] px-5 py-4 text-sm text-[#1a5c38] dark:border-[#00ffff]/20 dark:bg-[#03181a] dark:text-[#7df9ff]">
                    <p className="font-semibold uppercase tracking-[0.18em]">AI Credits Exhausted</p>
                    <p className="mt-2 leading-6">Your free requests are finished and your personal AI credits are empty. Use the tuck shop to refill before sending another prompt.</p>
                    <button
                      type="button"
                      onClick={() => navigate(tuckShopPath)}
                      className="mt-3 rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#f5deb3] dark:bg-[#00ffff] dark:text-black"
                    >
                      Open Tuck Shop Refill
                    </button>
                  </div>
                ) : null}

                {messages.map(message => {
                  const isUser = message.role === 'user';
                  const isAssistant = message.role === 'assistant';
                  return (
                    <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <div className={`rounded-[1.75rem] px-4 py-3 shadow-sm ${isUser ? 'max-w-[88%]' : 'w-full max-w-[96%]'} ${isUser
                        ? 'bg-[#1a5c38] text-[#f5deb3] dark:bg-[#00ffff] dark:text-black'
                        : 'border border-[#800000]/10 bg-white/70 text-[#191970] dark:border-[#bf00ff]/20 dark:bg-[#191970]/35 dark:text-white'
                      }`}>
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">
                          <span>{isUser ? 'You' : 'Ndovera AI'}</span>
                          {message.mode ? <span>{message.mode}</span> : null}
                          {isAssistant && message.source ? <span>{resolveSourceLabel(message.source)}</span> : null}
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-[15px] leading-8">{message.text}</p>
                        {isAssistant && message.chargedCredits > 0 ? (
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

            <div className="shrink-0 border-t border-[#800000]/10 bg-[#fff8ea]/92 p-4 backdrop-blur md:p-5 dark:border-[#bf00ff]/20 dark:bg-[#170018]/90">
              <div className="mx-auto w-full max-w-4xl">
                {error ? (
                  <div className="mb-3 rounded-2xl border border-red-300/60 bg-red-50 px-4 py-3 text-sm font-semibold text-[#800000] dark:border-[#ff5f8d]/35 dark:bg-[#4a0014] dark:text-white">
                    {error}
                  </div>
                ) : null}

                <textarea
                  ref={composerRef}
                  value={input}
                  onChange={event => setInput(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  rows={1}
                  placeholder="Example: Explain why we borrow in subtraction and give me one practice question."
                  className="w-full min-h-[84px] max-h-[220px] resize-none rounded-[1.5rem] border border-[#800000]/15 bg-white/70 px-4 py-4 text-[15px] leading-7 text-[#191970] outline-none transition focus:border-[#1a5c38] focus:ring-4 focus:ring-[#1a5c38]/10 dark:border-[#bf00ff]/20 dark:bg-[#191970]/35 dark:text-white"
                />

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-[#bf00ff]">
                    Academic prompts only.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => { setInput(''); setError(''); }}
                      className="rounded-2xl border border-[#800000]/20 px-4 py-3 text-sm font-semibold text-[#800000] dark:border-[#bf00ff]/25 dark:text-white"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={ask}
                      disabled={asking || loadingAccess || !input.trim() || shouldRefillInTuckShop}
                      className="rounded-2xl bg-[#1a5c38] px-5 py-3 text-sm font-bold text-[#f5deb3] transition hover:bg-[#154a2e] disabled:opacity-60 dark:bg-[#00ffff] dark:text-black dark:hover:bg-[#7dfcff]"
                    >
                      {asking ? 'Thinking...' : 'Ask Ndovera AI'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className={`min-h-0 flex-col gap-4 overflow-y-auto border-t border-[#800000]/10 bg-[#fff8ea]/55 p-4 dark:border-[#bf00ff]/20 dark:bg-[#180013]/55 ${isFullscreen ? 'hidden' : 'hidden xl:flex'}`}>
            <section className="rounded-[1.75rem] border border-[#800000]/10 bg-white/60 p-4 dark:border-[#bf00ff]/20 dark:bg-[#191970]/35">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#800020] dark:text-[#bf00ff]">Current Mode</p>
              <h3 className="mt-2 text-xl font-semibold text-[#800000] dark:text-white">{selectedMode}</h3>
              <p className="mt-2 text-sm leading-6 text-[#191970] dark:text-[#39ff14]">{modeDescriptions[selectedMode]}</p>
            </section>

            <section className="rounded-[1.75rem] border border-[#800000]/10 bg-white/60 p-4 dark:border-[#bf00ff]/20 dark:bg-[#191970]/35">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#800020] dark:text-[#bf00ff]">Wallet Guidance</p>
              <div className="mt-3 space-y-3 text-sm leading-6 text-[#191970] dark:text-[#39ff14]">
                <p>Free requests reset daily before credits are used.</p>
                <p>Individual billing users refill from the tuck shop. School-sponsored users depend on the school wallet.</p>
                <p>Current school credits: <span className="font-semibold text-[#800000] dark:text-white">{access?.wallet?.schoolCredits || 0}</span></p>
              </div>
              <button
                type="button"
                onClick={() => navigate(tuckShopPath)}
                className="mt-4 w-full rounded-2xl bg-[#1a5c38] px-4 py-3 text-sm font-bold text-[#f5deb3] dark:bg-[#00ffff] dark:text-black"
              >
                Open Tuck Shop
              </button>
            </section>
          </aside>
        </div>
      </div>
    </StudentSectionShell>
  );
}

export default StudentProfessorAura;