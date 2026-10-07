import { marked } from 'marked';
import { htmlToTable, splitFigures, splitMath } from '../../shared/rich/richText';
import { figureToSvg } from '../../shared/rich/figures';
import { answerLines, sameOriginUrl, sectionsOf, shortOptions } from './PaperPreview';

// A real Word document (.docx) of an examination paper or its marking scheme.
// Formulas become native Word equations (editable in Word's equation editor),
// tables become Word tables (merged cells included), and the paper keeps its
// letterhead, numbering, answer lines, page breaks and page numbers.
// The `docx` library is loaded only when a teacher exports.

const SYMBOLS = {
  times: '×', div: '÷', cdot: '·', pm: '±', mp: '∓', le: '≤', leq: '≤', ge: '≥', geq: '≥', neq: '≠', ne: '≠', approx: '≈', equiv: '≡',
  Delta: 'Δ', delta: 'δ', Sigma: 'Σ', sigma: 'σ', pi: 'π', Pi: 'Π', theta: 'θ', alpha: 'α', beta: 'β', gamma: 'γ', lambda: 'λ', mu: 'μ', omega: 'ω', Omega: 'Ω',
  infty: '∞', circ: '°', degree: '°', rightarrow: '→', to: '→', leftarrow: '←', Rightarrow: '⇒', propto: '∝', partial: '∂', nabla: '∇', in: '∈', cup: '∪', cap: '∩',
  ldots: '…', cdots: '⋯', '%': '%', ',': ' ', ';': ' ', quad: '  ', qquad: '    ', '{': '{', '}': '}', '$': '$', '#': '#', '&': '&', _: '_',
}
const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'log', 'ln', 'exp', 'lim', 'max', 'min'])

