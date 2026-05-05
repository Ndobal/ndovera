import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAttendance, getMe } from '../../../features/school/services/schoolApi';

const quickLinks = [
  { label: 'Academics', path: '/roles/hos/academics' },
  { label: 'Attendance', path: '/roles/hos/attendance' },
  { label: 'Approvals', path: '/roles/hos/approvals' },
  { label: 'Messaging', path: '/roles/hos/messaging' },
];

export default function HoSOverview({ auth }) {
  const [me, setMe] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getMe().catch(() => null),
      getAttendance().catch(() => null),
    ])
      .then(([meData, attData]) => {
        setMe(meData?.user || meData || null);
        setAttendance(attData?.records || attData?.attendance || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">
          Head of School Dashboard
        </h1>
        {me?.name && (
          <p className="text-[#191970] dark:text-slate-300 mt-1">Welcome, {me.name}</p>
        )}
      </div>

      {loading ? (
        <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
          <p className="text-[#800020] dark:text-slate-400">Loading...</p>
        </div>
      ) : error ? (
        <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
          <p className="text-[#800000] dark:text-slate-100">{error}</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-3xl p-5 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
              <p className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Attendance Records</p>
              <p className="text-3xl font-bold text-[#800000] dark:text-slate-100 mt-2">{attendance.length}</p>
            </div>
            <div className="rounded-3xl p-5 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
              <p className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Role</p>
              <p className="text-xl font-bold text-[#800000] dark:text-slate-100 mt-2 capitalize">{me?.role || '—'}</p>
            </div>
            <div className="rounded-3xl p-5 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
              <p className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Email</p>
              <p className="text-sm font-bold text-[#800000] dark:text-slate-100 mt-2 truncate">{me?.email || '—'}</p>
            </div>
          </div>

          {/* Quick Links */}
          <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
            <h2 className="text-lg font-semibold text-[#800000] dark:text-slate-100 mb-4">Quick Navigation</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {quickLinks.map((l) => (
                <Link
                  key={l.path}
                  to={l.path}
                  className="bg-[#1a5c38] dark:bg-emerald-700 hover:bg-[#154a2e] dark:hover:bg-emerald-600 text-[#f5deb3] font-bold dark:text-white px-4 py-3 rounded-2xl text-center text-sm transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
