import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HealthReportPage from './HealthReportPage';
import { listHealthIncidents, reportIncident, searchHealthStudents, uploadHealthPhoto } from './healthApi';

jest.mock('./healthApi', () => ({
  listHealthIncidents: jest.fn(), reportIncident: jest.fn(), searchHealthStudents: jest.fn(), uploadHealthPhoto: jest.fn(), loadHealthPhoto: jest.fn(() => Promise.resolve('blob:x')),
}));

beforeEach(() => {
  jest.clearAllMocks();
  listHealthIncidents.mockResolvedValue({ incidents: [] });
  searchHealthStudents.mockResolvedValue({ students: [{ id: 'ada', name: 'Ada Obi', className: 'JSS 1A' }] });
  reportIncident.mockResolvedValue({ id: 'h1' });
  uploadHealthPhoto.mockResolvedValue({ photo: { id: 'p1' } });
});

test('a teacher reports first aid for a child, with a photo', async () => {
  render(<HealthReportPage />);
  fireEvent.change(screen.getByLabelText('Find the child'), { target: { value: 'Ada' } });
  fireEvent.click(await screen.findByRole('button', { name: /Ada Obi/ }));
  fireEvent.change(screen.getByPlaceholderText('e.g. Grazed knee after a fall'), { target: { value: 'Grazed knee' } });
  fireEvent.change(screen.getByPlaceholderText('e.g. Cleaned the wound and applied a plaster'), { target: { value: 'Cleaned and covered' } });
  const photo = new File([new Uint8Array([1])], 'knee.jpg', { type: 'image/jpeg' });
  fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [photo] } });
  fireEvent.click(screen.getByRole('button', { name: 'Save report' }));

  await waitFor(() => expect(reportIncident).toHaveBeenCalledWith(expect.objectContaining({ studentId: 'ada', complaint: 'Grazed knee', firstAidGiven: 'Cleaned and covered', category: 'injury' })));
  await waitFor(() => expect(uploadHealthPhoto).toHaveBeenCalledWith('h1', photo));
  expect(await screen.findByText(/Report saved for Ada Obi/)).toBeTruthy();
});