/** LaTeX (the subset teachers and Ndovera AI use) → docx math components. */
export function latexToMath(tex, D) {
  const source = String(tex || '');
  let index = 0;
  const peek = () => source[index];

  function readGroup() {
    while (source[index] === ' ') index += 1;
    if (source[index] === '{') {
      let depth = 0;
      const start = index + 1;
      for (; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        else if (source[index] === '}') { depth -= 1; if (depth === 0) { index += 1; return source.slice(start, index - 1); } }
      }
      return source.slice(start);
    }
    if (source[index] === '\\') {
      const match = source.slice(index).match(/^\\([a-zA-Z]+|.)/);
      index += match ? match[0].length : 1;
      return match ? match[0] : '';
    }
    const char = source[index] || '';
    index += 1;
    return char;
  }
  function readOptional() {
    if (source[index] !== '[') return null;
    const end = source.indexOf(']', index);
    const value = source.slice(index + 1, end === -1 ? source.length : end);
    index = end === -1 ? source.length : end + 1;
    return value;
  }

  function parseSequence(stopAtRight = false) {
    const out = [];
    let text = '';
    const flush = () => { if (text) { out.push(new D.MathRun(text)); text = ''; } };
    while (index < source.length) {
      const char = peek();
      if (char === '}') { index += 1; continue; }
      if (char === '^' || char === '_') {
        flush();
        index += 1;
        const first = char;
        const firstArg = parse(readGroup());
        let secondArg = null;
        if ((first === '_' && peek() === '^') || (first === '^' && peek() === '_')) { index += 1; secondArg = parse(readGroup()); }
        const base = out.length ? [out.pop()] : [new D.MathRun('')];
        if (secondArg) {
          const [sub, sup] = first === '_' ? [firstArg, secondArg] : [secondArg, firstArg];
          out.push(new D.MathSubSuperScript({ children: base, subScript: sub, superScript: sup }));
        } else if (first === '^') out.push(new D.MathSuperScript({ children: base, superScript: firstArg }));
        else out.push(new D.MathSubScript({ children: base, subScript: firstArg }));
        continue;
      }
      if (char === '{') { flush(); out.push(...parse(readGroup())); continue; }
      if (char === '\\') {
        const match = source.slice(index).match(/^\\([a-zA-Z]+|.)/);
        const name = match ? match[1] : '';
        index += match ? match[0].length : 1;
        if (['frac', 'dfrac', 'tfrac'].includes(name)) {
          flush();
          out.push(new D.MathFraction({ numerator: parse(readGroup()), denominator: parse(readGroup()) }));
        } else if (name === 'sqrt') {
          flush();
          const degree = readOptional();
          out.push(new D.MathRadical({ children: parse(readGroup()), ...(degree ? { degree: parse(degree) } : {}) }));
        } else if (name === 'sum' || name === 'prod') {
          flush();
          let sub = null;
          let sup = null;
          for (let n = 0; n < 2; n += 1) {
            if (peek() === '_') { index += 1; sub = parse(readGroup()); } else if (peek() === '^') { index += 1; sup = parse(readGroup()); }
          }
          while (peek() === ' ') index += 1;
          const body = index < source.length ? parse(readGroup()) : [new D.MathRun('')];
          if (name === 'sum') out.push(new D.MathSum({ children: body, ...(sub ? { subScript: sub } : {}), ...(sup ? { superScript: sup } : {}) }));
          else out.push(new D.MathRun('∏'), ...body);
        } else if (name === 'left') {
          flush();
          const open = source[index] === '\\' ? (index += 2, source[index - 1]) : source[index++];
          const inner = parseSequence(true);
          const Brackets = open === '[' ? D.MathSquareBrackets : open === '{' ? D.MathCurlyBraces : open === '|' ? null : D.MathRoundBrackets;
          out.push(Brackets ? new Brackets({ children: inner }) : new D.MathRun('|'), ...(Brackets ? [] : [...inner, new D.MathRun('|')]));
        } else if (name === 'right') {
          index += source[index] === '\\' ? 2 : 1;
          if (stopAtRight) { flush(); return out; }
        } else if (['text', 'mathrm', 'textbf', 'mathbf', 'operatorname'].includes(name)) {
          text += readGroup();
        } else if (['bar', 'overline', 'hat', 'vec', 'dot'].includes(name)) {
          // Word accents are not in the library; keep the letter with a combining mark.
          const accent = { bar: '̄', overline: '̅', hat: '̂', vec: '⃗', dot: '̇' }[name];
          text += `${readGroup()}${accent}`;
        } else if (FUNCTIONS.has(name)) {
          text += name;
        } else {
          text += SYMBOLS[name] ?? name;
        }
        continue;
      }
      text += char;
      index += 1;
    }
    flush();
    return out;
  }

  // Arguments ({…} groups, scripts, fraction parts) are parsed on their own.
  const parse = fragment => latexToMath(fragment, D);

  return parseSequence();
}

// ─── Markdown → docx blocks ──────────────────────────────────────────────────

function inlineRuns(tokens, math, D, style = {}) {
  const out = [];
  const state = { ...style };
  const pushText = value => {
    const parts = String(value).split(/(NDVMATH\d+X)/);
    for (const part of parts) {
      if (!part) continue;
      const found = part.match(/^NDVMATH(\d+)X$/);
      if (found) {
        const item = math[Number(found[1])];
        if (item) out.push(new D.Math({ children: latexToMath(item.tex, D) }));
      } else {
        out.push(new D.TextRun({ text: decode(part), bold: Boolean(state.bold), italics: state.italics, superScript: state.sup, subScript: state.sub, font: state.code ? 'Courier New' : undefined }));
      }
    }
  };
  for (const token of tokens || []) {
    switch (token.type) {
      case 'strong': out.push(...inlineRuns(token.tokens, math, D, { ...state, bold: true })); break;
      case 'em': out.push(...inlineRuns(token.tokens, math, D, { ...state, italics: true })); break;
      case 'codespan': out.push(new D.TextRun({ text: decode(token.text), font: 'Courier New' })); break;
      case 'br': out.push(new D.TextRun({ text: '', break: 1 })); break;
      case 'link': out.push(...inlineRuns(token.tokens, math, D, state)); break;
      case 'html': {
        const tag = token.raw.toLowerCase();
        if (tag.startsWith('<sup')) state.sup = true;
        else if (tag.startsWith('</sup')) state.sup = false;
        else if (tag.startsWith('<sub')) state.sub = true;
        else if (tag.startsWith('</sub')) state.sub = false;
        else if (tag.startsWith('<br')) out.push(new D.TextRun({ text: '', break: 1 }));
        break;
      }
      case 'text':
      case 'escape':
        if (token.tokens?.length) out.push(...inlineRuns(token.tokens, math, D, state));
        else pushText(token.text);
        break;
      default:
        if (token.tokens) out.push(...inlineRuns(token.tokens, math, D, state));
        else if (token.text) pushText(token.text);
    }
  }
  return out;
}

