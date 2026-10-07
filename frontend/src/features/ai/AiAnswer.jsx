import React, { createContext, useContext, useMemo } from 'react';
import { CARD_TITLES, parseAiAnswer } from './aiContent';
import RichContent from '../../shared/rich/RichContent';

// Renders an Ndovera AI answer as a small digital-textbook page: real headings,
// numbered steps, tables and styled cards, in Ndovera's own colours. Nothing is
// injected unsanitised — blocks are parsed here and their text rendered by the
// shared academic renderer (shared/rich), which sanitises first.

const CARD_STYLES = {
  definition: { icon: '📘', className: 'border-[#1a5c38] bg-[#e8f5ee] dark:bg-emerald-950/40' },
  example: { icon: '✏️', className: 'border-[#2447d8] bg-[#eef1ff] dark:bg-blue-950/40' },
  keypoint: { icon: '⭐', className: 'border-[#c9a96e] bg-[#fff6e0] dark:bg-amber-950/30' },
  note: { icon: '📝', className: 'border-[#c9a96e] bg-[#fff6e0] dark:bg-amber-950/30' },
  warning: { icon: '⚠️', className: 'border-[#800000] bg-[#fdecea] dark:bg-red-950/40' },
  tip: { icon: '💡', className: 'border-[#1a5c38] bg-[#eefaf3] dark:bg-emerald-950/30' },
  formula: { icon: '∑', className: 'border-[#191970] bg-[#eef0ff] dark:bg-indigo-950/40' },
  question: { icon: '❓', className: 'border-[#800020] bg-[#fdeef2] dark:bg-rose-950/40' },
};

// Answers sit on light bubbles in most places and on a dark one in Practice.
const OnDark = createContext(false);

// Inline text goes through Ndovera's shared renderer, so bold, italics, code and
// maths (\( \), $ $, \frac …) look the same here as in notes and papers. That
// renderer sanitises before it typesets, so an answer cannot inject markup.
function Inline({ text }) {
  const onDark = useContext(OnDark);
  return <RichContent inline text={text} className={onDark ? 'ndv-rich-ondark' : ''} />;
}

function Items({ items, ordered, start }) {
  if (!items?.length) return null;
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag start={ordered ? start : undefined} className={`space-y-1.5 pl-6 ${ordered ? 'list-decimal marker:font-bold marker:text-[#2447d8]' : 'list-disc marker:text-[#1a5c38]'}`}>
      {items.map((item, index) => <li key={index} className="pl-1"><Inline text={item} /></li>)}
    </Tag>
  );
}

function Block({ block }) {
  const onDark = useContext(OnDark);
  switch (block.type) {
    case 'heading': {
      const sizes = { 1: 'text-xl font-extrabold', 2: 'text-lg font-extrabold', 3: 'text-base font-bold' };
      const Tag = `h${block.level + 1}`;
      return <Tag className={`${sizes[block.level]} pt-1 ${onDark ? 'text-white' : 'text-[#800000] dark:text-white'}`}><Inline text={block.text} /></Tag>;
    }
    case 'paragraph':
      return <p><Inline text={block.text} /></p>;
    case 'list':
      return <Items items={block.items} ordered={block.ordered} start={block.start} />;
    case 'quote':
      return <blockquote className="border-l-4 border-[#c9a96e] pl-3 italic text-slate-700 dark:text-slate-300"><Inline text={block.text} /></blockquote>;
    case 'code':
      return <pre className="overflow-x-auto rounded-xl bg-[#191970] p-3 text-[13px] leading-6 text-white"><code>{block.text}</code></pre>;
    case 'formula': {
      // LaTeX is typeset; a formula written in words keeps its own wording.
      const tex = String(block.text || '').trim().replace(/^\$\$|\$\$$/g, '').replace(/^\\\[|\\\]$/g, '');
      const isTex = /\\[a-zA-Z]|[\^_]\{/.test(tex);
      return (
        <div className="overflow-x-auto rounded-xl border border-[#191970]/20 bg-white px-4 py-3 text-center text-lg text-[#191970] dark:bg-slate-900 dark:text-indigo-100">
          {isTex ? <RichContent text={`$$${tex}$$`} /> : <span className="font-serif italic"><Inline text={block.text} /></span>}
        </div>
      );
    }
    case 'divider':
      return <hr className="border-[#7cc4e8]/40" />;
    case 'table':
      return (
        <div className="overflow-x-auto rounded-xl border border-[#7cc4e8]/40">
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead className="bg-[#2447d8] text-white">
              <tr>{block.header.map((cell, index) => <th key={index} className="px-3 py-2 font-bold"><Inline text={cell} /></th>)}</tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="odd:bg-white even:bg-[#cfecf7]/30 dark:odd:bg-slate-900 dark:even:bg-slate-800">
                  {row.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-2 align-top"><Inline text={cell} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'card': {
      const style = CARD_STYLES[block.kind] || CARD_STYLES.note;
      return (
        <section aria-label={CARD_TITLES[block.kind]} className={`space-y-2 rounded-xl border-l-4 p-3 ${style.className} text-[#191970] dark:text-slate-100`}>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#800020] dark:text-rose-200">
            <span aria-hidden className="mr-1">{style.icon}</span>{CARD_TITLES[block.kind]}
          </p>
          {block.text ? <p><Inline text={block.text} /></p> : null}
          <Items items={block.items} ordered={block.ordered} start={1} />
        </section>
      );
    }
    default:
      return null;
  }
}

// Cards, tables and formulas keep their light surfaces on a dark bubble, so
// their contents use the light-surface colours.
const LIGHT_SURFACE_BLOCKS = new Set(['card', 'table', 'formula']);

function SurfaceBlock({ block }) {
  if (!LIGHT_SURFACE_BLOCKS.has(block.type)) return <Block block={block} />;
  return <OnDark.Provider value={false}><Block block={block} /></OnDark.Provider>;
}

/** An AI answer, from its text (or already-parsed blocks). */
export default function AiAnswer({ text, blocks, className = '', onDark = false }) {
  const parsed = useMemo(() => parseAiAnswer(blocks || text), [blocks, text]);
  return (
    <OnDark.Provider value={onDark}>
      <div className={`space-y-3 break-words text-[15px] leading-7 ${onDark ? 'text-slate-100' : 'text-[#191970] dark:text-slate-100'} ${className}`}>
        {parsed.map((block, index) => <SurfaceBlock key={index} block={block} />)}
      </div>
    </OnDark.Provider>
  );
}
