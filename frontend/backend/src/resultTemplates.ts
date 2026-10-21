// Report-card templates beyond the original three: Nursery and Primary progress reports (two A4
// pages each), chosen per section and per term. Page 2 (the Nursery skills checklist or the
// Primary performance-level rating) is the school's own to edit: title, sections and items.
// Third-term layouts are cumulative: each subject shows the 1st- and 2nd-term totals and the
// session average. Nothing here changes a school's existing template or scores.

export type Page2Item = { key: string, label: string }
export type Page2Section = { key: string, title: string, items: Page2Item[] }
export type Page2 = { enabled: boolean, title: string, mode: 'checklist' | 'rating', scale: Array<{ value: string, label: string }>, sections: Page2Section[] }

export const TERM_SLOTS = ['first', 'second', 'third'] as const
export type TermSlot = typeof TERM_SLOTS[number]

const slug = (text: string, fallback: string) => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) || fallback

const items = (labels: string[]) => labels.map((label, index) => ({ key: `${slug(label, 'item')}_${index + 1}`.slice(0, 56), label }))

export const NURSERY_CHECKLIST: Page2 = {
  enabled: true,
  title: 'Progress Report Sheet',
  mode: 'checklist',
  scale: [{ value: 'not_yet', label: 'Not yet' }, { value: 'progressing', label: 'Progressing' }, { value: 'yes', label: 'Yes' }],
  sections: [
    { key: 'language', title: 'Language Skills', items: items(['Speaks clearly', 'Demonstrates age-appropriate language', 'Vocabulary development', 'Shares orally with teacher', 'Follows oral directions', 'Shares information in class discussions', 'Listens to stories', 'Listens when others speak']) },
    { key: 'fine_motor', title: 'Fine Motor Skills', items: items(['Writes with hand', 'Holds crayon easily with good grip', 'Recognition of pictures', 'Cuts with scissors', 'Completes puzzle', 'Identifies numerals', 'Matches numerals to set', 'Knowledge of up, down, in, out, right, left']) },
    { key: 'gross_motor', title: 'Gross Motor Skills', items: items(['Walks in straight line', 'Jumps up and down on both feet', 'Hops on either foot']) },
    { key: 'social', title: 'Social / Emotional Skills', items: items(['Separates easily from parents', 'Maintains independent interest in activities', 'Plays often', 'Interacts with peers', 'Interacts with adults', 'Asks for help or guidance', 'Puts toys away', 'Follows classroom rules', 'Adjusts to new situations']) },
    { key: 'cognitive', title: 'Cognitive Skills', items: items(['Can say name', 'Recognizes written name', 'Can print name', 'Knows personal information', 'Identifies upper case letters A-Z', 'Identifies lowercase letters a-z', 'Identifies knowledge of body parts', 'Identifies colours', 'Points and names shapes']) },
    { key: 'hygiene', title: 'Hygiene / Self Help', items: items(['Washes hands', 'Hangs up lunch box/bag', 'Takes care of own toileting', 'Understands toilet training', 'Shows responsibility for belongings', 'Can serve own snacks', 'Pours own drinks']) },
    { key: 'rhythm', title: 'Rhythm and Music', items: items(['Claps to rhythm', 'Sings willingly']) },
  ],
}

export const PRIMARY_RATING: Page2 = {
  enabled: true,
  title: 'Performance Level Rating',
  mode: 'rating',
  scale: [{ value: '5', label: 'Excellent' }, { value: '4', label: 'Good' }, { value: '3', label: 'Acceptable level' }, { value: '2', label: 'Below acceptable level' }, { value: '1', label: 'Poor' }],
  sections: [
    { key: 'language', title: 'A. (Cognitive) Language Skills', items: items(['Can read simple story books', 'Can read high grade level story books', 'Understands punctuation signs', 'Uses sound and letter to decode new words', 'Reads and understands comprehension passages', 'Reads familiar text fluently observing the pitch bends']) },
    { key: 'mathematics', title: 'Mathematics Skills', items: items(['Uses mathematical language and symbols', 'Understands geometry (2D and 3D shapes)', 'Understands and solves word problem questions', 'Identifies, describes and interprets pictorial charts', 'Uses thinking skill to create and continue patterns', 'Uses developing mathematical ideas and methods to solve practical problems']) },
    { key: 'personal', title: 'B. Personal, Social and Emotional Development', items: items(['Has interest, excitement and motivation to learn', 'Confidence in trying out new activities and initiating new ideas', 'Maintains attention and concentration and sits quietly', 'Awareness of his/her needs, views and feelings', 'Sensitive to the needs, views and feelings of others']) },
    { key: 'creative', title: 'C. Creative Development', items: items(['Explores colour, texture and shapes', 'Finds out about his/her environment and talks about features he/she likes and dislikes', 'Expresses feelings about a significant personal event', 'Responds to sounds with body movement', 'Uses his/her imagination in art and design, music, dance and role play']) },
  ],
}

