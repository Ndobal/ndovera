// Ndovera AI assessments: quizzes, assignments, tests and examination papers
// generated from the teacher's own topics and notes, then reviewed, edited and
// approved by the teacher. Nothing is ever published automatically.
//
//   configure → (exam: blueprint, approved by the teacher) → plan slots → AI writes
//   each slot → validate → constrained answer randomisation → quality audit →
//   teacher review / edit / regenerate → post or schedule (quiz/assignment) or
//   submit through the school's exam-question path (exam). Every save is a version.
//
// The structure is decided here, in code: which question types, which Bloom
// levels, which topics and how many marks. The model only writes the content
// of each slot, and everything it returns is validated. The checks that matter
// most — marks, Bloom coverage, duplicates, MCQ answer patterns — are computed,
// not asked of the model.

import { templateProblems } from './paperVariants'

export class AssessmentError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

// ─── Vocabulary ──────────────────────────────────────────────────────────────

export const KINDS = ['quiz', 'assignment', 'test', 'exam'] as const
export const QUESTION_TYPES = ['mcq', 'truefalse', 'fill', 'short', 'structured', 'essay', 'calculation', 'practical'] as const
export const BLOOM_LEVELS = ['remember', 'understand', 'apply', 'analyse', 'evaluate', 'create'] as const
export const DIFFICULTIES = ['easy', 'standard', 'hard', 'external', 'mixed'] as const
export const HIGHER_ORDER = new Set(['apply', 'analyse', 'evaluate', 'create'])
export type QuestionType = typeof QUESTION_TYPES[number]
export type Bloom = typeof BLOOM_LEVELS[number]

export const TYPE_LABELS: Record<QuestionType, string> = {
  mcq: 'Multiple choice', truefalse: 'True / False', fill: 'Fill in the gap', short: 'Short answer',
  structured: 'Structured', essay: 'Essay', calculation: 'Calculation', practical: 'Practical',
}

const OBJECTIVE_TYPES = new Set<QuestionType>(['mcq', 'truefalse', 'fill'])

// Which cognitive levels each question type can honestly test.
const TYPE_BLOOM: Record<QuestionType, Bloom[]> = {
  mcq: ['remember', 'understand', 'apply', 'analyse'],
  truefalse: ['remember', 'understand'],
  fill: ['remember', 'understand', 'apply'],
  short: ['remember', 'understand', 'apply', 'analyse'],
  calculation: ['apply', 'analyse'],
  structured: ['understand', 'apply', 'analyse', 'evaluate'],
  practical: ['apply', 'create', 'evaluate'],
  essay: ['analyse', 'evaluate', 'create', 'understand'],
}

// Relative marks a question of each type is worth, before scaling to the total.
const TYPE_WEIGHT: Record<QuestionType, number> = { mcq: 1, truefalse: 1, fill: 1, short: 2, calculation: 4, structured: 5, practical: 5, essay: 10 }

/**
 * Examination standards as data: structure, command words, cognitive demand.
 * The model is given these specifics rather than told to make something "WAEC hard".
 */
export const ASSESSMENT_PROFILES: Record<string, {
  label: string, mcqOptions: number, commandWords: string[], bloom: Record<Bloom, number>,
  style: string, sections: Array<{ name: string, type: QuestionType, share: number, choose?: string, instructions: string }>,
}> = {
  school: {
    label: 'School standard', mcqOptions: 4,
    commandWords: ['State', 'List', 'Define', 'Explain', 'Describe', 'Calculate', 'Compare', 'Discuss', 'Give reasons'],
    bloom: { remember: 20, understand: 25, apply: 25, analyse: 15, evaluate: 10, create: 5 },
    style: 'Clear classroom language matched to the class level; questions drawn from what was taught this term.',
    sections: [
      { name: 'A', type: 'mcq', share: 40, instructions: 'Answer ALL questions in this section. Choose the correct option.' },
      { name: 'B', type: 'structured', share: 30, instructions: 'Answer ALL questions in this section.' },
      { name: 'C', type: 'essay', share: 30, choose: '2 of 3', instructions: 'Answer any TWO questions in this section.' },
    ],
  },
  waec: {
    label: 'WAEC (WASSCE)', mcqOptions: 4,
    commandWords: ['State', 'Define', 'Explain', 'Describe', 'Outline', 'Highlight', 'Calculate', 'Distinguish between', 'Discuss', 'Account for', 'Examine'],
    bloom: { remember: 15, understand: 20, apply: 25, analyse: 20, evaluate: 15, create: 5 },
    style: 'WASSCE style: objective items with four options lettered A–D testing recall and application; theory questions in parts (a), (b), (c) with marks per part, data/graph interpretation, and essay questions requiring explanation with relevant West African examples.',
    sections: [
      { name: 'A', type: 'mcq', share: 40, instructions: 'Answer ALL questions. Each question is followed by four options lettered A to D. Find the correct option for each question.' },
      { name: 'B', type: 'structured', share: 30, instructions: 'Answer ALL questions in this section.' },
      { name: 'C', type: 'essay', share: 30, choose: '3 of 5', instructions: 'Answer any THREE questions from this section.' },
    ],
  },
  neco: {
    label: 'NECO (SSCE)', mcqOptions: 5,
    commandWords: ['State', 'Define', 'Explain', 'Describe', 'List', 'Calculate', 'Differentiate', 'Discuss', 'Mention', 'Enumerate'],
    bloom: { remember: 20, understand: 20, apply: 25, analyse: 20, evaluate: 10, create: 5 },
    style: 'NECO SSCE style: objective items with five options lettered A–E, then theory questions in lettered parts with stated marks.',
    sections: [
      { name: 'A', type: 'mcq', share: 50, instructions: 'Answer ALL questions. Choose the correct option from A to E.' },
      { name: 'B', type: 'essay', share: 50, choose: '4 of 6', instructions: 'Answer any FOUR questions from this section.' },
    ],
  },
  igcse: {
    label: 'IGCSE (Cambridge-style)', mcqOptions: 4,
    commandWords: ['State', 'Identify', 'Define', 'Describe', 'Explain', 'Calculate', 'Analyse', 'Compare', 'Evaluate', 'Discuss', 'Justify', 'Suggest'],
    bloom: { remember: 10, understand: 20, apply: 25, analyse: 25, evaluate: 15, create: 5 },
    style: 'Cambridge IGCSE style: precise command words with their Cambridge meanings, data and source-based questions, structured questions with (a)(i)(ii) parts and a mark in brackets for each part, and extended responses that reward analysis and a supported judgement. Left-aligned, clear, accessible wording.',
    sections: [
      { name: 'A', type: 'mcq', share: 30, instructions: 'Answer ALL questions. For each question there are four possible answers A, B, C and D. Choose the one you consider correct.' },
      { name: 'B', type: 'structured', share: 45, instructions: 'Answer ALL questions. Write your answers in the spaces provided.' },
      { name: 'C', type: 'essay', share: 25, choose: '1 of 2', instructions: 'Answer ONE question.' },
    ],
  },
  sat: {
    label: 'SAT-style', mcqOptions: 4,
    commandWords: ['Which choice', 'Based on the text', 'What is the value of', 'Which statement', 'Most likely'],
    bloom: { remember: 5, understand: 25, apply: 35, analyse: 30, evaluate: 5, create: 0 },
    style: 'SAT style: every item is four-option multiple choice or a student-produced numeric response, grounded in a short passage, table or real-world context; distractors reflect common reasoning errors.',
    sections: [
      { name: 'A', type: 'mcq', share: 100, instructions: 'For each question, choose the best answer from the four choices.' },
    ],
  },
  custom: {
    label: 'Custom', mcqOptions: 4,
    commandWords: ['State', 'Explain', 'Describe', 'Calculate', 'Analyse', 'Evaluate', 'Discuss'],
    bloom: { remember: 15, understand: 20, apply: 25, analyse: 20, evaluate: 15, create: 5 },
    style: 'Follow the teacher\'s custom instructions.',
    sections: [
      { name: 'A', type: 'mcq', share: 40, instructions: 'Answer ALL questions.' },
      { name: 'B', type: 'structured', share: 60, instructions: 'Answer ALL questions.' },
    ],
  },
}

// ─── Small helpers ───────────────────────────────────────────────────────────

