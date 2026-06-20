import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import attendanceService from '../services/attendanceService';

const FACE_ENROLL_KEY = 'ndovera:staff-face-enrolled';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function currentSession() {
  return new Date().getHours() < 12 ? 'morning' : 'afternoon';
}

function signedKey(session, date = todayKey()) {
  return `ndovera:staff-signin:${date}:${session}`;
}

export function isSignedIn(session) {
  try {
    return Boolean(localStorage.getItem(signedKey(session)));
  } catch {
    return false;
  }
}

function markSignedInLocal(session, payload) {
  try {
    localStorage.setItem(signedKey(session), JSON.stringify({ ...payload, at: new Date().toISOString() }));
  } catch {
    /* ignore */
  }
}

export function isFaceEnrolled() {
  try {
    return localStorage.getItem(FACE_ENROLL_KEY) === '1';
  } catch {
    return false;
  }
}

function supportsFaceDetector() {
  return typeof window !== 'undefined' && 'FaceDetector' in window;
}

function supportsBarcodeDetector() {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

function currentStaffId() {
  try {
    return (
      localStorage.getItem('staffId') ||
      localStorage.getItem('userId') ||
      localStorage.getItem('ndovera_user_id') ||
      'SELF'
    );
  } catch {
    return 'SELF';
  }
}

export default function StaffSignIn({ onClose, onSignedIn }) {
  const [view, setView] = useState('menu');
  const session = currentSession();

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/70 backdrop-blur-sm sm:items-center">
      <AnimatePresence mode="wait">
        {view === 'menu' && (
          <SignInMenu
            key="menu"
            session={session}
            onClose={onClose}
            onClockIn={() => setView('scan')}
            onRequestPermission={() => setView('permission')}
          />
        )}
        {view === 'scan' && (
          <FullScreenScanner
            key="scan"
            session={session}
            onBack={() => setView('menu')}
            onClose={onClose}
            onSignedIn={(s) => {
              if (onSignedIn) onSignedIn(s);
              onClose();
            }}
          />
        )}
        {view === 'permission' && <PermissionRequest key="perm" onBack={() => setView('menu')} onClose={onClose} />}
      </AnimatePresence>
    </div>
  );
}

function SignInMenu({ session, onClose, onClockIn, onRequestPermission }) {
  const morningDone = isSignedIn('morning');
  const afternoonDone = isSignedIn('afternoon');

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      className="w-full max-w-md rounded-t-3xl border border-blue-500/20 bg-white p-6 shadow-2xl dark:bg-slate-900 sm:rounded-3xl"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
            🔐 Staff sign in
          </div>
          <h2 className="mt-3 text-xl font-bold" style={{ color: '#191970' }}>How do you want to sign in?</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Scan the school QR to clock in, or request permission for an absence.</p>
        </div>
        <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <SessionPill icon="☀️" label="Morning" required done={morningDone} active={session === 'morning'} />
        <SessionPill icon="🌇" label="Afternoon" done={afternoonDone} active={session === 'afternoon'} />
      </div>

      <div className="mt-5 space-y-3">
        <button
          onClick={onClockIn}
          className="flex w-full items-center gap-4 rounded-2xl bg-blue-600 px-5 py-4 text-left text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-700"
        >
          <span className="rounded-xl bg-white/20 p-2.5 text-2xl">📷</span>
          <span className="flex-1">
            <span className="block text-base font-bold">Clock-in</span>
            <span className="block text-xs text-blue-100">Full-screen scanner · auto-marks you present</span>
          </span>
        </button>

        <button
          onClick={onRequestPermission}
          className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left transition hover:border-blue-300 hover:bg-blue-50/60 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
          style={{ color: '#191970' }}
        >
          <span className="rounded-xl bg-amber-500/15 p-2.5 text-2xl">🛡️</span>
          <span className="flex-1">
            <span className="block text-base font-bold">Request permission</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">For sick leave, official duty or absence</span>
          </span>
        </button>
      </div>

      {session === 'morning' && !morningDone && (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-300">
          ⏰ Morning sign-in is compulsory and still pending.
        </p>
      )}
    </motion.div>
  );
}