const decode = value => String(value ?? '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
const BORDER = { style: 'single', size: 4, color: '444444' };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

function cellParagraphs(value, math, D, bold, alignment) {
  // Cell text may carry its own formulas, written in LaTeX like everything else.
  const own = splitMath(String(value || ''));
  const tokens = marked.lexer(own.text, { gfm: true }).filter(token => token.type !== 'space');
  const blocks = tokens.length ? tokens : [{ type: 'paragraph', tokens: [{ type: 'text', text: '' }] }];
  return blocks.map(token => new D.Paragraph({ alignment, children: inlineRuns(token.tokens || [{ type: 'text', text: token.text || '' }], [...math, ...own.math].length ? (own.math.length ? own.math : math) : math, D, { bold }) }));
}

function wordTable(rows, align, spans, hasHeader, math, D) {
  const covered = new Set();
  Object.entries(spans || {}).forEach(([key, span]) => {
    const [r, c] = key.split(',').map(Number);
    for (let dr = 0; dr < (span.rowspan || 1); dr += 1) for (let dc = 0; dc < (span.colspan || 1); dc += 1) if (dr || dc) covered.add(`${r + dr},${c + dc}`);
  });
  const alignment = value => ({ center: D.AlignmentType.CENTER, right: D.AlignmentType.RIGHT }[value] || D.AlignmentType.LEFT);
  return new D.Table({
    width: { size: 100, type: D.WidthType.PERCENTAGE },
    rows: rows.map((row, r) => new D.TableRow({
      tableHeader: hasHeader && r === 0,
      children: row.flatMap((value, c) => {
        // Cells under a merge are left out: the library writes the vertical-merge continuations itself.
        if (covered.has(`${r},${c}`)) return [];
        const span = spans?.[`${r},${c}`] || {};
        return [new D.TableCell({
          borders: BORDERS, columnSpan: span.colspan > 1 ? span.colspan : undefined, rowSpan: span.rowspan > 1 ? span.rowspan : undefined,
          shading: hasHeader && r === 0 ? { fill: 'EFEFEF', type: D.ShadingType.CLEAR, color: 'auto' } : undefined,
          children: cellParagraphs(value, math, D, hasHeader && r === 0, alignment(align?.[c])),
        })];
      }),
    })),
  });
}

// ─── Figures as images ───────────────────────────────────────────────────────

/** Draw a figure's SVG onto a canvas at print resolution. Null where there is no canvas (tests). */
async function svgToPng(svg) {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  const width = Number((svg.match(/width="(\d+(?:\.\d+)?)"/) || [])[1]) || 560;
  const height = Number((svg.match(/height="(\d+(?:\.\d+)?)"/) || [])[1]) || 400;
  const image = new Image();
  const loaded = new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; setTimeout(() => reject(new Error('timeout')), 3000); });
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await loaded;
  const canvas = document.createElement('canvas');
  const scale = 3;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return null;
  return { data: await blob.arrayBuffer(), width, height };
}

/** Every figure in the paper, drawn once, keyed by its JSON text. */
async function renderFigures(texts) {
  const images = new Map();
  for (const source of texts) {
    for (const body of splitFigures(source).figures) {
      if (images.has(body)) continue;
      const { svg } = figureToSvg(body);
      images.set(body, svg ? await svgToPng(svg).catch(() => null) : null);
    }
  }
  return images;
}

