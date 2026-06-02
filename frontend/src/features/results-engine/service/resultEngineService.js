import {
  getResultOverview as fetchResultOverview,
  getResultRecords as fetchResultRecords,
  getResultSettings as fetchResultSettings,
  getResultSheet as fetchResultSheet,
  publishResultBatch,
  saveResultEntries,
  saveResultProfiles,
  saveResultSettings,
  updateResultBatchStatus,
  uploadResultDocuments,
} from '../../school/services/schoolApi';
import {
  buildEntryPayload,
  buildProfilePayload,
  buildSheetAnalytics,
  normalizeOverviewResponse,
  normalizeResultRecordsResponse,
  normalizeTeacherSheetResponse,
} from '../utils/resultEngineTransforms';

function resolveSelectedBatch(batches = [], filters = {}) {
  if (!Array.isArray(batches) || batches.length === 0) return null;

  const exactMatch = batches.find(batch => (
    String(batch?.classId || '') === String(filters?.classId || '')
      && String(batch?.sessionName || '') === String(filters?.sessionName || filters?.session || '')
      && String(batch?.termName || '') === String(filters?.termName || filters?.term || '')
  ));

  return exactMatch || batches[0];
}

export async function getTeacherScoreSheet(params = {}) {
  const data = await fetchResultSheet(params);
  return normalizeTeacherSheetResponse(data);
}

export async function saveTeacherScoreSheet(sheet = {}) {
  const payload = {
    classId: sheet.classId,
    sessionName: sheet.period?.sessionName,
    termName: sheet.period?.termName,
    rows: buildEntryPayload(sheet),
  };
  await saveResultEntries(payload);
  return getTeacherScoreSheet(payload);
}

export async function saveTeacherProfiles(sheet = {}) {
  const payload = {
    classId: sheet.classId,
    sessionName: sheet.period?.sessionName,
    termName: sheet.period?.termName,
    rows: buildProfilePayload(sheet),
  };
  await saveResultProfiles(payload);
  return getTeacherScoreSheet(payload);
}

export async function submitTeacherResults(sheet = {}) {
  const payload = {
    classId: sheet.classId,
    sessionName: sheet.period?.sessionName,
    termName: sheet.period?.termName,
    status: 'submitted',
  };
  await updateResultBatchStatus(payload);
  return getTeacherScoreSheet(payload);
}

export async function reopenTeacherResults(sheet = {}) {
  const payload = {
    classId: sheet.classId,
    sessionName: sheet.period?.sessionName,
    termName: sheet.period?.termName,
    status: 'draft',
  };
  await updateResultBatchStatus(payload);
  return getTeacherScoreSheet(payload);
}

export async function approvePublishedResults(sheet = {}) {
  const payload = {
    classId: sheet.classId,
    sessionName: sheet.period?.sessionName,
    termName: sheet.period?.termName,
  };
  await publishResultBatch(payload);
  return getTeacherScoreSheet(payload);
}

export async function getStudentResult(studentId = '') {
  const data = await fetchResultRecords(studentId);
  return normalizeResultRecordsResponse(data);
}

export async function getParentResult(studentId = '') {
  return getStudentResult(studentId);
}

export async function getResultSettings() {
  return fetchResultSettings();
}

export async function saveResultConfiguration(payload = {}) {
  return saveResultSettings(payload);
}

