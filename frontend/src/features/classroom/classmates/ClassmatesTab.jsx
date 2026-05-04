import React from 'react';
import { classmates } from '../data/classroomData';

export default function ClassmatesTab() {
  return (
    <section className="glass-surface rounded-3xl p-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {classmates.length > 0 ? classmates.map(item => (
          <div key={item.name} className="rounded-2xl border border-white/10 bg-slate-900/30 p-4 flex justify-between gap-3">
            <div>
              <p className="text-slate-100 font-semibold">{item.name}</p>
              <p className="text-sm text-slate-300">{item.profile}</p>
              <p className="micro-label mt-2 accent-emerald">{item.badge}</p>
            </div>
            <button className="px-3 py-1 h-fit rounded-xl border border-white/10 bg-slate-900/40 text-sm text-slate-100">{item.contact}</button>
          </div>
        )) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/20 p-5 text-center md:col-span-2">
            <p className="micro-label accent-amber">No live classmates</p>
            <p className="mt-2 text-sm text-slate-300">Class roster data will appear here when the tenant syncs active student enrollment.</p>
          </div>
        )}
      </div>
    </section>
  );
}
