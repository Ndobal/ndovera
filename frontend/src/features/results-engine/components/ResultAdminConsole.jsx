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
import {
  RESULT_BODY,
  RESULT_BUTTON,
  RESULT_HEADING,
  RESULT_INNER_SURFACE,
  RESULT_INPUT,
  RESULT_LABEL,
  RESULT_SECONDARY_BUTTON,
  RESULT_SURFACE,
  getBatchTone,
} from './resultSheetTheme';

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
  const caComponents = Array.isArray(data?.settings?.metadata?.caComponents) ? data.settings.metadata.caComponents : [];

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
      <section className={`${RESULT_SURFACE} p-6`}>
        <p className={`micro-label ${RESULT_LABEL}`}>{roleTitle}</p>
        <h1 className={`text-3xl command-title mt-2 ${RESULT_HEADING}`}>Result Administration</h1>
        <p className={`mt-2 ${RESULT_BODY}`}>CA score sheets remain the source of truth. Published records inherit the configured template, grading scale, affective setup, and CA component grid.</p>
      </section>

      {error && <section className={`${RESULT_SURFACE} p-6 text-sm text-[#800020] dark:text-[#ffffff] border-rose-300/30 bg-rose-200/65 dark:bg-[#800000]/70`}>{error}</section>}
      {message && <section className={`${RESULT_SURFACE} p-6 text-sm text-[#1a5c38] dark:text-[#00ffff] border-emerald-300/30 bg-emerald-100/70 dark:bg-[#800000]/70`}>{message}</section>}

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
        <section className={`${RESULT_SURFACE} p-6 border border-amber-300/30 bg-[#f0d090] dark:bg-[#800000]/70 text-[#800020] dark:text-[#39ff14] text-sm`}>
          {data.configurationError || 'Result settings are incomplete. Configure the template and scales before CA entries can be accepted.'}
        </section>
      )}

      <section className={`${RESULT_SURFACE} p-6 space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={`micro-label ${RESULT_LABEL}`}>Result Batches</p>
            <p className={`text-sm mt-1 ${RESULT_BODY}`}>Select a class, session, and term batch to inspect or publish.</p>
          </div>
          <select
            value={selectedBatchKey}
            onChange={event => setSelectedBatchKey(event.target.value)}
            className={`${RESULT_INPUT} min-w-[280px]`}
          >
            {(data?.batches || []).map(batch => (
              <option key={buildBatchKey(batch)} value={buildBatchKey(batch)}>{batch.label}</option>
            ))}
          </select>
        </div>

        {selectedBatch && (
          <div className={`${RESULT_INNER_SURFACE} p-4 flex flex-wrap items-center justify-between gap-3`}>
            <div>
              <p className={`micro-label ${RESULT_LABEL}`}>Selected Batch</p>
              <p className={`mt-2 text-sm font-semibold ${RESULT_HEADING}`}>{selectedBatch.label}</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${getBatchTone(selectedBatch.status || 'draft')}`}>
              {selectedBatch.status || 'draft'}
            </span>
          </div>
        )}

        {caComponents.length > 0 && (
          <div className={`${RESULT_INNER_SURFACE} p-4`}>
            <p className={`micro-label ${RESULT_LABEL}`}>Configured CA Components</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {caComponents.map(component => (
                <span key={component.key} className={`rounded-full border border-[#c9a96e]/45 bg-[#f0d090] px-3 py-1 text-xs font-semibold ${RESULT_LABEL} dark:border-[#bf00ff]/35 dark:bg-black/20`}>
                  {component.label} ({component.maxScore})
                </span>
              ))}
            </div>
          </div>
        )}

        {selectedBatch && (
          <div className="flex flex-wrap gap-2">
            {data?.canPublish && String(selectedBatch.status || '') !== 'published' && (
              <button
                type="button"
                onClick={handlePublish}
                disabled={saving || !data?.sheet}
                className={RESULT_BUTTON}
              >
                {saving ? 'Publishing...' : 'Publish Selected Batch'}
              </button>
            )}

            {data?.canUploadDocuments && (
              <>
                <label className={`${RESULT_SECONDARY_BUTTON} cursor-pointer`}>
                  <span>Choose Result PDFs</span>
                  <input type="file" multiple accept="application/pdf,.pdf" onChange={event => setFiles(Array.from(event.target.files || []))} className="sr-only" />
                </label>
                <button
                  type="button"
                  onClick={handleUploadDocuments}
                  disabled={uploading || files.length === 0}
                  className={RESULT_BUTTON}
                >
                  {uploading ? 'Uploading PDFs...' : 'Upload Result PDFs'}
                </button>
              </>
            )}
          </div>
        )}
      </section>

      {loading && <section className={`${RESULT_SURFACE} p-6 ${RESULT_BODY}`}>Loading result administration...</section>}

      {!loading && data?.sheet && (
        <>
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className={`${RESULT_SURFACE} rounded-2xl p-4`}><p className={`micro-label ${RESULT_LABEL}`}>Class Average</p><p className={`text-2xl command-title mt-2 ${RESULT_HEADING}`}>{data.classAverage}%</p></div>
            <div className={`${RESULT_SURFACE} rounded-2xl p-4`}><p className={`micro-label ${RESULT_LABEL}`}>Pass Rate</p><p className={`text-2xl command-title mt-2 ${RESULT_HEADING}`}>{data.passRate}%</p></div>
            <div className={`${RESULT_SURFACE} rounded-2xl p-4`}><p className={`micro-label ${RESULT_LABEL}`}>Attendance Avg</p><p className={`text-2xl command-title mt-2 ${RESULT_HEADING}`}>{data.attendanceAverage}%</p></div>
            <div className={`${RESULT_SURFACE} rounded-2xl p-4`}><p className={`micro-label ${RESULT_LABEL}`}>At Risk</p><p className={`text-2xl command-title mt-2 ${RESULT_HEADING}`}>{data.atRiskCount}</p></div>
          </section>

          <section className={`${RESULT_SURFACE} p-6`}>
            <div className="mb-4">
              <p className={`micro-label ${RESULT_LABEL}`}>Subject Performance</p>
              <h2 className={`text-xl command-title mt-2 ${RESULT_HEADING}`}>Live performance by subject</h2>
            </div>
            <div className="space-y-3">
              {data.subjectPerformance.map(subject => (
                <div key={subject.subject} className="space-y-1">
                  <div className={`flex justify-between text-sm ${RESULT_BODY}`}><span>{subject.subject}</span><span>{subject.average}%</span></div>
                  <div className="h-2 rounded-full bg-[#ead7ae] overflow-hidden dark:bg-black/30"><div className="h-full bg-[#1a5c38] dark:bg-[#00ffff]" style={{ width: `${subject.average}%` }} /></div>
                </div>
              ))}
              {data.subjectPerformance.length === 0 && <p className={`text-sm ${RESULT_BODY}`}>No published performance rows are available yet.</p>}
            </div>
          </section>

          <BroadsheetTable rows={data.broadsheet} title="Broadsheet Ranking" />
        </>
      )}
    </div>
  );
}