import { marked } from 'marked';
import DOMPurify from 'dompurify';
import katex from 'katex';
import { figureToSvg } from './figures';

// Ndovera's one renderer for academic text — teacher notes, student topic
// study, Ndovera AI answers, assignments, quizzes and exam papers.
//
//   source text → tidy (pasted tables, bare formulas) → lift out the maths
//   → Markdown (GFM tables, headings, lists, quotes) → sanitise → typeset maths
//
// The stored text is never changed; this only decides how it looks.

const LATEX_COMMAND = /\\(frac|dfrac|tfrac|sqrt|times|div|cdot|sum|prod|int|Delta|delta|Sigma|sigma|pi|theta|alpha|beta|gamma|lambda|mu|le|ge|leq|geq|neq|approx|pm|infty|text|left|right|overline|bar|hat|vec|log|ln|sin|cos|tan|circ|degree|%)\b|\\%/;
const BARE_FORMULA_LINE = /^[\s\\\w{}()[\]^_+\-*/=.,%×÷≤≥≠√Σ∆Δπ°|'":;<>!&]+$/;

/** Tab-separated rows pasted from a spreadsheet or document become a table. */
function tabsToTables(text) {
  const lines = text.split('\n');
  const out = [];
  for (let index = 0; index < lines.length;) {
    const columns = lines[index].includes('\t') ? lines[index].split('\t').length : 0;
    let end = index;
    while (columns > 1 && end < lines.length && lines[end].includes('\t') && lines[end].split('\t').length === columns) end += 1;
    if (end - index >= 2) {
      const rows = lines.slice(index, end).map(line => line.split('\t').map(cell => cell.trim().replace(/\|/g, '\\|')));
      out.push(`| ${rows[0].join(' | ')} |`, `| ${rows[0].map(() => '---').join(' | ')} |`, ...rows.slice(1).map(row => `| ${row.join(' | ')} |`), '');
      index = end;
    } else {
      out.push(lines[index]);
      index += 1;
    }
  }
  return out.join('\n');
}

/**
 * Pull every formula out before Markdown sees it (Markdown would eat the
 * backslashes and underscores), leaving a placeholder to typeset afterwards.
 */
function extractMath(text, store) {
  const keep = (tex, display) => {
    store.push({ tex: tex.trim(), display });
    return display ? `\n\nNDVMATH${store.length - 1}X\n\n` : `NDVMATH${store.length - 1}X`;
  };
  let result = text
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => keep(tex, true))
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, tex) => keep(tex, true))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, tex) => keep(tex, false))
    // $...$ only when it is clearly maths, so "$5 and $10" stays money.
    .replace(/\$([^\s$](?:[^$\n]*[^\s$])?)\$/g, (whole, tex) => (/[\\^_{}]/.test(tex) || /^[A-Za-z]$/.test(tex) ? keep(tex, false) : whole));
  // A line that is nothing but a LaTeX formula, written without delimiters.
  result = result.split('\n').map(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.includes('NDVMATH') && LATEX_COMMAND.test(trimmed) && BARE_FORMULA_LINE.test(trimmed) && !/^\|/.test(trimmed)) {
      return keep(trimmed, true).trim();
    }
    // Inline LaTeX commands inside a sentence: typeset the formula-looking run.
    return line.replace(/((?:\\[a-zA-Z]+(?:\{[^{}]*\}){0,2}|[\w.]+\s*[\^_]\s*\{[^{}]*\})(?:[\s\w.+\-*/=()^_{}]*(?:\\[a-zA-Z]+(?:\{[^{}]*\}){0,2}))*)/g, (match) => (LATEX_COMMAND.test(match) || /[\^_]\{/.test(match) ? keep(match, false) : match));
  }).join('\n');
  return result;
}

function typeset(tex, display) {
  try {
    return katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'html', strict: 'ignore' });
  } catch {
    return `<code>${tex.replace(/[<>&]/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[char]))}</code>`;
  }
}

const PURIFY = {
  ADD_ATTR: ['target', 'align', 'colspan', 'rowspan'],
  FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe', 'object', 'embed', 'script'],
};

