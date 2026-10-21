import { createId, createQuestion, optionLetter } from './assignmentModel';

// Turns questions pasted from Word, WhatsApp, a PDF or a past paper into assignment questions,
// so a teacher never has to build them one by one.
//
//   1. What is 2 + 2?            Questions start at a number: "1." "1)" "Q1." "Question 1:".
//   A. 3   B. 4   C. 5   D. 6     Options: "A." "a)" "(A)" "A:" "A -" — one per line or several on a line.
//   Answer: B                     "Answer/Ans/Correct answer: B", a "*" or "(correct)" on the option,
//                                 or an answer key at the end ("Answers: 1. B 2. C" or one per line).
//   Explanation: 2 + 2 = 4        "Explanation:", "Solution:" or "Working:" lines are kept.
//
// Section headings ("SECTION A: OBJECTIVES", "Section B (Theory)") and the older "[MCQ]",
// "[ESSAY]", "[COMPREHENSION]", "[CROSS MATCHING]" tags set the type of what follows.
// Formulas written as \( … \) or $$ … $$ are kept as they are.

// The delimiter must be followed by a space or the line's end, so "2.5 kg" or "3-4" is not a new question.
const QUESTION_START = /^\s*(?:q(?:uestion)?\s*\.?\s*)?(?:no\.?\s*)?\(?(\d{1,3})\s*[.):\-–](?:\s+|$)(.*)$/i;
const OPTION_LINE = /^\s*\(?([A-Ha-h])\s*[).:\-–]\s+(.*)$|^\s*\(([A-Ha-h])\)\s*(.*)$/;
const ANSWER_LINE = /^\s*(?:correct\s+answer|correct\s+option|answer|ans|key)\s*[:.\-–=]?\s*(.*)$/i;
const EXPLANATION_LINE = /^\s*(?:explanation|solution|working|reason)\s*[:.\-–]\s*(.*)$/i;
const ANSWER_KEY_HEADER = /^\s*(?:answer\s*key|answers|marking\s*scheme|key)\s*[:.\-–]?\s*(.*)$/i;
const CORRECT_MARK = /\s*(?:\*+|\(correct\)|\[correct\]|✓|✔)\s*$/i;
const LEADING_CORRECT_MARK = /^\s*(?:\*+|✓|✔)\s*/;

function typeFromHeading(text) {
  const value = String(text || '').toLowerCase();
  if (/objective|multiple\s*choice|mcq|choose the correct/.test(value)) return 'mcq';
  if (/fill|blank|gap/.test(value)) return 'fillgaps';
  if (/short/.test(value)) return 'shortanswer';
  if (/match/.test(value)) return 'crossmatching';
  if (/comprehension|passage/.test(value)) return 'comprehension';
  if (/long/.test(value)) return 'longanswer';
  if (/theory|essay|subjective|structured|answer (any|all)/.test(value)) return 'essay';
  return '';
}

/** "A. 2   B. 4  C. 6" on one line → ['2', '4', '6'] (letters must run A, B, C… in order). */
function splitInlineOptions(line) {
  const marker = /(^|\s)\(?([A-Ha-h])\s*[).:]\s+/g;
  const hits = [];
  let match;
  while ((match = marker.exec(line))) hits.push({ letter: match[2].toUpperCase(), start: match.index + match[1].length, contentStart: marker.lastIndex });
  if (hits.length < 2) return null;
  for (let index = 0; index < hits.length; index += 1) if (hits[index].letter !== optionLetter(index)) return null;
  return hits.map((hit, index) => line.slice(hit.contentStart, index + 1 < hits.length ? hits[index + 1].start : undefined).trim());
}

/** An option's text, and whether it was marked as the correct one. */
function readOption(text) {
  const marked = CORRECT_MARK.test(text) || LEADING_CORRECT_MARK.test(text);
  return { text: text.replace(CORRECT_MARK, '').replace(LEADING_CORRECT_MARK, '').trim(), marked };
}

/** "1. B  2. C 3-A" / "1B 2C" / "B" → { 1: 'B', 2: 'C', 3: 'A' }. */
function readAnswerKey(text) {
  const key = {};
  const pattern = /(\d{1,3})\s*[.):\-–=]?\s*\(?([A-Ha-h])\)?(?![A-Za-z])/g;
  let match;
  while ((match = pattern.exec(text))) key[Number(match[1])] = match[2].toUpperCase();
  return key;
}

