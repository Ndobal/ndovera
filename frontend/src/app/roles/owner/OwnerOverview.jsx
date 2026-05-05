import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMe, getMyTenant } from '../../../features/school/services/schoolApi';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([getMe().catch(() => null), getMyTenant().catch(() => null)])
      .then(([meData, tenantData]) => {
        setMe(meData?.user || meData || null);
        setTenant(tenantData?.tenant || tenantData || null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
          <p className="text-[#800020] dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
          <p className="text-[#800000] dark:text-slate-100">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">
          Owner Dashboard
        </h1>
        {tenant?.name && (
          <p className="mt-1 text-[#191970] dark:text-slate-300 text-lg">{tenant.name}</p>
        )}
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
        <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
          <h2 className="text-lg font-semibold text-[#800000] dark:text-slate-100 mb-1">Onboarding In Progress</h2>
          <p className="text-[#191970] dark:text-slate-300 text-sm">
            Your school is being set up. Once approved and payment confirmed, all features will be unlocked.
            Check the <Link to="/roles/owner/schools" className="underline text-[#1a5c38]">Schools page</Link> for details.
          </p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        <h2 className="text-lg font-semibold text-[#800000] dark:text-slate-100 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((a) => (
            <Link
              key={a.path}
              to={a.path}
              className="bg-[#1a5c38] dark:bg-emerald-700 hover:bg-[#154a2e] dark:hover:bg-emerald-600 text-[#f5deb3] font-bold dark:text-white px-4 py-3 rounded-2xl text-center text-sm transition-colors"
            >
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      {/* School Info */}
      <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        <h2 className="text-lg font-semibold text-[#800000] dark:text-slate-100 mb-4">Your School</h2>
        {tenant || me ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Owner Email</p>
              <p className="text-[#191970] dark:text-slate-300 mt-1">{me?.email || tenant?.ownerEmail || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Student Count</p>
              <p className="text-[#191970] dark:text-slate-300 mt-1">{tenant?.studentCount ?? '—'}</p>
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
    </div>
  );
}