function figureParagraph(body, D, images) {
  const image = images?.get(body);
  if (!image) return new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: '[Figure — see the printed paper]', italics: true, color: '666666' })] });
  // Fit within the page width (about 16 cm), keeping the proportions.
  const maxWidth = 520;
  const ratio = Math.min(1, maxWidth / image.width);
  return new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { before: 80, after: 80 }, children: [new D.ImageRun({ data: image.data, type: 'png', transformation: { width: Math.round(image.width * ratio), height: Math.round(image.height * ratio) } })] });
}

/** A piece of academic text (Markdown + LaTeX + figures) as docx paragraphs and tables. */
export function richToDocx(source, D, { firstPrefix = [], bold = false, images = null } = {}) {
  const lifted = splitFigures(source);
  const { text, math } = splitMath(lifted.text);
  const tokens = marked.lexer(text, { gfm: true });
  const style = bold ? { bold: true } : {};
  const blocks = [];
  let prefix = firstPrefix;
  const takePrefix = () => { const value = prefix; prefix = []; return value; };
  for (const token of tokens) {
    switch (token.type) {
      case 'heading':
        blocks.push(new D.Paragraph({ heading: [D.HeadingLevel.HEADING_1, D.HeadingLevel.HEADING_2, D.HeadingLevel.HEADING_3, D.HeadingLevel.HEADING_4][Math.min(token.depth, 4) - 1], children: [...takePrefix(), ...inlineRuns(token.tokens, math, D)] }));
        break;
      case 'paragraph': {
        const figure = String(token.text || '').trim().match(/^NDVFIG(\d+)X$/);
        if (figure) {
          if (prefix.length) blocks.push(new D.Paragraph({ children: takePrefix() }));
          blocks.push(figureParagraph(lifted.figures[Number(figure[1])], D, images));
          break;
        }
        blocks.push(new D.Paragraph({ spacing: { after: 60 }, children: [...takePrefix(), ...inlineRuns(token.tokens, math, D, style)] }));
        break;
      }
      case 'list':
        token.items.forEach((item, i) => blocks.push(new D.Paragraph({ indent: { left: 540, hanging: 270 }, children: [new D.TextRun(token.ordered ? `${(Number(token.start) || 1) + i}. ` : '• '), ...inlineRuns(item.tokens?.[0]?.tokens || item.tokens, math, D)] })));
        break;
      case 'blockquote':
        token.tokens.forEach(inner => blocks.push(new D.Paragraph({ indent: { left: 360 }, border: { left: { style: 'single', size: 12, color: 'C9A96E' } }, children: inlineRuns(inner.tokens, math, D, { italics: true }) })));
        break;
      case 'table': {
        const rows = [token.header.map(cell => cell.text), ...token.rows.map(row => row.map(cell => cell.text))];
        if (prefix.length) blocks.push(new D.Paragraph({ children: takePrefix() }));
        blocks.push(wordTable(rows, token.align, {}, true, math, D));
        break;
      }
      case 'html': {
        const parsed = /<table[\s>]/i.test(token.text) ? htmlToTable(token.text) : null;
        if (parsed) {
          if (prefix.length) blocks.push(new D.Paragraph({ children: takePrefix() }));
          blocks.push(wordTable(parsed.rows, parsed.align, parsed.spans, parsed.hasHeader, math, D));
        } else {
          const plain = decode(token.text.replace(/<[^>]+>/g, ' ')).trim();
          if (plain) blocks.push(new D.Paragraph({ children: [...takePrefix(), ...inlineRuns([{ type: 'text', text: plain }], math, D)] }));
        }
        break;
      }
      case 'code':
        blocks.push(new D.Paragraph({ children: [...takePrefix(), new D.TextRun({ text: token.text, font: 'Courier New' })] }));
        break;
      case 'hr':
        blocks.push(new D.Paragraph({ border: { bottom: BORDER }, children: [] }));
        break;
      default:
        break;
    }
  }
  if (prefix.length) blocks.push(new D.Paragraph({ children: prefix }));
  return blocks;
}

// ─── The paper and the marking scheme ────────────────────────────────────────

const letter = index => 'ABCDEFGH'[index] || '?';

