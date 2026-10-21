import React from 'react';
import { render, screen } from '@testing-library/react';
import ProgressReportCard from './ProgressReportCard';

const branding = { schoolName: 'Genesis International School', primaryColor: '#800000', accentColor: '#7c3aed', address: 'Apo, Abuja', logoUrl: '', sealUrl: '' };
const scoreModel = { caMaxScore: 60, examMaxScore: 40, totalMaxScore: 100 };
const base = {
  id: 'r1', termName: 'Second Term', sessionName: '2025/2026', publishedAt: '',
  student: { name: 'Onuigbo Kosisochukwu', className: 'Pre School 2', displayId: 'GIS/22/0149' },
  summary: { average: 91.07, grade: 'A', totalScore: 188, classSize: 10, teacherRemark: 'Confident and hard working.', principalRemark: 'Keep soaring!', subjectBadges: [{ subjectName: 'Numeracy', place: 1 }] },
  subjects: [
    { subjectId: 'n', subjectName: 'Numeracy', caComponents: [{ key: 'c1', label: '1st CA', maxScore: 30, score: 30 }, { key: 'c2', label: '2nd CA', maxScore: 30, score: 30 }], caScore: 60, examScore: 40, total: 100, grade: 'A', remark: 'Distinction', classHighest: 100, classLowest: 82, classAverage: 95, position: 1, firstTerm: 96, secondTerm: 98, cumulative: 98 },
    { subjectId: 'l', subjectName: 'Literacy', caComponents: [{ key: 'c1', label: '1st CA', maxScore: 30, score: 30 }, { key: 'c2', label: '2nd CA', maxScore: 30, score: 20 }], caScore: 50, examScore: 38, total: 88, grade: 'B+', remark: 'V. Good', classHighest: 100, classLowest: 72, classAverage: 86, position: 2, firstTerm: 90, secondTerm: 92, cumulative: 90 },
  ],
  affective: [{ key: 'punctuality', label: 'Punctuality', score: 4 }],
  ratings: [{ key: 'handwriting', label: 'Handwriting', score: 5 }],
};

test('the nursery card shows the details, C.A. columns, behaviour ticks, physical development, badges and page 2', () => {
  const record = {
    ...base,
    payload: {
      templateLayout: { level: 'nursery', cumulative: false, title: 'End of Term Progress Report' },
      extra: { timesOpened: '108', daysPresent: '108', heightStart: '117', weightEnd: '26', resumptionDate: '27th April, 2026' },
      page2: { title: 'Progress Report Sheet', mode: 'checklist', scale: [{ value: 'not_yet', label: 'Not yet' }, { value: 'progressing', label: 'Progressing' }, { value: 'yes', label: 'Yes' }], sections: [{ key: 'lang', title: 'Language Skills', items: [{ key: 'speaks', label: 'Speaks clearly' }] }], answers: { speaks: 'yes' } },
      settingsSnapshot: { gradingScale: [{ minScore: 90, grade: 'A', remark: 'Distinction' }, { minScore: 0, grade: 'E', remark: 'V. Weak' }] },
    },
  };
  render(<ProgressReportCard record={record} branding={branding} scoreModel={scoreModel} />);
  expect(screen.getByText('End of Term Progress Report')).toBeTruthy();
  expect(screen.getByText('Onuigbo Kosisochukwu')).toBeTruthy();
  expect(screen.getByText('1st CA')).toBeTruthy();
  expect(screen.getByText('C.A. test')).toBeTruthy();
  expect(screen.getByText('Physical Development')).toBeTruthy();
  expect(screen.getByText('117')).toBeTruthy();
  expect(screen.getByText(/Best in Numeracy/)).toBeTruthy();
  expect(screen.getByLabelText('Page 2')).toBeTruthy();
  expect(screen.getByText('Speaks clearly')).toBeTruthy();
  expect(screen.getByText(/A – DISTINCTION 90%–100%/)).toBeTruthy();
});

test('the secondary 3rd-term card is cumulative with positions and psychomotor/affective ratings, on one page', () => {
  const record = { ...base, termName: 'Third Term', payload: { templateLayout: { level: 'secondary', cumulative: true, title: 'Academic Report' }, extra: { resumptionDate: 'Monday, 7th September, 2026' }, page2: null } };
  render(<ProgressReportCard record={record} branding={branding} scoreModel={scoreModel} />);
  expect(screen.getByText('1st term')).toBeTruthy();
  expect(screen.getByText('Session average')).toBeTruthy();
  expect(screen.getByText('Position')).toBeTruthy();
  expect(screen.getByText('Psychomotor')).toBeTruthy();
  expect(screen.getByText('Affective domain')).toBeTruthy();
  expect(screen.queryByLabelText('Page 2')).toBeNull();
  expect(screen.getByText('Monday, 7th September, 2026')).toBeTruthy();
});