const LINEAR = [
  [/\\(?:d|t)?frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)'], [/\\sqrt\{([^{}]*)\}/g, '√($1)'], [/\\text\{([^{}]*)\}/g, '$1'],
  [/\\times/g, '×'], [/\\div/g, '÷'], [/\\cdot/g, '·'], [/\\pm/g, '±'], [/\\le(q)?/g, '≤'], [/\\ge(q)?/g, '≥'], [/\\neq/g, '≠'], [/\\approx/g, '≈'],
  [/\\Delta/g, 'Δ'], [/\\Sigma/g, 'Σ'], [/\\sum/g, 'Σ'], [/\\pi/g, 'π'], [/\\theta/g, 'θ'], [/\\infty/g, '∞'], [/\\%/g, '%'], [/\^\{\\circ\}/g, '°'],
  [/\^\{([^{}]*)\}/g, '<sup>$1</sup>'], [/\^(\w)/g, '<sup>$1</sup>'], [/_\{([^{}]*)\}/g, '<sub>$1</sub>'], [/_(\w)/g, '<sub>$1</sub>'],
  [/\\left|\\right/g, ''], [/\\[a-zA-Z]+/g, ''], [/[{}]/g, ''],
];

/** A formula as readable linear text, for documents that cannot typeset (Word export). */
export function linearFormula(tex) {
  let out = String(tex || '').replace(/[<>&]/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[char]));
  for (let pass = 0; pass < 3; pass += 1) for (const [pattern, replacement] of LINEAR) out = out.replace(pattern, replacement);
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Render academic text to safe HTML. `inline` renders a single line (list items,
 * table cells, short answers); `linearMath` writes formulas as text instead of
 * typesetting them (for Word export).
 */
/**
 * ```figure blocks (graphs, charts, geometry, circuits — see figures.js) lifted
 * out before anything else touches the text, as NDVFIG<n>X placeholders.
 */
export function splitFigures(source) {
  const figures = [];
  const text = String(source || '').replace(/```figure[^\S\n]*\n?([\s\S]*?)```/g, (_, body) => {
    figures.push(body.trim());
    return `\n\nNDVFIG${figures.length - 1}X\n\n`;
  });
  return { text, figures };
}

function figureHtml(body) {
  const { svg, error } = figureToSvg(body);
  return svg ? `<figure class="ndv-figure">${svg}</figure>` : `<p class="ndv-figure-error">[${error}]</p>`;
}

const PIPE_ROW = /^\s*\|.*\|\s*$/;
const RULE_ROW = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const cellCount = line => line.trim().replace(/^\||\|$/g, '').split('|').length;

const INLINE_RULE = /\|(?:[ \t]*:?-{2,}:?[ \t]*\|)+/;
// "| 120 | | Inflation |": an empty cell between two rows of a table written on one line.
const INLINE_ROW_BREAK = /\S[ \t]*\|[ \t]+\|[ \t]*\S/;

/**
 * A one-line table with no |---| row: "…: | Variable | Before | After | | GDP | 100 | 120 | | CPI | 2 | 4 | What…".
 * Empty cells split it into rows; it is a table only when there are at least two
 * rows, every row has the same number (two or more) of non-empty cells.
 */
function unfoldRulelessTable(line) {
  if (/^\s*\|.*\|\s*$/.test(line) && !INLINE_ROW_BREAK.test(line)) return line;
  const first = line.indexOf('|');
  const last = line.lastIndexOf('|');
  if (first < 0 || last <= first) return line;
  const cells = line.slice(first + 1, last).split('|').map(cell => cell.trim());
  const rows = [[]];
  for (const cell of cells) {
    if (cell) rows[rows.length - 1].push(cell);
    else if (rows[rows.length - 1].length) rows.push([]);
  }
  if (!rows[rows.length - 1].length) rows.pop();
  const columns = rows[0].length;
  if (rows.length < 2 || columns < 2 || rows.some(row => row.length !== columns)) return line;
  const prefix = line.slice(0, first).trim();
  const suffix = line.slice(last + 1).trim();
  const [header, ...body] = rows.map(row => `| ${row.join(' | ')} |`);
  return [...(prefix ? [prefix, ''] : []), header, `|${' --- |'.repeat(columns)}`, ...body, ...(suffix ? ['', suffix] : [])].join('\n');
}

/**
 * A whole table written on one line, as pasted exam questions and some AI output
 * have it: "…variables: | Variable | Before | After | | --- | --- | --- | | GDP | 100 | 120 | What can…".
 * The rule row says how many columns there are; the header is the cells just
 * before it and the body is every following run of that many cells. The table is
 * then laid out one row per line, with the question text before and after it kept.
 */
