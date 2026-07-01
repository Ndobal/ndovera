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

export async function getResultSettings(section = '') {
  return fetchResultSettings(section);
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
    summary: { matchedCount: 0, manualMappedCount: 0, uploadedCount: 0, skippedCount: 0, unmatchedCount: 0, failedCount: 0, missingStudentCount: 0 },
    results: [],
    missingStudents: [],
  };

  if (files.length === 0) {
    onProgress(0, 0);
    return merged;
  }

  // Adaptive throttle: if the Worker pushes back (e.g. 503 after a burst of uploads), we slow the
  // remaining chunks down so the run keeps going instead of failing the rest.
  let cooldownMs = 250;

  // Retry a chunk several times with growing backoff before giving up, so transient 503s recover
  // and one hiccup never aborts the whole run — failed files are reported and the rest keep going.
  async function uploadChunkWithRetry(chunk, chunkMap) {
    let lastError = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop
        return await uploadPublishedResultDocuments({
          classId: payload.classId,
          sessionName: payload.sessionName,
          termName: payload.termName,
          files: chunk,
          fileStudentMap: chunkMap,
        });
      } catch (error) {
        lastError = error;
        cooldownMs = Math.min(cooldownMs + 600, 4000);
        // eslint-disable-next-line no-await-in-loop
        if (attempt < 4) await new Promise(resolve => setTimeout(resolve, Math.min(1200 * (attempt + 1), 8000)));
      }
    }
    throw lastError || new Error('Upload failed.');
  }

  let processed = 0;
  for (let index = 0; index < files.length; index += chunkSize) {
    const chunk = files.slice(index, index + chunkSize);
    const chunkMap = {};
    chunk.forEach(file => {
      const key = `${file?.name || 'result.pdf'}::${file?.size || 0}`;
      if (fileStudentMap[key]) chunkMap[key] = fileStudentMap[key];
    });

    let report = null;
    try {
      // eslint-disable-next-line no-await-in-loop
      report = await uploadChunkWithRetry(chunk, chunkMap);
    } catch (error) {
      // Whole chunk failed after retries — mark each file failed with the reason and continue.
      const reason = (error && error.message) ? error.message : 'Upload failed after several tries. Please re-upload these files.';
      chunk.forEach(file => merged.results.push({ fileName: file?.name || 'result.pdf', status: 'error', message: reason }));
      merged.summary.failedCount += chunk.length;
      merged.hasBlockingIssues = true;
      processed += chunk.length;
      onProgress(processed, files.length);
      continue;
    }

    const summary = report?.summary || {};
    ['matchedCount', 'manualMappedCount', 'uploadedCount', 'skippedCount', 'unmatchedCount'].forEach(key => {
      merged.summary[key] += Number(summary[key] || 0);
    });
    if (Array.isArray(report?.results)) {
      merged.results.push(...report.results);
      merged.summary.failedCount += report.results.filter(result => result?.status === 'error').length;
    }
    if (report?.hasBlockingIssues) merged.hasBlockingIssues = true;
    // The backend computes missing students against persisted documents, so the latest chunk's
    // list reflects who is still outstanding after everything uploaded so far.
    if (Array.isArray(report?.missingStudents)) {
      merged.missingStudents = report.missingStudents;
      merged.summary.missingStudentCount = report.missingStudents.length;
    }

    processed += chunk.length;
    onProgress(processed, files.length);

    // Breather between chunks (grows if the server pushed back) so sustained uploads don't 503.
    if (index + chunkSize < files.length) {
      const waitMs = cooldownMs;
      // eslint-disable-next-line no-await-in-loop
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }

  merged.success = !merged.hasBlockingIssues;
  return merged;
}