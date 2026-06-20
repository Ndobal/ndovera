import React, { useEffect, useState } from 'react';
import {
  CreditCardIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  InboxStackIcon,
  ArrowTrendingDownIcon,
  ChartBarIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import FeesManagementBoard from '../../../features/school/components/FeesManagementBoard';
import { getMyTenant, getExpenditure, addExpenditure, runFinanceAI, getFeesLedger } from '../../../features/school/services/schoolApi';

const TAB_META = [
  { label: 'Subscription', short: 'Subscription', Icon: CreditCardIcon },
  { label: 'Fees', short: 'Fees', Icon: BanknotesIcon },
  { label: 'Parent Payment Channels', short: 'Channels', Icon: BuildingLibraryIcon },
  { label: 'Payment Claim Queue', short: 'Claims', Icon: InboxStackIcon },
  { label: 'Expenditure', short: 'Expenditure', Icon: ArrowTrendingDownIcon },
  { label: 'Income & Expenditure', short: 'Income & Exp.', Icon: ChartBarIcon },
  { label: 'AI Analysis', short: 'AI Analysis', Icon: SparklesIcon },
];
const CARD = 'rounded-3xl p-6 bg-[#f5deb3] border border-[#c9a96e]/40';
const INNER = 'rounded-2xl p-4 bg-[#f0d090] border border-[#c9a96e]/30';
const BTN = 'bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-5 py-2.5 rounded-2xl text-sm transition-colors';

function InfoRow({ label, value }) {
  return <div><p className="text-xs text-[#800020] uppercase font-semibold">{label}</p><p className="text-[#191970] mt-1">{value || '—'}</p></div>;
}
function StatusPill({ status }) {
  const map = { active: 'bg-emerald-100 text-emerald-700', paid: 'bg-emerald-100 text-emerald-700', Paid: 'bg-emerald-100 text-emerald-700', Partial: 'bg-amber-100 text-amber-700', Unpaid: 'bg-red-100 text-red-700', pending: 'bg-amber-100 text-amber-700', suspended: 'bg-red-100 text-red-700' };
  return <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${map[status] || 'bg-slate-100 text-slate-600'}`}>{status || '—'}</span>;
}

function SubscriptionTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => { getMyTenant().then(setData).catch(e => setError(e.message)).finally(() => setLoading(false)); }, []);
  const tenant = data?.tenant; const payments = data?.payments || []; const quote = data?.quote;
  if (loading) return <div className={CARD}><p className="text-[#800020]">Loading...</p></div>;
  if (error) return <div className={CARD}><p className="text-[#800000]">{error}</p></div>;
  return (
    <div className="space-y-4">
      <div className={CARD}><h2 className="text-lg font-bold text-[#800000] mb-4">Payment Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InfoRow label="Plan" value={quote?.planName || tenant?.planKey} />
          <InfoRow label="Setup Fee" value={quote?.setupFee ? `₦${quote.setupFee.toLocaleString()}` : null} />
          <div><p className="text-xs text-[#800020] uppercase font-semibold">Status</p><div className="mt-1"><StatusPill status={tenant?.paymentStatus} /></div></div>
          <InfoRow label="Student Fee/Term" value={(quote?.studentFeePerTerm || quote?.userFeePerTerm) ? `₦${(quote.studentFeePerTerm || quote.userFeePerTerm).toLocaleString()}/student` : null} />
          <InfoRow label="Billable Students" value={tenant?.studentCount ?? tenant?.billableUserCount} />
          <InfoRow label="Term Total" value={(() => {
            // Billing is based on students only — never staff or parents.
            const fee = Number(quote?.studentFeePerTerm || quote?.userFeePerTerm || 0);
            const students = Number(tenant?.studentCount ?? tenant?.billableUserCount ?? 0);
            const studentBasedTotal = fee > 0 && students > 0 ? fee * students : null;
            const total = studentBasedTotal ?? quote?.termTotal;
            return total ? `₦${Number(total).toLocaleString()}` : null;
          })()} />
        </div>
      </div>
      <div className={CARD}><h2 className="text-lg font-bold text-[#800000] mb-4">Payment History</h2>
        {payments.length === 0 ? <p className="text-[#800020] text-sm">No payment records found.</p> :
          <div className="space-y-3">{payments.map((p, i) => (
            <div key={p.id || i} className={`${INNER} flex items-center justify-between gap-4`}>
              <div><p className="text-[#800020] font-semibold text-sm">{p.txRef || 'Payment'}</p>
                <p className="text-[#191970] text-sm">₦{(p.amount || p.amountCents / 100 || 0).toLocaleString()}</p>
                {p.paidAt && <p className="text-xs text-[#800020]/70 mt-0.5">{new Date(p.paidAt).toLocaleDateString()}</p>}
              </div><StatusPill status={p.status} />
            </div>))}
          </div>}
      </div>
    </div>
  );
}

function FeesTab({ initialFinanceTab = 'fees' }) {
  return <FeesManagementBoard initialFinanceTab={initialFinanceTab} />;
}

function ExpenditureTab() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ description: '', category: 'Salaries', amount: '', date: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }
  useEffect(() => { getExpenditure().then(d => setRecords(d?.expenditures || d?.records || [])).catch(() => {}).finally(() => setLoading(false)); }, []);
  const monthlyTotal = records.reduce((s, r) => { const now = new Date(); const d = new Date(r.date || r.createdAt || ''); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() ? s + (r.amount || 0) : s; }, 0);
  async function handleAdd() {
    if (!form.description || !form.amount) return;
    setSaving(true);
    try { await addExpenditure(form); showToast('Expense added!'); setShowModal(false); setForm({ description: '', category: 'Salaries', amount: '', date: new Date().toISOString().slice(0, 10) }); const d = await getExpenditure(); setRecords(d?.expenditures || d?.records || []); }
    catch (e) { showToast(e.message); } finally { setSaving(false); }
  }
  return (
    <div className="space-y-4">
      {toast && <div className="fixed top-6 right-6 z-50 bg-[#1a5c38] text-[#f5deb3] font-bold px-5 py-3 rounded-2xl shadow-xl">{toast}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={CARD}><p className="text-xs text-[#800020] uppercase font-semibold">This Month</p><p className="text-2xl font-bold text-[#800000] mt-1">₦{monthlyTotal.toLocaleString()}</p><p className="text-xs text-[#191970] mt-0.5">Total Expenditure</p></div>
        <div className={`${CARD} flex items-center justify-end`}><button onClick={() => setShowModal(true)} className={BTN}>+ Add Expense</button></div>
      </div>
      <div className={CARD}><h2 className="text-lg font-bold text-[#800000] mb-4">Expenditure Records</h2>
        {loading ? <p className="text-[#800020] text-sm">Loading...</p> : records.length === 0 ? <p className="text-[#800020] text-sm">No expense records.</p> :
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-[#800020] font-semibold border-b border-[#c9a96e]/40"><th className="pb-2 pr-4">Date</th><th className="pb-2 pr-4">Description</th><th className="pb-2 pr-4">Category</th><th className="pb-2 pr-4">Amount</th><th className="pb-2">By</th></tr></thead>
            <tbody>{records.map((r, i) => (<tr key={r.id || i} className="border-b border-[#c9a96e]/20"><td className="py-2 pr-4 text-[#191970]">{r.date ? new Date(r.date).toLocaleDateString() : '—'}</td><td className="py-2 pr-4 text-[#191970]">{r.description}</td><td className="py-2 pr-4 text-[#191970]">{r.category}</td><td className="py-2 pr-4 text-[#191970] font-semibold">₦{(r.amount || 0).toLocaleString()}</td><td className="py-2 text-[#191970]">{r.recordedBy || '—'}</td></tr>))}</tbody>
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

function IncomeExpenditureTab() {
  const [records, setRecords] = useState([]);
  const [ledger, setLedger] = useState([]);
  useEffect(() => { getExpenditure().then(d => setRecords(d?.expenditures || d?.records || [])).catch(() => {}); getFeesLedger().then(d => setLedger(d?.ledger || d?.fees || [])).catch(() => {}); }, []);
  const totalIncome = ledger.reduce((s, r) => s + (r.amountPaid || 0), 0);
  const totalExpenditure = records.reduce((s, r) => s + (r.amount || 0), 0);
  const netBalance = totalIncome - totalExpenditure;
  const maxVal = Math.max(totalIncome, totalExpenditure, 1);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={CARD}><p className="text-xs text-[#800020] uppercase font-semibold">Total Fees Collected</p><p className="text-2xl font-bold text-emerald-700 mt-1">₦{totalIncome.toLocaleString()}</p><p className="text-xs text-[#191970] mt-0.5">This term</p></div>
        <div className={CARD}><p className="text-xs text-[#800020] uppercase font-semibold">Total Expenditure</p><p className="text-2xl font-bold text-red-700 mt-1">₦{totalExpenditure.toLocaleString()}</p><p className="text-xs text-[#191970] mt-0.5">This term</p></div>
        <div className={CARD}><p className="text-xs text-[#800020] uppercase font-semibold">Net Balance</p><p className={`text-2xl font-bold mt-1 ${netBalance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>₦{Math.abs(netBalance).toLocaleString()}</p><p className="text-xs text-[#191970] mt-0.5">{netBalance >= 0 ? 'Surplus' : 'Deficit'}</p></div>
      </div>
      <div className={CARD}><h2 className="text-lg font-bold text-[#800000] mb-4">Income vs Expenditure</h2>
        <div className="space-y-3">
          <div><p className="text-xs text-[#800020] font-semibold mb-1">Income</p><div className="h-8 rounded-full bg-[#f0d090] overflow-hidden"><div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.round((totalIncome / maxVal) * 100)}%` }} /></div><p className="text-xs text-[#191970] mt-1">₦{totalIncome.toLocaleString()}</p></div>
          <div><p className="text-xs text-[#800020] font-semibold mb-1">Expenditure</p><div className="h-8 rounded-full bg-[#f0d090] overflow-hidden"><div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${Math.round((totalExpenditure / maxVal) * 100)}%` }} /></div><p className="text-xs text-[#191970] mt-1">₦{totalExpenditure.toLocaleString()}</p></div>
        </div>
      </div>
      <div className={CARD}><h2 className="text-lg font-bold text-[#800000] mb-3">Term Summary</h2>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-[#800020] font-semibold border-b border-[#c9a96e]/40"><th className="pb-2 pr-4">Term</th><th className="pb-2 pr-4">Income</th><th className="pb-2 pr-4">Expenditure</th><th className="pb-2">Net</th></tr></thead>
          <tbody><tr className="border-b border-[#c9a96e]/20"><td className="py-2 pr-4 text-[#191970]">Current Term</td><td className="py-2 pr-4 text-emerald-700 font-semibold">₦{totalIncome.toLocaleString()}</td><td className="py-2 pr-4 text-red-700 font-semibold">₦{totalExpenditure.toLocaleString()}</td><td className={`py-2 font-semibold ${netBalance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>₦{Math.abs(netBalance).toLocaleString()}</td></tr></tbody>
        </table></div>
      </div>
    </div>
  );
}

function AIAnalysisTab() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  async function analyse() {
    setLoading(true); setResult(null); setError('');
    try { const r = await runFinanceAI(); setResult(r?.analysis || r); }
    catch (e) { setError(e.message || 'Analysis failed.'); } finally { setLoading(false); }
  }
  return (
    <div className="space-y-4">
      <div className={CARD}><h2 className="text-lg font-bold text-[#800000] mb-2">AI Financial Analysis</h2>
        <p className="text-[#191970] text-sm mb-4">Get AI-powered insights on your school's financial health.</p>
        <button onClick={analyse} disabled={loading} className={BTN}>{loading ? 'Analysing…' : '✦ Analyse Finances'}</button>
      </div>
      {loading && <div className={CARD}><div className="flex items-center gap-3"><div className="w-5 h-5 border-2 border-[#800020] border-t-transparent rounded-full animate-spin" /><p className="text-[#191970] text-sm">Analysing your financial data…</p></div></div>}
      {error && <div className={CARD}><p className="text-[#800000] text-sm">{error.includes('AI') || error.includes('key') ? 'AI analysis requires configuration. Please contact Ndovera support.' : error}</p></div>}
      {result && <div className="space-y-4">
        {result.metrics && <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={CARD}><p className="text-xs text-[#800020] uppercase font-semibold">Collected</p><p className="text-xl font-bold text-emerald-700 mt-1">₦{Number(result.metrics.totalCollected || 0).toLocaleString()}</p><p className="text-xs text-[#191970] mt-0.5">{result.metrics.collectionRate || 0}% of expected</p></div>
          <div className={CARD}><p className="text-xs text-[#800020] uppercase font-semibold">Outstanding</p><p className="text-xl font-bold text-red-700 mt-1">₦{Number(result.metrics.totalOutstanding || 0).toLocaleString()}</p><p className="text-xs text-[#191970] mt-0.5">{(result.metrics.unpaidCount || 0) + (result.metrics.partialCount || 0)} owing</p></div>
          <div className={CARD}><p className="text-xs text-[#800020] uppercase font-semibold">Expenditure</p><p className="text-xl font-bold text-[#800000] mt-1">₦{Number(result.metrics.totalExpenditure || 0).toLocaleString()}</p><p className="text-xs text-[#191970] mt-0.5">Recorded</p></div>
          <div className={CARD}><p className="text-xs text-[#800020] uppercase font-semibold">Net Position</p><p className={`text-xl font-bold mt-1 ${Number(result.metrics.netPosition || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>₦{Math.abs(Number(result.metrics.netPosition || 0)).toLocaleString()}</p><p className="text-xs text-[#191970] mt-0.5">{Number(result.metrics.netPosition || 0) >= 0 ? 'Surplus' : 'Deficit'}</p></div>
        </div>}
        {result.summary && <div className={CARD}><h3 className="font-bold text-[#800000] mb-2">Current Term Summary{result.generatedBy === 'ai' ? <span className="ml-2 text-xs font-semibold text-[#1a5c38]">✦ AI</span> : null}</h3><p className="text-[#191970] text-sm whitespace-pre-line">{result.summary}</p></div>}
        {result.comparison && <div className={CARD}><h3 className="font-bold text-[#800000] mb-2">Spending Comparison</h3><p className="text-[#191970] text-sm whitespace-pre-line">{result.comparison}</p></div>}
        {result.debtors?.length > 0 && <div className={CARD}><h3 className="font-bold text-[#800000] mb-3">Outstanding Balances ({result.debtors.length})</h3>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-[#800020] font-semibold border-b border-[#c9a96e]/40"><th className="pb-2 pr-4">Student</th><th className="pb-2 pr-4">Class</th><th className="pb-2 pr-4">Paid</th><th className="pb-2 pr-4">Owing</th><th className="pb-2">Status</th></tr></thead>
            <tbody>{result.debtors.map((d, i) => (<tr key={d.studentId || i} className="border-b border-[#c9a96e]/20"><td className="py-2 pr-4 text-[#191970] font-semibold">{d.name}</td><td className="py-2 pr-4 text-[#191970]">{d.className || '—'}</td><td className="py-2 pr-4 text-[#191970]">₦{Number(d.amountPaid || 0).toLocaleString()}</td><td className="py-2 pr-4 text-red-700 font-semibold">₦{Number(d.balance || 0).toLocaleString()}</td><td className="py-2"><StatusPill status={d.status} /></td></tr>))}</tbody>
          </table></div>
        </div>}
        {result.suggestions?.length > 0 && <div className={CARD}><h3 className="font-bold text-[#800000] mb-3">Suggestions</h3>
          <ul className="space-y-2">{result.suggestions.map((s, i) => <li key={i} className={`${INNER} text-[#191970] text-sm flex items-start gap-2`}><span className="text-[#1a5c38] font-bold mt-0.5">→</span>{s}</li>)}</ul>
        </div>}
      </div>}
    </div>
  );
}

export default function OwnerFinance({ auth, initialTab = 0 }) {
  const [tab, setTab] = useState(Number.isFinite(initialTab) ? initialTab : 0);

  useEffect(() => {
    setTab(Number.isFinite(initialTab) ? initialTab : 0);
  }, [initialTab]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-5">
      <div className="sticky top-0 z-40 -mx-4 md:mx-0 rounded-none md:rounded-2xl border-b md:border border-[#c9a96e]/40 bg-[#f5deb3]/95 px-3 py-2 shadow-sm backdrop-blur dark:border-[#00ffff]/20 dark:bg-[#800000]/80">
        <div className="flex items-center gap-1.5 overflow-x-auto">
        {TAB_META.map((t, i) => {
          const active = tab === i;
          const Icon = t.Icon;
          return (
            <button
              key={t.label}
              onClick={() => setTab(i)}
              title={t.label}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors ${active ? 'bg-[#800020] text-[#f5deb3] shadow-sm' : 'text-[#800020] hover:bg-[#f0d090] dark:text-[#f5deb3] dark:hover:bg-[#800000]/40'}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{t.short}</span>
            </button>
          );
        })}
        </div>
      </div>
      {tab === 0 && <SubscriptionTab />}
      {tab === 1 && <FeesTab initialFinanceTab="fees" />}
      {tab === 2 && <FeesTab initialFinanceTab="channels" />}
      {tab === 3 && <FeesTab initialFinanceTab="claims" />}
      {tab === 4 && <ExpenditureTab />}
      {tab === 5 && <IncomeExpenditureTab />}
      {tab === 6 && <AIAnalysisTab />}
    </div>
  );
}