export const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
  const number = Math.round(Number(value))
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}
const text = (value: unknown, max = 4000) => String(value ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max)
const letters = (count: number) => 'ABCDEFGH'.slice(0, count).split('')

/** Split an integer total across weights (largest remainder), each share at least `min`. */
export function apportion(total: number, weights: number[], min = 0) {
  const count = weights.length
  if (!count) return []
  const base = Math.max(0, total - min * count)
  const sum = weights.reduce((a, b) => a + b, 0) || count
  const raw = weights.map(weight => (base * (weight || (sum === count ? 1 : 0))) / sum)
  const floors = raw.map(Math.floor)
  let left = base - floors.reduce((a, b) => a + b, 0)
  const order = raw.map((value, index) => ({ index, rest: value - Math.floor(value) })).sort((a, b) => b.rest - a.rest)
  for (const { index } of order) { if (left <= 0) break; floors[index] += 1; left -= 1 }
  return floors.map(value => value + min)
}

/** A seeded random number generator, so a shuffle can be reproduced in tests. */
export function seededRandom(seed: number) {
  let state = (seed >>> 0) || 1
  return () => {
    state ^= state << 13; state >>>= 0
    state ^= state >>> 17
    state ^= state << 5; state >>>= 0
    return state / 4294967296
  }
}

// ─── Configuration ───────────────────────────────────────────────────────────

export type AssessmentConfig = {
  kind: typeof KINDS[number], standard: string, difficulty: typeof DIFFICULTIES[number],
  questionCount: number, totalMarks: number, durationMinutes: number,
  types: QuestionType[], bloomMode: 'auto' | 'custom', bloom: Record<Bloom, number>,
  source: string, topicIds: string[], topicNames: string[], classLevel: string, instructions: string,
  delivery: 'online' | 'printable' | 'both',
  /** A teacher's own paper may use 3–5 options; otherwise the standard decides. */
  mcqOptions?: number,
}

/** Senior and external-exam classes weight Apply, Analyse and Evaluate rather than recall. */
export function autoBloom(standard: string, difficulty: string, classLevel: string): Record<Bloom, number> {
  const profile = ASSESSMENT_PROFILES[standard] || ASSESSMENT_PROFILES.school
  const senior = /\b(ss\s*[1-3]|sss|senior|grade\s*1[0-2]|year\s*1[0-3]|a[- ]?level|igcse|waec|neco)\b/i.test(classLevel) || ['waec', 'neco', 'igcse', 'sat'].includes(standard)
  if (difficulty === 'easy') return { remember: 35, understand: 30, apply: 20, analyse: 10, evaluate: 5, create: 0 }
  if (difficulty === 'hard' || difficulty === 'external' || senior) {
    return { remember: 10, understand: 15, apply: 25, analyse: 25, evaluate: 20, create: 5 }
  }
  return { ...profile.bloom }
}

export function normalizeConfig(input: Record<string, any>, classLevel = ''): AssessmentConfig {
  const kind = (KINDS as readonly string[]).includes(String(input.kind)) ? input.kind : 'quiz'
  const standard = ASSESSMENT_PROFILES[String(input.standard)] ? String(input.standard) : 'school'
  const difficulty = (DIFFICULTIES as readonly string[]).includes(String(input.difficulty)) ? input.difficulty : 'standard'
  const defaults = kind === 'exam' ? { count: 40, marks: 100, minutes: 120 } : kind === 'test' ? { count: 20, marks: 40, minutes: 45 } : kind === 'assignment' ? { count: 5, marks: 20, minutes: 0 } : { count: 10, marks: 10, minutes: 15 }
  let types = (Array.isArray(input.types) ? input.types : []).map(String).filter((type: string) => (QUESTION_TYPES as readonly string[]).includes(type)) as QuestionType[]
  if (!types.length) types = kind === 'quiz' ? ['mcq'] : kind === 'assignment' ? ['short', 'structured', 'essay'] : ['mcq', 'structured', 'essay']
  const bloomMode = input.bloomMode === 'custom' ? 'custom' : 'auto'
  const bloom = bloomMode === 'custom'
    ? Object.fromEntries(BLOOM_LEVELS.map(level => [level, Math.max(0, Number(input.bloom?.[level]) || 0)])) as Record<Bloom, number>
    : autoBloom(standard, difficulty, classLevel)
  if (BLOOM_LEVELS.every(level => !bloom[level])) Object.assign(bloom, autoBloom(standard, difficulty, classLevel))
  return {
    kind, standard, difficulty,
    questionCount: clampInt(input.questionCount, 1, 80, defaults.count),
    totalMarks: clampInt(input.totalMarks, 1, 300, defaults.marks),
    durationMinutes: clampInt(input.durationMinutes, 0, 600, defaults.minutes),
    types, bloomMode, bloom,
    source: ['topics', 'notes', 'materials', 'curriculum', 'combination'].includes(String(input.source)) ? String(input.source) : 'combination',
    topicIds: (Array.isArray(input.topicIds) ? input.topicIds : []).map(String).slice(0, 30),
    topicNames: (Array.isArray(input.topicNames) ? input.topicNames : []).map((name: unknown) => text(name, 120)).filter(Boolean).slice(0, 30),
    classLevel: text(classLevel || input.classLevel, 60),
    instructions: text(input.instructions, 1500),
    delivery: ['online', 'printable', 'both'].includes(String(input.delivery)) ? input.delivery : (kind === 'exam' ? 'printable' : 'online'),
    ...(clampInt(input.mcqOptions, 0, 5, 0) >= 3 ? { mcqOptions: clampInt(input.mcqOptions, 3, 5, 4) } : {}),
  }
}

/** How many options each MCQ must have. */
export function optionCountFor(config: Pick<AssessmentConfig, 'standard' | 'mcqOptions'>) {
  return config.mcqOptions || (ASSESSMENT_PROFILES[config.standard] || ASSESSMENT_PROFILES.school).mcqOptions
}

// ─── Blueprint (examinations) ────────────────────────────────────────────────

export type BlueprintSection = {
  name: string, type: QuestionType, questions: number, attempt: number, marks: number, bloom: Bloom[], instructions: string,
  /** Marks for each question in the section (marks = marksPerQuestion × attempt). */
  marksPerQuestion: number,
  /** Sub-parts per question: 0 for none, 3 for (a), (b), (c). */
  parts: number,
  /** Question numbers (within the section, from 1) every candidate must answer. */
  compulsory: number[],
}

const PART_LABELS = 'abcdefgh'.split('')
const SUBPART_TYPES = new Set<QuestionType>(['structured', 'essay', 'calculation', 'practical', 'short'])

/** The rubric line for a section, from its numbers: "Question 1 is compulsory. Answer any other 4 questions." */
export function describeSection(section: Pick<BlueprintSection, 'type' | 'questions' | 'attempt' | 'compulsory'>) {
  const others = section.attempt - section.compulsory.length
  if (section.attempt >= section.questions) {
    return OBJECTIVE_TYPES.has(section.type) ? 'Answer ALL questions in this section. Choose the correct option for each question.' : 'Answer ALL questions in this section.'
  }
  if (section.compulsory.length) {
    const list = section.compulsory.length === 1 ? `Question ${section.compulsory[0]} is compulsory` : `Questions ${section.compulsory.slice(0, -1).join(', ')} and ${section.compulsory[section.compulsory.length - 1]} are compulsory`
    return others > 0 ? `${list}. Answer any ${others} other question${others === 1 ? '' : 's'}.` : `${list}.`
  }
  return `Answer any ${section.attempt} of the ${section.questions} questions in this section.`
}
export type Blueprint = { sections: BlueprintSection[], topics: Array<{ name: string, marks: number }>, totalMarks: number }

