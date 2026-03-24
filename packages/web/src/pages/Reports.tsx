import React from 'react';
import { 
  BarChart3, 
  FileText, 
  Download, 
  Filter, 
  PieChart, 
  TrendingUp,
  Calendar
} from 'lucide-react';
import { BillingLockBanner } from '../components/BillingLockBanner';
import { useBillingLock } from '../hooks/useBillingLock';

export const ReportsView = () => {
  const { softLockActive, overdueInvoice } = useBillingLock('Tenant School Owner');
  const reportTypes = [
    { title: 'Academic Performance', desc: 'Detailed analysis of student grades and exam results.', icon: <BarChart3 size={20} /> },
    { title: 'Financial Summary', desc: 'Overview of income, expenses, and outstanding fees.', icon: <PieChart size={20} /> },
    { title: 'Attendance Report', desc: 'Daily and monthly tracking of staff and students.', icon: <Calendar size={20} /> },
    { title: 'Staff Evaluation', desc: 'Performance metrics and feedback for teaching staff.', icon: <TrendingUp size={20} /> },
  ];

  return (
    <div className="space-y-6">
      {softLockActive ? <BillingLockBanner invoiceId={overdueInvoice?.id} dismissible={false} compact /> : null}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Reports & Analytics</h2>
          <p className="text-zinc-500 text-xs">Generate and export detailed institutional reports.</p>
        </div>
        <div className="flex gap-2">
          <button disabled={softLockActive} className="bg-white/5 border border-white/5 text-zinc-400 px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50">
            <Filter size={14} /> Customize
          </button>
          <button disabled={softLockActive} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50">
            <Download size={14} /> Export All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {reportTypes.map((report, i) => (
          <div key={i} className="card-compact group">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-zinc-500 group-hover:text-emerald-500 transition-all">
                  {report.icon}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-200">{report.title}</h4>
                  <p className="text-xs text-zinc-500">{report.desc}</p>
                </div>
              </div>
              <button disabled={softLockActive} className="p-2 bg-white/5 hover:bg-emerald-600 hover:text-white rounded-xl transition-all disabled:cursor-not-allowed disabled:opacity-50">
                <Download size={16} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 rounded-2xl border border-white/5 bg-white/2 p-4">
              <div className="text-center">
                <p className="text-[9px] font-bold text-zinc-500 uppercase mb-1">Last Run</p>
                <p className="text-xs font-mono text-white">2d ago</p>
              </div>
              <div className="text-center border-x border-white/5">
                <p className="text-[9px] font-bold text-zinc-500 uppercase mb-1">Format</p>
                <p className="text-xs font-mono text-white">PDF/XLS</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-bold text-zinc-500 uppercase mb-1">Size</p>
                <p className="text-xs font-mono text-white">2.4 MB</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card-compact">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Recent Exports</h3>
          <button className="text-[10px] font-bold text-emerald-500 hover:underline">Clear History</button>
        </div>
        <div className="space-y-2">
          {[
            { name: 'Term_2_Financial_Statement.pdf', date: 'Mar 04, 2026', size: '1.2 MB' },
            { name: 'Student_Attendance_Feb.xlsx', date: 'Mar 01, 2026', size: '850 KB' },
            { name: 'Staff_Performance_Review_Q1.pdf', date: 'Feb 28, 2026', size: '3.1 MB' },
          ].map((file, i) => (
            <div key={i} className="group flex items-center justify-between rounded-xl p-3 transition-all hover:bg-white/2">
              <div className="flex items-center gap-3">
                <FileText size={16} className="text-zinc-600 group-hover:text-emerald-500" />
                <div>
                  <p className="text-xs font-bold text-zinc-300">{file.name}</p>
                  <p className="text-[9px] text-zinc-500">{file.date} &bull; {file.size}</p>
                </div>
              </div>
              <button disabled={softLockActive} className="text-[10px] font-bold text-zinc-500 hover:text-white uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-50">
                Download
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
