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
  const selectedBatch = resolveSelectedBatch(overview.batches, filters);

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