/** The paper plan the teacher approves before any question is written. */
export function proposeBlueprint(config: AssessmentConfig): Blueprint {
  const profile = ASSESSMENT_PROFILES[config.standard] || ASSESSMENT_PROFILES.school
  const allowed = new Set(config.types)
  // Keep the profile's sections whose type the teacher allowed; otherwise use the profile as is.
  const chosen = profile.sections.filter(section => allowed.has(section.type))
  const sections = chosen.length ? chosen : profile.sections
  const marks = apportion(config.totalMarks, sections.map(section => section.share), 1)
  const out = sections.map((section, index) => {
    // "Answer 3 of 5" comes from the standard; otherwise size the section by the
    // usual marks per question of its type (1 per MCQ, about 5 per structured question).
    const [chooseN, ofM] = String(section.choose || '').split(' of ').map(Number)
    const attempt = section.type === 'mcq' || OBJECTIVE_TYPES.has(section.type)
      ? Math.max(1, marks[index])
      : chooseN || Math.max(1, Math.round(marks[index] / TYPE_WEIGHT[section.type]))
    const questions = Math.max(attempt, ofM || attempt)
    const marksPerQuestion = Math.max(1, Math.round(marks[index] / attempt))
    const bloom = TYPE_BLOOM[section.type].filter(level => (config.bloom[level] || 0) > 0)
    // Exam-style theory questions come in parts (a), (b), (c).
    const parts = config.kind === 'exam' && (section.type === 'essay' || section.type === 'structured') ? 3 : 0
    return {
      name: section.name, type: section.type, questions, attempt, marksPerQuestion, marks: marksPerQuestion * attempt, parts, compulsory: [],
      bloom: bloom.length ? bloom : TYPE_BLOOM[section.type], instructions: section.instructions,
    }
  })
  const topics = config.topicNames.length ? config.topicNames : ['General']
  const topicMarks = apportion(config.totalMarks, topics.map(() => 1))
  const totalMarks = out.reduce((sum, section) => sum + section.marks, 0)
  return { sections: out, topics: topics.map((name, index) => ({ name, marks: topicMarks[index] })), totalMarks }
}

export function normalizeBlueprint(input: any, config: AssessmentConfig): Blueprint {
  const sections = (Array.isArray(input?.sections) ? input.sections : []).slice(0, 8).map((section: any, index: number) => {
    const type = (QUESTION_TYPES as readonly string[]).includes(String(section?.type)) ? section.type as QuestionType : 'structured'
    const questions = clampInt(section?.questions, 1, 120, 1)
    const compulsory = [...new Set((Array.isArray(section?.compulsory) ? section.compulsory : String(section?.compulsory || '').split(/[\s,;]+/))
      .map((value: unknown) => clampInt(value, 0, questions, 0)).filter((value: number) => value >= 1))].sort((a, b) => a - b) as number[]
    const attempt = Math.max(compulsory.length, clampInt(section?.attempt, 1, questions, questions))
    // Marks per question is what teachers set; older drafts only stored the section total.
    const marksPerQuestion = clampInt(section?.marksPerQuestion ?? Math.round(Number(section?.marks || 0) / attempt), 1, 100, 1)
    const parts = SUBPART_TYPES.has(type) ? clampInt(section?.parts, 0, PART_LABELS.length, 0) : 0
    const bloom = (Array.isArray(section?.bloom) && section.bloom.length ? section.bloom : TYPE_BLOOM[type]).filter((level: string) => (BLOOM_LEVELS as readonly string[]).includes(level)) as Bloom[]
    const shaped = { type, questions, attempt, compulsory }
    return {
      name: text(section?.name, 4) || String.fromCharCode(65 + index),
      type, questions, attempt, marksPerQuestion, marks: marksPerQuestion * attempt, parts, compulsory,
      bloom: bloom.length ? bloom : TYPE_BLOOM[type],
      instructions: text(section?.instructions, 400) || describeSection(shaped),
    }
  })
  if (!sections.length) throw new AssessmentError('The blueprint needs at least one section.')
  const topics = (Array.isArray(input?.topics) ? input.topics : []).map((topic: any) => ({ name: text(topic?.name, 120), marks: clampInt(topic?.marks, 0, 300, 0) })).filter((topic: any) => topic.name)
  const totalMarks = sections.reduce((sum: number, section: BlueprintSection) => sum + section.marks, 0)
  return { sections, topics: topics.length ? topics : proposeBlueprint(config).topics, totalMarks }
}

// ─── Slot planning ───────────────────────────────────────────────────────────

export type Slot = { index: number, section: string, type: QuestionType, bloom: Bloom, topic: string, marks: number, parts?: number, compulsory?: boolean }

/** Spread Bloom levels over slots (largest remainder), then give each slot a type that can test its level. */
function bloomSequence(count: number, weights: Record<Bloom, number>, allowedLevels?: Bloom[]) {
  const levels = (allowedLevels?.length ? allowedLevels : [...BLOOM_LEVELS]).filter(level => (weights[level] || 0) > 0)
  const use = levels.length ? levels : (allowedLevels?.length ? allowedLevels : [...BLOOM_LEVELS])
  const counts = apportion(count, use.map(level => weights[level] || 1))
  const out: Bloom[] = []
  use.forEach((level, index) => { for (let n = 0; n < counts[index]; n += 1) out.push(level) })
  return out
}

function topicFor(index: number, topics: Array<{ name: string, marks: number }>) {
  // Topics with more target marks get proportionally more questions.
  const weights = topics.map(topic => topic.marks || 1)
  const total = weights.reduce((a, b) => a + b, 0)
  let point = ((index * 0.618034) % 1) * total
  for (let t = 0; t < topics.length; t += 1) { point -= weights[t]; if (point < 0) return topics[t].name }
  return topics[topics.length - 1]?.name || 'General'
}

export function planSlots(config: AssessmentConfig, blueprint?: Blueprint | null): Slot[] {
  const topics = blueprint?.topics?.length ? blueprint.topics : (config.topicNames.length ? config.topicNames : ['General']).map(name => ({ name, marks: 1 }))
  const slots: Slot[] = []
  if (blueprint?.sections?.length) {
    for (const section of blueprint.sections) {
      // "Answer 3 of 5": every offered question carries the same marks.
      const perQuestion = section.marksPerQuestion || Math.max(1, Math.round(section.marks / Math.max(1, section.attempt)))
      const levels = bloomSequence(section.questions, config.bloom, section.bloom)
      for (let q = 0; q < section.questions; q += 1) {
        slots.push({
          index: slots.length, section: section.name, type: section.type, bloom: levels[q] || section.bloom[0] || 'understand', topic: topicFor(slots.length, topics),
          marks: perQuestion, ...(section.parts ? { parts: section.parts } : {}), ...((section.compulsory || []).includes(q + 1) ? { compulsory: true } : {}),
        })
      }
    }
    return slots
  }
  const levels = bloomSequence(config.questionCount, config.bloom)
  const types = config.types
  const chosen: QuestionType[] = levels.map((level, index) => {
    const fitting = types.filter(type => TYPE_BLOOM[type].includes(level))
    const pool = fitting.length ? fitting : types
    return pool[index % pool.length]
  })
  const marks = apportion(config.totalMarks, chosen.map(type => TYPE_WEIGHT[type]), config.totalMarks >= chosen.length ? 1 : 0)
  // Group by type so objective items come first, as on a real paper.
  const order = chosen.map((type, index) => ({ type, index })).sort((a, b) => QUESTION_TYPES.indexOf(a.type) - QUESTION_TYPES.indexOf(b.type) || a.index - b.index)
  order.forEach(({ type, index }) => {
    slots.push({ index: slots.length, section: OBJECTIVE_TYPES.has(type) ? 'A' : 'B', type, bloom: levels[index], topic: topicFor(index, topics), marks: Math.max(marks[index], 0) || 1 })
  })
  return slots
}

// ─── Questions ───────────────────────────────────────────────────────────────

export type Question = {
  id: string, slot: number, section: string, type: QuestionType, prompt: string, options: string[], answerIndex: number,
  answer: string, markingPoints: string[], alternatives: string[], workingSteps: string[], rubric: Array<{ criterion: string, marks: number }>,
  marks: number, bloom: Bloom, difficulty: string, topic: string, commandWord: string, source: 'ai' | 'teacher', flags: string[], pageBreakBefore?: boolean,
  /** (a), (b), (c)… each with its own marks and marking scheme. The prompt is the shared stem. */
  parts?: QuestionPart[],
  compulsory?: boolean,
}

export type QuestionPart = { label: string, prompt: string, marks: number, answer: string, markingPoints: string[] }

const newId = () => `q-${crypto.randomUUID().slice(0, 12)}`

