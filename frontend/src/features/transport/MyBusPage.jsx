import React, { useEffect, useState } from 'react';
import { directionsLink, getMyBus, hasHome, saveHome } from './transportApi';
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

const FIELD = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/20 dark:bg-slate-800 dark:text-white';

/** Where the bus collects this child. A pin dropped at home is what the driver navigates to; words help at the gate. */
function HomeLocation({ child, canSet }) {
  const [home, setHome] = useState(child.home);
  const [address, setAddress] = useState(child.home?.address || '');
  const [landmark, setLandmark] = useState(child.home?.landmark || '');
  const [pin, setPin] = useState(child.home?.lat !== null && child.home?.lat !== undefined ? { lat: child.home.lat, lng: child.home.lng } : null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  if (!canSet && !hasHome(home)) return null;

  const takePhoneLocation = () => {
    if (!navigator.geolocation) { setMessage('This phone cannot share its location. Type the address instead.'); return; }
    setMessage('Finding your location…');
    navigator.geolocation.getCurrentPosition(
      position => { setPin({ lat: Number(position.coords.latitude.toFixed(6)), lng: Number(position.coords.longitude.toFixed(6)) }); setMessage(`Location found, accurate to about ${Math.round(position.coords.accuracy)} metres. Press Save.`); },
      () => setMessage('Could not get your location. Allow location for Ndovera, or type the address instead.'),
      { enableHighAccuracy: true, timeout: 20000 },
    );
  };
  const save = async event => {
    event.preventDefault();
    setBusy(true); setMessage('');
    try {
      const result = await saveHome(child.studentId, { address, landmark, lat: pin?.lat ?? null, lng: pin?.lng ?? null });
      setHome(result.home);
      setMessage('Saved. The driver sees this on the trips your child rides.');
    } catch (err) { setMessage(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-2 rounded-2xl bg-white/90 p-3 text-sm text-[#191970] dark:bg-slate-800/70 dark:text-slate-100">
      <p className="text-base font-black">Home location for the driver</p>
      {canSet ? (
        <form onSubmit={save} className="space-y-2" aria-label={`Home location for ${child.name}`}>
          <label className="block font-bold">Address<input className={FIELD} value={address} onChange={event => setAddress(event.target.value)} placeholder="House number, street, area" /></label>
          <label className="block font-bold">Landmark or gate<input className={FIELD} value={landmark} onChange={event => setLandmark(event.target.value)} placeholder="For example blue gate, opposite the church" /></label>
          <p>When you are at home, use your location: it takes the driver to your gate more exactly than an address.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={takePhoneLocation} className="rounded-xl border-2 border-[#191970] bg-white px-3 py-2 font-black text-[#191970] dark:border-white/40 dark:bg-slate-900 dark:text-white">📍 I am at home: use my location</button>
            <button type="submit" disabled={busy} className="rounded-xl bg-[#1a5c38] px-4 py-2 font-black text-white disabled:opacity-60">{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      ) : <p>{home.address}{home.landmark ? ` · ${home.landmark}` : ''}</p>}
      {message ? <p role="status" className="font-semibold">{message}</p> : null}
      {hasHome(home) ? <a href={directionsLink([home])} target="_blank" rel="noreferrer noopener" className="inline-block font-bold text-[#1a5c38] underline dark:text-emerald-300">Check it on Google Maps</a> : null}
    </div>
  );
}

export default function MyBusPage() {
  const [children, setChildren] = useState(null);
  const [canSetHome, setCanSetHome] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getMyBus().then(result => { setCanSetHome(Boolean(result.canSetHome)); setChildren(result.children || []); }).catch(err => setError(err.message));
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
          <HomeLocation child={child} canSet={canSetHome} />
        </section>
      ))}
    </div>
  );
}
