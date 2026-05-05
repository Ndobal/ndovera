import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAttendance } from '../../../features/school/services/schoolApi';

export default function OwnerReports({ auth }) {
  const [attendance, setAttendance] = useState(null);
  const [attLoading, setAttLoading] = useState(true);
  const [attError, setAttError] = useState(null);

  useEffect(() => {
    setAttLoading(true);
    getAttendance()
      .then((data) => setAttendance(data))
      .catch((err) => setAttError(err.message))
      .finally(() => setAttLoading(false));
  }, []);

  const attRecords = attendance?.records || attendance?.attendance || [];

  const reportCards = [
    {
      title: 'Academic Summary',
      description: 'View results analytics, scores, and academic performance across subjects.',
      link: '/roles/owner/academics',
      linkLabel: 'Open Academics',
    },
    {
      title: 'Finance Report',
      description: 'Review payment status, subscription fees, and financial health.',
      link: '/roles/owner/finance',
      linkLabel: 'Open Finance',
    },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">Reports</h1>
        <p className="text-[#191970] dark:text-slate-300 mt-1 text-sm">
          Generate and review institutional reports.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reportCards.map((card) => (
          <div
            key={card.title}
            className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10 flex flex-col gap-4"
          >
            <h2 className="text-lg font-bold text-[#800000] dark:text-slate-100">{card.title}</h2>
            <p className="text-[#191970] dark:text-slate-300 text-sm flex-1">{card.description}</p>
            <Link
              to={card.link}
              className="bg-[#1a5c38] dark:bg-emerald-700 hover:bg-[#154a2e] dark:hover:bg-emerald-600 text-[#f5deb3] font-bold dark:text-white px-4 py-3 rounded-2xl text-center text-sm transition-colors"
            >
              {card.linkLabel}
            </Link>
          </div>
        ))}

        {/* Attendance Report */}
        <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10 flex flex-col gap-4">
          <h2 className="text-lg font-bold text-[#800000] dark:text-slate-100">Attendance Report</h2>
          {attLoading ? (
            <p className="text-[#800020] dark:text-slate-400 text-sm">Loading...</p>
          ) : attError ? (
            <p className="text-[#800000] dark:text-slate-100 text-sm">{attError}</p>
          ) : attRecords.length === 0 ? (
            <p className="text-[#800020] dark:text-slate-400 text-sm">No attendance records available.</p>
          ) : (
            <p className="text-[#191970] dark:text-slate-300 text-sm">
              {attRecords.length} attendance record{attRecords.length !== 1 ? 's' : ''} on file.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
