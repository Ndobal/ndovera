import React, { useId, useRef, useState } from 'react';
import RichContent from '../../../shared/rich/RichContent';
import RichTextToolbar from '../../../shared/rich/RichTextToolbar';
import { looksRich } from '../../../shared/rich/richText';

export const FIELD = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#191970] focus:ring-2 focus:ring-[#191970]/15 dark:border-white/15 dark:bg-slate-800 dark:text-white';

/**
 * A text box for academic writing: formulas, fractions, symbols, tables, graphs and shapes
 * (the same tools as lesson notes) appear when "∑ Maths & more" is opened, and a preview
 * shows exactly what students will see. Saved as plain text the shared renderer reads.
 */
export default function RichField({ label, value, onChange, rows = 3, placeholder, compact = false, id }) {
  const ref = useRef(null);
  const autoId = useId();
  const fieldId = id || autoId;
  const [tools, setTools] = useState(false);
  const text = value || '';
  return (
    <div className="space-y-1.5">
      {(label || !compact) ? (
        <div className="flex items-center justify-between gap-2">
          {label ? <label htmlFor={fieldId} className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</label> : <span />}
          <button type="button" onClick={() => setTools(open => !open)} aria-expanded={tools}
            className={`rounded-lg px-2 py-0.5 text-xs font-bold ${tools ? 'bg-[#191970] text-white' : 'bg-[#eef0ff] text-[#191970] dark:bg-indigo-400/15 dark:text-indigo-200'}`}>
            ∑ Maths &amp; more
          </button>
        </div>
      ) : null}
      {tools ? <RichTextToolbar textareaRef={ref} value={text} onChange={onChange} /> : null}
      <div className={compact ? 'flex items-start gap-1.5' : ''}>
        <textarea id={fieldId} ref={ref} rows={rows} value={text} placeholder={placeholder} onChange={event => onChange(event.target.value)} className={`${FIELD} ${compact ? 'min-h-[42px] resize-y' : ''}`} />
        {compact ? (
          <button type="button" onClick={() => setTools(open => !open)} title="Maths, symbols, tables and diagrams" aria-label="Maths, symbols, tables and diagrams"
            className={`mt-1 shrink-0 rounded-lg px-2 py-1.5 text-xs font-black ${tools ? 'bg-[#191970] text-white' : 'bg-[#eef0ff] text-[#191970] dark:bg-indigo-400/15 dark:text-indigo-200'}`}>∑</button>
        ) : null}
      </div>
      {looksRich(text) ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 dark:border-white/15 dark:bg-white/5">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Students see</p>
          <RichContent text={text} className="text-[15px] text-slate-900 dark:text-white" />
        </div>
      ) : null}
    </div>
  );
}
