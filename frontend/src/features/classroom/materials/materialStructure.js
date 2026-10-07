// Recognises the structure of a lesson note as a teacher types or pastes it:
//
//   Topic → Subtopic → Heading → Subheading → Paragraph → Definition → Example
//   → Note → List → Exercise/Activity → Assignment
//
// This is formatting only. Every block carries the teacher's own words exactly
// as written; nothing here rewrites, corrects or summarises. Rewording is a
// separate, explicit action and never happens as a side effect of formatting.

export const BLOCK_TYPES = [
  { value: 'topic', label: 'Topic' },
  { value: 'subtopic', label: 'Subtopic' },
  { value: 'heading', label: 'Heading' },
  { value: 'subheading', label: 'Subheading' },
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'definition', label: 'Definition' },
  { value: 'example', label: 'Example' },
  { value: 'note', label: 'Note' },
  { value: 'list', label: 'List' },
  { value: 'exercise', label: 'Exercise / Activity' },
  { value: 'assignment', label: 'Assignment' },
  // Blocks written by Ndovera AI (Prepare with Ndovera AI).
  { value: 'formula', label: 'Formula' },
  { value: 'table', label: 'Table' },
  { value: 'figure', label: 'Graph / diagram' },
  { value: 'image', label: 'Illustration' },
  { value: 'worked_example', label: 'Worked example' },
  { value: 'exam_tip', label: 'Exam tip' },
  { value: 'common_mistake', label: 'Common mistake' },
  { value: 'summary', label: 'Summary' },
  { value: 'question', label: 'Practice question' },
  { value: 'flashcard', label: 'Flashcard' },
];

const LIST_ITEM = /^\s*(?:(\d{1,3}|[a-zA-Z]|[ivxIVX]{1,5})[.):]?|[-*•‣◦–])\s+(\S.*)$/;
const DEFINITION_CUE = /^(meaning|definitions?|meaning of\b.*|what is\b.*|what are\b.*)$/i;
const EXAMPLE_CUE = /^(examples?|e\.g\.?|for example|illustrations?)\b/i;
const NOTE_CUE = /^(note|nb|n\.b\.?|remember|important|take note)\b\s*[:.-]?/i;
const EXERCISE_CUE = /^(exercises?|activit(y|ies)|class ?work|practice|evaluation|questions|test yourself|quiz)\b/i;
const ASSIGNMENT_CUE = /^(assignments?|home ?work|take[- ]home)\b/i;
const SUBHEADING_CUE = /^(types|kinds|classes|factors|causes|effects|importance|uses|advantages|disadvantages|characteristics|features|properties|functions|stages|steps|methods|conditions|differences|similarities|summary|conclusion|introduction)\b/i;
const DEFINITION_SENTENCE = /\b(is|are|refers to|means|is defined as|can be defined as|is called|are called)\b/i;

function isListItem(line) {
  const match = line.match(LIST_ITEM);
  if (!match) return null;
  // A lone capital word ("A Note on...") is not a list marker unless followed by ")" or ".".
  if (/^[A-Za-z]$/.test(match[1] || '') && !/^\s*[A-Za-z][.)]/.test(line)) return null;
  return { text: match[2].trim(), ordered: Boolean(match[1]) };
}

function isHeadingLike(line) {
  const text = line.trim();
  if (!text || text.length > 80) return false;
  if (/[.;,!?]$/.test(text) && !/:$/.test(text)) return false;
  return text.replace(/:$/, '').split(/\s+/).length <= 8;
}

function cueOf(line) {
  const text = line.trim().replace(/:$/, '');
  if (ASSIGNMENT_CUE.test(text)) return 'assignment';
  if (EXERCISE_CUE.test(text)) return 'exercise';
  if (DEFINITION_CUE.test(text)) return 'definition';
  if (EXAMPLE_CUE.test(text)) return 'example';
  if (NOTE_CUE.test(text)) return 'note';
  return '';
}

/**
 * If a table (| … | rows or tab-separated rows), a display formula ($$ … $$,
 * \[ … \]) or a quote (> …) starts at `index`, the index of its last line;
 * otherwise -1.
 */
function richRunEnd(lines, index) {
  const line = lines[index].trim();
  const runWhile = test => { let end = index; while (end + 1 < lines.length && test(lines[end + 1].trim())) end += 1; return end; };
  if (/^\|.*\|$/.test(line) && lines[index + 1] && /^\|?\s*:?-{2,}/.test(lines[index + 1].trim())) return runWhile(next => /^\|.*\|$/.test(next));
  if (line.includes('\t') && line.split('\t').length > 1 && lines[index + 1]?.split('\t').length === line.split('\t').length) {
    return runWhile(next => next.split('\t').length === line.split('\t').length);
  }
  for (const [open, close] of [['$$', '$$'], ['\\[', '\\]']]) {
    if (line.startsWith(open)) {
      if (line.length > open.length && line.endsWith(close)) return index;
      for (let end = index + 1; end < lines.length; end += 1) if (lines[end].includes(close)) return end;
      return -1;
    }
  }
  // Fenced blocks (figures, code) stay whole.
  if (/^```/.test(line)) {
    for (let end = index + 1; end < lines.length; end += 1) if (/^```/.test(lines[end].trim())) return end;
    return -1;
  }
  if (/^<table[\s>]/i.test(line)) {
    for (let end = index; end < lines.length; end += 1) if (/<\/table>/i.test(lines[end])) return end;
    return -1;
  }
  if (/^>\s?/.test(line)) return runWhile(next => /^>\s?/.test(next));
  return -1;
}

