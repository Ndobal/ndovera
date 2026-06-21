import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import StudentSectionShell from '../student/StudentSectionShell';
import { getStoredAuth } from '../../../features/auth/services/authApi';
import {
  getStaffAttendanceActivity,
  getStaffAttendanceColleagues,
  getStaffAttendancePermissionRequests,
  getStaffAttendanceSettings,
  submitStaffAttendancePermissionRequest,
  submitStaffAttendanceActivity,
  uploadStaffAttendanceFace,
} from '../../../features/school/services/schoolApi';
import { getAssignedClasses, getClassStudents, recordAttendance } from '../../../features/classroom/classroomService';
import {
  getQueuedStaffAttendanceActions,
  queueStaffAttendanceAction,
  removeQueuedStaffAttendanceAction,
} from '../../../features/attendance/staffAttendanceQueue';

// Royal-blue theme on white surfaces (light), neon retained for dark mode.
const SURFACE = 'rounded-3xl border border-[#2447d8]/15 bg-white p-6 shadow-[0_18px_42px_rgba(20,33,91,0.08)] dark:border-[#bf00ff]/35 dark:bg-[#800000]/75 dark:shadow-[0_0_28px_rgba(191,0,255,0.18)]';
const PANEL = 'rounded-2xl border border-[#2447d8]/15 bg-slate-50 p-4 dark:border-[#bf00ff]/25 dark:bg-black/20';
const LABEL = 'text-xs font-semibold uppercase tracking-[0.18em] text-[#2447d8] dark:text-[#bf00ff]';
const BODY = 'text-sm text-[#191970] dark:text-[#39ff14]';
const INPUT = 'w-full rounded-2xl border border-[#2447d8]/25 bg-white px-4 py-3 text-sm text-[#191970] outline-none focus:ring-2 focus:ring-[#2447d8] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff] dark:focus:ring-[#00ffff]';
const PRIMARY_BUTTON = 'rounded-2xl bg-[#2447d8] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#1b34a8] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#00ffff] dark:text-[#000000] dark:hover:bg-[#7dfcff]';
const SECONDARY_BUTTON = 'rounded-2xl border border-[#2447d8]/30 bg-white px-4 py-2.5 text-sm font-semibold text-[#2447d8] transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#bf00ff]/35 dark:bg-black/25 dark:text-[#bf00ff] dark:hover:bg-[#140014]';
const TODAY = new Date().toISOString().slice(0, 10);
const ATTENDANCE_SETTINGS_CACHE_KEY = 'ndovera_staff_attendance_settings_v1';

function formatDateTime(value) {
  if (!value) return 'Recent';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function formatMoney(value) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

function monthStart(dateText = TODAY) {
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return TODAY.slice(0, 8) + '01';
  }
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

function readCachedStaffAttendanceSettings() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ATTENDANCE_SETTINGS_CACHE_KEY);
    const parsed = JSON.parse(raw || 'null');
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedStaffAttendanceSettings(settings) {
  if (typeof window === 'undefined' || !settings || typeof settings !== 'object') return;
  try {
    window.localStorage.setItem(ATTENDANCE_SETTINGS_CACHE_KEY, JSON.stringify(settings));
  } catch {}
}

function isLikelyNetworkError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  if (typeof window !== 'undefined' && window.navigator && window.navigator.onLine === false) {
    return true;
  }
  return message.includes('failed to fetch') || message.includes('network') || message.includes('offline') || message.includes('load failed');
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
}

function formatPermissionType(value) {
  const normalized = String(value || 'absence').trim().toLowerCase();
  if (normalized === 'late') return 'Late Arrival';
  if (normalized === 'official') return 'Official Duty';
  if (normalized === 'remote') return 'Remote Duty';
  return 'Absence';
}

function permissionTone(status) {
  const normalized = String(status || 'pending').trim().toLowerCase();
  if (normalized === 'approved') return 'border-[#1a5c38]/25 bg-[#edf8f1] text-[#1a5c38] dark:border-[#00ffff]/30 dark:bg-[#002326] dark:text-[#00ffff]';
  if (normalized === 'rejected') return 'border-red-400/35 bg-red-50 text-[#800000] dark:border-[#ff5f8d]/35 dark:bg-[#4a0014] dark:text-[#ffffff]';
  return 'border-amber-400/35 bg-amber-50 text-amber-800 dark:border-amber-300/35 dark:bg-[#2d1a00] dark:text-amber-200';
}

function findLatestSignIn(events = []) {
  return events.find(event => event.action === 'sign-in') || null;
}

function statusTone(isLate) {
  return isLate
    ? 'border-amber-400/35 bg-amber-50 text-amber-800 dark:border-amber-300/35 dark:bg-[#2d1a00] dark:text-amber-200'
    : 'border-[#1a5c38]/25 bg-[#edf8f1] text-[#1a5c38] dark:border-[#00ffff]/30 dark:bg-[#012124] dark:text-[#00ffff]';
}

function buildTodaySummary(summary = {}, latestSignIn = null) {
  return {
    signIns: Number(summary?.signIns || 0),
    onTimeCount: Number(summary?.onTimeCount || 0),
    lateCount: Number(summary?.lateCount || 0),
    lateCharge: Number(summary?.lateCharge || 0),
    arrivalTime: latestSignIn?.createdAt || '',
  };
}

function MetricCard({ label, value, accent = 'text-[#191970] dark:text-[#39ff14]' }) {
  return (
    <div className={PANEL}>
      <p className={LABEL}>{label}</p>
      <p className={`mt-2 text-2xl font-black ${accent}`}>{value}</p>
    </div>
  );
}

// jsQR is loaded on demand so the camera scanner works on browsers without the native
// BarcodeDetector (iOS Safari, Firefox, most mobile browsers) — without bloating the bundle.
const JSQR_SRC = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
function loadJsQr() {
  return new Promise((resolve, reject) => {
    if (window.jsQR) { resolve(window.jsQR); return; }
    const existing = document.querySelector('script[data-jsqr="1"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.jsQR));
      existing.addEventListener('error', () => reject(new Error('jsQR failed to load')));
      return;
    }
    const element = document.createElement('script');
    element.src = JSQR_SRC;
    element.async = true;
    element.dataset.jsqr = '1';
    element.addEventListener('load', () => resolve(window.jsQR));
    element.addEventListener('error', () => reject(new Error('jsQR failed to load')));
    document.head.appendChild(element);
  });
}

