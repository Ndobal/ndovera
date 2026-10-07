import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import PrepareMaterialPanel from './PrepareMaterial';
import * as api from './materialAiApi';

jest.mock('./materialAiApi');

const OPTIONS = {
  success: true, classLevel: { key: 'PRY4', label: 'Primary 4' }, levels: [{ key: 'SS2', label: 'SS 2' }],
  kinds: [{ key: 'study_note', label: 'Student Study Note' }, { key: 'flashcards', label: 'Flashcards' }],
  lengths: { short: 'Short', detailed: 'Detailed', comprehensive: 'Comprehensive' },
  contentOptions: { content: [['explanation', 'Explanation']], visuals: [['images', 'Images / illustrations'], ['graphs', 'Graphs']], assessment: [['practice', 'Practice questions']] },
  kindDefaults: { study_note: ['explanation', 'images', 'graphs', 'practice'], flashcards: [] },
  settings: { tables: true, formulae: true, graphs: true, images: false, maxImages: 0 },
  curricula: [{ id: 'cur-1', name: 'NERDC', owner: 'ndovera' }], exams: [], topics: [],
};

const MISMATCH = {
  success: true,
  resolution: {
    status: 'mismatch', message: 'Curriculum mismatch: "Simultaneous Equations" was not found under Primary 4 Mathematics in the curriculum your school uses. It was found under SS 2.',
    chosenClass: { key: 'PRY4', label: 'Primary 4' }, matches: [{ id: 'ct-ss2', classLabel: 'SS 2', topic: 'Simultaneous Equations', objectives: [] }], match: null,
  },
  exams: [{ key: 'waec', label: 'WAEC (WASSCE)', grounded: true, version: '2025', note: '' }, { key: 'neco', label: 'NECO (SSCE)', grounded: false, version: '', note: '' }],
};

const SECTIONS = [{ key: 'core', title: 'Core Teaching', status: 'done' }, { key: 'practice', title: 'Progressive Practice', status: 'done' }];
const BLOCKS = [
  { type: 'paragraph', section: 'core', text: 'Two equations, two unknowns.' },
  { type: 'formula', section: 'core', latex: 'x+y=5', caption: 'First equation' },
  { type: 'table', section: 'core', caption: 'Values', columns: ['x', 'y'], rows: [['1', '4']] },
  { type: 'question', section: 'practice', style: 'objective', level: 'easy', prompt: 'Solve x + y = 5 and x - y = 1.', options: ['x = 3, y = 2', 'x = 2, y = 3'], answer: 'A. x = 3, y = 2', answerIndex: 0, marks: 1, solution: 'Add the equations.', markingGuide: [] },
];
const DRAFT = {
  id: 'mad_1', topic: 'Simultaneous Equations', className: 'Primary 4', subjectName: 'Mathematics', status: 'generating',
  grounding: { curriculum: [{ classLabel: 'SS 2', curriculumName: 'NERDC' }], exams: [{ key: 'waec', label: 'WAEC (WASSCE)' }], customExam: '' },
  sections: SECTIONS.map(section => ({ ...section, status: 'pending' })), blocks: [], validation: null, review: null,
};
const READY = { ...DRAFT, status: 'ready', sections: SECTIONS, blocks: BLOCKS, validation: { ok: true, checks: [{ key: 'curriculum', label: 'Curriculum objectives', status: 'pass', detail: 'All covered.' }], coverage: [] } };

beforeEach(() => {
  api.listMaterialDrafts.mockResolvedValue({ drafts: [] });
  api.getMaterialAiOptions.mockResolvedValue(OPTIONS);
  api.resolveCurriculum.mockResolvedValue(MISMATCH);
  api.createMaterialDraft.mockResolvedValue({ draft: DRAFT });
  api.generateNextSection
    .mockResolvedValueOnce({ draft: { ...DRAFT, sections: [SECTIONS[0], { ...SECTIONS[1], status: 'pending' }], blocks: BLOCKS.slice(0, 3) }, done: false })
    .mockResolvedValueOnce({ draft: READY, done: true });
  api.saveDraftBlocks.mockImplementation((id, blocks) => Promise.resolve({ draft: { ...READY, blocks } }));
  api.publishDraft.mockResolvedValue({ material: { id: 'm-1', title: 'Simultaneous Equations — Student Study Note' } });
});