/** Validate and tidy one question, from the model or from the teacher. Returns problems instead of throwing. */
export function normalizeQuestion(raw: any, slot: Partial<Slot>, optionCount = 4): { question: Question, problems: string[] } {
  const type = (QUESTION_TYPES as readonly string[]).includes(String(raw?.type)) ? raw.type as QuestionType : (slot.type || 'short')
  const problems: string[] = []
  const prompt = text(raw?.prompt || raw?.question || raw?.stem, 6000)
  let options: string[] = []
  let answerIndex = -1
  if (type === 'mcq' || type === 'truefalse') {
    options = type === 'truefalse' ? ['True', 'False'] : (Array.isArray(raw?.options) ? raw.options : []).map((option: unknown) => text(option, 600).replace(/^\(?[A-Ha-h][).:]\s+/, '')).filter(Boolean)
    if (type === 'mcq' && options.length !== optionCount) problems.push(`Needs exactly ${optionCount} options.`)
    if (new Set(options.map(option => option.toLowerCase())).size !== options.length) problems.push('Two options are the same.')
    const answer = raw?.answerIndex ?? raw?.answer ?? raw?.correct
    if (typeof answer === 'number') answerIndex = answer
    else if (/^[A-Ha-h]$/.test(String(answer ?? '').trim())) answerIndex = String(answer).trim().toUpperCase().charCodeAt(0) - 65
    else if (type === 'truefalse') answerIndex = /^t/i.test(String(answer ?? '')) ? 0 : /^f/i.test(String(answer ?? '')) ? 1 : -1
    else answerIndex = options.findIndex(option => option.toLowerCase() === String(answer ?? '').trim().toLowerCase())
    if (!(answerIndex >= 0 && answerIndex < options.length)) problems.push('The correct answer is not one of the options.')
  }
  const list = (value: unknown, max = 12) => (Array.isArray(value) ? value : value ? [value] : []).map(item => text(item, 1500)).filter(Boolean).slice(0, max)
  const rubric = (Array.isArray(raw?.rubric) ? raw.rubric : []).map((row: any) => ({ criterion: text(row?.criterion ?? row?.level ?? row, 400), marks: clampInt(row?.marks, 0, 100, 0) })).filter((row: any) => row.criterion).slice(0, 10)
  // For MCQs from the model, `answer` is the key letter; on a saved question (which
  // has answerIndex) it is the explanation text and must survive a re-save.
  const answerIsKey = (type === 'mcq' || type === 'truefalse') && typeof raw?.answerIndex !== 'number'
  const answer = text(raw?.expectedAnswer ?? raw?.modelAnswer ?? (answerIsKey ? '' : raw?.answer), 6000)
  const markingPoints = list(raw?.markingPoints ?? raw?.markScheme ?? raw?.marking_points)
  const partsMarked = Array.isArray(raw?.parts) && raw.parts.length > 0 && raw.parts.every((part: any) => part?.expectedAnswer || part?.answer || (Array.isArray(part?.markingPoints) && part.markingPoints.length))
  if (!OBJECTIVE_TYPES.has(type) && !answer && !markingPoints.length && !partsMarked) problems.push('The marking scheme is missing.')
  if (type === 'fill' && !answer) problems.push('The expected answer is missing.')
  const bloom = (BLOOM_LEVELS as readonly string[]).includes(String(raw?.bloom).toLowerCase()) ? String(raw.bloom).toLowerCase() as Bloom : (slot.bloom || 'understand')
  const totalMarks = clampInt(raw?.marks ?? slot.marks, 0, 100, slot.marks || 1)
  // Parts: as many as the plan asks for, their marks adding up to the question's.
  let parts: QuestionPart[] = (Array.isArray(raw?.parts) ? raw.parts : []).slice(0, PART_LABELS.length).map((part: any, index: number) => ({
    label: PART_LABELS[index], prompt: text(part?.prompt ?? part?.question ?? part, 4000), marks: clampInt(part?.marks, 0, 100, 0),
    answer: text(part?.expectedAnswer ?? part?.answer, 4000), markingPoints: list(part?.markingPoints ?? part?.markScheme, 10),
  })).filter((part: QuestionPart) => part.prompt.length >= 3)
  if (slot.parts && parts.length !== slot.parts) problems.push(`Needs parts (a)–(${PART_LABELS[slot.parts - 1]}).`)
  if (parts.length) {
    const sum = parts.reduce((total, part) => total + part.marks, 0)
    if (sum !== totalMarks) {
      const spread = apportion(totalMarks, parts.map(part => part.marks || 1))
      parts = parts.map((part, index) => ({ ...part, marks: spread[index] }))
    }
    if (parts.some(part => !part.answer && !part.markingPoints.length)) problems.push('A part has no marking scheme.')
  }
  // A question made only of parts — "1. (a) Define work. (b) …" — needs no stem of its own.
  if (prompt.length < 8 && !parts.length) problems.push('The question text is missing.')
  for (const issue of figureProblems([prompt, ...parts.map(part => part.prompt)].join('\n'))) problems.push(issue)
  for (const issue of templateProblems({ prompt, options, answer, markingPoints, parts })) problems.push(`Number template ${issue}`)
  const question: Question = {
    id: text(raw?.id, 40) || newId(), slot: slot.index ?? -1, section: text(raw?.section, 4) || slot.section || 'A', type, prompt, options, answerIndex,
    answer, markingPoints, alternatives: list(raw?.alternatives ?? raw?.acceptableAnswers), workingSteps: list(raw?.workingSteps ?? raw?.working ?? raw?.steps, 20),
    rubric, marks: totalMarks, bloom,
    difficulty: text(raw?.difficulty, 20) || 'standard', topic: text(raw?.topic, 120) || slot.topic || '',
    commandWord: text(raw?.commandWord, 40), source: raw?.source === 'teacher' ? 'teacher' : 'ai', flags: [],
    ...(raw?.pageBreakBefore ? { pageBreakBefore: true } : {}),
    ...(parts.length ? { parts } : {}),
    ...(raw?.compulsory || slot.compulsory ? { compulsory: true } : {}),
  }
  return { question, problems }
}

// ─── Figures ─────────────────────────────────────────────────────────────────
// Diagrams are never free-hand: a question carries a ```figure block of JSON
// that Ndovera draws exactly (frontend src/shared/rich/figures.js). These are
// the shapes it understands; anything else is sent back to be rewritten.

export const FIGURE_TYPES = ['function', 'line', 'bar', 'scatter', 'pie', 'geometry', 'circuit', 'numberline'] as const

const isNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
const isPoint = (value: unknown) => Array.isArray(value) && value.length === 2 && isNumber(value[0]) && isNumber(value[1])

/** Why a figure spec cannot be drawn ('' when it can). */
export function figureSpecError(spec: any): string {
  if (!spec || typeof spec !== 'object') return 'not an object'
  const type = String(spec.type || '')
  if (!(FIGURE_TYPES as readonly string[]).includes(type)) return `unknown figure type "${type}"`
  switch (type) {
    case 'function': {
      if (!Array.isArray(spec.functions) || !spec.functions.length || spec.functions.some((fn: any) => !fn || typeof fn.expr !== 'string' || !fn.expr.trim())) return 'functions need "expr"'
      if (!Array.isArray(spec.xRange) || spec.xRange.length !== 2 || !spec.xRange.every(isNumber) || spec.xRange[0] >= spec.xRange[1]) return 'xRange must be [min, max]'
      if (spec.functions.some((fn: any) => /[^0-9a-zA-Z_+\-*/^().,\s]/.test(fn.expr))) return 'expr uses unsupported characters'
      return ''
    }
    case 'line':
    case 'bar':
    case 'scatter': {
      if (!Array.isArray(spec.series) || !spec.series.length) return 'series are missing'
      for (const series of spec.series) {
        const values = series?.values
        const points = series?.points
        if (Array.isArray(values)) { if (!values.every(isNumber)) return 'series values must be numbers'; if (Array.isArray(spec.categories) && spec.categories.length !== values.length) return 'values and categories differ in length' }
        else if (Array.isArray(points)) { if (!points.every(isPoint)) return 'points must be [x, y]' }
        else return 'each series needs values or points'
      }
      return ''
    }
    case 'pie':
      return Array.isArray(spec.slices) && spec.slices.length >= 2 && spec.slices.every((slice: any) => isNumber(slice?.value) && slice.value >= 0) ? '' : 'slices need numeric values'
    case 'geometry': {
      const points = spec.points && typeof spec.points === 'object' ? spec.points : null
      if (!points || !Object.values(points).every(isPoint)) return 'points must map names to [x, y]'
      const named = (name: unknown) => typeof name === 'string' && Object.prototype.hasOwnProperty.call(points, name)
      for (const segment of spec.segments || []) if (!Array.isArray(segment) || !named(segment[0]) || !named(segment[1])) return 'segments must join named points'
      for (const polygon of spec.polygons || []) if (!Array.isArray(polygon) || polygon.length < 3 || !polygon.every(named)) return 'polygons must list named points'
      for (const circle of spec.circles || []) if (!(named(circle?.center) || isPoint(circle?.center)) || !isNumber(circle?.radius)) return 'circles need a center and radius'
      for (const angle of spec.angles || []) if (!named(angle?.at) || !named(angle?.from) || !named(angle?.to)) return 'angles need at/from/to points'
      return ''
    }
    case 'circuit': {
      const kinds = ['cell', 'battery', 'resistor', 'bulb', 'lamp', 'switch', 'ammeter', 'voltmeter', 'capacitor', 'diode', 'wire', 'rheostat', 'fuse']
      const ok = (list: any) => Array.isArray(list) && list.every((part: any) => kinds.includes(String(part?.type)))
      if (!ok(spec.components) || !spec.components.length) return `components must be from: ${kinds.join(', ')}`
      if (spec.parallel && (!Array.isArray(spec.parallel) || !spec.parallel.every(ok))) return 'parallel must be a list of component lists'
      return ''
    }
    case 'numberline':
      return isNumber(spec.min) && isNumber(spec.max) && spec.min < spec.max ? '' : 'min and max are needed'
    default:
      return ''
  }
}

