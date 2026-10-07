// Ndovera AI — Prepare Material.
//
// The teacher says what they want to teach; Ndovera works out what the learner
// needs to know from the school's curriculum and the chosen examination
// specifications (curriculumLibrary.ts), then writes the material section by
// section as structured blocks — never one long Markdown string:
//
//   heading, paragraph, definition, list, formula (LaTeX), worked example,
//   table (columns + rows), graph (a figure spec Ndovera draws), image (an
//   illustration Ndovera AI draws, within the school's limit), exam tip,
//   common mistake, note, summary, practice question, flashcard, activity.
//
// Every block is checked as it arrives (tables are rectangular, graphs can be
// drawn, multiple-choice answers are one of the options, formulae balance), a
// validator reports curriculum coverage, level and examination claims, and
// the teacher previews, edits and publishes. The AI drafts; the teacher is the
// publisher.

import { figureSpecError, FIGURE_GUIDE } from './assessmentEngine'
import type { CurriculumTopic, ExamSpec, SpecTopic, ClassLevel } from './curriculumLibrary'
import { tokens } from './curriculumLibrary'

export class MaterialAiError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export type Actor = { id: string, name: string, role: string }
export type AiRunner = (messages: Array<{ role: string, content: string }>, options: { maxTokens: number, temperature: number }) => Promise<string>

const now = () => new Date().toISOString()
const clip = (value: unknown, max = 4000) => String(value ?? '').trim().slice(0, max)
const json = <T,>(value: unknown, fallback: T): T => { if (value && typeof value === 'object') return value as T; try { return value ? JSON.parse(String(value)) as T : fallback } catch { return fallback } }

// ─── What the teacher can ask for ────────────────────────────────────────────

export const MATERIAL_KINDS = [
  { key: 'lesson_note', label: 'Lesson Note' },
  { key: 'study_note', label: 'Student Study Note' },
  { key: 'revision', label: 'Revision Material' },
  { key: 'exam_prep', label: 'Examination Preparation' },
  { key: 'worksheet', label: 'Worksheet' },
  { key: 'practice_questions', label: 'Practice Questions' },
  { key: 'mock_exam', label: 'Mock Examination' },
  { key: 'topic_summary', label: 'Topic Summary' },
  { key: 'teacher_guide', label: 'Teacher Guide' },
  { key: 'flashcards', label: 'Flashcards' },
  { key: 'worked_examples', label: 'Worked Examples' },
  { key: 'practical_guide', label: 'Practical / Lab Guide' },
] as const
export type MaterialKind = typeof MATERIAL_KINDS[number]['key']

export const LENGTHS = { short: 'Short', detailed: 'Detailed', comprehensive: 'Comprehensive' } as const
export type Length = keyof typeof LENGTHS

export const CONTENT_OPTIONS = {
  content: [['explanation', 'Explanation'], ['definitions', 'Definitions'], ['key_concepts', 'Key concepts'], ['worked_examples', 'Worked examples'], ['real_life', 'Real-life examples'], ['common_mistakes', 'Common mistakes'], ['exam_tips', 'Examination tips'], ['summary', 'Summary']],
  visuals: [['images', 'Images / illustrations'], ['diagrams', 'Diagrams'], ['tables', 'Tables'], ['graphs', 'Graphs'], ['charts', 'Charts'], ['formulae', 'Formulae / equations']],
  assessment: [['practice', 'Practice questions'], ['objective', 'Objective questions'], ['theory', 'Theory questions'], ['structured', 'Structured questions'], ['past_style', 'Past-question-style practice'], ['answers', 'Answers'], ['solutions', 'Detailed solutions'], ['marking_guide', 'Marking guide']],
} as const
const ALL_OPTION_KEYS = Object.values(CONTENT_OPTIONS).flat().map(([key]) => key as string)

/** Sensible switches for each kind of material; Advanced Settings override them. */
const KIND_DEFAULTS: Record<MaterialKind, string[]> = {
  lesson_note: ['explanation', 'definitions', 'key_concepts', 'worked_examples', 'real_life', 'summary', 'diagrams', 'tables', 'formulae', 'practice', 'answers'],
  study_note: ['explanation', 'definitions', 'key_concepts', 'worked_examples', 'real_life', 'common_mistakes', 'exam_tips', 'summary', 'diagrams', 'tables', 'graphs', 'formulae', 'practice', 'objective', 'theory', 'answers'],
  revision: ['key_concepts', 'definitions', 'worked_examples', 'common_mistakes', 'exam_tips', 'summary', 'tables', 'formulae', 'practice', 'objective', 'theory', 'answers'],
  exam_prep: ['key_concepts', 'worked_examples', 'common_mistakes', 'exam_tips', 'summary', 'tables', 'graphs', 'formulae', 'practice', 'objective', 'theory', 'structured', 'past_style', 'answers', 'solutions', 'marking_guide'],
  worksheet: ['practice', 'objective', 'theory', 'structured', 'tables', 'graphs', 'formulae', 'answers'],
  practice_questions: ['practice', 'objective', 'theory', 'structured', 'formulae', 'tables', 'graphs', 'answers', 'solutions'],
  mock_exam: ['objective', 'theory', 'structured', 'past_style', 'tables', 'graphs', 'formulae', 'answers', 'solutions', 'marking_guide'],
  topic_summary: ['key_concepts', 'definitions', 'summary', 'tables', 'formulae'],
  teacher_guide: ['explanation', 'key_concepts', 'worked_examples', 'real_life', 'common_mistakes', 'summary', 'diagrams', 'tables', 'formulae', 'practice', 'answers', 'marking_guide'],
  flashcards: ['definitions', 'key_concepts', 'formulae'],
  worked_examples: ['worked_examples', 'common_mistakes', 'formulae', 'tables', 'graphs', 'solutions'],
  practical_guide: ['explanation', 'key_concepts', 'common_mistakes', 'diagrams', 'tables', 'graphs', 'summary', 'practice', 'answers'],
}

export function defaultOptionsFor(kind: MaterialKind) {
  return KIND_DEFAULTS[kind] || KIND_DEFAULTS.study_note
}

// ─── The plan: which sections, in which order ───────────────────────────────

export type Section = { key: string, title: string, focus: string, blocks: string[], status: 'pending' | 'done' | 'failed', note?: string }

type PlanInput = { kind: MaterialKind, length: Length, options: string[], hasExams: boolean, subtopics: string[], progressiveLevels: string[] }

const has = (options: string[], ...keys: string[]) => keys.some(key => options.includes(key))

