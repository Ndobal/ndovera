import React, { useCallback, useEffect, useState } from 'react';
import { boardChild, getDriverTransport, markArrived, markDeparted, openDriverRun, setDriverTrips } from './transportApi';
import { clock } from './TransportAdminPage';

// The driver's school runs: who rides each trip, ticking the children on board from the list,
// then "Arrived at school" in the morning and "Leaving school" in the afternoon.

const time12 = value => {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!match) return '';
  const hours = Number(match[1]);
  return `${hours % 12 || 12}:${match[2]} ${hours < 12 ? 'am' : 'pm'}`;
};

export default function DriverTransportPage() {
  const [data, setData] = useState(null);
  const [direction, setDirection] = useState(() => (new Date().getHours() < 12 ? 'morning' : 'afternoon'));
  const [tripNo, setTripNo] = useState(1);
  const [trip, setTrip] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => getDriverTransport().then(setData).catch(err => setError(err.message)), []);
  useEffect(() => { load(); }, [load]);

  const trips = data?.trips || 1;

  async function changeTrips(value) {
    setError('');
    try { const result = await setDriverTrips(value); setData(current => ({ ...current, trips: result.trips })); if (tripNo > result.trips) setTripNo(1); setTrip(null); } catch (err) { setError(err.message); }
  }

  async function start() {
    setBusy(true); setError(''); setNotice('');
    try { const result = await openDriverRun(direction, tripNo); setTrip({ ...result, boarded: new Set(result.boarded) }); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function toggle(studentId, onBoard) {
    setError('');
    try {
      await boardChild(trip.run.id, { studentId, onBoard });
      setTrip(current => { const boarded = new Set(current.boarded); if (onBoard) boarded.add(studentId); else boarded.delete(studentId); return { ...current, boarded }; });
    } catch (err) { setError(err.message); }
  }

  /** Tick everyone not yet on board, one after another. */
  async function markAll() {
    setBusy(true); setError('');
    try {
      for (const rider of trip.riders) {
        if (trip.boarded.has(rider.studentId)) continue;
        // eslint-disable-next-line no-await-in-loop
        await boardChild(trip.run.id, { studentId: rider.studentId, onBoard: true });
        setTrip(current => ({ ...current, boarded: new Set([...current.boarded, rider.studentId]) }));
      }
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function finish() {
    const morning = trip.run.direction === 'morning';
    const count = trip.boarded.size;
    if (!window.confirm(morning
      ? `Record that the bus has arrived at school with ${count} child${count === 1 ? '' : 'ren'}? They are marked present and their parents are told.`
      : `Record that the bus is leaving school with ${count} child${count === 1 ? '' : 'ren'}? Their parents are told.`)) return;
    setBusy(true); setError('');
    try {
      const result = morning ? await markArrived(trip.run.id) : await markDeparted(trip.run.id);
      setTrip(current => ({ ...current, run: result.run }));
      setNotice(morning
        ? `Arrival recorded at ${clock(result.run.arrivedAt)}. ${result.markedPresent} child${result.markedPresent === 1 ? '' : 'ren'} marked present; parents and the school have been told.`
        : `Departure recorded at ${clock(result.run.departedAt)}. Parents and the school have been told the bus has just left school.`);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  const done = trip && (trip.run.arrivedAt || trip.run.departedAt);
  const allStudents = (data?.routes || []).flatMap(route => route.students.map(student => ({ ...student, routeName: route.name })));

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <header className="overflow-hidden rounded-3xl border-2 border-[#c9a96e] bg-[#191970] text-white">
        <div className="h-1.5 bg-gradient-to-r from-[#800000] via-[#c9a96e] to-[#1a5c38]" />
        <div className="p-4">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#c9a96e]">My school runs</p>
          <h1 className="text-2xl font-black">🚌 {(data?.routes || []).map(route => route.name).join(' · ') || 'School bus'}</h1>
          <p className="text-sm text-[#b5e3f4]">{allStudents.length} student{allStudents.length === 1 ? '' : 's'} on your route{(data?.routes || []).length === 1 ? '' : 's'}</p>
        </div>
      </header>

      {error ? <p role="alert" className="rounded-2xl bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-900">{error}</p> : null}
      {notice ? <p role="status" className="rounded-2xl bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-900">{notice}</p> : null}
      {data && !(data.routes || []).length ? <p className="rounded-3xl bg-white/80 p-5 text-sm text-[#191970]">You have no route yet. Ask the school to assign you one.</p> : null}

      {(data?.routes || []).length ? (
        <section className="space-y-3 rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-4 dark:bg-slate-900/50">
          <div className="flex flex-wrap items-center gap-2 text-sm text-[#191970] dark:text-slate-100">
            <span className="font-bold">I run the school runs</span>
            {[1, 2, 3].map(n => (
              <button key={n} type="button" onClick={() => changeTrips(n)} className={`rounded-full px-3 py-1 font-black ${trips === n ? 'bg-[#800020] text-[#b5e3f4]' : 'bg-white text-[#191970]'}`}>{n === 1 ? 'once' : n === 2 ? 'twice' : 'three times'}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {['morning', 'afternoon'].map(value => (
              <button key={value} type="button" onClick={() => { setDirection(value); setTrip(null); }} className={`rounded-2xl py-3 text-base font-black ${direction === value ? 'bg-[#191970] text-[#c9a96e]' : 'bg-white text-[#191970]'}`}>
                {value === 'morning' ? '🌅 Morning' : '🌇 Afternoon'}
              </button>
            ))}
          </div>
          {trips > 1 ? (
            <div className="flex gap-2">
              {Array.from({ length: trips }, (_, index) => index + 1).map(n => (
                <button key={n} type="button" onClick={() => { setTripNo(n); setTrip(null); }} className={`flex-1 rounded-xl py-2 text-sm font-black ${tripNo === n ? 'bg-[#1a5c38] text-white' : 'bg-white text-[#191970]'}`}>Trip {n}</button>
              ))}
            </div>
          ) : null}
          {!trip ? (
            <button type="button" onClick={start} disabled={busy} className="w-full rounded-2xl bg-[#1a5c38] py-3 text-lg font-black text-white disabled:opacity-60">
              {busy ? 'Opening…' : `Start ${direction} ${trips > 1 ? `trip ${tripNo}` : 'run'}`}
            </button>
          ) : null}
        </section>
      ) : null}

      {trip ? (
        <section className="space-y-3 rounded-3xl border border-[#c9a96e]/40 bg-white/90 p-4 dark:bg-slate-900/60">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex-1 text-lg font-black text-[#800000] dark:text-amber-200">
              {trip.run.direction === 'morning' ? 'Morning' : 'Afternoon'}{trips > 1 ? ` trip ${trip.run.tripNo}` : ''}: {trip.boarded.size} of {trip.riders.length} on board
            </h2>
            {!done && trip.riders.length && trip.boarded.size < trip.riders.length ? <button type="button" onClick={markAll} disabled={busy} className="rounded-xl bg-[#191970] px-4 py-2 text-sm font-black text-[#c9a96e] disabled:opacity-60">✓ Mark all on board</button> : null}
          </div>
          {!done ? <p className="text-xs text-slate-600">Tap each child who is on the bus. Tap again to undo.</p> : null}
          <ul className="space-y-1.5">
            {trip.riders.map(rider => {
              const on = trip.boarded.has(rider.studentId);
              return (
                <li key={rider.studentId}>
                  <button type="button" disabled={Boolean(done)} onClick={() => toggle(rider.studentId, !on)}
                    className={`flex w-full items-center gap-3 rounded-2xl border-2 px-3 py-2.5 text-left ${on ? 'border-[#1a5c38] bg-emerald-50' : 'border-[#c9a96e]/40 bg-white'} disabled:opacity-80`}>
                    <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-lg font-black ${on ? 'bg-[#1a5c38] text-white' : 'bg-slate-200 text-slate-500'}`}>{on ? '✓' : ''}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-black text-[#191970]">{rider.name}</span>
                      <span className="block text-xs text-slate-600">
                        {rider.className}{trip.run.direction === 'morning' ? (rider.pickupTime ? ` · pick-up ${time12(rider.pickupTime)}` : '') : (rider.dropoffTime ? ` · drop-off ${time12(rider.dropoffTime)}` : '')}{rider.pickupPoint ? ` · ${rider.pickupPoint}` : ''}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {!trip.riders.length ? <li className="text-sm text-slate-600">No children ride this {trips > 1 ? 'trip' : 'run'}.</li> : null}
          </ul>
          {done ? (
            <p className="rounded-2xl bg-emerald-100 px-4 py-3 text-center font-black text-emerald-900">
              {trip.run.arrivedAt ? `Arrived at school at ${clock(trip.run.arrivedAt)}` : `Left school at ${clock(trip.run.departedAt)}`}
            </p>
          ) : (
            <button type="button" onClick={finish} disabled={busy} className="w-full rounded-2xl bg-[#800020] py-4 text-lg font-black text-[#b5e3f4] disabled:opacity-60">
              {trip.run.direction === 'morning' ? '🏫 Arrived at school' : '🚌 Leaving school now'}
            </button>
          )}
        </section>
      ) : null}

      {allStudents.length ? (
        <section className="rounded-3xl border border-[#c9a96e]/40 bg-[#fff8ef] p-4 dark:bg-slate-900/50">
          <h2 className="mb-2 text-sm font-black uppercase tracking-[0.16em] text-[#800020]">Everyone I carry</h2>
          <ul className="divide-y divide-[#c9a96e]/25 text-sm text-[#191970] dark:text-slate-100">
            {allStudents.map(student => (
              <li key={`${student.routeId}-${student.studentId}`} className="flex flex-wrap justify-between gap-2 py-1.5">
                <span><b>{student.name}</b> <span className="text-xs text-slate-500">{student.className}</span></span>
                <span className="text-xs">{student.directions === 'both' ? 'Morning & afternoon' : student.directions === 'morning' ? 'Morning only' : 'Afternoon only'}{trips > 1 ? ` · trip ${student.tripNo}` : ''}{student.pickupTime ? ` · ${time12(student.pickupTime)}` : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