/** Problems with the ```figure blocks inside a piece of question text. */
export function figureProblems(source: string) {
  const problems: string[] = []
  const pattern = /```figure\s*([\s\S]*?)```/g
  let match
  while ((match = pattern.exec(String(source || '')))) {
    let spec: unknown
    try { spec = JSON.parse(match[1]) } catch { problems.push('A figure is not valid JSON.'); continue }
    const error = figureSpecError(spec)
    if (error) problems.push(`A figure cannot be drawn: ${error}.`)
  }
  return problems
}

// ─── Constrained MCQ answer randomisation ────────────────────────────────────

const PINNED_OPTION = /^(all|none|both|neither)\b.*\b(above|of these|options?)\b|^(a|b) and (b|c)\b|^(all|none) of the above$/i

/** Whether `option` may follow `out`: never three in a row, never a run of four (A,B,C,D or D,C,B,A). */
function allowedNext(out: number[], option: number) {
  const position = out.length
  if (position >= 2 && out[position - 1] === option && out[position - 2] === option) return false
  if (position >= 3) {
    const run = [out[position - 3], out[position - 2], out[position - 1], option]
    if (run.every((value, index) => index === 0 || value === run[index - 1] + 1)) return false
    if (run.every((value, index) => index === 0 || value === run[index - 1] - 1)) return false
  }
  return true
}

/**
 * Answer letters for `count` questions: balanced (each letter used its share,
 * the extra ones falling on random letters), never three in a row, no A-B-C-D
 * runs. A randomised search that backs out of dead ends, so every rule holds
 * for every paper — a step-by-step pick could corner itself near the end.
 */
export function balancedAnswerSequence(count: number, optionCount: number, random: () => number) {
  // Which letters get the extra answers when the count does not divide evenly is random too.
  const shares = apportion(count, Array(optionCount).fill(1))
  const letterOrder = Array.from({ length: optionCount }, (_, option) => option)
  for (let index = letterOrder.length - 1; index > 0; index -= 1) { const swap = Math.floor(random() * (index + 1)); [letterOrder[index], letterOrder[swap]] = [letterOrder[swap], letterOrder[index]] }
  const target = Array(optionCount).fill(0)
  letterOrder.forEach((option, index) => { target[option] = shares[index] })

  const counts = Array(optionCount).fill(0)
  const out: number[] = []
  let budget = 50_000
  const search = (): boolean => {
    if (out.length === count) return true
    if (budget-- <= 0) return false
    const candidates = Array.from({ length: optionCount }, (_, option) => option)
      .filter(option => counts[option] < target[option] && allowedNext(out, option))
      .map(option => ({ option, need: target[option] - counts[option], tie: random() }))
      // Letters furthest below their share first keeps the search short; ties are random.
      .sort((a, b) => b.need - a.need || a.tie - b.tie)
    for (const { option } of candidates) {
      out.push(option)
      counts[option] += 1
      if (search()) return true
      out.pop()
      counts[option] -= 1
    }
    return false
  }
  if (search()) return out

  // No arrangement meets every rule (only possible with one or two letters, e.g.
  // a short True/False-style key): keep the run rules and relax the balance.
  const relaxed: number[] = []
  for (let position = 0; position < count; position += 1) {
    const options = Array.from({ length: optionCount }, (_, option) => option).filter(option => allowedNext(relaxed, option))
    const pool = options.length ? options : Array.from({ length: optionCount }, (_, option) => option)
    relaxed.push(pool[Math.floor(random() * pool.length)])
  }
  return relaxed
}

/** Reorder options so each correct answer lands on its planned letter, keeping "all/none of the above" last. */
export function placeAnswer(question: Question, targetIndex: number, random: () => number): Question {
  if (question.type !== 'mcq' || question.answerIndex < 0) return question
  const correct = question.options[question.answerIndex]
  const pinned = question.options.filter((option, index) => index !== question.answerIndex && PINNED_OPTION.test(option))
  if (PINNED_OPTION.test(correct)) return question // the answer itself must stay where its wording makes sense
  const free = question.options.filter((option, index) => index !== question.answerIndex && !PINNED_OPTION.test(option))
  for (let index = free.length - 1; index > 0; index -= 1) { const swap = Math.floor(random() * (index + 1)); [free[index], free[swap]] = [free[swap], free[index]] }
  const slots = question.options.length - pinned.length
  const at = Math.min(targetIndex, slots - 1)
  const reordered = [...free.slice(0, at), correct, ...free.slice(at), ...pinned]
  return { ...question, options: reordered, answerIndex: reordered.indexOf(correct) }
}

export function randomiseAnswers(questions: Question[], seed = Date.now()): Question[] {
  const random = seededRandom(seed)
  const mcqs = questions.filter(question => question.type === 'mcq' && question.answerIndex >= 0)
  if (!mcqs.length) return questions
  const optionCount = Math.max(...mcqs.map(question => question.options.length))
  const sequence = balancedAnswerSequence(mcqs.length, optionCount, random)
  let cursor = 0
  return questions.map(question => (question.type === 'mcq' && question.answerIndex >= 0 ? placeAnswer(question, sequence[cursor++], random) : question))
}

/** How predictable the answer key is. */
export function answerPatternReport(questions: Question[]) {
  const key = questions.filter(question => question.type === 'mcq' && question.answerIndex >= 0).map(question => question.answerIndex)
  const optionCount = Math.max(4, ...questions.filter(question => question.type === 'mcq').map(question => question.options.length))
  const distribution = letters(optionCount).map((letter, index) => ({ letter, count: key.filter(value => value === index).length }))
  let longestRun = key.length ? 1 : 0
  for (let index = 1, run = 1; index < key.length; index += 1) { run = key[index] === key[index - 1] ? run + 1 : 1; longestRun = Math.max(longestRun, run) }
  let cycles = 0
  for (let index = 3; index < key.length; index += 1) {
    const window = key.slice(index - 3, index + 1)
    if (window.every((value, i) => i === 0 || value === window[i - 1] + 1) || window.every((value, i) => i === 0 || value === window[i - 1] - 1)) cycles += 1
  }
  const expected = key.length / optionCount
  const maxShare = key.length ? Math.max(...distribution.map(item => item.count)) / key.length : 0
  const imbalance = key.length >= optionCount * 2 && distribution.some(item => Math.abs(item.count - expected) > Math.max(2, expected * 0.5))
  const risk = longestRun >= 3 || cycles > 0 || imbalance ? 'high' : maxShare > 0.4 && key.length >= 8 ? 'medium' : 'low'
  return { key: key.map(index => letters(optionCount)[index]).join(''), distribution, longestRun, cycles, risk }
}

// ─── Quality audit (computed) ────────────────────────────────────────────────

