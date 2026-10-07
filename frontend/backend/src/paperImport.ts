// Turning a teacher's own paper (typed, pasted, Word or PDF) into Ndovera
// questions: objective questions with options and an answer key, and a theory
// section with parts and marks, ready to print.
//
// Reads what teachers actually write:
//   SECTION A: OBJECTIVES  (Answer all questions)
//   1. Which of these is a vector?   A. mass  B. speed  C. velocity  D. time
//   2. The unit of force is
//      (a) joule  (b) newton*  (c) watt  (d) pascal          ← * marks the answer
//      Answer: B                                             ← or an answer line
//   SECTION B: THEORY  (Answer any three questions. Question 1 is compulsory.)
//   1. (a) Define work. [2 marks]
//      (b) A boy lifts a 5 kg box through 2 m. Find the work done. (4 marks)
//   ANSWER KEY   1. C  2. B  3. A …
//
// Whatever cannot be read safely is reported, never guessed: an MCQ without a
// key is kept with no answer, so the paper cannot be submitted until the
// teacher ticks the right option.

export type ImportedPart = { label: string, prompt: string, marks: number | null }
export type ImportedQuestion = {
  number: number, section: string, type: 'mcq' | 'truefalse' | 'fill' | 'short' | 'structured' | 'essay',
  prompt: string, options: string[], answerIndex: number, parts: ImportedPart[], marks: number | null, answer: string,
}
export type ImportedSection = { name: string, title: string, instructions: string, kind: 'objective' | 'theory' | 'unknown', attempt: number | null, compulsory: number[] }
export type ImportResult = { sections: ImportedSection[], questions: ImportedQuestion[], warnings: string[] }

const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 }
const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8 }

const SECTION_LINE = /^\s*(?:SECTION|PART)\s*[-:]?\s*([A-H]|[IVX]{1,4}|\d{1,2})\b[\s.:\-–—)]*(.*)$/i
const KEY_HEADING = /^\s*(?:answer\s*key|answers?|objective\s*answers?|marking\s*key|key\s*to\s*objectives?|key)\s*[:\-–]?\s*(.*)$/i
const QUESTION_LINE = /^\s*(?:Q(?:uestion)?\.?\s*)?(\d{1,3})\s*[.):]\s*(.*)$/i
const LETTERED_LINE = /^\s*\(?([A-Ea-e])\s*[.)]\s+(.*)$/
const ANSWER_LINE = /^\s*(?:ans(?:wer)?|correct\s*(?:answer|option)|key)\s*[:\-–]\s*\(?([A-Ea-e])\)?\b/i
const MARKS = /[[(]\s*(\d{1,3})\s*(?:marks?|mks?|pts?|points?)\s*[\])]|\[\s*(\d{1,2})\s*\]\s*$/i
const CORRECT_MARK = /\s*(?:\*+|\(\s*correct\s*\)|✓|✔)\s*$/i
const IMAGE = /!\[[^\]]*\]\([^)]*\)|\[(?:image|picture|diagram|figure)[^\]]*\]/i

