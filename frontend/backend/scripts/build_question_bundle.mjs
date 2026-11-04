// Builds the file Ami imports into Ndovera from question-data/.
//
// Questions the project's audit passes (question-data/audits/completion-dashboard.json) are used
// for examinations Ndovera offers. Questions it held for repetition or missing paperwork get a
// second review here: they stay held unless their content checks out, and only a few of each
// repeated template are kept. Objectives go to the bank, where the night's check must pass them
// before students see them. Theory becomes draft mock papers for Ami to read and publish.
// Everything else is counted as held, with its reason.
//
//   node frontend/backend/scripts/build_question_bundle.mjs

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../question-data')
const EXAM_KEYS = { WAEC: 'waec', NECO: 'neco', JAMB: 'jamb', NCEE: 'common_entrance', BECE: 'bece' }
const THEORY_TYPES = new Set(['structured', 'essay', 'longanswer'])
const THEORY_EXAMS = new Set(['waec', 'neco'])
const THEORY_PER_PAPER = 6
const THEORY_MINUTES = 120
const NEEDS_IMAGE = /\b(diagram|figure|graph below|shown below|shown above|table below)\b/i

const audit = JSON.parse(readFileSync(join(root, 'audits/completion-dashboard.json'), 'utf8'))
const passed = new Set(audit.questions.filter(item => !item.errors.length).map(item => item.id))
const errorsOf = new Map(audit.questions.map(item => [item.id, item.errors]))

// Holds about paperwork or repetition can be reviewed here. Any other hold (a wrong format, an
// unresolved class, a missing marking guide) stays held.
const REVIEWABLE = new Set(['cognitive_demand_missing_or_invalid', 'independent_review_evidence_missing_or_invalid', 'objective_mapping_missing', 'difficulty_missing_or_invalid', 'numeric_template_hold', 'identical_prompt_hold', 'near_duplicate_hold'])
const THEORY_REVIEWABLE = new Set([...REVIEWABLE, 'explanation_missing', 'invalid_score'])
const KEEP_PER_TEMPLATE = 3

const templateOf = new Map()
audit.numericTemplateGroups.forEach((group, index) => group.forEach(id => templateOf.set(id, index)))
const nearTo = new Map()
for (const { left, right } of audit.nearDuplicatePairs) {
  if (!nearTo.has(left)) nearTo.set(left, [])
  if (!nearTo.has(right)) nearTo.set(right, [])
  nearTo.get(left).push(right)
  nearTo.get(right).push(left)
}
const keptIds = new Set()
const keptFromTemplate = new Map()

/** Why a question the audit held should stay held; empty when it earns a place. */
function reviewHold(question) {
  const errors = errorsOf.get(question.id) || []
  const allowed = question.type === 'mcq' ? REVIEWABLE : THEORY_REVIEWABLE
  if (errors.some(error => !allowed.has(error))) return 'the audit found a fault that review cannot clear'
  if (String(question.prompt).trim().length < 15) return 'the question is too short to be clear'
  if (question.type === 'mcq') {
    const options = question.options || []
    if (options.length < 4 || new Set(options.map(option => String(option).trim().toLowerCase())).size !== options.length) return 'its options are incomplete or repeated'
    if (question.correctOption && options[question.correctOption.charCodeAt(0) - 65] !== question.answer) return 'its answer and answer letter disagree'
    const explanation = String(question.explanation || '')
    if (explanation.trim().length < 15) return 'it has no worked explanation'
    // A number in the answer should appear in the working that claims to reach it.
    const number = String(question.answer).match(/-?\d+(\.\d+)?/)
    if (number && !explanation.replace(/[,\s]/g, '').includes(number[0].replace(/[,\s]/g, ''))) return 'its working does not reach its answer'
  } else if (!markingPoints(question.markingGuide).length) return 'it has no marking guide'
  if ((nearTo.get(question.id) || []).some(id => keptIds.has(id))) return 'it is nearly the same as a question already kept'
  const template = templateOf.get(question.id)
  if (template !== undefined) {
    const key = `${question.exam}|${template}`
    if ((keptFromTemplate.get(key) || 0) >= KEEP_PER_TEMPLATE) return 'enough of this template are already kept'
  }
  return ''
}
function keep(question) {
  keptIds.add(question.id)
  const template = templateOf.get(question.id)
  if (template !== undefined) {
    const key = `${question.exam}|${template}`
    keptFromTemplate.set(key, (keptFromTemplate.get(key) || 0) + 1)
  }
}

