// Turns an Ndovera AI answer into typed content blocks, so the interface — not
// the model — decides how an answer looks. The model is asked (see
// buildAiSystemPrompt in the Worker) to answer in a small, predictable format:
// '#' headings, '-' bullets, '1.' steps, pipe tables, and labelled lines such as
// "Definition:" or "Example:". This parser reads that format, and also cleans up
// ordinary Markdown, so students never see stray **, ### or * symbols.
//
// Block types: heading, paragraph, list, table, quote, code, formula, card, divider.
// Card kinds: definition, example, keypoint, note, warning, tip, formula, question.

const CARD_LABELS = [
  ['definition', /^(definition|meaning)$/i],
  ['example', /^(example|examples|for example|e\.g\.?)$/i],
  ['keypoint', /^(key ?points?|remember|summary|takeaway|in summary)$/i],
  ['note', /^(note|nb|n\.b\.?|important)$/i],
  ['warning', /^(warning|caution|common mistake|watch out)$/i],
  ['tip', /^(tip|hint|study tip)$/i],
  ['formula', /^(formula|equation|rule)$/i],
  ['question', /^(practice questions?\s*\d*|question\s*\d*|exercise\s*\d*|try this|quiz)$/i],
];

export const CARD_TITLES = {
  definition: 'Definition',
  example: 'Example',
  keypoint: 'Key point',
  note: 'Note',
  warning: 'Watch out',
  tip: 'Tip',
  formula: 'Formula',
  question: 'Practice',
};

function stripWrapping(text) {
  // "**Meaning**" or "__Meaning__" on its own line is a heading in disguise.
  const match = text.match(/^(\*\*|__)(.+?)\1:?$/);
  return match ? match[2].trim() : '';
}

function cardKind(label) {
  const clean = label.replace(/[*_`]/g, '').trim();
  const found = CARD_LABELS.find(([, pattern]) => pattern.test(clean));
  return found ? found[0] : '';
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
}

function splitRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
}

/** Parse an answer into blocks. Pure, so every AI surface shares it and it is tested directly. */
export function parseAiAnswer(source) {
  if (Array.isArray(source)) return source;
  const lines = String(source || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let paragraph = [];
  // A labelled card ("Example: ...") takes the lines and bullets right under it,
  // until a blank line or new structure closes it.
  let openCard = null;

  const flush = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };
  const close = () => { flush(); openCard = null; };
  const lastList = ordered => {
    const last = blocks[blocks.length - 1];
    return last && last.type === 'list' && last.ordered === ordered && !paragraph.length ? last : null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.trim();

    if (!line) { close(); continue; }

    // Fenced code.
    if (line.startsWith('```')) {
      close();
      const language = line.slice(3).trim();
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) { code.push(lines[index]); index += 1; }
      blocks.push({ type: 'code', language, text: code.join('\n') });
      continue;
    }

    // Display maths: $$ ... $$ on one line or across several.
    if (line.startsWith('$$')) {
      close();
      let body = line.slice(2);
      if (body.endsWith('$$')) body = body.slice(0, -2);
      else {
        const parts = [body];
        index += 1;
        while (index < lines.length && !lines[index].trim().endsWith('$$')) { parts.push(lines[index]); index += 1; }
        if (index < lines.length) parts.push(lines[index].trim().slice(0, -2));
        body = parts.join('\n');
      }
      blocks.push({ type: 'formula', text: body.trim() });
      continue;
    }

    // Tables: a header row followed by a |---| separator.
    if (line.includes('|') && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      close();
      const header = splitRow(line);
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) { rows.push(splitRow(lines[index])); index += 1; }
      index -= 1;
      blocks.push({ type: 'table', header, rows });
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { close(); blocks.push({ type: 'divider' }); continue; }

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (heading) {
      close();
      blocks.push({ type: 'heading', level: Math.min(heading[1].length, 3), text: heading[2].replace(/^(\*\*|__)(.+)\1$/, '$2') });
      continue;
    }

    // A bold line on its own is a heading ("**Meaning**"); a bold label ending
    // in a colon opens a card ("**Example:**") with its content on the lines below.
    const wrapped = stripWrapping(line);
    if (wrapped) {
      close();
      const label = wrapped.replace(/:$/, '');
      const kind = (wrapped.endsWith(':') || line.endsWith(':')) ? cardKind(label) : '';
      if (kind) {
        openCard = { type: 'card', kind, text: '', items: [] };
        blocks.push(openCard);
      } else {
        blocks.push({ type: 'heading', level: 3, text: label });
      }
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      close();
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'quote') last.text += ` ${quote[1]}`;
      else blocks.push({ type: 'quote', text: quote[1] });
      continue;
    }

    const bullet = raw.match(/^(\s*)[-*•+]\s+(.+)$/);
    if (bullet) {
      if (openCard) { openCard.items.push(bullet[2]); continue; }
      const list = lastList(false);
      flush();
      if (list) list.items.push(bullet[2]);
      else blocks.push({ type: 'list', ordered: false, items: [bullet[2]] });
      continue;
    }

    const step = raw.match(/^\s*(\d{1,3})[.)]\s+(.+)$/);
    if (step) {
      if (openCard) { openCard.items.push(step[2]); openCard.ordered = true; continue; }
      const list = lastList(true);
      flush();
      if (list) list.items.push(step[2]);
      else blocks.push({ type: 'list', ordered: true, start: Number(step[1]), items: [step[2]] });
      continue;
    }

    // "Definition: ...", "**Example:** ...", "Practice question 2: ..."
    const labelled = line.match(/^(\*\*|__)?([A-Za-z][A-Za-z .]{1,24}?\s*\d*)(\*\*|__)?\s*[:：]\s*(\*\*|__)?\s*(.*)$/);
    if (labelled) {
      const kind = cardKind(labelled[2]);
      if (kind) {
        close();
        openCard = { type: 'card', kind, text: labelled[5].replace(/(\*\*|__)$/, '').trim(), items: [] };
        blocks.push(openCard);
        continue;
      }
    }

    if (openCard && !paragraph.length) {
      openCard.text = openCard.text ? `${openCard.text} ${line}` : line;
      continue;
    }

    paragraph.push(line);
  }
  flush();
  return blocks;
}