function CameraScanner({ open, onDetect, disabled }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const streamRef = useRef(null);
  const detectedRef = useRef(false);
  const [scannerError, setScannerError] = useState('');
  const [scannerReady, setScannerReady] = useState(false);

  const stopScanner = useCallback(() => {
    detectedRef.current = false;
    if (animationRef.current) {
      window.cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScannerReady(false);
  }, []);

  useEffect(() => {
    if (!open || disabled) {
      stopScanner();
      return undefined;
    }

    if (typeof window === 'undefined' || !window.navigator?.mediaDevices?.getUserMedia) {
      setScannerError('This browser cannot open the camera. Use the manual QR entry field below.');
      stopScanner();
      return undefined;
    }

    let active = true;
    let detector = null;     // native BarcodeDetector when available
    let jsQrFn = null;       // jsQR fallback otherwise

    async function startScanner() {
      setScannerError('');
      try {
        // Decode with the native detector when present; otherwise load jsQR.
        if (window.BarcodeDetector) {
          try { detector = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch { detector = null; }
        }
        if (!detector) {
          jsQrFn = await loadJsQr().catch(() => null);
        }

        // Always open the camera (works on iOS Safari/Firefox even without BarcodeDetector).
        const stream = await window.navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => null);
        }
        setScannerReady(true);

        if (!detector && !jsQrFn) {
          setScannerError('The camera is on, but live QR decoding is not supported here. Read the code and type it in Manual QR Entry below.');
        }

        const scan = async () => {
          if (!active || !videoRef.current || detectedRef.current) return;
          try {
            let nextCode = '';
            if (detector) {
              const barcodes = await detector.detect(videoRef.current);
              nextCode = String(barcodes?.[0]?.rawValue || '').trim();
            } else if (jsQrFn) {
              const video = videoRef.current;
              const width = video.videoWidth;
              const height = video.videoHeight;
              if (width && height) {
                if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
                const canvas = canvasRef.current;
                canvas.width = width;
                canvas.height = height;
                const context = canvas.getContext('2d', { willReadFrequently: true });
                context.drawImage(video, 0, 0, width, height);
                const imageData = context.getImageData(0, 0, width, height);
                const result = jsQrFn(imageData.data, width, height);
                nextCode = String(result?.data || '').trim();
              }
            }
            if (nextCode) {
              detectedRef.current = true;
              stopScanner();
              onDetect(nextCode);
              return;
            }
          } catch {}
          animationRef.current = window.requestAnimationFrame(scan);
        };

        animationRef.current = window.requestAnimationFrame(scan);
      } catch (error) {
        setScannerError(error?.name === 'NotAllowedError'
          ? 'Camera permission was blocked. Allow camera access in your browser settings, then try again.'
          : (error instanceof Error ? error.message : 'Could not start the camera.'));
        stopScanner();
      }
    }

    startScanner();
    return () => {
      active = false;
      stopScanner();
    };
  }, [disabled, onDetect, open, stopScanner]);

  if (!open) return null;

  return (
    <div className={PANEL}>
      <p className={LABEL}>Live QR Scanner</p>
      <div className="mt-3 overflow-hidden rounded-3xl border border-[#c9a96e]/35 bg-black/80">
        <video ref={videoRef} muted playsInline autoPlay className="h-72 w-full object-cover" />
      </div>
      <p className={`${BODY} mt-3`}>
        {scannerReady ? 'Point the camera at the active school QR code to sign in automatically.' : 'Preparing the camera...'}
      </p>
      {scannerError ? <p className="mt-2 text-sm text-[#800000] dark:text-rose-200">{scannerError}</p> : null}
    </div>
  );
}

