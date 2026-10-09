import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CurriculumLibraryPage from './CurriculumLibraryPage';
import * as api from './materialAiApi';

jest.mock('./materialAiApi');

const CURRICULUM = { id: 'cur1', name: 'NERDC Chemistry', status: 'draft', country: 'Nigeria', topicCount: 0 };
const job = (fields = {}) => ({ id: 'imp1', targetId: 'cur1', targetName: 'NERDC Chemistry', fileName: 'chemistry.pdf', status: 'processing', active: true, percent: 40, added: 3, rejected: 0, error: '', ...fields });

beforeEach(() => {
  jest.useFakeTimers();
  api.listCurricula.mockResolvedValue({ curricula: [CURRICULUM] });
  api.listCurriculumTopics.mockResolvedValue({ topics: [] });
  api.listLibraryImports.mockResolvedValue({ jobs: [] });
  api.libraryImportAction.mockResolvedValue({ job: job() });
  api.importCurriculumPdf.mockResolvedValue({ job: job({ status: 'queued', percent: 0, added: 0 }) });
});
afterEach(() => { jest.useRealTimers(); jest.resetAllMocks(); });

async function openCurriculum() {
  render(<CurriculumLibraryPage scope="ami" />);
  fireEvent.click((await screen.findAllByText(/NERDC Chemistry/))[0]); // the card comes before the import list
  await screen.findByText('Upload the curriculum PDF');
}

test('uploads a curriculum PDF with the subject and class defaults, then shows its progress', async () => {
  await openCurriculum();
  fireEvent.change(screen.getAllByPlaceholderText('Subject, if the text does not say')[1], { target: { value: 'Chemistry' } });
  const file = new File(['%PDF-1.4'], 'chemistry.pdf', { type: 'application/pdf' });
  const input = document.querySelector('input[accept="application/pdf,.pdf"]');
  api.listLibraryImports.mockResolvedValue({ jobs: [job()] });
  fireEvent.change(input, { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: 'Upload and read' }));

  await waitFor(() => expect(api.importCurriculumPdf).toHaveBeenCalledWith('ami', 'cur1', file, { subject: 'Chemistry', classLabel: '' }));
  expect(await screen.findByText(/Reading with Ndovera AI · 40%/)).toBeInTheDocument();
  expect(screen.getByText(/3 row\(s\) added/)).toBeInTheDocument();
});

test('an open page helps the active import along, and refreshes the topics as rows arrive', async () => {
  api.listLibraryImports.mockResolvedValue({ jobs: [job()] });
  await openCurriculum();
  await screen.findByText(/40%/);
  const topicLoads = api.listCurriculumTopics.mock.calls.length;

  api.listLibraryImports.mockResolvedValue({ jobs: [job({ status: 'done', active: false, percent: 100, added: 9 })] });
  await act(async () => { jest.advanceTimersByTime(4000); });

  await waitFor(() => expect(api.libraryImportAction).toHaveBeenCalledWith('imp1', 'step'));
  expect(await screen.findByText('Done')).toBeInTheDocument();
  expect(api.listCurriculumTopics.mock.calls.length).toBeGreaterThan(topicLoads);
});

test('a failed import can be resumed', async () => {
  api.listLibraryImports.mockResolvedValue({ jobs: [job({ status: 'failed', active: false, error: 'This PDF has no readable text.' })] });
  await openCurriculum();
  expect(await screen.findByText(/no readable text/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
  await waitFor(() => expect(api.libraryImportAction).toHaveBeenCalledWith('imp1', 'resume'));
});

test('the curricula list shows every import in progress', async () => {
  api.listLibraryImports.mockResolvedValue({ jobs: [job()] });
  render(<CurriculumLibraryPage scope="ami" />);
  expect(await screen.findByText(/→ NERDC Chemistry/)).toBeInTheDocument();
});
