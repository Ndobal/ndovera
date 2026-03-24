import { fetchWithAuth } from '../../../services/apiClient';

export type ClassroomFeedReply = {
  id: string;
  author: string;
  role: string;
  text: string;
};

export type ClassroomFeedComment = {
  id: string;
  author: string;
  role: string;
  text: string;
  likes: number;
  replies: ClassroomFeedReply[];
};

export type ClassroomFeedAttachment = {
  type: 'image' | 'audio' | 'video';
  url: string;
  name: string;
  storageKey?: string;
  localPreviewUrl?: string;
  thumbnailUrl?: string;
  transcript?: string;
  durationSeconds?: number;
};

export type ClassroomMaterialViewerType = 'image' | 'audio' | 'video' | 'pdf' | 'document' | 'slides' | 'ndovera-document' | 'mixed';

export type ClassroomMaterialAssetType = Exclude<ClassroomMaterialViewerType, 'mixed'>;

export type ClassroomMaterialAsset = {
  id: string;
  name: string;
  url?: string;
  embedUrl?: string;
  externalProvider?: 'youtube';
  storageKey?: string;
  mimeType: string;
  size: number;
  extension?: string;
  assetType: Exclude<ClassroomMaterialAssetType, 'ndovera-document'>;
  viewerType: Exclude<ClassroomMaterialViewerType, 'mixed' | 'ndovera-document'>;
  youtubeVideoId?: string;
};

export type ClassroomCreatedDocumentBlock = {
  id: string;
  type: 'paragraph' | 'bullet-list' | 'quote';
  text?: string;
  items?: string[];
};

export type ClassroomCreatedDocument = {
  title?: string;
  subtitle?: string;
  blocks: ClassroomCreatedDocumentBlock[];
};

export type LessonNoteApprovalStatus = 'Draft' | 'Submitted' | 'Head of Section signed' | 'HOS signed' | 'Approved';

export type LessonNoteSignature = {
  signedBy: string;
  signedAt: string;
  roleLabel: string;
};

export type LessonNoteSignatureTarget = 'headOfSection' | 'hos';

export type LessonNoteSignatureResult = {
  note: ClassroomNote;
  appliedSignature: LessonNoteSignatureTarget;
  signerRoleLabel: LessonNoteSignature['roleLabel'];
};

export type LessonNoteApproval = {
  status: LessonNoteApprovalStatus;
  submittedAt?: string;
  submittedBy?: string;
  className?: string;
  classSection?: string;
  headOfSection?: LessonNoteSignature | null;
  hos?: LessonNoteSignature | null;
};

export type ClassroomChunkUploadPayload = {
  chunk: Blob;
  fileName: string;
  index: number;
  mimeType: string;
  sessionId: string;
  type: 'audio' | 'video';
};

export type ClassroomChunkCompletePayload = {
  fileName: string;
  mimeType: string;
  sessionId: string;
  type: 'audio' | 'video';
};

export type ClassroomFeedPost = {
  id: string;
  author: string;
  role: string;
  time: string;
  body: string;
  pinned?: boolean;
  attachments?: ClassroomFeedAttachment[];
  viewerReaction?: string | null;
  likes: number;
  dislikes: number;
  comments: ClassroomFeedComment[];
};

export type ClassroomAssignmentSubmissionSummary = {
  id: string;
  studentId: string;
  studentName: string;
  status: string;
  submittedAt?: string;
  updatedAt?: string;
};

export type AssignmentSection = {
  type: string;
  title: string;
  instructions?: string;
  prompt?: string;
  questions?: Array<{ no: number; stem: string; options: string[]; answer?: string }>;
  left?: string[];
  right?: string[];
};

export type AssignmentComment = {
  id: string;
  author: string;
  text: string;
  likes: number;
};

export type AssignmentThreadMessage = {
  id: string;
  from: string;
  text: string;
};

export type ClassroomAssignment = {
  id: string;
  title: string;
  subject: string;
  className: string;
  due: string;
  status: string;
  allowComments: boolean;
  allowTeacherChat: boolean;
  score: string;
  teacherFeedback: string;
  types: string[];
  shuffledNotice: string;
  sections: AssignmentSection[];
  comments: AssignmentComment[];
  privateThread: AssignmentThreadMessage[];
  submission?: {
    id: string;
    status: string;
    answers: Record<string, string>;
    submittedAt?: string;
    updatedAt?: string;
  } | null;
  submissionList?: ClassroomAssignmentSubmissionSummary[];
};

