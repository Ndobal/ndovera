import React, { useEffect, useState } from 'react';
import {
  getStoreItems, saveStoreItem, deleteStoreItem,
  recordStoreMovement, getStoreMovements,
  recordStoreMisplacement, getStoreSurcharges, payStoreSurcharge,
} from '../services/schoolApi';

const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const input = 'w-full rounded-xl border border-[#c9a96e]/40 bg-white px-3 py-2 text-sm text-[#191970] outline-none focus:ring-2 focus:ring-[#1a5c38] dark:border-white/10 dark:bg-slate-800 dark:text-slate-100';
const btn = 'rounded-xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#b5e3f4] transition hover:bg-[#154a2e] disabled:opacity-50';
const chip = (active) => `rounded-full px-4 py-1.5 text-xs font-bold transition ${active ? 'bg-[#191970] text-white' : 'bg-[#191970]/10 text-[#191970] dark:bg-white/10 dark:text-slate-200'}`;

const EMPTY_ITEM = { name: '', category: '', quantity: 0, unit: '', location: '', reorderLevel: 0, notes: '' };

export default function StoreKeeperPanel() {
  const [tab, setTab] = useState('items');
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [surcharges, setSurcharges] = useState([]);
  const [form, setForm] = useState(EMPTY_ITEM);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [misplace, setMisplace] = useState(null); // item being marked misplaced

  async function loadAll() {
    try {
      const [a, b, c] = await Promise.all([getStoreItems(), getStoreMovements().catch(() => ({})), getStoreSurcharges().catch(() => ({}))]);
      setItems(a.items || []); setMovements(b.movements || []); setSurcharges(c.surcharges || []);
    } catch (e) { setMessage(e.message || 'Could not load the store.'); }
  }
  useEffect(() => { loadAll(); }, []);

  async function saveItem(e) {
    e.preventDefault();
    if (!form.name.trim()) { setMessage('Item name is required.'); return; }
    setBusy(true); setMessage('');
    try { await saveStoreItem(form); setForm(EMPTY_ITEM); await loadAll(); setMessage('Saved.'); }
    catch (err) { setMessage(err.message || 'Could not save.'); } finally { setBusy(false); }
  }

  async function move(item, type) {
    const qtyStr = window.prompt(`${type === 'in' ? 'Add stock' : type === 'issue' ? 'Issue' : 'Return'} — quantity of "${item.name}":`, '1');
    if (qtyStr == null) return;
    const quantity = Number(qtyStr);
    if (!(quantity > 0)) { setMessage('Enter a valid quantity.'); return; }
    let userName = '';
    if (type === 'issue' || type === 'return') userName = window.prompt('Staff/person name:', '') || '';
    try { await recordStoreMovement({ itemId: item.id, type, quantity, userName }); await loadAll(); }
    catch (err) { setMessage(err.message || 'Could not record movement.'); }
  }

  async function submitMisplacement(payload) {
    setBusy(true); setMessage('');
    try { await recordStoreMisplacement({ itemId: misplace.id, ...payload }); setMisplace(null); await loadAll(); setMessage('Recorded.'); }
    catch (err) { setMessage(err.message || 'Could not record misplacement.'); } finally { setBusy(false); }
  }

  async function settle(s) {
    const amt = window.prompt(`Record payment toward ${s.userName}'s charge for "${s.itemName}". Outstanding: ${naira.format(s.amount - s.amountPaid)}. Amount (blank = settle fully):`, '');
    if (amt == null) return;
    try { await payStoreSurcharge(s.id, amt ? Number(amt) : 0); await loadAll(); }
    catch (err) { setMessage(err.message || 'Could not record payment.'); }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-black text-[#800000] dark:text-slate-100">Store Keeper</h1>
        <div className="flex gap-2">
          {[['items', `Items (${items.length})`], ['activity', 'Activity'], ['surcharges', `Surcharges (${surcharges.filter(s => s.status !== 'settled').length})`]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={chip(tab === k)}>{l}</button>
          ))}
        </div>
      </div>
      {message ? <p className="text-sm text-[#1a5c38] dark:text-emerald-300">{message}</p> : null}

      {tab === 'items' && (
        <>
          <form onSubmit={saveItem} className="grid gap-3 rounded-2xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-4 sm:grid-cols-3 dark:border-white/10 dark:bg-slate-900/40">
            <input className={input} placeholder="Item name" value={form.name} onChange={e => setForm(c => ({ ...c, name: e.target.value }))} />
            <input className={input} placeholder="Category" value={form.category} onChange={e => setForm(c => ({ ...c, category: e.target.value }))} />
            <input className={input} placeholder="Location" value={form.location} onChange={e => setForm(c => ({ ...c, location: e.target.value }))} />
            <input className={input} type="number" placeholder="Quantity" value={form.quantity} onChange={e => setForm(c => ({ ...c, quantity: e.target.value }))} />
            <input className={input} placeholder="Unit (e.g. pcs)" value={form.unit} onChange={e => setForm(c => ({ ...c, unit: e.target.value }))} />
            <input className={input} type="number" placeholder="Reorder level" value={form.reorderLevel} onChange={e => setForm(c => ({ ...c, reorderLevel: e.target.value }))} />
            <div className="sm:col-span-3"><button type="submit" disabled={busy} className={btn}>{form.id ? 'Update item' : 'Add item'}</button></div>
          </form>

          <div className="space-y-2">
            {items.map(item => (
              <div key={item.id} className="rounded-2xl border border-[#c9a96e]/35 bg-white/70 p-3 dark:border-white/10 dark:bg-slate-900/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-[#14215b] dark:text-slate-100">{item.name} <span className={`ml-2 text-xs ${item.quantity <= item.reorderLevel ? 'text-red-600' : 'text-[#4a5578]'}`}>{item.quantity} {item.unit}</span></p>
                    <p className="text-xs text-[#4a5578] dark:text-slate-400">{[item.category, item.location].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => move(item, 'in')} className="rounded-lg border border-[#1a5c38]/40 px-2.5 py-1 text-xs font-semibold text-[#1a5c38]">Stock in</button>
                    <button type="button" onClick={() => move(item, 'issue')} className="rounded-lg border border-[#14215b]/30 px-2.5 py-1 text-xs font-semibold text-[#14215b] dark:text-slate-200">Issue</button>
                    <button type="button" onClick={() => move(item, 'return')} className="rounded-lg border border-[#14215b]/30 px-2.5 py-1 text-xs font-semibold text-[#14215b] dark:text-slate-200">Return</button>
                    <button type="button" onClick={() => setMisplace(item)} className="rounded-lg border border-amber-500/50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">Misplaced</button>
                    <button type="button" onClick={() => setForm({ ...item })} className="rounded-lg border border-[#800020]/30 px-2.5 py-1 text-xs font-semibold text-[#800020]">Edit</button>
                    <button type="button" onClick={async () => { await deleteStoreItem(item.id); loadAll(); }} className="rounded-lg border border-red-400/40 px-2.5 py-1 text-xs font-semibold text-red-600">Delete</button>
                  </div>
                </div>
              </div>
            ))}
            {!items.length ? <p className="text-sm text-[#4a5578] dark:text-slate-400">No items yet. Add your first stock item above.</p> : null}
          </div>
        </>
      )}

      {tab === 'activity' && (
        <div className="space-y-2">
          {movements.map(m => (
            <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#c9a96e]/30 bg-white/60 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/40">
              <span className="text-[#14215b] dark:text-slate-200"><b className="capitalize">{m.type}</b> {m.quantity} × {m.itemName}{m.userName ? ` → ${m.userName}` : ''}</span>
              <span className="text-xs text-[#4a5578] dark:text-slate-400">{m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}</span>
            </div>
          ))}
          {!movements.length ? <p className="text-sm text-[#4a5578] dark:text-slate-400">No activity yet.</p> : null}
        </div>
      )}

      {tab === 'surcharges' && (
        <div className="space-y-2">
          {surcharges.map(s => (
            <div key={s.id} className="rounded-2xl border border-[#c9a96e]/35 bg-white/70 p-3 dark:border-white/10 dark:bg-slate-900/40">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-bold text-[#14215b] dark:text-slate-100">{s.userName} — {s.itemName}</p>
                  <p className="text-xs text-[#4a5578] dark:text-slate-400">{naira.format(s.amount)} · {s.mode}{s.mode === 'installment' ? ` (${s.installments})` : ''} · paid {naira.format(s.amountPaid)} · <b className={s.status === 'settled' ? 'text-emerald-600' : 'text-amber-600'}>{s.status}</b></p>
                </div>
                {s.status !== 'settled' ? <button type="button" onClick={() => settle(s)} className={btn}>Record payment</button> : null}
              </div>
            </div>
          ))}
          {!surcharges.length ? <p className="text-sm text-[#4a5578] dark:text-slate-400">No surcharges. When someone misplaces an item, raise a replacement or a salary surcharge from the Items tab.</p> : null}
        </div>
      )}

      {misplace ? <MisplaceModal item={misplace} onClose={() => setMisplace(null)} onSubmit={submitMisplacement} busy={busy} /> : null}
    </div>
  );
}

function MisplaceModal({ item, onClose, onSubmit, busy }) {
  const [userName, setUserName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [resolution, setResolution] = useState('replace');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('once');
  const [installments, setInstallments] = useState(3);
  const [note, setNote] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 dark:bg-slate-900" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-black text-[#191970] dark:text-slate-100">Misplaced: {item.name}</h3>
        <input className={input} placeholder="Who misplaced it? (staff name)" value={userName} onChange={e => setUserName(e.target.value)} />
        <input className={input} type="number" placeholder="Quantity" value={quantity} onChange={e => setQuantity(e.target.value)} />
        <div className="flex gap-2">
          {[['replace', 'Make them replace it'], ['surcharge', 'Surcharge from salary']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setResolution(k)} className={chip(resolution === k)}>{l}</button>
          ))}
        </div>
        {resolution === 'surcharge' && (
          <>
            <input className={input} type="number" placeholder="Surcharge amount (₦)" value={amount} onChange={e => setAmount(e.target.value)} />
            <div className="flex gap-2">
              {[['once', 'Once'], ['installment', 'Installments']].map(([k, l]) => (
                <button key={k} type="button" onClick={() => setMode(k)} className={chip(mode === k)}>{l}</button>
              ))}
              {mode === 'installment' ? <input className={`${input} max-w-[120px]`} type="number" placeholder="No. of months" value={installments} onChange={e => setInstallments(e.target.value)} /> : null}
            </div>
          </>
        )}
        <input className={input} placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-500">Cancel</button>
          <button type="button" disabled={busy || !userName.trim()} onClick={() => onSubmit({ userName, quantity: Number(quantity) || 1, resolution, amount: Number(amount) || 0, mode, installments: Number(installments) || 1, note })} className={btn}>
            {busy ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
