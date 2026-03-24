import crypto from 'crypto';

import type { User } from '../../../rbac.js';
import { GLOBAL_SCOPE, readDocument, writeDocument } from '../../common/runtimeDocumentStore.js';

export type PracticeScope = 'practice' | 'exam' | 'cbt' | 'mid-term';
export type PracticeVisibility = 'global' | 'school';
export type PracticeExamFamily = 'JAMB' | 'WAEC' | 'NECO' | 'IGCSE' | 'GCE' | 'NABTEB' | 'NECO BECE' | 'Junior WAEC' | 'NCEE' | 'School Practice' | 'Scholarship';
export type PracticeClassBand = 'Grade 3-6' | 'JSS 1-3' | 'SS 1-3' | 'Mixed';
export type PracticeQuestionAnswerSource = 'provided' | 'assisted';

export type PracticeQuestionRecord = {
  id: string;
  stem: string;
  options: string[];
  answer: string;
  explanation?: string;
  hint?: string;
  answerSource?: PracticeQuestionAnswerSource;
};

export type PracticeSetRecord = {
  id: string;
  schoolId?: string;
  source: string;
  scope: PracticeScope;
  visibility: PracticeVisibility;
  subject: string;
  title: string;
  level?: string;
  mode?: string;
  reward?: string;
  note: string;
  questionItems: PracticeQuestionRecord[];
  questions: number;
  examFamily?: PracticeExamFamily;
  classBand?: PracticeClassBand;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  importedFromCompetitionId?: string;
  tags?: string[];
};

type PracticeBankState = {
  sets: PracticeSetRecord[];
};

export type CreatePracticeQuestionInput = {
  id?: string;
  stem: string;
  options: string[];
  answer?: string;
  explanation?: string;
  hint?: string;
};

export type CreatePracticeSetInput = {
  source?: string;
  scope?: PracticeScope;
  visibility?: PracticeVisibility;
  subject: string;
  title: string;
  level?: string;
  mode?: string;
  reward?: string;
  note?: string;
  questions: CreatePracticeQuestionInput[];
  examFamily?: PracticeExamFamily;
  classBand?: PracticeClassBand;
  tags?: string[];
  importedFromCompetitionId?: string;
};

export type BulkParsedQuestion = CreatePracticeQuestionInput & {
  answerSource: PracticeQuestionAnswerSource;
};

const NAMESPACE = 'classroom-practice-bank';
const DEFAULT_EXAM_FAMILY: PracticeExamFamily = 'School Practice';
const DEFAULT_CLASS_BAND: PracticeClassBand = 'Mixed';
const QUESTION_LIMIT = 100;

function defaultState(): PracticeBankState {
  return { sets: [] };
}

async function readState() {
  return readDocument<PracticeBankState>(NAMESPACE, GLOBAL_SCOPE, defaultState);
}

async function writeState(state: PracticeBankState) {
  return writeDocument(NAMESPACE, GLOBAL_SCOPE, state);
}

function nowIso() {
  return new Date().toISOString();
}

function ensureSchoolId(user: User) {
  return String(user.school_id || 'school-1').trim();
}

function ensureQuestionOptions(options: string[], fallbackAnswer: string) {
  const normalized = options
    .map((option) => String(option || '').trim())
    .filter(Boolean)
    .slice(0, 4);
  const fallback = fallbackAnswer || 'Option A';
  while (normalized.length < 4) {
    normalized.push(normalized.length === 0 ? fallback : `Option ${String.fromCharCode(65 + normalized.length)}`);
  }
  return normalized;
}

function resolveAnswer(options: string[], answer?: string) {
  const trimmed = String(answer || '').trim();
  if (!trimmed) return { answer: options[0], answerSource: 'assisted' as const };
  const optionMatch = options.find((option) => option.toLowerCase() === trimmed.toLowerCase());
  if (optionMatch) return { answer: optionMatch, answerSource: 'provided' as const };
  const letterMatch = trimmed.match(/^([A-D])$/i);
  if (letterMatch) {
    const option = options[letterMatch[1].toUpperCase().charCodeAt(0) - 65];
    if (option) return { answer: option, answerSource: 'provided' as const };
  }
  return { answer: options[0], answerSource: 'assisted' as const };
}

function createHint(stem: string, answer: string, explanation?: string) {
  if (explanation) {
    return explanation.split(/[.!?]/).map((part) => part.trim()).find(Boolean)?.slice(0, 180);
  }
  const answerTokens = answer.split(/\s+/).filter(Boolean);
  const reveal = answerTokens.slice(0, 2).join(' ');
  return `Focus on the core idea in this question. Key phrase: ${reveal || stem.slice(0, 32)}.`;
}