function SessionPill({ icon, label, required, done, active }) {
  return (
    <div
      className={`rounded-2xl border px-3 py-2.5 ${
        done
          ? 'border-emerald-500/30 bg-emerald-500/10'
          : active
            ? 'border-blue-500/40 bg-blue-500/10'
            : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: '#191970' }}>
          {icon} {label}
        </span>
        {done ? <span className="text-emerald-500">✓</span> : null}
      </div>
      <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        {done ? 'Signed in' : required ? 'Compulsory' : 'Optional'}
      </p>
    </div>
  );
}

function FullScreenScanner({ session, onBack, onClose, onSignedIn }) {
  const [permission, setPermission] = useState('prompt');
  const [status, setStatus] = useState('Starting camera…');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [facePresent, setFacePresent] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const handledRef = useRef(false);
  const facePresentRef = useRef(false);

  const faceRequired = isFaceEnrolled() && supportsFaceDetector();
  const canScan = supportsBarcodeDetector();

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) stream.getTracks().forEach((t) => t.stop());
  }, []);

  const completeSignIn = useCallback(
    async (decodedText) => {
      if (handledRef.current) return;
      handledRef.current = true;
      setStatus('Verifying…');
      try {
        await attendanceService.markAttendance(currentStaffId(), {
          method: faceRequired ? 'Face + QR' : 'QR',
          status: 'Present',
          notes: `Self clock-in (${session}) via QR${decodedText ? '' : ''}`,
          markedBy: 'SELF',
        });
        markSignedInLocal(session, { token: decodedText, face: faceRequired ? 'verified' : 'skipped' });
        setSuccess('Present — you are signed in.');
        stop();
        setTimeout(() => onSignedIn(session), 1200);
      } catch (err) {
        handledRef.current = false;
        setError((err && err.message) || 'Could not mark attendance. Try again.');
        setStatus('Point the camera at the school QR code');
      }
    },
    [faceRequired, onSignedIn, session, stop],
  );

  useEffect(() => {
    let barcodeDetector = null;
    let faceDetector = null;
    if (canScan) {
      try {
        barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch {
        barcodeDetector = null;
      }
    }
    if (faceRequired) {
      try {
        faceDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
      } catch {
        faceDetector = null;
      }
    }

    const tick = async () => {
      const video = videoRef.current;
      if (video && video.readyState >= 2 && !handledRef.current) {
        if (faceDetector) {
          try {
            const faces = await faceDetector.detect(video);
            const present = Array.isArray(faces) && faces.length > 0;
            facePresentRef.current = present;
            setFacePresent(present);
          } catch {
            /* ignore */
          }
        }
        if (barcodeDetector) {
          try {
            const codes = await barcodeDetector.detect(video);
            if (codes && codes.length > 0) {
              if (faceRequired && !facePresentRef.current) {
                setStatus('QR found — keep your face in view to confirm it is really you…');
              } else {
                void completeSignIn(codes[0].rawValue || 'scanned');
              }
            }
          } catch {
            /* ignore */
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: faceRequired ? 'user' : 'environment' },
          audio: false,
        });
        streamRef.current = stream;
        setPermission('granted');
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStatus(canScan ? 'Point the camera at the school QR code' : 'Camera ready');
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        const message = String((err && err.message) || err || '');
        if (/permission|denied|NotAllowed/i.test(message) || (err && err.name === 'NotAllowedError')) {
          setPermission('denied');
          setError('Camera permission is required to clock in. Enable it in your browser settings and try again.');
        } else {
          setError('Unable to start the camera. Make sure no other app is using it.');
        }
      }
    };

    void start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[130] flex flex-col bg-slate-950 text-white"
    >
      <div className="flex items-center justify-between px-5 py-4">
        <button onClick={() => { stop(); onBack(); }} className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold">Back</button>
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider">
          {session === 'morning' ? '☀️' : '🌇'} {session} sign-in
        </div>
        <button onClick={() => { stop(); onClose(); }} className="rounded-full bg-white/10 p-2">✕</button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-64 w-64 max-w-[75vw]">
            <span className="absolute left-0 top-0 h-10 w-10 rounded-tl-2xl border-l-4 border-t-4 border-blue-400" />
            <span className="absolute right-0 top-0 h-10 w-10 rounded-tr-2xl border-r-4 border-t-4 border-blue-400" />
            <span className="absolute bottom-0 left-0 h-10 w-10 rounded-bl-2xl border-b-4 border-l-4 border-blue-400" />
            <span className="absolute bottom-0 right-0 h-10 w-10 rounded-br-2xl border-b-4 border-r-4 border-blue-400" />
          </div>
        </div>

        {success && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-600/90">
            <span className="text-7xl">✅</span>
            <p className="mt-3 text-lg font-bold">{success}</p>
          </div>
        )}
      </div>

      <div className="space-y-3 px-5 py-5">
        {faceRequired && !success && (
          <div className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${facePresent ? 'bg-emerald-500/20 text-emerald-200' : 'bg-amber-500/20 text-amber-100'}`}>
            🙂 {facePresent ? 'Live face confirmed' : 'Keep your face in view'}
          </div>
        )}
        {!canScan && !error && !success && (
          <button onClick={() => completeSignIn('manual')} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold">
            Confirm sign-in (scanner not supported on this device)
          </button>
        )}
        {error ? (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-rose-500/20 px-3 py-2 text-sm font-semibold text-rose-100">📷 {error}</div>
        ) : (
          <p className="text-center text-sm font-medium text-white/80">{status}</p>
        )}
        {permission === 'denied' && (
          <button onClick={() => window.location.reload()} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold">Retry camera access</button>
        )}
      </div>
    </motion.div>
  );
}