type Check = { key: string, label: string, status: 'ok' | 'warn' | 'fail', detail: string }

const words = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(word => word.length > 2)
function similarity(a: string, b: string) {
  const left = new Set(words(a))
  const right = new Set(words(b))
  if (!left.size || !right.size) return 0
  let shared = 0
  for (const word of left) if (right.has(word)) shared += 1
  return shared / Math.min(left.size, right.size)
}

export function bloomCoverage(questions: Question[], target: Record<Bloom, number>) {
  const total = questions.reduce((sum, question) => sum + question.marks, 0) || 1
  const targetSum = BLOOM_LEVELS.reduce((sum, level) => sum + (target[level] || 0), 0) || 1
  return BLOOM_LEVELS.map(level => {
    const items = questions.filter(question => question.bloom === level)
    const marks = items.reduce((sum, question) => sum + question.marks, 0)
    return { level, questions: items.length, marks, coverage: Math.round((marks / total) * 100), target: Math.round(((target[level] || 0) / targetSum) * 100) }
  })
}

export function auditAssessment(questions: Question[], config: AssessmentConfig, blueprint?: Blueprint | null): { checks: Check[], bloom: ReturnType<typeof bloomCoverage>, pattern: ReturnType<typeof answerPatternReport>, higherOrderPercent: number, totalMarks: number, examMarks: number } {
  const checks: Check[] = []
  const add = (key: string, label: string, status: Check['status'], detail: string) => checks.push({ key, label, status, detail })
  const profile = ASSESSMENT_PROFILES[config.standard] || ASSESSMENT_PROFILES.school

  // Marks: for "answer n of m" sections only the attempted questions count.
  const totalMarks = questions.reduce((sum, question) => sum + question.marks, 0)
  let examMarks = totalMarks
  if (blueprint?.sections?.length) {
    examMarks = blueprint.sections.reduce((sum, section) => {
      // Compulsory questions always count; the best of the rest fill the remaining answers.
      const inSection = questions.filter(question => question.section === section.name)
      const required = inSection.filter(question => question.compulsory).map(question => question.marks)
      const optional = inSection.filter(question => !question.compulsory).map(question => question.marks).sort((a, b) => b - a)
      return sum + required.reduce((a, b) => a + b, 0) + optional.slice(0, Math.max(0, section.attempt - required.length)).reduce((a, b) => a + b, 0)
    }, 0)
  }
  const targetMarks = blueprint?.totalMarks || config.totalMarks
  add('marks', 'Total marks', examMarks === targetMarks ? 'ok' : 'fail', `${examMarks}/${targetMarks}`)

  const options = optionCountFor(config)
  // The question is its own slot; its parts are counted, not compared as a list.
  const invalid = questions.filter(question => normalizeQuestion(question, { ...question, parts: question.parts?.length || undefined }, options).problems.length)
  add('validity', 'Unanswered / invalid questions', invalid.length ? 'fail' : 'ok', invalid.length ? `${invalid.length} question(s) need attention: ${invalid.map(question => `Q${questions.indexOf(question) + 1}`).join(', ')}` : 'None')

  const mcqs = questions.filter(question => question.type === 'mcq')
  const badMcq = mcqs.filter(question => question.options.length !== options || question.answerIndex < 0 || new Set(question.options.map(option => option.toLowerCase())).size !== question.options.length)
  if (mcqs.length) add('mcq', 'MCQ validity', badMcq.length ? 'fail' : 'ok', badMcq.length ? `${badMcq.length} MCQ(s) without ${options} distinct options and one answer` : `${mcqs.length} MCQs, each with one correct answer`)

  const pattern = answerPatternReport(questions)
  if (mcqs.length >= 4) {
    add('distribution', 'MCQ answer distribution', pattern.distribution.some(item => item.count === 0) && mcqs.length >= 8 ? 'warn' : 'ok', pattern.distribution.map(item => `${item.letter}:${item.count}`).join(' '))
    add('pattern', 'Answer-pattern risk', pattern.risk === 'high' ? 'fail' : pattern.risk === 'medium' ? 'warn' : 'ok', `${pattern.risk[0].toUpperCase()}${pattern.risk.slice(1)}${pattern.longestRun >= 3 ? ` — the same letter ${pattern.longestRun} times in a row` : ''}${pattern.cycles ? ' — an A-B-C-D run' : ''}`)
  }

  const duplicates: string[] = []
  for (let a = 0; a < questions.length; a += 1) {
    for (let b = a + 1; b < questions.length; b += 1) {
      if (similarity(questions[a].prompt, questions[b].prompt) >= 0.85 && words(questions[a].prompt).length >= 4) duplicates.push(`Q${a + 1} & Q${b + 1}`)
    }
  }
  add('duplicates', 'Duplicate questions', duplicates.length ? 'warn' : 'ok', duplicates.length ? duplicates.slice(0, 6).join(', ') : 'None')

  const bloom = bloomCoverage(questions, config.bloom)
  const drift = bloom.filter(row => Math.abs(row.coverage - row.target) > 12)
  add('bloom', 'Bloom coverage', drift.length > 1 ? 'warn' : 'ok', drift.length ? `Off target: ${drift.map(row => `${row.level} ${row.coverage}% (target ${row.target}%)`).join(', ')}` : 'Balanced')
  const higherMarks = questions.filter(question => HIGHER_ORDER.has(question.bloom)).reduce((sum, question) => sum + question.marks, 0)
  const higherOrderPercent = totalMarks ? Math.round((higherMarks / totalMarks) * 100) : 0
  const wantsHigher = ['hard', 'external'].includes(config.difficulty) || ['waec', 'neco', 'igcse', 'sat'].includes(config.standard)
  add('higher', 'Higher-order questions', wantsHigher && higherOrderPercent < 40 ? 'warn' : 'ok', `${higherOrderPercent}% of marks test Apply, Analyse, Evaluate or Create`)

  const topics = blueprint?.topics?.map(topic => topic.name) || config.topicNames
  const missing = topics.filter(topic => topic !== 'General' && !questions.some(question => question.topic.toLowerCase() === topic.toLowerCase()))
  if (topics.length) add('coverage', 'Topic coverage', missing.length ? 'warn' : 'ok', missing.length ? `Not tested: ${missing.join(', ')}` : `${topics.length - missing.length}/${topics.length} topics tested`)

  const noScheme = questions.filter(question => (question.type === 'mcq' || question.type === 'truefalse')
    ? question.answerIndex < 0
    : question.parts?.length ? question.parts.some(part => !part.answer && !part.markingPoints.length) : !question.answer && !question.markingPoints.length)
  add('scheme', 'Mark scheme', noScheme.length ? 'fail' : 'ok', noScheme.length ? `${noScheme.length} question(s) without an answer or marking points` : 'Complete')

  const depth = questions.filter(question => (question.type === 'essay' && question.marks < 4) || (OBJECTIVE_TYPES.has(question.type) && question.marks > 3))
  add('depth', 'Marks match response depth', depth.length ? 'warn' : 'ok', depth.length ? `${depth.length} question(s) look over- or under-marked` : 'Consistent')

  const commandWords = profile.commandWords.map(word => word.toLowerCase())
  const theory = questions.filter(question => !OBJECTIVE_TYPES.has(question.type))
  const noCommand = theory.filter(question => !commandWords.some(word => question.prompt.toLowerCase().replace(/^\(?[a-z0-9]+[).]\s*/, '').includes(word)))
  if (theory.length) add('command', 'Command words', noCommand.length > theory.length / 2 ? 'warn' : 'ok', noCommand.length ? `${noCommand.length} theory question(s) without a ${profile.label} command word` : 'Appropriate examination terminology')

  const withFigures = questions.filter(question => /```figure/.test([question.prompt, ...(question.parts || []).map(part => part.prompt)].join('\n')))
  const brokenFigures = withFigures.filter(question => figureProblems([question.prompt, ...(question.parts || []).map(part => part.prompt)].join('\n')).length)
  if (withFigures.length) add('figures', 'Diagrams, graphs and charts', brokenFigures.length ? 'fail' : 'ok', brokenFigures.length ? `${brokenFigures.length} figure(s) cannot be drawn: ${brokenFigures.map(question => `Q${questions.indexOf(question) + 1}`).join(', ')}` : `${withFigures.length} question(s) with a drawn figure`)

  return { checks, bloom, pattern, higherOrderPercent, totalMarks, examMarks }
}

// ─── Prompts and parsing ─────────────────────────────────────────────────────

const TYPE_INSTRUCTIONS: Record<QuestionType, string> = {
  mcq: '"options": exactly {N} plausible options (no letters in the text), "answerIndex": index of the single best answer (0-based), "explanation" in "markingPoints". Distractors must be plausible misconceptions, not silly or obviously wrong; avoid "all of the above".',
  truefalse: '"answer": "True" or "False", and one marking point explaining why.',
  fill: 'a sentence with a single gap shown as "_____", "expectedAnswer" and any "alternatives".',
  short: '"expectedAnswer", "markingPoints" (one per mark) and "alternatives".',
  structured: '"expectedAnswer" and "markingPoints" (one per mark).',
  essay: '"expectedAnswer" (an outline), "markingPoints", and "rubric": [{"criterion", "marks"}] adding up to the marks.',
  calculation: 'realistic values, "workingSteps" with every step of the solution, the final answer in "expectedAnswer", "markingPoints" (method and accuracy marks).',
  practical: 'a hands-on or data-collection task, "markingPoints" and a "rubric".',
}

const BLOOM_GUIDE: Record<Bloom, string> = {
  remember: 'recall a fact or term (state, list, define, identify)',
  understand: 'explain meaning in their own words (explain, describe, summarise)',
  apply: 'use knowledge in a new situation (calculate, demonstrate, solve, apply to a scenario)',
  analyse: 'examine relationships in unfamiliar data, a case or a source (analyse, compare, distinguish, interpret)',
  evaluate: 'make and justify a judgement (assess, justify, evaluate, recommend with reasons)',
  create: 'produce something new (design, propose, plan, develop)',
}

/** How the model draws: figure specs Ndovera renders exactly (see figureSpecError). */
export const FIGURE_GUIDE = [
  'DIAGRAMS, GRAPHS AND CHARTS: when a question needs one, put it inside its "prompt" (or a part\'s prompt) as a fenced block — three backticks, the word figure, a new line, the JSON, a new line, three backticks. Ndovera draws it exactly for screen and print. Never describe a diagram in words when you can draw it, and never use ASCII art. Use only these JSON shapes:',
  '- Function graph: {"type":"function","title":"","xLabel":"x","yLabel":"y","xRange":[-3,5],"yRange":[-5,10],"grid":true,"functions":[{"expr":"x^2-2*x-3","label":"y = x^2 - 2x - 3"}],"points":[{"x":3,"y":0,"label":"P"}]}. expr may use x, numbers, + - * / ^, brackets, sin cos tan sqrt abs log ln exp pi.',
  '- Bar, line or scatter chart: {"type":"bar","title":"","xLabel":"","yLabel":"","categories":["2022","2023","2024"],"series":[{"name":"Rice","values":[12,18,15]}]}. Line and scatter charts may use "points":[[x,y],...] instead of categories.',
  '- Pie chart: {"type":"pie","title":"","slices":[{"label":"Food","value":40},{"label":"Rent","value":25}]}.',
  '- Geometry: {"type":"geometry","points":{"A":[0,0],"B":[6,0],"C":[0,4],"O":[3,2]},"polygons":[["A","B","C"]],"segments":[["A","B","6 cm"]],"circles":[{"center":"O","radius":2}],"angles":[{"at":"A","from":"B","to":"C","right":true},{"at":"B","from":"C","to":"A","label":"θ"}]}. Coordinates are in units; label sides and angles the question refers to.',
  '- Electric circuit: {"type":"circuit","components":[{"type":"battery","label":"12 V"},{"type":"switch"},{"type":"ammeter"}],"parallel":[[{"type":"resistor","label":"4 Ω"}],[{"type":"resistor","label":"6 Ω"}]]}. Types: cell, battery, resistor, bulb, lamp, switch, ammeter, voltmeter, capacitor, diode, rheostat, fuse. "components" are in series round the loop; each list in "parallel" is one branch.',
  '- Number line: {"type":"numberline","min":-5,"max":5,"step":1,"points":[{"value":2,"label":"x","open":true}],"ranges":[{"from":-2,"to":3}]}.',
  'Put data tables in Markdown tables, not figures. Keep the JSON on a few lines and escape it properly inside the question string.',
].join('\n')

const FIGURE_SUBJECTS = /math|physics|chemistry|biology|geograph|economic|statistic|technical|technology|further|agric|basic science|science|engineering|account/i

export function buildGenerationPrompt(options: {
  config: AssessmentConfig, slots: Slot[], subjectName: string, className: string, context: string, existingPrompts: string[],
}) {
  const profile = ASSESSMENT_PROFILES[options.config.standard] || ASSESSMENT_PROFILES.school
  const system = [
    `You are an experienced ${profile.label} examiner and ${options.subjectName} teacher writing an assessment for ${options.className}.`,
    `Standard: ${profile.style}`,
    `Use these command words where they fit: ${profile.commandWords.join(', ')}.`,
    'Higher-order questions must not just turn a sentence from the notes into a question: use unfamiliar scenarios, data or tables to interpret, short case studies, calculations, comparisons and source-based tasks that make students transfer what they learnt.',
    'Write mathematics in LaTeX inside \\( \\) or $$ $$. Use Markdown tables for data: a blank line before the table, a header row, then a |---|---| line, one row per line (real line breaks, written as \\n in the JSON string), every row starting and ending with |. Language must suit the class level.',
    FIGURE_GUIDE,
    FIGURE_SUBJECTS.test(options.subjectName)
      ? `This is ${options.subjectName}: include figures wherever a real ${profile.label} paper would — graphs to draw or read, labelled diagrams, circuits, geometry, data charts and tables — so the paper is ready for a mock examination.`
      : 'Include a figure or table only where it genuinely helps the question.',
    'Reply with JSON only: an array of question objects, one per requested slot, in the same order. No commentary.',
  ].join('\n')
  const slotLines = options.slots.map((slot, index) => {
    const instruction = TYPE_INSTRUCTIONS[slot.type].replace('{N}', String(profile.mcqOptions))
    const parts = slot.parts
      ? ` It has parts (a)–(${'abcdefgh'[slot.parts - 1]}): give "prompt" as the shared stem (scenario, data or figure) and "parts": [{"prompt","marks","expectedAnswer","markingPoints"}] — exactly ${slot.parts} parts whose marks add up to ${slot.marks}, rising in demand from (a) to the last part.`
      : ''
    return `${index + 1}. type "${slot.type}", topic "${slot.topic}", ${slot.marks} mark(s), Bloom level "${slot.bloom}" — the student must ${BLOOM_GUIDE[slot.bloom]}.${parts} Include ${instruction}`
  })
  const user = [
    options.context ? `TEACHER'S NOTES AND TOPICS (base the questions on these; do not go beyond the topics listed):\n${options.context}` : `Topics: ${options.config.topicNames.join(', ') || 'the subject as taught this term'}.`,
    options.config.instructions ? `Teacher's instructions: ${options.config.instructions}` : '',
    options.existingPrompts.length ? `Do not repeat or closely paraphrase these existing questions:\n${options.existingPrompts.slice(-30).map(prompt => `- ${prompt.slice(0, 160)}`).join('\n')}` : '',
    `Write ${options.slots.length} question(s):\n${slotLines.join('\n')}`,
    'Each object: {"type", "prompt", "options"?, "answerIndex"?, "parts"?, "expectedAnswer"?, "markingPoints": [], "alternatives": [], "workingSteps": [], "rubric": [], "marks", "bloom", "topic", "commandWord", "difficulty"}.',
  ].filter(Boolean).join('\n\n')
  return { system, user }
}