function createExplanation(stem: string, answer: string, explanation?: string, answerSource?: PracticeQuestionAnswerSource) {
  const provided = String(explanation || '').trim();
  if (provided) return provided;
  if (answerSource === 'assisted') {
    return `No official explanation was supplied for this item, so Ndovera generated a review note using the saved answer "${answer}". Confirm this answer during content moderation.`;
  }
  return `The correct response is "${answer}" because it best satisfies the requirement in the question: ${stem}.`;
}

function normalizeQuestion(input: CreatePracticeQuestionInput, index: number): PracticeQuestionRecord {
  const stem = String(input.stem || '').trim() || `Practice question ${index + 1}`;
  const options = ensureQuestionOptions(Array.isArray(input.options) ? input.options : [], String(input.answer || '').trim());
  const answerResolution = resolveAnswer(options, input.answer);
  const explanation = createExplanation(stem, answerResolution.answer, input.explanation, answerResolution.answerSource);
  return {
    id: String(input.id || `practice_question_${crypto.randomUUID()}`),
    stem,
    options,
    answer: answerResolution.answer,
    explanation,
    hint: String(input.hint || '').trim() || createHint(stem, answerResolution.answer, explanation),
    answerSource: answerResolution.answerSource,
  };
}

function normalizeSet(input: CreatePracticeSetInput, actor: { id: string; schoolId?: string }, existingId?: string): PracticeSetRecord {
  const createdAt = nowIso();
  const questionItems = input.questions.slice(0, QUESTION_LIMIT).map((question, index) => normalizeQuestion(question, index));
  return {
    id: existingId || `practice_set_${crypto.randomUUID()}`,
    schoolId: input.visibility === 'school' ? actor.schoolId || undefined : undefined,
    source: String(input.source || '').trim() || (input.scope === 'exam' ? 'Exam sync' : 'Practice bank'),
    scope: input.scope || 'practice',
    visibility: input.visibility || 'school',
    subject: String(input.subject || '').trim() || 'General Studies',
    title: String(input.title || '').trim() || 'Untitled practice bank',
    level: String(input.level || '').trim() || undefined,
    mode: String(input.mode || '').trim() || undefined,
    reward: String(input.reward || '').trim() || undefined,
    note: String(input.note || '').trim() || 'Practice bank ready for guided revision and mock drills.',
    questionItems,
    questions: questionItems.length,
    examFamily: input.examFamily || DEFAULT_EXAM_FAMILY,
    classBand: input.classBand || DEFAULT_CLASS_BAND,
    createdBy: actor.id,
    createdAt,
    updatedAt: createdAt,
    importedFromCompetitionId: String(input.importedFromCompetitionId || '').trim() || undefined,
    tags: Array.isArray(input.tags) ? input.tags.map((tag) => String(tag || '').trim()).filter(Boolean) : [],
  };
}

function visibleToUser(set: PracticeSetRecord, user: User) {
  if (set.visibility === 'global') return true;
  return set.schoolId === ensureSchoolId(user);
}

function sortSets(left: PracticeSetRecord, right: PracticeSetRecord) {
  return right.updatedAt.localeCompare(left.updatedAt) || left.title.localeCompare(right.title);
}

export async function listPracticeSetsForUser(user: User) {
  const state = await readState();
  return state.sets.filter((set) => visibleToUser(set, user)).sort(sortSets);
}

export async function listPracticeSetsForAdmin() {
  const state = await readState();
  return [...state.sets].sort(sortSets);
}

export async function createPracticeSetForUser(user: User, input: CreatePracticeSetInput) {
  const state = await readState();
  const set = normalizeSet({
    ...input,
    visibility: input.visibility || 'school',
    scope: input.scope || 'practice',
    examFamily: input.examFamily || DEFAULT_EXAM_FAMILY,
    classBand: input.classBand || DEFAULT_CLASS_BAND,
    source: input.source || 'Teacher question bank',
  }, { id: user.id, schoolId: ensureSchoolId(user) });
  state.sets.unshift(set);
  await writeState(state);
  return set;
}

export async function upsertPracticeSetForAdmin(input: CreatePracticeSetInput) {
  const state = await readState();
  const competitionId = String(input.importedFromCompetitionId || '').trim();
  const existing = competitionId ? state.sets.find((set) => set.importedFromCompetitionId === competitionId) : undefined;
  const next = normalizeSet({
    ...input,
    visibility: input.visibility || 'global',
    source: input.source || 'Ndovera examinations bank',
  }, { id: 'super-admin', schoolId: undefined }, existing?.id);
  if (existing) {
    const index = state.sets.findIndex((set) => set.id === existing.id);
    state.sets[index] = { ...existing, ...next, createdAt: existing.createdAt, updatedAt: nowIso() };
  } else {
    state.sets.unshift(next);
  }
  await writeState(state);
  return next;
}

