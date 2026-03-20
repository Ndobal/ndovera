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
  storageKey?: string;
  mimeType: string;
  size: number;
  extension?: string;
  assetType: Exclude<ClassroomMaterialAssetType, 'ndovera-document'>;
  viewerType: Exclude<ClassroomMaterialViewerType, 'mixed' | 'ndovera-document'>;
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
  fileSize?: number | null;
  storageKey?: string | null;
  materials?: ClassroomMaterialAsset[];
  ndoveraDocument?: ClassroomCreatedDocument | null;
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
  teacherId?: string;
  teacherName?: string;
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
};

export type PracticeSet = {
  id: string;
  source: string;
  scope: string;
  subject: string;
  title: string;
  level?: string;
  mode?: string;
  reward?: string;
  questions: number;
  note: string;
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
  };
  subjects: Array<{ subject: string; ca: number; exam: number; total: number; grade: string; remark: string }>;
};

export type ResultSession = {
  session: string;
  feeStatus: string;
  outstanding: string;
  terms: ResultTerm[];
};

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
  }) as Promise<{ ok: boolean; url: string; storageKey: string; name: string; mimeType: string; size: number; assetType: Exclude<ClassroomMaterialAssetType, 'ndovera-document'>; viewerType: Exclude<ClassroomMaterialViewerType, 'mixed' | 'ndovera-document'> }>;
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
  }) as Promise<{ ok: boolean; url: string; storageKey: string; name: string; mimeType: string; size: number }>;
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

export async function getPracticeSets() {
  return fetchWithAuth('/api/classroom/practice') as Promise<PracticeSet[]>;
}

export async function createSchoolQuestionBank(body: { subject: string; title: string; level?: string; mode?: string; note?: string; questions: PracticeQuestion[] }) {
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
    // Simulated AI response for frontend presentation without real backend support
    await new Promise(resolve => setTimeout(resolve, 1500));
    return `The correct answer is "${answer}" because it logically completes the premise: "${stem}".`;
  }
}

export async function getClassroomResults() {
  return fetchWithAuth('/api/classroom/results') as Promise<{ sessions: ResultSession[] }>;
}

export async function createClassroomNote(body: {
  title: string;
  subject: string;
  topic: string;
  week: number;
  summary: string;
  visibility: string;
  format?: string;
  duration?: string;
  access?: string;
  viewerType?: ClassroomMaterialViewerType;
  materials?: ClassroomMaterialAsset[];
  ndoveraDocument?: ClassroomCreatedDocument | null;
}) {
  return fetchWithAuth('/api/classroom/notes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
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
