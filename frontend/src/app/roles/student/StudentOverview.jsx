import React, { useEffect, useState } from 'react';
import StudentSectionShell from './StudentSectionShell';
import { getStudentDashboard } from '../../../services/roleDashboardService';

export default function StudentOverview() {
  const [data, setData] = useState({
    studentName: 'Student',
    roleWatermark: 'STUDENT',
    metrics: [],
    quickLinks: [],
    notices: [],
  });

  useEffect(() => {
    let mounted = true;
    getStudentDashboard().then(result => {
      if (mounted) setData(result);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <StudentSectionShell
      title={`Welcome, ${data.studentName}`}
      subtitle="Here is what you need for today."
    >
      <div className="relative mb-6">
        {data.metrics.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {data.metrics.map(metric => (
                <div key={metric.label} className="glass-surface rounded-3xl p-5 text-center">
                  <p className="micro-label neon-subtle mb-1">{metric.label}</p>
                  <p className={`text-2xl command-title mono-metric ${metric.accent}`}>{metric.value}</p>
                </div>
              ))}
            </div>
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-5xl md:text-7xl font-black tracking-[0.6rem] text-white/5 select-none">
              {data.roleWatermark}
            </p>
          </>
        ) : (
          <div className="glass-surface rounded-3xl p-6 text-center">
            <p className="micro-label accent-amber">Live dashboard unavailable</p>
            <p className="mt-2 text-slate-300">Student metrics will appear here when your school&apos;s live dashboard feed is ready.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="glass-surface rounded-3xl p-6">
          <h2 className="text-xl command-title neon-title mb-4">Quick Links</h2>
          {data.quickLinks.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {data.quickLinks.map(link => (
                <a key={link.name} href={link.path} className="rounded-2xl border border-white/10 p-4 hover:bg-indigo-500/10 hover:text-white transition-colors">
                  <p className="font-semibold text-slate-100">{link.name}</p>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No quick links are being injected by the live dashboard service yet.</p>
          )}
        </section>

        <section className="glass-surface rounded-3xl p-6">
          <h2 className="text-xl command-title neon-title mb-4">Notices</h2>
          {data.notices.length > 0 ? (
            <div className="space-y-3">
              {data.notices.map(note => (
                <div key={note.text} className="rounded-2xl border border-white/10 p-4 bg-slate-900/30">
                  <p className="text-slate-100">{note.text}</p>
                  <p className={`micro-label mt-2 ${note.accent}`}>{note.time}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No live notices are available right now.</p>
          )}
        </section>
      </div>
    </StudentSectionShell>
  );
}
