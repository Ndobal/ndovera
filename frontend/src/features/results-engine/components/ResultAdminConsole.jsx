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

export default function ResultAdminConsole({ analyticsMode = 'hos', roleTitle = 'Academic Result Console' }) {
  const [classMap, setClassMap] = useState({});
  const [selectedBatchKey, setSelectedBatchKey] = useState('');
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('console');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState([]);
  const [fileStudentMap, setFileStudentMap] = useState({});
  const [uploadReport, setUploadReport] = useState(null);
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

  const batchOptions = Array.isArray(data?.batches) ? data.batches : [];
  const selectedBatch = batchOptions.find(batch => buildBatchKey(batch) === selectedBatchKey) || data?.selectedBatch || null;
  const caComponents = Array.isArray(data?.settings?.metadata?.caComponents) ? data.settings.metadata.caComponents : [];
  const scoreModel = readScoreModel(data?.settings || {});
  const recentBatchDocuments = filterRecentDocumentsForBatch(data?.recentDocuments || [], selectedBatch);

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
    setError('');
    setMessage('');
    try {
      const response = await uploadPublishedResultDocuments({ ...selectedBatch, files, fileStudentMap });
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
        <p className={`mt-2 ${RESULT_BODY}`}>CA score sheets remain the source of truth. Published records inherit the configured template, grading scale, affective setup, and CA component grid.</p>
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
            {data.canUploadDocuments && (
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={activeTab === 'upload' ? RESULT_BUTTON : RESULT_SECONDARY_BUTTON}
              >
                Bulk PDF Upload
              </button>
            )}
          </div>
        </section>
      )}

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
                {batchOptions.map(batch => (
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
        </>
      )}

      {activeTab === 'upload' && (
        <>
          <section className={`${RESULT_SURFACE} p-6 space-y-5`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className={`micro-label ${RESULT_LABEL}`}>Bulk Result Upload</p>
                <h2 className={`mt-2 text-2xl command-title ${RESULT_HEADING}`}>Upload full result PDFs for a selected batch</h2>
                <p className={`mt-2 text-sm ${RESULT_BODY}`}>Use the student name and surname, display ID, student ID, or email in each PDF filename. Already uploaded PDFs are skipped automatically.</p>
              </div>
              <select
                value={selectedBatchKey}
                onChange={event => setSelectedBatchKey(event.target.value)}
                className={`${RESULT_INPUT} min-w-[280px]`}
              >
                {batchOptions.map(batch => (
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

                  {files.length > 0 && (
                    <div className={`${RESULT_INNER_SURFACE} p-4`}>
                      <p className={`micro-label ${RESULT_LABEL}`}>Selected Files</p>
                      <p className={`mt-2 text-sm ${RESULT_BODY}`}>{files.length} PDFs ready for matching and upload.</p>
                      <div className="mt-3 space-y-2 max-h-56 overflow-y-auto">
                        {files.map(file => (
                          <div key={`${file.name}-${file.size}`} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-100 space-y-2">
                            <p>{file.name}</p>
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
                <p className={`text-sm ${RESULT_BODY}`}>Select a class, session, and term batch before uploading PDFs.</p>
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
                      <div key={student.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
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
    </div>
  );
}