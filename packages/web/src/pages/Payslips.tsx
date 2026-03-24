import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BadgeCheck, CheckCircle2, CreditCard, Download, FileSpreadsheet, ShieldAlert, Wallet } from 'lucide-react';
import { getPayrollSelfService, savePayrollPayoutProfile, type PayrollPayoutProfile, type PayrollSlip } from '../services/monetizationApi';
import { loadUser } from '../services/authLocal';

function formatNaira(value: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatMonthLabel(monthKey?: string) {
  if (!monthKey) return 'Payroll record';
  const value = new Date(`${monthKey}-01T00:00:00.000Z`);
  if (Number.isNaN(value.getTime())) return monthKey;
  return value.toLocaleString('en-NG', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function getSlipBreakdown(slip: PayrollSlip | null) {
  const payroll = slip?.metadata && typeof slip.metadata === 'object' ? (slip.metadata.payroll as Record<string, unknown> | undefined) : undefined;
  return {
    bonusNaira: Number(payroll?.bonusNaira || 0),
    taxNaira: Number(payroll?.taxNaira || 0),
    loanNaira: Number(payroll?.loanNaira || 0),
    rowNote: typeof payroll?.note === 'string' ? payroll.note : '',
    monthNote: typeof slip?.metadata?.monthNote === 'string' ? slip.metadata.monthNote : '',
  };
}

export function PayslipsView() {
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profile, setProfile] = useState<PayrollPayoutProfile | null>(null);
  const [slips, setSlips] = useState<PayrollSlip[]>([]);
  const currentUser = loadUser();
  const staffName = currentUser?.name || 'Staff Member';
  const staffRole = currentUser?.activeRole || currentUser?.roles?.[0] || 'Staff';
  const [formState, setFormState] = useState({
    accountName: currentUser?.name || '',
    bankName: '',
    accountNumber: '',
    bvn: '',
    nin: '',
  });

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getPayrollSelfService()
      .then((payload) => {
        if (!mounted) return;
        setProfile(payload.profile || null);
        setSlips(payload.slips || []);
        if (payload.profile) {
          setFormState({
            accountName: payload.profile.accountName || currentUser?.name || '',
            bankName: payload.profile.bankName || '',
            accountNumber: payload.profile.accountNumber || '',
            bvn: payload.profile.bvn || '',
            nin: payload.profile.nin || '',
          });
        }
        setError(null);
      })
      .catch((nextError) => {
        if (!mounted) return;
        setError(nextError instanceof Error ? nextError.message : 'Unable to load payroll records.');
        setProfile(null);
        setSlips([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [currentUser?.name]);

  const slipOptions = useMemo(() => slips.map((slip) => ({ ...slip, monthLabel: formatMonthLabel(slip.monthKey) })), [slips]);
  const selectedSlip = slipOptions.find((slip) => slip.id === selectedId) || slipOptions[0] || null;
  const selectedBreakdown = getSlipBreakdown(selectedSlip);
  const payoutReady = Boolean(profile?.consentAcknowledgedAt);
  const kycStatusTone = profile?.kycStatus === 'verified' ? 'emerald' : profile?.kycStatus === 'pending' ? 'amber' : 'rose';

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    setError(null);
    setSuccess(null);
    try {
      const nextProfile = await savePayrollPayoutProfile({
        accountName: formState.accountName,
        bankName: formState.bankName,
        accountNumber: formState.accountNumber,
        bvn: formState.bvn || null,
        nin: formState.nin || null,
        consentAcknowledged: true,
      });
      setProfile(nextProfile);
      setSuccess(nextProfile.kycStatus === 'verified' ? 'Payout details saved and KYC verified.' : 'Payout details saved. KYC is pending, so payouts remain on hold until verified.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to save payout details.');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-4xl border border-white/10 bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(14,18,17,0.96))] p-6 lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-100">
              <Wallet size={14} /> Staff Payslips
            </div>
            <h1 className="mt-4 text-3xl font-black text-white lg:text-4xl">Payroll-backed payslips and payout verification</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300">Published payroll slips now come from the finance payroll module. Staff submit account details once, the system stores them for future incentive payouts, and KYC must verify before anything is released.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-black/20 px-5 py-4 text-sm text-zinc-200">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Profile</div>
            <div className="mt-2 text-xl font-bold text-white">{staffName}</div>
            <div className="mt-1 text-xs text-zinc-400">{staffRole}</div>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
      {success ? <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{success}</div> : null}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.9rem] border border-white/10 bg-[#101214] p-6">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500"><CreditCard size={14} /> Incentive payout profile</div>
          <div className={`mt-4 rounded-3xl border px-4 py-4 text-sm ${kycStatusTone === 'emerald' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100' : kycStatusTone === 'amber' ? 'border-amber-500/20 bg-amber-500/10 text-amber-100' : 'border-rose-500/20 bg-rose-500/10 text-rose-100'}`}>
            <div className="flex items-start gap-3">
              {profile?.kycStatus === 'verified' ? <BadgeCheck size={18} /> : profile?.kycStatus === 'pending' ? <ShieldAlert size={18} /> : <AlertCircle size={18} />}
              <div>
                <div className="font-semibold text-white">{profile?.kycStatus === 'verified' ? 'KYC verified' : profile?.kycStatus === 'pending' ? 'KYC pending' : 'Payout details required'}</div>
                <p className="mt-1 text-xs leading-6 text-zinc-300">{profile?.kycStatus === 'verified' ? 'Your bank details are approved and future payroll releases can be paid to this account.' : profile?.kycStatus === 'pending' ? 'Your details are saved, but payout remains on hold until a valid BVN or NIN passes KYC.' : 'Submit your account details once. The system keeps them for future staff incentives and payroll payments.'}</p>
              </div>
            </div>
          </div>

          {!payoutReady ? (
            <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={handleProfileSubmit}>
              <label className="space-y-2 text-sm text-zinc-300">
                <span>Account name</span>
                <input value={formState.accountName} onChange={(event) => setFormState((current) => ({ ...current, accountName: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none" />
              </label>
              <label className="space-y-2 text-sm text-zinc-300">
                <span>Bank name</span>
                <input value={formState.bankName} onChange={(event) => setFormState((current) => ({ ...current, bankName: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none" />
              </label>
              <label className="space-y-2 text-sm text-zinc-300">
                <span>Account number</span>
                <input value={formState.accountNumber} onChange={(event) => setFormState((current) => ({ ...current, accountNumber: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none" />
              </label>
              <label className="space-y-2 text-sm text-zinc-300">
                <span>BVN</span>
                <input value={formState.bvn} onChange={(event) => setFormState((current) => ({ ...current, bvn: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none" />
              </label>
              <label className="space-y-2 text-sm text-zinc-300 md:col-span-2">
                <span>NIN (optional if BVN is provided)</span>
                <input value={formState.nin} onChange={(event) => setFormState((current) => ({ ...current, nin: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none" />
              </label>
              <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-xs text-zinc-400">
                <span>Submitting this form confirms you want the system to store these details for future staff incentive and payroll payouts.</span>
                <button disabled={savingProfile} type="submit" className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60">{savingProfile ? 'Saving...' : 'Save payout details'}</button>
              </div>
            </form>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Bank</div>
                <div className="mt-2 text-sm font-semibold text-white">{profile?.bankName}</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Account number</div>
                <div className="mt-2 text-sm font-semibold text-white">{profile?.accountNumber}</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Consent saved</div>
                <div className="mt-2 text-sm font-semibold text-white">{profile?.consentAcknowledgedAt ? 'Yes' : 'No'}</div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[1.9rem] border border-white/10 bg-[#101214] p-6">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500"><CheckCircle2 size={14} /> Payroll release status</div>
          <div className="mt-5 space-y-3 text-sm text-zinc-300">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Ready for payout</div>
              <div className="mt-2 text-2xl font-black text-white">{profile?.kycStatus === 'verified' ? 'Yes' : 'No'}</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Published slips</div>
              <div className="mt-2 text-2xl font-black text-white">{slipOptions.filter((slip) => slip.status === 'published').length}</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Held by KYC</div>
              <div className="mt-2 text-2xl font-black text-white">{slipOptions.filter((slip) => slip.status === 'held-kyc').length}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-4 rounded-[1.9rem] border border-white/10 bg-[#101214] p-5">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500"><FileSpreadsheet size={14} /> Available slips</div>
          {loading ? <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-zinc-400">Loading payroll records...</div> : null}
          {!loading && !slipOptions.length ? <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-zinc-400">No payroll slips have been published for your profile yet.</div> : null}
          {slipOptions.map((slip) => (
            <button
              key={slip.id}
              type="button"
              onClick={() => setSelectedId(slip.id)}
              className="w-full rounded-3xl border p-4 text-left transition"
              style={selectedSlip?.id === slip.id ? { borderColor: 'rgba(16,185,129,0.32)', background: 'rgba(16,185,129,0.08)' } : { borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{slip.monthLabel}</div>
                  <div className="mt-1 text-xs text-zinc-400">Net pay {formatNaira(slip.netNaira)}</div>
                </div>
                <div className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-300">{slip.status}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-[1.9rem] border border-white/10 bg-[#101214] p-6">
          {!selectedSlip ? <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-zinc-400">Select a payroll month when one becomes available.</div> : (
            <>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">Final payslip layout</div>
                  <h2 className="mt-3 text-2xl font-bold text-white">{selectedSlip.monthLabel}</h2>
                  <p className="mt-2 text-sm text-zinc-400">Employee: {staffName} • {staffRole}</p>
                </div>
                <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10">
                  <Download size={16} /> Print payslip
                </button>
              </div>

              <div className="mt-6 rounded-4xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(0,0,0,0.18))] p-6">
                <div className="grid gap-4 border-b border-white/10 pb-5 md:grid-cols-[1.2fr_0.8fr]">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Ndovera payroll office</div>
                    <div className="mt-2 text-2xl font-black text-white">Staff Payslip</div>
                    <div className="mt-3 grid gap-2 text-sm text-zinc-300 md:grid-cols-2">
                      <div>Name: {staffName}</div>
                      <div>Role: {staffRole}</div>
                      <div>Month: {selectedSlip.monthLabel}</div>
                      <div>Status: {selectedSlip.status}</div>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-right">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100">Net pay</div>
                    <div className="mt-3 text-3xl font-black text-white">{formatNaira(selectedSlip.netNaira)}</div>
                    <div className="mt-2 text-xs text-emerald-100">Release: {selectedSlip.publishedAt ? new Date(selectedSlip.publishedAt).toLocaleString('en-NG') : 'Awaiting release'}</div>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Earnings</div>
                    <div className="mt-4 space-y-3 text-sm text-zinc-200">
                      <div className="flex items-center justify-between"><span>Basic salary</span><span>{formatNaira(selectedSlip.baseSalaryNaira)}</span></div>
                      <div className="flex items-center justify-between"><span>Bonus</span><span>{formatNaira(selectedBreakdown.bonusNaira)}</span></div>
                      <div className="flex items-center justify-between"><span>Allowance</span><span>{formatNaira(selectedSlip.allowancesNaira)}</span></div>
                      <div className="flex items-center justify-between border-t border-white/10 pt-3 font-bold text-white"><span>Gross earnings</span><span>{formatNaira(selectedSlip.grossNaira)}</span></div>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Deductions</div>
                    <div className="mt-4 space-y-3 text-sm text-zinc-200">
                      <div className="flex items-center justify-between"><span>Tax</span><span>{formatNaira(selectedBreakdown.taxNaira)}</span></div>
                      <div className="flex items-center justify-between"><span>Loan</span><span>{formatNaira(selectedBreakdown.loanNaira)}</span></div>
                      <div className="flex items-center justify-between"><span>Other deductions</span><span>{formatNaira(selectedSlip.deductionsNaira)}</span></div>
                      <div className="flex items-center justify-between border-t border-white/10 pt-3 font-bold text-white"><span>Total deductions</span><span>{formatNaira(selectedBreakdown.taxNaira + selectedBreakdown.loanNaira + selectedSlip.deductionsNaira)}</span></div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl bg-white/5 px-4 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Payment channel</div>
                    <div className="mt-2 text-sm text-white">Bank transfer</div>
                  </div>
                  <div className="rounded-2xl bg-white/5 px-4 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Reference</div>
                    <div className="mt-2 text-xs font-mono text-white">{selectedSlip.paymentReference || selectedSlip.id.toUpperCase()}</div>
                  </div>
                  <div className="rounded-2xl bg-white/5 px-4 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Bank status</div>
                    <div className="mt-2 text-sm text-white">{profile?.kycStatus === 'verified' ? 'Verified for release' : 'Awaiting KYC clearance'}</div>
                  </div>
                </div>

                {selectedBreakdown.rowNote || selectedBreakdown.monthNote ? (
                  <div className="mt-6 rounded-3xl border border-sky-500/20 bg-sky-500/10 p-5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-100">Payroll note</div>
                    <div className="mt-3 space-y-3 text-sm leading-7 text-sky-50">
                      {selectedBreakdown.rowNote ? <p>{selectedBreakdown.rowNote}</p> : null}
                      {selectedBreakdown.monthNote ? <p>{selectedBreakdown.monthNote}</p> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