/** Pull the JSON array out of a model reply, tolerating fences, prose and trailing commas. */
export function parseQuestionsJson(reply: string): any[] {
  const source = String(reply || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const attempts = [source]
  const start = source.indexOf('[')
  const end = source.lastIndexOf(']')
  if (start >= 0 && end > start) attempts.push(source.slice(start, end + 1))
  const objectStart = source.indexOf('{')
  const objectEnd = source.lastIndexOf('}')
  if (objectStart >= 0 && objectEnd > objectStart) attempts.push(`[${source.slice(objectStart, objectEnd + 1)}]`)
  for (const candidate of attempts) {
    for (const variant of [candidate, candidate.replace(/,\s*([\]}])/g, '$1')]) {
      try {
        const parsed = JSON.parse(variant)
        if (Array.isArray(parsed)) return parsed
        if (Array.isArray(parsed?.questions)) return parsed.questions
        if (parsed && typeof parsed === 'object') return [parsed]
      } catch { /* try the next shape */ }
    }
  }
  return []
}

export function buildReviewPrompt(questions: Question[], config: AssessmentConfig, subjectName: string, className: string) {
  const system = [
    `You are a senior ${subjectName} moderator checking a ${ASSESSMENT_PROFILES[config.standard]?.label || 'school'} assessment for ${className}.`,
    'For each question, check: is it within the topics, unambiguous with enough information, at the right level for the class, are MCQ distractors plausible, is exactly one option defensibly correct, are calculations and their answers internally consistent, does the mark scheme fit the question, is the language suitable.',
    'Do not rewrite questions. Reply with JSON only: [{"question": number, "issue": "short description", "severity": "warning" or "error"}]. Reply [] if everything is fine.',
  ].join('\n')
  const user = questions.map((question, index) => {
    const lines = [`Q${index + 1} (${question.type}, ${question.marks} marks, ${question.topic}): ${question.prompt}`]
    ;(question.parts || []).forEach(part => lines.push(`(${part.label}) ${part.prompt} [${part.marks}]${part.answer ? ` — expected: ${part.answer.slice(0, 200)}` : ''}`))
    if (question.options.length) lines.push(question.options.map((option, i) => `${letters(question.options.length)[i]}. ${option}${i === question.answerIndex ? ' [key]' : ''}`).join(' | '))
    if (question.answer) lines.push(`Expected: ${question.answer.slice(0, 400)}`)
    if (question.workingSteps.length) lines.push(`Working: ${question.workingSteps.join(' → ').slice(0, 400)}`)
    return lines.join('\n')
  }).join('\n\n')
  return { system, user }
}