export function planSections(input: PlanInput): Section[] {
  const o = input.options
  const sections: Array<Omit<Section, 'status'>> = []
  const add = (key: string, title: string, focus: string, blocks: string[]) => sections.push({ key, title, focus, blocks })
  const teaching = ['heading', 'paragraph', 'definition', 'list', 'formula', 'worked_example', 'table', 'graph', 'image', 'note']
  const questionCount = { short: 5, detailed: 8, comprehensive: 12 }[input.length]
  const parts = input.length === 'short' ? 1 : Math.min(input.length === 'comprehensive' ? 4 : 3, Math.max(1, input.subtopics.length))

  const coreTeaching = () => {
    if (input.progressiveLevels.length > 1) {
      input.progressiveLevels.forEach((label, index) => add(`core_${index + 1}`, `At ${label}`, `Teach the topic as expected at ${label}, building on the level before.`, teaching))
      return
    }
    if (parts <= 1 || !input.subtopics.length) { add('core', 'Core Teaching', 'Concepts, explanations, definitions, formulae, diagrams and worked examples.', teaching); return }
    const groups: string[][] = Array.from({ length: parts }, () => [])
    input.subtopics.forEach((subtopic, index) => groups[index % parts].push(subtopic))
    groups.forEach((group, index) => add(`core_${index + 1}`, group.join(' · '), `Teach: ${group.join('; ')}.`, teaching))
  }
  const practice = (title = 'Progressive Practice') => add('practice', title, `${questionCount} questions from easy to intermediate, examination standard and challenging.`, ['question'])
  const assessment = () => {
    const styles = [has(o, 'objective') && 'objective', has(o, 'theory') && 'theory', has(o, 'structured') && 'structured'].filter(Boolean)
    if (styles.length) add('assessment', 'Assessment', `${questionCount} ${styles.join(', ')} questions${input.hasExams ? ' in the style of the chosen examinations' : ''}.`, ['question'])
  }
  const answers = () => { if (has(o, 'answers', 'solutions', 'marking_guide')) add('solutions', has(o, 'marking_guide') ? 'Solutions and Marking Guide' : 'Answers and Solutions', 'Answers to every question above, with working where asked and a marking guide where asked.', ['worked_example', 'list', 'table', 'paragraph']) }

  switch (input.kind) {
    case 'flashcards':
      add('flashcards', 'Flashcards', `${{ short: 10, detailed: 16, comprehensive: 24 }[input.length]} flashcards: a term, formula or question on the front and the answer on the back.`, ['flashcard'])
      break
    case 'worksheet':
    case 'practice_questions':
      add('instructions', 'Instructions', 'Short instructions for the student.', ['paragraph', 'list'])
      practice(input.kind === 'worksheet' ? 'Worksheet' : 'Practice Questions')
      assessment()
      answers()
      break
    case 'mock_exam':
      add('instructions', 'Instructions to Candidates', 'Time allowed, sections, how to answer, calculator rules — from the specification when given.', ['paragraph', 'list'])
      if (has(o, 'objective')) add('section_a', 'Section A — Objective Questions', `${questionCount + 4} objective questions.`, ['question'])
      if (has(o, 'theory', 'structured')) add('section_b', 'Section B — Theory / Structured Questions', `${Math.max(3, Math.round(questionCount / 2))} theory or structured questions with marks.`, ['question'])
      answers()
      break
    case 'worked_examples':
      add('overview', 'What You Need', 'The key ideas and formulae used in the examples.', ['paragraph', 'formula', 'list'])
      add('examples', 'Worked Examples', `${questionCount} worked examples from easy to examination standard, every step shown.`, ['worked_example', 'graph', 'table', 'note'])
      if (has(o, 'common_mistakes')) add('mistakes', 'Common Errors', 'Typical mistakes students make in these examples and how to avoid them.', ['common_mistake'])
      break
    case 'topic_summary':
      add('summary', 'Topic Summary', 'The essential points, definitions and formulae on one page.', ['heading', 'list', 'definition', 'formula', 'table', 'summary'])
      break
    case 'practical_guide':
      add('aim', 'Aim, Apparatus and Safety', 'Aim, apparatus/materials, and safety precautions.', ['paragraph', 'list', 'note'])
      add('procedure', 'Procedure', 'Numbered steps, with what to observe.', ['activity', 'list', 'image', 'note'])
      add('results', 'Results and Analysis', 'A results table to fill in, how to analyse it, and a graph if appropriate.', ['table', 'graph', 'paragraph', 'formula'])
      add('conclusion', 'Conclusion and Sources of Error', 'Expected conclusion, sources of error and precautions.', ['paragraph', 'list', 'common_mistake'])
      if (has(o, 'practice')) practice('Questions on the Practical')
      answers()
      break
    default: {
      // Notes, revision, exam preparation, teacher guides.
      add('coverage', 'Curriculum Coverage', 'What students are expected to understand — from the curriculum objectives.', ['list', 'paragraph'])
      if (input.kind !== 'revision') add('prerequisites', 'Prerequisite Knowledge', 'What students should already know before this topic.', ['list', 'paragraph'])
      if (input.kind === 'teacher_guide') add('plan', 'Lesson Plan', 'Lesson objectives, timing, teaching steps, activities, resources and checks for understanding.', ['list', 'table', 'paragraph', 'activity'])
      coreTeaching()
      if (has(o, 'real_life')) add('real_life', 'Real-Life Applications', 'Where students meet this topic in everyday life, especially in their own context.', ['paragraph', 'list', 'image'])
      if (input.hasExams || has(o, 'exam_tips')) add('exam_focus', 'Exam Focus', input.hasExams ? 'Skills and forms of application the chosen examination specifications test, and how questions are set.' : 'How this topic is usually examined and how to score full marks.', ['exam_tip', 'list', 'paragraph'])
      if (has(o, 'common_mistakes')) add('mistakes', 'Common Errors', 'Typical conceptual and procedural mistakes, and how to avoid them.', ['common_mistake'])
      if (has(o, 'practice')) practice()
      if (input.kind === 'exam_prep' || input.kind === 'revision' || input.kind === 'study_note') assessment()
      answers()
      if (has(o, 'summary')) add('summary', 'Summary', 'The key points to remember.', ['summary'])
    }
  }
  return sections.map(section => ({ ...section, status: 'pending' as const }))
}

// ─── Blocks ──────────────────────────────────────────────────────────────────

export const AI_BLOCK_TYPES = ['heading', 'paragraph', 'definition', 'list', 'formula', 'worked_example', 'table', 'graph', 'image', 'exam_tip', 'common_mistake', 'note', 'summary', 'question', 'flashcard', 'activity'] as const
export type AiBlock = Record<string, any> & { type: typeof AI_BLOCK_TYPES[number], section: string }

const LEVELS = ['easy', 'intermediate', 'exam', 'challenging']
const STYLES = ['objective', 'theory', 'structured', 'short']

function balanced(latex: string) {
  let depth = 0
  for (const ch of latex) { if (ch === '{') depth += 1; else if (ch === '}') { depth -= 1; if (depth < 0) return false } }
  return depth === 0
}

