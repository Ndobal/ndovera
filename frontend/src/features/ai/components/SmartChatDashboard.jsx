import React, { useEffect, useRef } from 'react';
import { PaperAirplaneIcon, PlusIcon, SparklesIcon, MicrophoneIcon, PaperClipIcon } from '@heroicons/react/24/outline';

const TONE = {
  free: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  credits: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  billing: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  price: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  blocked: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  neutral: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
};

function Avatar({ small }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#2447d8] to-[#5b8def] text-white shadow ${small ? 'h-8 w-8 text-sm' : 'h-10 w-10'}`}>
      <SparklesIcon className={small ? 'h-4 w-4' : 'h-5 w-5'} />
    </span>
  );
}

export default function SmartChatDashboard({
  aiName = 'Ndovera AI',
  subtitle = '',
  messages = [],
  input = '',
  onInputChange,
  onSend,
  sending = false,
  placeholder = 'Message Ndovera AI…',
  suggestions = [],
  statusChips = [],
  onNewChat,
  leftPanel = null,
  headerActions = null,
  blockedNotice = null,
  error = '',
  inputDisabled = false,
  renderMeta,
}) {
  const transcriptRef = useRef(null);
  const composerRef = useRef(null);

  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [messages, error]);

  useEffect(() => {
    if (!composerRef.current) return;
    composerRef.current.style.height = '0px';
    composerRef.current.style.height = `${Math.min(Math.max(composerRef.current.scrollHeight, 44), 160)}px`;
  }, [input]);

  const realMessages = messages.filter(m => m.role === 'user' || (m.role === 'assistant' && m.id !== 'welcome'));
  const isEmpty = realMessages.length === 0;

  function submit(e) {
    e?.preventDefault?.();
    if (sending || inputDisabled || !String(input).trim()) return;
    onSend?.();
  }
  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden rounded-3xl border border-[#7cc4e8]/50 bg-white shadow-[0_20px_50px_rgba(20,33,91,0.12)] dark:border-white/10 dark:bg-slate-900">
      {/* Left rail */}
      <aside className="hidden w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r border-[#7cc4e8]/40 bg-gradient-to-b from-[#cfecf7]/60 to-white p-4 lg:flex dark:border-white/10 dark:from-slate-950/50 dark:to-slate-900">
        <div className="flex items-center gap-3">
          <Avatar />
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-[#191970] dark:text-white">{aiName}</p>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Online</p>
          </div>
        </div>

        {onNewChat ? (
          <button type="button" onClick={onNewChat} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2447d8] px-4 py-2.5 text-sm font-bold text-white shadow transition hover:bg-[#1b34a8]">
            <PlusIcon className="h-4 w-4" /> New chat
          </button>
        ) : null}

        {leftPanel}

        {suggestions.length > 0 ? (
          <div>
            <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-[#2447d8]">Suggestions</p>
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <button key={i} type="button" onClick={() => onSend?.(s.prompt || s.label)} className="block w-full rounded-xl border border-[#7cc4e8]/40 bg-white px-3 py-2 text-left text-xs font-semibold text-[#191970] transition hover:border-[#2447d8] hover:bg-[#cfecf7]/40 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200">
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {statusChips.length > 0 ? (
          <div className="mt-auto grid grid-cols-2 gap-2">
            {statusChips.map((c, i) => (
              <div key={i} className={`rounded-xl px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide ${TONE[c.tone] || TONE.neutral}`}>{c.label}</div>
            ))}
          </div>
        ) : null}
      </aside>

      {/* Main chat */}
      <section className="flex min-h-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 border-b border-[#7cc4e8]/40 bg-white/80 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-slate-900/80">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar small />
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-[#191970] dark:text-white">{aiName}</p>
              {subtitle ? <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {statusChips.slice(0, 3).map((c, i) => (
                <span key={i} className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[10px] font-bold uppercase tracking-wide ${TONE[c.tone] || TONE.neutral}`}>{c.label}</span>
              ))}
            </div>
            {onNewChat ? (
              <button type="button" onClick={onNewChat} title="New chat" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2447d8]/10 text-[#2447d8] lg:hidden dark:text-blue-300">
                <PlusIcon className="h-4 w-4" />
              </button>
            ) : null}
            {headerActions}
          </div>
        </header>

        {/* Transcript */}
        <div ref={transcriptRef} className="flex-1 overflow-y-auto px-3 py-4 sm:px-6">
          {blockedNotice}
          {isEmpty && !blockedNotice ? (
            <div className="mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-10 text-center">
              <Avatar />
              <h3 className="mt-4 text-xl font-extrabold text-[#191970] dark:text-white">How can I help you today?</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle || 'Ask me anything to get started.'}</p>
              {suggestions.length > 0 ? (
                <div className="mt-5 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                  {suggestions.slice(0, 4).map((s, i) => (
                    <button key={i} type="button" onClick={() => onSend?.(s.prompt || s.label)} className="rounded-2xl border border-[#7cc4e8]/40 bg-[#cfecf7]/30 px-4 py-3 text-left text-sm font-semibold text-[#191970] transition hover:border-[#2447d8] hover:bg-[#cfecf7]/60 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200">
                      {s.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-4 pb-2">
              {messages.map(message => {
                const isUser = message.role === 'user';
                return (
                  <div key={message.id} className={`flex items-end gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    {!isUser ? <Avatar small /> : null}
                    <div className={`max-w-[84%] rounded-2xl px-4 py-2.5 text-sm leading-7 shadow-sm ${isUser
                      ? 'rounded-br-md bg-gradient-to-br from-[#2447d8] to-[#1b34a8] text-white'
                      : 'rounded-bl-md border border-[#7cc4e8]/40 bg-[#cfecf7]/30 text-[#191970] dark:border-white/10 dark:bg-slate-800 dark:text-slate-100'}`}>
                      {!isUser ? (
                        <p className="mb-1 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-[#2447d8] dark:text-blue-400">
                          <span>{aiName}</span>
                          {renderMeta ? renderMeta(message) : null}
                        </p>
                      ) : null}
                      <p className="whitespace-pre-wrap">{message.text}</p>
                    </div>
                  </div>
                );
              })}
              {sending ? (
                <div className="flex items-end gap-2.5">
                  <Avatar small />
                  <div className="rounded-2xl rounded-bl-md border border-[#7cc4e8]/40 bg-[#cfecf7]/30 px-4 py-3 dark:border-white/10 dark:bg-slate-800">
                    <span className="flex gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-[#2447d8]" style={{ animationDelay: '0ms' }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-[#2447d8]" style={{ animationDelay: '120ms' }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-[#2447d8]" style={{ animationDelay: '240ms' }} />
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-[#7cc4e8]/40 bg-white/80 p-3 backdrop-blur sm:p-4 dark:border-white/10 dark:bg-slate-900/80">
          {error ? <div className="mx-auto mb-2 max-w-3xl rounded-xl border border-rose-300/60 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-200">{error}</div> : null}
          <form onSubmit={submit} className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-[#7cc4e8]/50 bg-[#cfecf7]/30 px-3 py-2 dark:border-white/10 dark:bg-slate-800">
            <span className="hidden gap-1 pb-1.5 text-slate-400 sm:flex">
              <PaperClipIcon className="h-5 w-5" />
              <MicrophoneIcon className="h-5 w-5" />
            </span>
            <textarea
              ref={composerRef}
              value={input}
              onChange={e => onInputChange?.(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              disabled={inputDisabled}
              placeholder={placeholder}
              className="max-h-40 min-h-[44px] flex-1 resize-none border-0 bg-transparent py-2 text-[15px] leading-7 text-[#191970] outline-none placeholder:text-slate-400 disabled:opacity-60 dark:text-white"
            />
            <button type="submit" disabled={sending || inputDisabled || !String(input).trim()} className="mb-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#2447d8] text-white shadow transition hover:bg-[#1b34a8] disabled:opacity-50">
              <PaperAirplaneIcon className="h-5 w-5" />
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
