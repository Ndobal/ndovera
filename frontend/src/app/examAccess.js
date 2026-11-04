// Who may build an exam: the same roles the server accepts (LEARNING_AUTHOR_ROLES in the worker).
const EXAM_AUTHOR_ROLES = ['teacher', 'classteacher', 'hod', 'hodassistant', 'hos', 'owner', 'ami'];

const roleOf = role => String(role || '').trim().toLowerCase();

export const canBuildExams = role => EXAM_AUTHOR_ROLES.includes(roleOf(role));

/** Students and parents have their own exam pages. Anyone else stays on the general one. */
export function examHomeFor(role) {
  const key = roleOf(role);
  return key === 'student' || key === 'parent' ? `/roles/${key}/exams` : '/exams';
}