/** A block as the model wrote it → a clean block, or the reason it is unusable. */
export function normalizeBlock(raw: any, section: string, allowed: { formulae: boolean, tables: boolean, graphs: boolean, images: boolean }): { block: AiBlock | null, problem: string } {
  if (!raw || typeof raw !== 'object') return { block: null, problem: 'not an object' }
  const type = String(raw.type || '').toLowerCase().replace(/[\s-]+/g, '_')
  const base = { section }
  switch (type) {
    case 'heading': case 'paragraph': case 'note': case 'exam_tip': case 'common_mistake': {
      const text = clip(raw.text ?? raw.content, 6000)
      if (!text) return { block: null, problem: `${type} is empty` }
      return { block: { ...base, type, text }, problem: '' }
    }
    case 'definition': {
      const term = clip(raw.term, 200)
      const text = clip(raw.text ?? raw.definition ?? raw.content, 3000)
      if (!text) return { block: null, problem: 'definition is empty' }
      return { block: { ...base, type, term, text }, problem: '' }
    }
    case 'list': case 'summary': case 'activity': {
      const items = (Array.isArray(raw.items) ? raw.items : []).map((item: unknown) => clip(item, 2000)).filter(Boolean).slice(0, 40)
      const text = clip(raw.text ?? raw.title, 600)
      if (!items.length && !text) return { block: null, problem: `${type} is empty` }
      return { block: { ...base, type, text, items, ordered: Boolean(raw.ordered) || type === 'activity' }, problem: '' }
    }
    case 'formula': {
      if (!allowed.formulae) return { block: null, problem: 'formulae are switched off' }
      const latex = clip(raw.latex ?? raw.content, 1000).replace(/^\$+|\$+$/g, '').replace(/^\\\[|\\\]$/g, '').trim()
      if (!latex) return { block: null, problem: 'formula is empty' }
      if (!balanced(latex)) return { block: null, problem: 'formula braces do not balance' }
      return { block: { ...base, type, latex, caption: clip(raw.caption, 300) }, problem: '' }
    }
    case 'worked_example': {
      const question = clip(raw.question ?? raw.problem, 3000)
      const steps = (Array.isArray(raw.steps) ? raw.steps : []).map((step: unknown) => clip(step, 1500)).filter(Boolean).slice(0, 20)
      if (!question || !steps.length) return { block: null, problem: 'worked example needs a question and steps' }
      return { block: { ...base, type, question, steps, answer: clip(raw.answer, 1500) }, problem: '' }
    }
    case 'table': {
      if (!allowed.tables) return { block: null, problem: 'tables are switched off' }
      const columns = (Array.isArray(raw.columns) ? raw.columns : []).map((cell: unknown) => clip(cell, 200)).slice(0, 10)
      const rows = (Array.isArray(raw.rows) ? raw.rows : []).slice(0, 40).map((row: unknown) => (Array.isArray(row) ? row : []).map(cell => clip(cell, 400)))
      if (columns.length < 2 || !rows.length) return { block: null, problem: 'table needs columns and rows' }
      if (rows.some((row: string[]) => row.length !== columns.length)) return { block: null, problem: 'table rows do not match the columns' }
      return { block: { ...base, type, columns, rows, caption: clip(raw.caption, 300) }, problem: '' }
    }
    case 'graph': case 'chart': case 'diagram': case 'figure': {
      if (!allowed.graphs) return { block: null, problem: 'graphs are switched off' }
      const figure = raw.figure ?? raw.data ?? raw.spec
      const error = figureSpecError(figure)
      if (error) return { block: null, problem: `graph cannot be drawn: ${error}` }
      return { block: { ...base, type: 'graph', figure, caption: clip(raw.caption ?? figure?.title, 300) }, problem: '' }
    }
    case 'image': case 'illustration': {
      if (!allowed.images) return { block: null, problem: 'images are switched off' }
      const prompt = clip(raw.prompt ?? raw.description, 600)
      if (!prompt) return { block: null, problem: 'image needs a description' }
      return { block: { ...base, type: 'image', prompt, caption: clip(raw.caption, 300), url: '', status: 'pending' }, problem: '' }
    }
    case 'question': {
      const prompt = clip(raw.prompt ?? raw.question, 4000)
      if (!prompt) return { block: null, problem: 'question is empty' }
      const options = (Array.isArray(raw.options) ? raw.options : []).map((option: unknown) => clip(option, 600).replace(/^\(?[A-Fa-f][).:]\s+/, '')).filter(Boolean).slice(0, 6)
      let style = STYLES.includes(String(raw.style)) ? String(raw.style) : (options.length ? 'objective' : 'theory')
      if (style === 'objective' && options.length < 2) style = 'theory'
      let answer = clip(raw.answer, 3000)
      let answerIndex = -1
      if (style === 'objective') {
        const letter = answer.trim().match(/^\(?([A-Fa-f])\)?(?:[).:\s]|$)/)
        if (letter) answerIndex = letter[1].toUpperCase().charCodeAt(0) - 65
        else answerIndex = options.findIndex((option: string) => option.toLowerCase() === answer.toLowerCase().replace(/^\(?[a-f][).:]\s+/i, ''))
        if (Number.isInteger(raw.answerIndex) && raw.answerIndex >= 0) answerIndex = raw.answerIndex
        if (answerIndex < 0 || answerIndex >= options.length) return { block: null, problem: 'the answer is not one of the options' }
        answer = `${String.fromCharCode(65 + answerIndex)}. ${options[answerIndex]}`
      }
      return {
        block: {
          ...base, type, prompt, style, options, answer, answerIndex,
          level: LEVELS.includes(String(raw.level)) ? String(raw.level) : 'intermediate',
          marks: Math.max(0, Math.min(50, Math.round(Number(raw.marks) || 0))), solution: clip(raw.solution ?? raw.working, 4000),
          markingGuide: (Array.isArray(raw.markingGuide) ? raw.markingGuide : []).map((point: unknown) => clip(point, 500)).filter(Boolean).slice(0, 12),
        },
        problem: '',
      }
    }
    case 'flashcard': {
      const front = clip(raw.front, 600)
      const back = clip(raw.back, 1500)
      if (!front || !back) return { block: null, problem: 'flashcard needs a front and a back' }
      return { block: { ...base, type, front, back }, problem: '' }
    }
    default:
      return { block: null, problem: `unknown block type "${type}"` }
  }
}

