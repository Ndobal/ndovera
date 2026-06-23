import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StudentSectionShell from './StudentSectionShell';
import SmartChatDashboard from '../../../features/ai/components/SmartChatDashboard';
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

const SUGGESTIONS = [
  { label: '➗ Explain borrowing in subtraction', prompt: 'Explain why we borrow in subtraction and give me one practice question.' },
  { label: '🧪 Give me 5 practice questions', prompt: 'Give me 5 practice questions on the parts of a plant with answers.' },
  { label: '📖 Summarize a topic for revision', prompt: 'Summarize the water cycle for exam revision in 6 short points.' },
  { label: '🎯 Help my weak area in fractions', prompt: 'I keep making mistakes with adding fractions. Help me understand step by step.' },
];

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
  if (source === 'free') return 'Free request';
  if (source === 'school_credits') return 'School credit';
  return 'Personal credit';
}

function StudentProfessorAura({ viewerRole = 'student', dashboardLabel = 'Student Dashboard', tuckShopPath = '/roles/student/tuck-shop' }) {
  const navigate = useNavigate();
  const chatSessionKey = `student-professor-aura:${String(viewerRole || 'student').trim().toLowerCase()}`;
  const persisted = readChatSession(chatSessionKey, { selectedMode: modes[0], messages: buildWelcomeMessage(viewerRole) });
  const [selectedMode, setSelectedMode] = useState(() => modes.includes(persisted.selectedMode) ? persisted.selectedMode : modes[0]);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(() => Array.isArray(persisted.messages) && persisted.messages.length ? persisted.messages : buildWelcomeMessage(viewerRole));
  const [accessPayload, setAccessPayload] = useState(null);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function onFsChange() { setIsFullscreen(Boolean(document.fullscreenElement)); }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else containerRef.current?.requestFullscreen?.();
  }

  const access = accessPayload?.access || null;

  useEffect(() => {
    const next = readChatSession(chatSessionKey, { selectedMode: modes[0], messages: buildWelcomeMessage(viewerRole) });
    setSelectedMode(modes.includes(next.selectedMode) ? next.selectedMode : modes[0]);
    setMessages(Array.isArray(next.messages) && next.messages.length ? next.messages : buildWelcomeMessage(viewerRole));
    setInput(''); setError('');
  }, [chatSessionKey, viewerRole]);

  useEffect(() => { writeChatSession(chatSessionKey, { selectedMode, messages }); }, [chatSessionKey, messages, selectedMode]);

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

  const shouldRefillInTuckShop = access?.policy?.billingModel === 'individual'
    && Number(access?.usage?.remainingFreeRequests || 0) <= 0
    && Number(access?.wallet?.availableCredits || 0) <= 0;

  const statusChips = useMemo(() => {
    if (!access) return [{ label: loadingAccess ? 'Loading…' : 'AI unavailable', tone: 'neutral' }];
    const free = Number(access.usage.remainingFreeRequests || 0);
    const credits = Number(access.wallet.availableCredits || 0);
    return [
      { label: `${free}/${access.usage.dailyFreeRequests} Free`, tone: free > 0 ? 'free' : 'blocked' },
      { label: `${credits} Credits`, tone: credits > 0 ? 'credits' : 'neutral' },
      { label: access.policy.billingModel === 'school' ? 'School billing' : 'Individual', tone: 'billing' },
      { label: access.policy.pricePerCreditNaira > 0 ? currencyFormatter.format(access.policy.pricePerCreditNaira) : 'No price', tone: 'price' },
    ];
  }, [access, loadingAccess]);

  async function ask(prefilled) {
    const prompt = String(prefilled || input).trim();
    if (!prompt || asking || shouldRefillInTuckShop) return;
    setMessages(current => [...current, { id: `prompt_${Date.now()}`, role: 'user', text: prompt, mode: selectedMode }]);
    setAsking(true); setError(''); setInput('');
    try {
      const data = await askAiTutor({ prompt, mode: selectedMode });
      setMessages(current => [...current, { id: `reply_${Date.now()}`, role: 'assistant', text: data.answer, mode: selectedMode, source: data.source, chargedCredits: data.chargedCredits || 0 }]);
      setAccessPayload(current => ({ ...(current || {}), access: data.access, management: current?.management || {} }));
    } catch (e) {
      setError(e.message || 'Could not process the AI request.');
      if (e.data?.access) setAccessPayload(current => ({ ...(current || {}), access: e.data.access, management: current?.management || {} }));
    } finally { setAsking(false); }
  }

  function newChat() { setMessages(buildWelcomeMessage(viewerRole)); setInput(''); setError(''); }

  const leftPanel = (
    <div className="space-y-3">
      <div className="rounded-2xl border border-[#7cc4e8]/40 bg-white p-3 dark:border-white/10 dark:bg-slate-800">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#2447d8]">Study modes</p>
        <div className="grid grid-cols-2 gap-1.5">
          {modes.map(mode => {
            const activeMode = selectedMode === mode;
            return (
              <button key={mode} type="button" onClick={() => setSelectedMode(mode)}
                className={`rounded-xl px-2 py-1.5 text-[11px] font-bold transition ${activeMode ? 'bg-[#2447d8] text-white shadow' : 'bg-[#cfecf7]/40 text-[#191970] hover:bg-[#cfecf7]/70 dark:bg-slate-700 dark:text-slate-200'}`}>
                {mode.replace(' Mode', '')}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">{modeDescriptions[selectedMode]}</p>
      </div>
      <div className="rounded-2xl border border-[#7cc4e8]/40 bg-white p-3 dark:border-white/10 dark:bg-slate-800">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#2447d8]">Wallet</p>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Free requests reset daily before credits are used. School credits: <b className="text-[#191970] dark:text-white">{access?.wallet?.schoolCredits || 0}</b></p>
        <button type="button" onClick={() => navigate(tuckShopPath)} className="mt-2 w-full rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700">Refill in Tuck Shop</button>
      </div>
    </div>
  );

  const headerActions = (
    <>
      <button type="button" onClick={() => navigate(tuckShopPath)} className="hidden h-7 items-center rounded-full bg-emerald-500/10 px-3 text-[11px] font-bold text-emerald-700 sm:inline-flex dark:text-emerald-300">Refill</button>
      <button type="button" onClick={toggleFullscreen} aria-label="Toggle fullscreen" className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#2447d8]/10 text-[#2447d8] dark:text-blue-300">{isFullscreen ? '✕' : '⛶'}</button>
    </>
  );

  return (
    <StudentSectionShell title="Ndovera AI" subtitle="Academic-only study assistant." dashboardLabel={dashboardLabel} compact hideHeader viewportLocked watermarkText="NDOVERA AI" diagonalWatermark>
      <div ref={containerRef} className="h-full min-h-0 pb-24 md:pb-0">
        <SmartChatDashboard
          aiName="Ndovera AI"
          subtitle={`${selectedMode} · academic study workspace`}
          messages={messages}
          input={input}
          onInputChange={setInput}
          onSend={ask}
          sending={asking}
          placeholder="Example: Explain why we borrow in subtraction and give me one practice question."
          suggestions={SUGGESTIONS}
          statusChips={statusChips}
          onNewChat={newChat}
          leftPanel={leftPanel}
          headerActions={headerActions}
          inputDisabled={shouldRefillInTuckShop || loadingAccess}
          error={error}
          renderMeta={(m) => (
            <>
              {m.mode ? <span>{m.mode.replace(' Mode', '')}</span> : null}
              {m.source ? <span>· {resolveSourceLabel(m.source)}</span> : null}
            </>
          )}
          blockedNotice={shouldRefillInTuckShop ? (
            <div className="mx-auto mb-4 max-w-3xl rounded-2xl border border-amber-400/40 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="font-bold uppercase tracking-wide">AI credits exhausted</p>
              <p className="mt-1 leading-6">Your free requests are finished and your personal AI credits are empty. Use the tuck shop to refill before sending another prompt.</p>
              <button type="button" onClick={() => navigate(tuckShopPath)} className="mt-3 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Open Tuck Shop Refill</button>
            </div>
          ) : null}
        />
      </div>
    </StudentSectionShell>
  );
}

export default StudentProfessorAura;
