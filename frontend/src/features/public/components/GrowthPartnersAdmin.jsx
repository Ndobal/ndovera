import React, { useEffect, useState } from 'react';
import {
  getGrowthPartnerApplications,
  getGrowthPartners,
  activateGrowthPartner,
} from '../services/publicSiteApi';

const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

export default function GrowthPartnersAdmin() {
  const [applications, setApplications] = useState([]);
  const [partners, setPartners] = useState([]);
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
    } catch (error) {
      setMessage(error.message || 'Could not load growth partners.');
    }
  }

  useEffect(() => { load(); }, []);

  async function activate(app) {
    setBusy(app.id || app.email); setMessage('');
    try {
      const result = await activateGrowthPartner({ email: app.email, name: app.name, applicationId: app.id });
      setMessage(`Activated ${app.name}. Referral code ${result.partner?.referralCode}. Temporary password: ${result.defaultPassword} (they must change it on first login).`);
      await load();
    } catch (error) {
      setMessage(error.message || 'Could not activate partner.');
    } finally {
      setBusy('');
    }
  }

  const activatedEmails = new Set(partners.map(p => String(p.email || '').toLowerCase()));

  return (
    <section className="rounded-3xl border border-[#c9a96e]/45 bg-[#b5e3f4] p-5 shadow-[0_18px_40px_rgba(128,0,0,0.08)] dark:border-white/10 dark:bg-slate-900/40">
      <p className="text-lg font-bold text-[#800000] dark:text-slate-100">Growth Partners</p>
      <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">Review applications and activate partners. Activation creates their login + referral code.</p>
      {message ? <p className="mt-3 rounded-xl bg-[#fff8ee] px-3 py-2 text-sm text-[#1a5c38] dark:bg-slate-800 dark:text-emerald-300">{message}</p> : null}

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

      <div className="mt-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#800020]">Active partners</p>
        <div className="mt-2 space-y-2">
          {partners.length === 0 ? <p className="text-sm text-[#191970] dark:text-slate-300">No active partners yet.</p> : null}
          {partners.map(p => (
            <div key={p.id} className="rounded-2xl border border-[#c9a96e]/35 bg-[#fff8ee]/70 p-3 text-sm dark:border-white/10 dark:bg-slate-800/40">
              <p className="font-semibold text-[#14215b] dark:text-slate-100">{p.name} • <span className="font-mono text-[#800020]">{p.referralCode}</span></p>
              <p className="text-xs text-[#4a5578] dark:text-slate-400">{p.referralCount} referrals • earned {naira.format(p.totalEarned || 0)} • available {naira.format(p.available || 0)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