// ─── Classroom delivery and paper text ───────────────────────────────────────

/** Convert to the classroom's question format (TeacherAssignmentsPanel / student view). */
export function toClassroomQuestions(questions: Question[]) {
  return questions.map(question => {
    const partsText = (question.parts || []).map(part => `(${part.label}) ${part.prompt} [${part.marks} mark${part.marks === 1 ? '' : 's'}]`).join('\n\n')
    const prompt = partsText ? `${question.prompt}\n\n${partsText}` : question.prompt
    const base = { id: question.id, prompt, score: question.marks, bloom: question.bloom, topic: question.topic, section: question.section, imageUrl: '', ...(question.compulsory ? { compulsory: true } : {}) }
    const partScheme = (question.parts || []).flatMap(part => [`(${part.label}) [${part.marks}] ${part.answer}`.trim(), ...part.markingPoints.map(point => `  • ${point}`)])
    const scheme = [question.answer, ...question.markingPoints.map(point => `• ${point}`), ...partScheme, ...question.workingSteps.map((step, index) => `${index + 1}. ${step}`), ...question.rubric.map(row => `${row.criterion} (${row.marks})`)].filter(Boolean).join('\n')
    switch (question.type) {
      case 'mcq':
      case 'truefalse':
        return { ...base, type: 'mcq', options: question.options, answer: question.options[question.answerIndex] || '', explanation: question.markingPoints.join(' ') }
      case 'fill':
        return { ...base, type: 'fillgaps', acceptedAnswers: [question.answer, ...question.alternatives].filter(Boolean).join(', ') }
      case 'short':
        return { ...base, type: 'shortanswer', answer: question.answer, markingGuide: scheme }
      case 'essay':
        return { ...base, type: 'essay', markingGuide: scheme }
      default:
        return { ...base, type: 'longanswer', markingGuide: scheme }
    }
  })
}

/** Plain text (Markdown + LaTeX) of the student paper, without answers. */
export function paperMarkdown(questions: Question[], blueprint: Blueprint | null, meta: { title: string, instructions?: string }) {
  const lines = [`# ${meta.title}`, '']
  if (meta.instructions) lines.push(meta.instructions, '')
  const sections = blueprint?.sections?.length ? blueprint.sections.map(section => section.name) : [...new Set(questions.map(question => question.section))]
  let number = 0
  for (const name of sections) {
    const inSection = questions.filter(question => question.section === name)
    if (!inSection.length) continue
    const section = blueprint?.sections.find(item => item.name === name)
    lines.push(`## SECTION ${name}`, section?.instructions ? `*${section.instructions}*` : '', '')
    for (const question of inSection) {
      number += 1
      lines.push(`**${number}.** ${question.compulsory ? '*(Compulsory)* ' : ''}${question.prompt}${question.parts?.length ? '' : ` **[${question.marks} mark${question.marks === 1 ? '' : 's'}]**`}`)
      ;(question.parts || []).forEach(part => lines.push('', `**(${part.label})** ${part.prompt} **[${part.marks}]**`))
      question.options.forEach((option, index) => lines.push(`    ${letters(question.options.length)[index]}. ${option}`))
      lines.push('')
    }
  }
  return lines.filter((line, index, all) => !(line === '' && all[index - 1] === '')).join('\n')
}

/** The teacher's marking scheme — never shown to students before release. */
export function markingSchemeMarkdown(questions: Question[], meta: { title: string }) {
  const lines = [`# Marking Scheme — ${meta.title}`, '']
  questions.forEach((question, index) => {
    lines.push(`**${index + 1}.** (${question.marks} mark${question.marks === 1 ? '' : 's'} · ${question.bloom} · ${question.topic || '—'})`)
    if (question.type === 'mcq' || question.type === 'truefalse') lines.push(`Answer: **${letters(question.options.length)[question.answerIndex] || '?'}** — ${question.options[question.answerIndex] || ''}`)
    if (question.answer) lines.push(`Expected answer: ${question.answer}`)
    question.markingPoints.forEach(point => lines.push(`- ${point}`))
    ;(question.parts || []).forEach(part => {
      lines.push(`**(${part.label})** [${part.marks}] ${part.answer}`)
      part.markingPoints.forEach(point => lines.push(`  - ${point}`))
    })
    if (question.alternatives.length) lines.push(`Also accept: ${question.alternatives.join('; ')}`)
    if (question.workingSteps.length) { lines.push('Working:'); question.workingSteps.forEach((step, i) => lines.push(`${i + 1}. ${step}`)) }
    if (question.rubric.length) { lines.push('', '| Criterion | Marks |', '|---|---|'); question.rubric.forEach(row => lines.push(`| ${row.criterion.replace(/\|/g, '/')} | ${row.marks} |`)) }
    lines.push('')
  })
  return lines.join('\n')
}

/** Mark the objective questions of a submission. Theory questions are left for the teacher. */
export function autoMark(questions: Array<Record<string, any>>, answers: Record<string, any>) {
  let score = 0
  let max = 0
  let pending = 0
  const perQuestion: Record<string, { correct: boolean | null, score: number }> = {}
  questions.forEach((question, index) => {
    const id = String(question.id || index)
    const given = String(answers?.[id] ?? answers?.[index] ?? '').trim().toLowerCase()
    const marks = Number(question.score) || 1
    if (question.type === 'mcq') {
      max += marks
      const correct = given !== '' && given === String(question.answer || '').trim().toLowerCase()
      perQuestion[id] = { correct, score: correct ? marks : 0 }
      if (correct) score += marks
    } else if (question.type === 'fillgaps') {
      max += marks
      const accepted = String(question.acceptedAnswers || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean)
      const correct = given !== '' && accepted.includes(given)
      perQuestion[id] = { correct, score: correct ? marks : 0 }
      if (correct) score += marks
    } else {
      pending += 1
      perQuestion[id] = { correct: null, score: 0 }
    }
  })
  return { score, max, pending, perQuestion }
}

/** The answer fields a student must never receive before the teacher releases them. */
export function stripAnswersForStudent(questions: unknown) {
  return (Array.isArray(questions) ? questions : []).map((question: any) => {
    if (!question || typeof question !== 'object') return question
    const { answer, acceptedAnswers, markingGuide, explanation, markingPoints, workingSteps, rubric, expectedAnswer, answerIndex, alternatives, ...rest } = question
    return rest
  })
}
