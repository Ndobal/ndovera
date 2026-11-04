import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AmiMockPapers, { buildPaperPrompt } from './AmiMockPapers';

jest.mock('../../../features/auth/services/authApi', () => ({ getStoredAuth: () => ({ token: 't' }) }));
jest.mock('../../../shared/components/AppDialog', () => ({ askConfirm: jest.fn(() => Promise.resolve(true)) }));

const PAPER = { id: 'p1', examLabel: 'WAEC (WASSCE)', subjectName: 'Mathematics', setLabel: 'Mock 1', objectiveCount: 1, objectiveMinutes: 60, theoryCount: 0, theoryMinutes: 0, status: 'draft',
  objectives: [{ id: 'q1', position: 1, prompt: 'What is 2 + 2?', options: ['3', '4'], answerIndex: 1, explanation: 'Add them.' }], theory: [] };

function respond(routes) {
  global.fetch = jest.fn(async (url, options = {}) => {
    const key = `${options.method || 'GET'} ${String(url).replace(/^.*\/api/, '/api')}`;
    const body = routes[key];
    if (!body) throw new Error(`unexpected ${key}`);
    return { ok: body.success !== false, status: body.success === false ? 400 : 200, json: async () => body };
  });
}

test('the prompt asks for original questions in the form Ndovera reads', () => {
  const waec = buildPaperPrompt({ exam: 'waec', subject: 'Biology', setLabel: 'Mock 2', objectives: 50, theory: 6, objectiveMinutes: 60, theoryMinutes: 120 });
  expect(waec).toMatch(/original WAEC-style practice paper in Biology/);
  expect(waec).toMatch(/Do not copy or closely reword real past questions/);
  expect(waec).toMatch(/50 objective questions, each with 4 options \(A, B, C, D\)/);
  expect(waec).toMatch(/6 theory questions/);
  expect(waec).toMatch(/"setLabel": "Mock 2"/);
  expect(buildPaperPrompt({ exam: 'neco', subject: 'Biology', objectives: 60 })).toMatch(/5 options \(A, B, C, D, E\)/);
  const jamb = buildPaperPrompt({ exam: 'jamb', subject: 'Physics', objectives: 40, theory: 6 });
  expect(waec).toMatch(/add a "diagram" field/);
  expect(waec).not.toMatch(/Do not use diagrams/);
  expect(jamb).toMatch(/Do not write theory questions/);
  expect(jamb).not.toMatch(/modelAnswer/);
});

test('a reply is checked, its problems shown, and it can only be saved once it passes', async () => {
  respond({
    'GET /api/ami/mock-papers': { success: true, papers: [] },
    'POST /api/ami/mock-papers/check': { success: true, problems: ['Objective 1: the question is missing.'], warnings: ['Objective 2 mentions a diagram.'], summary: null },
  });
  render(<AmiMockPapers />);
  await screen.findByText('No mock papers yet.');
  const save = screen.getByRole('button', { name: 'Save as draft' });
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/ChatGPT's reply/), { target: { value: '{"bad":true}' } });
  fireEvent.click(screen.getByRole('button', { name: 'Check paper' }));
  expect(await screen.findByText('Objective 1: the question is missing.')).toBeInTheDocument();
  expect(screen.getByText('Objective 2 mentions a diagram.')).toBeInTheDocument();
  expect(save).toBeDisabled();
});

