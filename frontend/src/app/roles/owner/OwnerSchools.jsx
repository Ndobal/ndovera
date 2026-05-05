import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getOwnerSchools } from '../../../features/school/services/schoolApi';

function StatusBadge({ status }) {
  const map = {
    active: 'bg-emerald-100 text-emerald-700',
    pending: 'bg-amber-100 text-amber-700',
    pending_payment: 'bg-amber-100 text-amber-700',
    approved_pending_payment: 'bg-amber-100 text-amber-700',
    pending_approval: 'bg-amber-100 text-amber-700',
    suspended: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${map[status] || 'bg-slate-100 text-slate-600'}`}>
      {status || 'unknown'}
    </span>
  );
}

export default function OwnerSchools({ auth }) {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getOwnerSchools()
      .then((data) => setSchools(data?.schools || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">My Schools</h1>
          <p className="text-[#191970] dark:text-slate-300 mt-1 text-sm">Manage all schools registered under your account.</p>
        </div>
        <Link
          to="/register-school"
          className="shrink-0 bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-5 py-3 rounded-2xl text-sm transition-colors"
        >
          + Add School
        </Link>
      </div>

      {loading ? (
        <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
          <p className="text-[#800020] dark:text-slate-400">Loading...</p>
        </div>
      ) : error ? (
        <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
          <p className="text-[#800000] dark:text-slate-100">{error}</p>
        </div>
      ) : schools.length === 0 ? (
        <div className="rounded-3xl p-10 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10 text-center">
          <p className="text-[#800020] dark:text-slate-400 text-lg mb-4">No schools registered yet.</p>
          <p className="text-[#191970] dark:text-slate-300 text-sm mb-6">Click <strong>+ Add School</strong> to get started.</p>
          <Link
            to="/register-school"
            className="inline-block bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-6 py-3 rounded-2xl text-sm transition-colors"
          >
            + Add School
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {schools.map((school) => (
            <div
              key={school.id}
              className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10 flex flex-col gap-4"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-bold text-[#800000] dark:text-slate-100 leading-tight">{school.schoolName || '—'}</h2>
                <StatusBadge status={school.status} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Subdomain</p>
                <p className="text-[#191970] dark:text-slate-300 text-sm">{school.subdomain || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Students</p>
                <p className="text-[#191970] dark:text-slate-300 text-sm">{school.studentCount ?? '—'}</p>
              </div>
              <Link
                to={`/roles/owner/schools/${school.id}`}
                className="mt-auto bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-4 py-3 rounded-2xl text-center text-sm transition-colors"
              >
                Manage
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
