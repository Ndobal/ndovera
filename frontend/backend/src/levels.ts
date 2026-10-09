// Where a class sits on the school ladder, read from the names schools actually use.
//
//   "Primary 4", "Pry 4", "Basic 4", "Grade 4"      → rank 4, primary
//   "JSS 2", "JS2", "Junior Secondary II", "Basic 8" → rank 8, junior
//   "SS 3", "SSS3", "Senior Secondary 3"             → rank 12, senior
//   "Nursery 1", "KG", "Reception", "Creche"         → ranks −3…0, nursery
//
// Practice uses the ladder: a JSS 3 student practises JSS 1–3 questions, a JSS 2
// student JSS 1–2, always within the student's own section.

export const SECTIONS = [
  { key: 'nursery', label: 'Nursery / Early Years', ranks: [-3, 0] },
  { key: 'primary', label: 'Primary', ranks: [1, 6] },
  { key: 'junior', label: 'Junior Secondary', ranks: [7, 9] },
  { key: 'senior', label: 'Senior Secondary', ranks: [10, 12] },
] as const

export type SectionKey = typeof SECTIONS[number]['key']
export type Level = { rank: number, section: SectionKey, label: string }

const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6 }
const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 }

function numberIn(text: string) {
  const match = text.match(/^\s*[-.:]?\s*(\d{1,2}|i{1,3}|iv|vi?|one|two|three|four|five|six)\b/)
  if (!match) return null
  const token = match[1]
  return /^\d+$/.test(token) ? Number(token) : ROMAN[token] ?? WORDS[token] ?? null
}

export function sectionOfRank(rank: number): SectionKey {
  if (rank <= 0) return 'nursery'
  if (rank <= 6) return 'primary'
  if (rank <= 9) return 'junior'
  return 'senior'
}

export function labelOfRank(rank: number) {
  if (rank <= 0) return ['Creche', 'Pre-Nursery', 'Nursery 1', 'Nursery 2'][rank + 3] || 'Nursery'
  if (rank <= 6) return `Primary ${rank}`
  if (rank <= 9) return `JSS ${rank - 6}`
  return `SS ${rank - 9}`
}

export function normalizeSection(value: unknown): SectionKey | '' {
  const text = String(value || '').trim().toLowerCase()
  if (!text) return ''
  if (/nursery|early|kg|kinder|creche|pre/.test(text)) return 'nursery'
  if (/primary|basic\s*(1|2|3|4|5|6)\b|elementary/.test(text)) return 'primary'
  if (/junior|jss|jhs|\bjs\b/.test(text)) return 'junior'
  if (/senior|sss|shs|\bss\b/.test(text)) return 'senior'
  return ''
}

/** A class name ("JSS 2 Gold", "Primary Four") → its place on the ladder, or null when unknown. */
export function levelOf(name: unknown): Level | null {
  const text = ` ${String(name || '').toLowerCase().replace(/[_/]+/g, ' ').replace(/\s+/g, ' ')} `
  if (!text.trim()) return null
  const make = (rank: number): Level => ({ rank, section: sectionOfRank(rank), label: labelOfRank(rank) })
  const after = (pattern: RegExp) => {
    const match = text.match(pattern)
    return match ? numberIn(text.slice((match.index || 0) + match[0].length)) : null
  }

  if (/\bcreche\b|\bplaygroup\b/.test(text)) return make(-3)
  if (/\bpre[\s-]?nursery\b/.test(text)) return make(-2)
  const nursery = after(/\bnursery\b/)
  if (nursery !== null) return make(nursery >= 2 ? 0 : -1)
  if (/\bnursery\b|\breception\b|\bkg\b|\bkindergarten\b/.test(text)) return make(0)

  const senior = after(/\b(?:s\.?s\.?s|s\.?s|s\.?h\.?s|senior\s+secondary(?:\s+school)?|senior)\s*/)
  if (senior !== null && senior >= 1 && senior <= 3) return make(9 + senior)
  const junior = after(/\b(?:j\.?s\.?s|j\.?s|j\.?h\.?s|junior\s+secondary(?:\s+school)?|junior)\s*/)
  if (junior !== null && junior >= 1 && junior <= 3) return make(6 + junior)
  const basic = after(/\bbasic\s*/)
  if (basic !== null && basic >= 1 && basic <= 9) return make(basic)
  const primary = after(/\b(?:primary|pry|pri|p)\s*/)
  if (primary !== null && primary >= 1 && primary <= 6) return make(primary)
  const grade = after(/\b(?:grade|year|class)\s*/)
  if (grade !== null && grade >= 1 && grade <= 12) return make(grade)
  return null
}

const SUBJECT_ALIASES: Array<[RegExp, string]> = [
  [/^(general\s+)?math(s|ematics)?$|^mathematics\s+\(?general\)?$/, 'mathematics'],
  [/^further\s+math(s|ematics)?$/, 'further-mathematics'],
  [/^english(\s+(language|studies))?$|^use\s+of\s+english$/, 'english'],
  [/^(basic|integrated)\s+science(\s+and\s+technology)?$/, 'basic-science'],
  [/^(civic|civics)(\s+education)?$/, 'civic-education'],
  [/^(c\.?r\.?s|c\.?r\.?k|christian\s+religious\s+(studies|knowledge))$/, 'crs'],
  [/^(i\.?r\.?s|i\.?r\.?k|islamic\s+(religious\s+)?(studies|knowledge))$/, 'irs'],
  [/^(computer(\s+studies|\s+science)?|ict|information\s+(and\s+)?communication\s+technology|data\s+processing)$/, 'computer-studies'],
  [/^(agric|agricultural\s+science|agriculture)$/, 'agricultural-science'],
  [/^(p\.?h\.?e|physical\s+(and\s+)?health\s+education)$/, 'phe'],
  [/^(lit(erature)?(\s+in\s+english)?)$/, 'literature'],
  [/^(quantitative\s+reasoning|quantitative\s+aptitude)$/, 'quantitative-reasoning'],
  [/^(verbal\s+reasoning|verbal\s+aptitude)$/, 'verbal-reasoning'],
]

/** One key for a subject however a school spells it ("Maths" and "General Mathematics" practise together). */
export function subjectKeyOf(name: unknown) {
  const text = String(name || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  for (const [pattern, key] of SUBJECT_ALIASES) if (pattern.test(text)) return key
  return text.replace(/\s+/g, '-')
}