function finishQuestion(raw, defaultType) {
  const options = raw.options.map(option => option.text).filter(Boolean);
  const markedIndex = raw.options.findIndex(option => option.marked);
  const type = options.length >= 2 ? 'mcq'
    : raw.type && raw.type !== 'mcq' ? raw.type
      : /_{3,}|\.{4,}|\[\s*blank\s*\]/i.test(raw.prompt) ? 'fillgaps'
        : raw.answer && raw.answer.length <= 60 ? 'shortanswer'
          : defaultType && defaultType !== 'mcq' ? defaultType : 'essay';
  const question = { ...createQuestion(type), id: createId('question'), sourceNumber: raw.number, prompt: raw.prompt.trim() };
  if (type === 'mcq') {
    question.options = options;
    const letter = /^\(?([A-Ha-h])\)?(?:[\s.):]|$)/.exec(String(raw.answer || '').trim())?.[1];
    if (letter) question.answer = options[letter.toUpperCase().charCodeAt(0) - 65] || '';
    else if (raw.answer) question.answer = options.find(option => option.toLowerCase() === raw.answer.trim().toLowerCase()) || '';
    if (!question.answer && markedIndex >= 0) question.answer = raw.options[markedIndex].text;
    question.explanation = raw.explanation.trim();
  } else if (type === 'fillgaps') {
    question.acceptedAnswers = raw.answer || '';
  } else if (type === 'shortanswer') {
    question.answer = raw.answer || '';
  } else {
    question.markingGuide = [raw.answer, raw.explanation].filter(Boolean).join('\n');
  }
  return question;
}

/** The older tagged blocks for comprehension and matching. */
function parseTaggedBlock(type, block) {
  const lines = block.split('\n');
  const trimmed = lines.map(line => line.trim()).filter(Boolean);
  if (type === 'crossmatching') {
    const prompt = trimmed.find(line => /^prompt\s*:/i.test(line))?.replace(/^prompt\s*:/i, '').trim() || trimmed.find(line => !/->|→/.test(line)) || 'Match the following.';
    const pairs = trimmed.filter(line => /->|→/.test(line)).map(line => {
      const [left, right] = line.split(/->|→/);
      return { id: createId('pair'), left: String(left || '').replace(QUESTION_START, '$2').trim(), right: String(right || '').trim() };
    });
    return [{ ...createQuestion('crossmatching'), prompt, pairs }];
  }
  if (type === 'comprehension') {
    const questionAt = lines.findIndex(line => /^\s*question\s*:/i.test(line));
    const guideAt = lines.findIndex(line => /^\s*(marking guide|answer)\s*:/i.test(line));
    const passageLines = lines.slice(0, questionAt >= 0 ? questionAt : lines.length).join('\n').replace(/^\s*passage\s*:/im, '').trim();
    return [{
      ...createQuestion('comprehension'),
      passage: passageLines,
      prompt: questionAt >= 0 ? lines[questionAt].replace(/^\s*question\s*:/i, '').trim() : '',
      markingGuide: guideAt >= 0 ? lines[guideAt].replace(/^\s*(marking guide|answer)\s*:/i, '').trim() : '',
    }];
  }
  return null;
}

/**
 * Pasted text → { questions, warnings }. `warnings` say, by number, what a teacher should
 * check (no answer found, too few options, nothing recognised).
 */
