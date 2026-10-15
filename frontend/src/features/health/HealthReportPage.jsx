import React, { useCallback, useEffect, useState } from 'react';
import { listHealthIncidents } from './healthApi';
import { IncidentCard, IncidentForm } from './healthShared';

/** Teachers and other staff: report a health incident and the first aid given; see your own reports. */
export default function HealthReportPage() {
  const [mine, setMine] = useState([]);
  const [notice, setNotice] = useState('');
  const load = useCallback(() => listHealthIncidents({}).then(data => setMine(data.incidents || [])).catch(() => setMine([])), []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-8">
      <header className="overflow-hidden rounded-3xl border-2 border-[#c9a96e] bg-[#191970] p-4 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#c9a96e]">School health</p>
        <h1 className="text-2xl font-black">🩺 Report a health incident</h1>
        <p className="text-sm text-[#b5e3f4]">Record what happened and the first aid you gave. The school nurse (or the Head of School) takes it from here.</p>
      </header>
      {notice ? <p role="status" className="rounded-2xl bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-900">{notice}</p> : null}
      <IncidentForm onSaved={(_id, student) => { setNotice(`Report saved for ${student.name}. The school has been notified.`); load(); }} />
      <section className="space-y-2">
        <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[#800020]">My reports</h2>
        {mine.length ? mine.map(incident => <IncidentCard key={incident.id} incident={incident} />) : <p className="text-sm text-slate-600">You have not reported anything yet.</p>}
      </section>
    </div>
  );
}
