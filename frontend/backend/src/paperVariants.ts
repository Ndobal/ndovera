// Unique papers without AI.
//
// Every student (or printed version A, B, C…) gets the same questions, laid out
// differently and — where the teacher marks numbers as variable — with their own
// numbers. Everything comes from a seed, so the same student always gets the
// same paper back and the server can mark it with that student's own key.
//
// What changes:
//   • objective questions (MCQ, true/false, fill-in) swap places within their
//     section; theory questions keep their numbers, because instructions such
//     as "Question 1 is compulsory" refer to them;
//   • MCQ options are shuffled, except true/false and options that point at
//     other options ("All of the above", "A and B");
//   • numbers written as templates take a value per student:
//       {{d=100..300}}           a whole number from 100 to 300, shown here
//       {{m=0.5..4.5 step 0.5}}  steps of 0.5
//       {{d}}                    the same value again
//       {{= d/t}}                a worked value (2 decimal places at most)
//       {{= d/t :1}}             … to 1 decimal place
//     sin, cos and tan take degrees. The master paper uses the lowest values.

export type PaperRecord = {
  seed: string
  order: string[]
  options: Record<string, number[]>
  values: Record<string, Record<string, number>>
}

// ─── Randomness from a seed ──────────────────────────────────────────────────

export function hashSeed(seed: string) {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function rngFor(seed: string) {
  let state = hashSeed(seed) || 1
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled<T>(items: T[], random: () => number) {
  const out = [...items]
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[out[index], out[swap]] = [out[swap], out[index]]
  }
  return out
}

// ─── Expressions ─────────────────────────────────────────────────────────────

const DEG = Math.PI / 180
const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sqrt: Math.sqrt, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil,
  sin: x => Math.sin(x * DEG), cos: x => Math.cos(x * DEG), tan: x => Math.tan(x * DEG),
  asin: x => Math.asin(x) / DEG, acos: x => Math.acos(x) / DEG, atan: x => Math.atan(x) / DEG,
  log: Math.log10, ln: Math.log, exp: Math.exp, min: Math.min, max: Math.max,
}
const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E }

/** Evaluate an arithmetic expression over named values. Throws on anything else. */
export function evaluate(source: string, scope: Record<string, number>): number {
  const tokens = String(source).replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').match(/\d+\.?\d*(?:e[-+]?\d+)?|\.\d+|[a-zA-Z_][a-zA-Z_0-9]*|[-+*/^(),]|\S/g) || []
  let position = 0
  const peek = () => tokens[position]
  const take = () => tokens[position++]
  const expression = (): number => {
    let value = term()
    while (peek() === '+' || peek() === '-') value = take() === '+' ? value + term() : value - term()
    return value
  }
  const term = (): number => {
    let value = unary()
    for (;;) {
      if (peek() === '*' || peek() === '/') { value = take() === '*' ? value * unary() : value / unary(); continue }
      // Implicit multiplication: 2pi, 3(d+1), (a)(b)
      if (peek() === '(' || /^[a-zA-Z_]/.test(peek() || '')) { value *= unary(); continue }
      return value
    }
  }
  const unary = (): number => {
    if (peek() === '-') { take(); return -unary() }
    if (peek() === '+') { take(); return unary() }
    return power()
  }
  const power = (): number => {
    const base = atom()
    if (peek() === '^') { take(); return Math.pow(base, unary()) }
    return base
  }
  const atom = (): number => {
    const token = take()
    if (token === undefined) throw new Error('The expression ends too early.')
    if (token === '(') { const value = expression(); if (take() !== ')') throw new Error('A bracket is not closed.'); return value }
    if (/^[\d.]/.test(token)) return Number(token)
    if (/^[a-zA-Z_]/.test(token)) {
      if (Object.prototype.hasOwnProperty.call(scope, token)) return scope[token]
      const lower = token.toLowerCase()
      if (Object.prototype.hasOwnProperty.call(CONSTANTS, lower)) return CONSTANTS[lower]
      if (Object.prototype.hasOwnProperty.call(FUNCTIONS, lower)) {
        if (take() !== '(') throw new Error(`${token} needs brackets.`)
        const args = [expression()]
        while (peek() === ',') { take(); args.push(expression()) }
        if (take() !== ')') throw new Error('A bracket is not closed.')
        return FUNCTIONS[lower](...args)
      }
      throw new Error(`"${token}" is not defined.`)
    }
    throw new Error(`"${token}" is not allowed.`)
  }
  const value = expression()
  if (position < tokens.length) throw new Error(`"${tokens[position]}" is not expected here.`)
  return value
}

