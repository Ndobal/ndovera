import { TextDecoder, TextEncoder } from 'util';
import JSZip from 'jszip';
import { buildDocx } from './docxExport';

// Building a .docx is slow when every suite runs at once.
jest.setTimeout(30000);

// Browsers have these; the jsdom test environment does not.
if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;

const assessment = {
  id: 'a1', kind: 'exam', title: 'SS2 Economics First Term Examination', subjectName: 'Economics', className: 'SS 2A',
  sessionName: '2026/2027', termName: 'First Term', config: { durationMinutes: 120, totalMarks: 12 }, audit: { examMarks: 12 },
  blueprint: { sections: [
    { name: 'A', type: 'mcq', questions: 1, attempt: 1, marks: 2, instructions: 'Answer ALL questions.' },
    { name: 'B', type: 'essay', questions: 1, attempt: 1, marks: 10, instructions: 'Answer ONE question.' },
  ] },
  questions: [
    { id: 'q1', section: 'A', type: 'mcq', prompt: 'Find \\(\\frac{300}{1200}\\times100\\) and \\(x^{2}\\).\n\n| Year | Index |\n|---|---|\n| 2024 | 100 |', options: ['20', '25', '\\(\\sqrt{625}\\)', '35'], answerIndex: 1, answer: '', markingPoints: ['SECRET-MCQ-REASON'], alternatives: [], workingSteps: [], rubric: [], marks: 2, bloom: 'apply', topic: 'Price index' },
    { id: 'q2', section: 'B', type: 'essay', prompt: '<table>\n<tr><th colspan="2">Sector</th></tr>\n<tr><td>Agri</td><td>Oil</td></tr>\n</table>\n\nEvaluate **the** policy. $$\\sum_{i=1}^{n} x_i$$', options: [], answerIndex: -1, answer: 'SECRET-ESSAY-ANSWER', markingPoints: ['Point'], alternatives: [], workingSteps: [], rubric: [{ criterion: 'Judgement', marks: 4 }], marks: 10, bloom: 'evaluate', topic: 'Policy', pageBreakBefore: true },
  ],
};
const letterhead = { schoolName: 'Genesis International School', defaultInstructions: 'Write clearly.' };

async function documentXml(blob) {
  const buffer = blob.arrayBuffer ? await blob.arrayBuffer() : await new Response(blob).arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const footer = Object.keys(zip.files).find(name => /^word\/footer\d*\.xml$/.test(name));
  return { body: await zip.file('word/document.xml').async('string'), footer: footer ? await zip.file(footer).async('string') : '' };
}

test('the paper is a real .docx with native Word equations, tables, merged cells and page numbers — and no answers', async () => {
  const { body, footer } = await documentXml(await buildDocx(assessment, letterhead, 'paper'));
  expect(body).toContain('GENESIS INTERNATIONAL SCHOOL');
  expect(body).toContain('SECTION A');
  expect(body).toContain('<m:oMath>');
  expect(body).toContain('<m:f>'); // a stacked fraction
  expect(body).toContain('<m:sSup>'); // x squared
  expect(body).toContain('<m:rad>'); // square root
  expect(body).toContain('<m:nary>'); // summation
  expect(body).toContain('<w:gridSpan w:val="2"/>'); // merged cell
  expect(body).toContain('<w:tbl>');
  expect(body).toContain('<w:pageBreakBefore/>');
  expect(body).not.toMatch(/\\frac|\\sqrt|NDVMATH/);
  expect(body).not.toContain('SECRET');
  expect(footer).toMatch(/PAGE/);
});

test('the marking scheme carries the answers', async () => {
  const { body } = await documentXml(await buildDocx(assessment, letterhead, 'scheme'));
  expect(body).toContain('CONFIDENTIAL');
  expect(body).toContain('SECRET-ESSAY-ANSWER');
  expect(body).toContain('Answer: B');
  expect(body).toContain('Judgement');
});

test('the Word letterhead is a coloured band with the address and contact, and parts carry their marks', async () => {
  const parted = { ...assessment, questions: [assessment.questions[0], { ...assessment.questions[1], compulsory: true, parts: [{ label: 'a', prompt: 'Define inflation.', marks: 4 }, { label: 'b', prompt: 'Explain two causes.', marks: 6 }] }] };
  const { body } = await documentXml(await buildDocx(parted, { ...letterhead, address: '1 School Road', contact: '0800 000 0000', primaryColor: '#800000', accentColor: '#c9a96e' }, 'paper'));
  expect(body).toMatch(/w:color w:val="800000"/i);
  expect(body).toMatch(/w:fill="[0-9A-F]{6}"/i);
  expect(body).toContain('1 School Road');
  expect(body).toContain('0800 000 0000');
  expect(body).toContain('Define inflation.');
  expect(body).toContain('Compulsory');
});
