// Matching a class written on an import sheet ("SSS 1 Science", "JS2", "Grade 1",
// "Primary One") to one of the school's classes ("SH 1 SCIENCE", "JHS 2 SECONDARY SCHOOL").
//
// In order: the class id; the exact name or "name arm"; the same letters and digits
// ignoring spaces and punctuation; then the level (levels.ts) — the one class at that
// level, or, where a level has several arms, the one whose arm the sheet names. Anything
// still unclear is not guessed: the caller reports it so the student is placed by hand.

import { levelOf } from './levels'

export type SchoolClass = { id: string, name: string, arm?: string | null }

const squash = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')
const words = (value: unknown) => String(value ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
const label = (klass: SchoolClass) => `${klass.name}${klass.arm ? ` ${klass.arm}` : ''}`.trim()

export function matchClass(classes: SchoolClass[], input: { classId?: unknown, className?: unknown }): { klass: SchoolClass | null, reason: string } {
  const id = String(input.classId ?? '').trim().toLowerCase()
  const text = String(input.className ?? '').trim()
  if (!id && !text) return { klass: null, reason: 'no class given' }
  if (id) {
    const byId = classes.find(klass => String(klass.id).toLowerCase() === id)
    if (byId) return { klass: byId, reason: 'id' }
  }
  if (!text) return { klass: null, reason: `class id "${input.classId}" not found` }
  const lower = text.toLowerCase().replace(/\s+/g, ' ')
  const exact = classes.find(klass => klass.name.toLowerCase() === lower || label(klass).toLowerCase() === lower)
  if (exact) return { klass: exact, reason: 'name' }
  const squashed = squash(text)
  const loose = classes.filter(klass => squash(klass.name) === squashed || squash(label(klass)) === squashed)
  if (loose.length === 1) return { klass: loose[0], reason: 'spelling' }

  const level = levelOf(text)
  if (!level) return { klass: null, reason: `class "${text}" not recognised` }
  const sameLevel = classes.filter(klass => levelOf(label(klass))?.rank === level.rank)
  if (sameLevel.length === 1) return { klass: sameLevel[0], reason: 'level' }
  if (!sameLevel.length) return { klass: null, reason: `no class at ${level.label} for "${text}"` }
  // Several arms at this level: the one whose distinguishing words the sheet uses.
  const given = new Set(words(text))
  const common = new Set(words(label(sameLevel[0])).filter(word => sameLevel.every(klass => words(label(klass)).includes(word))))
  const scored = sameLevel.map(klass => ({ klass, hits: words(label(klass)).filter(word => !common.has(word) && given.has(word)).length }))
  const best = Math.max(...scored.map(item => item.hits))
  const winners = scored.filter(item => item.hits === best)
  if (best > 0 && winners.length === 1) return { klass: winners[0].klass, reason: 'level and arm' }
  return { klass: null, reason: `"${text}" could be ${sameLevel.map(label).join(' or ')}` }
}