/** Pull the JSON blocks out of a reply, however it is wrapped. */
export function parseBlocks(reply: string): any[] {
  const text = String(reply || '').replace(/```(?:json)?/gi, '').trim()
  const tryParse = (value: string) => { try { return JSON.parse(value) } catch { return undefined } }
  const objectStart = text.indexOf('{')
  const arrayStart = text.indexOf('[')
  let parsed: any
  if (objectStart >= 0 && (arrayStart < 0 || objectStart < arrayStart)) parsed = tryParse(text.slice(objectStart, text.lastIndexOf('}') + 1))
  if (parsed === undefined && arrayStart >= 0) parsed = tryParse(text.slice(arrayStart, text.lastIndexOf(']') + 1))
  if (Array.isArray(parsed)) return parsed
  if (parsed && Array.isArray(parsed.blocks)) return parsed.blocks
  if (parsed && Array.isArray(parsed.sections)) return parsed.sections.flatMap((section: any) => section?.blocks || [section])
  return []
}

// ─── Grounding and prompts ───────────────────────────────────────────────────

export type ExamGround = { key: string, label: string, spec: ExamSpec | null, topics: Array<SpecTopic & { via?: string }> }
export type Grounding = {
  status: 'curriculum' | 'ungrounded'
  levelDecision: string
  classLevel: ClassLevel
  curriculum: Array<Pick<CurriculumTopic, 'id' | 'curriculumId' | 'classLabel' | 'subject' | 'theme' | 'topic' | 'subtopics' | 'objectives' | 'competencies'> & { curriculumName: string }>
  exams: ExamGround[]
  customExam: string
  schoolExam: boolean
  notes: string[]
}

export function examLabel(exam: { label: string, key: string }) {
  return exam.label.replace(/\s*\(.*\)$/, '') || exam.key.toUpperCase()
}

export function groundingText(grounding: Grounding) {
  const lines: string[] = []
  if (grounding.curriculum.length) {
    lines.push('CURRICULUM (from the curriculum the school follows — this decides what is taught and at what depth):')
    for (const topic of grounding.curriculum) {
      lines.push(`- ${topic.curriculumName}: ${topic.classLabel} ${topic.subject}${topic.theme ? ` › ${topic.theme}` : ''} › ${topic.topic}`)
      if (topic.subtopics.length) lines.push(`  Subtopics: ${topic.subtopics.join('; ')}`)
      if (topic.objectives.length) lines.push(`  Learning objectives: ${topic.objectives.join('; ')}`)
      if (topic.competencies.length) lines.push(`  Expected competencies: ${topic.competencies.join('; ')}`)
    }
  } else {
    lines.push('CURRICULUM: none on file for this topic. Pitch the material at the stated class level and do not claim curriculum coverage.')
  }
  for (const exam of grounding.exams) {
    if (!exam.spec) { lines.push(`EXAMINATION ${exam.label}: no specification on file. Write general ${examLabel(exam)}-style material and do not claim it follows the official syllabus.`); continue }
    const spec = exam.spec
    lines.push(`EXAMINATION ${spec.name} — ${spec.subject} (${spec.version}${spec.effectiveFrom ? `, from ${spec.effectiveFrom}` : ''}):`)
    if (spec.papers.length) lines.push(`  Papers: ${spec.papers.map(paper => `${paper.name}${paper.marks ? `, ${paper.marks} marks` : ''}${paper.durationMinutes ? `, ${paper.durationMinutes} min` : ''}${paper.questionTypes?.length ? `, ${paper.questionTypes.join('/')}` : ''}`).join('; ')}`)
    if (spec.assessmentObjectives.length) lines.push(`  Assessment objectives: ${spec.assessmentObjectives.join('; ')}`)
    if (spec.requiredSkills.length) lines.push(`  Required skills: ${spec.requiredSkills.join('; ')}`)
    if (spec.questionTypes.length) lines.push(`  Question types: ${spec.questionTypes.join('; ')}`)
    if (spec.calculator) lines.push(`  Calculator: ${spec.calculator}`)
    if (spec.practical) lines.push(`  Practical requirements: ${spec.practical}`)
    for (const topic of exam.topics.slice(0, 8)) {
      lines.push(`  - ${topic.area ? `${topic.area} › ` : ''}${topic.topic}${topic.objectives.length ? `: ${topic.objectives.join('; ')}` : ''}${topic.questionTypes.length ? ` [${topic.questionTypes.join(', ')}]` : ''}`)
    }
    if (!exam.topics.length) lines.push('  (No topic in this specification matched; keep to the curriculum and the paper style above.)')
  }
  if (grounding.schoolExam) lines.push('EXAMINATION: the school\'s own examination — follow the school curriculum.')
  if (grounding.customExam) lines.push(`EXAMINATION: ${grounding.customExam} (named by the teacher; no specification on file, so do not claim official coverage).`)
  return lines.join('\n').slice(0, 9000)
}

const GRAPH_GUIDE = FIGURE_GUIDE
  .replace(/^DIAGRAMS, GRAPHS AND CHARTS:[^\n]*\n/, 'GRAPHS, CHARTS AND DIAGRAMS: use a "graph" block whose "figure" is ONE of these JSON objects (Ndovera draws it exactly; never draw ASCII art or describe a graph you could draw):\n')
  .replace(/Put data tables in Markdown tables[^\n]*/, 'Data belongs in a "table" block, not a graph.')

export function sectionPrompt(options: {
  kind: string, kindLabel: string, length: Length, subject: string, className: string, levelLabel: string, topic: string,
  section: Section, allSections: Section[], options: string[], allowed: { formulae: boolean, tables: boolean, graphs: boolean, images: boolean, imagesLeft: number },
  grounding: Grounding, earlier: string, instruction?: string,
}) {
  const { section, allowed } = options
  const examNames = options.grounding.exams.map(examLabel)
  const types = section.blocks.filter(type => (type !== 'formula' || allowed.formulae) && (type !== 'table' || allowed.tables) && (type !== 'graph' || allowed.graphs) && (type !== 'image' || (allowed.images && allowed.imagesLeft > 0)))
  const schema = [
    'BLOCK SHAPES (use only the types listed for this section):',
    '{"type":"heading","text":""}  {"type":"paragraph","text":""}  {"type":"note","text":""}',
    '{"type":"definition","term":"","text":""}',
    '{"type":"list","text":"optional title","items":[""],"ordered":false}  {"type":"summary","items":[""]}  {"type":"activity","text":"","items":["step"]}',
    '{"type":"formula","latex":"x=\\\\frac{-b\\\\pm\\\\sqrt{b^2-4ac}}{2a}","caption":"Quadratic formula"}',
    '{"type":"worked_example","question":"","steps":["each step on its own"],"answer":""}',
    '{"type":"table","caption":"","columns":["",""],"rows":[["",""]]}',
    '{"type":"graph","caption":"","figure":{ …one figure object… }}',
    '{"type":"image","prompt":"what an educational illustration should show, for an illustrator","caption":""}',
    '{"type":"exam_tip","text":""}  {"type":"common_mistake","text":"the mistake, why it is wrong, and the correct approach"}',
    '{"type":"question","style":"objective|theory|structured|short","level":"easy|intermediate|exam|challenging","prompt":"","options":["","","",""],"answer":"B","marks":1,"solution":"","markingGuide":[""]}',
    '{"type":"flashcard","front":"","back":""}',
  ].join('\n')
  const system = [
    `You are Ndovera AI, preparing a ${options.kindLabel} for ${options.className} ${options.subject} (curriculum level: ${options.levelLabel}). The teacher reviews and publishes it.`,
    'Return ONLY JSON: {"blocks":[ … ]} — an ordered list of blocks for ONE section. No Markdown headings (#), no ** bold markers inside JSON text except for emphasis of a few words; write tables as table blocks, formulae as formula blocks, graphs as graph blocks.',
    'Ground everything in the CURRICULUM and EXAMINATION context below. Cover its objectives at the depth expected for the level; do not drift above or below the level.',
    'Mathematics in text: inline LaTeX between \\( and \\), e.g. \\(x^2\\). Display formulae go in formula blocks (LaTeX without $ signs). Escape backslashes properly in JSON.',
    'Use the student\'s context (Nigeria / West Africa) for real-life examples, names, money (₦) and places, unless the examination is international.',
    examNames.length
      ? `Examination questions: label them only as "${examNames.join('/')}-style practice". NEVER say a question is from a past paper or a given year, and never invent official question numbers. Follow the paper style and question types in the specification.`
      : 'Never claim a question is from a past examination paper.',
    `Length: ${LENGTHS[options.length]} — ${options.length === 'short' ? 'concise' : options.length === 'detailed' ? 'thorough' : 'in full depth'}.`,
    allowed.graphs && types.includes('graph') ? `Add a graph only where it genuinely helps understanding.\n${GRAPH_GUIDE}` : 'Do not use graph blocks.',
    allowed.images && types.includes('image') ? `Add at most ${Math.min(2, allowed.imagesLeft)} image block(s), and only where an illustration truly helps (e.g. a labelled diagram of an organ or apparatus). Describe it precisely for an illustrator; keep labels few.` : 'Do not use image blocks.',
    allowed.tables ? '' : 'Do not use table blocks.',
    allowed.formulae ? '' : 'Do not use formula blocks; write any expressions in words.',
    schema,
    '',
    groundingText(options.grounding),
  ].filter(Boolean).join('\n')
  const wanted = options.options.filter(key => ALL_OPTION_KEYS.includes(key))
  const user = [
    `Topic: ${options.topic}`,
    `Material plan: ${options.allSections.map(item => item.title).join(' → ')}`,
    `WRITE THIS SECTION NOW: "${section.title}" — ${section.focus}`,
    `Block types allowed in this section: ${types.join(', ')}.`,
    `Teacher's choices: ${wanted.join(', ') || 'defaults'}.`,
    section.key === 'solutions' ? 'Give the answer to every question listed under EARLIER SECTIONS, in order, numbered the same way.' : '',
    options.earlier ? `EARLIER SECTIONS (do not repeat them):\n${options.earlier}` : '',
    options.instruction ? `TEACHER'S INSTRUCTION FOR THIS SECTION: ${options.instruction}` : '',
  ].filter(Boolean).join('\n\n')
  return { system, user, types }
}

