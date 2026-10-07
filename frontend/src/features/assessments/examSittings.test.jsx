import React from 'react';
import { TextDecoder, TextEncoder } from 'util';
import { render } from '@testing-library/react';
import * as D from 'docx';
import { docxToText } from './docxText';
import { previewScore } from './ExamMarking';
import ExamDeliveryPanel, { defaultDelivery, deliveryPayload } from './ExamDeliveryPanel';

if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;

test('a Word paper keeps its automatic numbering: 1. 2. for questions, A. B. for options, (a) (b) for parts', async () => {
  const numbering = {
    config: [{
      reference: 'paper',
      levels: [
        { level: 0, format: D.LevelFormat.DECIMAL, text: '%1.' },
        { level: 1, format: D.LevelFormat.UPPER_LETTER, text: '%2.' },
      ],
    }, {
      reference: 'parts',
      levels: [{ level: 0, format: D.LevelFormat.LOWER_LETTER, text: '(%1)' }],
    }],
  };
  const item = (text, reference, level = 0) => new D.Paragraph({ numbering: { reference, level }, children: [new D.TextRun(text)] });
  const doc = new D.Document({
    numbering,
    sections: [{ children: [
      new D.Paragraph('SECTION A'),
      item('Which is a vector?', 'paper'), item('mass', 'paper', 1), item('velocity', 'paper', 1),
      item('The unit of force is', 'paper'), item('joule', 'paper', 1), item('newton', 'paper', 1),
      new D.Paragraph('SECTION B'),
      item('Define work. [2 marks]', 'parts'), item('Find the work done. [4 marks]', 'parts'),
      new D.Table({ rows: [new D.TableRow({ children: [new D.TableCell({ children: [new D.Paragraph('Year')] }), new D.TableCell({ children: [new D.Paragraph('Price')] })] }), new D.TableRow({ children: [new D.TableCell({ children: [new D.Paragraph('2024')] }), new D.TableCell({ children: [new D.Paragraph('100')] })] })] }),
    ] }],
  });
  const blob = await D.Packer.toBlob(doc);
  const text = await docxToText(blob.arrayBuffer ? await blob.arrayBuffer() : await new Response(blob).arrayBuffer());
  expect(text).toMatch(/^1\. Which is a vector\?$/m);
  expect(text).toMatch(/^A\. mass$/m);
  expect(text).toMatch(/^B\. velocity$/m);
  expect(text).toMatch(/^2\. The unit of force is$/m);
  expect(text).toMatch(/^A\. joule$/m, 'option letters restart for each question');
  expect(text).toMatch(/^\(a\) Define work\. \[2 marks\]$/m);
  expect(text).toMatch(/^\(b\) Find the work done/m);
  expect(text).toMatch(/\| Year \| Price \|/);
});

test('the marking sheet shows the same score-sheet score the server posts', () => {
  expect(previewScore(59, 30, 100, { examMaxScore: 60, entry: 'convert', decimals: 1 })).toEqual({ total: 89, score: 53.4 });
  expect(previewScore(59, 30, 100, { examMaxScore: 60, entry: 'raw', decimals: 1 })).toEqual({ total: 89, score: 60 });
  expect(previewScore(4, '', 16, { examMaxScore: 60, entry: 'convert', decimals: 0 })).toEqual({ total: 4, score: 15 });
  expect(previewScore(null, '', 16, { examMaxScore: 60, entry: 'convert', decimals: 1 })).toEqual({ total: null, score: null });
});

test('the HOS sees CBT objectives + printed theory first for a mixed paper, unique papers on for secondary classes', () => {
  const paper = { subjectName: 'Physics', className: 'SS 2A', objectiveCount: 40, objectiveMarks: 40, theoryCount: 5, theoryMarks: 60, paperTotal: 100, durationMinutes: 150, secondary: true };
  const delivery = defaultDelivery(paper);
  expect(delivery.mode).toBe('cbt_objective');
  expect(delivery.uniquePerStudent).toBe(true);
  expect(Date.parse(delivery.closesAt) > Date.parse(delivery.opensAt)).toBe(true);
  const sent = deliveryPayload(delivery);
  expect(sent.opensAt).toMatch(/Z$/);
  expect(defaultDelivery({ ...paper, theoryCount: 0 }).mode).toBe('cbt');
  expect(defaultDelivery({ ...paper, objectiveCount: 0 }).mode).toBe('print');
  const { container, rerender } = render(<ExamDeliveryPanel paper={paper} delivery={delivery} onChange={() => {}} canSchedule />);
  expect(container.textContent).toMatch(/CBT objectives \+ printed theory/);
  expect(container.querySelector('input[type="datetime-local"]')).toBeTruthy();
  rerender(<ExamDeliveryPanel paper={paper} delivery={{ ...delivery, mode: 'print' }} onChange={() => {}} canSchedule={false} />);
  expect(container.textContent).not.toMatch(/CBT — the whole paper/);
  expect(container.textContent).toMatch(/Only the Head of School or Owner can schedule a CBT/);
});