test('a Primary 4 teacher is warned of a curriculum mismatch, chooses, prepares for WAEC, reviews and publishes', async () => {
  const onPublished = jest.fn();
  render(<PrepareMaterialPanel classId="p4" subjects={[{ id: 'math', name: 'Mathematics' }]} defaultSubjectId="math" onPublished={onPublished} />);
  fireEvent.click(screen.getByRole('button', { name: /Prepare with Ndovera AI/ }));
  const dialog = await screen.findByRole('dialog');
  await within(dialog).findByRole('button', { name: 'Student Study Note' });
  fireEvent.change(within(dialog).getByPlaceholderText('e.g. Quadratic Equations'), { target: { value: 'Simultaneous Equations' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Check the curriculum' }));

  expect(await within(dialog).findByText('Curriculum mismatch detected')).toBeTruthy();
  expect(within(dialog).getByRole('button', { name: 'Keep Primary 4' })).toBeTruthy();
  expect(within(dialog).getByRole('button', { name: 'Choose another topic' })).toBeTruthy();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Use SS 2 curriculum objectives' }));

  // Examinations: a specification on file, or labelled as unverified.
  expect(within(dialog).getByText('Spec 2025')).toBeTruthy();
  expect(within(dialog).getByText('No spec on file')).toBeTruthy();
  fireEvent.click(within(dialog).getByLabelText(/WAEC \(WASSCE\)/));
  // Illustrations are switched off by the school, so they cannot be ticked.
  fireEvent.click(within(dialog).getByRole('button', { name: 'Advanced settings' }));
  expect(within(dialog).getByLabelText(/Images \/ illustrations/).disabled).toBe(true);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Generate with Ndovera AI' }));

  await waitFor(() => expect(api.createMaterialDraft).toHaveBeenCalled());
  expect(api.createMaterialDraft.mock.calls[0][0]).toMatchObject({
    classId: 'p4', subjectId: 'math', topic: 'Simultaneous Equations', kind: 'study_note', exams: ['waec'], curriculumTopicIds: ['ct-ss2'], levelDecision: 'use_found',
    options: ['explanation', 'graphs', 'practice'],
  });

  // Written section by section, then drawn natively.
  expect(await within(dialog).findByText('All covered.', {}, { timeout: 3000 })).toBeTruthy();
  expect(api.generateNextSection).toHaveBeenCalledTimes(2);
  expect(dialog.querySelector('.katex')).toBeTruthy();
  expect(within(dialog).getByRole('columnheader', { name: 'x' })).toBeTruthy();
  expect(within(dialog).getByText(/WAEC-style Practice Question/)).toBeTruthy();
  expect(within(dialog).queryByText('Add the equations.')).toBeNull();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Show answer' }));
  expect(within(dialog).getByText('Add the equations.')).toBeTruthy();

  // Edit a block, then publish: the edit is saved first.
  fireEvent.click(within(dialog).getAllByRole('button', { name: 'Edit' })[0]);
  fireEvent.change(within(dialog).getByLabelText('Text'), { target: { value: 'Two equations with two unknowns, solved together.' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Publish to students' }));
  await waitFor(() => expect(api.publishDraft).toHaveBeenCalledWith('mad_1', expect.objectContaining({ status: 'published', acknowledgeChecks: false })));
  expect(api.saveDraftBlocks.mock.calls[0][1][0].text).toBe('Two equations with two unknowns, solved together.');
  await waitFor(() => expect(onPublished).toHaveBeenCalled());
  expect(screen.getByText(/is published to students/)).toBeTruthy();
});

test('when checks fail the teacher must confirm they reviewed it', async () => {
  api.createMaterialDraft.mockResolvedValue({ draft: READY });
  const failure = Object.assign(new Error('Some checks failed.'), { data: { needsAcknowledgement: true } });
  api.publishDraft.mockRejectedValueOnce(failure).mockResolvedValueOnce({ material: { id: 'm-2', title: 'T' } });
  api.listMaterialDrafts.mockResolvedValue({ drafts: [{ id: 'mad_1', topic: 'Simultaneous Equations', kindLabel: 'Student Study Note', status: 'ready' }] });
  api.getMaterialDraft.mockResolvedValue({ draft: READY });
  render(<PrepareMaterialPanel classId="p4" subjects={[{ id: 'math', name: 'Mathematics' }]} />);
  fireEvent.click(await screen.findByRole('button', { name: /Continue: Simultaneous Equations/ }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(await within(dialog).findByRole('button', { name: 'Publish to students' }));
  fireEvent.click(await within(dialog).findByRole('button', { name: /I have reviewed it/ }));
  await waitFor(() => expect(api.publishDraft).toHaveBeenLastCalledWith('mad_1', expect.objectContaining({ acknowledgeChecks: true })));
});
