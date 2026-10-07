import React, { useMemo, useState } from 'react';
import RichContent from './RichContent';
import { htmlToTable, markdownToTable, tableToHtml, tableToMarkdown } from './richText';
import { FIGURE_TEMPLATES, figureToSvg } from './figures';

// Toolbar for any textarea holding academic text. Everything it inserts is
// plain text the shared renderer understands (Markdown tables, LaTeX in \( \)
// or $$ $$), so formatting survives save → reopen → student view → print
// without teachers needing to know either syntax.

const BTN = 'rounded-lg border border-[#c9a96e]/45 bg-white px-2 py-1 text-xs font-bold text-[#800020] hover:bg-[#fff6e0] disabled:opacity-40';
const FIELD = 'rounded-lg border border-[#c9a96e]/45 bg-white p-1.5 text-sm text-[#191970]';
const SYMBOLS = ['Σ', 'Δ', '%', '×', '÷', '±', '≤', '≥', '≠', '≈', '°', '√', 'π', 'θ', 'α', 'β', 'λ', 'µ', '∞', '→', '₦', '²', '³', '½', '¼'];
const FORMULA_TEMPLATES = [
  ['Fraction', '\\frac{a}{b}'],
  ['Power', 'x^{2}'],
  ['Subscript', 'x_{1}'],
  ['Square root', '\\sqrt{x}'],
  ['nth root', '\\sqrt[n]{x}'],
  ['Summation', '\\sum_{i=1}^{n} x_i'],
  ['Brackets', '\\left( \\frac{a}{b} \\right)'],
  ['Percentage change', '\\text{Percentage Change} = \\frac{\\text{New Value} - \\text{Old Value}}{\\text{Old Value}} \\times 100'],
  ['Mean', '\\bar{x} = \\frac{\\sum x}{n}'],
  ['Quadratic formula', 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}'],
  ['Times / divide', 'a \\times b \\div c'],
  ['Less / greater or equal', 'a \\le b \\ge c'],
];

/** Insert text at the textarea's cursor (or replace the selection) and keep the cursor after it. */
function insertAt(textarea, value, onChange, insertion, { wrap } = {}) {
  const start = textarea?.selectionStart ?? value.length;
  const end = textarea?.selectionEnd ?? value.length;
  const selected = value.slice(start, end);
  const text = wrap ? `${wrap[0]}${selected || wrap[2] || ''}${wrap[1]}` : insertion;
  const next = value.slice(0, start) + text + value.slice(end);
  onChange(next);
  requestAnimationFrame(() => {
    if (!textarea) return;
    textarea.focus();
    const caret = start + text.length;
    textarea.setSelectionRange(caret, caret);
  });
}

/** Prefix every selected line (headings, bullets, numbering, quotes). */
function prefixLines(textarea, value, onChange, makePrefix) {
  const start = textarea?.selectionStart ?? value.length;
  const end = textarea?.selectionEnd ?? value.length;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const lineEndIndex = value.indexOf('\n', end);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const block = value.slice(lineStart, lineEnd).split('\n').map((line, index) => `${makePrefix(index)}${line.replace(/^(#{1,6}\s+|[-*]\s+|\d+\.\s+|>\s?)/, '')}`).join('\n');
  onChange(value.slice(0, lineStart) + block + value.slice(lineEnd));
}

/** The table the cursor sits in, if any — Markdown, or HTML when cells are merged. */
function tableAtCursor(value, cursor) {
  if (cursor < 0) return null;
  // HTML table (merged cells) around the cursor.
  const open = value.lastIndexOf('<table', cursor);
  if (open !== -1) {
    const close = value.indexOf('</table>', open);
    if (close !== -1 && cursor <= close + 8) {
      const endOffset = close + '</table>'.length;
      const parsed = htmlToTable(value.slice(open, endOffset));
      if (parsed) return { ...parsed, startOffset: open, endOffset };
    }
  }
  const lines = value.split('\n');
  let offset = 0;
  let lineIndex = 0;
  for (; lineIndex < lines.length; lineIndex += 1) {
    if (cursor <= offset + lines[lineIndex].length) break;
    offset += lines[lineIndex].length + 1;
  }
  if (!lines[lineIndex]?.trim().startsWith('|')) return null;
  let first = lineIndex;
  let last = lineIndex;
  while (first > 0 && lines[first - 1].trim().startsWith('|')) first -= 1;
  while (last + 1 < lines.length && lines[last + 1].trim().startsWith('|')) last += 1;
  const parsed = markdownToTable(lines.slice(first, last + 1).join('\n'));
  if (!parsed) return null;
  const startOffset = lines.slice(0, first).reduce((sum, line) => sum + line.length + 1, 0);
  const endOffset = startOffset + lines.slice(first, last + 1).join('\n').length;
  return { ...parsed, spans: {}, hasHeader: true, startOffset, endOffset };
}

