// Quantitative Reasoning for Primary 1–6, written by rule — no AI, so every
// answer is computed and always right, and it costs nothing.
//
// Ported from the Ndovera Worksheet Studio engine (ndovera_worksheets/lib/engine.dart):
// picture counting, number patterns, missing numbers, number machines,
// equivalent fractions and 3-by-3 number grids, with difficulty rising by class.
//
// Used in two places:
//   • the AI assessment generator: for Quantitative Reasoning in a Primary class
//     the "model" is this engine (quantReasoningRunner), so quizzes, tests,
//     assignments and exams are written instantly, free, with verified keys;
//   • the practice bank: Ndovera's bank is filled with these questions for every
//     Primary level (seedQuantReasoningBank), so pupils can practise at once.

import type { AiRunner } from './aiAssessments'
import { levelOf, subjectKeyOf } from './levels'
import { GLOBAL_TENANT, upsertBankQuestions } from './practiceArena'
import type { BankInput } from './practiceArena'

export type QrTopic = 'counting' | 'sequence' | 'missingNumber' | 'numberMachine' | 'fractions' | 'grid'
export const QR_TOPIC_LABELS: Record<QrTopic, string> = {
  counting: 'Picture counting', sequence: 'Number patterns', missingNumber: 'Missing numbers',
  numberMachine: 'Number machines', fractions: 'Equivalent fractions', grid: 'Number grid puzzles',
}

export type QrQuestion = { topic: QrTopic, prompt: string, visual: string, answer: number, explanation: string, signature: string }

export function topicsForGrade(grade: number): QrTopic[] {
  return [
    ...(grade <= 3 ? ['counting' as const] : []),
    'sequence', 'missingNumber',
    ...(grade >= 2 ? ['numberMachine' as const] : []),
    ...(grade >= 4 ? ['fractions' as const] : []),
    ...(grade >= 3 ? ['grid' as const] : []),
  ]
}

/** Is this Quantitative Reasoning in a Primary class? Returns the class (1–6) or null. */
export function quantReasoningGrade(subjectName: unknown, className: unknown) {
  if (subjectKeyOf(subjectName) !== 'quantitative-reasoning') return null
  const level = levelOf(className)
  return level && level.section === 'primary' ? level.rank : null
}

/** A small seeded generator (mulberry32), so a seed always gives the same questions. */
export function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const cell = (value: string | number) => (String(value) === '?' ? '**?**' : String(value))