const held = {}
const hold = (reason, question) => {
  const key = `${reason}`
  held[key] = (held[key] || 0) + 1
  return question && false
}

/** Marking guides come as text, lists or objects of criteria: students read them as plain points. */
function markingPoints(guide) {
  if (!guide) return []
  if (typeof guide === 'string') return [guide]
  if (Array.isArray(guide)) return guide.flatMap(markingPoints)
  if (typeof guide === 'object') {
    const text = guide.criterion || guide.criteria || guide.point || guide.description || guide.text
    if (typeof text === 'string') return [guide.marks ? `${text} (${guide.marks} mark${guide.marks === 1 ? '' : 's'})` : text]
    return Object.values(guide).flatMap(value => (typeof value === 'object' || typeof value === 'string' ? markingPoints(value) : []))
  }
  return []
}

/** "WAEC Mathematics: Solve..." reads as Solve...: a label is not part of the question, and can hide a repeat. */
function cleanPrompt(prompt) {
  const clean = String(prompt).trim()
    .replace(/^(WAEC|NECO|JAMB|UTME)\s+[A-Za-z ]{0,30}:\s*/, '')
    .replace(/^For the (WAEC|NECO|JAMB|UTME) practice exercise,\s*/i, '')
    .replace(/^For (WAEC|NECO|JAMB|UTME),\s*/i, '')
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

const objectives = []
const theoryBySubject = new Map()
const seen = new Set()
let cleared = 0
for (const name of readdirSync(root).filter(file => file.endsWith('.json')).sort()) {
  const { questions = [] } = JSON.parse(readFileSync(join(root, name), 'utf8'))
  for (const question of questions) {
    const exam = EXAM_KEYS[question.exam]
    if (!exam) { hold(`no ${question.exam} practice in Ndovera yet`, question); continue }
    // Manual-review items are theory, which Ami reads before publishing; never objectives.
    if (question.requiresManualReview && question.type === 'mcq') { hold('marked for manual review', question); continue }
    const needsReview = !passed.has(question.id)
    if (needsReview) {
      const reason = reviewHold(question)
      if (reason) { hold(reason, question); continue }
    }
    if (NEEDS_IMAGE.test(question.prompt)) { hold('needs a diagram that has not been drawn', question); continue }
    const prompt = cleanPrompt(question.prompt)
    const wording = prompt.toLowerCase().replace(/\s+/g, ' ').trim()
    if (seen.has(wording)) { hold('repeats another question\'s wording', question); continue }
    seen.add(wording)
    if (needsReview) { keep(question); cleared += 1 }

    if (question.type === 'mcq') {
      const answerIndex = question.options.indexOf(question.answer)
      if (answerIndex < 0) { hold('its answer is not one of its options', question); continue }
      objectives.push({ id: question.id, exam, subject: question.subject, topic: question.topic, prompt, options: question.options, answerIndex, explanation: question.explanation || '', passage: question.passage || '' })
    } else if (THEORY_TYPES.has(question.type) && THEORY_EXAMS.has(exam)) {
      const key = `${exam}|${question.subject}`
      const list = theoryBySubject.get(key) || []
      list.push({
        question: question.passage ? `${question.passage}\n\n${prompt}` : prompt,
        marks: Number(question.maxMarks || question.score) || 10,
        modelAnswer: question.answer,
        markingPoints: markingPoints(question.markingGuide),
      })
      theoryBySubject.set(key, list)
    } else {
      hold(`${question.type} questions for ${question.exam} have no place in practice yet`, question)
    }
  }
}

const papers = []
for (const [key, list] of theoryBySubject) {
  const [exam, subject] = key.split('|')
  for (let at = 0, set = 1; at < list.length; at += THEORY_PER_PAPER, set += 1) {
    papers.push({ exam, subject, setLabel: `Theory set ${set}`, theoryMinutes: THEORY_MINUTES, instructions: 'Answer all the questions.', objectives: [], theory: list.slice(at, at + THEORY_PER_PAPER) })
  }
}

const counts = {}
for (const item of objectives) counts[item.exam] = (counts[item.exam] || 0) + 1
const output = join(root, 'build/ndovera-live-bundle.json')
mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, `${JSON.stringify({ schemaVersion: 1, objectives, papers }, null, 0)}\n`)
console.log(JSON.stringify({ clearedByReview: cleared, objectives: objectives.length, byExam: counts, draftTheoryPapers: papers.length, theoryQuestions: papers.reduce((sum, paper) => sum + paper.theory.length, 0), held }, null, 2))
