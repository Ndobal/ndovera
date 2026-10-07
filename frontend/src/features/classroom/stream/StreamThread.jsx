import React, { useLayoutEffect, useRef, useState } from 'react';

/**
 * A text box that starts one line tall and grows with what is typed, up to
 * `maxRows`, then scrolls. Keeps compose areas small on phones so the stream
 * itself gets the screen.
 */
export function AutoGrowTextarea({ value, maxRows = 6, className = '', onKeyDown, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    const style = window.getComputedStyle(element);
    const lineHeight = parseFloat(style.lineHeight) || 20;
    const padding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    const border = (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);
    const max = lineHeight * maxRows + padding + border;
    element.style.height = `${Math.min(element.scrollHeight + border, max)}px`;
    element.style.overflowY = element.scrollHeight + border > max ? 'auto' : 'hidden';
  }, [value, maxRows]);
  return <textarea ref={ref} rows={1} value={value} onKeyDown={onKeyDown} className={`resize-none ${className}`} {...props} />;
}

const VISIBLE_WHEN_COLLAPSED = 2;

// Student pages keep their fixed light palette; teacher pages also follow dark mode.
const TONES = {
  student: {
    toggle: 'text-[#1a5c38] hover:text-[#154a2e]',
    bubble: 'bg-[#fff8f0] border-[#c9a96e]/35',
    name: 'text-[#800000]',
    role: 'text-[#800020]/80',
    text: 'text-[#191970]',
    time: 'text-[#191970]/55',
    avatar: 'bg-[#b5e3f4] border-[#c9a96e]/60 text-[#191970]',
    input: 'border-[#c9a96e]/60 bg-[#fff8f0] text-[#191970] placeholder:text-[#800020]/60',
    send: 'bg-[#1a5c38] text-[#b5e3f4]',
  },
  teacher: {
    toggle: 'text-[#1a5c38] hover:text-[#154a2e] dark:text-[#00ffff]',
    bubble: 'bg-white/70 border-[#c9a96e]/35 dark:bg-black/25 dark:border-[#bf00ff]/25',
    name: 'text-[#800000] dark:text-[#ffffff]',
    role: 'text-[#800020]/80 dark:text-[#bf00ff]',
    text: 'text-[#191970] dark:text-slate-100',
    time: 'text-[#191970]/55 dark:text-slate-400',
    avatar: 'bg-[#b5e3f4] border-[#c9a96e]/60 text-[#191970] dark:bg-black/30 dark:border-[#bf00ff]/35 dark:text-white',
    input: 'border-[#c9a96e]/60 bg-white/80 text-[#191970] placeholder:text-[#800020]/60 dark:border-[#bf00ff]/35 dark:bg-black/25 dark:text-white dark:placeholder:text-slate-400',
    send: 'bg-[#1a5c38] text-[#b5e3f4] dark:bg-[#00ffff] dark:text-black',
  },
};

function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || '?';
}

function shortTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return date.toLocaleDateString();
}

/**
 * The comment thread under a stream post. Long threads open showing the latest
 * two comments with a "View all" toggle, so the stream stays readable; opened,
 * the whole thread shows in full. Replies are typed in a one-line box that grows.
 */
export default function StreamThread({
  comments = [],
  onSubmit,
  disabled = false,
  placeholder = 'Write a comment…',
  disabledPlaceholder = 'Comments are turned off',
  tone = 'student',
  formatText = value => String(value || ''),
}) {
  const palette = TONES[tone] || TONES.student;
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const hidden = expanded ? 0 : Math.max(0, comments.length - VISIBLE_WHEN_COLLAPSED);
  const visible = comments.slice(hidden);

  async function send() {
    const text = draft.trim();
    if (!text || disabled || sending || !onSubmit) return;
    setSending(true);
    setError('');
    try {
      await onSubmit(text);
      setDraft('');
      setExpanded(true);
    } catch (sendError) {
      // Keep what was typed so it can be sent again.
      setError(sendError?.message || 'Could not send your comment. Try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      {comments.length > VISIBLE_WHEN_COLLAPSED && (
        <button type="button" onClick={() => setExpanded(open => !open)} className={`text-xs font-bold ${palette.toggle}`}>
          {expanded ? 'Show fewer comments' : `View all ${comments.length} comments`}
        </button>
      )}

      {visible.length > 0 && (
        <ul className="space-y-2">
          {visible.map((comment, index) => {
            const name = comment?.user || comment?.authorName || comment?.authorId || 'Class member';
            const role = comment?.postedByLabel || (comment?.authorRole && comment.authorRole !== 'student' ? comment.authorRole : '');
            return (
              <li key={comment?.id || index} className="flex items-start gap-2">
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${palette.avatar}`} aria-hidden="true">
                  {initials(name)}
                </span>
                <div className={`min-w-0 flex-1 rounded-2xl border px-3 py-2 ${palette.bubble}`}>
                  <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
                    <span className={`font-semibold ${palette.name}`}>{name}</span>
                    {role && <span className={`font-semibold uppercase tracking-wide text-[10px] ${palette.role}`}>{role}</span>}
                    {shortTime(comment?.createdAt) && <span className={palette.time}>{shortTime(comment.createdAt)}</span>}
                  </p>
                  <p className={`mt-0.5 whitespace-pre-wrap break-words text-sm leading-6 ${palette.text}`}>{formatText(comment?.text || comment?.content || '')}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {onSubmit && (
        <div className="flex items-end gap-2">
          <AutoGrowTextarea
            value={draft}
            maxRows={5}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            disabled={disabled}
            aria-label="Comment"
            placeholder={disabled ? disabledPlaceholder : placeholder}
            className={`min-w-0 flex-1 rounded-2xl border px-3 py-2 text-sm leading-5 outline-none disabled:opacity-60 ${palette.input}`}
          />
          <button
            type="button"
            onClick={send}
            disabled={disabled || sending || !draft.trim()}
            aria-label="Send comment"
            title="Send comment"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition disabled:opacity-40 ${palette.send}`}
          >
            ➤
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-300">{error}</p>}
    </div>
  );
}
