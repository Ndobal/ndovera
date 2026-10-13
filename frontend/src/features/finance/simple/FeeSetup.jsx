import React, { useEffect, useMemo, useState } from 'react';
import { bulkEdit, getFeeSource, getTermGrid, lockTermFees, naira, previewChanges, rowTotal, saveTermGrid, studentTotal } from './simpleFeesApi';

// A term's fees as one table: classes down the side, fee items across the top,
// every amount editable in place, and below it the students who pay differently
// from their class. Reuse last term (both tables, exactly), change what changed,
// decide what happens to earlier debts, save, lock. Changing fees after students
// are billed asks what should happen first.

const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5 dark:border-white/10 dark:bg-slate-900/40';
const BTN = 'rounded-2xl px-4 py-2 text-sm font-bold disabled:opacity-50';
const PRIMARY = `${BTN} bg-[#1a5c38] text-[#b5e3f4] hover:bg-[#154a2e]`;
const SECONDARY = `${BTN} border border-[#c9a96e]/50 bg-white text-[#800020]`;
const CELL = 'w-28 rounded-lg border border-[#c9a96e]/45 bg-white px-2 py-1 text-right text-sm text-[#191970] disabled:bg-slate-50';

function ColumnEditor({ column, rows, onApply, onRename, onRemove, onClose }) {
  const [mode, setMode] = useState('increase');
  const [value, setValue] = useState('');
  const [name, setName] = useState(column.name);
  const next = useMemo(() => (mode === 'individual' || value === '' ? rows : bulkEdit(rows, column.name, mode, value)), [rows, column.name, mode, value]);
  const changes = previewChanges(rows, next, column.name);
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#191970]/60 p-3" role="dialog" aria-modal="true" aria-label={`Edit ${column.name}`}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 text-[#191970] shadow-2xl">
        <h2 className="text-lg font-black text-[#800000]">{column.name} — Edit all</h2>
        <div className="mt-3 space-y-2 text-sm">
          {[['same', 'Enter the same amount for all classes'], ['increase', 'Increase existing amounts by %'], ['reduce', 'Reduce existing amounts by %'], ['individual', 'Edit individually (in the table)']].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2"><input type="radio" name="bulk-mode" checked={mode === key} onChange={() => setMode(key)} /> {label}</label>
          ))}
        </div>
        {mode !== 'individual' && (
          <label className="mt-3 block text-xs font-bold uppercase text-[#800020]">{mode === 'same' ? 'Amount (₦)' : 'Percentage (%)'}
            <input type="number" min="0" autoFocus className="mt-1 w-full rounded-xl border border-[#c9a96e]/45 p-2 text-base" value={value} onChange={event => setValue(event.target.value)} />
          </label>
        )}
        {changes.length > 0 && (
          <div className="mt-3 rounded-xl bg-[#fff6e0] p-3 text-sm">
            <p className="mb-1 font-bold">Preview</p>
            <table className="w-full"><tbody>{changes.map(line => <tr key={line.className}><td className="py-0.5">{line.className}</td><td className="text-right">{naira(line.from)}</td><td className="px-2">→</td><td className="text-right font-bold">{naira(line.to)}</td></tr>)}</tbody></table>
          </div>
        )}
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-bold text-[#800020]">Rename or remove this item</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            <input className="flex-1 rounded-xl border border-[#c9a96e]/45 p-2" value={name} onChange={event => setName(event.target.value)} aria-label="Item name" />
            <button type="button" className={SECONDARY} disabled={!name.trim() || name === column.name} onClick={() => onRename(name.trim())}>Rename</button>
            <button type="button" className={`${SECONDARY} !text-rose-700`} onClick={onRemove}>Remove item</button>
          </div>
        </details>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={SECONDARY} onClick={onClose}>Cancel</button>
          <button type="button" className={PRIMARY} disabled={mode === 'individual' ? false : !changes.length} onClick={() => (mode === 'individual' ? onClose() : onApply(next))}>{mode === 'individual' ? 'Done' : 'Apply'}</button>
        </div>
      </div>
    </div>
  );
}

