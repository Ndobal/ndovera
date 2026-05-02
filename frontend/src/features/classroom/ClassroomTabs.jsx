import React from 'react';

export default function ClassroomTabs({ tabs, activeTab, onChange }) {
  return (
    <section className="glass-surface rounded-3xl p-3 mb-3">
      <div className="flex flex-wrap gap-1.5">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={activeTab === tab.id
              ? 'px-3 py-1.5 rounded-2xl bg-indigo-500/30 border border-indigo-300/40 text-white text-xs md:text-sm'
              : 'px-3 py-1.5 rounded-2xl bg-slate-900/30 border border-white/10 text-slate-200 text-xs md:text-sm'}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </section>
  );
}