// Inline emphasis without look-behind: older iOS Safari cannot parse it, and a
// single unsupported pattern would stop the whole app loading. The character
// before an italic marker is captured and kept as text instead.
// Maths needs non-space at both ends and no digit after, so "$5 and $10" stays money.
const INLINE = /(\*\*|__)(.+?)\1|`([^`]+)`|\$([^\s$][^$\n]*?[^\s$]|[^\s$])\$(?!\d)|(^|[^\w*])\*(?!\s)([^*\n]+?)\*(?!\w)|(^|[^\w_])_(?!\s)([^_\n]+?)_(?!\w)/g;

/**
 * Inline emphasis: **bold**, *italic*, `code` and $maths$. Returns tokens the
 * renderer turns into elements — never HTML, so nothing in an answer can inject markup.
 */
export function parseInline(text) {
  const tokens = [];
  const source = String(text || '');
  const pattern = new RegExp(INLINE.source, 'g');
  let cursor = 0;
  let match;
  while ((match = pattern.exec(source))) {
    if (match.index > cursor) tokens.push({ type: 'text', text: source.slice(cursor, match.index) });
    if (match[2] !== undefined) tokens.push({ type: 'strong', text: match[2] });
    else if (match[3] !== undefined) tokens.push({ type: 'code', text: match[3] });
    else if (match[4] !== undefined) tokens.push({ type: 'math', text: match[4] });
    else {
      const prefix = match[5] ?? match[7] ?? '';
      if (prefix) tokens.push({ type: 'text', text: prefix });
      tokens.push({ type: 'em', text: match[6] ?? match[8] });
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < source.length) tokens.push({ type: 'text', text: source.slice(cursor) });
  // Neighbouring plain text (split around an italic's leading character) reads as one piece.
  return tokens.reduce((merged, token) => {
    const last = merged[merged.length - 1];
    if (last && last.type === 'text' && token.type === 'text') last.text += token.text;
    else merged.push({ ...token });
    return merged;
  }, []);
}

/** Plain text of an answer, for copying or reading aloud. */
export function aiAnswerToPlainText(source) {
  const strip = value => parseInline(value).map(token => token.text).join('');
  return parseAiAnswer(source).map(block => {
    if (block.type === 'list') return block.items.map((item, i) => `${block.ordered ? `${(block.start || 1) + i}.` : '•'} ${strip(item)}`).join('\n');
    if (block.type === 'table') return [block.header, ...block.rows].map(row => row.map(strip).join('\t')).join('\n');
    if (block.type === 'card') return [`${CARD_TITLES[block.kind]}: ${strip(block.text)}`, ...block.items.map(item => `• ${strip(item)}`)].join('\n');
    if (block.type === 'divider') return '';
    return strip(block.text || '');
  }).filter(Boolean).join('\n\n');
}
