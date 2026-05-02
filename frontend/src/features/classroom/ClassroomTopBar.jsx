import React from 'react';

export default function ClassroomTopBar({ className, tabs, activeTab, onChange }) {
  return (
    <section className="sticky top-2 z-30 glass-surface rounded-3xl p-2.5 mb-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="justify-self-start">
          <h2 className="text-sm md:text-base command-title neon-title">Classroom</h2>
        </div>

        <div className="justify-self-center flex flex-wrap items-center justify-center gap-1.5">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={activeTab === tab.id
                ? 'px-2.5 py-1 rounded-2xl bg-indigo-500/30 border border-indigo-300/40 text-white text-[11px] md:text-xs'
                : 'px-2.5 py-1 rounded-2xl bg-slate-900/30 border border-white/10 text-slate-200 text-[11px] md:text-xs'}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="justify-self-end">
          <p className="text-xs md:text-sm font-semibold text-slate-200">{className}</p>
        </div>
      </div>
    </section>
  );
}