export type ClassroomNote = {
  id: string;
  title: string;
  subject: string;
  topic: string;
  className?: string;
  classSection?: string;
  week: number;
  format: string;
  visibility: string;
  duration: string;
  summary: string;
  access: string;
  analytics: {
    views: number;
    downloads: number;
    completion: string;
  };
  versions: string[];
  viewerType?: ClassroomMaterialViewerType;
  mimeType?: string | null;
  fileName?: string | null;
  materials?: ClassroomMaterialAsset[];
  ndoveraDocument?: ClassroomCreatedDocument | null;
  approval?: LessonNoteApproval;
};

export type ClassroomSubject = {
  id: string;
  name: string;
  code: string;
  section?: string;
  classId?: string;
  className?: string;
  teacherId?: string;
  teacherName?: string;
  room?: string;
  accent: string;
  summary: string;
  studentCount: number;
  noteCount: number;
  assignmentCount: number;
  curriculum?: {
    term1: Array<{ id: string; title: string; isTreated: boolean }>;
    term2: Array<{ id: string; title: string; isTreated: boolean }>;
    term3: Array<{ id: string; title: string; isTreated: boolean }>;
  };
};

export type SchoolClass = {
  id: string;
  name: string;
  level?: string;
  section?: string;
  hierarchyTag?: string;
  hierarchyIndex?: number;
  nextHierarchyTag?: string;
  aliasNames?: string[];
  isDefault?: boolean;
  isOptional?: boolean;
  graduatesToAlumniWhenFinal?: boolean;
  teacherId?: string;
  teacherName?: string;
  teacher_name?: string;
  youtube_playlist_id?: string;
  youtube_playlist_url?: string;
  youtube_playlist_synced_at?: string;
  youtubePlaylistId?: string;
  youtubePlaylistUrl?: string;
  youtubePlaylistSyncedAt?: string;
};

// Fetch the full class stream so new users can still see older posts.
export async function getClassroomFeed() {
  return fetchWithAuth('/api/classroom/feed') as Promise<ClassroomFeedPost[]>;
}

export type PracticeQuestion = {
  id: string;
  stem: string;
  options: string[];
  answer: string;
  explanation?: string;
  hint?: string;
  answerSource?: 'provided' | 'assisted';
};

export type PracticeSet = {
  id: string;
  source: string;
  scope: string;
  visibility?: 'global' | 'school';
  subject: string;
  title: string;
  level?: string;
  mode?: string;
  reward?: string;
  questions: number;
  note: string;
  examFamily?: string;
  classBand?: string;
  tags?: string[];
  updatedAt?: string;
  questionItems: PracticeQuestion[];
};

export type ResultTerm = {
  name: string;
  allowPosition?: boolean;
  summary: {
    average: string;
    grade: string;
    position: string;
    attendance: string;
    teacherRemark: string;
    principalRemark: string;
    promotion: string;
    teacherSignature?: string;
    sectionalRemark?: string;
    sectionalSignature?: string;
    principalSignature?: string;
  };
  subjects: Array<{ subject: string; ca: number; exam: number; total: number; grade: string; remark: string }>;
  trend?: string[];
  pageTwo?: {
    variant: 'none' | 'nursery-progress' | 'grade-cognitive';
    affectiveTraits: string[];
    physical?: {
      height?: number | null;
      weight?: number | null;
    };
    nurseryProgressSections?: Array<{
      id: string;
      title: string;
      items: Array<{ no: string; text: string; status: 'not_yet' | 'progressing' | 'yes' }>;
    }>;
    gradeCognitiveSections?: Array<{
      id: string;
      title: string;
      items?: Array<{ label: string; rating: number }>;
      content?: Array<{ sub: string; items: Array<{ label: string; rating: number }> }>;
    }>;
  };
};

export type ResultSession = {
  session: string;
  feeStatus: string;
  outstanding: string;
  terms: ResultTerm[];
};

export type StudentResultRecord = {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  classSection?: string;
  sessions: ResultSession[];
  updatedAt: string;
};

export type ResultDocumentRecord = {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  sourceName: string;
  session?: string;
  term?: string;
  mimeType: string;
  url: string;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: string;
  matchedBy: 'student-id' | 'email' | 'ndovera-id' | 'filename' | 'name';
};

export type HistoryMappedUser = {
  ref: string;
  matchedUserId?: string;
  matchedStudentId?: string;
  matchedBy?: 'student-id' | 'user-id' | 'email' | 'alias' | 'name';
  targetCategory?: 'student' | 'staff' | 'parent' | 'admin' | 'alumni' | 'unknown';
  status: 'mapped' | 'unmatched';
  rowNumber?: number;
  payload?: Record<string, string>;
};