/** A short reminder of what earlier sections said, so later ones neither repeat nor contradict them. */
export function earlierSummary(blocks: AiBlock[], limit = 3500) {
  const lines: string[] = []
  let questionNumber = 0
  for (const block of blocks) {
    if (block.type === 'question') { questionNumber += 1; lines.push(`Q${questionNumber} [${block.style}]: ${block.prompt.slice(0, 220)}${block.options?.length ? ` Options: ${block.options.map((option: string, index: number) => `${String.fromCharCode(65 + index)}. ${option}`).join(' ')}` : ''}`) }
    else if (block.type === 'heading') lines.push(`# ${block.text}`)
    else if (block.type === 'definition') lines.push(`Defined: ${block.term}`)
    else if (block.type === 'worked_example') lines.push(`Worked example: ${block.question.slice(0, 160)}`)
    else if (block.type === 'formula') lines.push(`Formula: ${block.latex}`)
  }
  const text = lines.join('\n')
  return text.length > limit ? text.slice(text.length - limit) : text
}

// ─── Validator ───────────────────────────────────────────────────────────────

export type Check = { key: string, label: string, status: 'pass' | 'warn' | 'fail', detail: string }

const EXAM_NAMES = 'WAEC|WASSCE|NECO|SSCE|BECE|JAMB|UTME|IGCSE|Cambridge|SAT|IELTS|TOEFL|Common Entrance|NCEE'
const CLAIM_PATTERNS = [
  new RegExp(`\\b(${EXAM_NAMES})\\b[^.\\n]{0,25}\\b(19|20)\\d\\d\\b`, 'i'),
  new RegExp(`\\b(19|20)\\d\\d\\b[^.\\n]{0,25}\\b(${EXAM_NAMES})\\b`, 'i'),
  /\bpast[- ](exam(ination)?[- ])?(question|paper)s?\b(?![- ]style)/i,
  new RegExp(`\\b(official|actual|real)\\b[^.\\n]{0,20}\\b(${EXAM_NAMES})\\b[^.\\n]{0,20}\\bquestion`, 'i'),
]

export function blockText(block: AiBlock): string {
  switch (block.type) {
    case 'definition': return `${block.term} ${block.text}`
    case 'list': case 'summary': case 'activity': return [block.text, ...(block.items || [])].join(' ')
    case 'formula': return `${block.latex} ${block.caption || ''}`
    case 'worked_example': return [block.question, ...block.steps, block.answer].join(' ')
    case 'table': return [block.caption, ...block.columns, ...block.rows.flat()].join(' ')
    case 'graph': return block.caption || ''
    case 'image': return `${block.caption} ${block.prompt}`
    case 'question': return [block.prompt, ...(block.options || []), block.answer, block.solution].join(' ')
    case 'flashcard': return `${block.front} ${block.back}`
    default: return block.text || ''
  }
}

/** Numbers, + - * / ^ and brackets only (Workers may not eval). NaN when it is anything else. */
export function evaluateArithmetic(source: string): number {
  const text = String(source).replace(/\s+/g, '')
  let at = 0
  const peek = () => text[at]
  const number = (): number => {
    if (peek() === '(') { at += 1; const value = sum(); if (peek() !== ')') throw new Error('bracket'); at += 1; return value }
    if (peek() === '-') { at += 1; return -number() }
    const match = /^\d+(?:\.\d+)?|^\.\d+/.exec(text.slice(at))
    if (!match) throw new Error('number')
    at += match[0].length
    return Number(match[0])
  }
  const power = (): number => { const base = number(); if (peek() === '^') { at += 1; return base ** power() } return base }
  const product = (): number => {
    let value = power()
    while (peek() === '*' || peek() === '/') { const op = text[at]; at += 1; const right = power(); value = op === '*' ? value * right : value / right }
    return value
  }
  const sum = (): number => {
    let value = product()
    while (peek() === '+' || peek() === '-') { const op = text[at]; at += 1; const right = product(); value = op === '+' ? value + right : value - right }
    return value
  }
  try { const value = sum(); return at === text.length ? value : NaN } catch { return NaN }
}

/** Plain arithmetic "3 + 4 × 2 = 11" inside a step: checked when both sides are numbers only. */
export function arithmeticSlips(text: string) {
  const slips: string[] = []
  const cleaned = String(text).replace(/\\times|×/g, '*').replace(/÷/g, '/').replace(/\\cdot/g, '*').replace(/[−–]/g, '-').replace(/\\[()[\]]/g, ' ')
  const chains = cleaned.match(/(?:[-\d.()+*/^ ]+=){1,4}[-\d.() ]+/g) || []
  for (const chain of chains) {
    const sides = chain.split('=').map(side => side.trim()).filter(Boolean)
    if (sides.length < 2 || sides.some(side => !/\d/.test(side) || /[^-\d.()+*/^ ]/.test(side))) continue
    const values = sides.map(evaluateArithmetic)
    if (values.some(value => !Number.isFinite(value))) continue
    for (let i = 1; i < values.length; i += 1) {
      const tolerance = Math.max(0.011, Math.abs(values[i]) * 0.005)
      if (Math.abs(values[i] - values[i - 1]) > tolerance) { slips.push(chain.trim()); break }
    }
  }
  return slips
}

export function objectiveCovered(objective: string, haystack: Set<string>) {
  const words = tokens(objective).filter(word => word.length > 3 && !['student', 'learner', 'pupil', 'able', 'should', 'explain', 'describe', 'identify', 'state', 'define', 'list', 'solve', 'calculate', 'understand', 'know', 'mention', 'discuss'].includes(word))
  if (!words.length) return true
  return words.filter(word => haystack.has(word)).length / words.length >= 0.6
}

