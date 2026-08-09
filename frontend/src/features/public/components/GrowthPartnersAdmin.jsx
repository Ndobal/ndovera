import React, { useEffect, useState } from 'react';
import {
  getGrowthPartnerApplications,
  getGrowthPartners,
  activateGrowthPartner,
  markGrowthPartnerPaid,
  appointGrowthPartnerRepresentative,
  accrueGrowthPartnerTerm,
  resetGrowthPartnerPassword,
} from '../services/publicSiteApi';
import { ConversationsPage } from '../../../app/roles/growthpartner/PartnerPages';

const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

export default function GrowthPartnersAdmin() {
  const [applications, setApplications] = useState([]);
  const [partners, setPartners] = useState([]);
  const [analytics, setAnalytics] = useState({ activePartners: 0, referrals: 0, totalEarned: 0, totalPaid: 0, available: 0 });
  const [activities, setActivities] = useState([]);
  const [representativeDrafts, setRepresentativeDrafts] = useState({});
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    try {
      const [apps, parts] = await Promise.all([
        getGrowthPartnerApplications().catch(() => ({ applications: [] })),
        getGrowthPartners().catch(() => ({ partners: [] })),
      ]);
      setApplications(apps.applications || []);
      setPartners(parts.partners || []);
      setAnalytics(parts.analytics || { activePartners: 0, referrals: 0, totalEarned: 0, totalPaid: 0, available: 0 });
      setActivities(parts.activities || []);
    } catch (error) {
      setMessage(error.message || 'Could not load growth partners.');
    }
  }

  useEffect(() => { load(); }, []);

  async function activate(app) {
    setBusy(app.id || app.email); setMessage('');
    try {
      const result = await activateGrowthPartner({ email: app.email, name: app.name, applicationId: app.id });
      setMessage(result.defaultPassword
        ? `Activated ${app.name}. Referral code ${result.partner?.referralCode}. Temporary password: ${result.defaultPassword} — copy it now, it is shown only once and they must change it on first login.`
        : `Activated ${app.name}. Referral code ${result.partner?.referralCode}. They already set their own password, so it was left unchanged.`);
      await load();
    } catch (error) {
      setMessage(error.message || 'Could not activate partner.');
    } finally {
      setBusy('');
    }
  }

  const activatedEmails = new Set(partners.map(p => String(p.email || '').toLowerCase()));
  const [termPeriod, setTermPeriod] = useState('');
  const [passwordIssue, setPasswordIssue] = useState(null);
  const [showConversations, setShowConversations] = useState(false);

  function copyText(value) {
    navigator.clipboard?.writeText(value);
    setMessage('Copied to clipboard.');
  }

  async function accrueTerm() {
    const period = termPeriod.trim();
    if (!period) { setMessage('Enter a term label first, e.g. "2025/2026 Term 1".'); return; }
    if (!window.confirm(`Accrue the 5% term commission for all referred schools for "${period}"? (Safe to run once per term.)`)) return;
    setBusy('term'); setMessage('');
    try {
      const r = await accrueGrowthPartnerTerm(period);
      setMessage(`Term commissions accrued for ${r.accruedCount} schools (₦${(r.totalAmount || 0).toLocaleString()} total).`);
      await load();
    } catch (error) {
      setMessage(error.message || 'Could not accrue term commissions.');
    } finally {
      setBusy('');
    }
  }

  function getRepresentativeDraft(partner) {
    return representativeDrafts[partner.id] || {
      level: partner.representative?.level || '',
      territory: partner.representative?.territory || '',
    };
  }

  function updateRepresentativeDraft(partner, field, value) {
    setRepresentativeDrafts(current => ({ ...current, [partner.id]: { ...getRepresentativeDraft(partner), [field]: value } }));
  }

  async function markPaid(partner) {
    if (!partner.available) { setMessage(`${partner.name} has no unpaid earnings.`); return; }
    if (!window.confirm(`Mark ${partner.name} as paid ${naira.format(partner.available)}? This records the payout and removes it from their available balance.`)) return;
    setBusy(`paid-${partner.id}`); setMessage('');
    try {
      const result = await markGrowthPartnerPaid(partner.id);
      setMessage(result.message || `${partner.name} has been marked as paid.`);
      await load();
    } catch (error) {
      setMessage(error.message || 'Could not mark the partner as paid.');
    } finally {
      setBusy('');
    }
  }

  async function resetPassword(partner) {
    if (!window.confirm(`Issue a new sign-in password for ${partner.name}? Their current password stops working immediately, and the new one is shown once.`)) return;
    setBusy(`password-${partner.id}`); setMessage('');
    try {
      const result = await resetGrowthPartnerPassword(partner.id);
      setPasswordIssue({ partner: partner.name, ...result });
      setMessage(`New sign-in details issued for ${partner.name}. Share the password or the set-password link below — both are shown only once.`);
    } catch (error) {
      setMessage(error.message || 'Could not issue a new password.');
    } finally {
      setBusy('');
    }
  }

  async function appointRepresentative(partner) {
    const draft = getRepresentativeDraft(partner);
    if (!draft.level) { setMessage(`Choose a representative level for ${partner.name}.`); return; }
    setBusy(`representative-${partner.id}`); setMessage('');
    try {
      await appointGrowthPartnerRepresentative(partner.id, draft);
      setMessage(`${partner.name}'s representative appointment was saved.`);
      await load();
    } catch (error) {
      setMessage(error.message || 'Could not save representative appointment.');
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="rounded-3xl border border-[#c9a96e]/45 bg-[#b5e3f4] p-5 shadow-[0_18px_40px_rgba(128,0,0,0.08)] dark:border-white/10 dark:bg-slate-900/40">
      <p className="text-lg font-bold text-[#800000] dark:text-slate-100">Growth Partners</p>
      <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">Review applications, portfolio activity, earnings, manual payouts, and representative appointments. Activation creates a login and referral code.</p>
      {message ? <p className="mt-3 rounded-xl bg-[#fff8ee] px-3 py-2 text-sm text-[#1a5c38] dark:bg-slate-800 dark:text-emerald-300">{message}</p> : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Active partners', analytics.activePartners],
          ['Schools referred', analytics.referrals],
          ['Total earned', naira.format(analytics.totalEarned || 0)],
          ['Paid out', naira.format(analytics.totalPaid || 0)],
          ['Awaiting payout', naira.format(analytics.available || 0)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-[#c9a96e]/35 bg-[#fff8ee]/80 p-3 dark:border-white/10 dark:bg-slate-800/40">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#800020] dark:text-fuchsia-300">{label}</p>
            <p className="mt-1 text-lg font-black text-[#191970] dark:text-emerald-300">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2 rounded-2xl border border-[#c9a96e]/35 bg-[#fff8ee]/70 p-3 dark:border-white/10 dark:bg-slate-800/40">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#800020]">Run 5% term payout accrual</p>
          <input value={termPeriod} onChange={e => setTermPeriod(e.target.value)} placeholder="e.g. 2025/2026 Term 1" className="mt-1 rounded-xl border border-[#c9a96e]/40 bg-white px-3 py-2 text-sm text-[#191970] outline-none dark:bg-slate-800 dark:text-slate-100" />
        </div>
        <button type="button" onClick={accrueTerm} disabled={busy === 'term'} className="rounded-xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#b5e3f4] disabled:opacity-50">{busy === 'term' ? 'Accruing…' : 'Accrue term 5%'}</button>
      </div>

      <div className="mt-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#800020]">Pending applications</p>
        <div className="mt-2 space-y-2">
          {applications.filter(a => a.status !== 'activated').length === 0 ? <p className="text-sm text-[#191970] dark:text-slate-300">No pending applications.</p> : null}
          {applications.filter(a => a.status !== 'activated').map(app => (
            <div key={app.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#c9a96e]/35 bg-[#fff8ee]/70 p-3 dark:border-white/10 dark:bg-slate-800/40">
              <div className="min-w-0">
                <p className="truncate font-semibold text-[#14215b] dark:text-slate-100">{app.name} • {app.email}</p>
                <p className="truncate text-xs text-[#4a5578] dark:text-slate-400">{app.phone} {app.location ? `• ${app.location}` : ''}</p>
              </div>
              <button type="button" onClick={() => activate(app)} disabled={busy === app.id || activatedEmails.has(String(app.email).toLowerCase())}
                className="shrink-0 rounded-xl bg-[#1a5c38] px-4 py-2 text-xs font-bold text-[#b5e3f4] disabled:opacity-50">
                {activatedEmails.has(String(app.email).toLowerCase()) ? 'Activated' : busy === app.id ? 'Activating…' : 'Activate'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {passwordIssue ? (
        <div className="mt-4 rounded-2xl border border-[#800020]/35 bg-[#fff4f4] p-4 text-sm dark:border-fuchsia-300/30 dark:bg-slate-800/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold text-[#800020] dark:text-fuchsia-300">Sign-in details for {passwordIssue.partner}</p>
            <button type="button" onClick={() => setPasswordIssue(null)} className="text-xs font-semibold text-[#4a5578] underline dark:text-slate-300">Dismiss</button>
          </div>
          <p className="mt-2 text-xs text-[#4a5578] dark:text-slate-400">{passwordIssue.email}</p>

          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#4a5578] dark:text-slate-400">Password</span>
              <code className="rounded-lg border border-[#c9a96e]/40 bg-white px-2 py-1 font-mono text-[#191970] dark:bg-slate-900 dark:text-amber-100">{passwordIssue.password}</code>
              <button type="button" onClick={() => copyText(passwordIssue.password)} className="rounded-lg border border-[#191970]/30 px-3 py-1 text-xs font-semibold text-[#191970] dark:border-white/20 dark:text-slate-100">Copy</button>
            </div>
            {passwordIssue.setPasswordUrl ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-[#4a5578] dark:text-slate-400">Set-password link</span>
                <span className="max-w-full break-all rounded-lg border border-[#c9a96e]/40 bg-white px-2 py-1 text-xs text-[#191970] dark:bg-slate-900 dark:text-amber-100">{passwordIssue.setPasswordUrl}</span>
                <button type="button" onClick={() => copyText(passwordIssue.setPasswordUrl)} className="rounded-lg border border-[#191970]/30 px-3 py-1 text-xs font-semibold text-[#191970] dark:border-white/20 dark:text-slate-100">Copy</button>
              </div>
            ) : null}
          </div>
          <p className="mt-3 text-xs text-[#4a5578] dark:text-slate-400">
            Send the link if you would rather not share a password. Either way the partner sets their own password before reaching the dashboard.
          </p>
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl border border-[#c9a96e]/35 bg-[#fff8ee]/70 p-3 dark:border-white/10 dark:bg-slate-800/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#14215b] dark:text-slate-100">Community and partner messages</p>
            <p className="text-xs text-[#4a5578] dark:text-slate-400">
              Post to every growth partner at once, or open any partner&apos;s conversation with a school they referred.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowConversations(open => !open)}
            className="rounded-xl bg-[#14215b] px-4 py-2 text-xs font-bold text-[#f5deb3] dark:bg-cyan-300 dark:text-black"
          >
            {showConversations ? 'Hide messages' : 'Open messages'}
          </button>
        </div>
        {showConversations ? (
          <div className="mt-4">
            <ConversationsPage
              kind="all"
              title="Growth partner messages"
              subtitle="The community thread reaches every partner. School threads include the partner, that school's owner, HoS and ICT."
            />
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#800020]">Active partners</p>
        <div className="mt-2 space-y-2">
          {partners.length === 0 ? <p className="text-sm text-[#191970] dark:text-slate-300">No active partners yet.</p> : null}
          {partners.map(p => (
            <div key={p.id} className="rounded-2xl border border-[#c9a96e]/35 bg-[#fff8ee]/70 p-3 text-sm dark:border-white/10 dark:bg-slate-800/40">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <button type="button" onClick={() => setSelectedPartner(p)} className="text-left font-semibold text-[#14215b] underline decoration-[#c9a96e] decoration-2 underline-offset-4 dark:text-slate-100">{p.name}</button> <span className="font-mono text-[#800020] dark:text-fuchsia-300">• {p.referralCode}</span>
                  <p className="text-xs text-[#4a5578] dark:text-slate-400">{p.referralCount} referrals • earned {naira.format(p.totalEarned || 0)} • paid {naira.format(p.totalWithdrawn || 0)} • available {naira.format(p.available || 0)}</p>
                  {p.representative ? <p className="mt-1 text-xs font-semibold text-[#1a5c38] dark:text-emerald-300">{p.representative.level} representative{p.representative.territory ? ` · ${p.representative.territory}` : ''}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => resetPassword(p)} disabled={busy === `password-${p.id}`} className="rounded-xl border border-[#800020]/40 px-3 py-2 text-xs font-bold text-[#800020] disabled:opacity-50 dark:border-fuchsia-300/40 dark:text-fuchsia-300">
                    {busy === `password-${p.id}` ? 'Issuing…' : 'Issue sign-in password'}
                  </button>
                  <button type="button" onClick={() => markPaid(p)} disabled={busy === `paid-${p.id}` || !p.available} className="rounded-xl bg-[#1a5c38] px-3 py-2 text-xs font-bold text-[#f5deb3] disabled:opacity-50 dark:bg-cyan-300 dark:text-black">
                    {busy === `paid-${p.id}` ? 'Recording…' : `Mark paid ${naira.format(p.available || 0)}`}
                  </button>
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <select value={getRepresentativeDraft(p).level} onChange={e => updateRepresentativeDraft(p, 'level', e.target.value)} className="rounded-xl border border-[#c9a96e]/40 bg-white px-3 py-2 text-xs text-[#191970] outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white">
                  <option value="">Representative appointment</option>
                  <option value="state">State representative</option>
                  <option value="regional">Regional representative</option>
                  <option value="national">National representative</option>
                  <option value="global">Global representative</option>
                </select>
                <input value={getRepresentativeDraft(p).territory} onChange={e => updateRepresentativeDraft(p, 'territory', e.target.value)} placeholder="State, region, or coverage" className="rounded-xl border border-[#c9a96e]/40 bg-white px-3 py-2 text-xs text-[#191970] outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white" />
                <button type="button" onClick={() => appointRepresentative(p)} disabled={busy === `representative-${p.id}`} className="rounded-xl border border-[#1a5c38]/45 px-3 py-2 text-xs font-bold text-[#1a5c38] disabled:opacity-50 dark:border-cyan-300/50 dark:text-cyan-200">
                  {busy === `representative-${p.id}` ? 'Saving…' : 'Save appointment'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedPartner ? (
        <section className="mt-6 rounded-2xl border-2 border-[#1a5c38]/35 bg-[#fff8ee] p-5 shadow-[0_12px_28px_rgba(26,92,56,0.1)] dark:border-cyan-300/35 dark:bg-slate-950/70">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#800020] dark:text-fuchsia-300">Growth partner details</p>
              <h3 className="mt-1 text-xl font-black text-[#800000] dark:text-blue-400">{selectedPartner.name}</h3>
              <p className="text-sm text-[#191970] dark:text-emerald-300">{selectedPartner.email} · Code: <span className="font-mono">{selectedPartner.referralCode}</span></p>
            </div>
            <button type="button" onClick={() => setSelectedPartner(null)} className="rounded-xl border border-[#800020]/35 px-3 py-2 text-xs font-bold text-[#800020] dark:border-fuchsia-300/40 dark:text-fuchsia-200">Close details</button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['NIN', selectedPartner.nin || 'Not submitted'],
              ['Bank', selectedPartner.bankName || 'Not added'],
              ['Account', selectedPartner.accountNumber ? `${selectedPartner.accountName || 'Account name not set'} · ${selectedPartner.accountNumber}` : 'Not added'],
              ['Representative', selectedPartner.representative ? `${selectedPartner.representative.level}${selectedPartner.representative.territory ? ` · ${selectedPartner.representative.territory}` : ''}` : 'Not appointed'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-[#c9a96e]/35 bg-white/75 p-3 dark:border-white/10 dark:bg-slate-800/60">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#800020] dark:text-fuchsia-300">{label}</p>
                <p className="mt-1 break-words text-sm font-semibold text-[#191970] dark:text-slate-100">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {selectedPartner.utilityBillUrl ? <a href={selectedPartner.utilityBillUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-[#1a5c38] px-4 py-2 text-xs font-bold text-[#f5deb3] dark:bg-cyan-300 dark:text-black">View utility bill</a> : <span className="rounded-xl bg-[#f5deb3] px-4 py-2 text-xs font-bold text-[#800020] dark:bg-slate-800 dark:text-amber-200">No utility bill uploaded</span>}
            <span className="rounded-xl border border-[#c9a96e]/35 px-4 py-2 text-xs font-bold text-[#1a5c38] dark:border-emerald-300/30 dark:text-emerald-300">Available: {naira.format(selectedPartner.available || 0)}</span>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#800020] dark:text-fuchsia-300">Referred schools</p>
              <div className="mt-2 space-y-2">{selectedPartner.referrals?.length ? selectedPartner.referrals.map(referral => <p key={referral.id} className="rounded-lg bg-white/70 px-3 py-2 text-xs text-[#191970] dark:bg-slate-800 dark:text-slate-200">{referral.schoolName} · {referral.createdAt ? new Date(referral.createdAt).toLocaleDateString() : 'Date unavailable'}</p>) : <p className="text-xs text-[#4a5578] dark:text-slate-400">No referrals yet.</p>}</div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#800020] dark:text-fuchsia-300">Commission activity</p>
              <div className="mt-2 space-y-2">{selectedPartner.commissions?.length ? selectedPartner.commissions.map(commission => <p key={commission.id} className="rounded-lg bg-white/70 px-3 py-2 text-xs text-[#191970] dark:bg-slate-800 dark:text-slate-200">{naira.format(commission.amount)} · {commission.note || commission.kind}</p>) : <p className="text-xs text-[#4a5578] dark:text-slate-400">No commissions yet.</p>}</div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#800020] dark:text-fuchsia-300">Payout activity</p>
              <div className="mt-2 space-y-2">{selectedPartner.withdrawals?.length ? selectedPartner.withdrawals.map(withdrawal => <p key={withdrawal.id} className="rounded-lg bg-white/70 px-3 py-2 text-xs text-[#191970] dark:bg-slate-800 dark:text-slate-200">{naira.format(withdrawal.amount)} · {withdrawal.status} · {withdrawal.createdAt ? new Date(withdrawal.createdAt).toLocaleDateString() : 'Date unavailable'}</p>) : <p className="text-xs text-[#4a5578] dark:text-slate-400">No payouts yet.</p>}</div>
            </div>
          </div>
        </section>
      ) : null}

      <div className="mt-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#800020]">Latest partner activity</p>
        <div className="mt-2 max-h-80 space-y-2 overflow-y-auto pr-1">
          {activities.length === 0 ? <p className="text-sm text-[#191970] dark:text-slate-300">No partner activity yet.</p> : null}
          {activities.slice(0, 30).map(activity => (
            <div key={`${activity.type}-${activity.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-[#c9a96e]/30 bg-white/65 px-3 py-2 text-xs dark:border-white/10 dark:bg-slate-800/40">
              <div className="min-w-0">
                <p className="truncate font-semibold text-[#191970] dark:text-slate-100">{activity.partnerName} · {activity.type}</p>
                <p className="truncate text-[#4a5578] dark:text-slate-400">{activity.detail || 'Activity recorded'}{activity.createdAt ? ` · ${new Date(activity.createdAt).toLocaleString()}` : ''}</p>
              </div>
              {activity.amount > 0 ? <span className="shrink-0 font-bold text-[#1a5c38] dark:text-emerald-300">{naira.format(activity.amount)}</span> : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
