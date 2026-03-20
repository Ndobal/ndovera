import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Clock3,
  Download,
  HeartPulse,
  Pill,
  Plus,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { Role } from '../types';

export const ClinicView = ({ role }: { role: Role }) => {
  const isStudent = role === 'Student';
  const isParent = role === 'Parent';
  const isClinicManager = ['Clinic Officer', 'HoS', 'Owner'].includes(role);
  const [activeTab, setActiveTab] = useState<'visits' | 'inventory' | 'alerts' | 'reports' | 'parent-note'>(
    isClinicManager ? 'visits' : isParent ? 'parent-note' : 'reports'
  );

  const stats = isClinicManager
    ? [
        { label: 'Today Visits', value: '18', icon: <Stethoscope size={16} />, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        { label: 'Observation Cases', value: '4', icon: <HeartPulse size={16} />, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { label: 'Low Stock Drugs', value: '3', icon: <Pill size={16} />, color: 'text-amber-500', bg: 'bg-amber-500/10' },
        { label: 'Emergency Status', value: 'Stable', icon: <ShieldCheck size={16} />, color: 'text-purple-500', bg: 'bg-purple-500/10' },
      ]
    : isParent
      ? [
          { label: 'Child Reports', value: '2', icon: <UserRound size={16} />, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Medication Notes', value: '2', icon: <Pill size={16} />, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        ]
      : [
          { label: 'My Reports', value: '2', icon: <UserRound size={16} />, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Current Status', value: 'Stable', icon: <ShieldCheck size={16} />, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        ];

  const visits = [
    { id: 'CL-101', student: 'Alice Johnson', className: 'SS2 Gold', issue: 'Headache', action: 'Rest + hydration', status: 'Returned to class' },
    { id: 'CL-102', student: 'Daniel Musa', className: 'JSS3 Blue', issue: 'Minor injury', action: 'First aid administered', status: 'Observation' },
    { id: 'CL-103', student: 'Grace Obi', className: 'Primary 5', issue: 'Fever', action: 'Parent contacted', status: 'Sent home' },
  ];

  const inventory = [
    { item: 'Paracetamol', stock: '42 packs', status: 'Available' },
    { item: 'Bandages', stock: '11 rolls', status: 'Low stock' },
    { item: 'Antiseptic', stock: '8 bottles', status: 'Low stock' },
  ];

  const alerts = [
    'Two students require follow-up tomorrow morning.',
    'One parent notification is still pending acknowledgement.',
    'Bandage stock has fallen below the clinic threshold.',
  ];

  const studentUpdates = [
    'Your clinic reports remain private to you and authorized school staff.',
    'See your latest treatment outcome in the reports tab.',
  ];

  const parentUpdates = [
    'You can review your child’s clinic reports and medication instructions here.',
    'Use Parent medical note to send drug and dosage directions to the clinic nurse.',
  ];

  const studentReports = [
    {
      id: 'SR-01',
      date: '2026-03-13',
      complaint: 'Mild headache after sports',
      action: 'Rested for 25 minutes and given water',
      outcome: 'Returned to class',
    },
    {
      id: 'SR-02',
      date: '2026-03-06',
      complaint: 'Minor cut on left arm',
      action: 'Wound cleaned and dressed',
      outcome: 'Observed and discharged',
    },
  ];

  const childReports = [
    {
      id: 'CR-01',
      child: 'Precious Johnson',
      className: 'Primary 5 Gold',
      date: '2026-03-13',
      nurseNote: 'Temperature stable. Student responded well after supervised rest.',
      administeredBy: 'Nurse Binta Okafor',
      medication: 'Paracetamol 250mg',
      dosage: '10ml after meal if symptoms return',
    },
    {
      id: 'CR-02',
      child: 'Precious Johnson',
      className: 'Primary 5 Gold',
      date: '2026-03-01',
      nurseNote: 'Observed for stomach discomfort. No escalation required.',
      administeredBy: 'Nurse Chinedu Eze',
      medication: 'ORS',
      dosage: 'Small supervised sips for 2 hours',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Clinic</h2>
          <p className="text-xs text-zinc-500">
            {isClinicManager
              ? 'Track student visits, treatments, stock levels, and health alerts.'
              : isParent
                ? 'View your child’s clinic reports and send medication instructions to the clinic nurse.'
                : 'View only your own clinic reports and personal clinic updates.'}
          </p>
        </div>
        <div className="flex gap-2">
          {isClinicManager ? (
            <button className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400 transition-all hover:bg-white/10">
              <Download size={14} /> Export log
            </button>
          ) : null}
          {isClinicManager ? (
            <button className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg shadow-emerald-900/20">
              <Plus size={14} /> New visit
            </button>
          ) : null}
        </div>
      </div>

      <div className={`grid grid-cols-2 gap-4 ${isClinicManager ? 'lg:grid-cols-4' : 'lg:grid-cols-2'}`}>
        {stats.map((stat) => (
          <div key={stat.label} className="card-mini flex items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${stat.bg} ${stat.color}`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">{stat.label}</p>
              <p className="text-base font-mono font-bold text-white">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-6 border-b border-white/5">
        {isClinicManager ? (
          <button
            onClick={() => setActiveTab('visits')}
            className={`relative pb-3 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'visits' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Visit log
            {activeTab === 'visits' ? <div className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-emerald-500" /> : null}
          </button>
        ) : null}
        {isClinicManager ? (
          <button
            onClick={() => setActiveTab('inventory')}
            className={`relative pb-3 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'inventory' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Inventory
            {activeTab === 'inventory' ? <div className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-emerald-500" /> : null}
          </button>
        ) : null}
        {isStudent ? (
          <button
            onClick={() => setActiveTab('reports')}
            className={`relative pb-3 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'reports' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            My reports
            {activeTab === 'reports' ? <div className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-emerald-500" /> : null}
          </button>
        ) : null}
        {isParent ? (
          <>
            <button
              onClick={() => setActiveTab('reports')}
              className={`relative pb-3 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'reports' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Child reports
              {activeTab === 'reports' ? <div className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-emerald-500" /> : null}
            </button>
            <button
              onClick={() => setActiveTab('parent-note')}
              className={`relative pb-3 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'parent-note' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Parent medical note
              {activeTab === 'parent-note' ? <div className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-emerald-500" /> : null}
            </button>
          </>
        ) : null}
        <button
          onClick={() => setActiveTab('alerts')}
          className={`relative pb-3 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'alerts' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          {isClinicManager ? 'Alerts' : isParent ? 'Nurse follow-up' : 'Clinic updates'}
          {activeTab === 'alerts' ? <div className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-emerald-500" /> : null}
        </button>
      </div>

      <div className="animate-in slide-in-from-bottom-2 fade-in duration-300">
        {activeTab === 'visits' ? (
          <div className="grid gap-4">
            {visits.map((visit) => (
              <div key={visit.id} className="card-compact border border-white/5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-white">{visit.student}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">{visit.className} • {visit.id}</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-300">{visit.status}</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-white/4 p-4 text-sm text-zinc-300"><span className="text-zinc-500">Complaint:</span> {visit.issue}</div>
                  <div className="rounded-2xl bg-white/4 p-4 text-sm text-zinc-300"><span className="text-zinc-500">Action:</span> {visit.action}</div>
                  <div className="rounded-2xl bg-white/4 p-4 text-sm text-zinc-300 flex items-center gap-2"><Clock3 size={14} className="text-zinc-500" /> Follow-up logged</div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {activeTab === 'inventory' ? (
          <div className="grid gap-4 md:grid-cols-3">
            {inventory.map((item) => (
              <div key={item.item} className="card-compact border border-white/5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-white">{item.item}</p>
                    <p className="mt-1 text-xs text-zinc-500">{item.stock}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${item.status === 'Available' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>{item.status}</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {activeTab === 'reports' && isStudent ? (
          <div className="grid gap-4">
            {studentReports.map((report) => (
              <div key={report.id} className="card-compact border border-white/5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-white">My clinic report</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">{report.date} • {report.id}</p>
                  </div>
                  <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-blue-300">Private to student</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-white/4 p-4 text-sm text-zinc-300"><span className="text-zinc-500">Complaint:</span> {report.complaint}</div>
                  <div className="rounded-2xl bg-white/4 p-4 text-sm text-zinc-300"><span className="text-zinc-500">Action:</span> {report.action}</div>
                  <div className="rounded-2xl bg-white/4 p-4 text-sm text-zinc-300"><span className="text-zinc-500">Outcome:</span> {report.outcome}</div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {activeTab === 'reports' && isParent ? (
          <div className="grid gap-4">
            {childReports.map((report) => (
              <div key={report.id} className="card-compact border border-white/5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-white">{report.child}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">{report.className} • {report.date}</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-300">Visible to parent</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-white/4 p-4 text-sm text-zinc-300"><span className="text-zinc-500">Nurse note:</span> {report.nurseNote}</div>
                  <div className="rounded-2xl bg-white/4 p-4 text-sm text-zinc-300"><span className="text-zinc-500">First aid by:</span> {report.administeredBy}</div>
                  <div className="rounded-2xl bg-white/4 p-4 text-sm text-zinc-300"><span className="text-zinc-500">Drug:</span> {report.medication}</div>
                  <div className="rounded-2xl bg-white/4 p-4 text-sm text-zinc-300"><span className="text-zinc-500">Dosage:</span> {report.dosage}</div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {activeTab === 'parent-note' && isParent ? (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="card-compact border border-white/5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Report child health status</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-zinc-200">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Child name</span>
                  <input defaultValue="Precious Johnson" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" />
                </label>
                <label className="space-y-2 text-sm text-zinc-200">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Condition</span>
                  <input placeholder="e.g. asthma, fever follow-up" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" />
                </label>
                <label className="space-y-2 text-sm text-zinc-200">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Drug</span>
                  <input placeholder="Drug name" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" />
                </label>
                <label className="space-y-2 text-sm text-zinc-200">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Dosage</span>
                  <input placeholder="How it should be administered" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" />
                </label>
                <label className="space-y-2 text-sm text-zinc-200 md:col-span-2">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Parent instruction</span>
                  <textarea className="min-h-28 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" placeholder="Explain when the drug should be administered in school and any precautions." />
                </label>
              </div>
              <div className="mt-4 flex justify-end">
                <button className="rounded-lg bg-emerald-600 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg shadow-emerald-900/20">
                  Submit to clinic nurse
                </button>
              </div>
            </div>
            <div className="card-compact border border-white/5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Who manages the rest?</h3>
              <div className="mt-4 space-y-3 text-sm text-zinc-300">
                <div className="rounded-2xl bg-white/4 p-4">Parents can report a child's health status and provide drug and dosage instructions for school administration.</div>
                <div className="rounded-2xl bg-white/4 p-4">The Clinic Nurse/Manager, `Owner`, and `HoS` manage administration details, observation logs, and final clinic actions.</div>
                <div className="rounded-2xl bg-white/4 p-4">Students only see their own clinic reports.</div>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'alerts' ? (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="card-compact border border-white/5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">{isClinicManager ? 'Health alerts' : isParent ? 'Parent updates' : 'Clinic updates'}</h3>
              <div className="mt-4 space-y-3">
                {(isClinicManager ? alerts : isParent ? parentUpdates : studentUpdates).map((alert) => (
                  <div key={alert} className="flex items-start gap-3 rounded-2xl bg-white/4 p-4 text-sm text-zinc-300">
                    <AlertTriangle size={16} className="mt-0.5 text-amber-400" />
                    <span>{alert}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card-compact border border-white/5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Quick summary</h3>
              <div className="mt-4 space-y-3 text-sm text-zinc-300">
                {isClinicManager ? (
                  <>
                    <div className="flex items-center gap-2 rounded-2xl bg-white/4 p-4"><UserRound size={16} className="text-blue-400" /> Parent notifications remain auditable.</div>
                    <div className="flex items-center gap-2 rounded-2xl bg-white/4 p-4"><Activity size={16} className="text-emerald-400" /> Student outcomes are logged after every visit.</div>
                    <div className="flex items-center gap-2 rounded-2xl bg-white/4 p-4"><HeartPulse size={16} className="text-rose-400" /> Escalations can be reviewed by school leadership.</div>
                  </>
                ) : isParent ? (
                  <>
                    <div className="flex items-center gap-2 rounded-2xl bg-white/4 p-4"><UserRound size={16} className="text-blue-400" /> Parents can see the staff name that administered first aid.</div>
                    <div className="flex items-center gap-2 rounded-2xl bg-white/4 p-4"><Activity size={16} className="text-emerald-400" /> Medication notes remain visible in the child report.</div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 rounded-2xl bg-white/4 p-4"><ShieldCheck size={16} className="text-blue-400" /> Students do not see clinic-wide stock or emergency operations.</div>
                    <div className="flex items-center gap-2 rounded-2xl bg-white/4 p-4"><Activity size={16} className="text-emerald-400" /> Students only see personal clinic outcomes.</div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
