import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { getStoredAuth } from '../../auth/services/authApi';
import {
  getStaffAttendancePermissionRequests,
  getStaffAttendanceSettings,
  reviewStaffAttendancePermissionRequest,
  rotateStaffAttendanceQr,
  saveStaffAttendanceSettings,
} from '../../school/services/schoolApi';

const DEFAULT_FORM = {
  mode: 'qr',
  requireQrOnFace: true,
  activeQrCode: '',
  qrRotatedAt: '',
  lateAfterTime: '08:00',
  gracePeriodMinutes: 0,
  latePenaltyEnabled: false,
  latePenaltyAmount: 0,
  absencePenaltyEnabled: false,
  absencePenaltyAmount: 0,
  payrollAutoDeductAbsence: false,
};

function permissionTone(status = 'pending') {
  const normalized = String(status || 'pending').trim().toLowerCase();
  if (normalized === 'approved') return 'border-[#1a5c38]/25 bg-[#edf8f1] text-[#1a5c38] dark:border-[#00ffff]/30 dark:bg-[#002326] dark:text-[#00ffff]';
  if (normalized === 'rejected') return 'border-red-400/35 bg-red-50 text-[#800000] dark:border-[#ff5f8d]/35 dark:bg-[#4a0014] dark:text-[#ffffff]';
  return 'border-amber-400/35 bg-amber-50 text-amber-800 dark:border-amber-300/35 dark:bg-[#2d1a00] dark:text-amber-200';
}

function formatPermissionType(value) {
  const normalized = String(value || 'absence').trim().toLowerCase();
  if (normalized === 'late') return 'Late Arrival';
  if (normalized === 'official') return 'Official Duty';
  if (normalized === 'remote') return 'Remote Duty';
  return 'Absence';
}

