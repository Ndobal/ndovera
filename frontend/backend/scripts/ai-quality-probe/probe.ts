// A live check of Ndovera AI assessment quality against the real model.
//
// Runs the production pipeline — plan → prompt → model → parse → validate →
// randomise answer keys → audit → AI moderator review — for one scenario per
// request, and returns everything (questions, keys, problems, audit, review)
// for a person to read. It has only the AI binding: no database, no school data.
//
//   cd frontend/backend
//   npx wrangler dev -c scripts/ai-quality-probe/wrangler.toml --port 8799
//   node scripts/ai-quality-probe/run.mjs            (writes the report)
//
// Never deployed: wrangler dev runs it on this machine; only the model call goes to Cloudflare.

import {
  ASSESSMENT_PROFILES, auditAssessment, buildGenerationPrompt, buildReviewPrompt, normalizeConfig, normalizeQuestion,
  optionCountFor, parseQuestionsJson, planSlots, randomiseAnswers,
} from '../../src/assessmentEngine'
import type { Question, Slot } from '../../src/assessmentEngine'

// Keep in step with src/index.ts (assessmentAiRunner) and src/aiAssessments.ts (batchFor, tokensFor).
const ASSESSMENT_AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
const FALLBACK_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast'
const batchFor = (pending: Slot[]) => {
  const first = pending[0]
  if (!first) return pending
  const size = first.parts ? 2 : ['mcq', 'truefalse', 'fill'].includes(first.type) ? 6 : 3
  return pending.filter(slot => slot.type === first.type && Boolean(slot.parts) === Boolean(first.parts)).slice(0, size)
}
const tokensFor = (slots: Slot[]) => 600 + slots.reduce((sum, slot) => sum + (slot.parts ? 1300 : ['mcq', 'truefalse', 'fill'].includes(slot.type) ? 380 : 700), 0)

export const SCENARIOS = [
  { name: 'JSS 2 Mathematics quiz', subjectName: 'Mathematics', className: 'JSS 2', config: { kind: 'quiz', standard: 'school', questionCount: 8, totalMarks: 8, types: ['mcq'], topicNames: ['Simple equations', 'Fractions'] } },
  { name: 'SS 2 Physics test (WAEC)', subjectName: 'Physics', className: 'SS 2', config: { kind: 'test', standard: 'waec', questionCount: 8, totalMarks: 30, types: ['mcq', 'structured'], topicNames: ["Ohm's law", 'Electric circuits'] } },
  { name: 'SS 1 Economics assignment', subjectName: 'Economics', className: 'SS 1', config: { kind: 'assignment', standard: 'school', questionCount: 4, totalMarks: 20, types: ['short', 'essay'], topicNames: ['Demand and supply'] } },
  { name: 'Primary 5 English quiz', subjectName: 'English Language', className: 'Primary 5', config: { kind: 'quiz', standard: 'school', questionCount: 8, totalMarks: 8, types: ['mcq', 'fill'], topicNames: ['Parts of speech'] } },
  { name: 'SS 3 Chemistry test (WAEC)', subjectName: 'Chemistry', className: 'SS 3', config: { kind: 'test', standard: 'waec', questionCount: 8, totalMarks: 24, types: ['mcq', 'calculation'], topicNames: ['Mole concept', 'Stoichiometry'] } },
  { name: 'JSS 1 Basic Science quiz', subjectName: 'Basic Science', className: 'JSS 1', config: { kind: 'quiz', standard: 'school', questionCount: 8, totalMarks: 8, types: ['truefalse', 'short'], topicNames: ['Living and non-living things'] } },
]

async function runModel(env: { AI: any }, messages: Array<{ role: string, content: string }>, options: { maxTokens: number, temperature: number }, log: string[]) {
  const run = async (model: string) => {
    const started = Date.now()
    const result = await env.AI.run(model, { messages, max_tokens: options.maxTokens, temperature: options.temperature })
    log.push(`${model} ${Date.now() - started} ms`)
    const response = result?.response
    return response && typeof response === 'object' ? JSON.stringify(response) : String(response ?? '')
  }
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 55_000))
  try { return await Promise.race([run(ASSESSMENT_AI_MODEL), timeout]) } catch (error) {
    log.push(`large model failed (${(error as Error).message}); fallback`)
    return run(FALLBACK_MODEL)
  }
}

