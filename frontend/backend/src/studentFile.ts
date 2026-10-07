// The Digital Student File: who may see and add what.
//
// One file per student, opened from their name anywhere in Ndovera. Every tab
// must be usable: if a viewer can see a tab they get its data, and if they may
// add to it they get the means to. Teachers see what their teaching needs;
// leadership, the accountant, the clinic, parents and the student themselves
// each see their own slice. Visibility is decided per record category, so a
// health note never reaches a subject teacher and a staff note never reaches a parent.

export type StudentRelation = 'self' | 'parent' | 'owner_hos' | 'management' | 'accountant' | 'clinic' | 'classteacher' | 'teacher' | 'none'

// School leadership below Owner/HOS: sees the academic and pastoral file, not fees.
export const STUDENT_MANAGEMENT_ROLES = ['ict', 'ict_manager', 'admin', 'principal', 'viceprincipal', 'headteacher', 'nurseryhead', 'examofficer', 'hod', 'hodassistant']

export const STUDENT_FILE_CATEGORIES = {
  behaviour: ['behaviour'],
  disciplinary: ['punishment', 'disciplinary'],
  reports: ['report', 'comment', 'recommendation'],
  health: ['health'],
  documents: ['document'],
  awards: ['reward', 'scholarship', 'competition'],
  notes: ['note'],
  activities: ['activity'],
} as const
export type StudentFileGroup = keyof typeof STUDENT_FILE_CATEGORIES
export const ALL_STUDENT_RECORD_CATEGORIES = [...new Set(Object.values(STUDENT_FILE_CATEGORIES).flat())] as string[]

export function relationFor(options: {
  role: string, isSelf: boolean, isLinkedParent: boolean, isClassTeacher: boolean, teachesClass: boolean,
}): StudentRelation {
  if (options.isSelf) return 'self'
  if (options.role === 'parent') return options.isLinkedParent ? 'parent' : 'none'
  if (['owner', 'hos'].includes(options.role)) return 'owner_hos'
  if (STUDENT_MANAGEMENT_ROLES.includes(options.role)) return 'management'
  if (options.role === 'accountant') return 'accountant'
  if (options.role === 'clinic') return 'clinic'
  if (options.isClassTeacher) return 'classteacher'
  if (['teacher', 'classteacher'].includes(options.role) && options.teachesClass) return 'teacher'
  return 'none'
}

type Access = { view: boolean, add: boolean }
const A = (view: boolean, add = false): Access => ({ view, add })

/** What each relation may see and add, tab by tab. */
export function studentFileAccess(relation: StudentRelation) {
  const leadership = relation === 'owner_hos' || relation === 'management'
  const teaching = relation === 'classteacher' || relation === 'teacher'
  const staffRecorder = leadership || teaching
  const family = relation === 'self' || relation === 'parent'
  const finance = relation === 'owner_hos' || relation === 'accountant' || family
  const groups: Record<StudentFileGroup, Access> = {
    behaviour: A(staffRecorder || family, staffRecorder),
    disciplinary: A(staffRecorder || family, staffRecorder),
    reports: A(staffRecorder || family, staffRecorder),
    health: A(leadership || relation === 'clinic' || relation === 'classteacher' || family, leadership || relation === 'clinic' || relation === 'classteacher'),
    documents: A(leadership || relation === 'classteacher' || relation === 'accountant' || family, leadership),
    awards: A(staffRecorder || family || relation === 'clinic', staffRecorder),
    notes: A(staffRecorder || relation === 'clinic', staffRecorder || relation === 'clinic'),
    activities: A(staffRecorder || family, staffRecorder),
  }
  return {
    relation,
    view: relation !== 'none',
    personal: A(relation !== 'none', leadership),
    guardians: A(leadership || relation === 'classteacher' || relation === 'accountant' || relation === 'clinic' || family, leadership),
    academic: A(relation !== 'none' && relation !== 'accountant'),
    results: A(relation !== 'none' && relation !== 'accountant' && relation !== 'clinic'),
    attendance: A(relation !== 'none' && relation !== 'accountant'),
    fees: A(finance),
    recordPayment: relation === 'owner_hos' || relation === 'accountant',
    aiReport: A(staffRecorder),
    deleteRecords: relation === 'owner_hos',
    // Private records: only the student, their parents, the HoS/Owner and the Accountant.
    seePrivate: relation === 'owner_hos' || relation === 'accountant' || family,
    addPrivate: relation === 'owner_hos' || relation === 'accountant',
    groups,
  }
}
export type StudentFileAccess = ReturnType<typeof studentFileAccess>

export function groupOf(category: string): StudentFileGroup | null {
  for (const [group, categories] of Object.entries(STUDENT_FILE_CATEGORIES)) {
    if ((categories as readonly string[]).includes(category)) return group as StudentFileGroup
  }
  return null
}

export function isPrivateRecord(record: { metadata?: Record<string, any> }) {
  return record.metadata?.visibility === 'private'
}

/** Whether this viewer sees this particular record: private ones go only to the private circle. */
export function canSeeRecord(access: StudentFileAccess, record: { category: string, metadata?: Record<string, any> }) {
  if (isPrivateRecord(record)) return access.seePrivate
  return canSeeCategory(access, record.category)
}

export function canSeeCategory(access: StudentFileAccess, category: string) {
  const group = groupOf(category)
  return Boolean(group && access.groups[group].view)
}

export function canAddCategory(access: StudentFileAccess, category: string) {
  const group = groupOf(category)
  return Boolean(group && access.groups[group].add)
}

/** Overview figures, from whatever the viewer may see. */
export function studentOverview(options: {
  latestAverage: number | null, attendanceRate: number | null, outstandingFees: number | null,
  records: Array<{ category: string, metadata?: Record<string, any> }>, assignments: { total: number, completed: number } | null,
}) {
  const behaviour = options.records.filter(record => record.category === 'behaviour')
  const positives = options.records.filter(record => record.category === 'reward').length
  const negatives = options.records.filter(record => ['punishment', 'disciplinary'].includes(record.category)).length
  const latestBehaviour = behaviour[0]?.metadata?.rating as string | undefined
  return {
    academic: options.latestAverage,
    attendance: options.attendanceRate,
    outstandingFees: options.outstandingFees,
    behaviour: latestBehaviour || (negatives > positives + 1 ? 'Needs attention' : negatives ? 'Fair' : 'Good'),
    awards: options.records.filter(record => ['reward', 'scholarship', 'competition'].includes(record.category)).length,
    // A disciplinary case is open until closed; older punishment entries only count if marked open.
    openDisciplinary: options.records.filter(record => (record.category === 'disciplinary' && String(record.metadata?.status || 'open') !== 'closed')
      || (record.category === 'punishment' && record.metadata?.status === 'open')).length,
    assignmentCompletion: options.assignments && options.assignments.total ? Math.round((options.assignments.completed / options.assignments.total) * 100) : null,
  }
}
