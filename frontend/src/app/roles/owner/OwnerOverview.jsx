import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBranding, getMe, getMyTenant } from '../../../features/school/services/schoolApi';
import SchoolAnnouncementsPanel from '../../../shared/components/SchoolAnnouncementsPanel';
import MobileRoleOverviewNav from '../../../shared/components/MobileRoleOverviewNav';
import { getTenantPwaInfo } from '../../../shared/hooks/useTenantPwaManifest';

function StatusBadge({ label, value }) {
  const colors = {
    active: 'bg-emerald-100 text-emerald-700',
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
    live: 'bg-emerald-100 text-emerald-700',
    inactive: 'bg-slate-100 text-slate-600',
  };
  const key = (value || '').toLowerCase();
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${colors[key] || 'bg-slate-100 text-slate-500'}`}>
      {label}: {value || '—'}
    </span>
  );
}

const quickActions = [
  { label: 'View Schools', path: '/roles/owner/schools' },
  { label: 'Check Finance', path: '/roles/owner/finance' },
  { label: 'Academic Quality', path: '/roles/owner/academics' },
  { label: 'Manage People', path: '/roles/owner/people' },
];

export default function OwnerOverview({ auth }) {
  const [me, setMe] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [branding, setBranding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const tenantBranding = getTenantPwaInfo();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getMe().catch(() => null),
      getMyTenant().catch(() => null),
      getBranding().catch(() => null),
    ])
      .then(([meData, tenantData, brandingData]) => {
        setMe(meData?.user || meData || null);
        setTenant(tenantData?.tenant || tenantData || null);
        setBranding(brandingData?.branding || null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="rounded-3xl p-6 bg-[#b5e3f4] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
          <p className="text-[#800020] dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="rounded-3xl p-6 bg-[#b5e3f4] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
          <p className="text-[#800000] dark:text-slate-100">{error}</p>
        </div>
      </div>
    );
  }

  const schoolName = branding?.schoolName || tenant?.schoolName || tenant?.name || me?.schoolName || auth?.user?.schoolName || tenantBranding?.schoolName || 'My School';
  const schoolLogoUrl = branding?.logoUrl || tenant?.branding?.logoUrl || tenant?.logoUrl || tenantBranding?.logoUrl || '';

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="rounded-3xl p-6 bg-[#b5e3f4] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl border border-[#c9a96e]/40 bg-white/80 p-2 dark:border-white/10 dark:bg-slate-950/40">
              {schoolLogoUrl ? (
                <img src={schoolLogoUrl} alt={`${schoolName} logo`} className="h-full w-full animate-[spin_18s_linear_infinite] object-contain" />
              ) : (
                <span className="text-2xl font-black text-[#800000] dark:text-slate-100">{schoolName.slice(0, 1)}</span>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">Owner Dashboard</h1>
              <p className="mt-1 text-[#191970] dark:text-slate-300 text-lg">{schoolName}</p>
            </div>
          </div>
        </div>
        {tenant && (
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge label="Payment" value={tenant.paymentStatus} />
            <StatusBadge label="Approval" value={tenant.approvalStatus} />
            <StatusBadge label="Website" value={tenant.websiteStatus} />
          </div>
        )}
      </div>

      {/* Onboarding notice */}
      {tenant && tenant.approvalStatus !== 'approved' && (
        <div className="rounded-3xl p-6 bg-[#b5e3f4] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
          <h2 className="text-lg font-semibold text-[#800000] dark:text-slate-100 mb-1">Onboarding In Progress</h2>
          <p className="text-[#191970] dark:text-slate-300 text-sm">
            Your school is being set up. Once approved and payment confirmed, all features will be unlocked.
            Check the <Link to="/roles/owner/schools" className="underline text-[#1a5c38]">Schools page</Link> for details.
          </p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="rounded-3xl p-6 bg-[#b5e3f4] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        <h2 className="text-lg font-semibold text-[#800000] dark:text-slate-100 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((a) => (
            <Link
              key={a.path}
              to={a.path}
              className="bg-[#1a5c38] dark:bg-emerald-700 hover:bg-[#154a2e] dark:hover:bg-emerald-600 text-[#b5e3f4] font-bold dark:text-white px-4 py-3 rounded-2xl text-center text-sm transition-colors"
            >
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      <SchoolAnnouncementsPanel subtitle="Publish a school-wide owner update here. Students, parents, teachers, and staff will see it in their notification bell." />

      {/* School Info */}
      <div className="rounded-3xl p-6 bg-[#b5e3f4] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        <h2 className="text-lg font-semibold text-[#800000] dark:text-slate-100 mb-4">Your School</h2>
        {tenant || me ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Owner Email</p>
              <p className="text-[#191970] dark:text-slate-300 mt-1">{me?.email || tenant?.ownerEmail || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Billable Users</p>
              <p className="text-[#191970] dark:text-slate-300 mt-1">{tenant?.billableUserCount ?? tenant?.studentCount ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Subdomain</p>
              <p className="text-[#191970] dark:text-slate-300 mt-1">{tenant?.subdomain || '—'}</p>
            </div>
          </div>
        ) : (
          <p className="text-[#800020] dark:text-slate-400">No school info found.</p>
        )}
      </div>

      <MobileRoleOverviewNav roleKey="owner" counts={{ schools: tenant ? 1 : 0 }} />
    </div>
  );
}
