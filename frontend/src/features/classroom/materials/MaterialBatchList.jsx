import React from 'react';

// One upload batch: several files sharing a class, subject, topic, week and
// audience, each with its own title and note, its own progress and its own
// result. A file that fails is retried on its own; it never fails the batch.
//
//   Mathematics · Week 4
//   - Fractions.pdf            — Uploaded
//   - Introduction.mp4         — Failed → Retry

const FIELD = 'w-full rounded-xl border border-[#c9a96e]/45 bg-white px-2 py-1 text-sm text-[#191970] disabled:opacity-60 dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-white';

const STATUS = {
  queued: { label: 'Waiting', className: 'text-[#800020] dark:text-[#bf00ff]' },
  uploading: { label: 'Uploading', className: 'text-[#191970] dark:text-white' },
  uploaded: { label: 'Uploaded', className: 'text-emerald-700 dark:text-emerald-300' },
  failed: { label: 'Failed', className: 'text-red-700 dark:text-red-300' },
};

function formatSize(bytes) {
  const size = Number(bytes || 0);
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

export default function MaterialBatchList({ heading, items, progress, busy, onChange, onRemove, onRetry, onClearFinished }) {
  if (!items.length) return null;
  const finished = items.filter(item => item.status === 'uploaded').length;
  const failed = items.filter(item => item.status === 'failed').length;

  return (
    <section aria-label="Files to upload" className="rounded-2xl border border-[#c9a96e]/35 bg-[#fff8f0] p-3 dark:border-[#bf00ff]/30 dark:bg-black/20">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="flex-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#800020] dark:text-[#bf00ff]">
          {heading || 'Files'} — {items.length} file{items.length === 1 ? '' : 's'}
          {finished ? ` · ${finished} uploaded` : ''}{failed ? ` · ${failed} failed` : ''}
        </p>
        {finished > 0 && (
          <button type="button" disabled={busy} onClick={onClearFinished} className="rounded-xl px-2 py-1 text-xs font-semibold text-[#1a5c38] hover:underline disabled:opacity-50 dark:text-[#00ffff]">
            Clear uploaded
          </button>
        )}
      </div>
      <ol className="space-y-2">
        {items.map(item => {
          const state = STATUS[item.status] || STATUS.queued;
          const locked = busy || item.status === 'uploaded' || item.status === 'uploading';
          const pct = progress[item.key] || 0;
          return (
            <li key={item.key} className="rounded-xl border border-[#c9a96e]/35 bg-[#b5e3f4] p-3 dark:border-[#bf00ff]/30 dark:bg-[#35002b]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#191970] dark:text-white" title={item.file.name}>
                  {item.file.name} <span className="font-normal text-[#800020] dark:text-[#bf00ff]">· {formatSize(item.file.size)}</span>
                </span>
                <span role="status" className={`text-xs font-bold ${state.className}`}>
                  {item.status === 'uploading' ? `${state.label} ${pct}%` : state.label}
                </span>
                {item.status === 'failed' && (
                  <button type="button" disabled={busy} onClick={() => onRetry(item.key)} className="rounded-xl bg-[#800020] px-2 py-1 text-xs font-bold text-[#b5e3f4] disabled:opacity-50">Retry</button>
                )}
                {item.status !== 'uploading' && item.status !== 'uploaded' && (
                  <button type="button" disabled={busy} onClick={() => onRemove(item.key)} className="rounded-xl border border-[#800000]/25 bg-white/70 px-2 py-1 text-xs font-semibold text-[#800000] disabled:opacity-50 dark:bg-black/20 dark:text-white">Remove</button>
                )}
              </div>
              {item.status === 'uploading' && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/70" aria-hidden>
                  <div className="h-full bg-[#1a5c38] transition-all" style={{ width: `${pct}%` }} />
                </div>
              )}
              {item.status === 'failed' && item.error && <p className="mt-1 text-xs text-red-700 dark:text-red-300">{item.error}</p>}
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <label className="text-[11px] font-semibold text-[#800020] dark:text-[#bf00ff]">Title
                  <input value={item.title} disabled={locked} onChange={event => onChange(item.key, { title: event.target.value })} className={FIELD} />
                </label>
                <label className="text-[11px] font-semibold text-[#800020] dark:text-[#bf00ff]">Note for this file (optional)
                  <input value={item.description} disabled={locked} onChange={event => onChange(item.key, { description: event.target.value })} placeholder="Uses the lesson note above if left blank" className={FIELD} />
                </label>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