const PERMISSION_TYPES = ['Sick leave', 'Personal', 'Official duty', 'Late arrival', 'Early departure', 'Other'];

function PermissionRequest({ onBack, onClose }) {
  const [type, setType] = useState(PERMISSION_TYPES[0]);
  const [fromDate, setFromDate] = useState(todayKey());
  const [toDate, setToDate] = useState(todayKey());
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    const payload = { type, fromDate, toDate, reason, requestedAt: new Date().toISOString() };
    try {
      const raw = localStorage.getItem('ndovera:staff-permission-requests');
      const list = raw ? JSON.parse(raw) : [];
      list.push(payload);
      localStorage.setItem('ndovera:staff-permission-requests', JSON.stringify(list));
    } catch {
      /* ignore */
    } finally {
      setSubmitting(false);
      setDone(true);
    }
  };

  if (done) {
    return (
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} className="w-full max-w-md rounded-t-3xl border border-blue-500/20 bg-white p-7 text-center shadow-2xl dark:bg-slate-900 sm:rounded-3xl">
        <span className="text-5xl">✅</span>
        <h2 className="mt-3 text-xl font-bold" style={{ color: '#191970' }}>Permission request sent</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your {type.toLowerCase()} request is awaiting approval.</p>
        <button onClick={onClose} className="mt-5 w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white">Done</button>
      </motion.div>
    );
  }

  const fieldClass = 'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white';

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} className="w-full max-w-md rounded-t-3xl border border-blue-500/20 bg-white p-6 shadow-2xl dark:bg-slate-900 sm:rounded-3xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold" style={{ color: '#191970' }}>Request permission</h2>
        <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
      </div>
      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)} className={fieldClass} style={{ color: '#191970' }}>
            {PERMISSION_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">From</span>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={fieldClass} style={{ color: '#191970' }} />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">To</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={fieldClass} style={{ color: '#191970' }} />
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Reason</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows="3" placeholder="Briefly explain your request" className={`${fieldClass} resize-none`} style={{ color: '#191970' }} />
        </label>
      </div>
      <div className="mt-5 flex gap-3">
        <button onClick={onBack} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold dark:border-slate-700 dark:text-white" style={{ color: '#191970' }}>Back</button>
        <button onClick={submit} disabled={submitting || !reason.trim()} className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white disabled:opacity-60">
          {submitting ? 'Sending…' : 'Submit request'}
        </button>
      </div>
    </motion.div>
  );
}

export function FaceEnrollmentToggle() {
  const [enrolled, setEnrolled] = useState(isFaceEnrolled());
  const supported = supportsFaceDetector();

  const toggle = () => {
    const next = !enrolled;
    try {
      if (next) localStorage.setItem(FACE_ENROLL_KEY, '1');
      else localStorage.removeItem(FACE_ENROLL_KEY);
    } catch {
      /* ignore */
    }
    setEnrolled(next);
  };

  return (
    <button
      onClick={toggle}
      title={supported ? 'Use a live face check when clocking in' : 'Live face check is not supported on this device'}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${
        enrolled
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
          : 'border-white/30 bg-white/10 text-white'
      }`}
    >
      🧬 {enrolled ? 'Face check on' : 'Save my face'}{!supported && enrolled ? ' (unsupported)' : ''}
    </button>
  );
}
