import React, { useCallback, useEffect, useState } from 'react';
import { getClasses, getSession } from '../../school/services/schoolApi';
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
  // Bulk upload mode: 'class' (one selected batch) or 'school' (every batch queued).
  const [uploadMode, setUploadMode] = useState('class');
  // School-wide upload queue
  const [schoolQueue, setSchoolQueue] = useState([]); // [{ batch, files, status, progress, report }]
  const [queueRunning, setQueueRunning] = useState(false);
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
        { chunkSize: 5, onProgress: (done, total) => setUploadProgress({ done, total }) },
      );
      setUploadReport(response || null);
      setFiles([]);
      setFileStudentMap({});
      if (response?.hasBlockingIssues) {
        setError('Some PDFs could not be matched. Matched PDFs were uploaded, duplicates were skipped, and the missing students list is shown below.');
        if (response?.summary?.uploadedCount || response?.summary?.skippedCount) {
          setMessage(`${response.summary?.uploadedCount || 0} PDFs uploaded and ${response.summary?.skippedCount || 0} skipped.`);
        }
      } else {
        setMessage(`Upload complete. ${response?.summary?.uploadedCount || 0} PDFs uploaded and ${response?.summary?.skippedCount || 0} skipped.`);
      }
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
                onClick={() => {
                  setUploadMode('school');
                  setSchoolQueue(prev => (prev.length ? prev : selectableBatches.map(b => ({ batch: b, files: [], status: 'idle', progress: 0, report: null }))));
                }}
                className={uploadMode === 'school' ? RESULT_BUTTON : RESULT_SECONDARY_BUTTON}
              >
                Whole School
              </button>
            </div>
            <p className={`mt-2 text-sm ${RESULT_BODY}`}>
              {uploadMode === 'class'
                ? 'Pick one class / session / term, then upload its result PDFs. Each PDF is matched to a student one after another, PDFs already uploaded for that term are skipped as duplicates, and any unmatched students are listed afterward.'
                : 'Add PDFs to each class below, then upload them one batch after another with a live progress bar. PDFs already uploaded for a term are skipped automatically.'}
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
                      <p className={`text-xs ${RESULT_BODY}`}>Uploaded {uploadProgress.done} of {uploadProgress.total} PDFs (one batch after another)…</p>
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
          <section className={`${RESULT_SURFACE} p-6 space-y-2`}>
            <p className={`micro-label ${RESULT_LABEL}`}>School-Wide Upload</p>
            <h2 className={`text-2xl command-title ${RESULT_HEADING}`}>Queue result PDFs for the whole school</h2>
            <p className={`text-sm ${RESULT_BODY}`}>
              Add PDFs to each class batch below. When ready, click <strong>Start Upload Queue</strong> — each batch uploads in order while the progress bar updates live. Already-uploaded PDFs are skipped automatically.
            </p>
          </section>

          {/* Queue cards — one per batch */}
          <div className="space-y-4">
            {schoolQueue.map((item, idx) => {
              const statusColors = {
                idle: '',
                uploading: 'border-amber-400/50 bg-amber-50/60 dark:bg-amber-500/10',
                done: 'border-emerald-400/50 bg-emerald-50/60 dark:bg-emerald-500/10',
                error: 'border-rose-400/50 bg-rose-50/60 dark:bg-rose-500/10',
              };
              return (
                <section key={buildBatchKey(item.batch)} className={`${RESULT_SURFACE} p-5 space-y-4 ${statusColors[item.status] || ''}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className={`micro-label ${RESULT_LABEL}`}>{item.batch.label}</p>
                      <p className={`mt-1 text-xs ${RESULT_BODY}`}>{item.files.length} PDF{item.files.length !== 1 ? 's' : ''} queued</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.status === 'done' && <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-widest">✓ Done</span>}
                      {item.status === 'error' && <span className="text-rose-600 dark:text-rose-400 text-xs font-bold uppercase tracking-widest">✗ Error</span>}
                      {item.status === 'uploading' && <span className="text-amber-700 dark:text-amber-300 text-xs font-bold uppercase tracking-widest animate-pulse">Uploading…</span>}
                      {!queueRunning && item.status === 'idle' && (
                        <label className={`${RESULT_SECONDARY_BUTTON} cursor-pointer text-xs`}>
                          + Add PDFs
                          <input
                            type="file"
                            multiple
                            accept="application/pdf,.pdf"
                            className="sr-only"
                            onChange={e => {
                              const chosen = Array.from(e.target.files || []);
                              setSchoolQueue(prev => prev.map((q, i) => i === idx ? { ...q, files: [...q.files, ...chosen] } : q));
                            }}
                          />
                        </label>
                      )}
                      {!queueRunning && item.status === 'idle' && item.files.length > 0 && (
                        <button type="button" className={`${RESULT_SECONDARY_BUTTON} text-xs`}
                          onClick={() => setSchoolQueue(prev => prev.map((q, i) => i === idx ? { ...q, files: [] } : q))}>
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Animated progress bar */}
                  {(item.status === 'uploading' || item.status === 'done' || item.status === 'error') && (
                    <div className="space-y-1">
                      <div className="h-2.5 rounded-full bg-[#e8d4a0] dark:bg-black/30 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${item.status === 'done' ? 'bg-emerald-500 dark:bg-emerald-400' : item.status === 'error' ? 'bg-rose-500' : 'bg-amber-500 dark:bg-amber-400 animate-pulse'}`}
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                      <p className={`text-xs ${RESULT_BODY}`}>{item.progress}%</p>
                    </div>
                  )}

                  {/* File list preview */}
                  {item.files.length > 0 && item.status === 'idle' && (
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {item.files.map((f, fi) => (
                        <p key={`${f.name}-${fi}`} className={`text-xs ${RESULT_BODY} truncate`}>📄 {f.name}</p>
                      ))}
                    </div>
                  )}

                  {/* Per-batch report */}
                  {item.report && (
                    <div className={`${RESULT_INNER_SURFACE} p-3 text-xs space-y-1`}>
                      <p className={RESULT_LABEL}>Uploaded {item.report.summary?.uploadedCount || 0} · Skipped {item.report.summary?.skippedCount || 0} · Unmatched {item.report.summary?.unmatchedCount || 0}</p>
                      {(item.report.missingStudents || []).length > 0 && (
                        <p className={RESULT_BODY}>Missing: {item.report.missingStudents.map(s => s.name).join(', ')}</p>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          {/* Queue controls */}
          <section className={`${RESULT_SURFACE} p-5`}>
            {(() => {
              const totalFiles = schoolQueue.reduce((s, q) => s + q.files.length, 0);
              const batchesWithFiles = schoolQueue.filter(q => q.files.length > 0 && q.status === 'idle');
              const doneCount = schoolQueue.filter(q => q.status === 'done').length;
              const totalQueued = schoolQueue.filter(q => q.files.length > 0 || q.status === 'done').length;
              const overallPct = totalQueued > 0 ? Math.round((doneCount / totalQueued) * 100) : 0;

              return (
                <div className="space-y-4">
                  {queueRunning && (
                    <div className="space-y-1">
                      <p className={`text-sm font-semibold ${RESULT_HEADING}`}>Overall progress — {doneCount} of {totalQueued} batches complete</p>
                      <div className="h-3 rounded-full bg-[#e8d4a0] dark:bg-black/30 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#1a5c38] dark:bg-[#00ffff] transition-all duration-700"
                          style={{ width: `${overallPct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3 items-center">
                    <button
                      type="button"
                      disabled={queueRunning || batchesWithFiles.length === 0}
                      className={RESULT_BUTTON}
                      onClick={async () => {
                        setQueueRunning(true);
                        for (let i = 0; i < schoolQueue.length; i++) {
                          const item = schoolQueue[i];
                          if (item.files.length === 0 || item.status !== 'idle') continue;
                          setSchoolQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'uploading', progress: 0 } : q));
                          try {
                            // Upload this batch's PDFs sequentially (chunked) with real progress.
                            // eslint-disable-next-line no-await-in-loop
                            const report = await uploadPublishedResultDocumentsSequential(
                              { ...item.batch, files: item.files, fileStudentMap: {} },
                              {
                                chunkSize: 5,
                                onProgress: (done, total) => {
                                  const pct = total > 0 ? Math.round((done / total) * 100) : 100;
                                  setSchoolQueue(prev => prev.map((q, idx) => idx === i ? { ...q, progress: pct } : q));
                                },
                              },
                            );
                            setSchoolQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'done', progress: 100, report: report || null } : q));
                          } catch {
                            setSchoolQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'error', progress: 100 } : q));
                          }
                        }
                        setQueueRunning(false);
                        loadConsole(selectedBatchKey, classMap);
                      }}
                    >
                      {queueRunning ? 'Uploading…' : `Start Upload Queue (${batchesWithFiles.length} batch${batchesWithFiles.length !== 1 ? 'es' : ''} · ${totalFiles} file${totalFiles !== 1 ? 's' : ''})`}
                    </button>

                    {!queueRunning && (
                      <button
                        type="button"
                        className={RESULT_SECONDARY_BUTTON}
                        onClick={() => setSchoolQueue(selectableBatches.map(b => ({ batch: b, files: [], status: 'idle', progress: 0, report: null })))}
                      >
                        Reset Queue
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </section>
        </>
          )}
        </>
      )}
    </div>
  );
}