export function importQuestions(rawText) {
  const text = String(rawText || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[   ]/g, ' ')
    .replace(/\t/g, '  ')
    .replace(/[​﻿]/g, '');
  if (!text.trim()) return { questions: [], warnings: ['Paste some questions first.'] };

  const questions = [];
  const warnings = [];
  let defaultType = '';
  let current = null;
  let lastField = 'prompt';
  let answerKey = {};
  let inAnswerKey = false;
  let tagged = null; // { type, lines } for [COMPREHENSION] / [CROSS MATCHING] blocks

  const flush = () => {
    if (tagged) {
      const parsed = parseTaggedBlock(tagged.type, tagged.lines.join('\n'));
      if (parsed) questions.push(...parsed);
      tagged = null;
    }
    if (!current) return;
    if (current.prompt.trim() || current.options.length) questions.push(finishQuestion(current, defaultType));
    current = null;
  };

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) { lastField = current?.options.length ? 'options' : 'prompt'; if (tagged) tagged.lines.push(''); continue; }

    const tag = /^\s*\[([^\]]+)\]\s*(.*)$/.exec(trimmed);
    if (tag) {
      flush();
      const type = typeFromHeading(tag[1]) || (/cross/i.test(tag[1]) ? 'crossmatching' : '');
      if (type === 'comprehension' || type === 'crossmatching') tagged = { type, lines: tag[2] ? [tag[2]] : [] };
      else defaultType = type || defaultType;
      inAnswerKey = false;
      continue;
    }
    if (tagged) { tagged.lines.push(line); continue; }

    if (/^\s*section\b/i.test(trimmed) || (/^[A-Z][A-Z\s()/:-]{5,}$/.test(trimmed) && typeFromHeading(trimmed))) {
      flush();
      defaultType = typeFromHeading(trimmed) || defaultType;
      inAnswerKey = false;
      continue;
    }

    const keyHeader = ANSWER_KEY_HEADER.exec(trimmed);
    if (keyHeader && (!current || (/key|answers|scheme/i.test(trimmed.split(/[:.\-–]/)[0]) && !/^\s*(answer|ans)\s*[:.\-–]/i.test(trimmed)))) {
      flush();
      inAnswerKey = true;
      Object.assign(answerKey, readAnswerKey(keyHeader[1] || ''));
      continue;
    }
    if (inAnswerKey) {
      const found = readAnswerKey(trimmed);
      if (Object.keys(found).length) { Object.assign(answerKey, found); continue; }
      inAnswerKey = false;
    }

    const answer = ANSWER_LINE.exec(trimmed);
    if (answer && current && !QUESTION_START.test(trimmed)) { current.answer = answer[1].trim(); lastField = 'answer'; continue; }
    const explanation = EXPLANATION_LINE.exec(trimmed);
    if (explanation && current) { current.explanation = explanation[1].trim(); lastField = 'explanation'; continue; }

    const inline = current ? splitInlineOptions(trimmed) : null;
    if (inline && (current.options.length === 0 || /^\(?[Aa]\s*[).:]/.test(trimmed))) {
      current.options.push(...inline.map(readOption));
      lastField = 'options';
      continue;
    }

    const option = OPTION_LINE.exec(trimmed);
    if (option && current) {
      const letter = (option[1] || option[3]).toUpperCase();
      // Options run A, B, C… in order; anything else is ordinary text (e.g. "I. …" in a passage).
      if (letter === optionLetter(current.options.length)) {
        current.options.push(readOption(option[2] ?? option[4] ?? ''));
        lastField = 'options';
        continue;
      }
    }

    const start = QUESTION_START.exec(trimmed);
    if (start) {
      flush();
      current = { number: Number(start[1]), prompt: start[2] || '', options: [], answer: '', explanation: '', type: defaultType };
      lastField = 'prompt';
      continue;
    }

    if (!current) {
      // Text before the first number is taken as a question of its own.
      current = { number: questions.length + 1, prompt: trimmed, options: [], answer: '', explanation: '', type: defaultType };
      lastField = 'prompt';
      continue;
    }
    // A line that carries on what came before.
    if (lastField === 'options' && current.options.length) current.options[current.options.length - 1].text += ` ${trimmed}`;
    else if (lastField === 'explanation') current.explanation += `\n${trimmed}`;
    else if (lastField === 'answer') current.answer += ` ${trimmed}`;
    else current.prompt += current.prompt ? `\n${trimmed}` : trimmed;
  }
  flush();

  // An answer key at the end fills in what is still unanswered, by question number.
  questions.forEach((question, index) => {
    const letter = answerKey[question.sourceNumber] || answerKey[index + 1];
    if (question.type === 'mcq' && !question.answer && letter) question.answer = question.options[letter.charCodeAt(0) - 65] || '';
  });

  questions.forEach((question, index) => {
    const label = `Question ${index + 1}`;
    if (question.type === 'mcq') {
      if (question.options.length < 2) warnings.push(`${label}: fewer than two options were found.`);
      else if (!question.answer) warnings.push(`${label}: no correct answer was found. Choose it below.`);
    }
    delete question.sourceNumber;
  });
  if (!questions.length) warnings.push('No questions were recognised. Number each question (1. 2. 3.) and start options with A. B. C. D.');
  return { questions, warnings };
}
