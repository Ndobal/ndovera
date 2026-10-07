import React, { useMemo, useState } from 'react';
import RichContent from '../../shared/rich/RichContent';
import { figureToSvg } from '../../shared/rich/figures';

// Ndovera AI material blocks, drawn natively: formulae with KaTeX, graphs by
// Ndovera's figure renderer, tables as tables, questions as cards. Used in the
// teacher's preview; published materials render through StructuredMaterialView.

const LEVEL = { easy: 'Easy', intermediate: 'Intermediate', exam: 'Examination standard', challenging: 'Challenging' };
const FIELD = 'w-full rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970] dark:border-white/15 dark:bg-slate-950 dark:text-slate-100';
export const BLOCK_LABELS = {
  heading: 'Heading', paragraph: 'Paragraph', definition: 'Definition', list: 'List', formula: 'Formula', worked_example: 'Worked example', table: 'Table',
  graph: 'Graph', image: 'Illustration', exam_tip: 'Exam tip', common_mistake: 'Common mistake', note: 'Note', summary: 'Summary', question: 'Question',
  flashcard: 'Flashcard', activity: 'Activity',
};

function Callout({ label, tone, children }) {
  return (
    <section className={`rounded-xl border-l-4 p-3 ${tone}`} aria-label={label}>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#800020]">{label}</p>
      {children}
    </section>
  );
}