export function formatNumber(value: number, places?: number) {
  if (!Number.isFinite(value)) return '?'
  const digits = places === undefined ? 2 : Math.max(0, Math.min(6, places))
  const rounded = Number(value.toFixed(digits))
  return places === undefined ? String(rounded) : rounded.toFixed(digits)
}

// ─── Templates ───────────────────────────────────────────────────────────────

const TEMPLATE = /\{\{\s*([^{}]+?)\s*\}\}/g
const DEFINITION = /^([a-zA-Z_][a-zA-Z_0-9]*)\s*=\s*(-?\d*\.?\d+)\s*\.\.\s*(-?\d*\.?\d+)(?:\s+step\s+(\d*\.?\d+))?$/

type Definition = { name: string, min: number, max: number, step: number }

const SKIP_KEYS = new Set(['id', 'type', 'section', 'topic', 'bloom', 'difficulty', 'source', 'label', 'commandWord', 'imageUrl'])

/** Every string in a question, wherever it sits (prompt, options, parts, scheme…). */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach(item => strings(item, out))
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) if (!SKIP_KEYS.has(key)) strings(item, out)
  return out
}

function mapStrings<T>(value: T, map: (text: string) => string): T {
  if (typeof value === 'string') return map(value) as unknown as T
  if (Array.isArray(value)) return value.map(item => mapStrings(item, map)) as unknown as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SKIP_KEYS.has(key) ? item : mapStrings(item, map)])) as T
  }
  return value
}

export function definitionsIn(question: unknown): Definition[] {
  const found = new Map<string, Definition>()
  for (const text of strings(question)) {
    for (const match of text.matchAll(TEMPLATE)) {
      const definition = DEFINITION.exec(match[1])
      if (!definition) continue
      const [, name, low, high, step] = definition
      const min = Math.min(Number(low), Number(high))
      const max = Math.max(Number(low), Number(high))
      if (!found.has(name)) found.set(name, { name, min, max, step: Number(step) || (Number.isInteger(min) && Number.isInteger(max) ? 1 : 0.1) })
    }
  }
  return [...found.values()]
}

export function hasVariables(question: unknown) {
  return strings(question).some(text => /\{\{[^{}]+\}\}/.test(text))
}

/** Problems a teacher should fix: unknown names, broken expressions. */
export function templateProblems(question: unknown): string[] {
  const definitions = definitionsIn(question)
  const scope = Object.fromEntries(definitions.map(definition => [definition.name, definition.min]))
  const problems: string[] = []
  for (const text of strings(question)) {
    for (const match of text.matchAll(TEMPLATE)) {
      const body = match[1]
      if (DEFINITION.test(body)) continue
      try { evaluate(body.replace(/^=/, '').replace(/:\s*\d+\s*$/, ''), scope) } catch (error) { problems.push(`{{${body}}}: ${(error as Error).message}`) }
    }
  }
  return [...new Set(problems)]
}

function pick(definition: Definition, random: () => number) {
  const steps = Math.max(0, Math.floor((definition.max - definition.min) / definition.step + 1e-9))
  const value = definition.min + Math.floor(random() * (steps + 1)) * definition.step
  return Number(value.toFixed(6))
}

/** Values for a question's variables: the lowest for the master paper, otherwise drawn from the seed. */
export function drawValues(question: unknown, random?: () => number) {
  return Object.fromEntries(definitionsIn(question).map(definition => [definition.name, random ? pick(definition, random) : definition.min]))
}

/** Write the values into every string of a question. */
export function fillTemplates<T>(question: T, values: Record<string, number>): T {
  return mapStrings(question, text => text.replace(TEMPLATE, (whole, body: string) => {
    const definition = DEFINITION.exec(body)
    if (definition) return formatNumber(values[definition[1]] ?? Number(definition[2]))
    const places = /:\s*(\d+)\s*$/.exec(body)
    const expression = body.replace(/^=/, '').replace(/:\s*\d+\s*$/, '').trim()
    try { return formatNumber(evaluate(expression, values), places ? Number(places[1]) : undefined) } catch { return whole }
  }))
}

// ─── Personalising a paper ───────────────────────────────────────────────────

const POINTS_AT_OTHERS = /\b(all|none|both|neither) of the (above|options)\b|^\s*both\b|^\s*neither\b|\b[A-H]\s*(and|&|or)\s*[A-H]\b|^\s*[A-H]\s*,\s*[A-H]\b/i