export function validateDraft(input: { blocks: AiBlock[], grounding: Grounding, sections: Section[], options: string[], examLabels: string[] }) {
  const checks: Check[] = []
  const all = input.blocks.map(blockText).join(' \n')
  const haystack = new Set(tokens(all))
  const objectives = input.grounding.curriculum.flatMap(topic => topic.objectives.map(objective => ({ objective, classLabel: topic.classLabel })))
  const coverage = objectives.map(item => ({ ...item, covered: objectiveCovered(item.objective, haystack) }))
  const missed = coverage.filter(item => !item.covered)
  if (!input.grounding.curriculum.length) checks.push({ key: 'curriculum', label: 'Curriculum objectives', status: 'warn', detail: 'No curriculum on file for this topic — coverage could not be checked. The material is labelled "not curriculum-checked".' })
  else if (!objectives.length) checks.push({ key: 'curriculum', label: 'Curriculum objectives', status: 'warn', detail: 'The curriculum entry has no objectives listed, so coverage could not be checked.' })
  else checks.push({ key: 'curriculum', label: 'Curriculum objectives', status: missed.length === 0 ? 'pass' : missed.length <= Math.ceil(objectives.length / 3) ? 'warn' : 'fail', detail: missed.length ? `Not clearly covered: ${missed.map(item => item.objective).join('; ')}` : `All ${objectives.length} objective(s) covered.` })

  const level = input.grounding.levelDecision
  checks.push(level === 'keep'
    ? { key: 'level', label: 'Educational level', status: 'warn', detail: `You kept ${input.grounding.classLevel.label || 'your class'} although the curriculum places this topic elsewhere; check the depth suits your students.` }
    : { key: 'level', label: 'Educational level', status: 'pass', detail: input.grounding.curriculum.length ? `Written to ${[...new Set(input.grounding.curriculum.map(topic => topic.classLabel))].join(', ')} objectives.` : `Pitched at ${input.grounding.classLevel.label || 'the class level'}.` })

  const claims: string[] = []
  input.blocks.forEach((block, index) => { const text = blockText(block); if (CLAIM_PATTERNS.some(pattern => pattern.test(text))) claims.push(`block ${index + 1}: "${text.slice(0, 90)}…"`) })
  checks.push({ key: 'claims', label: 'Examination claims', status: claims.length ? 'fail' : 'pass', detail: claims.length ? `Possible claims of official or past questions — reword: ${claims.join(' ')}` : `${input.examLabels.length ? `Questions are labelled as ${input.examLabels.join('/')}-style practice; ` : ''}no claims of official past questions.` })
  const unverified = input.grounding.exams.filter(exam => !exam.spec).map(exam => exam.label)
  if (unverified.length || input.grounding.customExam) checks.push({ key: 'specs', label: 'Examination specifications', status: 'warn', detail: `No specification on file for ${[...unverified, input.grounding.customExam].filter(Boolean).join(', ')} — exam coverage is not verified.` })

  const slips: string[] = []
  input.blocks.forEach(block => {
    if (block.type === 'worked_example') for (const step of block.steps) slips.push(...arithmeticSlips(step))
    if (block.type === 'question' && block.solution) slips.push(...arithmeticSlips(block.solution))
  })
  const questions = input.blocks.filter(block => block.type === 'question')
  const withoutAnswers = has(input.options, 'answers', 'solutions') ? questions.filter(block => !block.answer && !block.solution).length : 0
  const answersSection = input.blocks.some(block => block.section === 'solutions')
  checks.push({
    key: 'consistency', label: 'Answers and working', status: slips.length ? 'fail' : withoutAnswers && !answersSection ? 'warn' : 'pass',
    detail: [
      slips.length ? `Arithmetic that does not hold: ${slips.slice(0, 5).join(' | ')}` : 'Every checkable calculation holds.',
      questions.length ? `${questions.length} question(s); objective answers are each one of their options.` : '',
      withoutAnswers && !answersSection ? `${withoutAnswers} question(s) have no answer yet.` : '',
    ].filter(Boolean).join(' '),
  })
  const failed = input.sections.filter(section => section.status === 'failed')
  if (failed.length) checks.push({ key: 'sections', label: 'Sections', status: 'fail', detail: `Could not be written: ${failed.map(section => section.title).join(', ')}. Regenerate them or write them yourself.` })
  const images = input.blocks.filter(block => block.type === 'image')
  const imageGaps = images.filter(block => !block.url).length
  if (imageGaps) checks.push({ key: 'images', label: 'Images', status: 'warn', detail: `${imageGaps} illustration(s) not drawn yet; they are left out when you publish unless drawn.` })
  return { checks, coverage, ok: !checks.some(check => check.status === 'fail') }
}

/** The examination labels on generated questions — "WAEC/NECO-style Practice Question". */
export function questionLabel(examLabels: string[], fallback = 'Practice Question') {
  return examLabels.length ? `${examLabels.join('/')}-style Practice Question` : fallback
}

// ─── Into the material ───────────────────────────────────────────────────────

const LEVEL_LABEL: Record<string, string> = { easy: 'Easy', intermediate: 'Intermediate', exam: 'Examination standard', challenging: 'Challenging' }

function markdownCell(value: string) { return String(value || '').replace(/\|/g, '\\|').replace(/\n+/g, ' ') }

/**
 * Draft blocks → material blocks. Each keeps its own type (so it renders as a
 * formula, table, graph, question card…) and also carries the same content as
 * rich text, so every older view, the editor and plain-text fallbacks still
 * show it properly.
 */
export function toMaterialBlocks(blocks: AiBlock[], examLabels: string[], sections: Section[]) {
  const out: Array<Record<string, any>> = []
  const titles = new Map(sections.map(section => [section.key, section.title]))
  let currentSection = ''
  let questionNumber = 0
  for (const block of blocks) {
    if (block.section !== currentSection) {
      currentSection = block.section
      const title = titles.get(block.section)
      if (title) out.push({ type: 'heading', text: title })
    }
    switch (block.type) {
      case 'heading': out.push({ type: 'subheading', text: block.text }); break
      case 'paragraph': out.push({ type: 'paragraph', text: block.text }); break
      case 'note': out.push({ type: 'note', text: block.text }); break
      case 'exam_tip': out.push({ type: 'exam_tip', text: block.text }); break
      case 'common_mistake': out.push({ type: 'common_mistake', text: block.text }); break
      case 'definition': out.push({ type: 'definition', text: block.term ? `**${block.term}** — ${block.text}` : block.text }); break
      case 'list': out.push({ type: 'list', text: block.text || '', items: block.items, ordered: block.ordered }); break
      case 'summary': out.push({ type: 'summary', text: block.text || '', items: block.items, ordered: false }); break
      case 'activity': out.push({ type: 'exercise', text: block.text || 'Activity', items: block.items, ordered: true }); break
      case 'formula': out.push({ type: 'formula', text: `$$${block.latex}$$${block.caption ? `\n\n*${block.caption}*` : ''}` }); break
      case 'worked_example': out.push({ type: 'worked_example', text: block.question, items: [...block.steps, ...(block.answer ? [`**Answer:** ${block.answer}`] : [])], ordered: true }); break
      case 'table': out.push({ type: 'table', text: `${block.caption ? `*${block.caption}*\n\n` : ''}| ${block.columns.map(markdownCell).join(' | ')} |\n|${' --- |'.repeat(block.columns.length)}\n${block.rows.map((row: string[]) => `| ${row.map(markdownCell).join(' | ')} |`).join('\n')}` }); break
      case 'graph': out.push({ type: 'figure', text: `\`\`\`figure\n${JSON.stringify(block.figure)}\n\`\`\`${block.caption ? `\n\n*${block.caption}*` : ''}` }); break
      case 'image': if (block.url) out.push({ type: 'image', text: `![${markdownCell(block.caption || 'Illustration')}](${block.url})${block.caption ? `\n\n*${block.caption}*` : ''}` }); break
      case 'flashcard': out.push({ type: 'flashcard', text: block.front, answer: block.back }); break
      case 'question': {
        questionNumber += 1
        const heading = `**${questionNumber}. ${questionLabel(examLabels)}** · ${LEVEL_LABEL[block.level] || 'Practice'}${block.marks ? ` · ${block.marks} mark${block.marks === 1 ? '' : 's'}` : ''}`
        const answer = [
          block.answer ? `**Answer:** ${block.answer}` : '',
          block.solution ? `**Solution:** ${block.solution}` : '',
          block.markingGuide?.length ? `**Marking guide:**\n${block.markingGuide.map((point: string) => `- ${point}`).join('\n')}` : '',
        ].filter(Boolean).join('\n\n')
        out.push({ type: 'question', text: `${heading}\n\n${block.prompt}`, items: block.options, ordered: true, ...(answer ? { answer } : {}) })
        break
      }
    }
  }
  return out
}