/** Split the text into paragraphs, heading-like lines and runs of list items. */
function tokenize(text) {
  const tokens = [];
  let paragraph = [];
  const flush = () => {
    if (paragraph.length) tokens.push({ kind: 'paragraph', text: paragraph.join('\n') });
    paragraph = [];
  };
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  // Tables, display formulas and quotes stay whole: one block each, rendered
  // by the rich renderer, never split into headings or list items.
  let keepUntil = -1;
  lines.forEach((raw, index) => {
    if (index <= keepUntil) return;
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { flush(); return; }
    const run = richRunEnd(lines, index);
    if (run >= index) {
      flush();
      tokens.push({ kind: 'paragraph', text: lines.slice(index, run + 1).join('\n').trim(), rich: true });
      keepUntil = run;
      return;
    }
    const markdownHeading = line.match(/^\s*#{1,6}\s+\S/);
    if (markdownHeading) {
      flush();
      tokens.push({ kind: 'heading', text: line.trim() });
      return;
    }
    const item = isListItem(line);
    if (item) {
      flush();
      const last = tokens[tokens.length - 1];
      if (last?.kind === 'list') {
        last.items.push(item.text);
        last.ordered = last.ordered || item.ordered;
      } else {
        tokens.push({ kind: 'list', items: [item.text], ordered: item.ordered });
      }
      return;
    }
    const next = lines.slice(index + 1).find(candidate => candidate.trim());
    // A short line followed by more content reads as a heading — on its own, or
    // straight after a paragraph whose last sentence has ended.
    const paragraphEnded = !paragraph.length || /[.!?:;]$/.test(paragraph[paragraph.length - 1]);
    if (paragraphEnded && isHeadingLike(line) && next !== undefined) {
      flush();
      tokens.push({ kind: 'heading', text: line.trim() });
      return;
    }
    paragraph.push(line.trim());
  });
  flush();
  return tokens;
}

/**
 * Turn plain text into structured blocks. Each block's text is a line (or lines)
 * of the input, unchanged, so formatting can always be removed again.
 */
export function detectStructure(text) {
  const tokens = tokenize(text);
  const blocks = [];
  let seenTopic = false;
  let pendingCue = '';

  tokens.forEach((token, index) => {
    const next = tokens[index + 1];
    if (token.kind === 'heading') {
      const cue = cueOf(token.text);
      if (cue === 'exercise' || cue === 'assignment') {
        // The heading and the questions under it form one block.
        if (next?.kind === 'list') {
          blocks.push({ type: cue, text: token.text, items: next.items, ordered: next.ordered });
          next.consumed = true;
        } else {
          blocks.push({ type: cue, text: token.text });
          pendingCue = cue;
        }
        return;
      }
      if (next?.kind === 'list' && seenTopic) {
        blocks.push({ type: 'list', text: token.text, items: next.items, ordered: next.ordered });
        next.consumed = true;
        return;
      }
      if (!seenTopic && !cue) {
        blocks.push({ type: 'topic', text: token.text });
        seenTopic = true;
        return;
      }
      if (cue === 'note' && token.text.replace(NOTE_CUE, '').trim()) {
        blocks.push({ type: 'note', text: token.text });
        return;
      }
      const previous = blocks[blocks.length - 1];
      let type = 'heading';
      if (cue || SUBHEADING_CUE.test(token.text)) type = 'subheading';
      else if (previous?.type === 'topic') type = 'subtopic';
      blocks.push({ type, text: token.text });
      pendingCue = cue;
      return;
    }

    if (token.kind === 'list') {
      if (token.consumed) return;
      const previous = blocks[blocks.length - 1];
      if (pendingCue === 'exercise' || pendingCue === 'assignment') {
        if (previous && previous.type === pendingCue && !previous.items) {
          previous.items = token.items;
          previous.ordered = token.ordered;
          pendingCue = '';
          return;
        }
      }
      blocks.push({ type: 'list', text: '', items: token.items, ordered: token.ordered });
      pendingCue = '';
      return;
    }

    // Paragraphs: the cue from the heading above decides what they are.
    const inline = cueOf(token.text.split('\n')[0]);
    let type = 'paragraph';
    if (pendingCue === 'definition') type = 'definition';
    else if (pendingCue === 'example' || inline === 'example') type = 'example';
    else if (pendingCue === 'note' || inline === 'note') type = 'note';
    else if (pendingCue === 'exercise' || pendingCue === 'assignment') type = pendingCue;
    else if (!token.rich && /\b(is defined as|can be defined as|refers to)\b/i.test(token.text)) type = 'definition';
    else if (!token.rich && blocks[blocks.length - 1]?.type === 'topic' && DEFINITION_SENTENCE.test(token.text.split(/[.!?]/)[0])) type = 'definition';
    blocks.push({ type, text: token.text });
    pendingCue = '';
  });

  return blocks;
}

/** Whether detection found enough structure to be worth offering. */
export function hasMeaningfulStructure(blocks) {
  return blocks.filter(block => block.type !== 'paragraph').length >= 2;
}

/** Plain text of the blocks — mirrors the server's description fallback. */
export function blocksToPlainText(blocks) {
  return (blocks || []).map(block => {
    const lines = block.text ? [block.text] : [];
    (block.items || []).forEach((item, index) => lines.push(block.ordered ? `${index + 1}. ${item}` : `• ${item}`));
    return lines.join('\n');
  }).join('\n\n');
}

/** The words of a text, ignoring layout and list markers, for "has the text changed?" checks. */
export function wordsOf(text) {
  return String(text || '')
    .split('\n')
    .map(line => { const item = isListItem(line); return item ? item.text : line; })
    .join(' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

export function blocksMatchText(blocks, text) {
  return wordsOf(blocksToPlainText(blocks)) === wordsOf(text);
}
