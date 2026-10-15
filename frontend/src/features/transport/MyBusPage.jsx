import React, { useEffect, useState } from 'react';
import { getMyBus } from './transportApi';
import { clock } from './TransportAdminPage';

// A parent's children (or a student's own) school bus: route, driver, pick-up time and today's trips.

const time12 = value => {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!match) return '—';
  const hours = Number(match[1]);
  return `${hours % 12 || 12}:${match[2]} ${hours < 12 ? 'am' : 'pm'}`;
};
const RIDES = { both: 'Morning & afternoon', morning: 'Morning only', afternoon: 'Afternoon only' };

export function todayLine(entry) {
  const direction = entry.direction === 'afternoon' ? 'Afternoon' : 'Morning';
  if (entry.arrivedAt) return `${direction}: arrived at school ${clock(entry.arrivedAt)}`;
  if (entry.departedAt) return `${direction}: left school ${clock(entry.departedAt)}`;
  return `${direction}: on the bus since ${clock(entry.boardedAt)}`;
}

export default function MyBusPage() {
  const [children, setChildren] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getMyBus().then(result => setChildren(result.children || [])).catch(err => setError(err.message));
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-8">
      <header className="overflow-hidden rounded-3xl border-2 border-[#c9a96e] bg-[#191970] p-4 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#c9a96e]">School bus</p>
        <h1 className="text-2xl font-black">🚌 Route, driver and pick-up times</h1>
      </header>
      {error ? <p role="alert" className="rounded-2xl bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-900">{error}</p> : null}
      {children && !children.length ? <p className="rounded-3xl bg-white/80 p-5 text-sm text-[#191970]">No school bus is set up for you yet. The school adds children to bus routes.</p> : null}
      {(children || []).map(child => (
        <section key={child.studentId} className="space-y-3 rounded-3xl border border-[#c9a96e]/50 bg-[#b5e3f4] p-4 dark:bg-slate-900/50">
          <h2 className="text-lg font-black text-[#800000] dark:text-amber-200">{child.name}</h2>
          {child.today.length ? (
            <ul className="space-y-1">
              {child.today.map((entry, index) => <li key={index} className="rounded-xl bg-emerald-100 px-3 py-1.5 text-sm font-bold text-emerald-900">{todayLine(entry)}</li>)}
            </ul>
          ) : null}
          {child.routes.map(route => (
            <div key={route.id} className="flex flex-wrap gap-4 rounded-2xl bg-white/90 p-3 text-sm text-[#191970] dark:bg-slate-800/70 dark:text-slate-100">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-base font-black">{route.routeName}</p>
                {route.areas ? <p className="text-xs text-slate-600 dark:text-slate-300">Plies: {route.areas}</p> : null}
                <p><b>Driver:</b> {route.driverName || 'Not set'}{route.driverPhone ? <> · <a href={`tel:${route.driverPhone}`} className="font-bold text-[#1a5c38] underline">{route.driverPhone}</a></> : null}</p>
                {route.vehicle ? <p><b>Vehicle:</b> {route.vehicle}</p> : null}
                <p><b>Pick-up:</b> {time12(route.pickupTime)}{route.pickupPoint ? ` at ${route.pickupPoint}` : ''} · <b>Drop-off:</b> {time12(route.dropoffTime)}</p>
                <p className="text-xs">{RIDES[route.directions] || ''}{route.tripNo > 1 ? ` · trip ${route.tripNo}` : ''}</p>
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
