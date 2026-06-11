import React, { useCallback, useEffect, useState } from 'react';
import { getClasses, getSession, getResultsUnpublished } from '../../school/services/schoolApi';
import {
  approvePublishedResults,
  getHoSResultAnalytics,
  getOwnerResultAnalytics,
  saveResultConfiguration,
  uploadPublishedResultDocumentsSequential,
} from '../service/resultEngineService';
import BroadsheetTable from './BroadsheetTable';
import OldStudentCodesUpload from './OldStudentCodesUpload';
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

// Every session can be uploaded against any of the three standard terms (also called 1st/2nd/3rd term).
const STANDARD_TERMS = ['Term 1', 'Term 2', 'Term 3'];

function buildBatchKey(batch) {
  return `${batch?.classId || ''}::${batch?.sessionName || ''}::${batch?.termName || ''}`;
}

function parseBatchKey(value) {
  const [classId = '', sessionName = '', termName = ''] = String(value || '').split('::');
  return classId ? { classId, sessionName, termName } : {};
}

function readScoreModel(settings = {}) {
  const configuredCa = Number(settings?.metadata?.caMaxScore);
  const configuredExam = Number(settings?.metadata?.examMaxScore);
  const caMaxScore = Number.isFinite(configuredCa) && configuredCa > 0 ? configuredCa : 40;
  const examMaxScore = Number.isFinite(configuredExam) && configuredExam > 0 ? configuredExam : 60;
  return {
    caMaxScore,
    examMaxScore,
    totalMaxScore: caMaxScore + examMaxScore,
  };
}

function getUploadResultTone(status = '') {
  if (status === 'ok') return 'border-emerald-300/35 bg-emerald-100/60 dark:bg-emerald-500/10';
  if (status === 'skipped') return 'border-amber-300/35 bg-amber-100/70 dark:bg-amber-500/10';
  return 'border-rose-300/35 bg-rose-100/70 dark:bg-rose-500/10';
}

// The files that did not go up (unmatched, ambiguous, wrong type, or a transient error) — shown
// prominently with the reason so the operator can fix names and re-upload just those.
function getFailedUploadResults(report) {
  return (report?.results || []).filter(result => String(result?.status || '') === 'error');
}

