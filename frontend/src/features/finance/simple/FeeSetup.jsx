import React, { useEffect, useMemo, useState } from 'react';
import { bulkEdit, getSavedTemplate, getTermGrid, lockTermFees, naira, previewChanges, rowTotal, saveTermGrid } from './simpleFeesApi';

// A term's fees as one table: classes down the side, fee items across the top,
// every amount editable in place. Reuse last term, change what changed, save,
// lock. Changing fees after students are billed asks what should happen first.

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
  const locked = Boolean(data?.grid?.lock?.locked);
  const editable = canEdit && !locked;

  function load(nextTermId = termId, fromSource = source) {
    setData(null);
    getTermGrid(nextTermId).then(async result => {
      setData(result);
      if (!nextTermId) setTermId(result.grid.term.id);
      let baseColumns = result.grid.columns;
      let baseRows = result.grid.rows.map(row => ({ classId: row.classId, className: row.className, amounts: { ...row.amounts } }));
      // A term with no fees yet starts from the chosen source.
      if (!result.grid.configured && fromSource) {
        if (fromSource.type === 'reuse') {
          const previous = await getTermGrid(fromSource.termId);
          baseColumns = previous.grid.columns;
          const byClass = new Map(previous.grid.rows.map(row => [row.classId, row.amounts]));
          baseRows = baseRows.map(row => ({ ...row, amounts: { ...(byClass.get(row.classId) || {}) } }));
          setNotice({ text: `Copied from ${previous.grid.term.sessionName} ${previous.grid.term.name}. Only the fees were copied — no student balances. Change anything, then Save.`, tone: 'ok' });
        } else if (fromSource.type === 'template') {
          const template = await getSavedTemplate(nextTermId || result.grid.term.id);
          if (template.found) {
            baseColumns = template.columns;
            const byClass = new Map(template.rows.map(row => [row.classId, row.amounts]));
            baseRows = baseRows.map(row => ({ ...row, amounts: { ...(byClass.get(row.classId) || {}) } }));
            setNotice({ text: 'Loaded from your saved fee template. Change anything, then Save.', tone: 'ok' });
          } else setNotice({ text: 'No saved fee template was found — start from the items below.', tone: 'warn' });
        } else if (fromSource.type === 'new') {
          baseColumns = [{ name: 'Tuition', required: true, frequency: 'term' }];
        }
        setDirty(true);
      }
      setColumns(baseColumns.length ? baseColumns : [{ name: 'Tuition', required: true, frequency: 'term' }]);
      setRows(baseRows);
    }).catch(err => setNotice({ text: err.message, tone: 'error' }));
  }
  useEffect(() => { load(termId, source); }, [termId]); // eslint-disable-line react-hooks/exhaustive-deps

  const setCell = (classId, column, value) => { setRows(previous => previous.map(row => (row.classId === classId ? { ...row, amounts: { ...row.amounts, [column]: value } } : row))); setDirty(true); };
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
      const payload = { termId: data.grid.term.id, columns, rows: rows.map(row => ({ classId: row.classId, amounts: Object.fromEntries(Object.entries(row.amounts).map(([key, value]) => [key, Number(value) || 0])) })), changeMode };
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
    setBusy(true); setNotice({ text: '', tone: 'ok' });
    try {
      const result = await lockTermFees(data.grid.term.id, locked, locked ? 'Unlocked to edit fees' : '');
      setNotice({ text: locked ? 'Unlocked. You can change the fees; changes for students already billed will ask what to do.' : `Locked. ${result.students} student account(s) are ready.`, tone: 'ok' });
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
        {!canEdit && <p className="text-sm text-[#191970] dark:text-slate-300">You can view the fees. Only {data.settings.editors.join(', ')} can change them.</p>}
        {locked && canEdit && <p className="text-sm text-[#191970] dark:text-slate-300">These fees are official. Unlock them to make a change.</p>}
        {notice.text && <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`rounded-xl px-3 py-2 text-sm font-semibold ${notice.tone === 'error' ? 'bg-rose-50 text-rose-800' : notice.tone === 'warn' ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-[#1a5c38]'}`}>{notice.text}</p>}
      </section>

      <section className={CARD}>
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
        <div className="mt-4 flex flex-wrap gap-2">
          {editable && <button type="button" className={PRIMARY} disabled={busy || !dirty} onClick={() => save()}>{busy ? 'Saving…' : 'Save Fees'}</button>}
          {canEdit && data.grid.configured && (
            <button type="button" className={locked ? SECONDARY : `${BTN} bg-[#191970] text-white`} disabled={busy || dirty} onClick={toggleLock} title={dirty ? 'Save first' : ''}>
              {locked ? 'Unlock to edit' : `🔒 Lock ${term.name} fees & create student accounts`}
            </button>
          )}
        </div>
        {data.grid.billedStudents > 0 && <p className="mt-2 text-xs text-[#191970] dark:text-slate-300">{data.grid.billedStudents} student account(s) use these fees. Outstanding balances from earlier terms are added to each account automatically.</p>}
      </section>

      {column && (
        <ColumnEditor
          column={column} rows={rows}
          onApply={next => { setRows(next); setDirty(true); setEditingColumn(null); }}
          onRename={name => {
            if (columns.some(item => item.name.toLowerCase() === name.toLowerCase())) return;
            setColumns(columns.map(item => (item.name === column.name ? { ...item, name } : item)));
            setRows(rows.map(row => { const { [column.name]: value, ...rest } = row.amounts; return { ...row, amounts: { ...rest, [name]: value } }; }));
            setEditingColumn(null); setDirty(true);
          }}
          onRemove={() => { setColumns(columns.filter(item => item.name !== column.name)); setRows(rows.map(row => { const { [column.name]: removed, ...rest } = row.amounts; return { ...row, amounts: rest }; })); setEditingColumn(null); setDirty(true); }}
          onClose={() => setEditingColumn(null)}
        />
      )}
      {decision && <DecisionDialog decision={decision} busy={busy} onChoose={mode => save(mode)} onCancel={() => setDecision(null)} />}
    </div>
  );
}