async function runScenario(env: { AI: any }, scenario: typeof SCENARIOS[number]) {
  const config = normalizeConfig(scenario.config, scenario.className)
  const slots = planSlots(config)
  const accepted: Question[] = []
  const rejected: Array<{ slot: number, type: string, problems: string[], raw: unknown }> = []
  const log: string[] = []
  const unparsed: string[] = []
  let pending = slots
  while (pending.length) {
    const batch = batchFor(pending)
    let leftover = batch
    let corrections: string[] = []
    for (let attempt = 0; attempt < 2 && leftover.length; attempt += 1) {
      const prompt = buildGenerationPrompt({ config, slots: leftover, subjectName: scenario.subjectName, className: scenario.className, context: '', existingPrompts: accepted.map(question => question.prompt), corrections: attempt ? corrections : [] })
      const reply = await runModel(env, [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }], { maxTokens: tokensFor(leftover), temperature: 0.6 }, log).catch(error => { log.push(`model error: ${error.message}`); return '' })
      const items = parseQuestionsJson(reply)
      if (!items.length) { log.push(`unparseable reply (attempt ${attempt + 1}), ${reply.length} chars, max ${tokensFor(leftover)} tokens`); unparsed.push(reply) }
      const missing: Slot[] = []
      corrections = items.length ? [] : ['Reply with a valid JSON array only, one object per question.']
      leftover.forEach((slot, index) => {
        const raw = items[index]
        if (!raw) { missing.push(slot); return }
        const { question, problems } = normalizeQuestion({ ...raw, type: slot.type, marks: slot.marks, section: slot.section }, slot, optionCountFor(config))
        if (problems.length) { missing.push(slot); corrections.push(`Question ${missing.length} (${slot.type}, ${slot.topic}): ${problems.join(' ')}`); if (attempt === 1) rejected.push({ slot: slot.index, type: slot.type, problems, raw }); else log.push(`slot ${slot.index} retry: ${problems.join('; ')}`); return }
        accepted.push({ ...question, bloom: slot.bloom, topic: question.topic || slot.topic, slot: slot.index })
      })
      leftover = missing
    }
    const done = new Set(batch.map(slot => slot.index))
    pending = pending.filter(slot => !done.has(slot.index))
  }
  const questions = randomiseAnswers(accepted.sort((a, b) => a.slot - b.slot))
  const audit = auditAssessment(questions, config)
  const review = buildReviewPrompt(questions, config, scenario.subjectName, scenario.className)
  const reviewReply = questions.length ? await runModel(env, [{ role: 'system', content: review.system }, { role: 'user', content: review.user }], { maxTokens: 900, temperature: 0.1 }, log).catch(() => '') : ''
  return {
    scenario: scenario.name, profile: ASSESSMENT_PROFILES[config.standard]?.label, planned: slots.length, written: questions.length, rejected, log, unparsed,
    audit: { checks: audit.checks, higherOrderPercent: audit.higherOrderPercent, totalMarks: audit.totalMarks, pattern: audit.pattern },
    moderator: parseQuestionsJson(reviewReply),
    questions: questions.map(question => ({
      type: question.type, marks: question.marks, bloom: question.bloom, topic: question.topic, prompt: question.prompt,
      options: question.options, key: question.options.length ? question.options[question.answerIndex] : undefined,
      answer: question.answer, workingSteps: question.workingSteps, markingPoints: question.markingPoints, parts: question.parts,
    })),
  }
}

export default {
  async fetch(request: Request, env: { AI: any }) {
    const url = new URL(request.url)
    if (url.pathname === '/scenarios') return Response.json(SCENARIOS.map(scenario => scenario.name))
    const index = Number(url.searchParams.get('scenario'))
    const scenario = SCENARIOS[index]
    if (!scenario) return Response.json({ error: 'Unknown scenario' }, { status: 404 })
    try { return Response.json(await runScenario(env, scenario)) } catch (error) { return Response.json({ error: (error as Error).message, stack: (error as Error).stack }, { status: 500 }) }
  },
}