export function deriveExplanationForQuestion(input: { stem: string; options: string[]; answer: string; explanation?: string }) {
  const normalized = normalizeQuestion({
    stem: input.stem,
    options: input.options,
    answer: input.answer,
    explanation: input.explanation,
  }, 0);
  return normalized.explanation || 'Ndovera could not generate an explanation for this question.';
}

function normalizeOptionLabel(value: string) {
  return value.replace(/^[(\[]?([A-Da-d]|\d+)[)\].:-]?\s+/, '').trim();
}

function parseAnswerValue(value: string, options: string[]) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  const letterOnly = trimmed.match(/^([A-D])(?:\b|\s)/i);
  if (letterOnly) {
    const option = options[letterOnly[1].toUpperCase().charCodeAt(0) - 65];
    if (option) return option;
  }
  const exact = options.find((option) => option.toLowerCase() === normalizeOptionLabel(trimmed).toLowerCase());
  return exact || normalizeOptionLabel(trimmed);
}

function finalizeParsedQuestion(current: { stem: string[]; options: string[]; answer?: string; explanation: string[]; hint: string[] }, index: number): BulkParsedQuestion | null {
  const stem = current.stem.join(' ').trim();
  const options = current.options.map((option) => normalizeOptionLabel(option)).filter(Boolean).slice(0, 4);
  if (!stem || options.length < 2) return null;
  const resolvedAnswer = parseAnswerValue(current.answer || '', options);
  const answerResolution = resolveAnswer(ensureQuestionOptions(options, resolvedAnswer), resolvedAnswer);
  const explanation = current.explanation.join(' ').trim();
  const hint = current.hint.join(' ').trim();
  return {
    id: `bulk_question_${index + 1}_${crypto.randomUUID()}`,
    stem,
    options: ensureQuestionOptions(options, answerResolution.answer),
    answer: answerResolution.answer,
    explanation: explanation || undefined,
    hint: hint || undefined,
    answerSource: answerResolution.answerSource,
  };
}

export function parseBulkPracticeQuestions(rawText: string) {
  const text = String(rawText || '').replace(/\r/g, '').trim();
  if (!text) return [] as BulkParsedQuestion[];
  const lines = text.split('\n');
  const questions: BulkParsedQuestion[] = [];
  let current = { stem: [] as string[], options: [] as string[], answer: '', explanation: [] as string[], hint: [] as string[] };
  let mode: 'stem' | 'explanation' | 'hint' = 'stem';

  const pushCurrent = () => {
    const parsed = finalizeParsedQuestion(current, questions.length);
    if (parsed) questions.push(parsed);
    current = { stem: [], options: [], answer: '', explanation: [], hint: [] };
    mode = 'stem';
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (current.stem.length && current.options.length >= 2) pushCurrent();
      continue;
    }
    const questionStart = line.match(/^(?:question\s*)?(\d+)[).:-]\s*(.+)$/i);
    const optionMatch = line.match(/^[(\[]?([A-Da-d])[)\].:-]?\s+(.+)$/);
    const answerMatch = line.match(/^(?:answer|correct\s*answer)\s*[:\-]\s*(.+)$/i);
    const explanationMatch = line.match(/^explanation\s*[:\-]\s*(.+)$/i);
    const hintMatch = line.match(/^hint\s*[:\-]\s*(.+)$/i);

    if (questionStart) {
      if (current.stem.length || current.options.length) pushCurrent();
      current.stem.push(questionStart[2].trim());
      continue;
    }
    if (optionMatch) {
      current.options.push(optionMatch[2].trim());
      mode = 'stem';
      continue;
    }
    if (answerMatch) {
      current.answer = answerMatch[1].trim();
      continue;
    }
    if (explanationMatch) {
      current.explanation.push(explanationMatch[1].trim());
      mode = 'explanation';
      continue;
    }
    if (hintMatch) {
      current.hint.push(hintMatch[1].trim());
      mode = 'hint';
      continue;
    }
    if (mode === 'explanation') current.explanation.push(line);
    else if (mode === 'hint') current.hint.push(line);
    else current.stem.push(line);
  }

  if (current.stem.length || current.options.length) pushCurrent();
  return questions.slice(0, QUESTION_LIMIT);
}