export async function getHoSResultAnalytics(filters = {}, classMap = {}) {
  const overview = normalizeOverviewResponse(await fetchResultOverview(), classMap);
  const requestedBatch = filters?.classId && filters?.sessionName && filters?.termName
    ? {
        classId: String(filters.classId || ''),
        sessionName: String(filters.sessionName || filters.session || ''),
        termName: String(filters.termName || filters.term || ''),
        className: classMap[String(filters.classId || '')] || String(filters.classId || ''),
        label: `${classMap[String(filters.classId || '')] || String(filters.classId || 'Class')} • ${filters.sessionName || filters.session || 'Session'} • ${filters.termName || filters.term || 'Term'}`,
        status: 'draft',
      }
    : null;
  const selectedBatch = resolveSelectedBatch(overview.batches, filters) || requestedBatch;

  if (!selectedBatch) {
    return {
      ...overview,
      selectedBatch: null,
      sheet: null,
      broadsheet: [],
      classAverage: 0,
      passRate: 0,
      atRiskCount: 0,
      attendanceAverage: 0,
      subjectPerformance: [],
    };
  }

  const sheet = await getTeacherScoreSheet({
    classId: selectedBatch.classId,
    sessionName: selectedBatch.sessionName,
    termName: selectedBatch.termName,
  });

  return {
    ...overview,
    selectedBatch,
    sheet,
    broadsheet: sheet.broadsheet,
    ...buildSheetAnalytics(sheet),
  };
}

export async function getOwnerResultAnalytics(filters = {}, classMap = {}) {
  const data = await getHoSResultAnalytics(filters, classMap);
  const publishedBatches = data.batches.filter(batch => String(batch?.status || '') === 'published').length;
  return {
    ...data,
    campuses: data.batches.map(batch => ({
      name: batch.className,
      average: batch.classId === data.selectedBatch?.classId ? data.classAverage : 0,
      passRate: batch.classId === data.selectedBatch?.classId ? data.passRate : 0,
      attendance: batch.classId === data.selectedBatch?.classId ? data.attendanceAverage : 0,
    })),
    globalAverage: data.classAverage,
    globalPassRate: data.passRate,
    publishedBatches,
  };
}

export async function uploadPublishedResultDocuments(payload = {}) {
  return uploadResultDocuments(payload.files || [], {
    classId: payload.classId,
    sessionName: payload.sessionName,
    termName: payload.termName,
    fileStudentMap: payload.fileStudentMap ? JSON.stringify(payload.fileStudentMap) : '',
  });
}

// Upload large PDF batches one chunk after another (sequential) so very large sets — up to thousands
// of files — never go out in a single oversized request. Reports are merged and progress is reported.
export async function uploadPublishedResultDocumentsSequential(payload = {}, options = {}) {
  const files = Array.isArray(payload.files) ? payload.files : [];
  const chunkSize = Math.max(1, Number(options.chunkSize || 5));
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
  const fileStudentMap = payload.fileStudentMap || {};

  const merged = {
    success: true,
    hasBlockingIssues: false,
    summary: { matchedCount: 0, manualMappedCount: 0, uploadedCount: 0, skippedCount: 0, unmatchedCount: 0, missingStudentCount: 0 },
    results: [],
    missingStudents: [],
  };

  if (files.length === 0) {
    onProgress(0, 0);
    return merged;
  }

  let processed = 0;
  for (let index = 0; index < files.length; index += chunkSize) {
    const chunk = files.slice(index, index + chunkSize);
    const chunkMap = {};
    chunk.forEach(file => {
      const key = `${file?.name || 'result.pdf'}::${file?.size || 0}`;
      if (fileStudentMap[key]) chunkMap[key] = fileStudentMap[key];
    });

    // eslint-disable-next-line no-await-in-loop
    const report = await uploadPublishedResultDocuments({
      classId: payload.classId,
      sessionName: payload.sessionName,
      termName: payload.termName,
      files: chunk,
      fileStudentMap: chunkMap,
    });

    const summary = report?.summary || {};
    ['matchedCount', 'manualMappedCount', 'uploadedCount', 'skippedCount', 'unmatchedCount'].forEach(key => {
      merged.summary[key] += Number(summary[key] || 0);
    });
    if (Array.isArray(report?.results)) merged.results.push(...report.results);
    if (report?.hasBlockingIssues) merged.hasBlockingIssues = true;
    // The backend computes missing students against persisted documents, so the latest chunk's
    // list reflects who is still outstanding after everything uploaded so far.
    if (Array.isArray(report?.missingStudents)) {
      merged.missingStudents = report.missingStudents;
      merged.summary.missingStudentCount = report.missingStudents.length;
    }

    processed += chunk.length;
    onProgress(processed, files.length);
  }

  return merged;
}