function Figure({ figure }) {
  const { svg, error } = useMemo(() => figureToSvg(figure), [figure]);
  if (!svg) return <p className="text-sm text-rose-700">[{error}]</p>;
  // figureToSvg draws from numbers and escaped labels only.
  return <div className="ndv-figure mx-auto max-w-xl" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function QuestionCard({ block, number, label }) {
  const [shown, setShown] = useState(false);
  return (
    <section className="rounded-2xl border border-[#c9a96e]/45 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
      <p className="mb-1 text-xs font-bold text-[#800020]">{number}. {label} · {LEVEL[block.level] || 'Practice'}{block.marks ? ` · ${block.marks} mark${block.marks === 1 ? '' : 's'}` : ''}</p>
      <RichContent text={block.prompt} className="text-[15px] text-[#191970] dark:text-slate-100" />
      {block.options?.length > 0 && (
        <ol className="mt-2 space-y-1 text-sm text-[#191970] dark:text-slate-200">
          {block.options.map((option, index) => <li key={index} className="flex gap-2"><span className="font-bold">{String.fromCharCode(65 + index)}.</span><RichContent inline text={option} /></li>)}
        </ol>
      )}
      {(block.answer || block.solution || block.markingGuide?.length > 0) && (
        <div className="mt-2">
          <button type="button" className="text-xs font-bold text-[#1a5c38] underline" onClick={() => setShown(value => !value)}>{shown ? 'Hide answer' : 'Show answer'}</button>
          {shown && (
            <div className="mt-2 space-y-1 rounded-xl bg-[#e8f5ee] p-3 text-sm text-[#191970]">
              {block.answer && <div><strong>Answer:</strong> <RichContent inline text={block.answer} /></div>}
              {block.solution && <div><strong>Solution:</strong><RichContent text={block.solution} /></div>}
              {block.markingGuide?.length > 0 && <div><strong>Marking guide:</strong><ul className="list-disc pl-5">{block.markingGuide.map((point, index) => <li key={index}><RichContent inline text={point} /></li>)}</ul></div>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function Flashcard({ front, back }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button type="button" onClick={() => setFlipped(value => !value)} aria-pressed={flipped}
      className={`flex min-h-[96px] w-full flex-col justify-center rounded-2xl border p-4 text-left shadow-sm transition-colors ${flipped ? 'border-[#1a5c38] bg-[#e8f5ee]' : 'border-[#c9a96e]/50 bg-[#fff8f0]'}`}>
      <span className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#800020]">{flipped ? 'Answer' : 'Flashcard — tap to turn'}</span>
      <RichContent text={flipped ? back : front} className="text-[15px] text-[#191970]" />
    </button>
  );
}

export function AiBlockView({ block, number = 0, questionLabel = 'Practice Question' }) {
  switch (block.type) {
    case 'heading': return <h4 className="pt-1 text-base font-bold text-[#1a5c38]">{block.text}</h4>;
    case 'paragraph': return <RichContent text={block.text} />;
    case 'definition': return <Callout label="Definition" tone="border-[#1a5c38] bg-[#e8f5ee]">{block.term && <p className="font-bold text-[#1a5c38]">{block.term}</p>}<RichContent text={block.text} /></Callout>;
    case 'note': return <Callout label="Note" tone="border-[#c9a96e] bg-[#fff6e0]"><RichContent text={block.text} /></Callout>;
    case 'exam_tip': return <Callout label="Exam tip" tone="border-[#191970] bg-[#eef0ff]"><RichContent text={block.text} /></Callout>;
    case 'common_mistake': return <Callout label="Common mistake" tone="border-rose-500 bg-rose-50"><RichContent text={block.text} /></Callout>;
    case 'list': case 'summary': case 'activity': {
      const Tag = block.ordered ? 'ol' : 'ul';
      const list = <>{block.text && <p className="font-bold text-[#800020]">{block.text}</p>}<Tag className={`space-y-1 pl-6 ${block.ordered ? 'list-decimal' : 'list-disc'}`}>{(block.items || []).map((item, index) => <li key={index}><RichContent inline text={item} /></li>)}</Tag></>;
      if (block.type === 'summary') return <Callout label="Summary" tone="border-[#800000] bg-[#fbe9e4]">{list}</Callout>;
      if (block.type === 'activity') return <Callout label="Activity" tone="border-[#800020] bg-[#fdeef2]">{list}</Callout>;
      return <div>{list}</div>;
    }
    case 'formula': return <div className="rounded-xl bg-white/70 p-2 text-center"><RichContent text={`$$${block.latex}$$`} />{block.caption && <p className="text-xs italic text-[#800020]">{block.caption}</p>}</div>;
    case 'worked_example': return (
      <Callout label="Worked example" tone="border-[#191970] bg-[#eef0ff]">
        <RichContent text={block.question} className="font-semibold" />
        <ol className="mt-2 list-decimal space-y-1 pl-6">{block.steps.map((step, index) => <li key={index}><RichContent inline text={step} /></li>)}</ol>
        {block.answer && <p className="mt-2 font-bold text-[#1a5c38]">Answer: <RichContent inline text={block.answer} /></p>}
      </Callout>
    );
    case 'table': return (
      <figure>
        {block.caption && <figcaption className="mb-1 text-xs font-semibold italic text-[#800020]">{block.caption}</figcaption>}
        <div className="overflow-x-auto"><table className="min-w-full border-collapse text-sm">
          <thead><tr>{block.columns.map((cell, index) => <th key={index} className="border border-[#c9a96e]/60 bg-[#fff6e0] px-2 py-1 text-left"><RichContent inline text={cell} /></th>)}</tr></thead>
          <tbody>{block.rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c} className="border border-[#c9a96e]/40 px-2 py-1"><RichContent inline text={cell} /></td>)}</tr>)}</tbody>
        </table></div>
      </figure>
    );
    case 'graph': return <figure><Figure figure={block.figure} />{block.caption && <figcaption className="text-center text-xs italic text-[#800020]">{block.caption}</figcaption>}</figure>;
    case 'image': return (
      <figure className="text-center">
        {block.url
          ? <img src={block.url} alt={block.caption || block.prompt} className="mx-auto max-h-80 rounded-xl border border-[#c9a96e]/40" />
          : <div className="rounded-xl border border-dashed border-[#c9a96e] p-4 text-sm text-[#800020]">Illustration {block.status === 'limit' ? 'not drawn — your school\'s limit is reached' : block.status === 'failed' ? 'could not be drawn' : 'waiting to be drawn'}: {block.prompt}</div>}
        {block.caption && <figcaption className="text-xs italic text-[#800020]">{block.caption}</figcaption>}
      </figure>
    );
    case 'question': return <QuestionCard block={block} number={number} label={questionLabel} />;
    case 'flashcard': return <Flashcard front={block.front} back={block.back} />;
    default: return <RichContent text={block.text || ''} />;
  }
}

const lines = value => String(value || '').split('\n').map(item => item.trim()).filter(Boolean);

/** Edits one block in place, field by field, with a live preview. */
export function AiBlockEditor({ block, onChange }) {
  const set = patch => onChange({ ...block, ...patch });
  const [figureText, setFigureText] = useState(() => JSON.stringify(block.figure || {}, null, 1));
  const [tableText, setTableText] = useState(() => [block.columns || [], ...(block.rows || [])].map(row => row.join(' | ')).join('\n'));
  const text = (key, rows = 3, label = 'Text') => (
    <label className="block text-xs font-semibold text-[#800020]">{label}
      <textarea rows={rows} className={FIELD} value={block[key] || ''} onChange={event => set({ [key]: event.target.value })} />
    </label>
  );
  switch (block.type) {
    case 'heading': case 'paragraph': case 'note': case 'exam_tip': case 'common_mistake':
      return text('text', block.type === 'heading' ? 1 : 4);
    case 'definition':
      return <div className="space-y-2"><label className="block text-xs font-semibold text-[#800020]">Term<input className={FIELD} value={block.term || ''} onChange={event => set({ term: event.target.value })} /></label>{text('text', 3, 'Definition')}</div>;
    case 'list': case 'summary': case 'activity':
      return <div className="space-y-2">{text('text', 1, 'Title (optional)')}<label className="block text-xs font-semibold text-[#800020]">Items — one per line<textarea rows={5} className={FIELD} value={(block.items || []).join('\n')} onChange={event => set({ items: lines(event.target.value) })} /></label></div>;
    case 'formula':
      return <div className="space-y-2">{text('latex', 2, 'LaTeX')}{text('caption', 1, 'Caption')}</div>;
    case 'worked_example':
      return <div className="space-y-2">{text('question', 2, 'Question')}<label className="block text-xs font-semibold text-[#800020]">Steps — one per line<textarea rows={5} className={FIELD} value={(block.steps || []).join('\n')} onChange={event => set({ steps: lines(event.target.value) })} /></label>{text('answer', 1, 'Answer')}</div>;
    case 'table':
      return (
        <div className="space-y-2">
          {text('caption', 1, 'Caption')}
          <label className="block text-xs font-semibold text-[#800020]">First line: column headings. Separate cells with |
            <textarea rows={6} className={`${FIELD} font-mono`} value={tableText} onChange={event => {
              setTableText(event.target.value);
              const [columns = [], ...rows] = lines(event.target.value).map(row => row.split('|').map(cell => cell.trim()));
              set({ columns, rows });
            }} />
          </label>
        </div>
      );
    case 'graph':
      return (
        <div className="space-y-2">
          {text('caption', 1, 'Caption')}
          <label className="block text-xs font-semibold text-[#800020]">Graph data (JSON)
            <textarea rows={8} className={`${FIELD} font-mono text-xs`} value={figureText} onChange={event => {
              setFigureText(event.target.value);
              try { set({ figure: JSON.parse(event.target.value) }); } catch { /* keep typing */ }
            }} />
          </label>
        </div>
      );
    case 'image':
      return <div className="space-y-2">{text('caption', 1, 'Caption')}{text('prompt', 2, 'What the illustration shows')}</div>;
    case 'question':
      return (
        <div className="space-y-2">
          {text('prompt', 3, 'Question')}
          <div className="flex flex-wrap gap-2">
            <label className="text-xs font-semibold text-[#800020]">Style <select className={FIELD} value={block.style} onChange={event => set({ style: event.target.value })}>{['objective', 'theory', 'structured', 'short'].map(style => <option key={style} value={style}>{style}</option>)}</select></label>
            <label className="text-xs font-semibold text-[#800020]">Level <select className={FIELD} value={block.level} onChange={event => set({ level: event.target.value })}>{Object.entries(LEVEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className="text-xs font-semibold text-[#800020]">Marks <input type="number" min="0" className={`${FIELD} w-20`} value={block.marks || 0} onChange={event => set({ marks: Number(event.target.value) || 0 })} /></label>
          </div>
          {block.style === 'objective' && <label className="block text-xs font-semibold text-[#800020]">Options — one per line<textarea rows={4} className={FIELD} value={(block.options || []).join('\n')} onChange={event => set({ options: lines(event.target.value) })} /></label>}
          {block.style === 'objective'
            ? <label className="block text-xs font-semibold text-[#800020]">Correct option <select className={FIELD} value={Math.max(0, block.answerIndex ?? 0)} onChange={event => { const index = Number(event.target.value); set({ answerIndex: index, answer: String.fromCharCode(65 + index) }); }}>{(block.options || []).map((option, index) => <option key={index} value={index}>{String.fromCharCode(65 + index)}. {option}</option>)}</select></label>
            : text('answer', 2, 'Answer')}
          {text('solution', 3, 'Solution / working')}
          <label className="block text-xs font-semibold text-[#800020]">Marking guide — one point per line<textarea rows={3} className={FIELD} value={(block.markingGuide || []).join('\n')} onChange={event => set({ markingGuide: lines(event.target.value) })} /></label>
        </div>
      );
    case 'flashcard':
      return <div className="space-y-2">{text('front', 2, 'Front')}{text('back', 2, 'Back')}</div>;
    default:
      return text('text', 3);
  }
}