/** One question on a topic for a class. The visual is Markdown the app already draws (tables, LaTeX). */
export function qrQuestion(topic: QrTopic, grade: number, random: () => number): QrQuestion {
  const pick = (max: number) => 1 + Math.floor(random() * Math.max(1, max))
  const coin = () => random() < 0.5
  const make = (prompt: string, visual: string, answer: number, explanation: string, tokens: Array<string | number>) =>
    ({ topic, prompt, visual, answer, explanation, signature: `${topic}|${tokens.join(',')}` })
  switch (topic) {
    case 'counting': {
      const a = pick(grade === 1 ? 8 : 12)
      const b = pick(grade === 1 ? 8 : 12)
      const shape = coin() ? '🔵' : '🟦'
      return make('Count both groups. How many shapes are there altogether?', `${shape.repeat(a)} **+** ${shape.repeat(b)} **= ?**`, a + b,
        `Count ${a} shapes in the first group and ${b} in the second. ${a} + ${b} = ${a + b}.`, [shape, a, b])
    }
    case 'sequence': {
      const start = pick(grade <= 2 ? 25 : 100)
      const step = pick(grade <= 2 ? 3 : grade * 3)
      const subtract = grade >= 3 && coin()
      const first = subtract ? start + step * 4 : start
      const delta = subtract ? -step : step
      const missing = 1 + Math.floor(random() * 4)
      const values = Array.from({ length: 5 }, (_, index) => first + delta * index)
      const shown = values.map((value, index) => (index === missing ? '?' : value))
      return make('Complete the number pattern.', `| ${shown.map(cell).join(' | ')} |\n|${' --- |'.repeat(5)}`, values[missing],
        `${subtract ? 'Subtract' : 'Add'} ${step} each time. The missing number is ${values[missing]}.`, shown)
    }
    case 'missingNumber': {
      const a = pick(grade <= 2 ? 20 : grade * 35)
      const b = pick(grade <= 2 ? 15 : grade * 20)
      const multiply = grade >= 3 && coin()
      const missingLeft = coin()
      const result = multiply ? a * b : a + b
      const tokens = [missingLeft ? '?' : a, multiply ? '×' : '+', missingLeft ? b : '?', '=', result]
      return make('Find the missing number.', `**${tokens.map(cell).join(' ')}**`, missingLeft ? a : b,
        multiply ? `Divide ${result} by ${missingLeft ? b : a} to get ${missingLeft ? a : b}.` : `Subtract ${missingLeft ? b : a} from ${result} to get ${missingLeft ? a : b}.`, tokens)
    }
    case 'numberMachine': {
      const input = pick(grade * 12)
      const factor = pick(grade <= 2 ? 3 : 9)
      const offset = pick(grade * 4)
      const multiply = grade >= 3
      const output = multiply ? input * factor + offset : input + offset
      const steps = multiply ? [`× ${factor}`, `+ ${offset}`] : [`+ ${offset}`]
      return make('Follow the number machine from left to right. What comes out?', `**${input}** → ${steps.map(step => `[ ${step} ]`).join(' → ')} → **?**`, output,
        multiply ? `${input} × ${factor} = ${input * factor}; ${input * factor} + ${offset} = ${output}.` : `${input} + ${offset} = ${output}.`, [input, ...steps])
    }
    case 'fractions': {
      const denominator = 2 + Math.floor(random() * grade * 2)
      const numerator = pick(denominator - 1)
      const factor = 2 + Math.floor(random() * grade)
      return make('Make the fractions equivalent. Find the missing numerator.', `$$\\frac{${numerator}}{${denominator}} = \\frac{?}{${denominator * factor}}$$`, numerator * factor,
        `The denominator is multiplied by ${factor}. Multiply the numerator by ${factor} too: ${numerator} × ${factor} = ${numerator * factor}.`, [numerator, denominator, factor])
    }
    case 'grid':
    default: {
      const rowStep = pick(grade * 5)
      const colStep = pick(grade * 3)
      const start = pick(grade * 15)
      const hole = Math.floor(random() * 9)
      const values = Array.from({ length: 9 }, (_, index) => start + Math.floor(index / 3) * rowStep + (index % 3) * colStep)
      const shown = values.map((value, index) => (index === hole ? '?' : value))
      const rows = [0, 1, 2].map(row => `| ${shown.slice(row * 3, row * 3 + 3).map(cell).join(' | ')} |`)
      return make('Complete the grid. Each row and each column follows a pattern.', `| | | |\n| --- | --- | --- |\n${rows.join('\n')}`, values[hole],
        `Add ${colStep} moving right and ${rowStep} moving down. The missing number is ${values[hole]}.`, shown)
    }
  }
}

/** Wrong answers that look right: near misses and the usual slips. */
export function qrDistractors(question: QrQuestion, count: number, random: () => number) {
  const answer = question.answer
  const pool = new Set<number>()
  for (const delta of [1, -1, 2, -2, 10, -10, 5, -5, 3, -3]) pool.add(answer + delta)
  if (answer > 3) pool.add(Math.round(answer / 2))
  pool.add(answer * 2)
  const candidates = Array.from(pool).filter(value => value > 0 && value !== answer)
  const chosen: number[] = []
  while (chosen.length < count && candidates.length) chosen.push(candidates.splice(Math.floor(random() * candidates.length), 1)[0])
  return chosen
}

const promptOf = (question: QrQuestion) => `${question.prompt}\n\n${question.visual}`

/** Map a teacher's topic name to an engine topic (or pick one the class can do). */
export function qrTopicFor(name: string, grade: number, index: number): QrTopic {
  const allowed = topicsForGrade(grade)
  const text = String(name || '').toLowerCase()
  const wanted: QrTopic | null = /count|picture|shape/.test(text) ? 'counting' : /pattern|sequence|series/.test(text) ? 'sequence'
    : /missing|equation|box/.test(text) ? 'missingNumber' : /machine|function|operation/.test(text) ? 'numberMachine'
      : /fraction/.test(text) ? 'fractions' : /grid|puzzle|square|matrix/.test(text) ? 'grid' : null
  return wanted && allowed.includes(wanted) ? wanted : allowed[index % allowed.length]
}

