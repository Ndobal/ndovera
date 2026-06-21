import React, { useCallback, useEffect, useState } from 'react';
import {
  addStudentOldCode,
  bulkTagOldStudentCodes,
  getStudentOldCodes,
  removeStudentOldCode,
} from '../../school/services/schoolApi';
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

  // Per-student code manager
  const [managerStudents, setManagerStudents] = useState([]);
  const [managerLoading, setManagerLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [addInputs, setAddInputs] = useState({});
  const [managerMsg, setManagerMsg] = useState('');

  const loadManager = useCallback(() => {
    setManagerLoading(true);
    getStudentOldCodes()
      .then(data => setManagerStudents(data?.students || []))
      .catch(() => {})
      .finally(() => setManagerLoading(false));
  }, []);
  useEffect(() => { loadManager(); }, [loadManager]);

  async function handleAddCode(studentId) {
    const code = String(addInputs[studentId] || '').trim();
    if (!code) return;
    setManagerMsg('');
    try {
      await addStudentOldCode(studentId, code);
      setAddInputs(current => ({ ...current, [studentId]: '' }));
      loadManager();
    } catch (err) {
      setManagerMsg(err.message || 'Could not add code.');
    }
  }

  async function handleRemoveCode(codeId) {
    setManagerMsg('');
    try {
      await removeStudentOldCode(codeId);
      loadManager();
    } catch (err) {
      setManagerMsg(err.message || 'Could not remove code.');
    }
  }

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
      loadManager();
    }
  }

  const trimmedQuery = query.trim().toLowerCase();
  const managedStudents = managerStudents.filter(student => {
    if (!trimmedQuery) return (student.codes || []).length > 0;
    const haystack = `${student.name} ${student.email} ${student.className} ${(student.codes || []).map(c => c.code).join(' ')}`.toLowerCase();
    return haystack.includes(trimmedQuery);
  }).slice(0, 100);

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="space-y-4">
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

    <section className={`${RESULT_SURFACE} p-6 space-y-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className={`micro-label ${RESULT_LABEL}`}>Manage Tagged Codes</p>
          <h3 className={`text-lg command-title ${RESULT_HEADING}`}>Students &amp; their old codes</h3>
        </div>
        <button type="button" onClick={loadManager} className={RESULT_SECONDARY_BUTTON}>Refresh</button>
      </div>
      <input
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder="Search a name, email, class or code… (search anyone to add a code)"
        className={RESULT_INPUT}
      />
      {managerMsg && <p className="text-sm text-rose-600 dark:text-rose-400">{managerMsg}</p>}
      {managerLoading ? (
        <p className={`text-sm ${RESULT_BODY}`}>Loading…</p>
      ) : managedStudents.length === 0 ? (
        <p className={`text-sm ${RESULT_BODY}`}>{trimmedQuery ? 'No students match your search.' : 'No students have old codes yet. Upload above, or search a name to add one.'}</p>
      ) : (
        <div className="space-y-2 max-h-[28rem] overflow-y-auto">
          {managedStudents.map(student => (
            <div key={student.id} className={`${RESULT_INNER_SURFACE} p-3 flex flex-wrap items-center gap-2`}>
              <div className="min-w-[150px] flex-1">
                <p className={`text-sm font-semibold ${RESULT_HEADING}`}>{student.name}</p>
                <p className={`text-xs ${RESULT_BODY}`}>{student.className || student.email || student.displayId || '—'}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {(student.codes || []).map(code => (
                  <span key={code.id} className="inline-flex items-center gap-1 rounded-full border border-[#c9a96e]/45 bg-[#ade1f4] dark:border-white/15 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-[#191970] dark:text-slate-100">
                    {code.code}
                    <button type="button" onClick={() => handleRemoveCode(code.id)} className="text-rose-600 dark:text-rose-400 font-bold leading-none" aria-label="Remove code">×</button>
                  </span>
                ))}
                {(student.codes || []).length === 0 && <span className={`text-xs ${RESULT_BODY} opacity-70`}>No codes</span>}
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  value={addInputs[student.id] || ''}
                  onChange={event => setAddInputs(current => ({ ...current, [student.id]: event.target.value }))}
                  onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); handleAddCode(student.id); } }}
                  placeholder="Add code"
                  className="w-28 rounded-lg border border-[#c9a96e]/40 dark:border-white/15 bg-[#fffef9] dark:bg-slate-800 px-2 py-1 text-xs text-[#191970] dark:text-slate-100"
                />
                <button type="button" onClick={() => handleAddCode(student.id)} className={`${RESULT_SECONDARY_BUTTON} px-2.5 py-1 text-xs`}>Add</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
    </div>
  );
}
