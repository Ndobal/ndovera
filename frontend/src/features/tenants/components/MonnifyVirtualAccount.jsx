import React, { useEffect, useState } from 'react';
import { getMonnifyAccount, getMonnifyBanks, createMonnifyVirtualAccount } from '../../school/services/schoolApi';

const inputClass = 'mt-1 w-full rounded-xl border border-[#c9a96e]/40 dark:border-white/10 bg-[#fff8ee] dark:bg-slate-800 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1a5c38]';
const labelClass = 'text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold';

export default function MonnifyVirtualAccount() {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [account, setAccount] = useState(null);
  const [banks, setBanks] = useState([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ accountName: '', customerEmail: '', bvn: '', nin: '', settlementBankCode: '', settlementAccountNumber: '' });

  function load() {
    setLoading(true);
    getMonnifyAccount()
      .then(d => { setConfigured(!!d?.configured); setAccount(d?.account || null); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function openForm() {
    setShowForm(true);
    setMsg('');
    if (banks.length === 0) {
      setBanksLoading(true);
      getMonnifyBanks().then(d => setBanks(d?.banks || [])).catch(() => {}).finally(() => setBanksLoading(false));
    }
    if (account) {
      setForm(f => ({
        ...f,
        accountName: account.customerName || f.accountName,
        customerEmail: account.customerEmail || f.customerEmail,
        settlementBankCode: account.settlement?.bankCode || f.settlementBankCode,
        settlementAccountNumber: account.settlement?.accountNumber || f.settlementAccountNumber,
      }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const bank = banks.find(b => b.code === form.settlementBankCode);
      const res = await createMonnifyVirtualAccount({ ...form, settlementBankName: bank?.name || '' });
      if (res?.success) {
        setMsg('Virtual account created.');
        setAccount(res.account);
        setShowForm(false);
      } else {
        setMsg(res?.message || 'Could not create the virtual account.');
      }
    } catch (err) {
      setMsg(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-[#800020] dark:text-slate-300 text-sm">Loading virtual account…</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 bg-[#f5deb3] dark:bg-slate-800/40 border border-[#c9a96e]/40 dark:border-white/10">
        <h2 className="text-xl font-bold text-[#800000] dark:text-slate-100">Virtual Account (Payments)</h2>
        <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">Collect admission and school fees into a dedicated bank account. Money paid in settles automatically to your school&apos;s main account.</p>
        {!configured && <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">Payments are not enabled on this platform yet — please check back soon.</p>}
      </div>

      {account && (
        <div className="rounded-2xl p-5 bg-[#fff8ee] dark:bg-slate-900/40 border border-[#c9a96e]/40 dark:border-white/10 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold text-[#800000] dark:text-slate-100">Your Virtual Account</p>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${String(account.status).toUpperCase() === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'}`}>{account.status || 'PENDING'}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(account.accounts || []).map((a, i) => (
              <div key={i} className="rounded-xl border border-[#c9a96e]/40 dark:border-white/10 bg-white dark:bg-slate-800 p-3">
                <p className="text-xs text-[#800020] dark:text-slate-400">{a.bankName}</p>
                <p className="text-lg font-black text-[#191970] dark:text-slate-100 tracking-wider">{a.accountNumber}</p>
              </div>
            ))}
            {(account.accounts || []).length === 0 && <p className="text-sm text-[#800020] dark:text-slate-400">Account numbers will appear here once issued.</p>}
          </div>
          <p className="text-sm text-[#191970] dark:text-slate-300">Settles to: <strong>{account.settlement?.accountName || account.settlement?.accountNumber || '—'}</strong>{account.settlement?.bankName ? ` (${account.settlement.bankName})` : ''}</p>
          <button type="button" onClick={openForm} className="text-xs font-bold text-[#1a5c38] dark:text-[#00ffff] underline">Update settlement / re-activate</button>
        </div>
      )}

      {configured && !account && !showForm && (
        <button type="button" onClick={openForm} className="bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">
          Create Virtual Account
        </button>
      )}

      {showForm && configured && (
        <form onSubmit={handleSubmit} className="rounded-2xl p-5 bg-[#f5deb3] dark:bg-slate-800/40 border border-[#c9a96e]/40 dark:border-white/10 space-y-3">
          <p className="font-bold text-[#800000] dark:text-slate-100">Create / Activate Virtual Account</p>
          <p className="text-xs text-[#800020] dark:text-slate-400">Your NIN and BVN are used only to activate the account with the bank and are not stored by us. Provide at least one.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className={labelClass}>Account Name</label><input value={form.accountName} onChange={e => setForm(f => ({ ...f, accountName: e.target.value }))} className={inputClass} placeholder="School / collection account name" required /></div>
            <div><label className={labelClass}>Contact Email</label><input type="email" value={form.customerEmail} onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))} className={inputClass} required /></div>
            <div><label className={labelClass}>BVN</label><input value={form.bvn} onChange={e => setForm(f => ({ ...f, bvn: e.target.value.replace(/\D/g, '') }))} className={inputClass} placeholder="11 digits" inputMode="numeric" maxLength={11} /></div>
            <div><label className={labelClass}>NIN</label><input value={form.nin} onChange={e => setForm(f => ({ ...f, nin: e.target.value.replace(/\D/g, '') }))} className={inputClass} placeholder="11 digits" inputMode="numeric" maxLength={11} /></div>
            <div>
              <label className={labelClass}>Settlement Bank</label>
              <select value={form.settlementBankCode} onChange={e => setForm(f => ({ ...f, settlementBankCode: e.target.value }))} className={inputClass} required>
                <option value="">{banksLoading ? 'Loading banks…' : 'Select bank'}</option>
                {banks.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
              </select>
            </div>
            <div><label className={labelClass}>Settlement Account Number</label><input value={form.settlementAccountNumber} onChange={e => setForm(f => ({ ...f, settlementAccountNumber: e.target.value.replace(/\D/g, '') }))} className={inputClass} placeholder="10 digits" inputMode="numeric" maxLength={10} required /></div>
          </div>
          {msg && <p className={`text-sm ${/created/i.test(msg) ? 'text-[#1a5c38]' : 'text-red-600'}`}>{msg}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-5 py-2 rounded-xl text-sm transition-colors disabled:opacity-60">{saving ? 'Creating…' : 'Create Virtual Account'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm font-semibold border border-[#c9a96e]/40 dark:border-white/10 text-[#800020] dark:text-slate-300">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