function UploadFailureList({ report }) {
  const failed = getFailedUploadResults(report);
  if (!failed.length) return null;
  return (
    <div className="rounded-2xl border border-rose-300/40 bg-rose-100/70 p-4 dark:border-rose-400/30 dark:bg-rose-500/10">
      <p className="text-sm font-bold text-[#800020] dark:text-rose-200">Not uploaded — {failed.length} file{failed.length === 1 ? '' : 's'} need attention</p>
      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
        {failed.map((result, index) => (
          <div key={`${result.fileName}-${index}`} className="rounded-xl border border-rose-300/40 bg-white/70 px-3 py-2 dark:border-rose-400/20 dark:bg-black/20">
            <p className="text-sm font-semibold text-[#191970] dark:text-white">{result.fileName}</p>
            <p className="mt-1 text-xs text-[#800020] dark:text-rose-200">{result.message || 'Could not be matched to a student.'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function filterRecentDocumentsForBatch(documents = [], batch = null) {
  if (!batch) return [];
  return (Array.isArray(documents) ? documents : []).filter(document => (
    String(document?.sessionName || '') === String(batch?.sessionName || '')
      && String(document?.termName || '') === String(batch?.termName || '')
  ));
}

function buildUploadFileKey(file) {
  return `${file?.name || 'result.pdf'}::${file?.size || 0}`;
}

// Collect every session we know about (current + history + any server batch session).
function collectSessionNames(sessionPayload = {}, serverBatches = []) {
  const names = new Set();
  [sessionPayload?.session, ...(Array.isArray(sessionPayload?.history) ? sessionPayload.history : [])].forEach(entry => {
    const sessionName = String(entry?.session || entry?.sessionName || '').trim();
    if (sessionName) names.add(sessionName);
  });
  (Array.isArray(serverBatches) ? serverBatches : []).forEach(batch => {
    const sessionName = String(batch?.sessionName || '').trim();
    if (sessionName) names.add(sessionName);
  });
  return Array.from(names);
}

// Generate a class × session × {Term 1, Term 2, Term 3} grid so past and present terms are always selectable.
function buildFallbackBatchOptions(classMap = {}, sessionPayload = {}, serverBatches = []) {
  const sessionNames = collectSessionNames(sessionPayload, serverBatches);
  const classes = Object.entries(classMap)
    .filter(([classId]) => Boolean(String(classId || '').trim()))
    .map(([classId, className]) => ({ classId, className: String(className || classId) }));

  if (!classes.length || !sessionNames.length) return [];

  return classes.flatMap(classroom => sessionNames.flatMap(sessionName => STANDARD_TERMS.map(termName => ({
    id: `fallback_${classroom.classId}_${sessionName}_${termName}`,
    classId: classroom.classId,
    className: classroom.className,
    sessionName,
    termName,
    status: 'draft',
    label: `${classroom.className} • ${sessionName} • ${termName}`,
  }))));
}

// Merge server batches with the generated grid, keeping server batches' real status/label, deduped by key.
function buildSelectableBatches(serverBatches = [], classMap = {}, sessionPayload = {}) {
  const byKey = new Map();
  buildFallbackBatchOptions(classMap, sessionPayload, serverBatches).forEach(batch => {
    byKey.set(buildBatchKey(batch), batch);
  });
  (Array.isArray(serverBatches) ? serverBatches : []).forEach(batch => {
    byKey.set(buildBatchKey(batch), batch);
  });
  return Array.from(byKey.values()).sort((left, right) => String(left.label || '').localeCompare(String(right.label || '')));
}

export default function ResultAdminConsole({ analyticsMode = 'hos', roleTitle = 'Academic Result Console' }) {
  const [classMap, setClassMap] = useState({});
  const [selectedBatchKey, setSelectedBatchKey] = useState('');
  const [data, setData] = useState(null);
  const [sessionPayload, setSessionPayload] = useState({ session: null, history: [] });
  const [activeTab, setActiveTab] = useState('console');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState([]);
  const [fileStudentMap, setFileStudentMap] = useState({});
  const [uploadReport, setUploadReport] = useState(null);
  // Bulk upload mode: 'class' (one selected batch) or 'school' (whole school, no class).
  const [uploadMode, setUploadMode] = useState('class');
  // Whole-school upload: pick only session + term, drop every PDF, and the server matches each
  // file to its student across all classes, processing them one chunk after another (queued).
  const [schoolSession, setSchoolSession] = useState('');
  const [schoolTerm, setSchoolTerm] = useState('');
  const [schoolFiles, setSchoolFiles] = useState([]);
  const [schoolUploading, setSchoolUploading] = useState(false);
  const [schoolProgress, setSchoolProgress] = useState({ done: 0, total: 0 });
  const [schoolReport, setSchoolReport] = useState(null);
  const [unpublishedReport, setUnpublishedReport] = useState(null);
  const [unpublishedLoading, setUnpublishedLoading] = useState(false);
  const loader = analyticsMode === 'owner' ? getOwnerResultAnalytics : getHoSResultAnalytics;

  const loadConsole = useCallback(async (nextBatchKey = '', nextClassMap = {}) => {
    setLoading(true);
    setError('');
    try {
      const result = await loader(parseBatchKey(nextBatchKey), nextClassMap);
      setData(result);
      const resolvedBatchKey = result?.selectedBatch ? buildBatchKey(result.selectedBatch) : '';
      if (resolvedBatchKey && resolvedBatchKey !== nextBatchKey) {
        setSelectedBatchKey(resolvedBatchKey);
      } else if (!nextBatchKey && resolvedBatchKey) {
        setSelectedBatchKey(resolvedBatchKey);
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
        const [classData, nextSessionPayload] = await Promise.all([
          getClasses().catch(() => ({ classes: [] })),
          getSession().catch(() => ({ session: null, history: [] })),
        ]);
        if (cancelled) return;
        const nextClassMap = Object.fromEntries((classData?.classes || []).map(item => [String(item.id || ''), `${item.name || item.className || item.id}${item.arm ? ` ${item.arm}` : ''}`]));
        setClassMap(nextClassMap);
        setSessionPayload(nextSessionPayload || { session: null, history: [] });
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

  const batchOptions = Array.isArray(data?.batches) ? data.batches : [];
  const schoolSessionOptions = collectSessionNames(sessionPayload, batchOptions);
  const selectableBatches = buildSelectableBatches(batchOptions, classMap, sessionPayload);
  const selectedBatch = selectableBatches.find(batch => buildBatchKey(batch) === selectedBatchKey) || data?.selectedBatch || null;
  const caComponents = Array.isArray(data?.settings?.metadata?.caComponents) ? data.settings.metadata.caComponents : [];
  const scoreModel = readScoreModel(data?.settings || {});
  const recentBatchDocuments = filterRecentDocumentsForBatch(data?.recentDocuments || [], selectedBatch);

  useEffect(() => {
    if (selectedBatchKey) return;

    const nextBatchKey = data?.selectedBatch
      ? buildBatchKey(data.selectedBatch)
      : (selectableBatches[0] ? buildBatchKey(selectableBatches[0]) : '');

    if (nextBatchKey) {
      setSelectedBatchKey(nextBatchKey);
    }
  }, [data?.selectedBatch, selectableBatches, selectedBatchKey]);

  useEffect(() => {
    setUploadReport(null);
    setFiles([]);
    setFileStudentMap({});
  }, [selectedBatchKey]);

  const batchStudents = Array.isArray(data?.sheet?.students) ? data.sheet.students : [];

  function handleSelectFiles(nextFiles) {
    const normalizedFiles = Array.from(nextFiles || []);
    setFiles(normalizedFiles);
    setFileStudentMap(current => {
      const nextMap = {};
      normalizedFiles.forEach(file => {
        const key = buildUploadFileKey(file);
        nextMap[key] = current[key] || '';
      });
      return nextMap;
    });
  }

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
      // Re-throw so the settings panel can surface the exact reason right next to the Save button,
      // where the user is actually looking (the page-level banner is far above the form).
      throw saveError;
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
    setUploadProgress({ done: 0, total: files.length });
    setError('');
    setMessage('');
    try {
      const response = await uploadPublishedResultDocumentsSequential(
        { ...selectedBatch, files, fileStudentMap },
        { chunkSize: 1, onProgress: (done, total) => setUploadProgress({ done, total }) },
      );
      setUploadReport(response || null);
      setFiles([]);
      setFileStudentMap({});
      const uploaded = response?.summary?.uploadedCount || 0;
      const skipped = response?.summary?.skippedCount || 0;
      const failed = getFailedUploadResults(response).length;
      setMessage(`✓ Upload complete — ${uploaded} uploaded${skipped ? `, ${skipped} already on file` : ''}${failed ? `, ${failed} need attention` : ''}.`);
      if (failed > 0) {
        setError(`${failed} file${failed === 1 ? '' : 's'} could not be uploaded — see “Not uploaded” below for the reason on each, fix the filename or pick the student, then re-upload just those.`);
      }
      await loadConsole(selectedBatchKey, classMap);
    } catch (uploadError) {
      setError(uploadError.message || 'Unable to upload result PDFs.');
    } finally {
      setUploading(false);
    }
  }

  // Default the whole-school upload to the current session/term once they load.
  useEffect(() => {
    const currentSession = String(sessionPayload?.session?.session || '').trim();
    const currentTerm = String(sessionPayload?.session?.term || '').trim();
    if (currentSession) setSchoolSession(previous => previous || currentSession);
    setSchoolTerm(previous => previous || currentTerm || STANDARD_TERMS[0]);
  }, [sessionPayload]);

  async function handleSchoolUpload() {
    if (schoolFiles.length === 0) return;
    if (!schoolSession || !schoolTerm) { setError('Choose the session and term before uploading.'); return; }
    setSchoolUploading(true);
    setSchoolProgress({ done: 0, total: schoolFiles.length });
    setError('');
    setMessage('');
    setSchoolReport(null);
    try {
      // classId is left blank on purpose: the server matches each PDF to its student across
      // every class, skips PDFs already uploaded for this term, and queues them one chunk at a time.
      const response = await uploadPublishedResultDocumentsSequential(
        { classId: '', sessionName: schoolSession, termName: schoolTerm, files: schoolFiles },
        { chunkSize: 1, onProgress: (done, total) => setSchoolProgress({ done, total }) },
      );
      setSchoolReport(response || null);
      setSchoolFiles([]);
      const uploaded = response?.summary?.uploadedCount || 0;
      const skipped = response?.summary?.skippedCount || 0;
      const failed = getFailedUploadResults(response).length;
      // Always confirm what went up; the list of failures (with reasons) shows below.
      setMessage(`✓ Whole-school upload complete for ${schoolSession} • ${schoolTerm} — ${uploaded} uploaded${skipped ? `, ${skipped} already on file` : ''}${failed ? `, ${failed} need attention` : ''}.`);
      if (failed > 0) {
        setError(`${failed} file${failed === 1 ? '' : 's'} could not be uploaded — see “Not uploaded” below for the reason on each, fix the filename or pick the student, then re-upload just those.`);
      }
      await loadConsole(selectedBatchKey, classMap);
    } catch (uploadError) {
      setError(uploadError.message || 'Unable to upload the school results.');
    } finally {
      setSchoolUploading(false);
    }
  }

  async function handleCheckUnpublished() {
    if (!schoolSession || !schoolTerm) { setError('Choose the session and term first.'); return; }
    setUnpublishedLoading(true);
    setError('');
    try {
      const data = await getResultsUnpublished({ sessionName: schoolSession, termName: schoolTerm });
      setUnpublishedReport(data);
    } catch (checkError) {
      setError(checkError.message || 'Could not load the unpublished list.');
    } finally {
      setUnpublishedLoading(false);
    }
  }

  function downloadUnpublishedList() {
    const rows = unpublishedReport?.missing || [];
    const header = 'Student ID,Name,Class\n';
    const body = rows.map(student => `${student.displayId || student.id},"${String(student.name || '').replace(/"/g, '""')}",${student.className || ''}`).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `unpublished_results_${schoolSession}_${schoolTerm}.csv`.replace(/[^\w.-]+/g, '_');
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <section className={`${RESULT_SURFACE} p-6`}>
        <p className={`micro-label ${RESULT_LABEL}`}>{roleTitle}</p>
        <h1 className={`text-3xl command-title mt-2 ${RESULT_HEADING}`}>Result Administration</h1>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className={`${RESULT_INNER_SURFACE} p-4`}><p className={`micro-label ${RESULT_LABEL}`}>Class Average</p><p className={`text-2xl command-title mt-2 ${RESULT_HEADING}`}>{Number(data?.classAverage || 0)}%</p></div>
          <div className={`${RESULT_INNER_SURFACE} p-4`}><p className={`micro-label ${RESULT_LABEL}`}>Pass Rate</p><p className={`text-2xl command-title mt-2 ${RESULT_HEADING}`}>{Number(data?.passRate || 0)}%</p></div>
          <div className={`${RESULT_INNER_SURFACE} p-4`}><p className={`micro-label ${RESULT_LABEL}`}>Attendance Avg</p><p className={`text-2xl command-title mt-2 ${RESULT_HEADING}`}>{Number(data?.attendanceAverage || 0)}%</p></div>
          <div className={`${RESULT_INNER_SURFACE} p-4`}><p className={`micro-label ${RESULT_LABEL}`}>At Risk</p><p className={`text-2xl command-title mt-2 ${RESULT_HEADING}`}>{Number(data?.atRiskCount || 0)}</p></div>
        </div>
      </section>

      {error && <section className={`${RESULT_SURFACE} p-6 text-sm text-[#800020] dark:text-[#ffffff] border-rose-300/30 bg-rose-200/65 dark:bg-[#800000]/70`}>{error}</section>}
      {message && <section className={`${RESULT_SURFACE} p-6 text-sm text-[#1a5c38] dark:text-[#00ffff] border-emerald-300/30 bg-emerald-100/70 dark:bg-[#800000]/70`}>{message}</section>}

      {data && (
        <section className={`${RESULT_SURFACE} p-3`}>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('console')}
              className={activeTab === 'console' ? RESULT_BUTTON : RESULT_SECONDARY_BUTTON}
            >
              Result Control
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('batches')}
              className={activeTab === 'batches' ? RESULT_BUTTON : RESULT_SECONDARY_BUTTON}
            >
              Result Batches
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('subjects')}
              className={activeTab === 'subjects' ? RESULT_BUTTON : RESULT_SECONDARY_BUTTON}
            >
              Subject Performance
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('broadsheet')}
              className={activeTab === 'broadsheet' ? RESULT_BUTTON : RESULT_SECONDARY_BUTTON}
            >
              Broadsheet Ranking
            </button>
            {data.canUploadDocuments && (
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={activeTab === 'upload' ? RESULT_BUTTON : RESULT_SECONDARY_BUTTON}
              >
                Bulk Result Upload
              </button>
            )}
            {data.canUploadDocuments && (
              <button
                type="button"
                onClick={() => setActiveTab('oldCodes')}
                className={activeTab === 'oldCodes' ? RESULT_BUTTON : RESULT_SECONDARY_BUTTON}
              >
                Old Student Codes
              </button>
            )}
          </div>
        </section>
      )}

      {activeTab === 'oldCodes' && <OldStudentCodesUpload />}

      {activeTab === 'console' && (
        <>
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

          {loading && <section className={`${RESULT_SURFACE} p-6 ${RESULT_BODY}`}>Loading result administration...</section>}
        </>
      )}

      {activeTab === 'batches' && (
        <section className={`${RESULT_SURFACE} p-6 space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className={`micro-label ${RESULT_LABEL}`}>Result Batches</p>
              <p className={`text-sm mt-1 ${RESULT_BODY}`}>Select a class, session, and term (Term 1, Term 2 or Term 3) batch to inspect or publish.</p>
            </div>
            <select
              value={selectedBatchKey}
              onChange={event => setSelectedBatchKey(event.target.value)}
              className={`${RESULT_INPUT} min-w-[280px]`}
            >
              {!selectableBatches.length && <option value="">No class/session batch available yet</option>}
              {selectableBatches.map(batch => (
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

            <div className={`${RESULT_INNER_SURFACE} p-4`}>
              <p className={`micro-label ${RESULT_LABEL}`}>Score Split</p>
              <p className={`mt-2 text-sm font-semibold ${RESULT_HEADING}`}>CA {scoreModel.caMaxScore} / Exam {scoreModel.examMaxScore}</p>
              <p className={`mt-2 text-xs ${RESULT_BODY}`}>Published results keep the full 100-point total while honoring the tenant-configured CA and exam maxima.</p>
            </div>
          </div>

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
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className={RESULT_SECONDARY_BUTTON}
                >
                  Open Bulk Upload Tab
                </button>
              )}
            </div>
          )}

          {loading && <p className={`text-sm ${RESULT_BODY}`}>Loading result administration...</p>}
        </section>
      )}

      {activeTab === 'subjects' && (
        <section className={`${RESULT_SURFACE} p-6`}>
          <div className="mb-4">
            <p className={`micro-label ${RESULT_LABEL}`}>Subject Performance</p>
            <h2 className={`text-xl command-title mt-2 ${RESULT_HEADING}`}>Live performance by subject</h2>
          </div>
          <div className="space-y-3">
            {(data?.subjectPerformance || []).map(subject => (
              <div key={subject.subject} className="space-y-1">
                <div className={`flex justify-between text-sm ${RESULT_BODY}`}><span>{subject.subject}</span><span>{subject.average}%</span></div>
                <div className="h-2 rounded-full bg-[#ead7ae] overflow-hidden dark:bg-black/30"><div className="h-full bg-[#1a5c38] dark:bg-[#00ffff]" style={{ width: `${subject.average}%` }} /></div>
              </div>
            ))}
            {(data?.subjectPerformance || []).length === 0 && <p className={`text-sm ${RESULT_BODY}`}>No published performance rows are available yet. Select a published batch in Result Batches.</p>}
          </div>
        </section>
      )}

      {activeTab === 'broadsheet' && (
        <BroadsheetTable rows={data?.broadsheet || []} title="Broadsheet Ranking" />
      )}

      {activeTab === 'upload' && (
        <>
          {/* Upload mode: one class at a time, or the whole school in a queue. */}
          <section className={`${RESULT_SURFACE} p-4`}>
            <p className={`micro-label ${RESULT_LABEL}`}>Bulk Result Upload</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setUploadMode('class')}
                className={uploadMode === 'class' ? RESULT_BUTTON : RESULT_SECONDARY_BUTTON}
              >
                One Class
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('school')}
                className={uploadMode === 'school' ? RESULT_BUTTON : RESULT_SECONDARY_BUTTON}
              >
                Whole School
              </button>
            </div>
            <p className={`mt-2 text-sm ${RESULT_BODY}`}>
              {uploadMode === 'class'
                ? 'Pick one class / session / term, then upload its result PDFs. Each PDF is matched to a student one after another, PDFs already uploaded for that term are skipped as duplicates, and any unmatched students are listed afterward.'
                : 'Just choose the session and term, then drop in every result PDF for the whole school — no class needed. The system matches each PDF to its student across all classes and processes them one after another.'}
            </p>
          </section>

          {uploadMode === 'class' && (
          <>
          <section className={`${RESULT_SURFACE} p-6 space-y-5`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className={`micro-label ${RESULT_LABEL}`}>Class-Based Upload</p>
                <h2 className={`mt-2 text-2xl command-title ${RESULT_HEADING}`}>Upload full result PDFs for a selected batch</h2>
                <p className={`mt-2 text-sm ${RESULT_BODY}`}>Use the student name and surname, display ID, student ID, or email in each PDF filename. Already uploaded PDFs are skipped automatically.</p>
              </div>
              <select
                value={selectedBatchKey}
                onChange={event => setSelectedBatchKey(event.target.value)}
                className={`${RESULT_INPUT} min-w-[280px]`}
              >
                {!selectableBatches.length && <option value="">No class/session batch available yet</option>}
                {selectableBatches.map(batch => (
                  <option key={buildBatchKey(batch)} value={buildBatchKey(batch)}>{batch.label}</option>
                ))}
              </select>
            </div>

            {selectedBatch ? (
              <div className="grid grid-cols-1 xl:grid-cols-[1.2fr,0.8fr] gap-4">
                <div className={`${RESULT_INNER_SURFACE} p-5 space-y-4`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className={`micro-label ${RESULT_LABEL}`}>Selected Batch</p>
                      <p className={`mt-2 text-sm font-semibold ${RESULT_HEADING}`}>{selectedBatch.label}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${getBatchTone(selectedBatch.status || 'draft')}`}>
                      {selectedBatch.status || 'draft'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <label className={`${RESULT_SECONDARY_BUTTON} cursor-pointer`}>
                      <span>Choose Result PDFs</span>
                      <input
                        type="file"
                        multiple
                        accept="application/pdf,.pdf"
                        onChange={event => handleSelectFiles(event.target.files || [])}
                        className="sr-only"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleUploadDocuments}
                      disabled={uploading || files.length === 0}
                      className={RESULT_BUTTON}
                    >
                      {uploading ? 'Uploading PDFs...' : 'Upload Result PDFs'}
                    </button>
                  </div>

                  {uploading && uploadProgress.total > 0 && (
                    <div className="space-y-1">
                      <div className="h-2.5 rounded-full bg-[#e8d4a0] dark:bg-black/30 overflow-hidden">
                        <div className="h-full rounded-full bg-[#1a5c38] dark:bg-[#00ffff] transition-all duration-300" style={{ width: `${Math.round((uploadProgress.done / uploadProgress.total) * 100)}%` }} />
                      </div>
                      <p className={`text-sm font-semibold ${RESULT_HEADING}`}>Uploading… {uploadProgress.done} of {uploadProgress.total} files processed</p>
                    </div>
                  )}

                  {files.length > 0 && (
                    <div className={`${RESULT_INNER_SURFACE} p-4`}>
                      <p className={`micro-label ${RESULT_LABEL}`}>Selected Files</p>
                      <p className={`mt-2 text-sm ${RESULT_BODY}`}>{files.length} PDFs ready for matching and upload.</p>
                      <div className="mt-3 space-y-2 max-h-56 overflow-y-auto">
                        {files.map(file => (
                          <div key={`${file.name}-${file.size}`} className={`${RESULT_INNER_SURFACE} px-3 py-3 text-sm space-y-2`}>
                            <p className={RESULT_BODY}>{file.name}</p>
                            <select
                              value={fileStudentMap[buildUploadFileKey(file)] || ''}
                              onChange={event => setFileStudentMap(current => ({ ...current, [buildUploadFileKey(file)]: event.target.value }))}
                              className={`${RESULT_INPUT} w-full`}
                            >
                              <option value="">Auto-match from filename</option>
                              {batchStudents.map(student => (
                                <option key={student.id} value={student.id}>{student.name}{student.displayId ? ` • ${student.displayId}` : ''}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className={`${RESULT_INNER_SURFACE} p-5`}>
                  <p className={`micro-label ${RESULT_LABEL}`}>Matching Rules</p>
                  <div className="mt-3 space-y-2">
                    <p className={`text-sm ${RESULT_BODY}`}>Accepted matches: student ID, display ID, student email, or student name and surname.</p>
                    <p className={`text-sm ${RESULT_BODY}`}>If a filename is weak, pick the student manually beside the file before upload.</p>
                    <p className={`text-sm ${RESULT_BODY}`}>If a filename matches more than one student, that file is flagged and must be renamed.</p>
                    <p className={`text-sm ${RESULT_BODY}`}>Students missing from the upload are listed after processing so the remaining PDFs can be prepared.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`${RESULT_INNER_SURFACE} p-5`}>
                <p className={`text-sm ${RESULT_BODY}`}>
                  {selectableBatches.length > 0
                    ? 'Select a class, session, and term batch before uploading PDFs.'
                    : 'Set the current school session and ensure classes exist before uploading result PDFs.'}
                </p>
              </div>
            )}
          </section>

          {uploadReport && (
            <section className={`${RESULT_SURFACE} p-6 space-y-5`}>
              <div>
                <p className={`micro-label ${RESULT_LABEL}`}>Upload Summary</p>
                <h3 className={`mt-2 text-xl command-title ${RESULT_HEADING}`}>Matched, skipped, and missing result documents</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                <div className={`${RESULT_INNER_SURFACE} p-4`}><p className={`micro-label ${RESULT_LABEL}`}>Matched</p><p className={`mt-2 text-2xl font-black ${RESULT_HEADING}`}>{uploadReport?.summary?.matchedCount || 0}</p></div>
                <div className={`${RESULT_INNER_SURFACE} p-4`}><p className={`micro-label ${RESULT_LABEL}`}>Manual Matches</p><p className={`mt-2 text-2xl font-black ${RESULT_HEADING}`}>{uploadReport?.summary?.manualMappedCount || 0}</p></div>
                <div className={`${RESULT_INNER_SURFACE} p-4`}><p className={`micro-label ${RESULT_LABEL}`}>Uploaded</p><p className={`mt-2 text-2xl font-black ${RESULT_HEADING}`}>{uploadReport?.summary?.uploadedCount || 0}</p></div>
                <div className={`${RESULT_INNER_SURFACE} p-4`}><p className={`micro-label ${RESULT_LABEL}`}>Skipped</p><p className={`mt-2 text-2xl font-black ${RESULT_HEADING}`}>{uploadReport?.summary?.skippedCount || 0}</p></div>
                <div className={`${RESULT_INNER_SURFACE} p-4`}><p className={`micro-label ${RESULT_LABEL}`}>Unmatched</p><p className={`mt-2 text-2xl font-black ${RESULT_HEADING}`}>{uploadReport?.summary?.unmatchedCount || 0}</p></div>
                <div className={`${RESULT_INNER_SURFACE} p-4`}><p className={`micro-label ${RESULT_LABEL}`}>Missing Students</p><p className={`mt-2 text-2xl font-black ${RESULT_HEADING}`}>{uploadReport?.summary?.missingStudentCount || 0}</p></div>
              </div>

              <UploadFailureList report={uploadReport} />

              {(uploadReport?.missingStudents || []).length > 0 && (
                <div className={`${RESULT_INNER_SURFACE} p-4`}>
                  <p className={`micro-label ${RESULT_LABEL}`}>Students Still Missing PDFs</p>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {uploadReport.missingStudents.map(student => (
                      <div key={student.id} className={`${RESULT_INNER_SURFACE} p-4`}>
                        <p className={`text-sm font-semibold ${RESULT_HEADING}`}>{student.name}</p>
                        <p className={`mt-2 text-xs ${RESULT_BODY}`}>{student.displayId || 'No display ID'}</p>
                        <p className={`mt-1 text-xs ${RESULT_BODY}`}>{student.className || 'Current class'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(uploadReport?.results || []).length > 0 && (
                <div className={`${RESULT_INNER_SURFACE} p-4`}>
                  <p className={`micro-label ${RESULT_LABEL}`}>File Processing Results</p>
                  <div className="mt-3 space-y-3 max-h-[28rem] overflow-y-auto">
                    {uploadReport.results.map(result => (
                      <div key={`${result.fileName}-${result.studentId || result.message || result.status}`} className={`rounded-2xl border p-4 ${getUploadResultTone(result.status)}`}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className={`text-sm font-semibold ${RESULT_HEADING}`}>{result.fileName}</p>
                          <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${getBatchTone(result.status === 'ok' ? 'published' : result.status === 'skipped' ? 'submitted' : 'draft')}`}>
                            {result.status}
                          </span>
                        </div>
                        {result.studentName && <p className={`mt-2 text-sm ${RESULT_BODY}`}>{result.studentName}</p>}
                        {result.message && <p className={`mt-2 text-xs ${RESULT_BODY}`}>{result.message}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {recentBatchDocuments.length > 0 && (
            <section className={`${RESULT_SURFACE} p-6`}>
              <p className={`micro-label ${RESULT_LABEL}`}>Recent Batch Documents</p>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {recentBatchDocuments.slice(0, 12).map(document => (
                  <a
                    key={document.id}
                    href={document.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`${RESULT_INNER_SURFACE} p-4 block transition hover:scale-[1.01]`}
                  >
                    <p className={`text-sm font-semibold ${RESULT_HEADING}`}>{document.fileName}</p>
                    <p className={`mt-2 text-xs ${RESULT_BODY}`}>{document.uploadedAt ? new Date(document.uploadedAt).toLocaleString() : 'Uploaded recently'}</p>
                  </a>
                ))}
              </div>
            </section>
          )}
          </>
          )}

          {uploadMode === 'school' && (
        <>
          <section className={`${RESULT_SURFACE} p-6 space-y-4`}>
            <div>
              <p className={`micro-label ${RESULT_LABEL}`}>Whole-School Upload</p>
              <h2 className={`mt-2 text-2xl command-title ${RESULT_HEADING}`}>Upload every result PDF for a term — no class needed</h2>
              <p className={`mt-2 text-sm ${RESULT_BODY}`}>
                Choose the session and term, then add all the result PDFs for the whole school. Each PDF is matched to its
                student by the name and surname, display ID, student ID, email, or old portal code in the filename — across
                every class. Files are processed one chunk after another, and PDFs already uploaded for this term are skipped.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[1fr,1fr,auto] gap-4">
              <label className="block">
                <span className={`micro-label ${RESULT_LABEL}`}>Session</span>
                <select value={schoolSession} onChange={event => setSchoolSession(event.target.value)} className={`mt-2 ${RESULT_INPUT}`}>
                  {!schoolSessionOptions.length && <option value="">No session set yet</option>}
                  {schoolSessionOptions.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className={`micro-label ${RESULT_LABEL}`}>Term</span>
                <select value={schoolTerm} onChange={event => setSchoolTerm(event.target.value)} className={`mt-2 ${RESULT_INPUT}`}>
                  {STANDARD_TERMS.map(term => <option key={term} value={term}>{term}</option>)}
                </select>
              </label>
              <div className="flex items-end">
                <label className={`${RESULT_SECONDARY_BUTTON} cursor-pointer`}>
                  <span>Add Result PDFs</span>
                  <input
                    type="file"
                    multiple
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    onChange={event => setSchoolFiles(previous => [...previous, ...Array.from(event.target.files || [])])}
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSchoolUpload}
                disabled={schoolUploading || schoolFiles.length === 0 || !schoolSession || !schoolTerm}
                className={RESULT_BUTTON}
              >
                {schoolUploading ? 'Uploading…' : `Upload ${schoolFiles.length} PDF${schoolFiles.length !== 1 ? 's' : ''} for ${schoolTerm || 'term'}`}
              </button>
              {!schoolUploading && schoolFiles.length > 0 && (
                <button type="button" onClick={() => setSchoolFiles([])} className={RESULT_SECONDARY_BUTTON}>Clear files</button>
              )}
            </div>

            {schoolUploading && schoolProgress.total > 0 && (
              <div className="space-y-1">
                <div className="h-2.5 rounded-full bg-[#e8d4a0] dark:bg-black/30 overflow-hidden">
                  <div className="h-full rounded-full bg-[#1a5c38] dark:bg-[#00ffff] transition-all duration-300" style={{ width: `${Math.round((schoolProgress.done / schoolProgress.total) * 100)}%` }} />
                </div>
                <p className={`text-sm font-semibold ${RESULT_HEADING}`}>Uploading… {schoolProgress.done} of {schoolProgress.total} files processed</p>
              </div>
            )}

            {schoolFiles.length > 0 && !schoolUploading && (
              <div className={`${RESULT_INNER_SURFACE} p-4`}>
                <p className={`micro-label ${RESULT_LABEL}`}>{schoolFiles.length} PDF{schoolFiles.length !== 1 ? 's' : ''} ready</p>
                <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                  {schoolFiles.map((file, index) => (
                    <p key={`${file.name}-${index}`} className={`text-xs ${RESULT_BODY} truncate`}>📄 {file.name}</p>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className={`${RESULT_SURFACE} p-6 space-y-4`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className={`micro-label ${RESULT_LABEL}`}>Results Coverage</p>
                <h3 className={`mt-2 text-xl command-title ${RESULT_HEADING}`}>Students whose results are not published</h3>
                <p className={`mt-2 text-sm ${RESULT_BODY}`}>Lists every student in the school with no published record and no uploaded result for {schoolSession || 'the session'} • {schoolTerm || 'the term'}.</p>
              </div>
              <button type="button" onClick={handleCheckUnpublished} disabled={unpublishedLoading || !schoolSession || !schoolTerm} className={RESULT_BUTTON}>
                {unpublishedLoading ? 'Checking…' : 'Check unpublished'}
              </button>
            </div>

            {unpublishedReport ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className={`${RESULT_INNER_SURFACE} p-4`}><p className={`micro-label ${RESULT_LABEL}`}>Total students</p><p className={`mt-2 text-2xl font-black ${RESULT_HEADING}`}>{unpublishedReport.totalStudents || 0}</p></div>
                  <div className={`${RESULT_INNER_SURFACE} p-4`}><p className={`micro-label ${RESULT_LABEL}`}>Published</p><p className={`mt-2 text-2xl font-black ${RESULT_HEADING}`}>{unpublishedReport.publishedCount || 0}</p></div>
                  <div className={`${RESULT_INNER_SURFACE} p-4`}><p className={`micro-label ${RESULT_LABEL}`}>Not published</p><p className={`mt-2 text-2xl font-black ${RESULT_HEADING}`}>{(unpublishedReport.missing || []).length}</p></div>
                </div>
                {(unpublishedReport.missing || []).length > 0 ? (
                  <>
                    <div className="flex justify-end">
                      <button type="button" onClick={downloadUnpublishedList} className={RESULT_SECONDARY_BUTTON}>Download CSV</button>
                    </div>
                    <div className={`${RESULT_INNER_SURFACE} p-4`}>
                      <div className="grid max-h-[28rem] grid-cols-1 gap-3 overflow-y-auto md:grid-cols-2 xl:grid-cols-3">
                        {unpublishedReport.missing.map(student => (
                          <div key={student.id} className={`${RESULT_INNER_SURFACE} p-3`}>
                            <p className={`text-sm font-semibold ${RESULT_HEADING}`}>{student.name || 'Unnamed student'}</p>
                            <p className={`mt-1 text-xs ${RESULT_BODY}`}>{student.displayId || 'No display ID'}</p>
                            <p className={`mt-1 text-xs ${RESULT_BODY}`}>{student.className || 'Unassigned'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <p className={`text-sm ${RESULT_BODY}`}>Every student has a published or uploaded result for {unpublishedReport.sessionName} • {unpublishedReport.termName}. 🎉</p>
                )}
              </div>
            ) : null}
          </section>

          {schoolReport && (
            <section className={`${RESULT_SURFACE} p-6 space-y-5`}>
              <div>
                <p className={`micro-label ${RESULT_LABEL}`}>Upload Summary</p>
                <h3 className={`mt-2 text-xl command-title ${RESULT_HEADING}`}>Matched, skipped, and missing across the school</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                <div className={`${RESULT_INNER_SURFACE} p-4`}><p className={`micro-label ${RESULT_LABEL}`}>Matched</p><p className={`mt-2 text-2xl font-black ${RESULT_HEADING}`}>{schoolReport?.summary?.matchedCount || 0}</p></div>
                <div className={`${RESULT_INNER_SURFACE} p-4`}><p className={`micro-label ${RESULT_LABEL}`}>Uploaded</p><p className={`mt-2 text-2xl font-black ${RESULT_HEADING}`}>{schoolReport?.summary?.uploadedCount || 0}</p></div>
                <div className={`${RESULT_INNER_SURFACE} p-4`}><p className={`micro-label ${RESULT_LABEL}`}>Skipped</p><p className={`mt-2 text-2xl font-black ${RESULT_HEADING}`}>{schoolReport?.summary?.skippedCount || 0}</p></div>
                <div className={`${RESULT_INNER_SURFACE} p-4`}><p className={`micro-label ${RESULT_LABEL}`}>Unmatched</p><p className={`mt-2 text-2xl font-black ${RESULT_HEADING}`}>{schoolReport?.summary?.unmatchedCount || 0}</p></div>
                <div className={`${RESULT_INNER_SURFACE} p-4`}><p className={`micro-label ${RESULT_LABEL}`}>Missing Students</p><p className={`mt-2 text-2xl font-black ${RESULT_HEADING}`}>{schoolReport?.summary?.missingStudentCount || 0}</p></div>
              </div>

              <UploadFailureList report={schoolReport} />

              {(schoolReport?.missingStudents || []).length > 0 && (
                <div className={`${RESULT_INNER_SURFACE} p-4`}>
                  <p className={`micro-label ${RESULT_LABEL}`}>Students Still Missing PDFs</p>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {schoolReport.missingStudents.map(student => (
                      <div key={student.id} className={`${RESULT_INNER_SURFACE} p-4`}>
                        <p className={`text-sm font-semibold ${RESULT_HEADING}`}>{student.name}</p>
                        <p className={`mt-2 text-xs ${RESULT_BODY}`}>{student.displayId || 'No display ID'}</p>
                        <p className={`mt-1 text-xs ${RESULT_BODY}`}>{student.className || 'Current class'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(schoolReport?.results || []).length > 0 && (
                <div className={`${RESULT_INNER_SURFACE} p-4`}>
                  <p className={`micro-label ${RESULT_LABEL}`}>File Processing Results</p>
                  <div className="mt-3 space-y-3 max-h-[28rem] overflow-y-auto">
                    {schoolReport.results.map(result => (
                      <div key={`${result.fileName}-${result.studentId || result.message || result.status}`} className={`rounded-2xl border p-4 ${getUploadResultTone(result.status)}`}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className={`text-sm font-semibold ${RESULT_HEADING}`}>{result.fileName}</p>
                          <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${getBatchTone(result.status === 'ok' ? 'published' : result.status === 'skipped' ? 'submitted' : 'draft')}`}>
                            {result.status}
                          </span>
                        </div>
                        {result.studentName && <p className={`mt-2 text-sm ${RESULT_BODY}`}>{result.studentName}</p>}
                        {result.message && <p className={`mt-2 text-xs ${RESULT_BODY}`}>{result.message}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </>
          )}
        </>
      )}
    </div>
  );
}