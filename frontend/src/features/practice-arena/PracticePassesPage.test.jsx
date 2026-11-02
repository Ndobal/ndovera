import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PracticePassesPage from './PracticePassesPage';
import * as api from './practiceApi';
import { askConfirm } from '../../shared/components/AppDialog';

jest.mock('./practiceApi', () => {
  const actual = jest.requireActual('./practiceApi');
  return { ...actual, getSchoolPasses: jest.fn(), getSchoolPassSubjects: jest.fn(), quotePass: jest.fn(), checkoutPass: jest.fn() };
});
jest.mock('../school/services/schoolApi', () => ({ getPeople: jest.fn() }));
jest.mock('../../shared/components/AppDialog', () => ({ askConfirm: jest.fn() }));

const bundle = (key, label) => ({ key, label, priceNaira: 3000, schoolPriceNaira: 2100, blurb: `${label} blurb`, ready: true });
const BUNDLES = [bundle('subject', 'Subject Pass'), bundle('jamb', 'JAMB UTME Prep')];
const SUBJECTS = {
  ss2a: [['english', 'English Language'], ['mathematics', 'Mathematics'], ['physics', 'Physics'], ['chemistry', 'Chemistry'], ['biology', 'Biology']],
  ss3a: [['geography', 'Geography']],
  ss1a: [],
};

const chooseClass = name => fireEvent.change(screen.getByLabelText('Class'), { target: { value: name } });
const choosePass = key => fireEvent.change(screen.getByLabelText('Pass'), { target: { value: key } });
const payButton = () => screen.getByRole('button', { name: 'Continue to payment' });

beforeEach(() => {
  jest.clearAllMocks();
  api.getSchoolPasses.mockResolvedValue({
    success: true,
    discount: 0.3,
    classes: [
      { id: 'ss1a', name: 'SS 1 A', section: 'senior', bundles: BUNDLES },
      { id: 'ss2a', name: 'SS 2 A', section: 'senior', bundles: BUNDLES },
      { id: 'ss3a', name: 'SS 3 A', section: 'senior', bundles: BUNDLES },
      { id: 'jss1a', name: 'JSS 1 A', section: 'junior', bundles: [bundle('subject', 'Subject Pass')] },
    ],
  });
  api.getSchoolPassSubjects.mockImplementation(async classId => ({ success: true, subjects: (SUBJECTS[classId] || []).map(([key, name]) => ({ key, name })) }));
  api.quotePass.mockResolvedValue({ quote: { label: 'Pass', students: 30, amountNaira: 6300, each: 210 } });
  api.checkoutPass.mockRejectedValue(new Error('stop before leaving the page'));
  askConfirm.mockResolvedValue(true);
});

async function openPage() {
  render(<PracticePassesPage mode="school" />);
  await screen.findByLabelText('Class');
}

test('a senior class can buy a Subject Pass in one of its own subjects', async () => {
  await openPage();
  chooseClass('ss2a');
  await waitFor(() => expect(api.getSchoolPassSubjects).toHaveBeenCalledWith('ss2a'));
  choosePass('subject');
  const subject = await screen.findByLabelText('Subject');
  await screen.findByRole('option', { name: 'Physics' });
  expect(payButton()).toBeDisabled();
  fireEvent.change(subject, { target: { value: 'physics' } });
  expect(payButton()).toBeEnabled();
  fireEvent.click(payButton());
  await waitFor(() => expect(api.quotePass).toHaveBeenCalledWith({ bundle: 'subject', subjectKey: 'physics', classId: 'ss2a' }));
  await waitFor(() => expect(api.checkoutPass).toHaveBeenCalledWith({ bundle: 'subject', subjectKey: 'physics', classId: 'ss2a' }));
});

test('a senior class can buy JAMB with three subjects, English not among the choices', async () => {
  await openPage();
  chooseClass('ss2a');
  choosePass('jamb');
  await screen.findByLabelText('Physics');
  expect(screen.getByText(/same three subjects/)).toBeInTheDocument();
  expect(screen.queryByLabelText('English Language')).not.toBeInTheDocument();
  expect(payButton()).toBeDisabled();
  ['Mathematics', 'Physics', 'Chemistry'].forEach(name => fireEvent.click(screen.getByLabelText(name)));
  expect(payButton()).toBeEnabled();
  fireEvent.click(payButton());
  await waitFor(() => expect(api.quotePass).toHaveBeenCalledWith({ bundle: 'jamb', jambSubjects: ['mathematics', 'physics', 'chemistry'], classId: 'ss2a' }));
});

test('changing class clears choices made for the last class', async () => {
  await openPage();
  chooseClass('ss2a');
  choosePass('subject');
  await screen.findByRole('option', { name: 'Physics' });
  fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'physics' } });
  chooseClass('ss3a');
  await waitFor(() => expect(api.getSchoolPassSubjects).toHaveBeenCalledWith('ss3a'));
  expect(screen.getByLabelText('Pass')).toHaveValue('');
  expect(payButton()).toBeDisabled();
});

test('a senior class with no subjects, and a class below SS, say why they cannot buy', async () => {
  await openPage();
  chooseClass('ss1a');
  choosePass('subject');
  await screen.findByText(/no subjects set up yet/);
  expect(payButton()).toBeDisabled();
  chooseClass('jss1a');
  choosePass('subject');
  expect(await screen.findByText(/for SS 1 to SS 3/)).toBeInTheDocument();
  expect(payButton()).toBeDisabled();
});