test('a paper needing a diagram cannot be published until it is attached', async () => {
  const needing = { ...PAPER, diagramsMissing: 1, objectives: [{ ...PAPER.objectives[0], diagram: 'A leaf, parts labelled I to IV.', imageUrl: '' }] };
  const attached = { ...needing, diagramsMissing: 0, objectives: [{ ...needing.objectives[0], imageUrl: '/files/mock-papers/p1/d.png' }] };
  respond({ 'GET /api/ami/mock-papers': { success: true, papers: [needing] }, 'GET /api/ami/mock-papers/p1': { success: true, paper: needing }, 'POST /api/ami/mock-papers/p1/questions/q1/diagram': { success: true, paper: attached } });
  render(<AmiMockPapers />);
  expect(await screen.findByRole('button', { name: 'Publish' })).toBeDisabled();
  expect(screen.getByText(/1 diagram to attach/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Read' }));
  expect(await screen.findByText('A leaf, parts labelled I to IV.')).toBeInTheDocument();
  expect(screen.getByText('Diagram not attached yet')).toBeInTheDocument();

  respond({ 'GET /api/ami/mock-papers': { success: true, papers: [attached] }, 'POST /api/ami/mock-papers/p1/questions/q1/diagram': { success: true, paper: attached } });
  fireEvent.change(screen.getByLabelText('Attach diagram for Objective 1'), { target: { files: [new File(['x'], 'leaf.png', { type: 'image/png' })] } });
  expect(await screen.findByAltText('Diagram for Objective 1')).toHaveAttribute('src', '/files/mock-papers/p1/d.png');
  const [, sent] = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/diagram'));
  expect(sent.body).toBeInstanceOf(FormData);
  expect(sent.headers['Content-Type']).toBeUndefined();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled());
});

test('the question bundle goes in a few at a time, and papers already there are skipped', async () => {
  const objectives = Array.from({ length: 45 }, (_, index) => ({ id: `q${index}` }));
  const bundle = { objectives, papers: [{ setLabel: 'Theory set 1' }, { setLabel: 'Theory set 2' }] };
  let saved = 0;
  global.fetch = jest.fn(async (url, options = {}) => {
    const path = String(url);
    if (path.endsWith('/import-objectives')) return { ok: true, status: 200, json: async () => ({ success: true, added: JSON.parse(options.body).questions.length }) };
    if (options.method === 'POST') { saved += 1; return saved === 1 ? { ok: true, status: 200, json: async () => ({ success: true, paper: {} }) } : { ok: false, status: 409, json: async () => ({ success: false, message: 'WAEC Economics already has a paper called "Theory set 2".' }) }; }
    return { ok: true, status: 200, json: async () => ({ success: true, papers: [] }) };
  });
  render(<AmiMockPapers />);
  await screen.findByText('No mock papers yet.');
  const file = new File([JSON.stringify(bundle)], 'bundle.json', { type: 'application/json' });
  file.text = async () => JSON.stringify(bundle);
  fireEvent.change(screen.getByLabelText('Bundle file'), { target: { files: [file] } });
  expect(await screen.findByText(/Done: 45 new objective questions.*1 new draft theory papers/)).toBeInTheDocument();
  const batches = global.fetch.mock.calls.filter(([url]) => String(url).endsWith('/import-objectives')).map(([, options]) => JSON.parse(options.body).questions.length);
  expect(batches).toEqual([20, 20, 5]);
});

test('a stopped import says so and can be run again', async () => {
  global.fetch = jest.fn(async (url) => (String(url).endsWith('/import-objectives')
    ? { ok: false, status: 503, json: async () => ({ success: false, message: 'Busy.' }) }
    : { ok: true, status: 200, json: async () => ({ success: true, papers: [] }) }));
  render(<AmiMockPapers />);
  await screen.findByText('No mock papers yet.');
  const file = new File(['x'], 'bundle.json');
  file.text = async () => JSON.stringify({ objectives: [{ id: 'a' }], papers: [] });
  fireEvent.change(screen.getByLabelText('Bundle file'), { target: { files: [file] } });
  expect(await screen.findByRole('alert')).toHaveTextContent(/Stopped: Busy\. Nothing is lost/);
});

test('a good paper is saved as a draft, read through, then published', async () => {
  respond({
    'GET /api/ami/mock-papers': { success: true, papers: [] },
    'POST /api/ami/mock-papers/check': { success: true, problems: [], warnings: [], summary: { subjectName: 'Mathematics', setLabel: 'Mock 1', objectives: 1, theory: 0 } },
    'POST /api/ami/mock-papers': { success: true, paper: PAPER, warnings: [] },
    'POST /api/ami/mock-papers/p1/status': { success: true, paper: { ...PAPER, status: 'published' } },
  });
  render(<AmiMockPapers />);
  fireEvent.change(screen.getByLabelText(/ChatGPT's reply/), { target: { value: '{}' } });
  fireEvent.click(screen.getByRole('button', { name: 'Check paper' }));
  await screen.findByText(/Ready: Mathematics/);

  respond({
    'GET /api/ami/mock-papers': { success: true, papers: [PAPER] },
    'POST /api/ami/mock-papers': { success: true, paper: PAPER, warnings: [] },
    'POST /api/ami/mock-papers/p1/status': { success: true, paper: { ...PAPER, status: 'published' } },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }));
  expect(await screen.findByText(/Read it through below/)).toBeInTheDocument();
  expect(await screen.findByText('1. What is 2 + 2?')).toBeInTheDocument();
  expect(screen.getByText('4 ✓')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/ami/mock-papers/p1/status'), expect.objectContaining({ method: 'POST', body: JSON.stringify({ status: 'published' }) })));
  expect(await screen.findByText(/join tonight's quality check/)).toBeInTheDocument();
});