export type HistoryAssetRecord = {
  id: string;
  schoolId: string;
  uploadedBy: string;
  uploadedByName: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  url: string;
  sourceType: 'csv' | 'xlsx' | 'pdf' | 'doc' | 'docx';
  historyKind: 'old-results' | 'alumni' | 'admission-register' | 'legacy-directory' | 'staff-history' | 'parent-history' | 'general-history';
  status: 'processed' | 'manual-review';
  mappedUsers: HistoryMappedUser[];
  createdAt: string;
};

export type MigrationMappedUser = HistoryMappedUser;
export type MigrationAssetRecord = HistoryAssetRecord;

export type LiveClassSession = {
  id: string;
  title: string;
  mode: string;
  schedule: string;
  duration: string;
  attendees: number;
  limit: number;
  hosts: string[];
  tools: string[];
  note: string;
  meetingUrl?: string;
};

export type LiveClassRecordingUploadResponse = {
  ok: boolean;
  url: string;
  embedUrl?: string;
  externalProvider?: 'youtube';
  youtubeVideoId?: string;
};

export type SchoolYoutubeStatus = {
  connected: boolean;
  configured: boolean;
  school?: {
    id: string;
    name: string;
    refreshToken?: string | null;
    channelId?: string | null;
    connectedAt?: string | null;
    connectedBy?: string | null;
  } | null;
};

export type YoutubeVideoRecord = {
  id: string;
  school_id: string;
  class_id?: string | null;
  source_type: string;
  source_record_id?: string | null;
  title: string;
  description?: string | null;
  youtube_video_id: string;
  youtube_url: string;
  youtube_embed_url: string;
  playlist_id?: string | null;
  playlist_item_id?: string | null;
  asset_type?: string | null;
  created_by?: string | null;
  created_at?: string;
  deleted_at?: string | null;
};