type AnyQuestion = Record<string, any>

const isObjective = (question: AnyQuestion) => ['mcq', 'truefalse', 'fill', 'fillgaps'].includes(String(question.type))

function shufflableOptions(question: AnyQuestion) {
  const options = Array.isArray(question.options) ? question.options.map(String) : []
  if (options.length < 3) return false // true/false and two-option questions keep their order
  if (options.every(option => /^(true|false)$/i.test(option.trim()))) return false
  return !options.some(option => POINTS_AT_OTHERS.test(option))
}

/** The record of one student's (or one version's) paper: question order, option order, values. */
export function planPaper(questions: AnyQuestion[], seed: string, options: { shuffleQuestions?: boolean, shuffleOptions?: boolean } = {}): PaperRecord {
  const random = rngFor(seed)
  const record: PaperRecord = { seed, order: [], options: {}, values: {} }
  // Objective questions swap within their section; theory questions keep their place.
  const sections = [...new Set(questions.map(question => String(question.section || 'A')))]
  for (const section of sections) {
    const inSection = questions.filter(question => String(question.section || 'A') === section)
    const objective = inSection.filter(isObjective)
    const reordered = options.shuffleQuestions === false ? objective : shuffled(objective, random)
    let next = 0
    for (const question of inSection) record.order.push(String(isObjective(question) ? reordered[next++].id : question.id))
  }
  for (const question of questions) {
    const id = String(question.id)
    if (definitionsIn(question).length) {
      // Redraw a few times if two options would come out the same.
      let values = drawValues(question, random)
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const filled = fillTemplates(question, values)
        const shown = (filled.options || []).map((option: unknown) => String(option).trim())
        if (new Set(shown).size === shown.length) break
        values = drawValues(question, random)
      }
      record.values[id] = values
    }
    if (options.shuffleOptions !== false && shufflableOptions(question)) record.options[id] = shuffled(question.options.map((_: unknown, index: number) => index), random)
  }
  return record
}

/** Rebuild a paper from its record. Works for AI-assessment questions (answerIndex) and classroom questions (answer text). */
export function applyPaper<T extends AnyQuestion>(questions: T[], record: PaperRecord): T[] {
  const byId = new Map(questions.map(question => [String(question.id), question]))
  const ordered = [...record.order.map(id => byId.get(id)).filter(Boolean) as T[], ...questions.filter(question => !record.order.includes(String(question.id)))]
  return ordered.map(question => {
    const id = String(question.id)
    let next: AnyQuestion = record.values[id] ? fillTemplates(question, record.values[id]) : hasVariables(question) ? fillTemplates(question, drawValues(question)) : { ...question }
    const permutation = record.options[id]
    if (permutation && Array.isArray(next.options) && permutation.length === next.options.length) {
      const options = permutation.map(index => next.options[index])
      next = { ...next, options, ...(typeof next.answerIndex === 'number' && next.answerIndex >= 0 ? { answerIndex: permutation.indexOf(next.answerIndex) } : {}) }
    }
    return next as T
  })
}

/** The master paper: every variable at its lowest value, nothing reordered. */
export function masterQuestions<T extends AnyQuestion>(questions: T[]): T[] {
  return questions.map(question => (hasVariables(question) ? fillTemplates(question, drawValues(question)) : question))
}

export function personalise<T extends AnyQuestion>(questions: T[], seed: string) {
  const record = planPaper(questions, seed)
  return { record, questions: applyPaper(questions, record) }
}

/** Short code printed on a paper so its key can be found: e.g. "K7Q2". */
export function paperCode(seed: string) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let hash = hashSeed(seed)
  let code = ''
  for (let index = 0; index < 4; index += 1) { code += alphabet[hash % alphabet.length]; hash = Math.floor(hash / alphabet.length) }
  return code
}

/** Junior and senior secondary classes — they get unique exam papers by default. */
export function isSecondaryClass(name: string) {
  return /\b(j\.?s\.?s?|s\.?s\.?s?)[\s-]*[1-3]|\bbasic\s*[7-9]\b|\bgrade\s*([7-9]|1[0-2])\b|\byear\s*([7-9]|1[0-3])\b|\bform\s*[1-6]\b|\bsecondary\b|\bsenior\b|\bigcse\b|\ba[- ]?level\b/i.test(String(name || ''))
}
