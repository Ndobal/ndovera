import { TextDecoder, TextEncoder } from 'util';
import JSZip from 'jszip';
import { buildExamPapersZip } from './ExamPapersDownload';

if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;
jest.setTimeout(30000);

const paper = {
  id: 'a1', kind: 'exam', title: 'Physics Examination', subjectName: 'Physics', className: 'SS 2A', config: { durationMinutes: 60 }, audit: { examMarks: 2 },
  blueprint: { sections: [{ name: 'A', type: 'mcq', questions: 1, attempt: 1, marks: 1 }, { name: 'B', type: 'essay', questions: 1, attempt: 1, marks: 1 }] },
  questions: [
    { id: 'q1', section: 'A', type: 'mcq', prompt: 'Which is a vector?', options: ['mass', 'speed', 'velocity', 'time'], answerIndex: 2, answer: '', markingPoints: [], alternatives: [], workingSteps: [], rubric: [], marks: 1 },
    { id: 'q2', section: 'B', type: 'essay', prompt: 'Explain inertia.', options: [], answerIndex: -1, answer: 'SCHEME-ONLY', markingPoints: ['point'], alternatives: [], workingSteps: [], rubric: [], marks: 1 },
  ],
};

test('one ZIP: a folder per class with each paper and its marking scheme; older submissions bring their text and files', async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn(async url => (String(url).includes('good') ? { ok: true, blob: async () => new Blob(['PDF-BYTES']) } : { ok: false, status: 404 }));
  try {
    const legacy = [{ id: 's1', title: 'Old Maths Exam', className: 'JSS 1', subjectName: 'Mathematics', teacherName: 'Mrs A', status: 'approved', content: 'Q1. 2 + 2 = ?', files: [{ name: 'paper.pdf', url: 'https://ndovera.com/files/good/paper.pdf' }, { name: 'lost.pdf', url: 'https://ndovera.com/files/bad/lost.pdf' }] }];
    const blob = await buildExamPapersZip({ papers: [paper], legacy }, { schoolName: 'Genesis' }, { includeSchemes: true });
    const zip = await JSZip.loadAsync(blob.arrayBuffer ? await blob.arrayBuffer() : await new Response(blob).arrayBuffer());
    const names = Object.keys(zip.files).filter(name => !zip.files[name].dir).sort();
    expect(names).toEqual([
      'Files that could not be downloaded.txt',
      'JSS 1/Mathematics - Old Maths Exam (Mrs A) - paper.pdf',
      'JSS 1/Mathematics - Old Maths Exam (Mrs A).md',
      'SS 2A/Physics - Physics Examination - marking scheme.docx',
      'SS 2A/Physics - Physics Examination.docx',
    ]);
    expect(await zip.file('Files that could not be downloaded.txt').async('string')).toMatch(/lost\.pdf/);
    const paperXml = await (await JSZip.loadAsync(await zip.file('SS 2A/Physics - Physics Examination.docx').async('arraybuffer'))).file('word/document.xml').async('string');
    expect(paperXml).toContain('Which is a vector?');
    expect(paperXml).not.toContain('SCHEME-ONLY');
  } finally {
    global.fetch = originalFetch;
  }
});
