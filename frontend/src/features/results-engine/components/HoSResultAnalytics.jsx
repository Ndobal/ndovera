import React, { useState } from 'react';
import { approveResultsByHoS, getHoSResultAnalytics, revokeHoSApproval } from '../service/resultEngineService';
import BroadsheetTable from './BroadsheetTable';
import AuditViewer from '../../student-settings/components/AuditViewer';

export default function HoSResultAnalytics() {
  const [data, setData] = useState(getHoSResultAnalytics());
  const [showAudit, setShowAudit] = useState(false);

  const approve = () => {
    approveResultsByHoS('Head of School');
    setData(getHoSResultAnalytics());
  };

  const revoke = () => {
    revokeHoSApproval();
    setData(getHoSResultAnalytics());
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <section className="glass-surface rounded-3xl p-6">
        <p className="micro-label neon-subtle">Head of School Dashboard</p>
        <h1 className="text-3xl command-title neon-title">Academic Result Analytics</h1>
        <p className="text-slate-300 mt-1">Powered by CA Score Sheet • {data.term}</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-200">
            <p>Teacher Publish: {data.published ? 'Published' : 'Draft'}</p>
            <p>HoS Approval: {data.hosApproved ? `Approved${data.hosApprovedAt ? ` • ${new Date(data.hosApprovedAt).toLocaleString()}` : ''}` : 'Pending'}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={approve}
              disabled={!data.published}
              className="px-4 py-2 rounded-2xl border border-emerald-300/30 bg-emerald-500/20 text-emerald-100 text-sm disabled:opacity-40"
            >
              Approve for Parent/Student View
            </button>
            <button
              onClick={revoke}
              className="px-4 py-2 rounded-2xl border border-amber-300/30 bg-amber-500/20 text-amber-100 text-sm"
            >
              Revoke Approval
            </button>
            <button onClick={() => setShowAudit(s => !s)} className="px-4 py-2 rounded-2xl border border-slate-300/20 bg-slate-700/20 text-slate-100 text-sm">Toggle Audit</button>
          </div>
        </div>
      </section>

      {showAudit && (
        <section className="glass-surface rounded-3xl p-6">
          <AuditViewer />
        </section>
      )}

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="glass-surface rounded-2xl p-4"><p className="micro-label accent-indigo">Class Average</p><p className="text-2xl command-title mt-1 text-slate-100">{data.classAverage}%</p></div>
        <div className="glass-surface rounded-2xl p-4"><p className="micro-label accent-emerald">Pass Rate</p><p className="text-2xl command-title mt-1 text-slate-100">{data.passRate}%</p></div>
        <div className="glass-surface rounded-2xl p-4"><p className="micro-label accent-amber">Attendance Avg</p><p className="text-2xl command-title mt-1 text-slate-100">{data.attendanceAverage}%</p></div>
        <div className="glass-surface rounded-2xl p-4"><p className="micro-label accent-rose">At Risk</p><p className="text-2xl command-title mt-1 text-slate-100">{data.atRiskCount}</p></div>
      </section>

      <section className="glass-surface rounded-3xl p-6">
        <h2 className="text-xl command-title neon-title mb-4">Exam Integrity</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-2xl border border-white/10 p-4 bg-slate-900/30"><p className="micro-label accent-indigo">Window Armed</p><p className="text-slate-100 mt-1">{data.examIntegrity.armed ? 'Yes' : 'No'}</p></div>
          <div className="rounded-2xl border border-white/10 p-4 bg-slate-900/30"><p className="micro-label accent-amber">Incidents</p><p className="text-slate-100 mt-1">{data.examIntegrity.incidents}</p></div>
          <div className="rounded-2xl border border-white/10 p-4 bg-slate-900/30"><p className="micro-label accent-rose">Auto Submits</p><p className="text-slate-100 mt-1">{data.examIntegrity.autoSubmits}</p></div>
        </div>
      </section>

      <section className="glass-surface rounded-3xl p-6">
        <h2 className="text-xl command-title neon-title mb-4">Subject Performance</h2>
        <div className="space-y-3">
          {data.subjectPerformance.map(subject => (
            <div key={subject.subject} className="space-y-1">
              <div className="flex justify-between text-sm text-slate-300"><span>{subject.subject}</span><span>{subject.average}%</span></div>
              <div className="h-2 rounded-full bg-slate-700 overflow-hidden"><div className="h-full bg-indigo-400" style={{ width: `${subject.average}%` }} /></div>
            </div>
          ))}
          {data.subjectPerformance.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/20 p-5 text-center">
              <p className="micro-label accent-amber">No subject analytics</p>
              <p className="mt-2 text-sm text-slate-300">Subject performance will appear here once teachers upload and publish live scores.</p>
            </div>
          )}
        </div>
      </section>

      <BroadsheetTable rows={data.broadsheet} />
    </div>
  );
}
