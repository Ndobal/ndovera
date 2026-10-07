import { buildEntryPayload, normalizeTeacherSheetResponse } from './resultEngineTransforms';

const settings = {
  gradingScale: [{ minScore: 70, grade: 'A' }, { minScore: 0, grade: 'F' }],
  metadata: { caMaxScore: 40, examMaxScore: 60, caComponents: [{ key: 'ca1', label: 'CA 1', maxScore: 20 }, { key: 'ca2', label: 'CA 2', maxScore: 20 }] },
};

test('a subject teacher gets an empty row to fill for each of their subjects before any score exists', () => {
  const sheet = normalizeTeacherSheetResponse({
    classroom: { id: 'ss2a' },
    settings,
    permissions: { overrideRank: 0 },
    subjects: [{ id: 'phy', name: 'Physics' }],
    exclusions: { phy: ['s-2'] },
    students: [{ id: 's-1', name: 'Ada' }, { id: 's-2', name: 'Bola' }],
    entries: [{ studentId: 's-1', subjectId: 'math', subjectName: 'Mathematics', caScore: 30, examScore: 40 }],
  });
  const [ada, bola] = sheet.students;
  expect(ada.rows.map(row => [row.subjectName, row.editable])).toEqual([['Mathematics', false], ['Physics', true]]);
  expect(bola.rows).toEqual([]);
  expect(buildEntryPayload(sheet).map(row => [row.studentId, row.subjectId])).toEqual([['s-1', 'phy']]);
});

test('a row overridden from higher up is read-only and carries who overrode it', () => {
  const sheet = normalizeTeacherSheetResponse({
    classroom: { id: 'ss2a' },
    settings,
    permissions: { overrideRank: 1 },
    subjects: [{ id: 'phy', name: 'Physics' }],
    students: [{ id: 's-1', name: 'Ada' }],
    entries: [{ studentId: 's-1', subjectId: 'phy', subjectName: 'Physics', caScore: 30, examScore: 40, overrideRank: 2, overrideName: 'Mrs Bello' }],
  });
  const [row] = sheet.students[0].rows;
  expect(row.editable).toBe(false);
  expect(row.heldAbove).toBe(true);
  expect(row.override).toMatchObject({ rank: 2, name: 'Mrs Bello' });
  expect(buildEntryPayload(sheet)).toEqual([]);
});