function unfoldInlineTable(line) {
  const rule = INLINE_RULE.exec(line);
  if (!rule) return line;
  const columns = (rule[0].match(/-{2,}/g) || []).length;
  const before = line.slice(0, rule.index).replace(/[ \t]+$/, '');
  if (!before.endsWith('|')) return line;
  // The header: the last `columns` cells before the rule row.
  let headerStart = before.length;
  for (let pipes = 0; pipes <= columns; pipes += 1) {
    headerStart = before.lastIndexOf('|', headerStart - 1);
    if (headerStart < 0) return line;
  }
  const header = before.slice(headerStart);
  const prefix = before.slice(0, headerStart).replace(/[ \t]+$/, '');
  const rows = [];
  let rest = line.slice(rule.index + rule[0].length);
  for (;;) {
    const lead = /^[ \t]*\|/.exec(rest);
    if (!lead) break;
    let cursor = lead[0].length;
    const cells = [];
    for (let cell = 0; cell < columns; cell += 1) {
      const end = rest.indexOf('|', cursor);
      if (end < 0) break;
      cells.push(rest.slice(cursor, end).trim());
      cursor = end + 1;
    }
    if (cells.length < columns) break;
    rows.push(`| ${cells.join(' | ')} |`);
    rest = rest.slice(cursor);
  }
  const ruleRow = `|${' --- |'.repeat(columns)}`;
  const suffix = rest.trim();
  // Blank lines around the table so Markdown sees a table, not part of a sentence.
  return [...(prefix ? [prefix, ''] : []), header.trim(), ruleRow, ...rows, ...(suffix ? ['', suffix] : [])].join('\n');
}

/** Index just past the `count`-th pipe of `line` at or after `from`, or -1. */
function afterPipes(line, count, from = 0) {
  let cursor = from;
  for (let pipe = 0; pipe < count; pipe += 1) {
    const at = line.indexOf('|', cursor);
    if (at < 0) return -1;
    cursor = at + 1;
  }
  return cursor;
}

/**
 * A table laid out over lines but glued to the sentences around it:
 *   "The data shows: | V | B | C |" / "| --- | --- | --- |" / "| GDP | 1 | 2 | What can…"
 * The sentence before goes above the table and the one after below it.
 */
function gluedTableLines(lines) {
  const out = [];
  let columns = 0;
  lines.forEach((line, index) => {
    const next = lines[index + 1] || '';
    if (RULE_ROW.test(next) && next.includes('|') && !PIPE_ROW.test(line) && /\|\s*$/.test(line)) {
      const count = cellCount(next);
      let start = line.length;
      for (let pipe = 0; pipe <= count && start >= 0; pipe += 1) start = line.lastIndexOf('|', start - 1);
      if (start > 0) {
        out.push(line.slice(0, start).trim(), '', line.slice(start).trim());
        columns = 0;
        return;
      }
    }
    if (RULE_ROW.test(line) && line.includes('|')) columns = cellCount(line);
    else if (columns && /^\s*\|/.test(line) && !PIPE_ROW.test(line)) {
      const end = afterPipes(line, columns + 1);
      if (end > 0 && line.slice(end).trim()) {
        out.push(line.slice(0, end).trim(), '', line.slice(end).trim());
        columns = 0;
        return;
      }
    } else if (!PIPE_ROW.test(line)) columns = 0;
    out.push(line);
  });
  return out;
}

/**
 * Repair tables the way AI models and pasted text often write them, so they draw:
 *   • a whole table on one line ("| a | b | | --- | --- | | 1 | 2 |");
 *   • rows joined by a literal "\n" instead of a line break;
 *   • a table glued to the sentence above it (Markdown needs a blank line);
 *   • no |---|---| line under the header row.
 */
