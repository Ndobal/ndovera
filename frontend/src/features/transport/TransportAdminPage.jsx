import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { assignRouteStudents, createRoute, getTransportAdmin, removeRoute, unassignRouteStudent, updateRoute } from './transportApi';

// The school's transport: routes (areas, driver, vehicle), the students on each route with
// their pick-up point and times, and today's buses.

const FIELD = 'w-full rounded-xl border border-[#c9a96e]/50 bg-white px-3 py-2 text-sm text-[#191970] dark:border-white/10 dark:bg-slate-900 dark:text-white';
const LABEL = 'block text-[11px] font-bold uppercase tracking-[0.14em] text-[#800020] dark:text-slate-300';
const RIDES = { both: 'Morning & afternoon', morning: 'Morning only', afternoon: 'Afternoon only' };
const BLANK_ROUTE = { name: '', areas: '', driverId: '', vehicle: '', directions: 'both' };
const BLANK_ADD = { studentIds: [], pickupPoint: '', pickupTime: '', dropoffTime: '', tripNo: 1, directions: 'both', search: '' };

export const clock = value => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' });
};
const time12 = value => {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!match) return '—';
  const hours = Number(match[1]);
  return `${hours % 12 || 12}:${match[2]} ${hours < 12 ? 'am' : 'pm'}`;
};