function clean(line: string) {
  return line
    .replace(/ /g, ' ')
    .replace(/^\s*#{1,6}\s*/, '')            // markdown headings
    .replace(/\*\*([^*]+)\*\*/g, '$1')        // bold
    .replace(/__([^_]+)__/g, '$1')
    .replace(/^\s*[-•]\s+(?=\(?[A-Ea-e][.)]\s)/, '') // "- A. option"
    .replace(/\s+$/, '')
}

function sectionName(raw: string, index: number) {
  const value = raw.trim().toUpperCase()
  if (/^[A-H]$/.test(value)) return value
  const roman = ROMAN[value.toLowerCase()]
  const number = roman || Number(value)
  return Number.isInteger(number) && number >= 1 && number <= 8 ? 'ABCDEFGH'[number - 1] : 'ABCDEFGH'[Math.min(index, 7)]
}

function kindOf(text: string): ImportedSection['kind'] {
  if (/objective|multiple[\s-]*choice|\bobj\b|\bmcq/i.test(text)) return 'objective'
  if (/theory|essay|structured|subjective|short[\s-]*answer|\bcomprehension\b/i.test(text)) return 'theory'
  return 'unknown'
}

function attemptOf(text: string) {
  if (/answer\s+all\b/i.test(text)) return null
  const match = /answer\s+(?:any\s+)?(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b(?:\s+(?:other\s+)?questions?|\s+of|\s+only)?/i.exec(text)
  if (!match) return null
  return Number(match[1]) || WORD_NUMBERS[match[1].toLowerCase()] || null
}

function compulsoryOf(text: string) {
  const out: number[] = []
  for (const match of text.matchAll(/question\s+(\d{1,2})\s+is\s+compulsory|questions?\s+((?:\d{1,2}\s*(?:,|and)\s*)+\d{1,2})\s+are\s+compulsory/gi)) {
    for (const value of (match[1] || match[2] || '').split(/\s*(?:,|and)\s*/)) if (Number(value)) out.push(Number(value))
  }
  return [...new Set(out)]
}

function takeMarks(text: string) {
  const match = MARKS.exec(text)
  if (!match) return { text: text.trim(), marks: null as number | null }
  return { text: text.replace(MARKS, '').replace(/\s{2,}/g, ' ').trim(), marks: Number(match[1] || match[2]) }
}

/** "What is X? A. foo B. bar C. baz D. qux" → prompt + options, when at least three letters follow in order. */
function splitInline(line: string) {
  const marks = [...line.matchAll(/(?:^|\s)\(?([A-E])[.)]\s+/g)]
  const ordered = marks.filter((match, index) => match[1] === 'ABCDE'[index])
  if (ordered.length < 3 || ordered.length !== marks.length) return null
  const starts = ordered.map(match => (match.index ?? 0) + (match[0].startsWith(' ') ? 1 : 0))
  return {
    before: line.slice(0, starts[0]).trim(),
    options: ordered.map((match, index) => line.slice(starts[index] + match[0].trimStart().length, starts[index + 1] ?? line.length).trim()),
  }
}

type Draft = { number: number, section: string, lines: string[], items: Array<{ label: string, text: string }>, answer: string }

function finish(draft: Draft, section: ImportedSection | undefined, warnings: string[]): ImportedQuestion {
  const promptRaw = draft.lines.join('\n').trim()
  const { text: prompt, marks } = takeMarks(promptRaw)
  const items = draft.items.map(item => ({ ...item, text: item.text.trim() }))
  const uppercase = items.some(item => /[A-E]/.test(item.label))
  const looksLikeOptions = items.length >= 2
    && section?.kind !== 'theory'
    && items.every((item, index) => item.label.toLowerCase() === 'abcde'[index])
    && (uppercase || section?.kind === 'objective' || items.every(item => item.text.length <= 160 && !MARKS.test(item.text)))
  if (IMAGE.test(promptRaw) || items.some(item => IMAGE.test(item.text))) warnings.push(`Question ${draft.number} (Section ${draft.section}) had a picture. Add it again with the Graph / Diagram tool or as an image.`)

  if (looksLikeOptions) {
    let answerIndex = -1
    const options = items.map((item, index) => {
      if (CORRECT_MARK.test(item.text)) { answerIndex = index; return item.text.replace(CORRECT_MARK, '').trim() }
      return item.text
    })
    if (draft.answer) answerIndex = draft.answer.toUpperCase().charCodeAt(0) - 65
    const truefalse = options.length === 2 && options.every(option => /^(true|false)$/i.test(option))
    return { number: draft.number, section: draft.section, type: truefalse ? 'truefalse' : 'mcq', prompt, options, answerIndex: answerIndex >= 0 && answerIndex < options.length ? answerIndex : -1, parts: [], marks, answer: '' }
  }

  const parts = items.map(item => {
    const { text, marks: partMarks } = takeMarks(item.text)
    return { label: item.label.toLowerCase(), prompt: text, marks: partMarks }
  })
  const partTotal = parts.reduce((sum, part) => sum + (part.marks || 0), 0)
  const total = marks ?? (partTotal || null)
  let type: ImportedQuestion['type']
  if (parts.length) type = 'structured'
  else if (/_{3,}|\.{4,}|…{2,}/.test(prompt) && prompt.length < 300 && section?.kind !== 'theory') type = 'fill'
  else if ((total ?? 0) >= 8 || prompt.length > 260 || /\b(discuss|essay|write\s+(?:a|an)\s+(?:letter|composition|article|speech)|evaluate|critically)\b/i.test(prompt)) type = 'essay'
  else type = 'short'
  return { number: draft.number, section: draft.section, type, prompt: prompt.replace(/_{3,}/g, '________'), options: [], answerIndex: -1, parts, marks: total, answer: '' }
}

/** Read a paper written in plain text or Markdown. */
export function parsePaperText(source: string): ImportResult {
  const warnings: string[] = []
  const sections: ImportedSection[] = []
  const drafts: Array<{ draft: Draft, section?: ImportedSection }> = []
  const key = new Map<number, string>()
  let section: ImportedSection | undefined
  let draft: Draft | null = null
  let inKey = false

  const close = () => { if (draft) drafts.push({ draft, section }); draft = null }
  const readKey = (text: string) => {
    let found = 0
    for (const match of text.matchAll(/(\d{1,3})\s*[.):\-–]?\s*\(?([A-Ea-e])\)?(?=[\s,;.]|$)/g)) { key.set(Number(match[1]), match[2].toUpperCase()); found += 1 }
    return found
  }

  for (const rawLine of String(source || '').replace(/\r/g, '').split('\n')) {
    const line = clean(rawLine)
    if (!line.trim()) continue
    // Markdown table separators and tables stay with the question they belong to.
    const heading = SECTION_LINE.exec(line)
    if (heading && !/^\s*\d/.test(line)) {
      close(); inKey = false
      const rest = heading[2].trim()
      section = { name: sectionName(heading[1], sections.length), title: rest, instructions: '', kind: kindOf(rest), attempt: attemptOf(rest), compulsory: compulsoryOf(rest) }
      if (sections.some(existing => existing.name === section!.name)) section.name = 'ABCDEFGH'[Math.min(sections.length, 7)]
      sections.push(section)
      continue
    }
    const keyHeading = KEY_HEADING.exec(line)
    if (keyHeading && (readKey(keyHeading[1]) > 0 || !keyHeading[1].trim()) && !QUESTION_LINE.test(line)) { close(); inKey = true; continue }
    if (inKey) {
      if (readKey(line) > 0) continue
      inKey = false
    }

    const question = QUESTION_LINE.exec(line)
    const previous = draft as Draft | null
    const nextNumber = question ? Number(question[1]) : 0
    const startsQuestion = question && (!previous || nextNumber === previous.number + 1 || nextNumber === 1) && !/^\d+\.\d/.test(line.trim())
    if (startsQuestion) {
      close()
      // A question before any heading starts an implied first section.
      if (!section) { section = { name: 'A', title: '', instructions: '', kind: 'unknown', attempt: null, compulsory: [] }; sections.push(section) }
      draft = { number: nextNumber, section: section.name, lines: [], items: [], answer: '' }
      const inline = splitInline(question[2])
      if (inline) { draft.lines.push(inline.before); inline.options.forEach((text, index) => draft!.items.push({ label: 'ABCDE'[index], text })) }
      else {
        // "1. (a) Define work." — the first part starts on the question line.
        const firstPart = LETTERED_LINE.exec(question[2])
        if (firstPart && /^\(/.test(question[2].trim()) && firstPart[1] === 'a') draft.items.push({ label: 'a', text: firstPart[2] })
        else draft.lines.push(question[2])
      }
      continue
    }
    if (!draft) {
      // Text under a heading before its first question: the section's instructions.
      if (section && line.length < 400) {
        section.instructions = `${section.instructions} ${line.trim()}`.trim()
        if (section.kind === 'unknown') section.kind = kindOf(line)
        section.attempt = section.attempt ?? attemptOf(line)
        section.compulsory = [...new Set([...section.compulsory, ...compulsoryOf(line)])]
      }
      continue
    }
    const current: Draft = draft
    const answer = ANSWER_LINE.exec(line)
    if (answer) { current.answer = answer[1]; continue }
    const inline = current.items.length === 0 ? splitInline(line) : null
    if (inline && !inline.before) { inline.options.forEach((text, index) => current.items.push({ label: 'ABCDE'[index], text })); continue }
    const lettered = LETTERED_LINE.exec(line)
    const expected = current.items.length ? String.fromCharCode(current.items[current.items.length - 1].label.charCodeAt(0) + 1) : 'a'
    if (lettered && lettered[1].toLowerCase() === expected.toLowerCase()) { current.items.push({ label: lettered[1], text: lettered[2] }); continue }
    if (current.items.length) current.items[current.items.length - 1].text += `\n${line.trim()}`
    else current.lines.push(line)
  }
  close()

  // Sections whose kind was not written: the questions decide.
  const questions = drafts.map(({ draft: item, section: owner }) => finish(item, owner, warnings))
  for (const owner of sections) {
    const own = questions.filter(question => question.section === owner.name)
    if (owner.kind === 'unknown' && own.length) owner.kind = own.filter(question => question.options.length).length > own.length / 2 ? 'objective' : 'theory'
  }
  // With no headings at all, objective questions go to Section A and theory to Section B.
  if (sections.length === 1 && !sections[0].title && questions.some(question => question.options.length) && questions.some(question => !question.options.length)) {
    sections[0].kind = 'objective'
    sections.push({ name: 'B', title: '', instructions: '', kind: 'theory', attempt: null, compulsory: [] })
    for (const question of questions) if (!question.options.length) question.section = 'B'
  }

  // The answer key belongs to the objective questions, by their printed numbers.
  if (key.size) {
    const objective = questions.filter(question => question.options.length)
    for (const [number, letter] of key) {
      const target = objective.find(question => question.number === number && question.answerIndex < 0)
      const index = letter.charCodeAt(0) - 65
      if (target && index < target.options.length) target.answerIndex = index
    }
  }

  const unanswered = questions.filter(question => question.options.length && question.answerIndex < 0)
  if (unanswered.length) warnings.push(`${unanswered.length} objective question${unanswered.length === 1 ? ' has' : 's have'} no answer yet (${unanswered.slice(0, 12).map(question => `${question.section}${question.number}`).join(', ')}${unanswered.length > 12 ? '…' : ''}). Tick the correct option before submitting.`)
  const unmarked = questions.filter(question => !question.options.length && question.marks === null)
  if (unmarked.length) warnings.push(`${unmarked.length} theory question${unmarked.length === 1 ? ' had' : 's had'} no marks written; check the marks before submitting.`)
  return { sections, questions, warnings }
}

/** True when the reader found too little to trust — Ndovera AI is asked instead. */
export function needsAiHelp(result: ImportResult, source: string) {
  const words = String(source || '').split(/\s+/).filter(Boolean).length
  if (result.questions.length === 0) return words > 20
  // Long text but very few questions found: the layout was not understood.
  return result.questions.length < 3 && words > 150
}

// ─── From what was read to an Ndovera paper ──────────────────────────────────

const OBJECTIVE_TYPES = new Set(['mcq', 'truefalse', 'fill'])

function mostCommon(values: number[], fallback: number) {
  const counts = new Map<number, number>()
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? fallback
}

/** Questions and a paper structure in the shape the assessment engine takes. */
export function toAssessmentInput(result: ImportResult) {
  const questions = result.questions.map(question => {
    const objective = OBJECTIVE_TYPES.has(question.type)
    const partTotal = question.parts.reduce((sum, part) => sum + (part.marks || 0), 0)
    const marks = question.marks ?? (partTotal || (objective ? 1 : question.type === 'essay' ? 10 : question.parts.length ? question.parts.length * 3 : 4))
    // Parts without their own marks share the question's marks.
    const unmarked = question.parts.filter(part => part.marks === null).length
    const left = Math.max(0, marks - partTotal)
    const parts = question.parts.map(part => ({ prompt: part.prompt, marks: part.marks ?? Math.max(1, Math.round(left / Math.max(1, unmarked))), answer: '', markingPoints: [] }))
    return {
      section: question.section, type: question.type, prompt: question.prompt, options: question.options,
      answerIndex: question.answerIndex, marks, parts, bloom: objective ? 'understand' : 'apply', topic: '',
    }
  })
  const sections = result.sections
    .map(section => {
      const own = questions.filter(question => question.section === section.name)
      if (!own.length) return null
      const type = mostCommon(own.map(question => ['mcq', 'truefalse', 'fill', 'short', 'structured', 'essay', 'calculation', 'practical'].indexOf(question.type)), 0)
      const compulsory = section.compulsory.filter(number => number <= own.length)
      return {
        name: section.name, type: ['mcq', 'truefalse', 'fill', 'short', 'structured', 'essay', 'calculation', 'practical'][Math.max(0, type)],
        questions: own.length, attempt: Math.min(own.length, Math.max(compulsory.length, section.attempt ?? own.length)),
        marksPerQuestion: mostCommon(own.map(question => question.marks), 1), parts: 0, compulsory,
        instructions: section.instructions.slice(0, 400),
      }
    })
    .filter(Boolean)
  // Compulsory questions are marked on the question too.
  for (const section of result.sections) {
    const own = questions.filter(question => question.section === section.name)
    for (const number of section.compulsory) if (own[number - 1]) (own[number - 1] as any).compulsory = true
  }
  const mcqOptions = mostCommon(questions.filter(question => question.type === 'mcq').map(question => question.options.length), 4)
  return { questions, blueprint: { sections }, mcqOptions: Math.max(3, Math.min(5, mcqOptions)) }
}

// ─── When the layout is too unusual: Ndovera AI reads it ─────────────────────

export const AI_IMPORT_SYSTEM = [
  'You convert a school examination paper written by a teacher into JSON. Copy the questions exactly; never invent, correct or add questions.',
  'Return ONLY a JSON array. Each item: {"section":"A","type":"mcq|truefalse|fill|short|structured|essay","prompt":"","options":["",""],"answer":"B","marks":1,"parts":[{"prompt":"","marks":2}]}.',
  'Objective questions: "options" without their letters; "answer" is the letter given in the paper (from an answer key, an asterisk or an "Answer:" line) or "" when the paper does not give it — never guess.',
  'Theory questions: sub-questions (a), (b), (c) go in "parts" with their marks; "options" is []. Keep tables as Markdown tables and formulas as LaTeX \\( \\).',
  'Use the paper\'s section letters. If the paper has no sections, objective questions are section "A" and theory questions section "B".',
].join('\n')

/** Read the model's reply into the same shape as parsePaperText. */
export function importFromAiReply(reply: string, sectionsText = ''): ImportResult {
  const body = String(reply || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
  const start = body.indexOf('[')
  const end = body.lastIndexOf(']')
  let items: any[] = []
  try { items = start >= 0 && end > start ? JSON.parse(body.slice(start, end + 1)) : [] } catch { items = [] }
  const types = new Set(['mcq', 'truefalse', 'fill', 'short', 'structured', 'essay'])
  const counters = new Map<string, number>()
  const questions: ImportedQuestion[] = (Array.isArray(items) ? items : []).filter(item => item && String(item.prompt || '').trim()).slice(0, 150).map(item => {
    const section = /^[A-H]$/i.test(String(item.section || '').trim()) ? String(item.section).trim().toUpperCase() : 'A'
    const number = (counters.get(section) || 0) + 1
    counters.set(section, number)
    const options = (Array.isArray(item.options) ? item.options : []).map((option: unknown) => String(option || '').replace(/^\(?[A-Ea-e][.)]\s+/, '').trim()).filter(Boolean).slice(0, 5)
    const letter = String(item.answer || '').trim().toUpperCase()
    const answerIndex = /^[A-E]$/.test(letter) ? letter.charCodeAt(0) - 65 : -1
    const type = types.has(String(item.type)) ? item.type : options.length >= 2 ? 'mcq' : 'short'
    return {
      number, section, type, prompt: String(item.prompt).trim(), options: type === 'mcq' || type === 'truefalse' ? options : [],
      answerIndex: answerIndex < options.length ? answerIndex : -1,
      parts: (Array.isArray(item.parts) ? item.parts : []).slice(0, 8).map((part: any, index: number) => ({ label: 'abcdefgh'[index], prompt: String(part?.prompt || '').trim(), marks: Number(part?.marks) || null })).filter((part: ImportedPart) => part.prompt),
      marks: Number(item.marks) || null, answer: '',
    }
  })
  const names = [...new Set(questions.map(question => question.section))].sort()
  const headings = parsePaperText(sectionsText).sections
  const sections: ImportedSection[] = names.map(name => {
    const own = questions.filter(question => question.section === name)
    const heading = headings.find(item => item.name === name)
    return heading || { name, title: '', instructions: '', kind: own.some(question => question.options.length) ? 'objective' : 'theory', attempt: null, compulsory: [] }
  })
  const unanswered = questions.filter(question => question.options.length && question.answerIndex < 0).length
  return { sections, questions, warnings: unanswered ? [`${unanswered} objective question${unanswered === 1 ? ' has' : 's have'} no answer yet. Tick the correct option before submitting.`] : [] }
}