export function normalizeTables(source) {
  let text = String(source || '');
  // "| a | b |\n| c | d |" written with a backslash-n between rows (not LaTeX such as \nu: only next to a pipe):
  // folded into the one-line form, which keeps the sentence before and after the table.
  if (/\|\s*\\n\s*\|/.test(text)) text = text.replace(/\|[ \t]*\\n[ \t]*(?=\|)/g, '| ').replace(/([^\\\n|])\\n[ \t]*(?=\|)/g, '$1 ').replace(/(\|)[ \t]*\\n(?=\s*[^|\s])/g, '$1 ');
  if (INLINE_RULE.test(text)) text = text.split('\n').map(unfoldInlineTable).join('\n');
  // Only lone lines: a row of a table already laid out over several lines may legitimately have an empty cell.
  if (INLINE_ROW_BREAK.test(text)) {
    text = text.split('\n').map((line, index, all) => (PIPE_ROW.test(all[index - 1] || '') || PIPE_ROW.test(all[index + 1] || '') ? line : unfoldRulelessTable(line))).join('\n');
  }
  const lines = gluedTableLines(text.split('\n'));
  const out = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const startsTable = PIPE_ROW.test(line) && !PIPE_ROW.test(lines[index - 1] || '') && PIPE_ROW.test(lines[index + 1] || '');
    if (startsTable) {
      if (out.length && out[out.length - 1].trim() !== '') out.push('');
      out.push(line);
      if (!RULE_ROW.test(lines[index + 1])) out.push(`|${' --- |'.repeat(cellCount(line))}`);
      continue;
    }
    out.push(line);
    // A blank line after the table, so the next sentence is not swallowed into it.
    if (PIPE_ROW.test(line) && lines[index + 1] !== undefined && lines[index + 1].trim() !== '' && !PIPE_ROW.test(lines[index + 1])) out.push('');
  }
  return out.join('\n');
}

export function renderRichText(source, { inline: requestedInline = false, linearMath = false } = {}) {
  const raw = String(source || '').replace(/\r\n?/g, '\n');
  if (!raw.trim()) return '';
  const { text, figures } = splitFigures(raw);
  // An option or marking point that carries a table is laid out as a block, so the table draws.
  const inline = requestedInline && !/(^|\n)\s*\|.*\|\s*\n\s*\|/.test(normalizeTables(text));
  const math = [];
  const prepared = extractMath(inline ? text : tabsToTables(normalizeTables(text)), math);
  const html = inline
    ? marked.parseInline(prepared, { gfm: true, breaks: true })
    : marked.parse(prepared, { gfm: true, breaks: true });
  const clean = DOMPurify.sanitize(html, PURIFY)
    // Wide tables scroll on phones instead of breaking the page.
    .replace(/<table>/g, '<div class="ndv-table"><table>')
    .replace(/<\/table>/g, '</table></div>')
    // A paragraph holding only a display formula should not be a paragraph.
    .replace(/<p>\s*NDVMATH(\d+)X\s*<\/p>/g, (_, index) => `NDVMATH${index}X`)
    // Figures are drawn by Ndovera from numbers and escaped labels, after sanitising.
    .replace(/<p>\s*NDVFIG(\d+)X\s*<\/p>/g, (_, index) => `NDVFIG${index}X`)
    .replace(/NDVFIG(\d+)X/g, (_, index) => (figures[Number(index)] !== undefined ? figureHtml(figures[Number(index)]) : ''));
  return clean.replace(/NDVMATH(\d+)X/g, (_, index) => {
    const item = math[Number(index)];
    if (!item) return '';
    if (linearMath) return item.display ? `<p style="text-align:center"><i>${linearFormula(item.tex)}</i></p>` : `<i>${linearFormula(item.tex)}</i>`;
    return typeset(item.tex, item.display);
  });
}

/** Whether text uses formatting worth rendering (tables, maths, Markdown marks). */
export function looksRich(source) {
  const text = String(source || '');
  return /(^|\n)\s*#{1,6}\s|\*\*|__|(^|\n)\s*\|.*\|\s*(\n|$)|\$\$|\\\(|\\\[|\\frac|\t|(^|\n)\s*>\s|\^\{|_\{/.test(text);
}

/** Markdown for a table: rows of cells, first row the header, with per-column alignment. */
export function tableToMarkdown(rows, align = []) {
  const width = Math.max(...rows.map(row => row.length), 1);
  const cell = value => String(value ?? '').replace(/\n/g, ' ').replace(/\|/g, '\\|').trim() || ' ';
  const pad = row => Array.from({ length: width }, (_, index) => cell(row[index]));
  const rule = Array.from({ length: width }, (_, index) => ({ left: ':---', center: ':---:', right: '---:' }[align[index]] || '---'));
  const [header = [], ...body] = rows;
  return [`| ${pad(header).join(' | ')} |`, `| ${rule.join(' | ')} |`, ...body.map(row => `| ${pad(row).join(' | ')} |`)].join('\n');
}

const escapeHtml = value => String(value ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));

/**
 * A table with merged cells, as HTML (Markdown cannot merge cells). `spans` maps
 * "row,col" to { colspan, rowspan }; cells covered by a merge are skipped.
 * Written without blank lines so Markdown keeps it as one block.
 */
