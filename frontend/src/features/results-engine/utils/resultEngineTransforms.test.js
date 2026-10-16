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

test('after the class hand-in only students first scored since then can be edited; the class teacher can correct submitted subjects', () => {
  const data = {
    classroom: { id: 'jss1' },
    settings,
    permissions: { overrideRank: 1 },
    subjects: [{ id: 'm1', name: 'Mathematics' }],
    batch: { status: 'submitted', submittedAt: '2026-10-16T10:00:00.000Z' },
    caSubmissions: [{ subjectId: 'm1', componentKey: 'all', status: 'submitted' }],
    students: [{ id: 's-1', name: 'Ada' }, { id: 's-3', name: 'Chidi' }],
    entries: [{ studentId: 's-1', subjectId: 'm1', subjectName: 'Mathematics', caScore: 30, examScore: 40, updatedAt: '2026-10-16T09:00:00.000Z' }],
  };
  const [ada, chidi] = normalizeTeacherSheetResponse(data).students;
  expect([ada.late, ada.rows[0].editable, ada.rows[0].lockedByHandIn]).toEqual([false, false, true]);
  expect([chidi.late, chidi.rows[0].editable, chidi.rows[0].missing]).toEqual([true, true, true]);
  // Before the hand-in, the class teacher's rows are not frozen by the subject teacher's submission.
  const draft = normalizeTeacherSheetResponse({ ...data, batch: { status: 'draft' } });
  expect(draft.students[0].rows[0].frozenKeys).toEqual([]);
  const subjectTeacher = normalizeTeacherSheetResponse({ ...data, batch: { status: 'draft' }, permissions: { overrideRank: 0 } });
  expect(subjectTeacher.students[0].rows[0].frozenKeys).toEqual(['all']);
  // A typed zero is sent as entered.
  const rows = buildEntryPayload(draft, { studentIds: ['s-3'], touched: new Set(['s-3::m1']) });
  expect(rows).toEqual([expect.objectContaining({ studentId: 's-3', subjectId: 'm1', entered: true })]);
});