/** Cells hidden under a merge, as "row,col" keys. */
function coveredCells(spans) {
  const covered = new Set();
  Object.entries(spans).forEach(([key, span]) => {
    const [r, c] = key.split(',').map(Number);
    for (let dr = 0; dr < (span.rowspan || 1); dr += 1) for (let dc = 0; dc < (span.colspan || 1); dc += 1) if (dr || dc) covered.add(`${r + dr},${c + dc}`);
  });
  return covered;
}

function TableDialog({ initial, onInsert, onClose }) {
  const [rows, setRows] = useState(initial?.rows || [['Heading 1', 'Heading 2', 'Heading 3'], ['', '', ''], ['', '', '']]);
  const [align, setAlign] = useState(initial?.align || []);
  const [hasHeader, setHasHeader] = useState(initial?.hasHeader ?? true);
  const [spans, setSpans] = useState(initial?.spans || {});
  const [selected, setSelected] = useState(null);
  const width = Math.max(...rows.map(row => row.length), 1);
  const covered = coveredCells(spans);
  const merged = Object.keys(spans).length > 0;
  // Structural edits clear merges that would no longer fit.
  const resetSpans = () => { setSpans({}); setSelected(null); };
  const setCell = (r, c, value) => setRows(previous => previous.map((row, ri) => (ri === r ? Array.from({ length: width }, (_, ci) => (ci === c ? value : row[ci] ?? '')) : row)));
  const addRow = () => setRows(previous => [...previous, Array(width).fill('')]);
  const addColumn = () => setRows(previous => previous.map((row, ri) => [...row, ri === 0 ? `Heading ${width + 1}` : '']));
  const removeRow = r => { if (rows.length <= 2) return; resetSpans(); setRows(previous => previous.filter((_, ri) => ri !== r)); };
  const removeColumn = c => { if (width <= 1) return; resetSpans(); setRows(previous => previous.map(row => row.filter((_, ci) => ci !== c))); setAlign(previous => previous.filter((_, ci) => ci !== c)); };

  function merge(direction) {
    if (!selected) return;
    const [r, c] = selected;
    const span = spans[`${r},${c}`] || { colspan: 1, rowspan: 1 };
    const next = direction === 'right' ? { ...span, colspan: (span.colspan || 1) + 1 } : { ...span, rowspan: (span.rowspan || 1) + 1 };
    if (c + (next.colspan || 1) > width || r + (next.rowspan || 1) > rows.length) return;
    // Never merge into a cell that already belongs to another merge.
    const test = { ...spans, [`${r},${c}`]: next };
    const covers = coveredCells(test);
    const clash = Object.keys(spans).some(key => key !== `${r},${c}` && covers.has(key));
    if (clash) return;
    setSpans(test);
  }
  function split() {
    if (!selected) return;
    setSpans(previous => { const next = { ...previous }; delete next[`${selected[0]},${selected[1]}`]; return next; });
  }

  const output = merged ? tableToHtml(rows, align, spans, hasHeader) : tableToMarkdown(hasHeader ? rows : [Array(width).fill(' '), ...rows], align);

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#191970]/60 p-3" role="dialog" aria-modal="true" aria-label="Table editor">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-5 text-[#191970] shadow-2xl">
        <h2 className="text-lg font-black text-[#800000]">{initial ? 'Edit table' : 'Insert table'}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className={BTN} onClick={addRow}>+ Row</button>
          <button type="button" className={BTN} onClick={addColumn}>+ Column</button>
          <label className="flex items-center gap-1 text-xs font-semibold"><input type="checkbox" checked={hasHeader} onChange={event => setHasHeader(event.target.checked)} /> First row is the header</label>
          <span className="mx-1 h-5 w-px bg-[#c9a96e]/50" />
          <span className="text-xs font-semibold">{selected ? `Cell R${selected[0] + 1} C${selected[1] + 1}:` : 'Click a cell to merge:'}</span>
          <button type="button" className={BTN} disabled={!selected} onClick={() => merge('right')}>Merge right</button>
          <button type="button" className={BTN} disabled={!selected} onClick={() => merge('down')}>Merge down</button>
          <button type="button" className={BTN} disabled={!selected || !spans[`${selected?.[0]},${selected?.[1]}`]} onClick={split}>Split</button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="border-collapse text-sm">
            <thead>
              <tr>
                {Array.from({ length: width }, (_, c) => (
                  <th key={c} className="p-1">
                    <div className="flex items-center gap-1">
                      <select aria-label={`Column ${c + 1} alignment`} className={FIELD} value={align[c] || ''} onChange={event => setAlign(previous => { const next = [...previous]; next[c] = event.target.value; return next; })}>
                        <option value="">Left</option><option value="center">Centre</option><option value="right">Right</option>
                      </select>
                      <button type="button" className={BTN} aria-label={`Delete column ${c + 1}`} onClick={() => removeColumn(c)} disabled={width <= 1}>✕</button>
                    </div>
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {Array.from({ length: width }, (_, c) => {
                    if (covered.has(`${r},${c}`)) return null;
                    const span = spans[`${r},${c}`] || {};
                    const isSelected = selected && selected[0] === r && selected[1] === c;
                    return (
                      <td key={c} colSpan={span.colspan || 1} rowSpan={span.rowspan || 1} className={`p-1 align-top ${isSelected ? 'bg-[#fff6e0] ring-2 ring-[#800020]' : ''}`} onClick={() => setSelected([r, c])}>
                        <textarea rows={span.rowspan > 1 ? span.rowspan * 2 : 1} aria-label={`Row ${r + 1} column ${c + 1}`} className={`${FIELD} w-full min-w-[8rem] ${r === 0 && hasHeader ? 'font-bold' : ''}`} value={row[c] ?? ''} onFocus={() => setSelected([r, c])} onChange={event => setCell(r, c, event.target.value)} />
                      </td>
                    );
                  })}
                  <td className="p-1"><button type="button" className={BTN} aria-label={`Delete row ${r + 1}`} onClick={() => removeRow(r)} disabled={rows.length <= 2}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs font-bold uppercase tracking-wide text-[#800020]">Preview</p>
        <div className="rounded-xl border border-[#c9a96e]/40 p-3"><RichContent text={output} /></div>
        <p className="mt-2 text-xs text-[#191970]/70">Cells can hold formulas too, e.g. {'\\(\\frac{1}{2}\\)'}. Adding or deleting rows and columns clears merges.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={BTN} onClick={onClose}>Cancel</button>
          <button type="button" className="rounded-lg bg-[#1a5c38] px-4 py-1.5 text-sm font-bold text-[#b5e3f4]" onClick={() => onInsert(output)}>{initial ? 'Update table' : 'Insert table'}</button>
        </div>
      </div>
    </div>
  );
}

/** Graphs, charts, geometry, circuits: start from a template, edit the numbers, see it drawn. */
function FigureDialog({ initial, onInsert, onClose }) {
  const [json, setJson] = useState(initial || JSON.stringify(FIGURE_TEMPLATES[0][1], null, 2));
  const drawn = useMemo(() => figureToSvg(json), [json]);
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#191970]/60 p-3" role="dialog" aria-modal="true" aria-label="Figure editor">
      <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-5 text-[#191970] shadow-2xl">
        <h2 className="text-lg font-black text-[#800000]">{initial ? 'Edit figure' : 'Insert graph, chart or diagram'}</h2>
        <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[#800020]">Start from</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {FIGURE_TEMPLATES.map(([label, spec]) => <button key={label} type="button" className={BTN} onClick={() => setJson(JSON.stringify(spec, null, 2))}>{label}</button>)}
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <label className="block text-xs font-bold uppercase tracking-wide text-[#800020]">Figure details (change the numbers and labels)
            <textarea rows={18} spellCheck={false} className={`${FIELD} mt-1 w-full font-mono text-xs`} value={json} onChange={event => setJson(event.target.value)} />
          </label>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#800020]">Preview</p>
            <div className="mt-1 flex min-h-[12rem] items-center justify-center rounded-xl border border-[#c9a96e]/40 p-2">
              {drawn.svg ? <div className="w-full" dangerouslySetInnerHTML={{ __html: drawn.svg }} /> : <p role="alert" className="text-sm font-semibold text-rose-700">{drawn.error}</p>}
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={BTN} onClick={onClose}>Cancel</button>
          <button type="button" className="rounded-lg bg-[#1a5c38] px-4 py-1.5 text-sm font-bold text-[#b5e3f4] disabled:opacity-50" disabled={!drawn.svg} onClick={() => onInsert(`\n\n\u0060\u0060\u0060figure\n${JSON.stringify(JSON.parse(json))}\n\u0060\u0060\u0060\n\n`)}>{initial ? 'Update figure' : 'Insert figure'}</button>
        </div>
      </div>
    </div>
  );
}

/** The figure block the cursor sits in, if any. */
function figureAtCursor(value, cursor) {
  if (cursor < 0) return null;
  const open = value.lastIndexOf('\u0060\u0060\u0060figure', cursor);
  if (open === -1) return null;
  const close = value.indexOf('\u0060\u0060\u0060', open + 9);
  if (close === -1 || cursor > close + 3) return null;
  const body = value.slice(open + 9, close).trim();
  try { return { json: JSON.stringify(JSON.parse(body), null, 2), startOffset: open, endOffset: close + 3 }; } catch { return { json: body, startOffset: open, endOffset: close + 3 }; }
}

function FormulaDialog({ onInsert, onClose }) {
  const [tex, setTex] = useState('\\frac{a}{b}');
  const [display, setDisplay] = useState(true);
  const preview = useMemo(() => (display ? `$$${tex}$$` : `\\(${tex}\\)`), [tex, display]);
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#191970]/60 p-3" role="dialog" aria-modal="true" aria-label="Equation editor">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 text-[#191970] shadow-2xl">
        <h2 className="text-lg font-black text-[#800000]">Insert formula</h2>
        <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[#800020]">Start from a template</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {FORMULA_TEMPLATES.map(([label, value]) => <button key={label} type="button" className={BTN} onClick={() => setTex(value)}>{label}</button>)}
        </div>
        <label className="mt-3 block text-xs font-bold uppercase tracking-wide text-[#800020]" htmlFor="ndv-formula-tex">Formula (LaTeX — edit the letters and numbers)</label>
        <textarea id="ndv-formula-tex" rows={3} className={`${FIELD} mt-1 w-full font-mono`} value={tex} onChange={event => setTex(event.target.value)} />
        <div className="mt-2 flex flex-wrap gap-1">
          {['\\times', '\\div', '\\pm', '\\le', '\\ge', '\\neq', '\\approx', '\\Delta', '\\Sigma', '\\pi', '\\theta', '^{\\circ}', '\\%'].map(symbol => (
            <button key={symbol} type="button" className={`${BTN} font-mono`} onClick={() => setTex(previous => `${previous} ${symbol}`)}>{symbol}</button>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={display} onChange={event => setDisplay(event.target.checked)} /> On its own line (uncheck to place inside a sentence)</label>
        <p className="mt-3 text-xs font-bold uppercase tracking-wide text-[#800020]">Preview</p>
        <div className="min-h-[3rem] rounded-xl border border-[#c9a96e]/40 p-3 text-lg"><RichContent text={preview} /></div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={BTN} onClick={onClose}>Cancel</button>
          <button type="button" className="rounded-lg bg-[#1a5c38] px-4 py-1.5 text-sm font-bold text-[#b5e3f4]" disabled={!tex.trim()} onClick={() => onInsert(display ? `\n$$${tex.trim()}$$\n` : `\\(${tex.trim()}\\)`)}>Insert formula</button>
        </div>
      </div>
    </div>
  );
}

/** Formatting toolbar for a textarea (pass its ref). */
export default function RichTextToolbar({ textareaRef, value, onChange }) {
  const [dialog, setDialog] = useState(null);
  const [showSymbols, setShowSymbols] = useState(false);
  const area = () => textareaRef.current;
  const wrap = (before, after, placeholder) => insertAt(area(), value, onChange, '', { wrap: [before, after, placeholder] });

  function openTable() {
    const existing = tableAtCursor(value, area()?.selectionStart ?? -1);
    setDialog({ type: 'table', existing });
  }

  function insertTable(markdown) {
    const existing = dialog?.existing;
    if (existing) onChange(value.slice(0, existing.startOffset) + markdown + value.slice(existing.endOffset));
    else insertAt(area(), value, onChange, `\n\n${markdown}\n\n`);
    setDialog(null);
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Formatting">
        <button type="button" className={BTN} title="Bold" onClick={() => wrap('**', '**', 'bold text')}><strong>B</strong></button>
        <button type="button" className={BTN} title="Italic" onClick={() => wrap('*', '*', 'italic text')}><em>I</em></button>
        <button type="button" className={BTN} title="Heading" onClick={() => prefixLines(area(), value, onChange, () => '## ')}>H2</button>
        <button type="button" className={BTN} title="Subheading" onClick={() => prefixLines(area(), value, onChange, () => '### ')}>H3</button>
        <button type="button" className={BTN} title="Bulleted list" onClick={() => prefixLines(area(), value, onChange, () => '- ')}>• List</button>
        <button type="button" className={BTN} title="Numbered list" onClick={() => prefixLines(area(), value, onChange, index => `${index + 1}. `)}>1. List</button>
        <button type="button" className={BTN} title="Quote / important definition" onClick={() => prefixLines(area(), value, onChange, () => '> ')}>❝ Quote</button>
        <button type="button" className={BTN} title="Superscript" onClick={() => wrap('<sup>', '</sup>', '2')}>X²</button>
        <button type="button" className={BTN} title="Subscript" onClick={() => wrap('<sub>', '</sub>', '2')}>X₂</button>
        <button type="button" className={BTN} title="Centre" onClick={() => wrap('<div align="center">\n\n', '\n\n</div>', 'centred text')}>≡ Centre</button>
        <button type="button" className={`${BTN} !bg-[#e8f5ee] !text-[#1a5c38]`} onClick={openTable}>▦ Table</button>
        <button type="button" className={`${BTN} !bg-[#eef0ff] !text-[#191970]`} onClick={() => setDialog({ type: 'formula' })}>∑ Formula</button>
        <button type="button" className={`${BTN} !bg-[#fff6e0] !text-[#800000]`} onClick={() => setDialog({ type: 'figure', existing: figureAtCursor(value, area()?.selectionStart ?? -1) })}>📈 Graph / Diagram</button>
        <button type="button" className={BTN} aria-expanded={showSymbols} onClick={() => setShowSymbols(open => !open)}>Ω Symbols</button>
      </div>
      {showSymbols && (
        <div className="flex flex-wrap gap-1 rounded-xl border border-[#c9a96e]/40 bg-white p-2" aria-label="Symbols">
          {SYMBOLS.map(symbol => <button key={symbol} type="button" className={`${BTN} min-w-[2rem]`} onClick={() => insertAt(area(), value, onChange, symbol)}>{symbol}</button>)}
        </div>
      )}
      {dialog?.type === 'table' && <TableDialog initial={dialog.existing} onInsert={insertTable} onClose={() => setDialog(null)} />}
      {dialog?.type === 'formula' && <FormulaDialog onInsert={text => { insertAt(area(), value, onChange, text); setDialog(null); }} onClose={() => setDialog(null)} />}
      {dialog?.type === 'figure' && (
        <FigureDialog
          initial={dialog.existing?.json}
          onClose={() => setDialog(null)}
          onInsert={block => {
            const existing = dialog.existing;
            if (existing) onChange(value.slice(0, existing.startOffset) + block.trim() + value.slice(existing.endOffset));
            else insertAt(area(), value, onChange, block);
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}
