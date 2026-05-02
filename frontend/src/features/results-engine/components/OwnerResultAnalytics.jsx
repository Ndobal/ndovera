import React from 'react';
import { getOwnerResultAnalytics } from '../service/resultEngineService';
import BroadsheetTable from './BroadsheetTable';

export default function OwnerResultAnalytics() {
  const data = getOwnerResultAnalytics();

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <section className="glass-surface rounded-3xl p-6">
        <p className="micro-label neon-subtle">Owner Dashboard</p>
        <h1 className="text-3xl command-title neon-title">Result Engine Executive Analytics</h1>
        <p className="text-slate-300 mt-1">Cross-campus roll-up from CA score sheet core • {data.term}</p>
        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/30 p-4 text-sm text-slate-200">
          <p>
            HoS Approval Status: {data.hosApproved ? 'Approved' : 'Pending'}
          </p>
          {data.hosApproved && (
            <p className="mt-1 text-slate-300">
              Approved By: {data.hosApprovedBy || 'Head of School'}
              {data.hosApprovedAt ? ` • ${new Date(data.hosApprovedAt).toLocaleString()}` : ''}
            </p>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="glass-surface rounded-2xl p-4"><p className="micro-label accent-indigo">Global Average</p><p className="text-2xl command-title mt-1 text-slate-100">{data.globalAverage}%</p></div>
        <div className="glass-surface rounded-2xl p-4"><p className="micro-label accent-emerald">Global Pass Rate</p><p className="text-2xl command-title mt-1 text-slate-100">{data.globalPassRate}%</p></div>
        <div className="glass-surface rounded-2xl p-4"><p className="micro-label accent-amber">Students in Broadsheet</p><p className="text-2xl command-title mt-1 text-slate-100">{data.broadsheet.length}</p></div>
        <div className="glass-surface rounded-2xl p-4"><p className="micro-label accent-rose">Exam Incidents</p><p className="text-2xl command-title mt-1 text-slate-100">{data.examIntegrity.incidents}</p></div>
      </section>

      <section className="glass-surface rounded-3xl p-6">
        <h2 className="text-xl command-title neon-title mb-4">Campus Result Pulse</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {data.campuses.map(campus => (
            <div key={campus.name} className="rounded-2xl border border-white/10 p-4 bg-slate-900/30 space-y-2">
              <p className="text-slate-100 font-semibold">{campus.name}</p>
              <p className="text-sm text-slate-300">Average: {campus.average}%</p>
              <p className="text-sm text-slate-300">Pass Rate: {campus.passRate}%</p>
              <p className="text-sm text-slate-300">Attendance: {campus.attendance}%</p>
            </div>
          ))}
        </div>
      </section>

      <BroadsheetTable rows={data.broadsheet} title="Institution Broadsheet" />
    </div>
  );
}
