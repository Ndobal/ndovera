import React, { ChangeEvent, useEffect, useRef, useState } from 'react';
import { FileUp, FolderLock, History as HistoryIcon } from 'lucide-react';

import { loadUser } from '../services/authLocal';
import { getHistoryAssets, type HistoryAssetRecord, uploadHistoryAsset } from '../features/classroom/services/classroomApi';

const HISTORY_KIND_OPTIONS: Array<{ value: HistoryAssetRecord['historyKind']; label: string }> = [
  { value: 'old-results', label: 'Old results' },
  { value: 'alumni', label: 'Alumni records' },
  { value: 'admission-register', label: 'Admission register' },
  { value: 'legacy-directory', label: 'Legacy directory' },
  { value: 'staff-history', label: 'Staff history' },
  { value: 'parent-history', label: 'Parent history' },
  { value: 'general-history', label: 'General history' },
];

function canManageSchoolHistory(role?: string) {
  return ['HOS', 'HoS', 'Owner', 'Tenant School Owner'].includes(String(role || '').trim());
}

export function SchoolHistoryView({ role }: { role?: string }) {
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const currentUser = loadUser();
  const [historyAssets, setHistoryAssets] = useState<HistoryAssetRecord[]>([]);
  const [selectedHistoryKind, setSelectedHistoryKind] = useState<HistoryAssetRecord['historyKind']>('general-history');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canManageSchoolHistory(role)) return;
    let active = true;
    getHistoryAssets().then((payload) => {
      if (active) setHistoryAssets(payload.assets || []);
    }).catch((nextError) => {
      if (!active) return;
      setHistoryAssets([]);
      setError(nextError instanceof Error ? nextError.message : 'Unable to load school history.');
    });
    return () => { active = false; };
  }, [role]);

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const response = await uploadHistoryAsset({ file, schoolId: currentUser?.schoolId, historyKind: selectedHistoryKind });
      setHistoryAssets((current) => [response.asset, ...current]);
      setMessage(`History file processed. ${response.mappedCount} mapped, ${response.unmatchedCount} unmatched.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'History upload failed.');
    } finally {
      setBusy(false);
      if (uploadInputRef.current) uploadInputRef.current.value = '';
    }
  };

  if (!canManageSchoolHistory(role)) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-start gap-3">
          <FolderLock className="mt-0.5 h-5 w-5 text-amber-500" />
          <div>
            <p className="text-sm font-bold text-slate-950 dark:text-white">School history is restricted</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Only the Head of School or Owner can view and upload school history files.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <HistoryIcon className="h-5 w-5 text-sky-500" />
              <p className="text-lg font-bold text-slate-950 dark:text-white">School history</p>
            </div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Upload and review school-wide legacy files separately from the live result workflow. Old results uploaded here still flow into learner old-result tabs when matched.</p>
            {message ? <p className="mt-3 text-sm font-medium text-emerald-600 dark:text-emerald-300">{message}</p> : null}
            {error ? <p className="mt-3 text-sm font-medium text-rose-600 dark:text-rose-300">{error}</p> : null}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <select value={selectedHistoryKind} onChange={(event) => setSelectedHistoryKind(event.target.value as HistoryAssetRecord['historyKind'])} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-sky-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {HISTORY_KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input ref={uploadInputRef} type="file" accept=".csv,.xlsx,.xls,.pdf,.doc,.docx,text/csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={handleFileSelected} />
            <button type="button" onClick={() => uploadInputRef.current?.click()} disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60 dark:bg-white dark:text-slate-950">
              <FileUp className="h-4 w-4" />
              {busy ? 'Processing history…' : 'Upload school history'}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-950 dark:text-white">History files</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">School-wide uploads are kept here instead of inside the results page.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">{historyAssets.length} files</span>
        </div>
        <div className="mt-4 space-y-3">
          {historyAssets.length ? historyAssets.map((asset) => (
            <a key={asset.id} href={asset.url} target="_blank" rel="noreferrer" className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-500/40 dark:hover:bg-sky-500/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{asset.fileName}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{asset.historyKind.replace(/-/g, ' ')} • {asset.sourceType.toUpperCase()} • uploaded by {asset.uploadedByName}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${asset.status === 'processed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200'}`}>{asset.status === 'processed' ? 'Auto-mapped' : 'Manual review'}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{asset.mappedUsers.filter((entry) => entry.status === 'mapped').length} mapped • {asset.mappedUsers.filter((entry) => entry.status === 'unmatched').length} unmatched • {new Date(asset.createdAt).toLocaleString()}</p>
            </a>
          )) : <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">No school history files have been uploaded yet.</div>}
        </div>
      </section>
    </div>
  );
}

export default SchoolHistoryView;