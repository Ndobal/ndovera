import React, { useEffect, useRef, useState } from 'react';
import { startAssignment } from '../classroomService';

// Timed assessments: the server starts the clock and owns the deadline; this
// shows the countdown and submits automatically when it reaches zero.

const minutesOf = assignment => Math.max(0, Number(assignment?.metadata?.durationMinutes) || 0);
export const isTimedAssignment = assignment => minutesOf(assignment) > 0;

/**
 * `ready` is false until the timed attempt has started (always true for untimed work).
 * `onTimeUp` is called once when the clock reaches zero.
 */
export function useTimedAttempt(assignment, { enabled = true, onTimeUp } = {}) {
  const timed = isTimedAssignment(assignment) && enabled;
  const [state, setState] = useState({ ready: !timed, deadline: null, offset: 0, error: '' });
  const [now, setNow] = useState(Date.now());
  const fired = useRef(false);
  const timeUp = useRef(onTimeUp);
  timeUp.current = onTimeUp;

  useEffect(() => {
    fired.current = false;
    if (!timed) { setState({ ready: true, deadline: null, offset: 0, error: '' }); return undefined; }
    let cancelled = false;
    setState({ ready: false, deadline: null, offset: 0, error: '' });
    startAssignment(assignment.id).then(result => {
      if (cancelled) return;
      if (!result?.success) { setState({ ready: false, deadline: null, offset: 0, error: result?.message || 'Could not start this assessment.' }); return; }
      if (!result.timed) { setState({ ready: true, deadline: null, offset: 0, error: '' }); return; }
      // Count against the server's clock, whatever the device's clock says.
      const offset = Date.parse(result.serverNow) - Date.now();
      setState({ ready: true, deadline: Date.parse(result.deadline), offset, error: '' });
    }).catch(err => !cancelled && setState({ ready: false, deadline: null, offset: 0, error: err.message || 'Could not start this assessment.' }));
    return () => { cancelled = true; };
  }, [assignment?.id, timed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!state.deadline) return undefined;
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(tick);
  }, [state.deadline]);

  const remainingMs = state.deadline ? Math.max(0, state.deadline - (now + state.offset)) : null;
  useEffect(() => {
    if (remainingMs === 0 && !fired.current) { fired.current = true; timeUp.current?.(); }
  }, [remainingMs]);

  return { timed, ...state, remainingMs, minutes: minutesOf(assignment) };
}

export function CountdownBar({ attempt, onDark = false }) {
  if (!attempt.timed) return null;
  if (attempt.error) return <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800">{attempt.error}</p>;
  if (!attempt.ready) return <p role="status" className="text-sm font-semibold">Starting the timer…</p>;
  const seconds = Math.ceil((attempt.remainingMs || 0) / 1000);
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const low = seconds <= 60;
  const percent = Math.max(0, Math.min(100, ((attempt.remainingMs || 0) / (attempt.minutes * 60000)) * 100));
  return (
    <div className={`sticky top-0 z-10 rounded-2xl border p-3 shadow ${low ? 'border-rose-400 bg-rose-50 text-rose-900' : onDark ? 'border-white/20 bg-slate-900/90 text-white' : 'border-[#c9a96e]/50 bg-white text-[#191970]'}`} role="timer" aria-live={low ? 'assertive' : 'off'} aria-label={`Time left ${clock}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold">{seconds > 0 ? 'Time left' : 'Time is up — submitting your answers'}</span>
        <span className="font-mono text-2xl font-black tabular-nums">{clock}</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/10"><div className={`h-full ${low ? 'bg-rose-600' : 'bg-[#1a5c38]'}`} style={{ width: `${percent}%` }} /></div>
    </div>
  );
}
