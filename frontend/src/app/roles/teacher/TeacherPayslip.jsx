import React, { useEffect, useState } from 'react';
import { getMyPayslip, getWebsiteSections } from '../../../features/school/services/schoolApi';

const CARD = 'rounded-3xl p-6 bg-[#f5deb3] border border-[#c9a96e]/40';
const INNER = 'rounded-2xl p-4 bg-[#f0d090] border border-[#c9a96e]/30';
const BTN = 'bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-5 py-2.5 rounded-2xl text-sm transition-colors';

function parseMetadata(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function extractContactInfo(sections = []) {
  const contactSection = (sections || []).find(section => String(section?.section_key || '') === 'contact');
  const metadata = parseMetadata(contactSection?.metadata);
  return {
    address: String(metadata.address || '').trim(),
    phone: String(metadata.phone || '').trim(),
    email: String(metadata.email || '').trim(),
  };
}

export default function TeacherPayslip({ auth }) {
  const [payslip, setPayslip] = useState(null);
  const [contactInfo, setContactInfo] = useState({ address: '', phone: '', email: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const month = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  useEffect(() => {
    let active = true;

    Promise.all([getMyPayslip(), getWebsiteSections().catch(() => ({ sections: [] }))])
      .then(([data, sectionsResult]) => {
        if (!active) return;
        setPayslip(data?.payslip || data || null);
        setContactInfo(extractContactInfo(sectionsResult?.sections || []));
      })
      .catch(err => {
        if (!active) return;
        setError(err.message || 'Could not load your payslip.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) return <div className="p-8 max-w-3xl mx-auto"><div className={CARD}><p className="text-[#800020]">Loading payslip…</p></div></div>;
  if (error) return <div className="p-8 max-w-3xl mx-auto"><div className={CARD}><p className="text-[#800000] text-sm">{error}</p></div></div>;

  const p = payslip || {};
  const gross = p.gross || 0;
  const deductions = p.deductions || 0;
  const net = p.net ?? (gross - deductions);
  const earnings = Array.isArray(p.earnings) && p.earnings.length
    ? p.earnings
    : [{ label: 'Basic Salary', amount: gross }];
  const deductionBreakdown = Array.isArray(p.deductionBreakdown)
    ? p.deductionBreakdown
    : [];
  const branding = p.branding && typeof p.branding === 'object' ? p.branding : {};
  const schoolName = branding.schoolName || p.schoolName || 'School';
  const logoUrl = branding.logoUrl || p.logoUrl || '';
  const tagline = branding.tagline || p.tagline || '';
  const website = branding.website || p.website || '';
  const schoolInitials = schoolName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('') || 'ND';

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div className={CARD}><h1 className="text-2xl font-bold text-[#800000]">My Payslip</h1><p className="text-[#191970] mt-1 text-sm">{month}</p></div>
      <div className={`${CARD} relative overflow-hidden`} id="payslip-print">
        {logoUrl ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.08]">
            <img src={logoUrl} alt="School watermark" className="h-72 w-72 object-contain" />
          </div>
        ) : null}

        <div className="relative z-10 mb-6 flex items-start gap-4 border-b border-[#c9a96e]/40 pb-5">
          {logoUrl ? (
            <img src={logoUrl} alt={`${schoolName} logo`} className="h-20 w-20 rounded-3xl object-cover border border-[#c9a96e]/40 bg-white/70 p-2" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-[#c9a96e]/40 bg-[#f0d090] text-2xl font-black text-[#800000]">
              {schoolInitials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold text-[#800000]">{schoolName}</h2>
            {tagline ? <p className="mt-1 text-sm text-[#800020]">{tagline}</p> : null}
            <p className="mt-2 text-sm text-[#191970]">Staff Payslip — {p.period || month}</p>
            {contactInfo.address ? <p className="mt-2 text-sm text-[#191970]">{contactInfo.address}</p> : null}
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#800020]">
              {contactInfo.phone ? <span>{contactInfo.phone}</span> : null}
              {contactInfo.email ? <span>{contactInfo.email}</span> : null}
              {website ? <span className="break-all">{website}</span> : null}
            </div>
          </div>
        </div>
        <div className={`${INNER} relative z-10 mb-4`}>
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-xs text-[#800020] uppercase font-semibold">Name</p><p className="text-[#191970] font-bold">{p.name || auth?.user?.name || '—'}</p></div>
            <div><p className="text-xs text-[#800020] uppercase font-semibold">Staff ID</p><p className="text-[#191970]">{p.displayId || p.staffId || '—'}</p></div>
            <div><p className="text-xs text-[#800020] uppercase font-semibold">Role</p><p className="text-[#191970]">{p.role || auth?.user?.role || 'teacher'}</p></div>
            <div><p className="text-xs text-[#800020] uppercase font-semibold">Period</p><p className="text-[#191970]">{p.period || month}</p></div>
          </div>
        </div>
        <div className={`${INNER} relative z-10 mb-4`}>
          <p className="text-xs text-[#800020] uppercase font-semibold mb-3">Earnings</p>
          <div className="space-y-1.5">
            {earnings.map(entry => (
              <div key={entry.key || entry.label} className="flex justify-between text-sm text-[#191970]"><span>{entry.label}</span><span>₦{Number(entry.amount || 0).toLocaleString()}</span></div>
            ))}
            <div className="flex justify-between text-sm font-bold text-[#800000] border-t border-[#c9a96e]/40 pt-2 mt-2"><span>Gross Pay</span><span>₦{gross.toLocaleString()}</span></div>
          </div>
        </div>
        <div className={`${INNER} relative z-10 mb-4`}>
          <p className="text-xs text-[#800020] uppercase font-semibold mb-3">Deductions</p>
          <div className="space-y-1.5">
            {deductionBreakdown.length ? deductionBreakdown.map(entry => (
              <div key={entry.key || entry.label} className="flex justify-between text-sm text-[#191970]"><span>{entry.label}</span><span>₦{Number(entry.amount || 0).toLocaleString()}</span></div>
            )) : <div className="flex justify-between text-sm text-[#191970]"><span>Total Deductions</span><span>₦{deductions.toLocaleString()}</span></div>}
            <div className="flex justify-between text-sm font-bold text-red-700 border-t border-[#c9a96e]/40 pt-2 mt-2"><span>Total Deductions</span><span>₦{deductions.toLocaleString()}</span></div>
          </div>
        </div>
        <div className={`${INNER} relative z-10 flex items-center justify-between`}>
          <span className="text-lg font-bold text-[#800020]">NET PAY</span>
          <span className="text-3xl font-bold text-[#1a5c38]">₦{net.toLocaleString()}</span>
        </div>
      </div>
      <button onClick={() => window.print()} className={BTN}>Print Payslip</button>
    </div>
  );
}