/** One question in the shape the assessment engine takes, for a slot type. */
function asAssessmentQuestion(type: string, topicName: string, grade: number, optionCount: number, parts: number, random: () => number, seen: Set<string>, index: number) {
  const fresh = (offset: number) => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const question = qrQuestion(qrTopicFor(topicName, grade, index + offset + attempt), grade, random)
      if (!seen.has(question.signature)) { seen.add(question.signature); return question }
    }
    return qrQuestion(qrTopicFor(topicName, grade, index + offset), grade, random)
  }
  const question = fresh(0)
  const label = QR_TOPIC_LABELS[question.topic]
  if (type === 'mcq') {
    const options = [question.answer, ...qrDistractors(question, optionCount - 1, random)].map(String)
    return { type, topic: label, prompt: promptOf(question), options, answerIndex: 0, expectedAnswer: String(question.answer), workingSteps: [question.explanation], markingPoints: [question.explanation], difficulty: 'standard' }
  }
  if (type === 'truefalse') {
    const honest = random() < 0.5
    const shown = honest ? question.answer : qrDistractors(question, 1, random)[0]
    return { type, topic: label, prompt: `${promptOf(question)}\n\nTrue or false: the missing number is **${shown}**.`, options: ['True', 'False'], answerIndex: honest ? 0 : 1, expectedAnswer: honest ? 'True' : 'False', workingSteps: [question.explanation], markingPoints: [question.explanation] }
  }
  if (parts > 0) {
    const items = [question, ...Array.from({ length: parts - 1 }, (_, offset) => fresh(offset + 1))]
    return {
      type, topic: label, prompt: 'Answer each part. Show your working.',
      parts: items.map(item => ({ prompt: promptOf(item), marks: 1, expectedAnswer: String(item.answer), markingPoints: [item.explanation] })),
      markingPoints: items.map(item => item.explanation),
    }
  }
  return { type, topic: label, prompt: promptOf(question), expectedAnswer: String(question.answer), alternatives: [String(question.answer)], workingSteps: [question.explanation], markingPoints: [`${question.answer}`, question.explanation] }
}

/**
 * An AiRunner that answers the assessment engine's request from this engine:
 * it reads the requested slots (type, topic, parts, options) and returns them
 * as JSON, exactly as a model would — so everything downstream (checks,
 * balanced answer keys, versions, printing, exams) works unchanged.
 */
export function quantReasoningRunner(grade: number): AiRunner {
  return async (messages) => {
    const random = seededRandom((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0)
    const seen = new Set<string>()
    const items = requestedSlots(messages).map((slot, index) => asAssessmentQuestion(slot.type, slot.topic, grade, slot.optionCount, slot.parts, random, seen, index))
    return JSON.stringify(items)
  }
}

/** The slots the assessment engine asked for (type, topic, parts, options), read from its prompt. */
export function requestedSlots(messages: Array<{ content?: unknown }>) {
  const user = String(messages[messages.length - 1]?.content || '')
  return [...user.matchAll(/^\d+\. type "(\w+)", topic "([^"]*)", (\d+) mark[^\n]*/gm)].map(([line, type, topic]) => ({
    type, topic,
    parts: Number(line.match(/exactly (\d+) parts/)?.[1] || 0),
    optionCount: Number(line.match(/exactly (\d+) options/)?.[1] || line.match(/(\d+) options/)?.[1] || 4),
  }))
}

/** Questions for Ndovera's practice bank: a level's worth, per topic. */
export function qrBankQuestions(grade: number, perTopic = 30, seed = 2026): BankInput[] {
  const random = seededRandom(seed * 31 + grade)
  const seen = new Set<string>()
  const out: BankInput[] = []
  for (const topic of topicsForGrade(grade)) {
    let made = 0
    for (let attempt = 0; made < perTopic && attempt < perTopic * 20; attempt += 1) {
      const question = qrQuestion(topic, grade, random)
      if (seen.has(question.signature)) continue
      seen.add(question.signature)
      made += 1
      // Every third question is multiple choice; the rest are typed answers.
      const choice = made % 3 === 0
      out.push({
        tenantId: GLOBAL_TENANT, type: choice ? 'mcq' : 'shortanswer', prompt: promptOf(question),
        options: choice ? [question.answer, ...qrDistractors(question, 3, random)].map(String).sort(() => random() - 0.5) : [],
        answer: choice ? String(question.answer) : [String(question.answer)], explanation: question.explanation,
        subject: 'Quantitative Reasoning', section: 'primary', rank: grade, topic: QR_TOPIC_LABELS[topic],
        originType: 'ndovera_qr_engine', originId: `qr:${grade}:${topic}`, answerSource: 'engine',
      })
    }
  }
  return out
}

/** Fill Ndovera's bank one class a run (the cron's small budget), once per version of the engine. */
export async function seedQuantReasoningBank(db: D1Database, getState: (key: string) => Promise<string>, setState: (key: string, value: string) => Promise<void>) {
  const key = 'qr-seed:v1'
  const done = Number(await getState(key) || 0)
  if (done >= 6) return 0
  const grade = done + 1
  const result = await upsertBankQuestions(db, qrBankQuestions(grade))
  await setState(key, String(grade))
  return result.added
}
