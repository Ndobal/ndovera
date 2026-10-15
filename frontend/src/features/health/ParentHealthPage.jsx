import React, { useEffect, useState } from 'react';
import { getMyChildrenHealth } from './healthApi';
import { IncidentCard } from './healthShared';

/** Parents: each child's health profile and every visit to the school nurse or first aid. */
export default function ParentHealthPage() {
  const [children, setChildren] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { getMyChildrenHealth().then(data => setChildren(data.children || [])).catch(err => setError(err.message)); }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-8">
      <header className="overflow-hidden rounded-3xl border-2 border-[#c9a96e] bg-[#191970] p-4 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#c9a96e]">School health</p>
        <h1 className="text-2xl font-black">🩺 Your children&apos;s health at school</h1>
      </header>
      {error ? <p role="alert" className="rounded-2xl bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-900">{error}</p> : null}
      {(children || []).map(child => (
        <section key={child.studentId} className="space-y-2 rounded-3xl border border-[#c9a96e]/50 bg-[#b5e3f4] p-4 dark:bg-slate-900/50">
          <h2 className="text-lg font-black text-[#800000] dark:text-amber-200">{child.name} <span className="text-sm font-semibold text-slate-600">{child.className}</span></h2>
          {child.profile && (child.profile.allergies || child.profile.conditions || child.profile.bloodGroup) ? (
            <p className="rounded-2xl bg-white/80 px-3 py-2 text-sm text-[#191970]">
              {child.profile.bloodGroup ? <><b>Blood group:</b> {child.profile.bloodGroup} · </> : null}
              {child.profile.genotype ? <><b>Genotype:</b> {child.profile.genotype} · </> : null}
              {child.profile.allergies ? <><b>Allergies:</b> {child.profile.allergies} · </> : null}
              {child.profile.conditions ? <><b>Conditions:</b> {child.profile.conditions}</> : null}
            </p>
          ) : null}
          {child.incidents.length ? child.incidents.map(incident => <IncidentCard key={incident.id} incident={incident} showStudent={false} />) : <p className="text-sm text-[#191970]">No visits to the sick bay recorded.</p>}
        </section>
      ))}
      {children && !children.length ? <p className="rounded-3xl bg-white/80 p-5 text-sm text-[#191970]">No children are linked to your account yet.</p> : null}
    </div>
  );
}
