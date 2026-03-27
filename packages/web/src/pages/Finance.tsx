import { useEffect, useMemo, useState } from 'react';
import { 
  Wallet, 
  CreditCard, 
  Download, 
  AlertCircle,
  Plus,
  Bot,
  ReceiptText,
  BadgeCheck
} from 'lucide-react';
import { Role } from '../types';
import { BillingLockBanner } from '../components/BillingLockBanner';
import { SchoolGuard } from '../components/SchoolGuard';
import { NdoveraDocsCreator } from '../components/docs/NdoveraDocsCreator';
import { createAiCreditPurchaseIntent, generatePayrollDirectorSheet, getAiCreditBalance, getAiCreditLedger, getInvoices, getPayrollAdminSnapshot, getPayrollHistory, getPricingCatalog, preparePayrollMonth, publishPayrollMonth, savePayrollMonthNote, submitInvoicePaymentProof, updatePayrollConfig, updatePayrollSlip, type AiCreditLedgerEntry, type AiCreditBalanceResponse, type Invoice, type PayrollAdminSnapshot, type PricingCatalog, type PayrollSlip } from '../services/monetizationApi';
import { useBillingLock } from '../hooks/useBillingLock';

function formatNaira(value: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatPricingPlanLabel(tier: PricingCatalog['schoolPricing']['tiers'][number]) {
  if (tier.key === 'custom' || (tier.minStudents === 0 && tier.maxStudents === 0)) return 'Custom quote';
  if (tier.key === 'growth') return 'Self-serve onboarding';
  if (tier.key === 'pro') return 'Expanded rollout';
  return tier.maxStudents === null ? `${tier.minStudents}+ students` : `${tier.minStudents} to ${tier.maxStudents} students`;
}

function formatDate(value?: string | null) {
  if (!value) return 'Pending';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

function getSlipBreakdown(slip: PayrollSlip) {
  const payroll = slip.metadata && typeof slip.metadata === 'object' ? (slip.metadata.payroll as Record<string, unknown> | undefined) : undefined;
  return {
    bonusNaira: Number(payroll?.bonusNaira || 0),
    taxNaira: Number(payroll?.taxNaira || 0),
    loanNaira: Number(payroll?.loanNaira || 0),
    note: typeof payroll?.note === 'string' ? payroll.note : '',
  };
}

export const FinanceView = ({ role }: { role: Role }) => {
  if (role && ['Ami','Super Admin','Owner'].includes(role)) return <SchoolGuard role={role} />
  const isFinanceOfficer = role === 'Finance Officer' || role === 'School Admin' || role === 'Super Admin' || role === 'HOS' || role === 'Tenant School Owner';
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'reports'>(isFinanceOfficer ? 'reports' : 'overview');
  const [pricing, setPricing] = useState<PricingCatalog | null>(null);
  const [balance, setBalance] = useState<AiCreditBalanceResponse | null>(null);
  const [ledger, setLedger] = useState<AiCreditLedgerEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [payrollSnapshot, setPayrollSnapshot] = useState<PayrollAdminSnapshot | null>(null);
  const [payrollMonthKey, setPayrollMonthKey] = useState(() => new Date().toISOString().slice(0, 7));
  const [payrollDrafts, setPayrollDrafts] = useState<Record<string, { baseSalaryNaira: number; allowancesNaira: number; deductionsNaira: number }>>({});
  const [payrollSlipDrafts, setPayrollSlipDrafts] = useState<Record<string, { baseSalaryNaira: number; bonusNaira: number; allowancesNaira: number; taxNaira: number; loanNaira: number; deductionsNaira: number; note: string }>>({});
  const [selectedPayrollMonthId, setSelectedPayrollMonthId] = useState('');
  const [payrollSearch, setPayrollSearch] = useState('');
  const [payrollStatusFilter, setPayrollStatusFilter] = useState<'all' | 'draft' | 'published'>('all');
  const [payrollNoteDraft, setPayrollNoteDraft] = useState('');
  const [directorNoteDraft, setDirectorNoteDraft] = useState('');
  const [docsCreatorOpen, setDocsCreatorOpen] = useState(false);
  const { softLockActive, overdueInvoice } = useBillingLock(role);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      getPricingCatalog(),
      getAiCreditBalance(),
      getAiCreditLedger('school'),
      getInvoices(),
      isFinanceOfficer ? getPayrollAdminSnapshot().catch(() => null) : Promise.resolve(null),
    ]).then(([pricingData, balanceData, ledgerData, invoiceData, payrollData]) => {
      if (!mounted) return;
      setPricing(pricingData);
      setBalance(balanceData);
      setLedger(ledgerData);
      setInvoices(invoiceData);
      setPayrollSnapshot(payrollData);
      if (payrollData?.configs) {
        setPayrollDrafts(Object.fromEntries(payrollData.configs.map((config) => [config.userId, {
          baseSalaryNaira: Number(config.baseSalaryNaira || 0),
          allowancesNaira: Number(config.allowancesNaira || 0),
          deductionsNaira: Number(config.deductionsNaira || 0),
        }])));
      }
      if (payrollData?.slips) {
        setPayrollSlipDrafts(Object.fromEntries(payrollData.slips.map((slip) => {
          const breakdown = getSlipBreakdown(slip);
          return [slip.id, {
            baseSalaryNaira: Number(slip.baseSalaryNaira || 0),
            bonusNaira: Number(breakdown.bonusNaira || 0),
            allowancesNaira: Number(slip.allowancesNaira || 0),
            taxNaira: Number(breakdown.taxNaira || 0),
            loanNaira: Number(breakdown.loanNaira || 0),
            deductionsNaira: Number(slip.deductionsNaira || 0),
            note: breakdown.note || '',
          }];
        })));
      }
      const nextMonth = payrollData?.months?.find((month) => month.status === 'draft') || payrollData?.months?.[0] || null;
      setSelectedPayrollMonthId((current) => current || nextMonth?.id || '');
      setPayrollNoteDraft(nextMonth?.notes || '');
      setDirectorNoteDraft(nextMonth?.directorNote || nextMonth?.notes || '');
      setSelectedPackageId((current) => current || pricingData.aiEconomy.packages[0]?.id || '');
      setSelectedInvoiceId((current) => current || invoiceData[0]?.id || '');
    }).catch((error) => {
      if (mounted) setMessage(error instanceof Error ? error.message : 'Finance data could not be loaded.');
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    setPayrollNoteDraft(selectedPayrollMonth?.notes || '');
    setDirectorNoteDraft(selectedPayrollMonth?.directorNote || selectedPayrollMonth?.notes || '');
  }, [selectedPayrollMonth?.id, selectedPayrollMonth?.notes, selectedPayrollMonth?.directorNote]);

  const outstandingBalance = useMemo(() => invoices.reduce((total, invoice) => total + Number(invoice.balanceNaira || 0), 0), [invoices]);
  const collectedRevenue = useMemo(() => invoices.reduce((total, invoice) => total + Number(invoice.paidNaira || 0), 0), [invoices]);
  const selectedPayrollMonth = useMemo(() => payrollSnapshot?.months?.find((month) => month.id === selectedPayrollMonthId) || payrollSnapshot?.months?.[0] || null, [payrollSnapshot, selectedPayrollMonthId]);
  const selectedPayrollSlips = useMemo(() => (payrollSnapshot?.slips || []).filter((slip) => slip.payrollMonthId === selectedPayrollMonth?.id), [payrollSnapshot, selectedPayrollMonth]);
  const selectedPayrollTotals = useMemo(() => selectedPayrollSlips.reduce((total, slip) => {
    const draft = payrollSlipDrafts[slip.id];
    const baseSalary = Number(draft?.baseSalaryNaira ?? slip.baseSalaryNaira ?? 0);
    const bonus = Number(draft?.bonusNaira ?? getSlipBreakdown(slip).bonusNaira ?? 0);
    const allowance = Number(draft?.allowancesNaira ?? slip.allowancesNaira ?? 0);
    const tax = Number(draft?.taxNaira ?? getSlipBreakdown(slip).taxNaira ?? 0);
    const loan = Number(draft?.loanNaira ?? getSlipBreakdown(slip).loanNaira ?? 0);
    const deduction = Number(draft?.deductionsNaira ?? slip.deductionsNaira ?? 0);
    const gross = baseSalary + bonus + allowance;
    const net = Math.max(0, gross - tax - loan - deduction);
    return {
      gross: total.gross + gross,
      net: total.net + net,
      deductions: total.deductions + tax + loan + deduction,
    };
  }, { gross: 0, net: 0, deductions: 0 }), [payrollSlipDrafts, selectedPayrollSlips]);

  const refreshPayroll = async () => {
    if (!isFinanceOfficer) return;
    const snapshot = await getPayrollAdminSnapshot();
    setPayrollSnapshot(snapshot);
    setPayrollDrafts(Object.fromEntries((snapshot.configs || []).map((config) => [config.userId, {
      baseSalaryNaira: Number(config.baseSalaryNaira || 0),
      allowancesNaira: Number(config.allowancesNaira || 0),
      deductionsNaira: Number(config.deductionsNaira || 0),
    }])));
    setPayrollSlipDrafts(Object.fromEntries((snapshot.slips || []).map((slip) => {
      const breakdown = getSlipBreakdown(slip);
      return [slip.id, {
        baseSalaryNaira: Number(slip.baseSalaryNaira || 0),
        bonusNaira: Number(breakdown.bonusNaira || 0),
        allowancesNaira: Number(slip.allowancesNaira || 0),
        taxNaira: Number(breakdown.taxNaira || 0),
        loanNaira: Number(breakdown.loanNaira || 0),
        deductionsNaira: Number(slip.deductionsNaira || 0),
        note: breakdown.note || '',
      }];
    })));
    const nextMonth = snapshot.months?.find((month) => month.id === selectedPayrollMonthId) || snapshot.months?.find((month) => month.status === 'draft') || snapshot.months?.[0] || null;
    setSelectedPayrollMonthId(nextMonth?.id || '');
    setPayrollNoteDraft(nextMonth?.notes || '');
    setDirectorNoteDraft(nextMonth?.directorNote || nextMonth?.notes || '');
  };

  const requestCreditPurchase = async () => {
    if (!selectedPackageId) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await createAiCreditPurchaseIntent({ packageId: selectedPackageId, ownerType: 'school' });
      setMessage(`Purchase intent created. Invoice ${response.purchase.invoiceId || response.purchase.id} is ready for payment proof or webhook settlement.`);
      const refreshedInvoices = await getInvoices();
      setInvoices(refreshedInvoices);
      if (response.purchase.invoiceId) setSelectedInvoiceId(response.purchase.invoiceId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'AI credit purchase intent failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const uploadPaymentProof = async () => {
    if (!selectedInvoiceId || !proofUrl.trim()) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const updatedInvoice = await submitInvoicePaymentProof(selectedInvoiceId, { proofUrl: proofUrl.trim() });
      setInvoices((current) => current.map((invoice) => invoice.id === updatedInvoice.id ? updatedInvoice : invoice));
      setProofUrl('');
      setMessage(`Payment proof submitted for invoice ${updatedInvoice.id}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Payment proof upload failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePreparePayrollMonth = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const snapshot = await preparePayrollMonth({ monthKey: payrollMonthKey });
      setPayrollSnapshot(snapshot);
      setMessage(`Payroll draft prepared for ${payrollMonthKey}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to prepare payroll month.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSearchPayrollHistory = async () => {
    if (!isFinanceOfficer) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const snapshot = await getPayrollHistory({
        search: payrollSearch.trim() || undefined,
        monthKey: payrollMonthKey || undefined,
        status: payrollStatusFilter === 'all' ? undefined : payrollStatusFilter,
      });
      setPayrollSnapshot(snapshot);
      const nextMonth = snapshot.months?.[0] || null;
      setSelectedPayrollMonthId(nextMonth?.id || '');
      setPayrollNoteDraft(nextMonth?.notes || '');
      setDirectorNoteDraft(nextMonth?.directorNote || nextMonth?.notes || '');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to search payroll history.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublishPayrollMonth = async (monthId: string) => {
    setSubmitting(true);
    setMessage(null);
    try {
      const snapshot = await publishPayrollMonth(monthId);
      setPayrollSnapshot(snapshot);
      setMessage('Payroll month published. Slips without verified KYC were held automatically.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to publish payroll month.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSavePayrollRow = async (userId: string) => {
    const draft = payrollDrafts[userId];
    if (!draft) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await updatePayrollConfig({
        userId,
        baseSalaryNaira: Number(draft.baseSalaryNaira || 0),
        allowancesNaira: Number(draft.allowancesNaira || 0),
        deductionsNaira: Number(draft.deductionsNaira || 0),
      });
      await refreshPayroll();
      setMessage('Payroll configuration updated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update payroll configuration.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSavePayrollSlipRow = async (slipId: string) => {
    const draft = payrollSlipDrafts[slipId];
    if (!draft) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await updatePayrollSlip({
        slipId,
        baseSalaryNaira: Number(draft.baseSalaryNaira || 0),
        bonusNaira: Number(draft.bonusNaira || 0),
        allowancesNaira: Number(draft.allowancesNaira || 0),
        taxNaira: Number(draft.taxNaira || 0),
        loanNaira: Number(draft.loanNaira || 0),
        deductionsNaira: Number(draft.deductionsNaira || 0),
        note: draft.note || null,
      });
      await refreshPayroll();
      setMessage('Payroll sheet row saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save payroll sheet row.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSavePayrollNote = async (generateDefault = false) => {
    if (!selectedPayrollMonth) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const snapshot = await savePayrollMonthNote({
        monthId: selectedPayrollMonth.id,
        notes: payrollNoteDraft,
        directorNote: directorNoteDraft,
        generateDefault,
      });
      setPayrollSnapshot(snapshot);
      const month = snapshot.months.find((entry) => entry.id === selectedPayrollMonth.id) || snapshot.months[0];
      setSelectedPayrollMonthId(month?.id || '');
      setPayrollNoteDraft(month?.notes || '');
      setDirectorNoteDraft(month?.directorNote || month?.notes || '');
      setMessage(generateDefault ? 'Payroll note generated.' : 'Payroll note saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save payroll note.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateDirectorSheet = async () => {
    if (!selectedPayrollMonth) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const snapshot = await generatePayrollDirectorSheet(selectedPayrollMonth.id);
      setPayrollSnapshot(snapshot);
      setMessage('Director sheet generated from the current payroll month.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to generate director sheet.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {softLockActive ? <BillingLockBanner invoiceId={overdueInvoice?.id} dismissible={false} compact /> : null}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">

      {docsCreatorOpen ? (
        <NdoveraDocsCreator
          onClose={() => setDocsCreatorOpen(false)}
          initialTitle={selectedPayrollMonth ? `Payroll Note ${selectedPayrollMonth.monthKey}` : 'Payroll Note'}
          initialContent={payrollNoteDraft}
          onSave={async ({ content }) => {
            setPayrollNoteDraft(content);
            if (selectedPayrollMonth) {
              const snapshot = await savePayrollMonthNote({
                monthId: selectedPayrollMonth.id,
                notes: content,
                directorNote: directorNoteDraft,
              });
              setPayrollSnapshot(snapshot);
            }
          }}
        />
      ) : null}
            {isFinanceOfficer ? 'Financial Management' : 'Fees & Payments'}
          </h2>
          <p className="text-zinc-500 text-xs">
            {isFinanceOfficer ? 'Manage school-wide finances, track payments, and generate reports.' : 'Manage your school fees and view transaction history.'}
          </p>
        </div>
        <div className="flex gap-2">
          {isFinanceOfficer && (
            <button className="bg-white/5 border border-white/5 text-zinc-400 px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-white/10 transition-all">
              <Download size={14} /> Financial Report
            </button>
          )}
          <button onClick={() => activeTab === 'reports' ? setActiveTab('overview') : setActiveTab('reports')} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors shadow-lg shadow-emerald-900/20 flex items-center gap-2">
            <Plus size={16} /> {activeTab === 'reports' ? 'Open Overview' : 'Open Billing Actions'}
          </button>
        </div>
      </div>

      {message ? (
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">{message}</div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Balance Card */}
          <div className={`relative overflow-hidden ${isFinanceOfficer ? 'bg-blue-600' : 'bg-emerald-600'} rounded-3xl p-8 text-white shadow-2xl shadow-emerald-900/20`}>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                    {isFinanceOfficer ? 'Total School Revenue (Term 2)' : 'Total Outstanding Balance'}
                  </p>
                  <h3 className="text-4xl font-mono font-bold mt-1">
                    {loading ? 'Loading...' : formatNaira(isFinanceOfficer ? collectedRevenue : outstandingBalance)}
                  </h3>
                </div>
                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                  <Wallet size={24} />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-lg text-[10px] font-bold uppercase">
                  {pricing?.schoolPricing.currencyCode || 'NGN'} pricing
                </div>
                <p className="text-[10px] font-medium opacity-80">
                  {isFinanceOfficer ? `${invoices.length} invoice${invoices.length === 1 ? '' : 's'} tracked` : `${balance?.schoolWallet.balanceCredits ?? 0} school AI credits available`}
                </p>
              </div>
            </div>
            {/* Decorative circles */}
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-black/10 rounded-full blur-3xl"></div>
          </div>

          {/* Payment History */}
          <div className="card-compact">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Invoices And Payments</h3>
              <button onClick={() => setActiveTab('history')} className="text-[10px] font-bold text-emerald-500 hover:underline">View Ledger</button>
            </div>
            <div className="space-y-3">
              {(invoices.length ? invoices : []).map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between rounded-xl border border-white/5 p-3 transition-all group hover:bg-white/2">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-emerald-500">
                      <ReceiptText size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-200">{invoice.invoiceType}</p>
                      <p className="text-[9px] text-zinc-500 font-mono">{invoice.id} &bull; Due {formatDate(invoice.dueAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs font-mono font-bold text-white">{formatNaira(invoice.totalNaira)}</p>
                      <p className="text-[8px] font-bold text-emerald-500 uppercase">{invoice.status}</p>
                    </div>
                    <div className="text-right text-[10px] text-zinc-500">
                      <p>Paid {formatNaira(invoice.paidNaira)}</p>
                      <p>Balance {formatNaira(invoice.balanceNaira)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {!loading && !invoices.length ? <div className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-sm text-zinc-500">No monetization invoices have been generated yet.</div> : null}
            </div>
          </div>

          <div className="card-compact">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">AI Credit Ledger</h3>
              <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-sky-400">
                <Bot size={14} /> School Wallet
              </div>
            </div>
            <div className="space-y-3">
              {ledger.slice(0, 6).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between rounded-xl border border-white/5 px-4 py-3">
                  <div>
                    <p className="text-xs font-bold text-zinc-200">{entry.entryType}</p>
                    <p className="text-[9px] text-zinc-500 font-mono">{formatDate(entry.createdAt)} &bull; {entry.referenceId || 'no reference'}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-bold ${entry.direction === 'debit' ? 'text-rose-400' : 'text-emerald-400'}`}>{entry.direction === 'debit' ? '' : '+'}{entry.creditsDelta}</p>
                    <p className="text-[9px] text-zinc-500">Balance {entry.balanceAfter}</p>
                  </div>
                </div>
              ))}
              {!loading && !ledger.length ? <div className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-sm text-zinc-500">No AI credit activity recorded yet.</div> : null}
            </div>
          </div>

          {isFinanceOfficer ? (
            <div className="card-compact">
              <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Payroll Control</h3>
                  <p className="mt-2 text-sm text-zinc-500">Staff are pulled automatically from the school staff list. No one needs to add staff manually here. If a salary already exists from a previous month, it is reused; otherwise the system seeds a first-month default that you can edit in the payroll sheet.</p>
                </div>
                <div className="flex items-center gap-2">
                  <input type="month" value={payrollMonthKey} onChange={(event) => setPayrollMonthKey(event.target.value)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none" />
                  <button onClick={() => void handlePreparePayrollMonth()} disabled={submitting} className="rounded-xl bg-emerald-600 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60">Prepare month</button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-3 mb-6">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Total net payroll</div><div className="mt-2 text-2xl font-bold text-white">{formatNaira(payrollSnapshot?.overview.totalNetNaira || 0)}</div></div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Published slips</div><div className="mt-2 text-2xl font-bold text-white">{payrollSnapshot?.overview.publishedCount || 0}</div></div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Held by KYC</div><div className="mt-2 text-2xl font-bold text-white">{payrollSnapshot?.overview.pendingKycCount || 0}</div></div>
              </div>

              <div className="space-y-6">
                <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Payroll history and month search</div>
                        <div className="mt-2 text-sm text-zinc-400">Search by staff, month, role, or note. Published months remain searchable while draft months stay editable.</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input value={payrollSearch} onChange={(event) => setPayrollSearch(event.target.value)} placeholder="Search staff or note" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none" />
                        <select value={payrollStatusFilter} onChange={(event) => setPayrollStatusFilter(event.target.value as 'all' | 'draft' | 'published')} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none">
                          <option value="all">All months</option>
                          <option value="draft">Draft only</option>
                          <option value="published">Published only</option>
                        </select>
                        <button onClick={() => void handleSearchPayrollHistory()} disabled={submitting} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-white/10 disabled:opacity-60">Search</button>
                        <button onClick={() => void refreshPayroll()} disabled={submitting} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-white/10 disabled:opacity-60">Reset</button>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Current month totals</div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl bg-white/5 p-3"><div className="text-[10px] uppercase tracking-widest text-zinc-500">Gross</div><div className="mt-2 text-lg font-bold text-white">{formatNaira(selectedPayrollTotals.gross)}</div></div>
                      <div className="rounded-2xl bg-white/5 p-3"><div className="text-[10px] uppercase tracking-widest text-zinc-500">Total deductions</div><div className="mt-2 text-lg font-bold text-white">{formatNaira(selectedPayrollTotals.deductions)}</div></div>
                      <div className="rounded-2xl bg-white/5 p-3"><div className="text-[10px] uppercase tracking-widest text-zinc-500">Net payable</div><div className="mt-2 text-lg font-bold text-white">{formatNaira(selectedPayrollTotals.net)}</div></div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Full payroll spreadsheet table</div>
                        <div className="mt-2 text-sm text-zinc-400">Month: {selectedPayrollMonth?.monthKey || 'Select a payroll month'}{selectedPayrollMonth ? ` • ${selectedPayrollMonth.status}` : ''}</div>
                      </div>
                      {selectedPayrollMonth?.status !== 'published' && selectedPayrollMonth ? <button onClick={() => void handlePublishPayrollMonth(selectedPayrollMonth.id)} disabled={submitting} className="rounded-xl bg-sky-500 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-sky-400 disabled:opacity-60">Publish payroll</button> : null}
                    </div>
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-7xl w-full border-separate border-spacing-y-2 text-left">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                            <th className="px-3 py-2">Staff</th>
                            <th className="px-3 py-2">Role</th>
                            <th className="px-3 py-2">Salary</th>
                            <th className="px-3 py-2">Bonus</th>
                            <th className="px-3 py-2">Allowance</th>
                            <th className="px-3 py-2">Gross</th>
                            <th className="px-3 py-2">Tax</th>
                            <th className="px-3 py-2">Loan</th>
                            <th className="px-3 py-2">Other deduct</th>
                            <th className="px-3 py-2">Net</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPayrollSlips.map((slip) => {
                            const draft = payrollSlipDrafts[slip.id] || {
                              baseSalaryNaira: slip.baseSalaryNaira,
                              bonusNaira: getSlipBreakdown(slip).bonusNaira,
                              allowancesNaira: slip.allowancesNaira,
                              taxNaira: getSlipBreakdown(slip).taxNaira,
                              loanNaira: getSlipBreakdown(slip).loanNaira,
                              deductionsNaira: slip.deductionsNaira,
                              note: getSlipBreakdown(slip).note,
                            };
                            const gross = Number(draft.baseSalaryNaira || 0) + Number(draft.bonusNaira || 0) + Number(draft.allowancesNaira || 0);
                            const net = Math.max(0, gross - Number(draft.taxNaira || 0) - Number(draft.loanNaira || 0) - Number(draft.deductionsNaira || 0));
                            return (
                              <tr key={slip.id} className="rounded-2xl bg-white/5 text-sm text-white">
                                <td className="rounded-l-2xl px-3 py-3"><div className="font-semibold">{slip.staffName}</div><div className="text-[10px] uppercase tracking-widest text-zinc-500">{slip.monthKey}</div></td>
                                <td className="px-3 py-3 text-zinc-300">{slip.roleName}</td>
                                <td className="px-3 py-3"><input type="number" min={0} value={draft.baseSalaryNaira} onChange={(event) => setPayrollSlipDrafts((current) => ({ ...current, [slip.id]: { ...draft, baseSalaryNaira: Number(event.target.value || 0) } }))} className="w-28 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none" /></td>
                                <td className="px-3 py-3"><input type="number" min={0} value={draft.bonusNaira} onChange={(event) => setPayrollSlipDrafts((current) => ({ ...current, [slip.id]: { ...draft, bonusNaira: Number(event.target.value || 0) } }))} className="w-24 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none" /></td>
                                <td className="px-3 py-3"><input type="number" min={0} value={draft.allowancesNaira} onChange={(event) => setPayrollSlipDrafts((current) => ({ ...current, [slip.id]: { ...draft, allowancesNaira: Number(event.target.value || 0) } }))} className="w-24 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none" /></td>
                                <td className="px-3 py-3 font-semibold text-emerald-300">{formatNaira(gross)}</td>
                                <td className="px-3 py-3"><input type="number" min={0} value={draft.taxNaira} onChange={(event) => setPayrollSlipDrafts((current) => ({ ...current, [slip.id]: { ...draft, taxNaira: Number(event.target.value || 0) } }))} className="w-24 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none" /></td>
                                <td className="px-3 py-3"><input type="number" min={0} value={draft.loanNaira} onChange={(event) => setPayrollSlipDrafts((current) => ({ ...current, [slip.id]: { ...draft, loanNaira: Number(event.target.value || 0) } }))} className="w-24 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none" /></td>
                                <td className="px-3 py-3"><input type="number" min={0} value={draft.deductionsNaira} onChange={(event) => setPayrollSlipDrafts((current) => ({ ...current, [slip.id]: { ...draft, deductionsNaira: Number(event.target.value || 0) } }))} className="w-24 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none" /></td>
                                <td className="px-3 py-3 font-semibold text-white">{formatNaira(net)}</td>
                                <td className="px-3 py-3"><span className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-300">{slip.status}</span></td>
                                <td className="rounded-r-2xl px-3 py-3">
                                  <button onClick={() => void handleSavePayrollSlipRow(slip.id)} disabled={submitting || selectedPayrollMonth?.status === 'published'} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-white/10 disabled:opacity-60">Save</button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {!selectedPayrollSlips.length ? <div className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-sm text-zinc-500">Prepare or select a payroll month to open the spreadsheet.</div> : null}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Payroll note and director sheet</div>
                          <div className="mt-2 text-sm text-zinc-400">Use the built-in document creator for the payroll note, then save or generate the director sheet from the same month.</div>
                        </div>
                        <button onClick={() => setDocsCreatorOpen(true)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-white/10">Open document creator</button>
                      </div>
                      <div className="mt-4 space-y-3">
                        <textarea value={payrollNoteDraft} onChange={(event) => setPayrollNoteDraft(event.target.value)} rows={7} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" placeholder="Payroll note" />
                        <textarea value={directorNoteDraft} onChange={(event) => setDirectorNoteDraft(event.target.value)} rows={5} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none" placeholder="Director note" />
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => void handleSavePayrollNote(false)} disabled={submitting || !selectedPayrollMonth || selectedPayrollMonth.status === 'published'} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-white/10 disabled:opacity-60">Save note</button>
                          <button onClick={() => void handleSavePayrollNote(true)} disabled={submitting || !selectedPayrollMonth || selectedPayrollMonth.status === 'published'} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-white/10 disabled:opacity-60">Generate note</button>
                          <button onClick={() => void handleGenerateDirectorSheet()} disabled={submitting || !selectedPayrollMonth} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-white/10 disabled:opacity-60">Director sheet</button>
                        </div>
                        {selectedPayrollMonth?.directorSheet ? <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-100">Director sheet is available for {selectedPayrollMonth.monthKey}. It will be regenerated from the current month rows each time you click the button.</div> : null}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Payroll months and release history</div>
                      <div className="mt-4 max-h-112 space-y-3 overflow-auto pr-1">
                        {(payrollSnapshot?.months || []).map((month) => (
                          <button key={month.id} type="button" onClick={() => setSelectedPayrollMonthId(month.id)} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-bold text-white">{month.monthKey}</div>
                                <div className="mt-1 text-[10px] uppercase tracking-widest text-zinc-500">{month.status}</div>
                              </div>
                              {month.status === 'published' ? <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-emerald-200"><BadgeCheck size={12} /> Published</div> : <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-sky-100">Draft</div>}
                            </div>
                            <div className="mt-3 text-xs text-zinc-400">Published at: {formatDate(month.publishedAt)}</div>
                          </button>
                        ))}
                        {!payrollSnapshot?.months?.length ? <div className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-sm text-zinc-500">No payroll month has been prepared yet.</div> : null}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Salary defaults from staff list</div>
                      <div className="mt-4 space-y-3">
                        {(payrollSnapshot?.configs || []).slice(0, 6).map((config) => (
                          <div key={config.userId} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-bold text-white">{config.staffName}</div>
                                <div className="text-[10px] uppercase tracking-widest text-zinc-500">{config.roleName}</div>
                              </div>
                              <div className="text-[10px] text-zinc-500">Auto-synced</div>
                            </div>
                            <div className="mt-3 grid gap-3 md:grid-cols-3">
                              <input type="number" min={0} value={payrollDrafts[config.userId]?.baseSalaryNaira ?? config.baseSalaryNaira} onChange={(event) => setPayrollDrafts((current) => ({ ...current, [config.userId]: { ...(current[config.userId] || { baseSalaryNaira: config.baseSalaryNaira, allowancesNaira: config.allowancesNaira, deductionsNaira: config.deductionsNaira }), baseSalaryNaira: Number(event.target.value || 0) } }))} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none" />
                              <input type="number" min={0} value={payrollDrafts[config.userId]?.allowancesNaira ?? config.allowancesNaira} onChange={(event) => setPayrollDrafts((current) => ({ ...current, [config.userId]: { ...(current[config.userId] || { baseSalaryNaira: config.baseSalaryNaira, allowancesNaira: config.allowancesNaira, deductionsNaira: config.deductionsNaira }), allowancesNaira: Number(event.target.value || 0) } }))} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none" />
                              <input type="number" min={0} value={payrollDrafts[config.userId]?.deductionsNaira ?? config.deductionsNaira} onChange={(event) => setPayrollDrafts((current) => ({ ...current, [config.userId]: { ...(current[config.userId] || { baseSalaryNaira: config.baseSalaryNaira, allowancesNaira: config.allowancesNaira, deductionsNaira: config.deductionsNaira }), deductionsNaira: Number(event.target.value || 0) } }))} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none" />
                            </div>
                            <div className="mt-3 flex justify-end">
                              <button onClick={() => void handleSavePayrollRow(config.userId)} disabled={submitting} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-white/10 disabled:opacity-60">Save defaults</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="card-compact">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">AI Credit Packages</h3>
            <div className="space-y-3">
              {pricing?.aiEconomy.packages.map((pkg) => (
                <button key={pkg.id} onClick={() => setSelectedPackageId(pkg.id)} className={`w-full rounded-xl border px-4 py-3 text-left transition ${selectedPackageId === pkg.id ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-zinc-100">{pkg.label}</p>
                      <p className="text-[9px] text-zinc-500 uppercase font-bold">{pkg.aiCredits} credits</p>
                    </div>
                    <div className="text-right text-xs font-mono font-bold text-white">{formatNaira(pkg.nairaAmount)}</div>
                  </div>
                </button>
              ))}
              <button onClick={() => void requestCreditPurchase()} disabled={!selectedPackageId || submitting} className="w-full py-3 rounded-xl bg-emerald-600 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? 'Processing...' : 'Create Credit Purchase Intent'}
              </button>
            </div>
          </div>

          <div className="card-compact bg-orange-500/5 border-orange-500/10">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard size={16} className="text-orange-500" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-orange-500">Submit Payment Proof</h3>
            </div>
            <div className="space-y-3">
              <select value={selectedInvoiceId} onChange={(event) => setSelectedInvoiceId(event.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none">
                <option value="">Select invoice</option>
                {invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.id} • {formatNaira(invoice.balanceNaira)}</option>)}
              </select>
              <input value={proofUrl} onChange={(event) => setProofUrl(event.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none" placeholder="https://payment-proof.example/receipt.jpg" />
              <button onClick={() => void uploadPaymentProof()} disabled={!selectedInvoiceId || !proofUrl.trim() || submitting} className="w-full rounded-xl bg-orange-500 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60">
                Upload proof
              </button>
            </div>
          </div>

          <div className="card-compact bg-sky-500/5 border-sky-500/10">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle size={16} className="text-sky-400" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-sky-400">Pricing Snapshot</h3>
            </div>
            <div className="space-y-3 text-[10px] text-zinc-400">
              {pricing?.schoolPricing.tiers.map((tier) => (
                <div key={tier.key} className="rounded-xl border border-white/5 bg-white/2 px-3 py-3">
                  <p className="text-xs font-bold text-zinc-200">{tier.label}</p>
                  <p className="mt-1">{formatPricingPlanLabel(tier)}</p>
                  <p>Setup {formatNaira(tier.oneTimeSetupNaira)} • {formatNaira(tier.perStudentPerTermNaira)} / student / term from second term</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
