import React from 'react';
import { teachers } from '../data/classroomData';

export default function TeachersTab() {
  return (
    <section className="glass-surface rounded-3xl p-5">
      <div className="space-y-3">
        {teachers.length > 0 ? teachers.map(item => (
          <div key={item.name} className="rounded-2xl border border-white/10 bg-slate-900/30 p-4 flex flex-wrap justify-between gap-3">
            <div>
              <p className="text-slate-100 font-semibold">{item.name}</p>
              <p className="text-sm text-slate-300">Subjects: {item.subjects}</p>
              <p className="micro-label mt-2 accent-indigo">Office Hours: {item.officeHours}</p>
            </div>
            <button className="px-3 py-1 h-fit rounded-xl border border-white/10 bg-slate-900/40 text-sm text-slate-100">Message</button>
          </div>
        )) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/20 p-5 text-center">
            <p className="micro-label accent-amber">No live teacher roster</p>
            <p className="mt-2 text-sm text-slate-300">Assigned teachers will appear here when the class is linked to real subject ownership.</p>
          </div>
        )}
      </div>
    </section>
  );
}
