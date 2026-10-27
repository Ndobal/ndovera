import React, { useEffect, useState } from 'react';
import {
  BanknotesIcon,
  BuildingLibraryIcon,
  InboxStackIcon,
  ArrowTrendingDownIcon,
  ChartBarIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import FeesManagementBoard from '../../../features/school/components/FeesManagementBoard';
import SimpleFees from '../../../features/finance/simple/SimpleFees';
import { FinanceReport, IncomeExpenditure, TermFeeTemplate, formatDay } from '../../../features/finance/TermFinance';
import { getExpenditure, addExpenditure } from '../../../features/school/services/schoolApi';

// Fees & Billing is the everyday fee screen (set a term's fees, balances,
// payments). The older Term Fees board is no longer listed; its bills appear on
// student accounts as earlier records. Every tab follows the current term in
// Academic Sessions, so their figures agree with Fees & Billing.
const TAB_META = [
  { label: 'Fees & Billing', short: 'Fees & Billing', Icon: BanknotesIcon },
  { label: 'Fees', short: 'Fee Template', Icon: BanknotesIcon },
  { label: 'Parent Payment Channels', short: 'Channels', Icon: BuildingLibraryIcon },
  { label: 'Payment Claim Queue', short: 'Claims', Icon: InboxStackIcon },
  { label: 'Expenditure', short: 'Expenditure', Icon: ArrowTrendingDownIcon },
  { label: 'Income & Expenditure', short: 'Income & Exp.', Icon: ChartBarIcon },
  { label: 'AI Analysis', short: 'AI Analysis', Icon: SparklesIcon },
];
const CARD = 'rounded-3xl p-6 bg-[#b5e3f4] border border-[#c9a96e]/40';
const BTN = 'bg-[#1a5c38] hover:bg-[#154a2e] text-[#b5e3f4] font-bold px-5 py-2.5 rounded-2xl text-sm transition-colors';

function FeesTab({ initialFinanceTab = 'fees', onEditTerm }) {
  // The Fee Template shows the current term's fees from Fees & Billing; a term still
  // run on the earlier board (and earlier terms) open that board.
  if (initialFinanceTab === 'fees') return <TermFeeTemplate onEdit={onEditTerm} legacy={<FeesManagementBoard initialFinanceTab="fees" />} />;
  return <FeesManagementBoard initialFinanceTab={initialFinanceTab} />;
}

/** Spending inside the running term: from its start to its end (or today, while it runs). */
function inTerm(record, period) {
  if (!period?.termStart) return false;
  const day = String(record.date || record.createdAt || '').slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const end = period.termEnd && period.termEnd < today ? period.termEnd.slice(0, 10) : today;
  return day >= period.termStart.slice(0, 10) && day <= end;
}

function ExpenditureTab() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ description: '', category: 'Salaries', amount: '', date: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [period, setPeriod] = useState(null);
  const [scope, setScope] = useState('term');
  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }
  const load = () => getExpenditure().then(d => { setRecords(d?.expenditures || d?.records || []); setPeriod(d?.period || null); });
  useEffect(() => { load().catch(() => {}).finally(() => setLoading(false)); }, []);
  const termRecords = records.filter(r => inTerm(r, period));
  const termTotal = termRecords.reduce((s, r) => s + (r.amount || 0), 0);
  const shown = scope === 'term' && period?.termStart ? termRecords : records;
  const termNote = period?.termName ? `${period.termName}, ${period.sessionName}${period.termStart ? ` · from ${formatDay(period.termStart)}` : ' · no start date in Academic Sessions'}` : 'No term open';
  const monthlyTotal = records.reduce((s, r) => { const now = new Date(); const d = new Date(r.date || r.createdAt || ''); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() ? s + (r.amount || 0) : s; }, 0);
  async function handleAdd() {
    if (!form.description || !form.amount) return;
    setSaving(true);
    try { await addExpenditure(form); showToast('Expense added!'); setShowModal(false); setForm({ description: '', category: 'Salaries', amount: '', date: new Date().toISOString().slice(0, 10) }); await load(); }
    catch (e) { showToast(e.message); } finally { setSaving(false); }
  }
  return (
    <div className="space-y-4">
      {toast && <div className="fixed top-6 right-6 z-50 bg-[#1a5c38] text-[#b5e3f4] font-bold px-5 py-3 rounded-2xl shadow-xl">{toast}</div>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={CARD}><p className="text-xs text-[#800020] uppercase font-semibold">This Term</p><p className="text-2xl font-bold text-[#800000] mt-1">₦{termTotal.toLocaleString()}</p><p className="text-xs text-[#191970] mt-0.5">{termNote}</p></div>
        <div className={CARD}><p className="text-xs text-[#800020] uppercase font-semibold">This Month</p><p className="text-2xl font-bold text-[#800000] mt-1">₦{monthlyTotal.toLocaleString()}</p><p className="text-xs text-[#191970] mt-0.5">Total Expenditure</p></div>
        <div className={`${CARD} flex items-center justify-end`}><button onClick={() => setShowModal(true)} className={BTN}>+ Add Expense</button></div>
      </div>
      <div className={CARD}><div className="mb-4 flex flex-wrap items-center gap-2"><h2 className="flex-1 text-lg font-bold text-[#800000]">Expenditure Records</h2>
          {period?.termStart && [['term', `This term (${termRecords.length})`], ['all', `All (${records.length})`]].map(([key, label]) => <button key={key} type="button" onClick={() => setScope(key)} className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${scope === key ? 'bg-[#800020] text-[#b5e3f4]' : 'bg-white text-[#800020]'}`}>{label}</button>)}</div>
        {loading ? <p className="text-[#800020] text-sm">Loading...</p> : shown.length === 0 ? <p className="text-[#800020] text-sm">{records.length ? 'No expenses are dated inside this term yet.' : 'No expense records.'}</p> :
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-[#800020] font-semibold border-b border-[#c9a96e]/40"><th className="pb-2 pr-4">Date</th><th className="pb-2 pr-4">Description</th><th className="pb-2 pr-4">Category</th><th className="pb-2 pr-4">Amount</th><th className="pb-2">By</th></tr></thead>
            <tbody>{shown.map((r, i) => (<tr key={r.id || i} className="border-b border-[#c9a96e]/20"><td className="py-2 pr-4 text-[#191970]">{r.date ? new Date(r.date).toLocaleDateString() : '—'}</td><td className="py-2 pr-4 text-[#191970]">{r.description}</td><td className="py-2 pr-4 text-[#191970]">{r.category}</td><td className="py-2 pr-4 text-[#191970] font-semibold">₦{(r.amount || 0).toLocaleString()}</td><td className="py-2 text-[#191970]">{r.recordedBy || '—'}</td></tr>))}</tbody>
          </table></div>}
      </div>
      {showModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"><div className={`${CARD} w-full max-w-md`}><h3 className="text-base font-bold text-[#800000] mb-4">Add Expense</h3>
        <div className="space-y-3">
          <div><label className="text-xs font-semibold text-[#800020]">Description</label><input value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} className="w-full mt-1 rounded-xl border border-[#c9a96e]/40 p-2 text-[#191970]" /></div>
          <div><label className="text-xs font-semibold text-[#800020]">Category</label><select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))} className="w-full mt-1 rounded-xl border border-[#c9a96e]/40 p-2 text-[#191970]"><option>Salaries</option><option>Utilities</option><option>Supplies</option><option>Maintenance</option><option>Events</option><option>Other</option></select></div>
          <div><label className="text-xs font-semibold text-[#800020]">Amount (₦)</label><input type="number" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} className="w-full mt-1 rounded-xl border border-[#c9a96e]/40 p-2 text-[#191970]" /></div>
          <div><label className="text-xs font-semibold text-[#800020]">Date</label><input type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} className="w-full mt-1 rounded-xl border border-[#c9a96e]/40 p-2 text-[#191970]" /></div>
        </div>
        <div className="flex gap-3 mt-4"><button onClick={handleAdd} disabled={saving} className={BTN}>{saving ? 'Saving…' : 'Add Expense'}</button><button onClick={() => setShowModal(false)} className="text-[#800020] font-semibold px-4 py-2 text-sm">Cancel</button></div>
      </div></div>}
    </div>
  );
}

// Callers may name the tab they want rather than counting positions, so adding a
// tab never silently re-points someone else's link.
function resolveTabIndex(requested) {
  if (typeof requested === 'string') {
    const found = TAB_META.findIndex(t => t.label === requested || t.short === requested);
    return found >= 0 ? found : 0;
  }
  return Number.isFinite(requested) ? requested : 0;
}

export default function OwnerFinance({ auth, initialTab = 0 }) {
  const [tab, setTab] = useState(resolveTabIndex(initialTab));
  // "Edit fees" from the Fee Template opens Fees & Billing's Fee Setup on that term.
  const [setupTermId, setSetupTermId] = useState('');

  useEffect(() => {
    setTab(resolveTabIndex(initialTab));
  }, [initialTab]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-5">
      <div className="sticky top-0 z-40 -mx-4 md:mx-0 rounded-none md:rounded-2xl border-b md:border border-[#c9a96e]/40 bg-[#b5e3f4]/95 px-3 py-2 shadow-sm backdrop-blur dark:border-[#00ffff]/20 dark:bg-[#800000]/80">
        <div className="flex items-center gap-1.5 overflow-x-auto">
        {TAB_META.map((t, i) => {
          const active = tab === i;
          const Icon = t.Icon;
          return (
            <button
              key={t.label}
              onClick={() => { setTab(i); setSetupTermId(''); }}
              title={t.label}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors ${active ? 'bg-[#800020] text-[#b5e3f4] shadow-sm' : 'text-[#800020] hover:bg-[#ade1f4] dark:text-[#b5e3f4] dark:hover:bg-[#800000]/40'}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{t.short}</span>
            </button>
          );
        })}
        </div>
      </div>
      {tab === 0 && <SimpleFees key={setupTermId || 'fees'} initialSetupTermId={setupTermId} />}
      {tab === 1 && <FeesTab initialFinanceTab="fees" onEditTerm={termId => { setSetupTermId(termId); setTab(0); }} />}
      {tab === 2 && <FeesTab initialFinanceTab="channels" />}
      {tab === 3 && <FeesTab initialFinanceTab="claims" />}
      {tab === 4 && <ExpenditureTab />}
      {tab === 5 && <IncomeExpenditure />}
      {tab === 6 && <FinanceReport />}
    </div>
  );
}