export function tableToHtml(rows, align = [], spans = {}, hasHeader = true) {
  const width = Math.max(...rows.map(row => row.length), 1);
  const covered = new Set();
  Object.entries(spans).forEach(([key, span]) => {
    const [r, c] = key.split(',').map(Number);
    for (let dr = 0; dr < (span.rowspan || 1); dr += 1) for (let dc = 0; dc < (span.colspan || 1); dc += 1) if (dr || dc) covered.add(`${r + dr},${c + dc}`);
  });
  const lines = ['<table>'];
  rows.forEach((row, r) => {
    const tag = hasHeader && r === 0 ? 'th' : 'td';
    const cells = [];
    for (let c = 0; c < width; c += 1) {
      if (covered.has(`${r},${c}`)) continue;
      const span = spans[`${r},${c}`] || {};
      const attrs = [span.colspan > 1 ? ` colspan="${span.colspan}"` : '', span.rowspan > 1 ? ` rowspan="${span.rowspan}"` : '', align[c] ? ` align="${align[c]}"` : ''].join('');
      cells.push(`<${tag}${attrs}>${escapeHtml(row[c] ?? '').replace(/\n/g, '<br>') || '&nbsp;'}</${tag}>`);
    }
    lines.push(`<tr>${cells.join('')}</tr>`);
  });
  lines.push('</table>');
  return lines.join('\n');
}

/** Read an HTML table (with merges) back for editing. Needs a DOM (browser or jsdom). */
export function htmlToTable(html) {
  if (typeof DOMParser === 'undefined' || !/<table[\s>]/i.test(String(html || ''))) return null;
  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  const table = doc.querySelector('table');
  if (!table) return null;
  const grid = [];
  const spans = {};
  const align = [];
  let hasHeader = false;
  Array.from(table.querySelectorAll('tr')).forEach((tr, r) => {
    grid[r] = grid[r] || [];
    let c = 0;
    Array.from(tr.children).forEach(cell => {
      while (grid[r][c] !== undefined) c += 1;
      const colspan = Number(cell.getAttribute('colspan')) || 1;
      const rowspan = Number(cell.getAttribute('rowspan')) || 1;
      if (r === 0 && cell.tagName === 'TH') hasHeader = true;
      if (cell.getAttribute('align')) align[c] = cell.getAttribute('align');
      const value = cell.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();
      if (colspan > 1 || rowspan > 1) spans[`${r},${c}`] = { colspan, rowspan };
      for (let dr = 0; dr < rowspan; dr += 1) {
        grid[r + dr] = grid[r + dr] || [];
        for (let dc = 0; dc < colspan; dc += 1) grid[r + dr][c + dc] = dr || dc ? '' : value;
      }
      c += colspan;
    });
  });
  const width = Math.max(...grid.map(row => row.length), 1);
  return { rows: grid.map(row => Array.from({ length: width }, (_, i) => row[i] ?? '')), align, spans, hasHeader };
}

/** Read a Markdown table back into rows and alignment, for editing. Returns null if the text is not a table. */
export function markdownToTable(markdown) {
  const lines = String(markdown || '').trim().split('\n').map(line => line.trim()).filter(Boolean);
  if (lines.length < 2 || !lines.every(line => line.startsWith('|'))) return null;
  // No look-behind: older iOS Safari cannot parse it, and the whole app would fail to load.
  const split = line => line.replace(/\\\|/g, '').replace(/^\|/, '').replace(/\|$/, '').split('|').map(value => value.trim().replace(//g, '|'));
  const ruleCells = split(lines[1]);
  if (!ruleCells.every(value => /^:?-{2,}:?$/.test(value))) return null;
  const align = ruleCells.map(value => (value.startsWith(':') && value.endsWith(':') ? 'center' : value.endsWith(':') ? 'right' : value.startsWith(':') ? 'left' : ''));
  return { rows: [split(lines[0]), ...lines.slice(2).map(split)], align };
}

/**
 * The text with every formula lifted out (as NDVMATH<n>X placeholders) and
 * pasted tables converted — the first stage of the renderer, for exporters
 * that build their own documents (Word).
 */
export function splitMath(source) {
  const math = [];
  const text = extractMath(tabsToTables(normalizeTables(String(source || '').replace(/\r\n?/g, '\n'))), math);
  return { text, math };
}