function DecisionDialog({ decision, busy, onChoose, onCancel }) {
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#191970]/60 p-3" role="dialog" aria-modal="true" aria-label="Students already billed">
      <div className="w-full max-w-lg space-y-3 rounded-3xl bg-white p-5 text-[#191970] shadow-2xl">
        <h2 className="text-lg font-black text-[#800000]">{decision.affectedStudents} student{decision.affectedStudents === 1 ? ' has' : 's have'} already been billed.</h2>
        <ul className="space-y-1 text-sm">
          {decision.changes.map((change, index) => (
            <li key={index}>{change.className}: <strong>{change.item}</strong> {change.from ? naira(change.from) : 'new'} → {change.to ? naira(change.to) : 'removed'} ({change.students} student{change.students === 1 ? '' : 's'})</li>
          ))}
        </ul>
        <p className="text-sm font-bold">What should happen to students already billed?</p>
        <div className="space-y-2">
          <button type="button" disabled={busy} className={`${PRIMARY} w-full text-left`} onClick={() => onChoose('adjust_existing')}>Apply the difference to affected students<span className="block text-xs font-normal">Each change is recorded on their account with the reason.</span></button>
          <button type="button" disabled={busy} className={`${SECONDARY} w-full text-left`} onClick={() => onChoose('future_only')}>Use the new amounts for future students only<span className="block text-xs font-normal">Students already billed keep what they were charged.</span></button>
          <button type="button" disabled={busy} className={`${SECONDARY} w-full`} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Students who pay differently from their class (a scholarship child's tuition,
 * transport only for some). A blank cell means "same as the class", shown as
 * the faint class amount.
 */
function StudentFees({ mode, students, register, columns, rows, editable, onCell, onFill, onAdd, onRemove }) {
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [adding, setAdding] = useState('');
  const byStudent = mode === 'student';
  const byClass = useMemo(() => new Map(rows.map(row => [row.classId, row])), [rows]);
  const listed = new Set(students.map(student => student.studentId));
  const needle = query.trim().toLowerCase();
  const hasAmounts = student => Object.values(student.amounts || {}).some(value => value !== '' && value !== null && value !== undefined);
  const shown = students
    .filter(student => !classFilter || (classFilter === 'new' ? student.isNew : student.classId === classFilter))
    .filter(student => !needle || `${student.studentName} ${student.className}`.toLowerCase().includes(needle));
  const newCount = students.filter(student => student.isNew).length;
  const missing = byStudent ? students.filter(student => !hasAmounts(student)).length : 0;
  const classOptions = [...new Map(students.filter(student => student.classId).map(student => [student.classId, student.className])).entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  const addNeedle = adding.trim().toLowerCase();
  const matches = addNeedle ? register.filter(student => !listed.has(student.studentId) && `${student.studentName} ${student.className}`.toLowerCase().includes(addNeedle)).slice(0, 8) : [];
  if (!students.length && !editable) return null;
  return (
    <section className={`${CARD} space-y-3`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex-1 text-lg font-black text-[#800000] dark:text-white">{byStudent ? 'Each student\'s fees' : 'Students who pay differently'} <span className="text-sm font-semibold text-[#191970] dark:text-slate-300">({students.length})</span></h3>
        {(classOptions.length > 1 || newCount > 0) && (
          <select aria-label="Show class" className="rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970]" value={classFilter} onChange={event => setClassFilter(event.target.value)}>
            <option value="">All classes</option>
            {newCount > 0 && <option value="new">New students ({newCount})</option>}
            {classOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        )}
        {students.length > 8 && <input aria-label="Find a student" className="w-56 rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970]" placeholder="Find a student…" value={query} onChange={event => setQuery(event.target.value)} />}
      </div>
      <p className="text-xs text-[#191970]/80 dark:text-slate-400">
        {byStudent
          ? 'Each student pays exactly what is entered on their row — nothing else. Leave a cell empty (or 0) for an item they do not pay.'
          : 'Each student pays their class\'s fees, except where an amount is entered here. Enter 0 for an item they do not pay. Leave a cell empty to use the class amount.'}
      </p>
      {newCount > 0 && <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-900">{newCount} student{newCount === 1 ? ' was' : 's were'} not at the school last term and {newCount === 1 ? 'is' : 'are'} marked NEW. Enter their fees{byStudent ? '' : ', or leave them blank to charge their class fees'}.</p>}
      {byStudent && missing > 0 && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">{missing} student{missing === 1 ? ' has' : 's have'} no fees entered and will not be billed.</p>}
      {byStudent && editable && (
        <button type="button" className={SECONDARY} onClick={() => onFill(shown.map(student => student.studentId))}>
          Fill empty cells from class amounts{classFilter || needle ? ' (students shown)' : ''}
        </button>
      )}
      {shown.length > 0 && (
        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full min-w-[720px] text-sm text-[#191970] dark:text-slate-200">
            <thead className="sticky top-0 bg-[#b5e3f4] dark:bg-slate-900">
              <tr>
                <th className="w-10 p-2 text-right text-xs font-bold uppercase text-[#800020]">S/N</th>
                <th className="p-2 text-left text-xs font-bold uppercase text-[#800020]">Student</th>
                {columns.map(item => <th key={item.name} className="p-2 text-right text-xs font-black uppercase text-[#800020]">{item.name}</th>)}
                <th className="p-2 text-right text-xs font-bold uppercase text-[#800020]">Total</th>
                {editable && <th className="p-2"><span className="sr-only">Remove</span></th>}
              </tr>
            </thead>
            <tbody>
              {shown.map((student, index) => {
                const classRow = byClass.get(student.classId);
                return (
                  <tr key={student.studentId} className="border-t border-[#c9a96e]/30">
                    <td className="p-2 text-right tabular-nums">{index + 1}</td>
                    <td className="p-2">
                      <span className="font-semibold">{student.studentName || student.studentId}</span>
                      {student.isNew && <span className="ml-1 rounded-full bg-sky-600 px-1.5 py-0.5 text-[10px] font-black text-white">NEW</span>}
                      <span className="block text-xs opacity-70">{student.className || 'No class'}</span>
                    </td>
                    {columns.map(item => (
                      <td key={item.name} className="p-1 text-right">
                        <input type="number" min="0" aria-label={`${student.studentName} ${item.name}`} disabled={!editable} className={CELL}
                          value={student.amounts[item.name] ?? ''} placeholder={!byStudent && classRow?.amounts?.[item.name] ? String(classRow.amounts[item.name]) : '—'}
                          onChange={event => onCell(student.studentId, item.name, event.target.value)} />
                      </td>
                    ))}
                    <td className="p-2 text-right font-black">{naira(studentTotal(student, byStudent ? null : classRow, columns))}</td>
                    {editable && <td className="p-2"><button type="button" className="text-xs font-bold text-rose-700 underline" onClick={() => onRemove(student.studentId)} title={byStudent ? 'Clear this student\'s fees' : 'Back to the class fees'}>{byStudent ? 'Clear' : 'Remove'}</button></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {editable && !byStudent && (
        <div className="relative max-w-sm">
          <input aria-label="Add a student" className="w-full rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970]" placeholder="+ Add a student — type a name…" value={adding} onChange={event => setAdding(event.target.value)} />
          {matches.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full rounded-2xl border border-[#c9a96e]/40 bg-white p-1 shadow-lg">
              {matches.map(student => (
                <li key={student.studentId}><button type="button" className="w-full rounded-xl px-3 py-2 text-left text-sm text-[#191970] hover:bg-[#fff6e0]" onClick={() => { onAdd(student); setAdding(''); }}>{student.studentName} <span className="text-xs opacity-70">· {student.className || 'No class'}</span></button></li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/** How this term's fees are set: one row per class (with exceptions), or each student's own. */
function FeeModeChoice({ mode, editable, onChange }) {
  const options = [
    ['class', 'Class fees', 'Each class pays the same. Add the few students who pay differently.'],
    ['student', 'Individual student fees', 'Enter each student\'s own fees. Every student pays only what is on their row.'],
  ];
  return (
    <section className={`${CARD} space-y-2`}>
      <h3 className="text-lg font-black text-[#800000] dark:text-white">How are fees set this term?</h3>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="How are fees set this term?">
        {options.map(([key, label, help]) => (
          <label key={key} className={`flex gap-3 rounded-2xl bg-white p-3 text-[#191970] ${mode === key ? 'ring-2 ring-[#1a5c38]' : ''} ${editable ? 'cursor-pointer' : 'opacity-80'}`}>
            <input type="radio" name="fee-mode" className="mt-1" disabled={!editable} checked={mode === key} onChange={() => onChange(key)} />
            <span><span className="block font-bold">{label}</span><span className="block text-xs">{help}</span></span>
          </label>
        ))}
      </div>
    </section>
  );
}

/** Earlier terms' unpaid balances: carried into this term, or written off when the fees are locked. */
function DebtChoice({ debt, earlierDebts, mode, editable, term, onChange }) {
  if (debt?.writtenOffAt) {
    return <section className={CARD}><p className="text-sm font-bold text-[#191970] dark:text-white">Earlier debts were written off for {term.name}: {naira(debt.writtenOffAmount)} for {debt.writtenOffStudents} student(s), on {new Date(debt.writtenOffAt).toLocaleDateString()}. Each write-off is in the audit log.</p></section>;
  }
  if (!earlierDebts) {
    return <section className={CARD}><p className="text-sm text-[#191970] dark:text-slate-300">Earlier debts: {mode === 'write_off' ? 'written off' : 'carried into this term as Outstanding Fee'}.</p></section>;
  }
  const options = [
    ['carry', 'Carry outstanding debts to this term', earlierDebts.total > 0 ? `Each student's unpaid balance (${naira(earlierDebts.total)} across ${earlierDebts.students} student${earlierDebts.students === 1 ? '' : 's'}) is added to their ${term.name} account as Outstanding Fee.` : 'Unpaid balances from earlier terms are added to each account as Outstanding Fee.'],
    ['write_off', 'Write off outstanding debts', earlierDebts.total > 0 ? `${naira(earlierDebts.total)} owed by ${earlierDebts.students} student${earlierDebts.students === 1 ? '' : 's'} is cleared when you lock the fees. Every write-off is recorded with the reason.` : 'Any unpaid balance from earlier terms is cleared when you lock the fees, and recorded.'],
  ];
  return (
    <section className={`${CARD} space-y-2`}>
      <h3 className="text-lg font-black text-[#800000] dark:text-white">Outstanding debts from earlier terms</h3>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Outstanding debts from earlier terms">
        {options.map(([key, label, help]) => (
          <label key={key} className={`flex cursor-pointer gap-3 rounded-2xl bg-white p-3 text-[#191970] ${mode === key ? (key === 'write_off' ? 'ring-2 ring-rose-600' : 'ring-2 ring-[#1a5c38]') : ''} ${editable ? '' : 'cursor-default opacity-80'}`}>
            <input type="radio" name="debt-mode" className="mt-1" disabled={!editable} checked={mode === key} onChange={() => onChange(key)} />
            <span><span className="block font-bold">{label}</span><span className="block text-xs">{help}</span></span>
          </label>
        ))}
      </div>
    </section>
  );
}

export default function FeeSetup({ initialTermId, initialSource, canEdit, onSaved }) {
  const [termId, setTermId] = useState(initialTermId || '');
  const [data, setData] = useState(null);
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [editingColumn, setEditingColumn] = useState(null);
  const [decision, setDecision] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ text: '', tone: 'ok' });
  const [source, setSource] = useState(initialSource || null);
  const [students, setStudents] = useState([]);
  const [debtMode, setDebtMode] = useState('carry');
  const [feeMode, setFeeMode] = useState('class');
  const [copyOpen, setCopyOpen] = useState(false);
  const locked = Boolean(data?.grid?.lock?.locked);
  const editable = canEdit && !locked;

  const register = useMemo(() => new Map((data?.students || []).map(student => [student.studentId, student])), [data]);
  const withClass = list => list.map(student => ({ ...student, studentName: register.get(student.studentId)?.studentName || student.studentName, classId: register.get(student.studentId)?.classId || student.classId || '', className: register.get(student.studentId)?.className || student.className || '' }));

  /** Put another term's fees (both tables) into this term's, unsaved. */
  async function applySource(fromSource, termRows, termIdForSource) {
    const result = await getFeeSource(termIdForSource, fromSource.type === 'reuse' ? fromSource.termId : undefined);
    if (!result.found) {
      setNotice({ text: fromSource.type === 'template' ? 'No saved fee template was found — start from the items below.' : 'That term has no fees to copy.', tone: 'warn' });
      return false;
    }
    const byClass = new Map(result.rows.map(row => [row.classId, row.amounts]));
    // Reuse replaces everything on this page with that term's set-up: items, class
    // fees, each student's own fees, and whether fees are set by class or by student.
    const mode = result.feeMode === 'student' ? 'student' : 'class';
    setFeeMode(mode);
    setColumns(result.columns.length ? result.columns : [{ name: 'Tuition', required: true, frequency: 'term' }]);
    setRows(termRows.map(row => ({ ...row, amounts: { ...(byClass.get(row.classId) || {}) } })));
    const copied = result.students.map(student => ({ studentId: student.studentId, studentName: student.studentName, amounts: { ...student.amounts } }));
    const copiedIds = new Set(copied.map(student => student.studentId));
    // Students who were not here that term: listed for their fees to be entered.
    const joined = (result.newStudents || []).filter(student => !copiedIds.has(student.studentId))
      .map(student => ({ studentId: student.studentId, studentName: student.studentName, amounts: {}, isNew: true }));
    setStudents([...copied, ...joined]);
    const special = copied.length;
    const what = mode === 'student'
      ? `${special} student${special === 1 ? "'s" : "s'"} own fees`
      : `class fees${special ? ` and ${special} student${special === 1 ? ' who pays' : 's who pay'} differently` : ''}`;
    setNotice({
      text: `Copied ${result.label || 'last term'} exactly: ${what}, set ${mode === 'student' ? 'for each student' : 'by class'}.`
        + `${joined.length ? ` ${joined.length} student${joined.length === 1 ? ' who was' : 's who were'} not at the school then ${joined.length === 1 ? 'is' : 'are'} marked NEW below — enter their fees${mode === 'class' ? ' (left blank, they pay their class fees)' : ''}.` : ''}`
        + `${result.leftOut ? ` ${result.leftOut} student(s) who have left were not carried over.` : ''} No balances were copied. Change anything, choose what happens to earlier debts, then Save.`,
      tone: 'ok',
    });
    setDirty(true);
    return true;
  }

  function load(nextTermId = termId, fromSource = source) {
    setData(null);
    getTermGrid(nextTermId).then(async result => {
      setData(result);
      if (!nextTermId) setTermId(result.grid.term.id);
      const baseRows = result.grid.rows.map(row => ({ classId: row.classId, className: row.className, amounts: { ...row.amounts } }));
      setColumns(result.grid.columns.length ? result.grid.columns : [{ name: 'Tuition', required: true, frequency: 'term' }]);
      setRows(baseRows);
      setStudents((result.grid.students || []).map(student => ({ studentId: student.studentId, studentName: student.studentName, amounts: { ...student.amounts } })));
      setDebtMode(result.grid.debt?.mode || 'carry');
      setFeeMode(result.grid.feeMode === 'student' ? 'student' : 'class');
      setDirty(false);
      // A term with no fees yet starts from the chosen source.
      if (!result.grid.configured && fromSource) {
        if (fromSource.type === 'new') { setColumns([{ name: 'Tuition', required: true, frequency: 'term' }]); setDirty(true); }
        else await applySource(fromSource, baseRows, result.grid.term.id);
      }
    }).catch(err => setNotice({ text: err.message, tone: 'error' }));
  }
  useEffect(() => { load(termId, source); }, [termId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function copyFrom(fromSource) {
    setCopyOpen(false);
    if ((data.grid.configured || dirty) && !window.confirm('Replace the fees on this page with the copied ones? Nothing is saved until you press Save.')) return;
    try { await applySource(fromSource, rows.map(row => ({ ...row, amounts: {} })), data.grid.term.id); } catch (err) { setNotice({ text: err.message, tone: 'error' }); }
  }

  const setCell = (classId, column, value) => { setRows(previous => previous.map(row => (row.classId === classId ? { ...row, amounts: { ...row.amounts, [column]: value } } : row))); setDirty(true); };
  const setStudentCell = (studentId, column, value) => {
    setStudents(previous => {
      if (previous.some(student => student.studentId === studentId)) return previous.map(student => (student.studentId === studentId ? { ...student, amounts: { ...student.amounts, [column]: value } } : student));
      // By student, everyone on the register has a row; the first entry creates it.
      return [...previous, { studentId, studentName: register.get(studentId)?.studentName || '', amounts: { [column]: value } }];
    });
    setDirty(true);
  };
  /** By student: fill every empty cell from the student's class row (the starting amounts). */
  function fillFromClass(studentIds) {
    const classRows = new Map(rows.map(row => [row.classId, row]));
    const ids = new Set(studentIds);
    setStudents(previous => {
      const byId = new Map(previous.map(student => [student.studentId, student]));
      for (const studentId of ids) {
        const student = byId.get(studentId) || { studentId, studentName: register.get(studentId)?.studentName || '', amounts: {} };
        const classRow = classRows.get(register.get(studentId)?.classId);
        const amounts = { ...student.amounts };
        for (const column of columns) {
          if ((amounts[column.name] === undefined || amounts[column.name] === '') && classRow?.amounts?.[column.name]) amounts[column.name] = classRow.amounts[column.name];
        }
        byId.set(studentId, { ...student, amounts });
      }
      return [...byId.values()];
    });
    setDirty(true);
  }
  // By student, the list is the whole register (with anyone already given fees); by class, only the exceptions.
  const studentList = useMemo(() => {
    if (feeMode !== 'student') return students;
    const byId = new Map(students.map(student => [student.studentId, student]));
    const all = (data?.students || []).map(student => byId.get(student.studentId) || { studentId: student.studentId, studentName: student.studentName, amounts: {} });
    const listed = new Set(all.map(student => student.studentId));
    return [...all, ...students.filter(student => !listed.has(student.studentId))];
  }, [feeMode, students, data]);
  const grandTotal = rows.reduce((sum, row) => sum + rowTotal(row, columns), 0);

  function addColumn() {
    const taken = new Set(columns.map(column => column.name.toLowerCase()));
    let index = columns.length + 1;
    let name = 'New item';
    while (taken.has(name.toLowerCase())) { name = `New item ${index}`; index += 1; }
    setColumns([...columns, { name, required: true, frequency: 'term' }]);
    setEditingColumn(name);
    setDirty(true);
  }

  async function save(changeMode) {
    setBusy(true); setNotice({ text: '', tone: 'ok' });
    try {
      const payload = {
        termId: data.grid.term.id, columns, changeMode, debtMode, feeMode,
        rows: rows.map(row => ({ classId: row.classId, amounts: Object.fromEntries(Object.entries(row.amounts).map(([key, value]) => [key, Number(value) || 0])) })),
        // Only filled cells are sent: blank means "the class amount" by class, and "nothing" by student.
        students: students.map(student => ({
          studentId: student.studentId, studentName: student.studentName,
          amounts: Object.fromEntries(Object.entries(student.amounts).filter(([key, value]) => value !== '' && value !== null && value !== undefined && columns.some(column => column.name === key)).map(([key, value]) => [key, Number(value) || 0])),
        })).filter(student => Object.keys(student.amounts).length),
      };
      const result = await saveTermGrid(payload);
      setDecision(null);
      setDirty(false);
      setSource(null);
      setNotice({ text: `Saved.${result.adjusted ? ` ${result.adjusted} existing charge(s) adjusted, each recorded with the reason.` : ''}${!locked ? ' Review, then lock the fees to create every student\'s account.' : ''}`, tone: 'ok' });
      load(data.grid.term.id, null);
      onSaved?.();
    } catch (err) {
      if (err.status === 409 && err.data?.needsDecision) setDecision(err.data);
      else setNotice({ text: err.message, tone: 'error' });
    } finally { setBusy(false); }
  }

  async function toggleLock() {
    const debts = data.earlierDebts;
    if (!locked && debtMode === 'write_off' && debts?.total > 0
      && !window.confirm(`Locking will write off ${naira(debts.total)} owed from earlier terms by ${debts.students} student(s). Each write-off is recorded, but it cannot be undone from here. Continue?`)) return;
    setBusy(true); setNotice({ text: '', tone: 'ok' });
    try {
      const result = await lockTermFees(data.grid.term.id, locked, locked ? 'Unlocked to edit fees' : '');
      setNotice({ text: locked ? 'Unlocked. You can change the fees; changes for students already billed will ask what to do.' : `Locked. ${result.students} student account(s) are ready.${result.writtenOff?.students ? ` ${naira(result.writtenOff.amount)} of earlier debts written off for ${result.writtenOff.students} student(s).` : ''}`, tone: 'ok' });
      load(data.grid.term.id, null);
      onSaved?.();
    } catch (err) { setNotice({ text: err.message, tone: 'error' }); } finally { setBusy(false); }
  }

  if (!data) return <p role="status" className="p-4">Loading fees…</p>;
  const term = data.grid.term;
  const column = columns.find(item => item.name === editingColumn);

  return (
    <div className="space-y-4">
      <section className={`${CARD} space-y-3`}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex-1 text-xl font-black text-[#800000] dark:text-white">{term.name} Fees <span className="text-sm font-semibold text-[#191970] dark:text-slate-300">· {term.sessionName}</span></h2>
          {locked ? <span className="rounded-full bg-[#191970] px-3 py-1 text-xs font-black text-white">🔒 Locked</span> : data.grid.configured ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">Not locked yet</span> : null}
          <select aria-label="Term" className="rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970]" value={term.id} onChange={event => { setSource(null); setTermId(event.target.value); }}>
            {data.terms.map(item => <option key={item.id} value={item.id}>{item.sessionName} · {item.name}</option>)}
          </select>
        </div>
        {editable && (
          <div className="relative">
            <button type="button" className={SECONDARY} aria-expanded={copyOpen} onClick={() => setCopyOpen(open => !open)}>⧉ Copy fees from another term ▾</button>
            {copyOpen && (
              <div className="absolute left-0 z-30 mt-1 w-72 rounded-2xl border border-[#c9a96e]/40 bg-white p-1 shadow-lg">
                {(data.reuse || []).map(option => (
                  <button key={option.termId} type="button" className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-[#800020] hover:bg-[#fff6e0]" onClick={() => copyFrom({ type: 'reuse', termId: option.termId })}>
                    {option.sessionName} · {option.termName}{option.origin === 'template' ? <span className="ml-1 text-xs font-normal text-[#191970]">(Fee Template)</span> : null}
                  </button>
                ))}
                <button type="button" className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-[#800020] hover:bg-[#fff6e0]" onClick={() => copyFrom({ type: 'template' })}>Latest saved Fee Template</button>
              </div>
            )}
          </div>
        )}
        {!canEdit && <p className="text-sm text-[#191970] dark:text-slate-300">You can view the fees. Only {data.settings.editors.join(', ')} can change them.</p>}
        {locked && canEdit && <p className="text-sm text-[#191970] dark:text-slate-300">These fees are official. Unlock them to make a change.</p>}
        {notice.text && <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`rounded-xl px-3 py-2 text-sm font-semibold ${notice.tone === 'error' ? 'bg-rose-50 text-rose-800' : notice.tone === 'warn' ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-[#1a5c38]'}`}>{notice.text}</p>}
      </section>

      <FeeModeChoice mode={feeMode} editable={editable} onChange={mode => { setFeeMode(mode); setDirty(true); }} />

      <section className={CARD}>
        {feeMode === 'student' && (
          <div className="mb-3">
            <h3 className="text-lg font-black text-[#800000] dark:text-white">Starting amounts by class <span className="text-sm font-semibold text-[#191970] dark:text-slate-300">(optional)</span></h3>
            <p className="text-xs text-[#191970]/80 dark:text-slate-400">Nobody is billed from this table. Use it to fill students' fees quickly with "Fill empty cells from class amounts" below.</p>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm text-[#191970] dark:text-slate-200">
            <thead>
              <tr>
                <th className="p-2 text-left text-xs font-bold uppercase text-[#800020]">Class</th>
                {columns.map(item => (
                  <th key={item.name} className="p-2 text-right">
                    <button type="button" disabled={!editable} onClick={() => setEditingColumn(item.name)} className="rounded-lg px-2 py-1 text-xs font-black uppercase text-[#800020] hover:bg-white disabled:hover:bg-transparent" title={editable ? 'Edit all' : ''}>
                      {item.name}{editable ? ' ✎' : ''}
                    </button>
                  </th>
                ))}
                <th className="p-2 text-right text-xs font-bold uppercase text-[#800020]">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.classId} className="border-t border-[#c9a96e]/30">
                  <td className="p-2 font-semibold">{row.className}</td>
                  {columns.map(item => (
                    <td key={item.name} className="p-1 text-right">
                      <input type="number" min="0" aria-label={`${row.className} ${item.name}`} disabled={!editable} className={CELL} value={row.amounts[item.name] ?? ''} placeholder="—" onChange={event => setCell(row.classId, item.name, event.target.value)} />
                    </td>
                  ))}
                  <td className="p-2 text-right font-black">{naira(rowTotal(row, columns))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="border-t-2 border-[#191970]"><td className="p-2 text-xs font-bold uppercase text-[#800020]" colSpan={columns.length + 1}>All classes</td><td className="p-2 text-right font-black">{naira(grandTotal)}</td></tr></tfoot>
          </table>
        </div>
        {editable && <button type="button" className={`${SECONDARY} mt-3`} onClick={addColumn}>+ Add Fee Item</button>}
        <p className="mt-2 text-xs text-[#191970]/80 dark:text-slate-400">Leave a cell empty if a class does not pay that item. Click an item name to change it for every class at once.</p>
      </section>

      <StudentFees
        mode={feeMode} students={withClass(studentList)} register={data.students || []} columns={columns} rows={rows} editable={editable}
        onCell={setStudentCell} onFill={fillFromClass}
        onAdd={student => { setStudents(previous => [...previous, { studentId: student.studentId, studentName: student.studentName, amounts: {} }]); setDirty(true); }}
        onRemove={studentId => { setStudents(previous => previous.filter(student => student.studentId !== studentId)); setDirty(true); }}
      />

      <DebtChoice debt={data.grid.debt} earlierDebts={data.earlierDebts} mode={debtMode} editable={editable} term={term} onChange={mode => { setDebtMode(mode); setDirty(true); }} />

      <section className={CARD}>
        <div className="flex flex-wrap gap-2">
          {editable && <button type="button" className={PRIMARY} disabled={busy || !dirty} onClick={() => save()}>{busy ? 'Saving…' : 'Save Fees'}</button>}
          {canEdit && data.grid.configured && (
            <button type="button" className={locked ? SECONDARY : `${BTN} bg-[#191970] text-white`} disabled={busy || dirty} onClick={toggleLock} title={dirty ? 'Save first' : ''}>
              {locked ? 'Unlock to edit' : `🔒 Lock ${term.name} fees & create student accounts`}
            </button>
          )}
        </div>
        {data.grid.billedStudents > 0 && <p className="mt-2 text-xs text-[#191970] dark:text-slate-300">{data.grid.billedStudents} student account(s) use these fees.{debtMode === 'carry' ? ' Outstanding balances from earlier terms are added to each account automatically.' : ''}</p>}
      </section>

      {column && (
        <ColumnEditor
          column={column} rows={rows}
          onApply={next => { setRows(next); setDirty(true); setEditingColumn(null); }}
          onRename={name => {
            if (columns.some(item => item.name.toLowerCase() === name.toLowerCase())) return;
            setColumns(columns.map(item => (item.name === column.name ? { ...item, name } : item)));
            const renamed = list => list.map(row => { const { [column.name]: value, ...rest } = row.amounts; return { ...row, amounts: value === undefined ? rest : { ...rest, [name]: value } }; });
            setRows(renamed(rows));
            setStudents(renamed(students));
            setEditingColumn(null); setDirty(true);
          }}
          onRemove={() => {
            const without = list => list.map(row => { const { [column.name]: removed, ...rest } = row.amounts; return { ...row, amounts: rest }; });
            setColumns(columns.filter(item => item.name !== column.name)); setRows(without(rows)); setStudents(without(students)); setEditingColumn(null); setDirty(true);
          }}
          onClose={() => setEditingColumn(null)}
        />
      )}
      {decision && <DecisionDialog decision={decision} busy={busy} onChoose={mode => save(mode)} onCancel={() => setDecision(null)} />}
    </div>
  );
}
