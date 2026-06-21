import React, { useEffect, useState } from 'react';
import { getMe } from '../../../features/school/services/schoolApi';
import AdminPasswordReset from '../../../features/auth/components/AdminPasswordReset';
import StaffAttendanceManagementPanel from '../../../features/attendance/components/StaffAttendanceManagementPanel';
import WebsiteTab from '../owner/tabs/WebsiteTab';

const TABS = ['Profile & Security', 'Website', 'Attendance Management'];

export default function HoSSettings({ auth }) {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('Profile & Security');

  useEffect(() => {
    setLoading(true);
    getMe()
      .then((data) => setMe(data?.user || data || null))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const tabContent = {
    'Profile & Security': (
      <div className="space-y-6">
        <div className="rounded-3xl p-6 bg-[#b5e3f4] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
          {loading ? (
            <p className="text-[#800020] dark:text-slate-400">Loading...</p>
          ) : error ? (
            <p className="text-[#800000] dark:text-slate-100">{error}</p>
          ) : me ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Name</p>
                <p className="text-[#191970] dark:text-slate-300 mt-1">{me.name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Email</p>
                <p className="text-[#191970] dark:text-slate-300 mt-1">{me.email || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-[#800020] dark:text-slate-400 uppercase font-semibold">Role</p>
                <p className="text-[#191970] dark:text-slate-300 mt-1 capitalize">{me.role || '—'}</p>
              </div>
            </div>
          ) : (
            <p className="text-[#800020] dark:text-slate-400">No profile info found.</p>
          )}
        </div>

        <div className="rounded-3xl p-6 bg-[#b5e3f4] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
          <h2 className="text-lg font-semibold text-[#800000] dark:text-slate-100 mb-4">Password Reset</h2>
          <AdminPasswordReset />
        </div>
      </div>
    ),
    Website: (
      <div className="rounded-3xl p-6 bg-[#b5e3f4] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        <h2 className="text-lg font-semibold text-[#800000] dark:text-slate-100 mb-4">School Website</h2>
        <WebsiteTab />
      </div>
    ),
    'Attendance Management': <StaffAttendanceManagementPanel />,
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="rounded-3xl p-6 bg-[#b5e3f4] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">Settings</h1>
        <p className="text-[#191970] dark:text-slate-300 mt-1 text-sm">
          Manage HoS profile controls, website content, and staff attendance policy.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map(label => (
          <button key={label} onClick={() => setTab(label)} className={`px-4 py-2 rounded-2xl text-sm font-semibold border transition-colors ${tab === label ? 'bg-[#800020] text-[#b5e3f4] border-[#800020]' : 'bg-[#b5e3f4] text-[#800020] border-[#c9a96e]/40 dark:bg-slate-900/30 dark:text-slate-400 dark:border-white/10 hover:bg-[#efd4a0]'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-3xl p-6 bg-[#b5e3f4] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        {tabContent[tab]}
      </div>
    </div>
  );
}
