import React, { useCallback, useEffect, useState } from 'react';
import { getClasses } from '../../school/services/schoolApi';
import {
  approvePublishedResults,
  getHoSResultAnalytics,
  getOwnerResultAnalytics,
  saveResultConfiguration,
  uploadPublishedResultDocuments,
} from '../service/resultEngineService';
import BroadsheetTable from './BroadsheetTable';
import ResultSettingsPanel from './ResultSettingsPanel';

function buildBatchKey(batch) {
  return `${batch?.classId || ''}::${batch?.sessionName || ''}::${batch?.termName || ''}`;
}

function parseBatchKey(value) {
  const [classId = '', sessionName = '', termName = ''] = String(value || '').split('::');
  return classId ? { classId, sessionName, termName } : {};
}

export default function ResultAdminConsole({ analyticsMode = 'hos', roleTitle = 'Academic Result Console' }) {
  const [classMap, setClassMap] = useState({});
  const [selectedBatchKey, setSelectedBatchKey] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState([]);
  const loader = analyticsMode === 'owner' ? getOwnerResultAnalytics : getHoSResultAnalytics;

  const loadConsole = useCallback(async (nextBatchKey = '', nextClassMap = {}) => {
    setLoading(true);
    setError('');
    try {
      const result = await loader(parseBatchKey(nextBatchKey), nextClassMap);
      setData(result);
      if (!nextBatchKey && result?.selectedBatch) {
        setSelectedBatchKey(buildBatchKey(result.selectedBatch));
      }
    } catch (loadError) {
      setError(loadError.message || 'Unable to load result administration right now.');
    } finally {
      setLoading(false);
    }
  }, [loader]);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const classData = await getClasses().catch(() => ({ classes: [] }));
        if (cancelled) return;
        const nextClassMap = Object.fromEntries((classData?.classes || []).map(item => [String(item.id || ''), `${item.name || item.className || item.id}${item.arm ? ` ${item.arm}` : ''}`]));
        setClassMap(nextClassMap);
        await loadConsole('', nextClassMap);
      } catch (bootstrapError) {
        if (!cancelled) setError(bootstrapError.message || 'Unable to load result administration right now.');
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [loadConsole]);

  useEffect(() => {
    if (!selectedBatchKey) return;
    loadConsole(selectedBatchKey, classMap);
  }, [classMap, loadConsole, selectedBatchKey]);

  const selectedBatch = data?.batches?.find(batch => buildBatchKey(batch) === selectedBatchKey) || data?.selectedBatch || null;

  async function handleSaveSettings(payload) {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await saveResultConfiguration(payload);
      setMessage('Result settings saved. CA entry gate is now aligned with the configured template and scales.');
      await loadConsole(selectedBatchKey, classMap);
    } catch (saveError) {
      setError(saveError.message || 'Unable to save result settings.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!data?.sheet) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await approvePublishedResults(data.sheet);
      setMessage('Batch published for students and parents.');
      await loadConsole(selectedBatchKey, classMap);
    } catch (publishError) {
      setError(publishError.message || 'Unable to publish this batch.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadDocuments() {
    if (!selectedBatch || files.length === 0) return;
    setUploading(true);
    setError('');
    setMessage('');
    try {
      await uploadPublishedResultDocuments({ ...selectedBatch, files });
      setFiles([]);
      setMessage('Result PDFs uploaded and matched to students.');
      await loadConsole(selectedBatchKey, classMap);
    } catch (uploadError) {
      setError(uploadError.message || 'Unable to upload result PDFs.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <section className="glass-surface rounded-3xl p-6">
        <p className="micro-label neon-subtle">{roleTitle}</p>
        <h1 className="text-3xl command-title neon-title">Result Administration</h1>
        <p className="text-slate-300 mt-1">CA score sheets remain the source of truth. Published records inherit the configured template, grading scale, and affective setup.</p>
      </section>

      {error && <section className="glass-surface rounded-3xl p-6 text-sm text-rose-100 border border-rose-300/30 bg-rose-500/20">{error}</section>}
      {message && <section className="glass-surface rounded-3xl p-6 text-sm text-emerald-100 border border-emerald-300/30 bg-emerald-500/20">{message}</section>}

      {data && (
        <ResultSettingsPanel
          settings={data.settings}
          templates={data.templates}
          suggestedSettings={data.suggestedSettings}
          canManageSettings={data.canManageSettings}
          saving={saving}
          onSave={handleSaveSettings}
        />
      )}

      {data && !data.configurationReady && (
        <section className="glass-surface rounded-3xl p-6 border border-amber-300/30 bg-amber-500/20 text-amber-100 text-sm">
          {data.configurationError || 'Result settings are incomplete. Configure the template and scales before CA entries can be accepted.'}
        </section>
      )}

      <section className="glass-surface rounded-3xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="micro-label accent-indigo">Result Batches</p>
            <p className="text-sm text-slate-300 mt-1">Select a class, session, and term batch to inspect or publish.</p>
          </div>
          <select
            value={selectedBatchKey}
            onChange={event => setSelectedBatchKey(event.target.value)}
            className="rounded-2xl bg-slate-900/30 border border-white/10 px-3 py-2 text-slate-100 min-w-[280px]"
          >
            {(data?.batches || []).map(batch => (
              <option key={buildBatchKey(batch)} value={buildBatchKey(batch)}>{batch.label}</option>
            ))}
          </select>
        </div>

        {selectedBatch && (
          <div className="flex flex-wrap gap-2">
            {data?.canPublish && String(selectedBatch.status || '') !== 'published' && (
              <button
                type="button"
                onClick={handlePublish}
                disabled={saving || !data?.sheet}
                className="px-4 py-2 rounded-2xl border border-emerald-300/30 bg-emerald-500/20 text-emerald-100 text-sm disabled:opacity-50"
              >
                {saving ? 'Publishing...' : 'Publish Selected Batch'}
              </button>
            )}

            {data?.canUploadDocuments && (
              <>
                <input type="file" multiple accept="application/pdf,.pdf" onChange={event => setFiles(Array.from(event.target.files || []))} className="text-sm text-slate-300" />
                <button
                  type="button"
                  onClick={handleUploadDocuments}
                  disabled={uploading || files.length === 0}
                  className="px-4 py-2 rounded-2xl border border-cyan-300/30 bg-cyan-500/20 text-cyan-100 text-sm disabled:opacity-50"
                >
                  {uploading ? 'Uploading PDFs...' : 'Upload Result PDFs'}
                </button>
              </>
            )}
          </div>
        )}
      </section>

      {loading && <section className="glass-surface rounded-3xl p-6 text-slate-200">Loading result administration...</section>}

      {!loading && data?.sheet && (
        <>
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="glass-surface rounded-2xl p-4"><p className="micro-label accent-indigo">Class Average</p><p className="text-2xl command-title mt-1 text-slate-100">{data.classAverage}%</p></div>
            <div className="glass-surface rounded-2xl p-4"><p className="micro-label accent-emerald">Pass Rate</p><p className="text-2xl command-title mt-1 text-slate-100">{data.passRate}%</p></div>
            <div className="glass-surface rounded-2xl p-4"><p className="micro-label accent-amber">Attendance Avg</p><p className="text-2xl command-title mt-1 text-slate-100">{data.attendanceAverage}%</p></div>
            <div className="glass-surface rounded-2xl p-4"><p className="micro-label accent-rose">At Risk</p><p className="text-2xl command-title mt-1 text-slate-100">{data.atRiskCount}</p></div>
          </section>

          <section className="glass-surface rounded-3xl p-6">
            <h2 className="text-xl command-title neon-title mb-4">Subject Performance</h2>
            <div className="space-y-3">
              {data.subjectPerformance.map(subject => (
                <div key={subject.subject} className="space-y-1">
                  <div className="flex justify-between text-sm text-slate-300"><span>{subject.subject}</span><span>{subject.average}%</span></div>
                  <div className="h-2 rounded-full bg-slate-700 overflow-hidden"><div className="h-full bg-indigo-400" style={{ width: `${subject.average}%` }} /></div>
                </div>
              ))}
            </div>
          </section>

          <BroadsheetTable rows={data.broadsheet} title="Broadsheet Ranking" />
        </>
      )}
    </div>
  );
}