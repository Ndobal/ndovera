import React, { useState } from 'react';
import { bulkTagOldStudentCodes } from '../../school/services/schoolApi';
import {
  RESULT_BODY,
  RESULT_BUTTON,
  RESULT_HEADING,
  RESULT_INNER_SURFACE,
  RESULT_INPUT,
  RESULT_LABEL,
  RESULT_SECONDARY_BUTTON,
  RESULT_SURFACE,
} from './resultSheetTheme';

// Each line is "Full Name, Old Code" (comma / tab / semicolon separated).
// The last token is the code; everything before it is the name.
function parseRows(text) {
  return String(text || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split(/[,\t;]+/).map(part => part.trim()).filter(Boolean);
      if (parts.length < 2) return { name: parts[0] || '', code: '' };
      return { name: parts.slice(0, -1).join(' '), code: parts[parts.length - 1] };
    })
    .filter(row => row.name && row.code);
}

export default function OldStudentCodesUpload() {
  const [text, setText] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState(null);
  const [problems, setProblems] = useState([]);
  const [error, setError] = useState('');

  function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result || ''));
    reader.readAsText(file);
    event.target.value = '';
  }

  async function run() {
    const rows = parseRows(text);
    if (rows.length === 0) {
      setError('Add rows as "Full Name, Old Code" — one per line.');
      return;
    }
    setError('');
    setRunning(true);
    setSummary(null);
    setProblems([]);
    setProgress({ done: 0, total: rows.length });

    const totals = { tagged: 0, unmatched: 0, ambiguous: 0, invalid: 0 };
    const allProblems = [];
    const chunkSize = 25;
    try {
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        // eslint-disable-next-line no-await-in-loop
        const res = await bulkTagOldStudentCodes(chunk);
        (res?.results || []).forEach(row => {
          if (row.status === 'tagged') totals.tagged += 1;
          else if (row.status === 'unmatched') { totals.unmatched += 1; allProblems.push(row); }
          else if (row.status === 'ambiguous') { totals.ambiguous += 1; allProblems.push(row); }
          else { totals.invalid += 1; allProblems.push(row); }
        });
        setProgress({ done: Math.min(i + chunk.length, rows.length), total: rows.length });
        setSummary({ ...totals });
        setProblems([...allProblems]);
      }
    } catch (err) {
      setError(err.message || 'Upload failed.');
    } finally {
      setRunning(false);
    }
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <section className={`${RESULT_SURFACE} p-6 space-y-4`}>
      <div>
        <p className={`micro-label ${RESULT_LABEL}`}>Migration</p>
        <h2 className={`text-2xl command-title ${RESULT_HEADING}`}>Tag students with old portal codes</h2>
        <p className={`mt-2 text-sm ${RESULT_BODY}`}>
          Paste or upload one student per line as <strong>Full Name, Old Code</strong>. Each name is matched to a student
          (all of the names must match, in any order) and the old code is saved as a hidden identity tag. Result PDFs can
          then be matched by the old code as well as by name, email or student ID.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <label className={`${RESULT_SECONDARY_BUTTON} cursor-pointer`}>
          <span>Upload CSV / Text</span>
          <input type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={handleFile} />
        </label>
      </div>

      <textarea
        value={text}
        onChange={event => setText(event.target.value)}
        rows={8}
        placeholder={'John Doe, OLD123\nMary Jane Smith, OLD124'}
        className={`${RESULT_INPUT} font-mono`}
      />

      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      <button type="button" onClick={run} disabled={running} className={RESULT_BUTTON}>
        {running ? 'Tagging…' : 'Tag Students'}
      </button>

      {(running || progress.total > 0) && (
        <div className="space-y-1">
          <div className="h-2.5 rounded-full bg-[#e8d4a0] dark:bg-black/30 overflow-hidden">
            <div className="h-full rounded-full bg-[#1a5c38] transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <p className={`text-xs ${RESULT_BODY}`}>Tagged {progress.done} of {progress.total} students…</p>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[['Tagged', summary.tagged], ['Unmatched', summary.unmatched], ['Ambiguous', summary.ambiguous], ['Invalid', summary.invalid]].map(([label, value]) => (
            <div key={label} className={`${RESULT_INNER_SURFACE} p-4`}>
              <p className={`micro-label ${RESULT_LABEL}`}>{label}</p>
              <p className={`mt-2 text-2xl font-black ${RESULT_HEADING}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {problems.length > 0 && (
        <div className={`${RESULT_INNER_SURFACE} p-4`}>
          <p className={`micro-label ${RESULT_LABEL}`}>Rows needing attention</p>
          <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
            {problems.map((problem, index) => (
              <div key={`${problem.name}-${index}`} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className={RESULT_HEADING}>{problem.name} <span className="opacity-60">→ {problem.code}</span></span>
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">{problem.status}: {problem.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
