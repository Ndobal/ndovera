import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { getStaffAttendanceSettings, rotateStaffAttendanceQr, saveStaffAttendanceSettings } from '../../school/services/schoolApi';

const DEFAULT_FORM = {
  mode: 'qr',
  requireQrOnFace: true,
  activeQrCode: '',
  qrRotatedAt: '',
  lateAfterTime: '08:00',
  latePenaltyEnabled: false,
  latePenaltyAmount: 0,
};

export default function StaffAttendanceManagementPanel() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');

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
        latePenaltyEnabled: Boolean(settings.latePenaltyEnabled),
        latePenaltyAmount: Number(settings.latePenaltyAmount || 0),
      });
    } catch (err) {
      setError(err.message || 'Unable to load staff attendance settings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
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
        latePenaltyEnabled: form.latePenaltyEnabled,
        latePenaltyAmount: Number(form.latePenaltyAmount || 0),
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
            <p><span className="font-semibold text-[#800000] dark:text-slate-100">Late charge:</span> {form.latePenaltyEnabled ? `Configured at ${Number(form.latePenaltyAmount || 0).toLocaleString()}` : 'Disabled'}</p>
            <p><span className="font-semibold text-[#800000] dark:text-slate-100">Last rotated:</span> {form.qrRotatedAt ? new Date(form.qrRotatedAt).toLocaleString() : 'Not yet rotated'}</p>
          </div>
          <p className="mt-5 break-all rounded-2xl border border-dashed border-[#c9a96e]/50 bg-[#f0d090] px-3 py-2 text-xs text-[#800020] dark:border-white/10 dark:bg-slate-800/70 dark:text-slate-400">{form.activeQrCode || 'No active attendance QR code available.'}</p>
        </div>
      </div>
    </div>
  );
}