export default function TeacherAttendancePage() {
  const auth = getStoredAuth();
  const currentUser = auth?.user || {};
  const teacherName = String(currentUser?.name || 'Teacher');

  const [activeTab, setActiveTab] = useState('sign-in');
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [todayEvents, setTodayEvents] = useState([]);
  const [todaySummary, setTodaySummary] = useState({ signIns: 0, onTimeCount: 0, lateCount: 0, lateCharge: 0, arrivalTime: '' });
  const [signInLoading, setSignInLoading] = useState(false);
  const [signInMessage, setSignInMessage] = useState('');
  const [signInError, setSignInError] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualQrCode, setManualQrCode] = useState('');
  const [signInNote, setSignInNote] = useState('');
  const [faceImageUrl, setFaceImageUrl] = useState('');
  const [faceImageDataUrl, setFaceImageDataUrl] = useState('');
  const [faceUploadLabel, setFaceUploadLabel] = useState('');
  const [faceUploading, setFaceUploading] = useState(false);
  const [useSharedPhone, setUseSharedPhone] = useState(false);
  const [colleagues, setColleagues] = useState([]);
  const [targetStaffId, setTargetStaffId] = useState('');
  const [scannerDismissedManually, setScannerDismissedManually] = useState(false);
  const [queuedActions, setQueuedActions] = useState(() => getQueuedStaffAttendanceActions());

  // Colleague list for "sign in for a friend".
  useEffect(() => {
    let cancelled = false;
    getStaffAttendanceColleagues()
      .then(data => { if (!cancelled) setColleagues(Array.isArray(data?.colleagues) ? data.colleagues : []); })
      .catch(() => { if (!cancelled) setColleagues([]); });
    return () => { cancelled = true; };
  }, []);
  const [queueSyncing, setQueueSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof window === 'undefined' ? true : window.navigator.onLine));
  const [managedClasses, setManagedClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [classStudents, setClassStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentDate, setStudentDate] = useState(TODAY);
  const [studentStatus, setStudentStatus] = useState('Present');
  const [studentNotes, setStudentNotes] = useState('');
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentMessage, setStudentMessage] = useState('');
  const [studentError, setStudentError] = useState('');
  const [recordsFrom, setRecordsFrom] = useState(monthStart(TODAY));
  const [recordsTo, setRecordsTo] = useState(TODAY);
  const [recordEvents, setRecordEvents] = useState([]);
  const [recordSummary, setRecordSummary] = useState({ signIns: 0, signOuts: 0, onTimeCount: 0, lateCount: 0, lateMinutes: 0, lateCharge: 0, totalCharges: 0 });
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState('');
  const [permissionRequests, setPermissionRequests] = useState([]);
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [permissionSubmitting, setPermissionSubmitting] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState('');
  const [permissionError, setPermissionError] = useState('');
  const [permissionForm, setPermissionForm] = useState({ requestType: 'absence', startDate: TODAY, endDate: TODAY, reason: '' });

  const latestSignIn = useMemo(() => findLatestSignIn(todayEvents), [todayEvents]);
  const attendanceClasses = useMemo(
    () => managedClasses.filter(classroom => Boolean(classroom?.canManageClassroom || classroom?.isClassTeacher || classroom?.isSupervisor)),
    [managedClasses],
  );
  const signInTone = latestSignIn ? statusTone(latestSignIn.isLate) : 'border-[#c9a96e]/35 bg-[#fff8f0] text-[#191970] dark:border-[#bf00ff]/25 dark:bg-black/20 dark:text-[#39ff14]';
  const queuedCount = queuedActions.length;

  const refreshQueuedActions = useCallback(() => {
    setQueuedActions(getQueuedStaffAttendanceActions());
  }, []);

  const loadTodayActivity = useCallback(async () => {
    const response = await getStaffAttendanceActivity({ date: TODAY, limit: 8 });
    const nextEvents = response?.events || [];
    const nextLatestSignIn = findLatestSignIn(nextEvents);
    setTodayEvents(nextEvents);
    setTodaySummary(buildTodaySummary(response?.summary || {}, nextLatestSignIn));
    return nextEvents;
  }, []);

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const response = await getStaffAttendanceSettings();
      const nextSettings = response?.settings || null;
      setSettings(nextSettings);
      writeCachedStaffAttendanceSettings(nextSettings);
      setSignInError('');
    } catch (error) {
      const cachedSettings = readCachedStaffAttendanceSettings();
      if (cachedSettings) {
        setSettings(cachedSettings);
        setSignInError('');
        setSignInMessage('Offline mode: using the last synced attendance policy. New attendance marks will queue for sync.');
      } else {
        setSettings(null);
        setSignInError(error instanceof Error ? error.message : 'Could not load staff attendance settings.');
      }
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  const loadManagedClasses = useCallback(async () => {
    try {
      const response = await getAssignedClasses();
      const nextClasses = response?.classes || [];
      setManagedClasses(nextClasses);
      setSelectedClassId(currentClassId => (
        nextClasses.some(classroom => classroom.id === currentClassId)
          ? currentClassId
          : String(nextClasses.find(classroom => classroom?.canManageClassroom || classroom?.isClassTeacher || classroom?.isSupervisor)?.id || '')
      ));
    } catch {
      setManagedClasses([]);
      setSelectedClassId('');
    }
  }, []);

  const loadRecordRange = useCallback(async () => {
    setRecordsLoading(true);
    setRecordsError('');
    try {
      const response = await getStaffAttendanceActivity({ from: recordsFrom, to: recordsTo, limit: 120 });
      setRecordEvents((response?.events || []).filter(event => event.action === 'sign-in'));
      setRecordSummary(response?.summary || { signIns: 0, signOuts: 0, onTimeCount: 0, lateCount: 0, lateMinutes: 0, lateCharge: 0, totalCharges: 0 });
    } catch (error) {
      setRecordEvents([]);
      setRecordSummary({ signIns: 0, signOuts: 0, onTimeCount: 0, lateCount: 0, lateMinutes: 0, lateCharge: 0, totalCharges: 0 });
      setRecordsError(error instanceof Error ? error.message : 'Could not load your attendance records.');
    } finally {
      setRecordsLoading(false);
    }
  }, [recordsFrom, recordsTo]);

  const loadPermissionRequests = useCallback(async () => {
    setPermissionLoading(true);
    setPermissionError('');
    try {
      const response = await getStaffAttendancePermissionRequests({ limit: 8 });
      setPermissionRequests(response?.requests || []);
    } catch (error) {
      if (!isLikelyNetworkError(error)) {
        setPermissionError(error instanceof Error ? error.message : 'Could not load attendance permission requests.');
      }
    } finally {
      setPermissionLoading(false);
    }
  }, []);

  const flushQueuedActions = useCallback(async () => {
    if (typeof window === 'undefined' || !window.navigator.onLine) return;

    const queuedEntries = getQueuedStaffAttendanceActions();
    if (!queuedEntries.length) {
      refreshQueuedActions();
      return;
    }

    setQueueSyncing(true);
    let syncedCount = 0;

    for (const entry of queuedEntries) {
      try {
        await submitStaffAttendanceActivity(entry.payload);
        removeQueuedStaffAttendanceAction(entry.id);
        syncedCount += 1;
      } catch (error) {
        if (!isLikelyNetworkError(error)) {
          setSignInError(error instanceof Error ? error.message : 'One queued attendance mark could not sync and needs review.');
        }
        break;
      }
    }

    refreshQueuedActions();

    if (syncedCount > 0) {
      await loadTodayActivity().catch(() => null);
      if (activeTab === 'records') {
        await loadRecordRange().catch(() => null);
      }
      setSignInMessage(`${syncedCount} queued attendance mark${syncedCount === 1 ? '' : 's'} synced successfully.`);
    }

    setQueueSyncing(false);
  }, [activeTab, loadRecordRange, loadTodayActivity, refreshQueuedActions]);

  useEffect(() => {
    loadSettings();
    loadTodayActivity();
    loadManagedClasses();
    loadPermissionRequests();
    refreshQueuedActions();
  }, [loadManagedClasses, loadPermissionRequests, loadSettings, loadTodayActivity, refreshQueuedActions]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleConnectivityChange = () => setIsOnline(window.navigator.onLine);
    window.addEventListener('online', handleConnectivityChange);
    window.addEventListener('offline', handleConnectivityChange);
    return () => {
      window.removeEventListener('online', handleConnectivityChange);
      window.removeEventListener('offline', handleConnectivityChange);
    };
  }, []);

  useEffect(() => {
    if (isOnline) {
      flushQueuedActions();
    }
  }, [flushQueuedActions, isOnline]);

  useEffect(() => {
    if (activeTab !== 'sign-in') return;
    if (latestSignIn) return;
    if (!scannerDismissedManually) {
      setScannerOpen(true);
    }
  }, [activeTab, latestSignIn, scannerDismissedManually]);

  useEffect(() => {
    if (activeTab !== 'records') return;
    loadRecordRange();
  }, [activeTab, loadRecordRange]);

  useEffect(() => {
    if (!selectedClassId) {
      setClassStudents([]);
      setSelectedStudentId('');
      return;
    }

    let cancelled = false;
    getClassStudents(selectedClassId)
      .then(response => {
        if (cancelled) return;
        const students = response?.students || [];
        setClassStudents(students);
        setSelectedStudentId(currentStudentId => (
          students.some(student => student.id === currentStudentId)
            ? currentStudentId
            : String(students[0]?.id || '')
        ));
      })
      .catch(() => {
        if (!cancelled) {
          setClassStudents([]);
          setSelectedStudentId('');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedClassId]);

  const queueSignInPayload = useCallback((payload, qrCodeValue) => {
    queueStaffAttendanceAction(payload);
    refreshQueuedActions();
    setManualQrCode(String(qrCodeValue || payload?.qrCode || '').trim());
    setScannerOpen(false);
    setScannerDismissedManually(true);
    setSignInError('');
    setSignInMessage('You are offline. Attendance has been queued on this device and will sync automatically when internet returns.');
  }, [refreshQueuedActions]);

  const submitSignIn = useCallback(async (qrCodeValue) => {
    const nextQrCode = String(qrCodeValue || manualQrCode || '').trim();
    if (!nextQrCode) {
      setSignInError('Scan the active school QR code or enter it manually before signing in.');
      return;
    }

    const signingForColleague = Boolean(targetStaffId);
    const requiresFaceCapture = String(settings?.mode || 'qr') === 'face_qr' || useSharedPhone || signingForColleague;
    if (requiresFaceCapture && !faceImageUrl && !faceImageDataUrl) {
      setSignInError(signingForColleague
        ? 'Capture the colleague’s face (with the school QR) before signing them in.'
        : 'This school requires a face capture before QR sign-in. Upload a selfie and try again.');
      return;
    }

    const payload = {
      action: 'sign-in',
      date: TODAY,
      qrCode: nextQrCode,
      faceImageUrl,
      faceImageDataUrl: faceImageUrl ? '' : faceImageDataUrl,
      notes: signInNote,
      sharedPhone: useSharedPhone || signingForColleague,
      targetStaffId: targetStaffId || undefined,
    };

    if (typeof window !== 'undefined' && window.navigator.onLine === false) {
      queueSignInPayload(payload, nextQrCode);
      return;
    }

    setSignInLoading(true);
    setSignInError('');
    setSignInMessage('');
    try {
      const response = await submitStaffAttendanceActivity(payload);

      const event = response?.event || null;
      await loadTodayActivity();
      setManualQrCode(nextQrCode);
      setScannerOpen(false);
      setScannerDismissedManually(true);
      setTargetStaffId('');
      setSignInMessage(event?.isLate
        ? `Signed in at ${formatDateTime(event?.createdAt)}. You are late by ${event?.lateMinutes || 0} minute${Number(event?.lateMinutes || 0) === 1 ? '' : 's'}${Number(event?.lateCharge || 0) > 0 ? ` and charged ${formatMoney(event?.lateCharge)}` : event?.permissionStatus === 'approved' ? ' but no charge was applied because an approved permission request covers today.' : '.'}`
        : `Signed in successfully at ${formatDateTime(event?.createdAt)}. You are on time.`);
      if (activeTab === 'records') {
        loadRecordRange();
      }
    } catch (error) {
      if (isLikelyNetworkError(error)) {
        queueSignInPayload(payload, nextQrCode);
        return;
      }
      setSignInError(error instanceof Error ? error.message : 'Could not complete QR sign-in.');
    } finally {
      setSignInLoading(false);
    }
  }, [activeTab, faceImageDataUrl, faceImageUrl, loadRecordRange, loadTodayActivity, manualQrCode, queueSignInPayload, settings?.mode, signInNote, targetStaffId, useSharedPhone]);

  const handleScanDetect = useCallback((value) => {
    setManualQrCode(value);
    submitSignIn(value);
  }, [submitSignIn]);

  async function handleFaceCapture(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFaceUploading(true);
    setSignInError('');
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setFaceImageDataUrl(dataUrl);
      setFaceUploadLabel(file.name);
      if (typeof window !== 'undefined' && window.navigator.onLine === false) {
        setFaceImageUrl('');
        setSignInMessage('Face capture saved on this device. You can still mark attendance offline and it will sync later.');
        return;
      }

      const response = await uploadStaffAttendanceFace(file);
      setFaceImageUrl(String(response?.url || ''));
      setSignInMessage('Face capture uploaded. Continue with QR sign-in.');
    } catch (error) {
      setFaceImageUrl('');
      if (isLikelyNetworkError(error)) {
        setSignInMessage('Face capture saved locally. You can still mark attendance and it will sync when the internet returns.');
      } else {
        setFaceUploadLabel('');
        setFaceImageDataUrl('');
        setSignInError(error instanceof Error ? error.message : 'Could not upload the face capture.');
      }
    } finally {
      setFaceUploading(false);
    }
  }

  async function handlePermissionRequestSubmit(event) {
    event.preventDefault();
    if (!permissionForm.startDate || !permissionForm.endDate || permissionForm.endDate < permissionForm.startDate) {
      setPermissionError('Choose a valid permission request date range.');
      return;
    }
    if (!permissionForm.reason.trim()) {
      setPermissionError('Explain why you need attendance permission.');
      return;
    }

    setPermissionSubmitting(true);
    setPermissionError('');
    setPermissionMessage('');
    try {
      const response = await submitStaffAttendancePermissionRequest(permissionForm);
      setPermissionRequests(current => [response?.request, ...current].filter(Boolean).slice(0, 8));
      setPermissionForm({ requestType: 'absence', startDate: TODAY, endDate: TODAY, reason: '' });
      setPermissionMessage('Attendance permission request submitted for HoS/Owner review.');
    } catch (error) {
      setPermissionError(error instanceof Error ? error.message : 'Could not submit the attendance permission request.');
    } finally {
      setPermissionSubmitting(false);
    }
  }

  async function handleStudentAttendanceSubmit(event) {
    event.preventDefault();
    if (!selectedClassId || !selectedStudentId || !studentDate || !studentStatus) {
      setStudentError('Choose the class, student, date, and attendance status first.');
      return;
    }

    setStudentLoading(true);
    setStudentError('');
    setStudentMessage('');
    try {
      const response = await recordAttendance(selectedClassId, {
        studentId: selectedStudentId,
        date: studentDate,
        status: studentStatus,
        notes: studentNotes,
      });

      if (!response?.success) {
        setStudentError(response?.message || 'Could not record student attendance.');
        return;
      }

      const selectedStudent = classStudents.find(student => student.id === selectedStudentId);
      setStudentMessage(`Recorded ${studentStatus} for ${selectedStudent?.name || 'the selected student'} on ${studentDate}.`);
      setStudentNotes('');
    } catch (error) {
      setStudentError(error instanceof Error ? error.message : 'Could not record student attendance.');
    } finally {
      setStudentLoading(false);
    }
  }

  return (
    <StudentSectionShell
      title="Attendance"
      subtitle="Sign yourself in with the school QR code, mark student attendance, and review your daily sign-in history from one page."
      dashboardLabel="Teacher Dashboard"
      watermarkText="Teacher Attendance"
    >
      <div className="space-y-6">
        <section className={SURFACE}>
          <p className={LABEL}>Teacher attendance workspace</p>
          <h2 className="mt-2 text-2xl font-black text-[#191970] dark:text-[#ffffff] sm:text-3xl">Welcome, {teacherName}</h2>
          <p className={`${BODY} mt-2 max-w-4xl`}>Choose a task: sign yourself in, mark student attendance, or review your own sign-in records.</p>
        </section>

        {/* Task tabs — organized for mobile and desktop */}
        <div className="sticky top-0 z-20 -mx-1 rounded-2xl border border-[#2447d8]/15 bg-white/90 p-1.5 backdrop-blur-md dark:border-white/10 dark:bg-slate-900/90">
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { key: 'sign-in', label: 'Sign In', icon: '📲' },
              { key: 'students', label: 'Mark Students', icon: '✓' },
              { key: 'records', label: 'My Records', icon: '📋' },
            ].map(tab => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-bold transition-all sm:text-sm ${
                    active
                      ? 'bg-[#2447d8] text-white shadow-lg shadow-[#2447d8]/25'
                      : 'text-[#2447d8] hover:bg-blue-50 dark:text-slate-200 dark:hover:bg-white/10'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span className="whitespace-nowrap">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === 'sign-in' ? (
          <div className="space-y-6">
            <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <MetricCard label="Today sign-ins" value={todaySummary.signIns} />
              <MetricCard label="On time" value={todaySummary.onTimeCount} accent="text-[#1a5c38] dark:text-[#00ffff]" />
              <MetricCard label="Late" value={todaySummary.lateCount} accent="text-amber-700 dark:text-amber-300" />
              <MetricCard label="Charges today" value={formatMoney(todaySummary.lateCharge)} accent="text-[#800000] dark:text-[#ff6bff]" />
            </section>

            <section className={SURFACE}>
              <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="space-y-4">
                  <div className={`${PANEL} ${signInTone}`}>
                    <p className={LABEL}>Today&apos;s status</p>
                    <h3 className="mt-2 text-2xl font-black">
                      {latestSignIn ? (latestSignIn.isLate ? 'Late' : 'On Time') : 'Not signed in yet'}
                    </h3>
                    <p className="mt-2 text-sm">
                      {latestSignIn
                        ? `Arrival recorded at ${formatDateTime(latestSignIn.createdAt)}${latestSignIn.isLate ? ` with ${latestSignIn.lateMinutes || 0} late minute${Number(latestSignIn.lateMinutes || 0) === 1 ? '' : 's'}.` : '.'}`
                        : 'Open the QR scanner and sign in when you arrive.'}
                    </p>
                  </div>

                  <div className={PANEL}>
                    <p className={LABEL}>Attendance mode</p>
                    {settingsLoading ? <p className={`${BODY} mt-2`}>Loading sign-in mode...</p> : null}
                    {!settingsLoading ? (
                      <>
                        <h3 className="mt-2 text-xl font-black text-[#800000] dark:text-white">{settings?.modeLabel || 'QR Sign-In'}</h3>
                        <p className={`${BODY} mt-2`}>{settings?.modeDescription || 'Use the active school QR code to sign yourself in.'}</p>
                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div className={PANEL}>
                            <p className={LABEL}>Late after</p>
                            <p className="mt-2 text-lg font-black text-[#191970] dark:text-[#39ff14]">{settings?.lateAfterTime || '08:00'}</p>
                          </div>
                          <div className={PANEL}>
                            <p className={LABEL}>Grace period</p>
                            <p className="mt-2 text-lg font-black text-[#191970] dark:text-[#39ff14]">{Number(settings?.gracePeriodMinutes || 0)} min</p>
                          </div>
                          <div className={PANEL}>
                            <p className={LABEL}>Late penalty</p>
                            <p className="mt-2 text-lg font-black text-[#191970] dark:text-[#39ff14]">
                              {settings?.latePenaltyEnabled ? formatMoney(settings?.latePenaltyAmount || 0) : 'Disabled'}
                            </p>
                          </div>
                          <div className={PANEL}>
                            <p className={LABEL}>Absence penalty</p>
                            <p className="mt-2 text-lg font-black text-[#191970] dark:text-[#39ff14]">
                              {settings?.absencePenaltyEnabled ? `${formatMoney(settings?.absencePenaltyAmount || 0)}${settings?.payrollAutoDeductAbsence ? ' via payroll' : ''}` : 'Disabled'}
                            </p>
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>

                  <div className={PANEL}>
                    <p className={LABEL}>Sign-in actions</p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setScannerDismissedManually(false);
                          setScannerOpen(true);
                        }}
                        className={PRIMARY_BUTTON}
                        disabled={signInLoading || settingsLoading}
                      >
                        {scannerOpen ? '📷 Scanning… point at the QR' : '📷 Scan QR Code'}
                      </button>
                      <button
                        type="button"
                        onClick={() => submitSignIn()}
                        className={SECONDARY_BUTTON}
                        disabled={signInLoading || settingsLoading || !manualQrCode.trim()}
                        title={!manualQrCode.trim() ? 'Scan the QR code first, or type it in Manual QR Entry' : ''}
                      >
                        {signInLoading ? 'Marking Attendance...' : 'Mark Attendance'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setScannerOpen(false);
                          setScannerDismissedManually(true);
                        }}
                        className={SECONDARY_BUTTON}
                        disabled={signInLoading || !scannerOpen}
                      >
                        Cancel
                      </button>
                      {queuedCount > 0 ? (
                        <button type="button" onClick={flushQueuedActions} className={SECONDARY_BUTTON} disabled={!isOnline || queueSyncing}>
                          {queueSyncing ? 'Syncing...' : `Sync Queued (${queuedCount})`}
                        </button>
                      ) : null}
                    </div>
                    <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${isOnline ? 'border-[#1a5c38]/25 bg-[#edf8f1] text-[#1a5c38] dark:border-[#00ffff]/30 dark:bg-[#002326] dark:text-[#00ffff]' : 'border-amber-400/35 bg-amber-50 text-amber-800 dark:border-amber-300/35 dark:bg-[#2d1a00] dark:text-amber-200'}`}>
                      {isOnline
                        ? queuedCount > 0
                          ? `${queuedCount} attendance mark${queuedCount === 1 ? '' : 's'} waiting to sync from this device.`
                          : 'This device is online. QR scanning can mark attendance immediately.'
                        : 'This device is offline. New attendance marks will be queued and synced automatically when the internet returns.'}
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="text-sm font-semibold text-[#2447d8] dark:text-[#bf00ff]">
                        Manual QR Entry
                        <input
                          value={manualQrCode}
                          onChange={event => setManualQrCode(event.target.value)}
                          className={`${INPUT} mt-2`}
                          placeholder="Paste or type the QR code if camera scanning is unavailable"
                        />
                      </label>
                      <label className="text-sm font-semibold text-[#2447d8] dark:text-[#bf00ff]">
                        Optional Note
                        <input
                          value={signInNote}
                          onChange={event => setSignInNote(event.target.value)}
                          className={`${INPUT} mt-2`}
                          placeholder="Add an optional sign-in note"
                        />
                      </label>
                    </div>

                    <label className="mt-4 flex items-start gap-3 rounded-2xl border border-[#c9a96e]/35 bg-[#fff8f0] p-4 text-sm text-[#191970] dark:border-[#bf00ff]/25 dark:bg-black/20 dark:text-[#39ff14]">
                      <input type="checkbox" checked={useSharedPhone} onChange={event => setUseSharedPhone(event.target.checked)} className="mt-1" />
                      <span>
                        <span className="block font-semibold text-[#191970] dark:text-[#ffffff]">Use colleague phone mode</span>
                        <span className="mt-1 block">Enable this when you are signing in from another staff member&apos;s phone. NDOVERA will require a face capture and tag the attendance record as a shared-phone sign-in.</span>
                      </span>
                    </label>

                    <div className="mt-4 rounded-2xl border border-[#c9a96e]/35 bg-[#fff8f0] p-4 dark:border-[#bf00ff]/25 dark:bg-black/20">
                      <p className={LABEL}>Sign in for a friend</p>
                      <p className={`${BODY} mt-1`}>Marking attendance for a colleague who forgot their phone? Pick them, capture their face and scan the school QR — the record is tagged as marked by you.</p>
                      <select value={targetStaffId} onChange={event => setTargetStaffId(event.target.value)} className={`${INPUT} mt-3`}>
                        <option value="">Sign in myself</option>
                        {colleagues.map(person => (
                          <option key={person.id} value={person.id}>{person.name}{person.role ? ` • ${person.role}` : ''}</option>
                        ))}
                      </select>
                    </div>

                    {String(settings?.mode || 'qr') === 'face_qr' || useSharedPhone || targetStaffId ? (
                      <div className="mt-4 rounded-2xl border border-[#c9a96e]/35 bg-[#fff8f0] p-4 dark:border-[#bf00ff]/25 dark:bg-black/20">
                        <p className={LABEL}>Required face capture</p>
                        <p className={`${BODY} mt-2`}>This school or shared-phone mode requires a face capture before QR sign-in. Upload a selfie from the current device, then scan the QR code.</p>
                        <label className="mt-4 block text-sm font-semibold text-[#2447d8] dark:text-[#bf00ff]">
                          Face Capture
                          <input type="file" accept="image/*" capture="user" onChange={handleFaceCapture} className={`${INPUT} mt-2`} />
                        </label>
                        <p className={`${BODY} mt-2`}>{faceUploading ? 'Uploading face capture...' : faceUploadLabel ? `${faceImageUrl ? 'Uploaded' : 'Saved locally'}: ${faceUploadLabel}` : 'No face capture uploaded yet.'}</p>
                      </div>
                    ) : null}

                    {signInMessage ? <div className="mt-4 rounded-2xl border border-[#1a5c38]/25 bg-[#edf8f1] px-4 py-3 text-sm text-[#1a5c38] dark:border-[#00ffff]/30 dark:bg-[#002326] dark:text-[#00ffff]">{signInMessage}</div> : null}
                    {signInError ? <div className="mt-4 rounded-2xl border border-red-400/35 bg-red-50 px-4 py-3 text-sm text-[#800000] dark:border-[#ff5f8d]/35 dark:bg-[#4a0014] dark:text-[#ffffff]">{signInError}</div> : null}
                  </div>
                </div>

                <div className="space-y-4">
                  <CameraScanner open={scannerOpen} onDetect={handleScanDetect} disabled={signInLoading || settingsLoading} />

                  <div className={PANEL}>
                    <p className={LABEL}>Today&apos;s sign-in log</p>
                    <div className="mt-4 space-y-3">
                      {todayEvents.filter(event => event.action === 'sign-in').length === 0 ? <p className={BODY}>No sign-in has been recorded for you today yet.</p> : null}
                      {todayEvents.filter(event => event.action === 'sign-in').map(event => (
                        <div key={event.id} className={`${PANEL} ${statusTone(event.isLate)}`}>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold">{event.isLate ? 'Late' : 'On Time'}</p>
                              <p className="mt-1 text-xs">{formatDateTime(event.createdAt)}</p>
                              {event.sharedPhone ? <p className="mt-1 text-xs uppercase tracking-[0.14em]">Shared phone mode</p> : null}
                            </div>
                            <div className="text-right text-xs font-semibold uppercase tracking-[0.14em]">
                              <p>{event.lateMinutes ? `${event.lateMinutes} late min` : 'Present'}</p>
                              <p>{event.lateCharge ? formatMoney(event.lateCharge) : 'No charge'}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={PANEL}>
                    <p className={LABEL}>Permission requests</p>
                    <p className={`${BODY} mt-2`}>Ask HoS or Owner to approve absence, late arrival, official duty, or remote duty before the day is charged as unauthorized absenteeism.</p>
                    <form onSubmit={handlePermissionRequestSubmit} className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="text-sm font-semibold text-[#2447d8] dark:text-[#bf00ff]">
                        Request Type
                        <select value={permissionForm.requestType} onChange={event => setPermissionForm(current => ({ ...current, requestType: event.target.value }))} className={`${INPUT} mt-2`}>
                          <option value="absence">Absence</option>
                          <option value="late">Late arrival</option>
                          <option value="official">Official duty</option>
                          <option value="remote">Remote duty</option>
                        </select>
                      </label>
                      <label className="text-sm font-semibold text-[#2447d8] dark:text-[#bf00ff]">
                        Start Date
                        <input type="date" value={permissionForm.startDate} onChange={event => setPermissionForm(current => ({ ...current, startDate: event.target.value, endDate: current.endDate < event.target.value ? event.target.value : current.endDate }))} className={`${INPUT} mt-2`} />
                      </label>
                      <label className="text-sm font-semibold text-[#2447d8] dark:text-[#bf00ff]">
                        End Date
                        <input type="date" value={permissionForm.endDate} onChange={event => setPermissionForm(current => ({ ...current, endDate: event.target.value }))} className={`${INPUT} mt-2`} />
                      </label>
                      <label className="text-sm font-semibold text-[#2447d8] dark:text-[#bf00ff] md:col-span-2">
                        Reason
                        <textarea value={permissionForm.reason} onChange={event => setPermissionForm(current => ({ ...current, reason: event.target.value }))} rows={3} className={`${INPUT} mt-2 min-h-[110px] resize-y`} placeholder="Explain why you need attendance permission for these dates" />
                      </label>
                      <div className="md:col-span-2 flex flex-wrap gap-3">
                        <button type="submit" className={PRIMARY_BUTTON} disabled={permissionSubmitting}>
                          {permissionSubmitting ? 'Submitting...' : 'Request Permission'}
                        </button>
                      </div>
                    </form>

                    {permissionMessage ? <div className="mt-4 rounded-2xl border border-[#1a5c38]/25 bg-[#edf8f1] px-4 py-3 text-sm text-[#1a5c38] dark:border-[#00ffff]/30 dark:bg-[#002326] dark:text-[#00ffff]">{permissionMessage}</div> : null}
                    {permissionError ? <div className="mt-4 rounded-2xl border border-red-400/35 bg-red-50 px-4 py-3 text-sm text-[#800000] dark:border-[#ff5f8d]/35 dark:bg-[#4a0014] dark:text-[#ffffff]">{permissionError}</div> : null}

                    <div className="mt-4 space-y-3">
                      {permissionLoading ? <p className={BODY}>Loading your recent permission requests...</p> : null}
                      {!permissionLoading && permissionRequests.length === 0 ? <p className={BODY}>No attendance permission requests submitted yet.</p> : null}
                      {!permissionLoading && permissionRequests.map(request => (
                        <div key={request.id} className={`${PANEL} ${permissionTone(request.status)}`}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold">{formatPermissionType(request.requestType)}</p>
                              <p className="mt-1 text-xs">{request.startDate === request.endDate ? request.startDate : `${request.startDate} to ${request.endDate}`}</p>
                            </div>
                            <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] dark:bg-black/20">{request.status || 'pending'}</span>
                          </div>
                          <p className="mt-2 text-sm">{request.reason}</p>
                          {request.decisionNote ? <p className="mt-2 text-xs">Decision note: {request.decisionNote}</p> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === 'students' ? (
          <section className={SURFACE}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className={LABEL}>Student attendance</p>
                <h2 className="mt-2 text-2xl font-black text-[#191970] dark:text-[#ffffff]">Mark Student Attendance</h2>
                <p className={`${BODY} mt-2 max-w-3xl`}>Choose your managed class, then record present, late, absent, or excused attendance for a student.</p>
              </div>
              <span className="rounded-full border border-[#800020]/20 bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[#800020] dark:border-[#bf00ff]/30 dark:bg-black/25 dark:text-[#bf00ff]">
                {attendanceClasses.length} Managed Class{attendanceClasses.length === 1 ? '' : 'es'}
              </span>
            </div>

            {attendanceClasses.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-50 px-4 py-3 text-sm text-[#800000] dark:border-[#ff5f8d]/35 dark:bg-[#4a0014] dark:text-[#ffffff]">
                No class with attendance permissions is assigned to this teacher account yet.
              </div>
            ) : (
              <form onSubmit={handleStudentAttendanceSubmit} className="mt-5 grid gap-4 lg:grid-cols-2">
                <label className="text-sm font-semibold text-[#2447d8] dark:text-[#bf00ff]">
                  Managed Class
                  <select value={selectedClassId} onChange={event => setSelectedClassId(event.target.value)} className={`${INPUT} mt-2`}>
                    {attendanceClasses.map(classroom => (
                      <option key={classroom.id} value={classroom.id}>{classroom.className}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold text-[#2447d8] dark:text-[#bf00ff]">
                  Student
                  <select value={selectedStudentId} onChange={event => setSelectedStudentId(event.target.value)} className={`${INPUT} mt-2`}>
                    {classStudents.map(student => (
                      <option key={student.id} value={student.id}>{student.name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold text-[#2447d8] dark:text-[#bf00ff]">
                  Attendance Date
                  <input type="date" value={studentDate} onChange={event => setStudentDate(event.target.value)} className={`${INPUT} mt-2`} />
                </label>
                <label className="text-sm font-semibold text-[#2447d8] dark:text-[#bf00ff]">
                  Status
                  <select value={studentStatus} onChange={event => setStudentStatus(event.target.value)} className={`${INPUT} mt-2`}>
                    <option value="Present">Present</option>
                    <option value="Late">Late</option>
                    <option value="Absent">Absent</option>
                    <option value="Excused">Excused</option>
                  </select>
                </label>
                <label className="text-sm font-semibold text-[#2447d8] dark:text-[#bf00ff] lg:col-span-2">
                  Notes
                  <textarea value={studentNotes} onChange={event => setStudentNotes(event.target.value)} rows={4} className={`${INPUT} mt-2 min-h-[120px] resize-y`} placeholder="Optional note for the attendance record" />
                </label>
                <div className="lg:col-span-2 flex flex-wrap gap-3">
                  <button type="submit" className={PRIMARY_BUTTON} disabled={studentLoading || !selectedClassId || !selectedStudentId}>
                    {studentLoading ? 'Saving Attendance...' : 'Record Student Attendance'}
                  </button>
                </div>
              </form>
            )}

            {studentMessage ? <div className="mt-4 rounded-2xl border border-[#1a5c38]/25 bg-[#edf8f1] px-4 py-3 text-sm text-[#1a5c38] dark:border-[#00ffff]/30 dark:bg-[#002326] dark:text-[#00ffff]">{studentMessage}</div> : null}
            {studentError ? <div className="mt-4 rounded-2xl border border-red-400/35 bg-red-50 px-4 py-3 text-sm text-[#800000] dark:border-[#ff5f8d]/35 dark:bg-[#4a0014] dark:text-[#ffffff]">{studentError}</div> : null}
          </section>
        ) : null}

        {activeTab === 'records' ? (
          <div className="space-y-6">
            <section className={SURFACE}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className={LABEL}>Personal attendance history</p>
                  <h2 className="mt-2 text-2xl font-black text-[#191970] dark:text-[#ffffff]">My Sign-In Records</h2>
                  <p className={`${BODY} mt-2 max-w-3xl`}>Review each day you signed in, how many times you were on time or late, and how much was charged within the selected period.</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-[#2447d8] dark:text-[#bf00ff]">
                    From
                    <input type="date" value={recordsFrom} onChange={event => setRecordsFrom(event.target.value)} className={`${INPUT} mt-2`} />
                  </label>
                  <label className="text-sm font-semibold text-[#2447d8] dark:text-[#bf00ff]">
                    To
                    <input type="date" value={recordsTo} onChange={event => setRecordsTo(event.target.value)} className={`${INPUT} mt-2`} />
                  </label>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={loadRecordRange} className={PRIMARY_BUTTON} disabled={recordsLoading}>
                  {recordsLoading ? 'Refreshing...' : 'Refresh Records'}
                </button>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <MetricCard label="Sign-ins" value={recordSummary.signIns} />
              <MetricCard label="On time" value={recordSummary.onTimeCount} accent="text-[#1a5c38] dark:text-[#00ffff]" />
              <MetricCard label="Late" value={recordSummary.lateCount} accent="text-amber-700 dark:text-amber-300" />
              <MetricCard label="Amount charged" value={formatMoney(recordSummary.totalCharges)} accent="text-[#800000] dark:text-[#ff6bff]" />
            </section>

            <section className={SURFACE}>
              {recordsError ? <div className="rounded-2xl border border-red-400/35 bg-red-50 px-4 py-3 text-sm text-[#800000] dark:border-[#ff5f8d]/35 dark:bg-[#4a0014] dark:text-[#ffffff]">{recordsError}</div> : null}
              {recordsLoading ? <p className={BODY}>Loading your sign-in history...</p> : null}
              {!recordsLoading && recordEvents.length === 0 ? <p className={BODY}>No sign-in records were found for the selected period.</p> : null}

              {!recordsLoading && recordEvents.length > 0 ? (
                <div className="space-y-3">
                  {recordEvents.map(event => (
                    <article key={event.id} className={`${PANEL} ${statusTone(event.isLate)}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className={LABEL}>{event.date}</p>
                          <h3 className="mt-1 text-lg font-black">{event.isLate ? 'Late Sign-In' : 'On-Time Sign-In'}</h3>
                          <p className="mt-2 text-sm">Recorded at {formatDateTime(event.createdAt)}</p>
                          {event.notes ? <p className="mt-2 text-sm">Note: {event.notes}</p> : null}
                        </div>
                        <div className="space-y-2 text-right">
                          <div className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] dark:bg-black/20">
                            {event.isLate ? `${event.lateMinutes || 0} Late Min` : 'On Time'}
                          </div>
                          <div className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] dark:bg-black/20">
                            {event.lateCharge ? formatMoney(event.lateCharge) : 'No Charge'}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </div>
    </StudentSectionShell>
  );
}