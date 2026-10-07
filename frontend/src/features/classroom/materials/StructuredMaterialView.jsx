import React, { useState } from 'react';
import RichContent from '../../../shared/rich/RichContent';
import { Flashcard } from '../../material-ai/AiBlocks';

// Renders a structured lesson note. Presentation (case, spacing, callouts) lives
// here in the styles; the stored text is exactly what the teacher wrote.

const CALLOUTS = {
  definition: { label: 'Definition', className: 'border-[#1a5c38] bg-[#e8f5ee]' },
  example: { label: 'Example', className: 'border-[#191970] bg-[#eef0ff]' },
  note: { label: 'Note', className: 'border-[#c9a96e] bg-[#fff6e0]' },
  exercise: { label: 'Exercise / Activity', className: 'border-[#800020] bg-[#fdeef2]' },
  assignment: { label: 'Assignment', className: 'border-[#800000] bg-[#fbe9e4]' },
  worked_example: { label: 'Worked example', className: 'border-[#191970] bg-[#eef0ff]' },
  exam_tip: { label: 'Exam tip', className: 'border-[#191970] bg-[#eef0ff]' },
  common_mistake: { label: 'Common mistake', className: 'border-rose-500 bg-rose-50' },
  summary: { label: 'Summary', className: 'border-[#800000] bg-[#fbe9e4]' },
};

// A practice question from Ndovera AI: options lettered, the answer only when the student asks.
function QuestionBlock({ block }) {
  const [shown, setShown] = useState(false);
  return (
    <section className="rounded-2xl border border-[#c9a96e]/45 bg-white p-4" aria-label="Practice question">
      <RichContent text={block.text} />
      {block.items?.length > 0 && (
        <ol className="mt-2 space-y-1 text-sm">
          {block.items.map((item, index) => <li key={index} className="flex gap-2"><span className="font-bold">{String.fromCharCode(65 + index)}.</span><RichContent inline text={item} /></li>)}
        </ol>
      )}
      {block.answer && (
        <div className="mt-2">
          <button type="button" className="text-xs font-bold text-[#1a5c38] underline" onClick={() => setShown(value => !value)}>{shown ? 'Hide answer' : 'Show answer'}</button>
          {shown && <RichContent text={block.answer} className="mt-2 rounded-xl bg-[#e8f5ee] p-3 text-sm" />}
        </div>
      )}
    </section>
  );
}

function Items({ block }) {
  if (!block.items?.length) return null;
  const Tag = block.ordered ? 'ol' : 'ul';
  return (
    <Tag className={`mt-2 space-y-1 pl-6 ${block.ordered ? 'list-decimal' : 'list-disc'}`}>
      {block.items.map((item, index) => <li key={index}><RichContent inline text={item} /></li>)}
    </Tag>
  );
}

// Headings may arrive as Markdown ("### Price Index"); the marks are layout, not words.
const headingText = text => <RichContent inline text={String(text || '').replace(/^\s*#{1,6}\s+/, '')} />;

// A heading such as "Exercise" followed by its questions shows as one card.
function groupBlocks(blocks) {
  const groups = [];
  for (const block of blocks || []) {
    const last = groups[groups.length - 1];
    if (last && CALLOUTS[block.type] && last.type === block.type && ['exercise', 'assignment'].includes(block.type)) {
      last.parts.push(block);
    } else {
      groups.push({ type: block.type, parts: [block] });
    }
  }
  return groups;
}

export default function StructuredMaterialView({ blocks, className = '' }) {
  return (
    <div className={`space-y-3 text-[15px] leading-7 text-[#191970] ${className}`}>
      {groupBlocks(blocks).map((group, index) => {
        const [block] = group.parts;
        switch (group.type) {
          case 'topic':
            return <h1 key={index} className="text-2xl font-black capitalize text-[#800000]">{headingText(block.text)}</h1>;
          case 'subtopic':
            return <h2 key={index} className="text-xl font-bold capitalize text-[#800020]">{headingText(block.text)}</h2>;
          case 'heading':
            return <h3 key={index} className="pt-2 text-lg font-bold capitalize text-[#800000]">{headingText(block.text)}</h3>;
          case 'subheading':
            return <h4 key={index} className="pt-1 text-base font-bold capitalize text-[#1a5c38]">{headingText(block.text)}</h4>;
          case 'list':
            return (
              <div key={index}>
                {block.text ? <p className="font-bold capitalize text-[#800020]">{headingText(block.text)}</p> : null}
                <Items block={block} />
              </div>
            );
          case 'paragraph':
            return <RichContent key={index} text={block.text} />;
          // Formulae, tables, graphs and illustrations carry their content as rich text, drawn natively.
          case 'formula':
            return <RichContent key={index} text={block.text} className="rounded-xl bg-white/70 p-2 text-center" />;
          case 'table':
          case 'figure':
          case 'image':
            return <RichContent key={index} text={block.text} className="text-center [&_table]:text-left" />;
          case 'question':
            return <QuestionBlock key={index} block={block} />;
          case 'flashcard':
            return <Flashcard key={index} front={block.text} back={block.answer || ''} />;
          default: {
            const callout = CALLOUTS[group.type];
            if (!callout) return <RichContent key={index} text={block.text} />;
            return (
              <section key={index} className={`rounded-xl border-l-4 p-4 ${callout.className}`} aria-label={callout.label}>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#800020]">{callout.label}</p>
                {group.parts.map((part, partIndex) => (
                  <div key={partIndex}>
                    {part.text ? <RichContent text={part.text} /> : null}
                    <Items block={part} />
                  </div>
                ))}
              </section>
            );
          }
        }
      })}
    </div>
  );
}