function RouteForm({ value, drivers, onChange, onSave, onCancel, busy, saveLabel }) {
  const set = key => event => onChange({ ...value, [key]: event.target.value });
  return (
    <form onSubmit={event => { event.preventDefault(); onSave(); }} className="grid gap-3 sm:grid-cols-2">
      <label className={LABEL}>Route name<input value={value.name} onChange={set('name')} placeholder="e.g. Lugbe – Airport Road" className={FIELD} /></label>
      <label className={LABEL}>Driver
        <select value={value.driverId} onChange={set('driverId')} className={FIELD}>
          <option value="">Choose the driver…</option>
          {drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.name}</option>)}
        </select>
      </label>
      <label className={`${LABEL} sm:col-span-2`}>Areas the bus plies<input value={value.areas} onChange={set('areas')} placeholder="e.g. Lugbe, Pyakasa, Airport Road" className={FIELD} /></label>
      <label className={LABEL}>Vehicle<input value={value.vehicle} onChange={set('vehicle')} placeholder="e.g. Toyota Hiace ABC-123-XY" className={FIELD} /></label>
      <label className={LABEL}>Runs
        <select value={value.directions} onChange={set('directions')} className={FIELD}>
          {Object.entries(RIDES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={busy} className="rounded-xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{busy ? 'Saving…' : saveLabel}</button>
        {onCancel ? <button type="button" onClick={onCancel} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#800020]">Cancel</button> : null}
      </div>
      {!drivers.length ? <p className="text-xs text-amber-800 sm:col-span-2">No drivers yet. Add a staff member with the Driver role under People first.</p> : null}
    </form>
  );
}

function RouteCard({ route, drivers, students, onChanged, setNotice, setError }) {
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(null);
  const [busy, setBusy] = useState(false);
  const onRoute = new Set(route.students.map(student => student.studentId));
  const candidates = useMemo(() => {
    if (!adding) return [];
    const term = adding.search.trim().toLowerCase();
    return students.filter(student => !onRoute.has(student.id) && (!term || `${student.name} ${student.className}`.toLowerCase().includes(term))).slice(0, 60);
  }, [adding, students, onRoute]);

  async function run(work, message) {
    setBusy(true); setError(''); setNotice('');
    try { await work(); if (message) setNotice(message); await onChanged(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <article className="rounded-3xl border border-[#c9a96e]/50 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/50">
      {editing ? (
        <RouteForm value={editing} drivers={drivers} onChange={setEditing} busy={busy} saveLabel="Save route" onCancel={() => setEditing(null)}
          onSave={() => run(async () => { await updateRoute(route.id, editing); setEditing(null); }, 'Route saved.')} />
      ) : (
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-black text-[#800000] dark:text-amber-200">🚌 {route.name}</h3>
            <p className="text-sm text-[#191970] dark:text-slate-200">{route.areas || 'No areas listed'}</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Driver: <b>{route.driverName || 'not set'}</b>{route.vehicle ? ` · ${route.vehicle}` : ''} · {RIDES[route.directions]} · {route.students.length} student{route.students.length === 1 ? '' : 's'}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setAdding(adding ? null : { ...BLANK_ADD })} className="rounded-xl bg-[#1a5c38] px-3 py-1.5 text-xs font-bold text-white">{adding ? 'Close' : '+ Add students'}</button>
            <button type="button" onClick={() => setEditing({ name: route.name, areas: route.areas, driverId: route.driverId, vehicle: route.vehicle, directions: route.directions })} className="rounded-xl bg-[#191970] px-3 py-1.5 text-xs font-bold text-[#c9a96e]">Edit</button>
            <button type="button" onClick={() => window.confirm(`Remove the route ${route.name}? Its students come off the route.`) && run(() => removeRoute(route.id), 'Route removed.')} className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-rose-700">Remove</button>
          </div>
        </div>
      )}

      {adding ? (
        <div className="mt-3 space-y-3 rounded-2xl bg-[#fff8ef] p-3 dark:bg-slate-800/60">
          <div className="grid gap-2 sm:grid-cols-5">
            <label className={`${LABEL} sm:col-span-2`}>Pick-up point<input value={adding.pickupPoint} onChange={e => setAdding({ ...adding, pickupPoint: e.target.value })} placeholder="e.g. Lugbe junction" className={FIELD} /></label>
            <label className={LABEL}>Pick-up time<input type="time" value={adding.pickupTime} onChange={e => setAdding({ ...adding, pickupTime: e.target.value })} className={FIELD} /></label>
            <label className={LABEL}>Drop-off time<input type="time" value={adding.dropoffTime} onChange={e => setAdding({ ...adding, dropoffTime: e.target.value })} className={FIELD} /></label>
            <label className={LABEL}>Trip
              <select value={adding.tripNo} onChange={e => setAdding({ ...adding, tripNo: Number(e.target.value) })} className={FIELD}>
                {[1, 2, 3].map(n => <option key={n} value={n}>Trip {n}</option>)}
              </select>
            </label>
            <label className={`${LABEL} sm:col-span-2`}>Rides
              <select value={adding.directions} onChange={e => setAdding({ ...adding, directions: e.target.value })} className={FIELD}>
                {Object.entries(RIDES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
            <label className={`${LABEL} sm:col-span-3`}>Find students<input value={adding.search} onChange={e => setAdding({ ...adding, search: e.target.value })} placeholder="Name or class" className={FIELD} /></label>
          </div>
          <div className="max-h-56 overflow-auto rounded-xl bg-white p-2 dark:bg-slate-900">
            {candidates.map(student => (
              <label key={student.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-[#191970] hover:bg-[#b5e3f4]/40 dark:text-slate-100">
                <input type="checkbox" checked={adding.studentIds.includes(student.id)} onChange={() => setAdding({ ...adding, studentIds: adding.studentIds.includes(student.id) ? adding.studentIds.filter(id => id !== student.id) : [...adding.studentIds, student.id] })} />
                <span className="font-semibold">{student.name}</span><span className="text-xs text-slate-500">{student.className}</span>
              </label>
            ))}
            {!candidates.length ? <p className="p-2 text-sm text-slate-500">No students match.</p> : null}
          </div>
          <button type="button" disabled={busy || !adding.studentIds.length}
            onClick={() => run(async () => { await assignRouteStudents(route.id, adding); setAdding(null); }, `Added ${adding.studentIds.length} student${adding.studentIds.length === 1 ? '' : 's'} to ${route.name}.`)}
            className="rounded-xl bg-[#800020] px-4 py-2 text-sm font-bold text-[#b5e3f4] disabled:opacity-60">
            {busy ? 'Adding…' : `Add ${adding.studentIds.length || ''} to this route`}
          </button>
        </div>
      ) : null}

      {route.students.length ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm text-[#191970] dark:text-slate-200">
            <thead><tr className="text-left text-[11px] uppercase tracking-[0.12em] text-[#800020]"><th className="py-1 pr-2">Student</th><th className="pr-2">Pick-up</th><th className="pr-2">Drop-off</th><th className="pr-2">Trip</th><th className="pr-2">Rides</th><th /></tr></thead>
            <tbody>
              {route.students.map(student => (
                <tr key={student.studentId} className="border-t border-[#c9a96e]/25">
                  <td className="py-1.5 pr-2"><b>{student.name}</b> <span className="text-xs text-slate-500">{student.className}</span></td>
                  <td className="pr-2">{time12(student.pickupTime)}{student.pickupPoint ? <span className="block text-xs text-slate-500">{student.pickupPoint}</span> : null}</td>
                  <td className="pr-2">{time12(student.dropoffTime)}</td>
                  <td className="pr-2">{student.tripNo}</td>
                  <td className="pr-2 text-xs">{RIDES[student.directions]}</td>
                  <td><button type="button" onClick={() => run(() => unassignRouteStudent(route.id, student.studentId), `${student.name} removed from ${route.name}.`)} className="text-xs font-semibold text-rose-700 underline">Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </article>
  );
}

export default function TransportAdminPage() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => getTransportAdmin().then(setData).catch(err => setError(err.message)), []);
  useEffect(() => { load(); }, [load]);

  async function saveNew() {
    setBusy(true); setError(''); setNotice('');
    try { await createRoute(form); setForm(null); setNotice('Route created. Now add its students.'); await load(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  const routes = data?.routes || [];
  const riders = routes.reduce((sum, route) => sum + route.students.length, 0);
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-8">
      <header className="overflow-hidden rounded-3xl border-2 border-[#c9a96e] bg-[#191970] text-white">
        <div className="h-1.5 bg-gradient-to-r from-[#800000] via-[#c9a96e] to-[#1a5c38]" />
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#c9a96e]">School transport</p>
            <h1 className="text-2xl font-black">Routes, drivers and pick-up times</h1>
            <p className="text-sm text-[#b5e3f4]">{routes.length} route{routes.length === 1 ? '' : 's'} · {riders} student{riders === 1 ? '' : 's'} on the buses</p>
          </div>
          <button type="button" onClick={() => setForm(form ? null : { ...BLANK_ROUTE })} className="rounded-full bg-[#c9a96e] px-5 py-2 text-sm font-black text-[#191970]">{form ? 'Close' : '+ New route'}</button>
        </div>
      </header>

      {error ? <p role="alert" className="rounded-2xl bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-900">{error}</p> : null}
      {notice ? <p role="status" className="rounded-2xl bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-900">{notice}</p> : null}

      {data?.today?.length ? (
        <section className="rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-4 dark:bg-slate-900/50">
          <h2 className="mb-2 text-sm font-black uppercase tracking-[0.16em] text-[#800020]">Today&apos;s buses</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.today.map(run => (
              <li key={run.id} className="rounded-2xl bg-white/80 px-3 py-2 text-sm text-[#191970]">
                <b>{run.driverName || 'Driver'}</b> · {run.direction === 'morning' ? 'Morning' : 'Afternoon'} trip {run.tripNo} ·{' '}
                {run.arrivedAt ? `arrived ${clock(run.arrivedAt)}` : run.departedAt ? `left school ${clock(run.departedAt)}` : 'on the way'}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {form ? (
        <section className="rounded-3xl border border-[#c9a96e]/50 bg-[#fff8ef] p-4 dark:bg-slate-900/50">
          <h2 className="mb-3 text-lg font-black text-[#800000]">New route</h2>
          <RouteForm value={form} drivers={data?.drivers || []} onChange={setForm} onSave={saveNew} busy={busy} saveLabel="Create route" />
        </section>
      ) : null}

      {!data && !error ? <p className="text-sm text-[#191970]">Loading…</p> : null}
      {data && !routes.length && !form ? <p className="rounded-3xl bg-white/80 p-5 text-sm text-[#191970]">No routes yet. Press <b>New route</b> to add the first one.</p> : null}
      <div className="space-y-3">
        {routes.map(route => <RouteCard key={route.id} route={route} drivers={data?.drivers || []} students={data?.students || []} onChanged={load} setNotice={setNotice} setError={setError} />)}
      </div>
    </div>
  );
}
