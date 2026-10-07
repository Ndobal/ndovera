import React, { useMemo, useRef } from 'react';
import RichContent from '../../../shared/rich/RichContent';
import RichTextToolbar from '../../../shared/rich/RichTextToolbar';
import { looksRich } from '../../../shared/rich/richText';
import StructuredMaterialView from './StructuredMaterialView';
import { BLOCK_TYPES, blocksMatchText, detectStructure, hasMeaningfulStructure } from './materialStructure';

const FIELD = 'w-full rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] p-3 text-sm text-[#191970] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff]';
const BUTTON = 'rounded-xl border border-[#c9a96e]/45 bg-white/80 px-3 py-1.5 text-xs font-bold text-[#800020] hover:bg-white';

/**
 * The lesson-note composer. The teacher writes or pastes freely; Ndovera reads
 * the structure and offers to format it. Formatting only labels the teacher's
 * lines — it never changes a word — and each label can be corrected by hand.
 */
export default function StructuredMaterialEditor({ value, onChange, blocks, onBlocksChange, rows = 8, placeholder }) {
  const textareaRef = useRef(null);
  const detected = useMemo(() => detectStructure(value), [value]);
  const formatted = Array.isArray(blocks) && blocks.length > 0;
  const offer = !formatted && hasMeaningfulStructure(detected);
  const stale = formatted && !blocksMatchText(blocks, value);

  function setType(index, type) {
    onBlocksChange(blocks.map((block, position) => (position === index ? { ...block, type } : block)));
  }

  return (
    <div className="space-y-3">
      <RichTextToolbar textareaRef={textareaRef} value={value || ''} onChange={onChange} />
      <label className="block">
        <span className="sr-only">Lesson note</span>
        <textarea ref={textareaRef} value={value} onChange={event => onChange(event.target.value)} rows={rows} placeholder={placeholder} className={FIELD} />
      </label>

      {!formatted && looksRich(value) && (
        <div className="rounded-2xl border border-[#c9a96e]/45 bg-white p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#800020]">Preview — as students will see it</p>
          <RichContent text={value} className="text-[15px] text-[#191970]" />
        </div>
      )}

      {offer && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#1a5c38]/40 bg-[#e8f5ee] p-3 text-sm text-[#1a5c38]">
          <span className="flex-1 font-semibold">
            Ndovera found {detected.filter(block => block.type !== 'paragraph').length} structured parts — topic, headings, definitions, lists and more. Format it as a professional resource? Your wording stays exactly as written.
          </span>
          <button type="button" className="rounded-xl bg-[#1a5c38] px-3 py-1.5 text-xs font-bold text-[#b5e3f4]" onClick={() => onBlocksChange(detected)}>
            Apply formatting
          </button>
        </div>
      )}

      {formatted && (
        <div className="rounded-2xl border border-[#c9a96e]/45 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="flex-1 text-xs font-bold uppercase tracking-[0.16em] text-[#800020]">Formatted preview</p>
            {stale && (
              <button type="button" className={BUTTON} onClick={() => onBlocksChange(detected)}>
                Text changed — re-apply formatting
              </button>
            )}
            <button type="button" className={BUTTON} onClick={() => onBlocksChange([])}>Remove formatting</button>
          </div>
          <details className="mb-3">
            <summary className="cursor-pointer text-xs font-semibold text-[#191970]">Adjust how each part is labelled</summary>
            <ol className="mt-2 space-y-1">
              {blocks.map((block, index) => (
                <li key={index} className="flex items-center gap-2 text-xs text-[#191970]">
                  <select
                    aria-label={`Part ${index + 1} type`}
                    value={block.type}
                    onChange={event => setType(index, event.target.value)}
                    className="rounded-lg border border-[#c9a96e]/45 bg-[#fff8f0] p-1"
                  >
                    {BLOCK_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                  <span className="truncate">{block.text || (block.items || []).join(', ')}</span>
                </li>
              ))}
            </ol>
          </details>
          <StructuredMaterialView blocks={blocks} />
        </div>
      )}
    </div>
  );
}