/** The school's logo, fetched from the school's own address, at its true shape and 70 px tall. */
async function logoRun(url, D) {
  if (!url) return null;
  try {
    const response = await fetch(sameOriginUrl(url));
    if (!response.ok) return null;
    const data = await response.arrayBuffer();
    const type = /png/i.test(response.headers.get('content-type') || url) ? 'png' : /gif/i.test(response.headers.get('content-type') || url) ? 'gif' : 'jpg';
    let width = 58;
    let height = 58;
    if (typeof Image !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) {
      const objectUrl = URL.createObjectURL(new Blob([data]));
      const image = new Image();
      await new Promise(resolve => { image.onload = resolve; image.onerror = resolve; setTimeout(resolve, 2000); image.src = objectUrl; });
      if (image.naturalWidth && image.naturalHeight) width = Math.round((58 * image.naturalWidth) / image.naturalHeight);
      URL.revokeObjectURL(objectUrl);
    }
    return new D.ImageRun({ data, type, transformation: { width: Math.min(width, 110), height } });
  } catch { return null; }
}

function header(assessment, letterhead, D, title, studentFields, logo) {
  const fieldCell = (text, bold, span) => new D.TableCell({ borders: BORDERS, columnSpan: span, shading: bold ? { fill: 'F3F3F3', type: D.ShadingType.CLEAR, color: 'auto' } : undefined, children: [new D.Paragraph({ children: [new D.TextRun({ text: String(text ?? ''), bold })] })] });
  const minutes = Number(assessment.config?.durationMinutes) || 0;
  const duration = minutes ? `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)} hour${Math.floor(minutes / 60) > 1 ? 's' : ''} ` : ''}${minutes % 60 ? `${minutes % 60} minutes` : ''}`.trim() : '—';
  const rows = [
    new D.TableRow({ children: [fieldCell('Subject', true), fieldCell(assessment.subjectName), fieldCell('Class', true), fieldCell(assessment.className)] }),
    new D.TableRow({ children: [fieldCell('Duration', true), fieldCell(duration), fieldCell('Total marks', true), fieldCell(assessment.audit?.examMarks ?? assessment.config?.totalMarks)] }),
  ];
  if (studentFields) {
    rows.push(new D.TableRow({ height: { value: 480, rule: 'atLeast' }, children: [fieldCell('Student name', true), fieldCell('', false, 3)] }));
    rows.push(new D.TableRow({ height: { value: 480, rule: 'atLeast' }, children: [fieldCell('Admission no.', true), fieldCell(''), fieldCell('Date', true), fieldCell('')] }));
  }
  // Letterhead: one band in the school's colours, under 1 inch (1440 twips) tall.
  const primary = String(letterhead?.primaryColor || '#14215b').replace('#', '');
  const accent = String(letterhead?.accentColor || '#1a5c38').replace('#', '');
  const wash = lighten(primary, 0.93);
  const noBorder = { style: 'none', size: 0, color: 'FFFFFF' };
  const band = { top: { style: 'single', size: 24, color: accent }, bottom: { style: 'single', size: 12, color: primary }, left: noBorder, right: noBorder };
  const details = [letterhead?.address, letterhead?.contact].filter(Boolean).join('  ·  ');
  const textCell = new D.TableCell({
    borders: band, shading: { fill: wash, type: D.ShadingType.CLEAR, color: 'auto' }, verticalAlign: D.VerticalAlign.CENTER,
    children: [
      new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: (letterhead?.schoolName || '').toUpperCase(), bold: true, size: 30, color: primary })] }),
      ...(letterhead?.motto ? [new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: letterhead.motto, italics: true, size: 16, color: accent })] })] : []),
      ...(details ? [new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: details, size: 16, color: '333333' })] })] : []),
    ],
  });
  const cells = logo
    ? [new D.TableCell({ borders: band, shading: { fill: wash, type: D.ShadingType.CLEAR, color: 'auto' }, verticalAlign: D.VerticalAlign.CENTER, width: { size: 1300, type: D.WidthType.DXA }, children: [new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [logo] })] }), textCell]
    : [textCell];
  return [
    new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, rows: [new D.TableRow({ height: { value: 1300, rule: D.HeightRule.ATLEAST }, cantSplit: true, children: cells })] }),
    new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { before: 140, after: 140 }, children: [new D.TextRun({ text: title, bold: true, underline: {}, size: 24 })] }),
    new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, rows }),
    new D.Paragraph({ children: [] }),
  ];
}

const KIND_TITLES = { quiz: 'QUIZ', assignment: 'ASSIGNMENT', test: 'TEST', exam: 'EXAMINATION' };

/** A colour mixed with white (amount 0–1 toward white), as hex without '#'. */
function lighten(hex, amount) {
  const value = /^[0-9a-f]{6}$/i.test(hex) ? hex : '14215b';
  return [0, 2, 4].map(index => {
    const channel = parseInt(value.slice(index, index + 2), 16);
    return Math.round(channel + (255 - channel) * amount).toString(16).padStart(2, '0');
  }).join('').toUpperCase();
}

/** Build the .docx Blob for the paper (`which = 'paper'`) or the marking scheme. */
export async function buildDocx(assessment, letterhead, which = 'paper') {
  const D = await import('docx');
  const logo = await logoRun(letterhead?.logoUrl, D);
  const images = await renderFigures(assessment.questions.flatMap(question => [question.prompt, ...(question.options || []), ...(question.parts || []).map(part => part.prompt), question.answer || '']));
  const children = [];
  // Exams usually use answer booklets: the teacher can leave the ruled lines off.
  const withLines = assessment.answerSpace !== false;
  const lineParagraph = () => new D.Paragraph({ spacing: { before: 100 }, border: { bottom: { style: 'single', size: 4, color: '999999' } }, children: [] });
  if (which === 'paper') {
    const title = `${(assessment.termName || '').toUpperCase()} ${KIND_TITLES[assessment.kind] || ''}${assessment.sessionName ? ` — ${assessment.sessionName} SESSION` : ''}${assessment.paperPart ? ` — ${assessment.paperPart}` : ''}`.trim() || assessment.title;
    children.push(...header(assessment, letterhead, D, title, letterhead?.showStudentFields !== false, logo));
    children.push(new D.Paragraph({ children: [new D.TextRun({ text: 'INSTRUCTIONS TO CANDIDATES', bold: true })] }));
    children.push(...richToDocx(letterhead?.defaultInstructions || 'Answer the questions as instructed in each section.', D));
    let number = 0;
    sectionsOf(assessment).forEach((section, sectionIndex) => {
      children.push(new D.Paragraph({ pageBreakBefore: sectionIndex > 0 && section.meta?.type !== 'mcq', spacing: { before: 240 }, children: [new D.TextRun({ text: `SECTION ${section.name}`, bold: true, size: 26 })] }));
      if (section.meta?.instructions) children.push(new D.Paragraph({ children: [new D.TextRun({ text: section.meta.instructions, bold: true })] }));
      section.questions.forEach(question => {
        number += 1;
        if (question.pageBreakBefore) children.push(new D.Paragraph({ children: [new D.PageBreak()] }));
        // Question text bold; options and answer space in normal weight.
        const marks = question.parts?.length ? '' : ` [${question.marks} mark${question.marks === 1 ? '' : 's'}]`
        const prefix = [new D.TextRun({ text: `${number}. `, bold: true }), ...(question.compulsory ? [new D.TextRun({ text: '(Compulsory) ', bold: true, italics: true })] : [])];
        children.push(...richToDocx(`${question.prompt}${marks}`, D, { firstPrefix: prefix, bold: true, images }));
        if (shortOptions(question.options) && !(question.options || []).some(option => /\\[()[\]]/.test(String(option)))) {
          // Short options sit four across on one line, like a printed paper.
          const stops = [0, 1, 2, 3].map(column => ({ type: D.TabStopType.LEFT, position: 400 + column * 2300 }));
          children.push(new D.Paragraph({ tabStops: stops, children: question.options.flatMap((option, index) => [new D.TextRun({ text: `\t${letter(index)}. `, bold: true }), new D.TextRun({ text: String(option) })]) }));
        } else {
          (question.options || []).forEach((option, index) => children.push(...richToDocx(option, D, { firstPrefix: [new D.TextRun({ text: `      ${letter(index)}. `, bold: true })], images })));
        }
        (question.parts || []).forEach(part => {
          children.push(...richToDocx(`${part.prompt} [${part.marks} mark${part.marks === 1 ? '' : 's'}]`, D, { firstPrefix: [new D.TextRun({ text: `   (${part.label}) `, bold: true })], bold: true, images }));
          for (let line = 0; line < (withLines ? answerLines(question, part.marks) : 0); line += 1) children.push(lineParagraph());
        });
        for (let line = 0; line < (withLines ? answerLines(question) : 0); line += 1) children.push(lineParagraph());
        children.push(new D.Paragraph({ spacing: { after: 60 }, children: [] }));
      });
    });
    children.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { before: 300 }, children: [new D.TextRun({ text: '— END OF PAPER —', bold: true })] }));
    if (letterhead?.footer) children.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: letterhead.footer, size: 20 })] }));
  } else {
    children.push(...header(assessment, letterhead, D, `MARKING SCHEME — ${assessment.title}`, false, logo));
    children.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, border: BORDERS, children: [new D.TextRun({ text: 'CONFIDENTIAL — for teachers and examiners only. Do not release to students.', bold: true, color: '800000' })] }));
    assessment.questions.forEach((question, index) => {
      children.push(new D.Paragraph({ spacing: { before: 200 }, children: [new D.TextRun({ text: `${index + 1}. `, bold: true }), new D.TextRun({ text: `${question.marks} mark${question.marks === 1 ? '' : 's'} · ${question.bloom} · ${question.topic || '—'}`, color: '555555', size: 20 })] }));
      if (['mcq', 'truefalse'].includes(question.type)) children.push(...richToDocx(question.options?.[question.answerIndex] || '', D, { firstPrefix: [new D.TextRun({ text: `Answer: ${letter(question.answerIndex)} — `, bold: true })] }));
      if (question.answer) children.push(...richToDocx(question.answer, D, { firstPrefix: [new D.TextRun({ text: 'Expected answer: ', bold: true })], images }));
      (question.markingPoints || []).forEach(point => children.push(...richToDocx(point, D, { firstPrefix: [new D.TextRun('• ')] })));
      (question.parts || []).forEach(part => {
        children.push(...richToDocx(part.answer || '', D, { firstPrefix: [new D.TextRun({ text: `(${part.label}) [${part.marks}] `, bold: true })], images }));
        part.markingPoints.forEach(point => children.push(...richToDocx(point, D, { firstPrefix: [new D.TextRun('     • ')] })));
      });
      if (question.alternatives?.length) children.push(new D.Paragraph({ children: [new D.TextRun({ text: 'Also accept: ', bold: true }), new D.TextRun(question.alternatives.join('; '))] }));
      (question.workingSteps || []).forEach((step, i) => children.push(...richToDocx(step, D, { firstPrefix: [new D.TextRun(`${i + 1}. `)] })));
      if (question.rubric?.length) children.push(wordTable([['Criterion', 'Marks'], ...question.rubric.map(row => [row.criterion, String(row.marks)])], [], {}, true, [], D));
    });
  }
  // The printed stamp sits once, at the very end.
  const stamp = new Date().toLocaleString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  children.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { before: 200 }, children: [new D.TextRun({ text: `Printed ${stamp}${letterhead?.schoolName ? ` · ${letterhead.schoolName}` : ''} · Ndovera`, size: 16, color: '666666' })] }));
  const doc = new D.Document({
    creator: 'Ndovera', title: assessment.title,
    styles: { default: { document: { run: { font: 'Arial', size: 22 } } } },
    sections: [{
      // A4 (twips), with slim margins: about 9 mm top, 11 mm sides and bottom.
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 510, bottom: 620, left: 620, right: 620, header: 280, footer: 280 } } },
      footers: { default: new D.Footer({ children: [new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ children: ['Page ', D.PageNumber.CURRENT, ' of ', D.PageNumber.TOTAL_PAGES], size: 18 })] })] }) },
      children,
    }],
  });
  return D.Packer.toBlob(doc);
}