export type TemplateLayout = { family: 'progress', level: 'nursery' | 'primary' | 'secondary', cumulative: boolean, title: string, page2: Page2 | null }

/** The extra templates, offered to every school beside the original three. */
export const PROGRESS_TEMPLATES: Array<{ key: string, name: string, description: string, sections: string[], terms: TermSlot[], layout: TemplateLayout, preview: { mood: string, strengths: string[] } }> = [
  {
    key: 'nursery-progress-term', name: 'Nursery Progress Report (1st & 2nd term)', sections: ['nursery'], terms: ['first', 'second'],
    description: 'Two A4 pages: each C.A., examination, total, class highest/lowest/average, grade and remark; behaviour ticks 5–1; physical development; page 2 skills checklist (Not yet / Progressing / Yes).',
    layout: { family: 'progress', level: 'nursery', cumulative: false, title: 'End of Term Progress Report', page2: NURSERY_CHECKLIST },
    preview: { mood: 'Early years', strengths: ['Key to grading and ratings', 'Height and weight', 'Skills checklist on page 2'] },
  },
  {
    key: 'nursery-progress-session', name: 'Nursery Progress Report (3rd term, whole session)', sections: ['nursery'], terms: ['third'],
    description: 'Two A4 pages: 1st and 2nd term totals beside this term, the cumulative average per subject, class figures, grade and remark; behaviour ticks; physical development; page 2 skills checklist.',
    layout: { family: 'progress', level: 'nursery', cumulative: true, title: 'End of Term Progress Report', page2: NURSERY_CHECKLIST },
    preview: { mood: 'Early years', strengths: ['Cumulative session average', 'Promotion remark', 'Skills checklist on page 2'] },
  },
  {
    key: 'primary-result-term', name: 'Primary Examination Result (1st & 2nd term)', sections: ['primary'], terms: ['first', 'second'],
    description: 'Two A4 pages: every C.A., examination, total score, class highest/lowest/average, grade and remark; behaviour ticks 5–1; physical development; page 2 performance-level rating (5–1).',
    layout: { family: 'progress', level: 'primary', cumulative: false, title: 'End of Term Examination Result', page2: PRIMARY_RATING },
    preview: { mood: 'Primary', strengths: ['Four C.A. columns', 'Class figures per subject', 'Skills rating on page 2'] },
  },
  {
    key: 'primary-result-session', name: 'Primary Examination Result (3rd term, whole session)', sections: ['primary'], terms: ['third'],
    description: 'Two A4 pages: 1st and 2nd term totals, 3rd term C.A., examination and total, the session total score per subject, class figures, grade and remark; page 2 performance-level rating.',
    layout: { family: 'progress', level: 'primary', cumulative: true, title: 'End of Term Examination Result', page2: PRIMARY_RATING },
    preview: { mood: 'Primary', strengths: ['Session total per subject', 'Promotion remark', 'Skills rating on page 2'] },
  },
  {
    key: 'secondary-report-term', name: 'Secondary Academic Report (1st & 2nd term)', sections: ['secondary'], terms: ['first', 'second'],
    description: 'One A4 page: each C.A., C.A. total, examination, total, grade, position, class lowest/highest/average and comment; psychomotor and affective domain ratings with the scale; next term date and comments.',
    layout: { family: 'progress', level: 'secondary', cumulative: false, title: 'Academic Report', page2: null },
    preview: { mood: 'Secondary', strengths: ['Position per subject', 'Psychomotor and affective ratings', 'Summary box'] },
  },
  {
    key: 'secondary-report-session', name: 'Secondary Academic Report (3rd term, whole session)', sections: ['secondary'], terms: ['third'],
    description: 'One A4 page: 1st and 2nd term totals, this term\'s C.A., examination and total, the session average per subject with grade, position and class figures; psychomotor and affective ratings.',
    layout: { family: 'progress', level: 'secondary', cumulative: true, title: 'Academic Report', page2: null },
    preview: { mood: 'Secondary', strengths: ['Cumulative session average', 'Position per subject', 'Promotion comment'] },
  },
]

