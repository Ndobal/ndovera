import React, { useCallback, useEffect, useState } from 'react';
import {
  createFeeStructure, getItemOptIns, getStructureStudents, issueStructureBills, listFeeStructures, naira,
  previewFeeStructureCopy, saveItemOptIns, setFeeStructureStatus, updateFeeStructure,
} from './financeApi';
import { CARD, INPUT, Notice, PRIMARY, SECONDARY, StatusChip, TD, TH } from './FinanceShared';

// Fee structures: what each class is charged per term. Draft → Published →
// Closed. Bills are issued from a published structure; editing a structure
// never reprices bills already issued.

const BLANK_ITEM = { name: '', amount: '', required: true, frequency: 'term' };
const FREQUENCY_LABELS = { term: 'Every term', annual: 'Once a session', once: 'One-off' };

function ItemsEditor({ items, onChange, disabled }) {
  const update = (index, patch) => onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm text-[#191970]">
          <thead><tr><th className={TH}>Fee item</th><th className={TH}>Amount (₦)</th><th className={TH}>Required</th><th className={TH}>Charged</th><th className={TH}><span className="sr-only">Remove</span></th></tr></thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index}>
                <td className={TD}><input aria-label="Fee item" className={`${INPUT} w-full`} value={item.name} disabled={disabled} placeholder="e.g. Tuition" onChange={event => update(index, { name: event.target.value })} /></td>
                <td className={TD}><input aria-label="Amount" type="number" min="0" className={`${INPUT} w-32`} value={item.amount} disabled={disabled} onChange={event => update(index, { amount: event.target.value })} /></td>
                <td className={TD}><label className="inline-flex items-center gap-1"><input type="checkbox" checked={item.required} disabled={disabled} onChange={event => update(index, { required: event.target.checked })} /> {item.required ? 'Required' : 'Optional'}</label></td>
                <td className={TD}><select aria-label="How often" className={INPUT} value={item.frequency} disabled={disabled} onChange={event => update(index, { frequency: event.target.value })}>{Object.entries(FREQUENCY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></td>
                <td className={TD}>{!disabled && <button type="button" className="text-xs font-bold text-rose-700 underline" onClick={() => onChange(items.filter((_, i) => i !== index))}>Remove</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!disabled && <button type="button" className={SECONDARY} onClick={() => onChange([...items, { ...BLANK_ITEM }])}>+ Add item</button>}
      <p className="text-sm font-bold text-[#191970]">Required total per student: {naira(items.filter(item => item.required).reduce((sum, item) => sum + (Number(item.amount) || 0), 0))}</p>
    </div>
  );
}

function StructureForm({ context, structures, onSaved, onCancel }) {
  const [termId, setTermId] = useState(context.period.termId || '');
  const [classId, setClassId] = useState('');
  const [items, setItems] = useState([{ ...BLANK_ITEM }]);
  const [copiedFromId, setCopiedFromId] = useState('');
  const [copySource, setCopySource] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function loadCopy(sourceId) {
    setCopiedFromId(sourceId);
    setCopySource(null);
    if (!sourceId) return;
    try {
      const preview = await previewFeeStructureCopy(sourceId);
      setItems(preview.items.map(item => ({ ...item, amount: String(item.amount) })));
      setCopySource(preview.source);
    } catch (err) { setError(err.message); }
  }

  async function save() {
    setBusy(true); setError('');
    try {
      const { structure } = await createFeeStructure({ termId, classId, items, copiedFromId: copiedFromId || undefined });
      onSaved(structure);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <section className={`${CARD} space-y-3`} aria-label="New fee structure">
      <h3 className="text-lg font-black text-[#800000] dark:text-white">New fee structure</h3>
      <div className="flex flex-wrap gap-2">
        <select aria-label="Term" className={INPUT} value={termId} onChange={event => setTermId(event.target.value)}>
          <option value="">Choose term…</option>
          {context.sessions.map(session => <optgroup key={session.id} label={session.name}>{session.terms.map(term => <option key={term.id} value={term.id}>{session.name} · {term.name}</option>)}</optgroup>)}
        </select>
        <select aria-label="Class" className={INPUT} value={classId} onChange={event => setClassId(event.target.value)}>
          <option value="">Choose class…</option>
          {context.classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select aria-label="Start from a previous structure" className={INPUT} value={copiedFromId} onChange={event => loadCopy(event.target.value)}>
          <option value="">Start from blank</option>
          {structures.map(structure => <option key={structure.id} value={structure.id}>Copy {structure.className} · {structure.sessionName} {structure.termName}</option>)}
        </select>
      </div>
      {copySource && <p className="rounded-xl bg-white/70 px-3 py-2 text-sm text-[#191970]">Copied from {copySource.className} · {copySource.sessionName} {copySource.termName}. Change anything below — the original stays exactly as it is.</p>}
      <ItemsEditor items={items} onChange={setItems} />
      <Notice text={error} tone="error" />
      <div className="flex gap-2">
        <button type="button" className={PRIMARY} disabled={busy || !termId || !classId} onClick={save}>{busy ? 'Saving…' : 'Save as draft'}</button>
        <button type="button" className={SECONDARY} onClick={onCancel}>Cancel</button>
      </div>
    </section>
  );
}

function OptInsEditor({ structure, item, onClose }) {
  const [students, setStudents] = useState(null);
  const [chosen, setChosen] = useState(new Set());
  const [notice, setNotice] = useState('');
  useEffect(() => {
    Promise.all([getStructureStudents(structure.id), getItemOptIns(item.id)]).then(([register, optins]) => {
      setStudents(register.students);
      setChosen(new Set(optins.studentIds));
    }).catch(err => setNotice(err.message));
  }, [structure.id, item.id]);
  const toggle = studentId => setChosen(previous => { const next = new Set(previous); if (next.has(studentId)) next.delete(studentId); else next.add(studentId); return next; });
  async function save() {
    try { await saveItemOptIns(item.id, [...chosen]); setNotice(`Saved — ${chosen.size} student(s) take ${item.name}. Issue bills to charge them.`); } catch (err) { setNotice(err.message); }
  }
  return (
    <div className="mt-3 rounded-2xl bg-white/70 p-3">
      <p className="text-sm font-bold text-[#191970]">Who takes {item.name}?</p>
      {!students ? <p role="status">Loading…</p> : students.length === 0 ? <p className="text-sm">No students on the register.</p> : (
        <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {students.map(student => <label key={student.studentId} className="flex items-center gap-2 text-sm text-[#191970]"><input type="checkbox" checked={chosen.has(student.studentId)} onChange={() => toggle(student.studentId)} />{student.studentName || student.studentId}</label>)}
        </div>
      )}
      <Notice text={notice} />
      <div className="mt-2 flex gap-2"><button type="button" className={PRIMARY} onClick={save}>Save</button><button type="button" className={SECONDARY} onClick={onClose}>Close</button></div>
    </div>
  );
}

function StructureCard({ structure, canManage, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState(structure.items);
  const [optInItem, setOptInItem] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ text: '', tone: 'ok' });
  useEffect(() => { setItems(structure.items.map(item => ({ ...item, amount: String(item.amount) }))); }, [structure]);

  const run = async (action, success) => {
    setBusy(true); setNotice({ text: '', tone: 'ok' });
    try { const result = await action(); setNotice({ text: success(result), tone: 'ok' }); onChanged(); } catch (err) { setNotice({ text: err.message, tone: 'error' }); } finally { setBusy(false); }
  };

  return (
    <article className="rounded-2xl bg-white/70 p-4 text-[#191970]">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="flex-1 font-black">{structure.className} <span className="font-semibold text-[#191970]/70">· {structure.sessionName} {structure.termName}</span></h4>
        <StatusChip status={structure.status} />
      </div>
      {editing ? <div className="mt-2"><ItemsEditor items={items} onChange={setItems} /></div> : (
        <ul className="mt-2 space-y-0.5 text-sm">
          {structure.items.map(item => (
            <li key={item.id} className="flex flex-wrap items-center gap-2">
              <span className="flex-1">{item.name}{!item.required && <span className="ml-1 text-xs">(optional)</span>}{item.frequency !== 'term' && <span className="ml-1 text-xs">({item.frequency === 'annual' ? 'once a session' : 'one-off'})</span>}</span>
              <span className="font-semibold">{naira(item.amount)}</span>
              {canManage && !item.required && structure.status !== 'closed' && <button type="button" className="text-xs font-bold text-[#800020] underline" onClick={() => setOptInItem(item)}>Who takes it</button>}
            </li>
          ))}
        </ul>
      )}
      {optInItem && <OptInsEditor structure={structure} item={optInItem} onClose={() => setOptInItem(null)} />}
      {canManage && (
        <div className="mt-3 flex flex-wrap gap-2">
          {editing ? (
            <>
              <button type="button" className={PRIMARY} disabled={busy} onClick={() => run(() => updateFeeStructure(structure.id, items), () => { setEditing(false); return 'Saved. Bills already issued keep their amounts.'; })}>Save</button>
              <button type="button" className={SECONDARY} onClick={() => setEditing(false)}>Cancel</button>
            </>
          ) : (
            <>
              {structure.status !== 'closed' && <button type="button" className={SECONDARY} onClick={() => setEditing(true)}>Edit</button>}
              {structure.status === 'draft' && <button type="button" className={PRIMARY} disabled={busy} onClick={() => run(() => setFeeStructureStatus(structure.id, 'published'), () => 'Published. Issue bills when ready.')}>Publish</button>}
              {structure.status === 'published' && <button type="button" className={PRIMARY} disabled={busy} onClick={() => run(() => issueStructureBills(structure.id), result => `${result.issued} bill(s) issued${result.alreadyBilled ? `, ${result.alreadyBilled} already billed` : ''}${result.skippedLegacy?.length ? `. Already billed in Term Fees: ${result.skippedLegacy.join(', ')}` : ''}.`)}>Issue bills</button>}
              {structure.status === 'published' && <button type="button" className={SECONDARY} disabled={busy} onClick={() => run(() => setFeeStructureStatus(structure.id, 'closed'), () => 'Closed. Its bills stay on each student’s ledger until settled.')}>Close</button>}
            </>
          )}
        </div>
      )}
      <div className="mt-2"><Notice text={notice.text} tone={notice.tone} /></div>
    </article>
  );
}

export default function FeeStructuresTab({ context }) {
  const [filters, setFilters] = useState({ termId: context.period.termId || '', classId: '' });
  const [structures, setStructures] = useState(null);
  const [allStructures, setAllStructures] = useState([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    listFeeStructures(filters).then(data => setStructures(data.structures)).catch(err => setError(err.message));
    listFeeStructures().then(data => setAllStructures(data.structures)).catch(() => {});
  }, [filters]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <section className={`${CARD} space-y-3`}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="flex-1 text-lg font-black text-[#800000] dark:text-white">Fee structures</h3>
          {context.canManage && !creating && <button type="button" className={PRIMARY} onClick={() => setCreating(true)}>+ New structure</button>}
        </div>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Filter by term" className={INPUT} value={filters.termId} onChange={event => setFilters(previous => ({ ...previous, termId: event.target.value }))}>
            <option value="">All terms</option>
            {context.sessions.map(session => <optgroup key={session.id} label={session.name}>{session.terms.map(term => <option key={term.id} value={term.id}>{session.name} · {term.name}</option>)}</optgroup>)}
          </select>
          <select aria-label="Filter by class" className={INPUT} value={filters.classId} onChange={event => setFilters(previous => ({ ...previous, classId: event.target.value }))}>
            <option value="">All classes</option>
            {context.classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
      </section>
      {creating && <StructureForm context={context} structures={allStructures} onCancel={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
      <Notice text={error} tone="error" />
      {!structures ? <p role="status">Loading…</p> : structures.length === 0 ? <p className="text-sm text-[#191970] dark:text-slate-300">No fee structures for this filter yet.</p> : (
        <div className="grid gap-3 lg:grid-cols-2">{structures.map(structure => <StructureCard key={structure.id} structure={structure} canManage={context.canManage} onChanged={load} />)}</div>
      )}
    </div>
  );
}