export default function StaffAttendanceManagementPanel() {
  const currentUserRole = String(getStoredAuth()?.user?.role || '').trim().toLowerCase();
  const canReviewRequests = ['owner', 'hos'].includes(currentUserRole);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [permissionRequests, setPermissionRequests] = useState([]);
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [reviewingId, setReviewingId] = useState('');

  async function loadPermissionRequests() {
    if (!canReviewRequests) return;
    setPermissionLoading(true);
    try {
      const data = await getStaffAttendancePermissionRequests({ status: 'pending', limit: 12 });
      setPermissionRequests(data?.requests || []);
    } catch {
      setPermissionRequests([]);
    } finally {
      setPermissionLoading(false);
    }
  }

  async function loadSettings() {
    setLoading(true);
    setError('');
    try {
      const data = await getStaffAttendanceSettings();
      const settings = data?.settings || {};
      setForm({
        mode: settings.mode || 'qr',
        requireQrOnFace: settings.requireQrOnFace !== false,
        activeQrCode: settings.activeQrCode || '',
        qrRotatedAt: settings.qrRotatedAt || '',
        lateAfterTime: settings.lateAfterTime || '08:00',
        gracePeriodMinutes: Number(settings.gracePeriodMinutes || 0),
        latePenaltyEnabled: Boolean(settings.latePenaltyEnabled),
        latePenaltyAmount: Number(settings.latePenaltyAmount || 0),
        absencePenaltyEnabled: Boolean(settings.absencePenaltyEnabled),
        absencePenaltyAmount: Number(settings.absencePenaltyAmount || 0),
        payrollAutoDeductAbsence: Boolean(settings.payrollAutoDeductAbsence),
      });
    } catch (err) {
      setError(err.message || 'Unable to load staff attendance settings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
    loadPermissionRequests();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!form.activeQrCode) {
      setQrDataUrl('');
      return undefined;
    }
    QRCode.toDataURL(form.activeQrCode, {
      margin: 1,
      width: 280,
      color: { dark: '#800000', light: '#f5deb3' },
    }).then(url => {
      if (!cancelled) setQrDataUrl(url);
    }).catch(() => {
      if (!cancelled) setQrDataUrl('');
    });
    return () => {
      cancelled = true;
    };
  }, [form.activeQrCode]);

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const data = await saveStaffAttendanceSettings({
        mode: form.mode,
        requireQrOnFace: form.requireQrOnFace,
        lateAfterTime: form.lateAfterTime,
        gracePeriodMinutes: Number(form.gracePeriodMinutes || 0),
        latePenaltyEnabled: form.latePenaltyEnabled,
        latePenaltyAmount: Number(form.latePenaltyAmount || 0),
        absencePenaltyEnabled: form.absencePenaltyEnabled,
        absencePenaltyAmount: Number(form.absencePenaltyAmount || 0),
        payrollAutoDeductAbsence: form.payrollAutoDeductAbsence,
      });
      const settings = data?.settings || {};
      setForm(current => ({ ...current, ...settings, activeQrCode: settings.activeQrCode || current.activeQrCode }));
      setMessage('Attendance policy saved.');
    } catch (err) {
      setError(err.message || 'Unable to save attendance policy.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRotateQr() {
    setRotating(true);
    setMessage('');
    setError('');
    try {
      const data = await rotateStaffAttendanceQr();
      const settings = data?.settings || {};
      setForm(current => ({ ...current, activeQrCode: settings.activeQrCode || '', qrRotatedAt: settings.qrRotatedAt || '' }));
      setMessage('Staff attendance QR rotated. Print the new code before the next sign-in window.');
    } catch (err) {
      setError(err.message || 'Unable to rotate attendance QR.');
    } finally {
      setRotating(false);
    }
  }

  async function handleReviewRequest(requestId, decision) {
    const defaultNote = decision === 'approved' ? 'Approved for attendance exception.' : 'Rejected. Please follow up with school leadership.';
    const decisionNote = window.prompt(decision === 'approved' ? 'Approval note' : 'Rejection reason', defaultNote);
    if (decisionNote === null) return;

    setReviewingId(requestId);
    setMessage('');
    setError('');
    try {
      await reviewStaffAttendancePermissionRequest(requestId, { decision, decisionNote });
      setMessage(`Permission request ${decision}.`);
      await loadPermissionRequests();
    } catch (err) {
      setError(err.message || 'Unable to review the permission request.');
    } finally {
      setReviewingId('');
    }
  }

  return (
    <div className="space-y-6">
      <style>{'@media print { body * { visibility: hidden; } #staff-attendance-print-card, #staff-attendance-print-card * { visibility: visible; } #staff-attendance-print-card { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); margin: 0; padding: 40px 32px; width: min(88vw, 760px); background: #f5deb3; box-shadow: none; border-color: rgba(128, 0, 0, 0.24); } #staff-attendance-print-card .staff-attendance-print-qr { width: min(72vw, 460px); height: min(72vw, 460px); margin: 24px auto 0; } }'}</style>
      <div className="rounded-2xl border border-[#c9a96e]/40 bg-[#f0d090] p-5 text-[#191970] dark:border-white/10 dark:bg-slate-800/40 dark:text-slate-200">
        <h3 className="text-lg font-semibold text-[#800000] dark:text-slate-100">Attendance Management</h3>
        <p className="mt-2 text-sm">Manage the live school QR for staff sign-in and sign-out, and keep lateness policy inside the attendance engine rather than scattered across payroll screens.</p>
      </div>

      {loading ? <p className="text-sm text-[#800020] dark:text-slate-400">Loading attendance settings...</p> : null}
      {error ? <p className="text-sm text-[#800000] dark:text-rose-200">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
        <form onSubmit={handleSave} className="space-y-5 rounded-3xl border border-[#c9a96e]/40 bg-[#f5deb3] p-6 dark:border-white/10 dark:bg-slate-900/30">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase text-[#800020] dark:text-slate-400">Attendance Mode</label>
              <select value={form.mode} onChange={e => setForm(current => ({ ...current, mode: e.target.value }))} className="mt-2 w-full rounded-2xl border border-[#c9a96e]/40 bg-[#f0d090] px-3 py-2 text-sm text-[#191970] outline-none dark:border-white/10 dark:bg-slate-800 dark:text-slate-100">
                <option value="qr">QR only</option>
                <option value="face_qr">Face + QR on shared phones</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-[#800020] dark:text-slate-400">Late After</label>
              <input type="time" value={form.lateAfterTime} onChange={e => setForm(current => ({ ...current, lateAfterTime: e.target.value }))} className="mt-2 w-full rounded-2xl border border-[#c9a96e]/40 bg-[#f0d090] px-3 py-2 text-sm text-[#191970] outline-none dark:border-white/10 dark:bg-slate-800 dark:text-slate-100" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-[#800020] dark:text-slate-400">Grace Period (Minutes)</label>
              <input type="number" min="0" step="1" value={form.gracePeriodMinutes} onChange={e => setForm(current => ({ ...current, gracePeriodMinutes: e.target.value }))} className="mt-2 w-full rounded-2xl border border-[#c9a96e]/40 bg-[#f0d090] px-3 py-2 text-sm text-[#191970] outline-none dark:border-white/10 dark:bg-slate-800 dark:text-slate-100" />
            </div>
            <div className="rounded-2xl border border-[#c9a96e]/30 bg-[#f0d090] p-4 text-sm dark:border-white/10 dark:bg-slate-800/60">
              <p className="text-xs font-semibold uppercase text-[#800020] dark:text-slate-400">Policy Effect</p>
              <p className="mt-2 text-[#191970] dark:text-slate-300">Staff arriving before {form.lateAfterTime || '08:00'} plus {Number(form.gracePeriodMinutes || 0)} minute{Number(form.gracePeriodMinutes || 0) === 1 ? '' : 's'} stay on time.</p>
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-2xl border border-[#c9a96e]/30 bg-[#f0d090] p-4 text-sm dark:border-white/10 dark:bg-slate-800/60">
            <input type="checkbox" checked={form.requireQrOnFace} onChange={e => setForm(current => ({ ...current, requireQrOnFace: e.target.checked }))} className="mt-1" />
            <span>
              <span className="block font-semibold text-[#800000] dark:text-slate-100">Require active school QR during face sign-in</span>
              <span className="mt-1 block text-[#191970] dark:text-slate-300">Keep this on when staff may sign in from another person’s phone.</span>
            </span>
          </label>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
            <label className="flex items-start gap-3 rounded-2xl border border-[#c9a96e]/30 bg-[#f0d090] p-4 text-sm dark:border-white/10 dark:bg-slate-800/60">
              <input type="checkbox" checked={form.latePenaltyEnabled} onChange={e => setForm(current => ({ ...current, latePenaltyEnabled: e.target.checked }))} className="mt-1" />
              <span>
                <span className="block font-semibold text-[#800000] dark:text-slate-100">Charge for lateness</span>
                <span className="mt-1 block text-[#191970] dark:text-slate-300">When enabled, late sign-ins record the configured charge in the attendance event log.</span>
              </span>
            </label>
            <div>
              <label className="text-xs font-semibold uppercase text-[#800020] dark:text-slate-400">Late Charge Amount</label>
              <input type="number" min="0" step="0.01" value={form.latePenaltyAmount} disabled={!form.latePenaltyEnabled} onChange={e => setForm(current => ({ ...current, latePenaltyAmount: e.target.value }))} className="mt-2 w-full rounded-2xl border border-[#c9a96e]/40 bg-[#f0d090] px-3 py-2 text-sm text-[#191970] outline-none disabled:opacity-60 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
            <label className="flex items-start gap-3 rounded-2xl border border-[#c9a96e]/30 bg-[#f0d090] p-4 text-sm dark:border-white/10 dark:bg-slate-800/60">
              <input type="checkbox" checked={form.absencePenaltyEnabled} onChange={e => setForm(current => ({ ...current, absencePenaltyEnabled: e.target.checked }))} className="mt-1" />
              <span>
                <span className="block font-semibold text-[#800000] dark:text-slate-100">Charge for unauthorized absence</span>
                <span className="mt-1 block text-[#191970] dark:text-slate-300">Weekdays without sign-in and without approved HoS/Owner permission are treated as absenteeism.</span>
              </span>
            </label>
            <div>
              <label className="text-xs font-semibold uppercase text-[#800020] dark:text-slate-400">Absence Charge Amount</label>
              <input type="number" min="0" step="0.01" value={form.absencePenaltyAmount} disabled={!form.absencePenaltyEnabled} onChange={e => setForm(current => ({ ...current, absencePenaltyAmount: e.target.value }))} className="mt-2 w-full rounded-2xl border border-[#c9a96e]/40 bg-[#f0d090] px-3 py-2 text-sm text-[#191970] outline-none disabled:opacity-60 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100" />
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-2xl border border-[#c9a96e]/30 bg-[#f0d090] p-4 text-sm dark:border-white/10 dark:bg-slate-800/60">
            <input type="checkbox" checked={form.payrollAutoDeductAbsence} onChange={e => setForm(current => ({ ...current, payrollAutoDeductAbsence: e.target.checked }))} className="mt-1" />
            <span>
              <span className="block font-semibold text-[#800000] dark:text-slate-100">Auto-deduct absenteeism from payroll</span>
              <span className="mt-1 block text-[#191970] dark:text-slate-300">When enabled, approved payroll sheets automatically add the configured absence charge for every unauthorized weekday absence.</span>
            </span>
          </label>

          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={saving} className="rounded-2xl bg-[#1a5c38] px-5 py-2 text-sm font-bold text-[#f5deb3] transition-colors hover:bg-[#154a2e] disabled:opacity-60">
              {saving ? 'Saving...' : 'Save Attendance Policy'}
            </button>
            <button type="button" onClick={handleRotateQr} disabled={rotating} className="rounded-2xl border border-[#800020] px-5 py-2 text-sm font-semibold text-[#800020] transition-colors hover:bg-[#efd4a0] disabled:opacity-60 dark:border-cyan-400 dark:text-cyan-300 dark:hover:bg-slate-800/60">
              {rotating ? 'Rotating...' : 'Rotate QR'}
            </button>
            <button type="button" onClick={() => window.print()} className="rounded-2xl border border-[#c9a96e]/40 bg-[#f0d090] px-5 py-2 text-sm font-semibold text-[#191970] transition-colors hover:bg-[#efd4a0] dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-100 dark:hover:bg-slate-800">
              Print QR
            </button>
          </div>
        </form>

        <div id="staff-attendance-print-card" className="rounded-3xl border border-[#c9a96e]/40 bg-[#f5deb3] p-6 text-center dark:border-white/10 dark:bg-slate-900/30">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#800020] dark:text-cyan-300">Staff Sign-In / Sign-Out</p>
          <h4 className="mt-2 text-2xl font-bold text-[#800000] dark:text-slate-100">School Attendance QR</h4>
          <p className="mt-2 text-sm text-[#191970] dark:text-slate-300">Print and place this code at the staff sign-in point. The same live QR is used for both sign-in and sign-out.</p>
          <div className="staff-attendance-print-qr mx-auto mt-6 flex h-[280px] w-[280px] items-center justify-center rounded-3xl border border-[#c9a96e]/40 bg-[#f0d090] p-4 dark:border-white/10 dark:bg-slate-800/80">
            {qrDataUrl ? <img src={qrDataUrl} alt="Staff attendance QR" className="h-full w-full rounded-2xl object-contain" /> : <span className="text-sm text-[#800020] dark:text-slate-400">QR unavailable</span>}
          </div>
          <div className="mt-5 space-y-2 text-sm text-[#191970] dark:text-slate-300">
            <p><span className="font-semibold text-[#800000] dark:text-slate-100">Mode:</span> {form.mode === 'face_qr' ? 'Face + QR' : 'QR only'}</p>
            <p><span className="font-semibold text-[#800000] dark:text-slate-100">Late after:</span> {form.lateAfterTime || '08:00'}</p>
            <p><span className="font-semibold text-[#800000] dark:text-slate-100">Grace period:</span> {Number(form.gracePeriodMinutes || 0)} min</p>
            <p><span className="font-semibold text-[#800000] dark:text-slate-100">Late charge:</span> {form.latePenaltyEnabled ? `Configured at ${Number(form.latePenaltyAmount || 0).toLocaleString()}` : 'Disabled'}</p>
            <p><span className="font-semibold text-[#800000] dark:text-slate-100">Absence charge:</span> {form.absencePenaltyEnabled ? `${Number(form.absencePenaltyAmount || 0).toLocaleString()}${form.payrollAutoDeductAbsence ? ' via payroll' : ''}` : 'Disabled'}</p>
            <p><span className="font-semibold text-[#800000] dark:text-slate-100">Last rotated:</span> {form.qrRotatedAt ? new Date(form.qrRotatedAt).toLocaleString() : 'Not yet rotated'}</p>
          </div>
          <p className="mt-5 break-all rounded-2xl border border-dashed border-[#c9a96e]/50 bg-[#f0d090] px-3 py-2 text-xs text-[#800020] dark:border-white/10 dark:bg-slate-800/70 dark:text-slate-400">{form.activeQrCode || 'No active attendance QR code available.'}</p>
        </div>
      </div>

      {canReviewRequests ? (
        <div className="rounded-3xl border border-[#c9a96e]/40 bg-[#f5deb3] p-6 dark:border-white/10 dark:bg-slate-900/30">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-xl font-bold text-[#800000] dark:text-slate-100">Attendance Permission Requests</h4>
              <p className="mt-2 text-sm text-[#191970] dark:text-slate-300">Approve or reject staff requests before lateness or absenteeism deductions are applied.</p>
            </div>
            <button type="button" onClick={loadPermissionRequests} className="rounded-2xl border border-[#800020] px-4 py-2 text-sm font-semibold text-[#800020] transition-colors hover:bg-[#efd4a0] dark:border-cyan-400 dark:text-cyan-300 dark:hover:bg-slate-800/60">
              Refresh Queue
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {permissionLoading ? <p className="text-sm text-[#800020] dark:text-slate-400">Loading pending permission requests...</p> : null}
            {!permissionLoading && permissionRequests.length === 0 ? <p className="text-sm text-[#800020] dark:text-slate-400">No pending permission requests right now.</p> : null}
            {!permissionLoading && permissionRequests.map(request => (
              <div key={request.id} className={`rounded-2xl border p-4 ${permissionTone(request.status)}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold">{formatPermissionType(request.requestType)}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em]">{request.requestedBy || request.staffId || 'Staff'}</p>
                    <p className="mt-2 text-sm">{request.startDate === request.endDate ? request.startDate : `${request.startDate} to ${request.endDate}`}</p>
                  </div>
                  <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] dark:bg-black/20">{request.status || 'pending'}</span>
                </div>
                <p className="mt-3 text-sm">{request.reason}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" onClick={() => handleReviewRequest(request.id, 'approved')} disabled={reviewingId === request.id} className="rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#f5deb3] transition-colors hover:bg-[#154a2e] disabled:opacity-60">
                    {reviewingId === request.id ? 'Working...' : 'Approve'}
                  </button>
                  <button type="button" onClick={() => handleReviewRequest(request.id, 'rejected')} disabled={reviewingId === request.id} className="rounded-2xl border border-[#800020] px-4 py-2 text-sm font-semibold text-[#800020] transition-colors hover:bg-[#efd4a0] disabled:opacity-60 dark:border-cyan-400 dark:text-cyan-300 dark:hover:bg-slate-800/60">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}