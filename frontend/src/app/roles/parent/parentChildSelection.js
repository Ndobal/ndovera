const PARENT_ACTIVE_CHILD_STORAGE_KEY = 'ndovera.parent.activeChildId';

export function readActiveParentChildId() {
  if (typeof window === 'undefined') return '';

  try {
    return String(window.localStorage.getItem(PARENT_ACTIVE_CHILD_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function writeActiveParentChildId(studentId) {
  if (typeof window === 'undefined') return;

  try {
    const normalizedStudentId = String(studentId || '').trim();
    if (!normalizedStudentId) {
      window.localStorage.removeItem(PARENT_ACTIVE_CHILD_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(PARENT_ACTIVE_CHILD_STORAGE_KEY, normalizedStudentId);
  } catch {}
}

export function resolveActiveParentChildId(students = [], preferredStudentId = '') {
  const preferredId = String(preferredStudentId || readActiveParentChildId() || '').trim();
  if (preferredId && students.some(student => String(student?.id || '').trim() === preferredId)) {
    return preferredId;
  }
  return String(students[0]?.id || '').trim();
}