export const progressTemplate = (key: string) => PROGRESS_TEMPLATES.find(template => template.key === key) || null

/** Which term a name is: "First Term", "1st term", "Term 2", "THIRD TERM" … ('' when unknown). */
export function termSlotOf(termName: unknown): TermSlot | '' {
  const text = String(termName || '').toLowerCase()
  if (/\b(first|1st)\b|term\s*1\b|\b1\s*term/.test(text)) return 'first'
  if (/\b(second|2nd)\b|term\s*2\b|\b2\s*term/.test(text)) return 'second'
  if (/\b(third|3rd)\b|term\s*3\b|\b3\s*term/.test(text)) return 'third'
  return ''
}

/** Per-term template choice: { first, second, third } of known keys (others dropped). */
export function normalizeTermTemplates(value: unknown, knownKeys: Set<string>) {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const out: Partial<Record<TermSlot, string>> = {}
  for (const slot of TERM_SLOTS) {
    const key = String(source[slot] || '').trim()
    if (key && knownKeys.has(key)) out[slot] = key
  }
  return out
}

/**
 * Every school's default report card per section and term (Ndovera's choice), until Ndovera or
 * the school picks another for that term in result settings.
 */
export const DEFAULT_TERM_TEMPLATES: Record<string, Record<TermSlot, string>> = {
  nursery: { first: 'nursery-progress-term', second: 'nursery-progress-term', third: 'nursery-progress-session' },
  primary: { first: 'primary-result-term', second: 'primary-result-term', third: 'primary-result-session' },
  secondary: { first: 'secondary-report-term', second: 'secondary-report-term', third: 'secondary-report-session' },
}

/** The default template for a section and term ('' when there is none, e.g. school-wide settings). */
export function defaultTemplateFor(section: unknown, termName: unknown = 'first') {
  const slot = termSlotOf(termName) || 'first'
  return DEFAULT_TERM_TEMPLATES[String(section || '').toLowerCase()]?.[slot] || ''
}

/** The template a term's results use: the term's own choice, else the section default, else the section's template. */
export function templateForTerm(settings: Record<string, any> | null | undefined, termName: unknown) {
  const slot = termSlotOf(termName)
  const chosen = slot ? String(settings?.metadata?.termTemplates?.[slot] || '') : ''
  return chosen || (slot ? defaultTemplateFor(settings?.section, termName) : '') || String(settings?.templateKey || '')
}

const clean = (value: unknown, max: number) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

/** A school's page 2 (title, mode, scale, sections and items), within sensible limits. */
export function normalizePage2(value: unknown, fallback: Page2 | null = null): Page2 | null {
  if (!value || typeof value !== 'object') return fallback
  const source = value as Record<string, any>
  const mode = source.mode === 'rating' ? 'rating' : 'checklist'
  const defaults = mode === 'rating' ? PRIMARY_RATING : NURSERY_CHECKLIST
  const scale = (Array.isArray(source.scale) ? source.scale : defaults.scale)
    .map((entry: any) => ({ value: clean(entry?.value, 20), label: clean(entry?.label, 40) }))
    .filter((entry: any) => entry.value && entry.label).slice(0, 6)
  const usedSections = new Set<string>()
  const sections = (Array.isArray(source.sections) ? source.sections : []).slice(0, 12).map((section: any, sectionIndex: number) => {
    let key = slug(section?.key || section?.title, `section_${sectionIndex + 1}`)
    while (usedSections.has(key)) key = `${key}_${sectionIndex + 1}`
    usedSections.add(key)
    const usedItems = new Set<string>()
    const list = (Array.isArray(section?.items) ? section.items : []).slice(0, 30).map((item: any, itemIndex: number) => {
      const label = clean(typeof item === 'string' ? item : item?.label, 160)
      let itemKey = slug(typeof item === 'object' && item?.key ? item.key : `${label}_${itemIndex + 1}`, `item_${itemIndex + 1}`)
      while (usedItems.has(itemKey)) itemKey = `${itemKey}_${itemIndex + 1}`
      usedItems.add(itemKey)
      return { key: itemKey, label }
    }).filter((item: Page2Item) => item.label)
    return { key, title: clean(section?.title, 120) || `Section ${sectionIndex + 1}`, items: list }
  }).filter((section: Page2Section) => section.items.length)
  return { enabled: source.enabled !== false, title: clean(source.title, 80) || defaults.title, mode, scale: scale.length ? scale : defaults.scale, sections }
}