export async function createClassroomPost(body: { body: string; attachments?: ClassroomFeedAttachment[] }) {
  return fetchWithAuth('/api/classroom/feed', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function getSubjectClassroomFeed(subjectId: string) {
  return fetchWithAuth(`/api/classroom/subjects/${encodeURIComponent(subjectId)}/feed`) as Promise<any[]>;
}

export async function createSubjectClassroomPost(subjectId: string, body: { body: string; attachments?: ClassroomFeedAttachment[] }) {
  return fetchWithAuth(`/api/classroom/subjects/${encodeURIComponent(subjectId)}/feed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function uploadClassroomAsset(formData: FormData) {
  return fetchWithAuth('/api/uploads/classroom-asset', {
    method: 'POST',
    body: formData,
  }) as Promise<{ ok: boolean; url: string; storageKey?: string; embedUrl?: string; externalProvider?: 'youtube'; youtubeVideoId?: string; name: string; mimeType: string; size: number; assetType: Exclude<ClassroomMaterialAssetType, 'ndovera-document'>; viewerType: Exclude<ClassroomMaterialViewerType, 'mixed' | 'ndovera-document'> }>;
}

export async function uploadClassroomAssetChunk(payload: ClassroomChunkUploadPayload) {
  const formData = new FormData();
  formData.append('chunk', payload.chunk, `${payload.sessionId}-${payload.index}.part`);
  formData.append('fileName', payload.fileName);
  formData.append('index', String(payload.index));
  formData.append('mimeType', payload.mimeType);
  formData.append('sessionId', payload.sessionId);
  formData.append('type', payload.type);
  return fetchWithAuth('/api/upload-chunk', {
    method: 'POST',
    body: formData,
  }) as Promise<{ ok: boolean; index: number; sessionId: string }>;
}

export async function finalizeClassroomChunkUpload(payload: ClassroomChunkCompletePayload) {
  return fetchWithAuth('/api/upload-chunk/complete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }) as Promise<{ ok: boolean; url: string; storageKey?: string; embedUrl?: string; externalProvider?: 'youtube'; youtubeVideoId?: string; name: string; mimeType: string; size: number }>;
}

export async function uploadLiveClassRecording(recording: File, metadata?: { title?: string; description?: string; classId?: string }) {
  const formData = new FormData();
  formData.append('recording', recording, recording.name);
  if (metadata?.title) formData.append('title', metadata.title);
  if (metadata?.description) formData.append('description', metadata.description);
  if (metadata?.classId) formData.append('class_id', metadata.classId);
  return fetchWithAuth('/api/uploads/live-class-recording', {
    method: 'POST',
    body: formData,
  }) as Promise<LiveClassRecordingUploadResponse>;
}

export async function getSchoolYoutubeStatus() {
  return fetchWithAuth('/api/youtube/status') as Promise<SchoolYoutubeStatus>;
}

export async function getSchoolYoutubeAuthUrl(redirect?: string) {
  const query = redirect ? `?redirect=${encodeURIComponent(redirect)}` : '';
  return fetchWithAuth(`/api/youtube/oauth-url${query}`) as Promise<{ url: string }>;
}

export async function disconnectSchoolYoutube() {
  return fetchWithAuth('/api/youtube/disconnect', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  }) as Promise<{ ok: boolean }>;
}

export async function listSchoolYoutubeVideos(classId?: string) {
  const query = classId ? `?classId=${encodeURIComponent(classId)}` : '';
  return fetchWithAuth(`/api/youtube/videos${query}`) as Promise<{ videos: YoutubeVideoRecord[] }>;
}

export async function deleteSchoolYoutubeVideo(videoRecordId: string) {
  return fetchWithAuth(`/api/youtube/videos/${encodeURIComponent(videoRecordId)}`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
  }) as Promise<{ ok: boolean }>;
}

export async function ensureClassYoutubePlaylist(classId: string) {
  return fetchWithAuth(`/api/classes/${encodeURIComponent(classId)}/youtube-playlist`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  }) as Promise<{ ok: boolean; playlistId: string; playlistUrl: string }>;
}

export async function addClassroomComment(postId: string, body: { text: string; parentCommentId?: string }) {
  return fetchWithAuth(`/api/classroom/feed/${postId}/comments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function addClassroomReaction(postId: string, body: { emoji: string }) {
  return fetchWithAuth(`/api/classroom/feed/${postId}/reactions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function pinClassroomPost(postId: string, body: { pinned: boolean }) {
  return fetchWithAuth(`/api/classroom/feed/${postId}/pin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function getClassroomAssignments() {
  return fetchWithAuth('/api/classroom/assignments') as Promise<ClassroomAssignment[]>;
}

export async function createClassroomAssignment(body: { title: string; subject: string; className: string; due: string }) {
  return fetchWithAuth('/api/classroom/assignments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function addAssignmentComment(assignmentId: string, body: { text: string }) {
  return fetchWithAuth(`/api/classroom/assignments/${assignmentId}/comments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function addAssignmentPrivateMessage(assignmentId: string, body: { text: string }) {
  return fetchWithAuth(`/api/classroom/assignments/${assignmentId}/private-thread`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function saveAssignmentSubmission(assignmentId: string, body: { answers: Record<string, string>; status: 'Draft' | 'Submitted' }) {
  return fetchWithAuth(`/api/classroom/assignments/${assignmentId}/submission`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function getClassroomNotes() {
  return fetchWithAuth('/api/classroom/notes') as Promise<ClassroomNote[]>;
}

export async function getSchoolClasses() {
  return fetchWithAuth('/api/classes') as Promise<SchoolClass[]>;
}

export async function createSchoolClass(body: { name: string; level?: string; section?: string; teacher_id?: string }) {
  return fetchWithAuth('/api/classes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function updateSchoolClass(classId: string, body: { name?: string; level?: string; section?: string; teacher_id?: string }) {
  return fetchWithAuth(`/api/classes/${encodeURIComponent(classId)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function deleteSchoolClass(classId: string) {
  return fetchWithAuth(`/api/classes/${encodeURIComponent(classId)}`, {
    method: 'DELETE',
  });
}

export async function getClassroomSubjects() {
  return fetchWithAuth('/api/classroom/subjects') as Promise<ClassroomSubject[]>;
}

export async function createClassroomSubject(body: { name: string; code?: string; section?: string; classId?: string; className?: string; accent?: string; summary?: string; room?: string; studentIds?: string[] }) {
  return fetchWithAuth('/api/classroom/subjects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function updateClassroomSubject(subjectId: string, body: { name?: string; code?: string; section?: string; classId?: string; className?: string; accent?: string; summary?: string; room?: string; curriculum?: ClassroomSubject['curriculum'] }) {
  return fetchWithAuth(`/api/classroom/subjects/${encodeURIComponent(subjectId)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function deleteClassroomSubject(subjectId: string) {
  return fetchWithAuth(`/api/classroom/subjects/${encodeURIComponent(subjectId)}`, {
    method: 'DELETE',
  });
}

export async function getPracticeSets() {
  return fetchWithAuth('/api/classroom/practice') as Promise<PracticeSet[]>;
}

export async function createSchoolQuestionBank(body: { subject: string; title: string; level?: string; mode?: string; note?: string; scope?: 'practice' | 'exam' | 'cbt' | 'mid-term'; visibility?: 'global' | 'school'; examFamily?: string; classBand?: string; tags?: string[]; questions: PracticeQuestion[] }) {
  return fetchWithAuth('/api/classroom/question-bank', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function explainQuestion(questionId: string, stem: string, options: string[], answer: string): Promise<string> {
  try {
    const result = await fetchWithAuth(`/api/classroom/question/${questionId}/explanation`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ stem, options, answer })
    });
    return result?.explanation || "The system generated an explanation.";
  } catch (err) {
    throw err instanceof Error ? err : new Error('AI explanation failed');
  }
}

export async function getClassroomResults() {
  return fetchWithAuth('/api/classroom/results') as Promise<{ sessions: ResultSession[]; studentResults?: StudentResultRecord[] }>;
}

export async function getResultDocuments(studentId?: string) {
  const query = studentId ? `?studentId=${encodeURIComponent(studentId)}` : '';
  return fetchWithAuth(`/api/classroom/results/documents${query}`) as Promise<{ documents: ResultDocumentRecord[] }>;
}

export async function getOldResultAssets(studentId?: string) {
  const query = studentId ? `?studentId=${encodeURIComponent(studentId)}` : '';
  return fetchWithAuth(`/api/classroom/results/old-documents${query}`) as Promise<{ assets: HistoryAssetRecord[] }>;
}

export async function uploadResultDocument(payload: { file: File; studentRef?: string; session?: string; term?: string; schoolId?: string }) {
  const formData = new FormData();
  formData.append('file', payload.file, payload.file.name);
  if (payload.studentRef) formData.append('studentRef', payload.studentRef);
  if (payload.session) formData.append('session', payload.session);
  if (payload.term) formData.append('term', payload.term);
  if (payload.schoolId) formData.append('school_id', payload.schoolId);
  return fetchWithAuth('/api/uploads/result-document', {
    method: 'POST',
    body: formData,
  }) as Promise<{ ok: boolean; document: ResultDocumentRecord }>;
}

export async function getHistoryAssets() {
  return fetchWithAuth('/api/classroom/history') as Promise<{ assets: HistoryAssetRecord[] }>;
}

export async function uploadHistoryAsset(payload: { file: File; schoolId?: string; historyKind?: HistoryAssetRecord['historyKind'] }) {
  const formData = new FormData();
  formData.append('file', payload.file, payload.file.name);
  if (payload.schoolId) formData.append('school_id', payload.schoolId);
  if (payload.historyKind) formData.append('historyKind', payload.historyKind);
  return fetchWithAuth('/api/uploads/history-asset', {
    method: 'POST',
    body: formData,
  }) as Promise<{ ok: boolean; asset: HistoryAssetRecord; mappedCount: number; unmatchedCount: number }>;
}

export async function getMigrationAssets() {
  return getHistoryAssets();
}

export async function uploadMigrationAsset(payload: { file: File; schoolId?: string; historyKind?: HistoryAssetRecord['historyKind'] }) {
  return uploadHistoryAsset(payload);
}

export async function createClassroomNote(body: {
  title: string;
  subject: string;
  topic: string;
  className?: string;
  classSection?: string;
  week: number;
  summary: string;
  visibility: string;
  format?: string;
  duration?: string;
  access?: string;
  submittedBy?: string;
  viewerType?: ClassroomMaterialViewerType;
  materials?: ClassroomMaterialAsset[];
  ndoveraDocument?: ClassroomCreatedDocument | null;
}) {
  return fetchWithAuth('/api/classroom/notes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as Promise<ClassroomNote>;
}

export async function applyLessonNoteSignature(noteId: string) {
  return fetchWithAuth(`/api/classroom/notes/${encodeURIComponent(noteId)}/signature`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  }) as Promise<LessonNoteSignatureResult>;
}

export async function getLiveClasses() {
  return fetchWithAuth('/api/classroom/live-classes') as Promise<LiveClassSession[]>;
}

export async function createLiveClass(body: { title: string; mode: string; schedule: string; duration: string }) {
  return fetchWithAuth('/api/classroom/live-classes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as Promise<{ id: string; status: string; schoolActiveLimit: number; activeCount: number }>;
}

export async function joinLiveClass(sessionId: string) {
  return fetchWithAuth(`/api/classroom/live-classes/${sessionId}/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  }) as Promise<{ ok: boolean; attendees: number; meetingUrl?: string; title?: string }>;
}

export async function closeLiveClass(sessionId: string) {
  return fetchWithAuth(`/api/classroom/live-classes/${sessionId}/close`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  }) as Promise<{ ok: boolean }>;
}