// ─── Drafts ──────────────────────────────────────────────────────────────────

const readyDbs = new WeakSet<object>()

export async function ensureMaterialAiTables(db: D1Database) {
  if (readyDbs.has(db as object)) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS material_ai_drafts (
    id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, class_id TEXT NOT NULL, subject_id TEXT NOT NULL, class_name TEXT, subject_name TEXT, topic TEXT NOT NULL,
    kind TEXT NOT NULL, length TEXT, options TEXT, request TEXT, grounding TEXT, sections TEXT, blocks TEXT, images_used INTEGER DEFAULT 0, validation TEXT, review TEXT,
    status TEXT NOT NULL DEFAULT 'generating', material_id TEXT, created_by TEXT NOT NULL, created_by_name TEXT, created_at TEXT, updated_at TEXT
  )`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_material_ai_drafts_owner ON material_ai_drafts(tenant_id, created_by, updated_at)`).run()
  readyDbs.add(db as object)
}

export function mapDraft(row: Record<string, any>) {
  return {
    id: String(row.id), tenantId: String(row.tenant_id), classId: String(row.class_id), subjectId: String(row.subject_id), className: String(row.class_name || ''),
    subjectName: String(row.subject_name || ''), topic: String(row.topic || ''), kind: String(row.kind) as MaterialKind, length: (String(row.length || 'detailed') as Length),
    options: json<string[]>(row.options, []), request: json<Record<string, any>>(row.request, {}), grounding: json<Grounding>(row.grounding, {} as Grounding),
    sections: json<Section[]>(row.sections, []), blocks: json<AiBlock[]>(row.blocks, []), imagesUsed: Number(row.images_used || 0),
    validation: json<Record<string, any> | null>(row.validation, null), review: json<Record<string, any> | null>(row.review, null),
    status: String(row.status || 'generating'), materialId: String(row.material_id || ''), createdBy: String(row.created_by), createdByName: String(row.created_by_name || ''),
    createdAt: row.created_at, updatedAt: row.updated_at,
  }
}
export type Draft = ReturnType<typeof mapDraft>