/** The page 2 a set of settings uses for a term: the school's own, else the template's default. */
export function page2For(settings: Record<string, any> | null | undefined, templateKey: string): Page2 | null {
  const own = normalizePage2(settings?.metadata?.page2, null)
  if (own && own.sections.length) return own.enabled ? own : null
  return progressTemplate(templateKey)?.layout.page2 || null
}

/** A student's report-card extras: physical development, attendance figures and page-2 answers. */
export function normalizeProfileExtra(value: unknown, allowedPage2Keys: Set<string> | null = null) {
  const source = value && typeof value === 'object' ? value as Record<string, any> : {}
  const out: Record<string, any> = {}
  for (const key of ['heightStart', 'heightEnd', 'weightStart', 'weightEnd', 'timesOpened', 'daysPresent', 'daysAbsent', 'age']) {
    const text = clean(source[key], 16)
    if (text) out[key] = text
  }
  const resumption = clean(source.resumptionDate, 40)
  if (resumption) out.resumptionDate = resumption
  const answers = source.page2 && typeof source.page2 === 'object' ? source.page2 as Record<string, unknown> : {}
  const page2: Record<string, string> = {}
  for (const [key, answer] of Object.entries(answers).slice(0, 300)) {
    if (allowedPage2Keys && !allowedPage2Keys.has(key)) continue
    const text = clean(answer, 20)
    if (text) page2[key] = text
  }
  if (Object.keys(page2).length) out.page2 = page2
  return out
}

/**
 * The 1st- and 2nd-term totals of each student's subjects in the same session, for the
 * whole-session (3rd term) layouts: Map<studentId, Map<subjectName (lower), { first?, second? }>>.
 */
export async function loadEarlierTermTotals(db: D1Database, tenantId: string, sessionName: string, termName: string, studentIds: string[]) {
  const totals = new Map<string, Map<string, Partial<Record<TermSlot, number>>>>()
  const current = termSlotOf(termName)
  const ids = [...new Set(studentIds.filter(Boolean))]
  for (let start = 0; start < ids.length; start += 80) {
    const chunk = ids.slice(start, start + 80)
    const rows = ((await db.prepare(`SELECT e.student_id, e.subject_name, e.ca_score, e.exam_score, b.term_name FROM result_ca_entries e JOIN result_batches b ON b.id = e.batch_id
      WHERE b.tenant_id = ? AND b.session_name = ? AND b.term_name != ? AND e.student_id IN (${chunk.map(() => '?').join(',')})`)
      .bind(tenantId, sessionName, termName, ...chunk).all().catch(() => ({ results: [] }))).results || []) as Record<string, any>[]
    for (const row of rows) {
      const slot = termSlotOf(row.term_name)
      if (!slot || slot === current || slot === 'third') continue
      const student = totals.get(String(row.student_id)) || new Map()
      const subject = String(row.subject_name || '').trim().toLowerCase()
      const entry = student.get(subject) || {}
      entry[slot] = Math.min(100, Math.round((Number(row.ca_score || 0) + Number(row.exam_score || 0)) * 100) / 100)
      student.set(subject, entry)
      totals.set(String(row.student_id), student)
    }
  }
  return totals
}

/** Grading used on these report cards (only offered, never forced on a school). */
export const PROGRESS_GRADING_SCALE = [
  { minScore: 90, grade: 'A', remark: 'Distinction' },
  { minScore: 80, grade: 'B+', remark: 'V. Good' },
  { minScore: 70, grade: 'B', remark: 'Good' },
  { minScore: 60, grade: 'C+', remark: 'Pass' },
  { minScore: 50, grade: 'C', remark: 'Average' },
  { minScore: 40, grade: 'D', remark: 'Weak' },
  { minScore: 0, grade: 'E', remark: 'V. Weak' },
]
