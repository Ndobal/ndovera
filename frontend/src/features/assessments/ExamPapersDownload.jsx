import React, { useState } from 'react';
import JSZip from 'jszip';
import { getExamLetterhead, getExamPapers } from './assessmentsApi';
import { buildDocx } from './docxExport';
import { sameOriginUrl } from './PaperPreview';

// Head of School / Owner: download every submitted or approved exam paper at
// once — one ZIP, a folder per class, each paper and its marking scheme as Word
// files. Older "Exam Questions" submissions come with their text and files.

const BTN = 'rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50';
const SELECT = 'rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970]';
const safe = value => String(value || '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Untitled';

function save(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** The ZIP: Class/Subject - Title.docx (+ marking scheme), older submissions as text plus their files. */
export async function buildExamPapersZip({ papers, legacy }, letterhead, { includeSchemes = true, onProgress = () => {} } = {}) {
  const zip = new JSZip();
  const total = papers.length + legacy.length;
  let done = 0;
  for (const paper of papers) {
    const folder = zip.folder(safe(paper.className));
    const base = `${safe(paper.subjectName)} - ${safe(paper.title)}`;
    folder.file(`${base}.docx`, await buildDocx(paper, letterhead, 'paper'));
    if (includeSchemes) folder.file(`${base} - marking scheme.docx`, await buildDocx(paper, letterhead, 'scheme'));
    onProgress(++done, total);
  }
  const missing = [];
  for (const item of legacy) {
    const folder = zip.folder(safe(item.className));
    const base = `${safe(item.subjectName)} - ${safe(item.title)} (${safe(item.teacherName)})`;
    if (item.content?.trim()) folder.file(`${base}.md`, `# ${item.title}\n\n${item.className} · ${item.subjectName} · ${item.teacherName} · ${item.status}${item.termName ? ` · ${item.termName}` : ''}\n\n${item.content}\n`);
    for (const file of item.files || []) {
      try {
        const response = await fetch(sameOriginUrl(file.url), { credentials: 'include' });
        if (!response.ok) throw new Error(String(response.status));
        folder.file(`${base} - ${safe(file.name)}`, await response.blob());
      } catch {
        missing.push(`${item.title}: ${file.name} — ${file.url}`);
      }
    }
    onProgress(++done, total);
  }
  if (missing.length) zip.file('Files that could not be downloaded.txt', `These attachments could not be fetched; open the links instead:\n\n${missing.join('\n')}\n`);
  return zip.generateAsync({ type: 'blob' });
}

export default function ExamPapersDownload() {
  const [status, setStatus] = useState('approved');
  const [includeSchemes, setIncludeSchemes] = useState(true);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true); setError(''); setProgress('Finding the papers…');
    try {
      const [data, head] = await Promise.all([getExamPapers({ status }), getExamLetterhead().catch(() => ({ letterhead: {} }))]);
      const count = data.papers.length + data.legacy.length;
      if (!count) { setProgress(''); setError(status === 'approved' ? 'No approved exam papers yet.' : 'No exam papers found.'); return; }
      const blob = await buildExamPapersZip(data, head.letterhead || {}, { includeSchemes, onProgress: (done, total) => setProgress(`Preparing ${done} of ${total}…`) });
      save(blob, `Exam papers - ${status === 'approved' ? 'approved' : status === 'submitted' ? 'awaiting approval' : 'all'} - ${new Date().toISOString().slice(0, 10)}.zip`);
      setProgress(`Downloaded ${count} paper${count === 1 ? '' : 's'}.`);
    } catch (err) { setProgress(''); setError(err.message || 'Could not prepare the download.'); } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-[#191970] dark:text-slate-200">
      <select aria-label="Which papers" className={SELECT} value={status} onChange={event => setStatus(event.target.value)}>
        <option value="approved">Approved papers</option>
        <option value="submitted">Submitted, awaiting approval</option>
        <option value="all">All submitted and approved</option>
      </select>
      <label className="flex items-center gap-1.5"><input type="checkbox" checked={includeSchemes} onChange={event => setIncludeSchemes(event.target.checked)} /> With marking schemes</label>
      <button type="button" className={`${BTN} bg-[#1a5c38] text-[#b5e3f4]`} disabled={busy} onClick={download}>{busy ? 'Preparing…' : '⬇ Download all (.zip of Word files)'}</button>
      {progress && <span role="status" className="text-xs font-semibold text-[#1a5c38]">{progress}</span>}
      {error && <span role="alert" className="text-xs font-semibold text-rose-700">{error}</span>}
    </div>
  );
}