export async function getDraft(db: D1Database, tenantId: string, id: string) {
  await ensureMaterialAiTables(db)
  const row = await db.prepare(`SELECT * FROM material_ai_drafts WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first() as Record<string, any> | null
  return row ? mapDraft(row) : null
}

export async function getOwnDraft(db: D1Database, tenantId: string, id: string, actor: Actor) {
  const draft = await getDraft(db, tenantId, id)
  if (!draft || draft.status === 'discarded') throw new MaterialAiError('Draft not found.', 404)
  if (draft.createdBy !== actor.id) throw new MaterialAiError('Only the teacher who started this draft can change it.', 403)
  return draft
}

export async function listDrafts(db: D1Database, tenantId: string, actorId: string, classId = '') {
  await ensureMaterialAiTables(db)
  const rows = await db.prepare(`SELECT id, class_id, subject_id, class_name, subject_name, topic, kind, status, material_id, created_at, updated_at FROM material_ai_drafts
    WHERE tenant_id = ? AND created_by = ? AND status != 'discarded' ${classId ? 'AND class_id = ?' : ''} ORDER BY updated_at DESC LIMIT 40`).bind(...[tenantId, actorId, ...(classId ? [classId] : [])]).all()
  return ((rows.results || []) as Record<string, any>[]).map(row => ({
    id: String(row.id), classId: String(row.class_id), subjectId: String(row.subject_id), className: String(row.class_name || ''), subjectName: String(row.subject_name || ''),
    topic: String(row.topic || ''), kind: String(row.kind), kindLabel: MATERIAL_KINDS.find(item => item.key === row.kind)?.label || String(row.kind),
    status: String(row.status), materialId: String(row.material_id || ''), updatedAt: row.updated_at,
  }))
}

export async function createDraft(db: D1Database, input: {
  tenantId: string, classId: string, subjectId: string, className: string, subjectName: string, topic: string, kind: MaterialKind, length: Length, options: string[],
  request: Record<string, any>, grounding: Grounding, sections: Section[], actor: Actor,
}) {
  await ensureMaterialAiTables(db)
  const id = `mad_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`
  await db.prepare(`INSERT INTO material_ai_drafts (id, tenant_id, class_id, subject_id, class_name, subject_name, topic, kind, length, options, request, grounding, sections, blocks, status, created_by, created_by_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 'generating', ?, ?, ?, ?)`).bind(id, input.tenantId, input.classId, input.subjectId, input.className, input.subjectName, input.topic, input.kind, input.length,
    JSON.stringify(input.options), JSON.stringify(input.request), JSON.stringify(input.grounding), JSON.stringify(input.sections), input.actor.id, input.actor.name, now(), now()).run()
  return getDraft(db, input.tenantId, id) as Promise<Draft>
}

export async function saveDraft(db: D1Database, draft: Draft, patch: Partial<{ sections: Section[], blocks: AiBlock[], imagesUsed: number, validation: unknown, review: unknown, status: string, materialId: string, topic: string }>) {
  const next = { ...draft, ...patch }
  await db.prepare(`UPDATE material_ai_drafts SET sections = ?, blocks = ?, images_used = ?, validation = ?, review = ?, status = ?, material_id = ?, topic = ?, updated_at = ? WHERE id = ?`)
    .bind(JSON.stringify(next.sections), JSON.stringify(next.blocks), next.imagesUsed, next.validation ? JSON.stringify(next.validation) : null, next.review ? JSON.stringify(next.review) : null,
      next.status, next.materialId || null, next.topic, now(), draft.id).run()
  return { ...next, updatedAt: now() } as Draft
}

export function examLabelsOf(grounding: Grounding) {
  return [...grounding.exams.map(examLabel), ...(grounding.customExam ? [grounding.customExam] : [])]
}

/**
 * Write one pending section (or rewrite a given one). Blocks the model gets
 * wrong are asked for once more; anything still unusable is dropped and the
 * section marked failed when nothing usable came back.
 */
export async function generateSection(draft: Draft, options: {
  runAi: AiRunner, settings: { formulae: boolean, tables: boolean, graphs: boolean, images: boolean, maxImages: number }, sectionKey?: string, instruction?: string,
}) {
  const section = options.sectionKey ? draft.sections.find(item => item.key === options.sectionKey) : draft.sections.find(item => item.status === 'pending')
  if (!section) return { draft, section: null, problems: [] as string[] }
  const kindLabel = MATERIAL_KINDS.find(item => item.key === draft.kind)?.label || 'material'
  const otherBlocks = draft.blocks.filter(block => block.section !== section.key)
  const imagesInOthers = otherBlocks.filter(block => block.type === 'image').length
  const allowed = { formulae: options.settings.formulae, tables: options.settings.tables, graphs: options.settings.graphs, images: options.settings.images && options.settings.maxImages > imagesInOthers, imagesLeft: Math.max(0, options.settings.maxImages - imagesInOthers) }
  const index = draft.sections.findIndex(item => item.key === section.key)
  const before = otherBlocks.filter(block => draft.sections.findIndex(item => item.key === block.section) < index)
  const prompt = sectionPrompt({
    kind: draft.kind, kindLabel, length: draft.length, subject: draft.subjectName, className: draft.className,
    levelLabel: draft.grounding.curriculum.length ? [...new Set(draft.grounding.curriculum.map(topic => topic.classLabel))].join(' → ') : (draft.grounding.classLevel?.label || draft.className),
    topic: draft.topic, section, allSections: draft.sections, options: draft.options, allowed, grounding: draft.grounding,
    earlier: earlierSummary(section.key === 'solutions' ? otherBlocks : before), instruction: options.instruction,
  })
  const problems: string[] = []
  let accepted: AiBlock[] = []
  for (let attempt = 0; attempt < 2 && !accepted.length; attempt += 1) {
    let reply = ''
    try {
      reply = await options.runAi([{ role: 'system', content: prompt.system }, { role: 'user', content: attempt ? `${prompt.user}\n\nYour last reply could not be used (${problems.slice(-3).join('; ') || 'no JSON blocks'}). Return {"blocks":[…]} only.` : prompt.user }],
        { maxTokens: section.blocks.includes('question') ? 1800 : 1500, temperature: 0.5 })
    } catch (error) {
      if (attempt === 1) throw new MaterialAiError('Ndovera AI is busy right now. Try again in a moment.', 503)
      continue
    }
    const raw = parseBlocks(reply)
    if (!raw.length) { problems.push('no JSON blocks'); continue }
    let images = 0
    for (const item of raw.slice(0, 60)) {
      const { block, problem } = normalizeBlock(item, section.key, allowed)
      if (!block) { problems.push(problem); continue }
      if (!prompt.types.includes(block.type) && !['paragraph', 'heading', 'note'].includes(block.type)) { problems.push(`${block.type} is not used in this section`); continue }
      if (block.type === 'image') { if (images >= Math.min(2, allowed.imagesLeft)) continue; images += 1 }
      accepted.push(block)
    }
  }
  const failed = !accepted.length
  // Keep the order of sections: this section's blocks replace any it had before.
  const blocks: AiBlock[] = []
  for (const item of draft.sections) {
    if (item.key === section.key) blocks.push(...accepted)
    else blocks.push(...draft.blocks.filter(block => block.section === item.key))
  }
  const sections = draft.sections.map(item => (item.key === section.key ? { ...item, status: (failed ? 'failed' : 'done') as Section['status'], note: failed ? problems.slice(0, 3).join('; ') : '' } : item))
  const remaining = sections.filter(item => item.status === 'pending').length
  return { draft: { ...draft, blocks, sections, status: remaining ? 'generating' : 'ready' } as Draft, section: { ...section, status: failed ? 'failed' : 'done' }, problems }
}

/** The teacher's edits: every block re-checked, unknown ones refused. */
export function cleanTeacherBlocks(input: unknown, draft: Draft, settings: { formulae: boolean, tables: boolean, graphs: boolean, images: boolean }) {
  if (!Array.isArray(input)) throw new MaterialAiError('Send the blocks to save.')
  const sectionKeys = new Set(draft.sections.map(section => section.key))
  const previousImages = new Map(draft.blocks.filter(block => block.type === 'image' && block.url).map(block => [block.url, block]))
  const blocks: AiBlock[] = []
  const problems: string[] = []
  input.slice(0, 400).forEach((raw: any, index: number) => {
    const section = sectionKeys.has(String(raw?.section)) ? String(raw.section) : draft.sections[0]?.key || 'core'
    // An image keeps its stored address only if Ndovera drew it for this draft.
    if (raw?.type === 'image' && raw.url && !previousImages.has(raw.url)) raw = { ...raw, url: '' }
    const { block, problem } = normalizeBlock(raw, section, { ...settings, images: true })
    if (!block) { problems.push(`Block ${index + 1}: ${problem}`); return }
    if (block.type === 'image') { const kept = previousImages.get(String(raw.url)); if (kept) Object.assign(block, { url: kept.url, status: 'drawn', assetKey: kept.assetKey }) }
    blocks.push(block)
  })
  if (problems.length) throw new MaterialAiError(problems.slice(0, 5).join(' '))
  return blocks
}

export const AI_REVIEW_SYSTEM = [
  'You check a school learning material written by an AI before a teacher publishes it. Return ONLY JSON: {"findings":[{"block":number,"severity":"error|warning","issue":"","fix":""}],"summary":""}.',
  'Look for: factual or scientific errors; wrong answers or working; content above or below the stated level; anything not covered that the curriculum objectives require; claims that questions are official or past examination questions; unclear or culturally inappropriate wording.',
  'Refer to blocks by their number. Say nothing about style unless it would confuse a student. An empty findings list is a valid answer.',
].join('\n')

export function reviewPrompt(draft: Draft) {
  const lines = draft.blocks.map((block, index) => `[${index + 1}] ${block.type}: ${blockText(block).slice(0, 600)}`)
  return [
    { role: 'system', content: AI_REVIEW_SYSTEM },
    { role: 'user', content: `${groundingText(draft.grounding)}\n\nCLASS: ${draft.className}. SUBJECT: ${draft.subjectName}. TOPIC: ${draft.topic}.\n\nMATERIAL:\n${lines.join('\n').slice(0, 14000)}` },
  ]
}

export function parseReview(reply: string, blockCount: number) {
  const text = String(reply || '').replace(/```(?:json)?/gi, '')
  let parsed: any = null
  try { parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) } catch {}
  const findings = (Array.isArray(parsed?.findings) ? parsed.findings : []).slice(0, 30).map((finding: any) => ({
    block: Math.max(1, Math.min(blockCount, Math.round(Number(finding?.block) || 1))), severity: finding?.severity === 'error' ? 'error' : 'warning',
    issue: clip(finding?.issue, 500), fix: clip(finding?.fix, 500),
  })).filter((finding: any) => finding.issue)
  return { findings, summary: clip(parsed?.summary, 600), reviewedAt: now() }
}

/** Ndovera's prompt for an educational illustration. */
export function imagePrompt(block: AiBlock, context: { subject: string, className: string }) {
  return `Clear educational illustration for ${context.className} ${context.subject} students: ${block.prompt}. Clean textbook style, white background, accurate, simple colours, minimal text, no watermark.`
}
