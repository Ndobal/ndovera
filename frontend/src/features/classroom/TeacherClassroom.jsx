import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StudentSectionShell from '../../app/roles/student/StudentSectionShell';
import MobileRoleOverviewNav from '../../shared/components/MobileRoleOverviewNav';
import TeacherAssignmentsPanel from './TeacherAssignmentsPanel';
import * as svc from './classroomService';
import SubjectsTab from './subjects';
import MaterialTypeThumbnail, { materialTypeLabel } from '../../shared/components/MaterialTypeThumbnail';
import MaterialViewer from './materials/MaterialViewer';
import { getStoredAuth } from '../auth/services/authApi';
import { getPeople } from '../school/services/schoolApi';

const TODAY = new Date().toISOString().slice(0, 10);
const STREAM_EMOJIS = ['😀', '😂', '😍', '🔥', '👏', '🎉', '👍', '🙏', '💡', '📚', '💯', '🚀'];
const STAFF_MESSAGING_INTENT_KEY = 'staffMessagingIntent';

function normalizeMemberIdentifier(value) {
  return String(value || '').trim().toLowerCase();
}

function looksLikeEmail(value) {
  return /\S+@\S+\.\S+/.test(String(value || '').trim());
}

function formatRoleLabel(value, fallback = 'Class User') {
  const normalized = String(value || '').trim();
  if (!normalized) return fallback;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function buildAvatarLabel(value) {
  const parts = String(value || 'CU').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'CU';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function readStoredUser() {
  try {
    return JSON.parse(window.localStorage.getItem('authUser') || '{}');
  } catch {
    return {};
  }
}

function htmlToDisplayText(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const normalized = raw
    .replace(/<div><br\s*\/?>\s*<\/div>/gi, '\n')
    .replace(/<\/div>\s*<div>/gi, '\n')
    .replace(/<div>/gi, '')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n')
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/gi, ' ');

  if (typeof window !== 'undefined' && window.document) {
    const element = window.document.createElement('div');
    element.innerHTML = normalized;
    return String(element.textContent || element.innerText || '')
      .replace(/\r/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  return normalized.replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

function saveStaffMessagingIntent(intent) {
  try {
    window.sessionStorage.setItem(STAFF_MESSAGING_INTENT_KEY, JSON.stringify(intent));
  } catch {}
}

function formatTeacherStreamContent(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br />');
}

function formatVisibilityLabel(value) {
  switch (String(value || '').toLowerCase()) {
    case 'student_parent':
      return 'Students + Parents';
    case 'teacher':
      return 'Teacher Only';
    default:
      return 'Students';
  }
}

function formatReleaseLabel(value) {
  if (!value) return 'Immediate release';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : `Releases ${parsed.toLocaleString()}`;
}

function buildMaterialUploadKey(file) {
  return `${String(file?.name || 'file')}:${Number(file?.size || 0)}:${Number(file?.lastModified || 0)}`;
}

function readRememberedTeacherClassId() {
  if (typeof window === 'undefined') return '';
  return String(window.localStorage.getItem('teacherClassroomId') || window.localStorage.getItem('classroomId') || '').trim();
}

export default function TeacherClassroom({
  initialTab = 'stream',
  lockedTab = '',
  dashboardLabel = 'Teacher Dashboard',
  watermarkText = 'Teacher Dashboard',
}) {
  const navigate = useNavigate();
  const storedAuth = getStoredAuth();
  const storedUser = storedAuth?.user || readStoredUser();
  const currentRoleKey = String(storedUser?.role || 'teacher').trim().toLowerCase() || 'teacher';
  const isSupervisorRole = ['owner', 'hos', 'admin', 'ict', 'ict_manager', 'ami'].includes(currentRoleKey);
  const [classId, setClassId] = useState(() => readRememberedTeacherClassId());
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [activeTab, setActiveTab] = useState(() => lockedTab || initialTab);
  const [posts, setPosts] = useState([]);
  const [draftContent, setDraftContent] = useState('');
  const [streamEmojiOpen, setStreamEmojiOpen] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [activeMaterial, setActiveMaterial] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(TODAY);
  const [attendanceStatus, setAttendanceStatus] = useState('Present');
  const [attendanceNotes, setAttendanceNotes] = useState('');
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceMessage, setAttendanceMessage] = useState('');
  const [materialSubjectId, setMaterialSubjectId] = useState('');
  const [materialType, setMaterialType] = useState('document');
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialUrl, setMaterialUrl] = useState('');
  const [materialDescription, setMaterialDescription] = useState('');
  const [materialTopic, setMaterialTopic] = useState('');
  const [materialWeekLabel, setMaterialWeekLabel] = useState('');
  const [materialVisibility, setMaterialVisibility] = useState('student_parent');
  const [materialReleaseAt, setMaterialReleaseAt] = useState('');
  const [materialMessage, setMaterialMessage] = useState('');
  const [materialTopicOptions, setMaterialTopicOptions] = useState([]);
  const [pendingMaterialFiles, setPendingMaterialFiles] = useState([]);
  const [liveSessions, setLiveSessions] = useState([]);
  const [liveSubjectId, setLiveSubjectId] = useState('');
  const [liveTopic, setLiveTopic] = useState('');
  const [liveMode, setLiveMode] = useState('Video + Audio');
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveMessage, setLiveMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState({});
  const [classroomLoading, setClassroomLoading] = useState(true);
  const [classroomError, setClassroomError] = useState('');
  const [classMembers, setClassMembers] = useState([]);
  const [rosterRole, setRosterRole] = useState('student');
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterCandidates, setRosterCandidates] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterMessage, setRosterMessage] = useState('');
  const [activeStreamMenuId, setActiveStreamMenuId] = useState('');
  const [profileMember, setProfileMember] = useState(null);

  const selectedClass = assignedClasses.find(classroom => classroom.id === classId) || null;
  const classroomLabel = selectedClass?.className || storedUser?.className || classId || 'Assigned Classroom';
  const materialSubjects = useMemo(() => selectedClass?.subjects || [], [selectedClass?.subjects]);
  const selectedMaterialSubject = materialSubjects.find(subject => subject.id === materialSubjectId) || materialSubjects[0] || null;
  const selectedLiveSubject = materialSubjects.find(subject => subject.id === liveSubjectId) || materialSubjects[0] || null;
  const isChoosingClass = !classId;
  const canManageSelectedClass = Boolean(selectedClass?.canManageClassroom || selectedClass?.isClassTeacher);
  const selfMemberIdentifiers = useMemo(() => new Set(
    [storedUser?.id, storedUser?.email, storedUser?.displayId]
      .map(normalizeMemberIdentifier)
      .filter(Boolean)
  ), [storedUser?.displayId, storedUser?.email, storedUser?.id]);
  const currentUserProfile = useMemo(() => ({
    id: String(storedUser?.id || storedUser?.email || 'teacher'),
    name: String(storedUser?.name || 'You'),
    email: String(storedUser?.email || ''),
    displayId: String(storedUser?.displayId || ''),
    role: formatRoleLabel(storedUser?.role || 'teacher', 'Teacher'),
    className: classroomLabel,
    status: 'Active',
    isSelf: true,
  }), [classroomLabel, storedUser?.displayId, storedUser?.email, storedUser?.id, storedUser?.name, storedUser?.role]);
  const sortedPosts = useMemo(() => (
    [...posts].sort((first, second) => {
      const firstTime = new Date(first?.createdAt || first?.updatedAt || 0).getTime();
      const secondTime = new Date(second?.createdAt || second?.updatedAt || 0).getTime();
      return firstTime - secondTime;
    })
  ), [posts]);

  useEffect(() => {
    setActiveTab(lockedTab || initialTab);
  }, [initialTab, lockedTab]);

  useEffect(() => {
    let cancelled = false;

    async function resolveAssignedClasses() {
      try {
        const data = await svc.getAssignedClasses();
        if (cancelled) return;

        const classes = data?.classes || [];
        setAssignedClasses(classes);

        if (classes.length === 0) {
          setClassroomError(isSupervisorRole ? 'No classes are available for supervision yet.' : 'No classes have been assigned to this teacher yet.');
        } else {
          setClassroomError('');
        }
      } catch {
        if (!cancelled) {
          setClassroomError('Unable to load your assigned classes right now.');
        }
      } finally {
        if (!cancelled) {
          setClassroomLoading(false);
        }
      }
    }

    resolveAssignedClasses();
    return () => {
      cancelled = true;
    };
  }, [isSupervisorRole]);

  useEffect(() => {
    if (classroomLoading) return;

    if (!assignedClasses.length) {
      if (classId) {
        setClassId('');
      }
      return;
    }

    if (assignedClasses.some(classroom => classroom.id === classId)) {
      return;
    }

    const rememberedClassId = readRememberedTeacherClassId();
    const rememberedMatch = assignedClasses.find(classroom => classroom.id === rememberedClassId)?.id || '';
    const fallbackClassId = rememberedMatch
      || ((lockedTab || isSupervisorRole || assignedClasses.length === 1) ? String(assignedClasses[0]?.id || '') : '');

    if (!fallbackClassId) return;

    setClassId(fallbackClassId);
    window.localStorage.setItem('teacherClassroomId', fallbackClassId);
    window.localStorage.setItem('classroomId', fallbackClassId);
  }, [assignedClasses, classId, classroomLoading, isSupervisorRole, lockedTab]);

  useEffect(() => {
    if (!classId) {
      setPosts([]);
      setAssignments([]);
      setMaterials([]);
      setAttendance([]);
      setStudents([]);
      setClassMembers([]);
      setSelectedStudentId('');
      setAttendanceMessage('');
      setMaterialTitle('');
      setMaterialUrl('');
      setMaterialDescription('');
      setMaterialTopic('');
      setMaterialWeekLabel('');
      setMaterialVisibility('student_parent');
      setMaterialReleaseAt('');
      setMaterialMessage('');
      setPendingMaterialFiles([]);
      setUploadProgress({});
      setLiveSessions([]);
      setLiveTopic('');
      setLiveMessage('');
      setActiveStreamMenuId('');
      setProfileMember(null);
      return;
    }

    setClassroomError('');
    window.localStorage.setItem('teacherClassroomId', classId);
    window.localStorage.setItem('classroomId', classId);
    svc.getPosts(classId).then(r => { if (r && r.success) setPosts(r.posts || []); }).catch(()=>{});
    svc.getAssignments(classId).then(r => { if (r && r.success) setAssignments(r.assignments || []); }).catch(()=>{});
    svc.getMaterials(classId).then(r => { if (r && r.success) setMaterials(r.materials || []); }).catch(()=>{});
    svc.getAttendance(classId).then(r => { if (r && r.success) setAttendance(r.attendance || []); }).catch(()=>{});
    svc.getLiveSessions(classId).then(r => { if (r && r.success) setLiveSessions(r.sessions || []); }).catch(()=>{});
    svc.getClassMembers(classId).then(r => { if (r && r.success) setClassMembers(r.members || []); }).catch(() => setClassMembers([]));
  }, [classId]);

  useEffect(() => {
    if (!classId || !canManageSelectedClass) {
      setStudents([]);
      setSelectedStudentId('');
      return;
    }

    let cancelled = false;
    svc.getClassStudents(classId).then(r => {
      if (cancelled || !r || !r.success) return;
      const roster = r.students || [];
      setStudents(roster);
      setSelectedStudentId(currentStudentId => (
        roster.some(student => student.id === currentStudentId)
          ? currentStudentId
          : (roster[0]?.id || '')
      ));
    }).catch(() => {
      if (!cancelled) {
        setStudents([]);
        setSelectedStudentId('');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [canManageSelectedClass, classId]);

  useEffect(() => {
    if (!materialSubjects.length) {
      setMaterialSubjectId('');
      setLiveSubjectId('');
      return;
    }

    setMaterialSubjectId(currentSubjectId => (
      materialSubjects.some(subject => subject.id === currentSubjectId)
        ? currentSubjectId
        : String(materialSubjects[0]?.id || '')
    ));

    setLiveSubjectId(currentSubjectId => (
      materialSubjects.some(subject => subject.id === currentSubjectId)
        ? currentSubjectId
        : String(materialSubjects[0]?.id || '')
    ));
  }, [materialSubjects]);

  // Suggest existing topics for the subject the material is being posted to.
  useEffect(() => {
    if (!classId || !materialSubjectId) {
      setMaterialTopicOptions([]);
      return undefined;
    }
    let active = true;
    svc.getTopics(classId, materialSubjectId)
      .then(data => { if (active) setMaterialTopicOptions(data?.topics || []); })
      .catch(() => { if (active) setMaterialTopicOptions([]); });
    return () => { active = false; };
  }, [classId, materialSubjectId]);

  useEffect(() => {
    let cancelled = false;

    async function searchRosterCandidates() {
      if (!canManageSelectedClass || activeTab !== 'subjects' || !rosterSearch.trim()) {
        setRosterCandidates([]);
        return;
      }

      setRosterLoading(true);
      try {
        const payload = await getPeople({ search: rosterSearch.trim(), role: rosterRole, limit: 12, page: 1 });
        if (!cancelled) {
          setRosterCandidates(payload?.people || []);
        }
      } catch {
        if (!cancelled) setRosterCandidates([]);
      } finally {
        if (!cancelled) setRosterLoading(false);
      }
    }

    searchRosterCandidates();
    return () => {
      cancelled = true;
    };
  }, [activeTab, canManageSelectedClass, rosterRole, rosterSearch]);

  function loadAll() {
    if (!classId) return;
    svc.getPosts(classId).then(r => { if (r && r.success) setPosts(r.posts || []); }).catch(()=>{});
    svc.getAssignments(classId).then(r => { if (r && r.success) setAssignments(r.assignments || []); }).catch(()=>{});
    svc.getMaterials(classId).then(r => { if (r && r.success) setMaterials(r.materials || []); }).catch(()=>{});
    svc.getAttendance(classId).then(r => { if (r && r.success) setAttendance(r.attendance || []); }).catch(()=>{});
    svc.getLiveSessions(classId).then(r => { if (r && r.success) setLiveSessions(r.sessions || []); }).catch(()=>{});
    svc.getClassMembers(classId).then(r => { if (r && r.success) setClassMembers(r.members || []); }).catch(() => setClassMembers([]));
  }

  async function handleAddRosterMember(memberRole, userId) {
    if (!classId || !userId) return;
    const response = await svc.addClassMember(classId, { memberRole, userId });
    if (!response?.success) {
      setRosterMessage(response?.message || 'Could not add that person to the class.');
      return;
    }
    setRosterMessage(`${formatRoleLabel(memberRole)} added to the class.`);
    setRosterSearch('');
    setRosterCandidates([]);
    loadAll();
  }

  async function handleRemoveRosterMember(member) {
    if (!classId || !member?.id) return;
    const memberRole = String(member.role || '').trim().toLowerCase();
    if (!window.confirm(`Remove ${member.name} from this class?`)) return;

    const response = await svc.removeClassMember(classId, memberRole, member.id);
    if (!response?.success) {
      setRosterMessage(response?.message || 'Could not remove that person from the class.');
      return;
    }

    setRosterMessage(`${member.name} removed from the class.`);
    loadAll();
  }

  async function handleCreatePost(e) {
    e.preventDefault();
    const content = draftContent.trim();
    if (!content || !classId) return;
    const response = await svc.createPost(classId, { content: formatTeacherStreamContent(content) });
    if (!response?.success) {
      setClassroomError(response?.message || 'Could not post to the class stream right now.');
      return;
    }
    setDraftContent('');
    setStreamEmojiOpen(false);
    setClassroomError('');
    loadAll();
  }

  async function handleEditPost(post) {
    if (!classId || !post?.id) return;
    const nextContent = window.prompt('Edit stream update', htmlToDisplayText(post?.content || post?.text || ''));
    if (nextContent === null) return;

    const normalizedContent = nextContent.trim();
    if (!normalizedContent) {
      setClassroomError('Post content cannot be empty.');
      return;
    }

    const response = await svc.updatePost(classId, post.id, { content: formatTeacherStreamContent(normalizedContent) });
    if (!response?.success) {
      setClassroomError(response?.message || 'Could not update this stream post right now.');
      return;
    }

    setClassroomError('');
    loadAll();
  }

  async function handleDeletePost(postId) {
    if (!classId || !postId) return;
    if (!window.confirm('Delete this stream post?')) return;

    const response = await svc.deletePost(classId, postId);
    if (!response?.success) {
      setClassroomError(response?.message || 'Could not delete this stream post right now.');
      return;
    }

    setClassroomError('');
    loadAll();
  }

  // autosave scheduling (use a ref to persist timer)
  const saveTimerRef = useRef(null);
  function scheduleSave(nextContent) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const content = formatTeacherStreamContent(nextContent || '');
      svc.saveContent(classId, { content, role: 'teacher' }).catch(()=>{});
    }, 2000);
  }

  function appendStreamEmoji(emoji) {
    setDraftContent(currentValue => `${currentValue}${emoji}`);
    setStreamEmojiOpen(false);
  }

  function openChatWithMember(member) {
    if (!member || member.isSelf) return;
    saveStaffMessagingIntent({
      contact: {
        id: member.id,
        name: member.name,
        email: member.email,
        displayId: member.displayId,
        role: formatRoleLabel(member.role || 'Student', 'Student'),
      },
    });
    navigate(`/roles/${currentRoleKey}/messaging`);
  }

  function reportMember(member) {
    if (!member || member.isSelf) return;
    saveStaffMessagingIntent({
      contact: {
        id: 'support',
        name: 'School Support',
        role: 'Help Desk',
      },
      composeDraft: `I want to report ${member.name}${member.displayId ? ` (${member.displayId})` : ''} from ${member.className || classroomLabel}. Please review this issue: `,
    });
    navigate(`/roles/${currentRoleKey}/messaging`);
  }

  function resolveStreamAuthor(post) {
    const postIdentifiers = [post?.authorId, post?.author, post?.authorName, post?.authorEmail, post?.displayId]
      .map(normalizeMemberIdentifier)
      .filter(Boolean);

    if (postIdentifiers.some(identifier => selfMemberIdentifiers.has(identifier))) {
      return currentUserProfile;
    }

    const matchedMember = classMembers.find(member => {
      const memberIdentifiers = [member.id, member.email, member.displayId, member.name]
        .map(normalizeMemberIdentifier)
        .filter(Boolean);
      return postIdentifiers.some(identifier => memberIdentifiers.includes(identifier));
    });

    if (matchedMember) {
      return {
        ...matchedMember,
        name: matchedMember.name || matchedMember.email || matchedMember.id || 'Class User',
        role: formatRoleLabel(matchedMember.role || (post?.isStudentPost ? 'student' : 'teacher')),
        className: matchedMember.className || classroomLabel,
        status: matchedMember.status || 'Active',
        isSelf: false,
      };
    }

    const fallbackName = [post?.authorName, post?.author]
      .find(value => value && !looksLikeEmail(value)) || (post?.isStudentPost ? 'Student' : 'Teacher');
    const fallbackEmail = [post?.author, post?.authorId].find(looksLikeEmail) || '';

    return {
      id: String(post?.authorId || post?.id || fallbackName),
      name: String(fallbackName || 'Class User'),
      email: String(fallbackEmail),
      displayId: String(post?.displayId || ''),
      role: formatRoleLabel(post?.isStudentPost ? 'student' : 'teacher'),
      className: classroomLabel,
      status: 'Active',
      isSelf: false,
    };
  }

  // Upload with progress using XMLHttpRequest (to support progress events)
  function resetMaterialComposer() {
    setMaterialTitle('');
    setMaterialUrl('');
    setMaterialDescription('');
    setMaterialTopic('');
    setMaterialWeekLabel('');
    setMaterialVisibility('student_parent');
    setMaterialReleaseAt('');
    setPendingMaterialFiles([]);
    setUploadProgress({});
  }

  function queueMaterialFiles(fileList) {
    const nextFiles = Array.from(fileList || []).filter(Boolean);
    if (nextFiles.length === 0) return;

    setPendingMaterialFiles(currentFiles => {
      const existingKeys = new Set(currentFiles.map(buildMaterialUploadKey));
      return [...currentFiles, ...nextFiles.filter(file => !existingKeys.has(buildMaterialUploadKey(file)))];
    });

    setUploadProgress(currentProgress => {
      const nextProgress = { ...currentProgress };
      nextFiles.forEach(file => {
        const uploadKey = buildMaterialUploadKey(file);
        if (nextProgress[uploadKey] === undefined) {
          nextProgress[uploadKey] = 0;
        }
      });
      return nextProgress;
    });

    if (!materialTitle.trim() && nextFiles.length === 1) {
      setMaterialTitle(String(nextFiles[0]?.name || '').replace(/\.[^.]+$/, ''));
    }

    setMaterialMessage(`${nextFiles.length} file${nextFiles.length === 1 ? '' : 's'} ready. Click Post Material to publish.`);
  }

  function removePendingMaterialFile(fileKey) {
    setPendingMaterialFiles(currentFiles => currentFiles.filter(file => buildMaterialUploadKey(file) !== fileKey));
    setUploadProgress(currentProgress => {
      const nextProgress = { ...currentProgress };
      delete nextProgress[fileKey];
      return nextProgress;
    });
  }

  function uploadFileWithProgress(file, overrides = {}) {
    return new Promise((resolve, reject) => {
      const token = localStorage.getItem('token');
      const xhr = new XMLHttpRequest();
      const url = `/api/classrooms/${encodeURIComponent(classId)}/materials/upload-multipart`;
      const fd = new FormData();
      const nextSubject = materialSubjects.find(subject => subject.id === (overrides.subjectId || materialSubjectId)) || materialSubjects[0] || null;
      const nextTitle = String(overrides.title || materialTitle || file.name).trim() || file.name;
      const nextDescription = String(overrides.description ?? materialDescription).trim();
      const nextType = String(overrides.type || materialType || 'document').trim();
      const nextTopic = String(overrides.topic ?? materialTopic).trim();
      const nextWeekLabel = String(overrides.weekLabel ?? materialWeekLabel).trim();
      const nextVisibility = String(overrides.visibility || materialVisibility || 'student_parent').trim();
      const nextReleaseAt = String(overrides.releaseAt ?? materialReleaseAt).trim();

      if (!nextSubject) {
        setMaterialMessage('Add a subject to this class before posting materials.');
        reject(new Error('Subject is required.'));
        return;
      }

      fd.append('file', file);
      fd.append('title', nextTitle);
      fd.append('subjectId', nextSubject.id);
      if (nextDescription) fd.append('description', nextDescription);
      if (nextType) fd.append('type', nextType);
      if (nextTopic) fd.append('topic', nextTopic);
      if (nextWeekLabel) fd.append('weekLabel', nextWeekLabel);
      if (nextVisibility) fd.append('visibility', nextVisibility);
      if (nextReleaseAt) fd.append('releaseAt', nextReleaseAt);

      xhr.open('POST', url, true);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (evt) => {
        if (!evt.lengthComputable) return;
        const pct = Math.round((evt.loaded / evt.total) * 100);
        const uploadKey = buildMaterialUploadKey(file);
        setUploadProgress(prev => ({ ...prev, [uploadKey]: pct }));
      };

      xhr.onload = () => {
        try {
          const json = JSON.parse(xhr.responseText || '{}');
          const uploadKey = buildMaterialUploadKey(file);
          setUploadProgress(prev => ({ ...prev, [uploadKey]: json?.success ? 100 : 0 }));
          resolve(json);
        } catch (err) {
          reject(err || new Error('Invalid JSON'));
        }
      };

      xhr.onerror = () => {
        const uploadKey = buildMaterialUploadKey(file);
        setUploadProgress(prev => ({ ...prev, [uploadKey]: 0 }));
        reject(new Error('Upload failed'));
      };

      xhr.send(fd);
    });
  }

  async function handleCreateMaterial(event) {
    event.preventDefault();

    if (!classId || !selectedMaterialSubject) {
      setMaterialMessage('Choose the subject this material belongs to before posting it.');
      return;
    }

    if (pendingMaterialFiles.length > 0) {
      let uploadedCount = 0;
      const failedFiles = [];

      for (const file of pendingMaterialFiles) {
        try {
          const response = await uploadFileWithProgress(file, {
            title: pendingMaterialFiles.length === 1 && materialTitle.trim()
              ? materialTitle.trim()
              : String(file.name || '').replace(/\.[^.]+$/, ''),
          });

          if (response?.success) {
            uploadedCount += 1;
          } else {
            failedFiles.push(file);
          }
        } catch {
          failedFiles.push(file);
        }
      }

      if (uploadedCount > 0) {
        loadAll();
      }

      if (failedFiles.length === 0) {
        setMaterialMessage(`Posted ${uploadedCount} material${uploadedCount === 1 ? '' : 's'} to ${selectedMaterialSubject.name}.`);
        resetMaterialComposer();
        return;
      }

      setPendingMaterialFiles(failedFiles);
      setMaterialMessage(uploadedCount > 0
        ? `Posted ${uploadedCount} material${uploadedCount === 1 ? '' : 's'}. ${failedFiles.length} file${failedFiles.length === 1 ? '' : 's'} still need attention.`
        : 'Could not post the selected files right now.');
      return;
    }

    if (!materialTitle.trim()) {
      setMaterialMessage('Enter a material title before posting it.');
      return;
    }

    const response = await svc.addMaterial(classId, {
      title: materialTitle.trim(),
      url: materialUrl.trim(),
      subjectId: selectedMaterialSubject.id,
      description: materialDescription.trim(),
      topic: materialTopic.trim(),
      weekLabel: materialWeekLabel.trim(),
      visibility: materialVisibility,
      releaseAt: materialReleaseAt,
      type: materialType,
    });

    if (!response?.success) {
      setMaterialMessage(response?.message || 'Could not post this material right now.');
      return;
    }

    setMaterialMessage(`Posted ${materialTitle.trim()} to ${selectedMaterialSubject.name}.`);
    resetMaterialComposer();
    loadAll();
  }

  async function handleEditMaterial(material) {
    if (!classId || !material?.id) return;

    const nextTitle = window.prompt('Update material title', material.title || '');
    if (nextTitle === null) return;
    const normalizedTitle = nextTitle.trim();
    if (!normalizedTitle) {
      setMaterialMessage('Material title is required.');
      return;
    }

    const nextDescription = window.prompt('Update material description', material.description || '');
    if (nextDescription === null) return;

    const nextUrl = window.prompt('Update material link. Leave blank to keep it as a teacher note.', material.url || '');
    if (nextUrl === null) return;

    const response = await svc.updateMaterial(classId, material.id, {
      title: normalizedTitle,
      description: nextDescription.trim(),
      url: nextUrl.trim(),
    });

    if (!response?.success) {
      setMaterialMessage(response?.message || 'Could not update this material right now.');
      return;
    }

    setMaterialMessage(`Updated ${normalizedTitle}.`);
    loadAll();
  }

  async function handleDeleteMaterial(material) {
    if (!classId || !material?.id) return;
    if (!window.confirm(`Delete ${material.title || 'this material'}?`)) return;

    const response = await svc.deleteMaterial(classId, material.id);
    if (!response?.success) {
      setMaterialMessage(response?.message || 'Could not delete this material right now.');
      return;
    }

    setMaterialMessage(`Deleted ${material.title || 'material'}.`);
    loadAll();
  }

  async function handleStartLiveSession(event) {
    event.preventDefault();

    if (!classId || !selectedLiveSubject) {
      setLiveMessage('Choose the subject for this live class first.');
      return;
    }

    setLiveLoading(true);
    setLiveMessage('');

    try {
      const response = await svc.startLiveSession(classId, {
        subjectId: selectedLiveSubject.id,
        topic: liveTopic.trim(),
        mode: liveMode,
      });

      if (!response?.success) {
        setLiveMessage(response?.message || 'Could not start the live class right now.');
        return;
      }

      setLiveMessage(`Live class started for ${selectedLiveSubject.name}.`);
      setLiveTopic('');
      loadAll();
    } catch {
      setLiveMessage('Could not start the live class right now.');
    } finally {
      setLiveLoading(false);
    }
  }

  async function handleEndLiveSession(sessionId) {
    if (!classId || !sessionId) return;

    setLiveLoading(true);
    setLiveMessage('');

    try {
      const response = await svc.endLiveSession(classId, sessionId);
      if (!response?.success) {
        setLiveMessage(response?.message || 'Could not end this live class right now.');
        return;
      }
      setLiveMessage('Live class ended.');
      loadAll();
    } catch {
      setLiveMessage('Could not end this live class right now.');
    } finally {
      setLiveLoading(false);
    }
  }

  // Drag-and-drop handlers
  function handleDrop(e) {
    e.preventDefault();
    if (activeTab !== 'materials') return;
    const items = e.dataTransfer && e.dataTransfer.files;
    if (!items || items.length === 0) return;
    queueMaterialFiles(items);
  }

  function handleDragOver(e) { e.preventDefault(); }

  async function handleRecordAttendance(e) {
    e.preventDefault();
    if (!canManageSelectedClass) {
      setAttendanceMessage('Only the assigned class teacher, HoS, owner, or another classroom supervisor can mark attendance for this class.');
      return;
    }

    if (!selectedStudentId || !attendanceDate || !attendanceStatus || !classId) {
      setAttendanceMessage('Select a student, date, and status before recording attendance.');
      return;
    }

    setAttendanceLoading(true);
    setAttendanceMessage('');

    try {
      const response = await svc.recordAttendance(classId, {
        studentId: selectedStudentId,
        date: attendanceDate,
        status: attendanceStatus,
        notes: attendanceNotes,
      });

      if (!response?.success) {
        setAttendanceMessage(response?.message || 'Could not record attendance right now.');
        return;
      }

      const selectedStudent = students.find(student => student.id === selectedStudentId);
      setAttendanceMessage(`Recorded ${attendanceStatus} for ${selectedStudent?.name || 'student'}.`);
      setAttendanceNotes('');
      loadAll();
    } catch {
      setAttendanceMessage('Could not record attendance right now.');
    } finally {
      setAttendanceLoading(false);
    }
  }

  function handleSelectClass(nextClassId) {
    setActiveTab(lockedTab || initialTab);
    setClassId(nextClassId);
    window.localStorage.setItem('teacherClassroomId', nextClassId);
    window.localStorage.setItem('classroomId', nextClassId);
  }

  function handleExitClass() {
    setClassId('');
    setActiveTab(lockedTab || initialTab);
    setAttendanceMessage('');
    window.localStorage.removeItem('teacherClassroomId');
    window.localStorage.removeItem('classroomId');
  }

  const attendanceStudentsById = Object.fromEntries(students.map(student => [student.id, student]));
  const showingLockedAttendance = lockedTab === 'attendance';

  return (
    <StudentSectionShell
      title={selectedClass?.className || (showingLockedAttendance ? 'Class Attendance' : 'Teacher Classroom')}
      subtitle={selectedClass ? 'Manage one class at a time. Exit this class to choose another one.' : ''}
      dashboardLabel={dashboardLabel}
      watermarkText={watermarkText}
      hideHeader={isChoosingClass}
    >
      <div id="devMarker" style={{display: 'none'}}>DEV_BUILD: teacher-classroom-20260304</div>
      <div className="p-4">
        {isChoosingClass && <div className="mb-6">
          <label className="block text-sm font-medium text-[#800000] dark:text-[#0000ff] mb-3">{isSupervisorRole ? 'Available Classes' : 'Assigned Classes'}</label>
          {assignedClasses.length > 0 ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {assignedClasses.map(classroom => (
                <button
                  key={classroom.id}
                  type="button"
                  onClick={() => handleSelectClass(classroom.id)}
                  className="text-left rounded-3xl p-5 border transition-all duration-200 bg-[#b5e3f4] border-[#c9a96e]/50 shadow-[0_18px_40px_rgba(128,0,0,0.08)] hover:-translate-y-0.5 hover:shadow-[0_22px_46px_rgba(128,0,0,0.12)] dark:bg-[#800000]/75 dark:border-[#bf00ff]/45 dark:shadow-[0_0_28px_rgba(191,0,255,0.22)] dark:hover:shadow-[0_0_36px_rgba(0,255,255,0.22)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-[#800000] dark:text-[#ffffff]">{classroom.className}</p>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-[#bf00ff]">{classroom.isClassTeacher ? 'Class Teacher' : classroom.isSupervisor ? 'Supervisor Access' : 'Subject Teacher'}</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-[#1a5c38] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[#b5e3f4] dark:bg-[#00ffff] dark:text-[#000000]">Open Class</span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] p-3 dark:border-[#bf00ff]/35 dark:bg-black/20">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#800020] dark:text-[#bf00ff]">Students</p>
                      <p className="mt-1 text-lg font-black text-[#191970] dark:text-[#39ff14]">{classroom.studentCount}</p>
                    </div>
                    <div className="rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] p-3 dark:border-[#bf00ff]/35 dark:bg-black/20">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#800020] dark:text-[#bf00ff]">Subjects</p>
                      <p className="mt-1 text-lg font-black text-[#191970] dark:text-[#39ff14]">{classroom.subjectCount}</p>
                    </div>
                    <div className="rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] p-3 dark:border-[#bf00ff]/35 dark:bg-black/20">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#800020] dark:text-[#bf00ff]">Assignments</p>
                      <p className="mt-1 text-lg font-black text-[#191970] dark:text-[#39ff14]">{classroom.assignmentCount}</p>
                    </div>
                    <div className="rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] p-3 dark:border-[#bf00ff]/35 dark:bg-black/20">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#800020] dark:text-[#bf00ff]">Materials</p>
                      <p className="mt-1 text-lg font-black text-[#191970] dark:text-[#39ff14]">{classroom.materialCount}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-[#c9a96e]/45 bg-[#b5e3f4] px-4 py-4 text-sm text-[#191970] dark:border-[#bf00ff]/35 dark:bg-[#800000]/70 dark:text-[#39ff14]">
              {classroomLoading ? 'Loading classes...' : (isSupervisorRole ? 'No classes are available for supervision yet.' : 'No classes assigned yet.')}
            </div>
          )}
          {classroomError && <p className="text-sm text-red-600 dark:text-[#ffffff] mt-2">{classroomError}</p>}
        </div>}

        {!!selectedClass && <div className="mb-4 rounded-3xl border border-[#c9a96e]/45 bg-[#b5e3f4] p-5 shadow-[0_18px_42px_rgba(128,0,0,0.08)] dark:border-[#bf00ff]/35 dark:bg-[#800000]/75 dark:shadow-[0_0_28px_rgba(191,0,255,0.18)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-[#bf00ff]">Working In</p>
              <p className="text-lg font-semibold text-[#800000] dark:text-[#ffffff] mt-1">{selectedClass.className}</p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="rounded-full bg-[#fff8f0] px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#800020] border border-[#c9a96e]/45 dark:bg-black/20 dark:border-[#bf00ff]/35 dark:text-[#bf00ff]">Students {selectedClass.studentCount}</span>
              <span className="rounded-full bg-[#fff8f0] px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#800020] border border-[#c9a96e]/45 dark:bg-black/20 dark:border-[#bf00ff]/35 dark:text-[#bf00ff]">Subjects {selectedClass.subjectCount}</span>
              <span className="rounded-full bg-[#fff8f0] px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#800020] border border-[#c9a96e]/45 dark:bg-black/20 dark:border-[#bf00ff]/35 dark:text-[#bf00ff]">Posts {selectedClass.streamCount}</span>
              <button
                type="button"
                onClick={handleExitClass}
                className="rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#b5e3f4] transition-colors hover:bg-[#154a2e] dark:bg-[#00ffff] dark:text-[#000000] dark:hover:bg-[#7dfcff]"
              >
                Exit Class
              </button>
            </div>
          </div>
        </div>}

        {!!classId && !lockedTab && <div className="mb-4 overflow-x-hidden">
          <nav className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
            <button className={`px-3 py-1 rounded-2xl border text-sm font-semibold transition-colors ${activeTab==='stream'?'bg-[#1a5c38] border-[#1a5c38] text-[#b5e3f4] dark:bg-[#00ffff] dark:border-[#00ffff] dark:text-[#000000]':'bg-[#fff8f0] border-[#c9a96e]/45 text-[#191970] hover:bg-[#f2e1bf] dark:bg-black/20 dark:border-[#bf00ff]/35 dark:text-[#ffffff] dark:hover:bg-[#800000]/85'}`} onClick={()=>setActiveTab('stream')}>Stream</button>
            <button className={`px-3 py-1 rounded-2xl border text-sm font-semibold transition-colors ${activeTab==='subjects'?'bg-[#1a5c38] border-[#1a5c38] text-[#b5e3f4] dark:bg-[#00ffff] dark:border-[#00ffff] dark:text-[#000000]':'bg-[#fff8f0] border-[#c9a96e]/45 text-[#191970] hover:bg-[#f2e1bf] dark:bg-black/20 dark:border-[#bf00ff]/35 dark:text-[#ffffff] dark:hover:bg-[#800000]/85'}`} onClick={()=>setActiveTab('subjects')}>Subjects</button>
            <button className={`px-3 py-1 rounded-2xl border text-sm font-semibold transition-colors ${activeTab==='assignments'?'bg-[#1a5c38] border-[#1a5c38] text-[#b5e3f4] dark:bg-[#00ffff] dark:border-[#00ffff] dark:text-[#000000]':'bg-[#fff8f0] border-[#c9a96e]/45 text-[#191970] hover:bg-[#f2e1bf] dark:bg-black/20 dark:border-[#bf00ff]/35 dark:text-[#ffffff] dark:hover:bg-[#800000]/85'}`} onClick={()=>setActiveTab('assignments')}>Assignments</button>
            <button className={`px-3 py-1 rounded-2xl border text-sm font-semibold transition-colors ${activeTab==='attendance'?'bg-[#1a5c38] border-[#1a5c38] text-[#b5e3f4] dark:bg-[#00ffff] dark:border-[#00ffff] dark:text-[#000000]':'bg-[#fff8f0] border-[#c9a96e]/45 text-[#191970] hover:bg-[#f2e1bf] dark:bg-black/20 dark:border-[#bf00ff]/35 dark:text-[#ffffff] dark:hover:bg-[#800000]/85'}`} onClick={()=>setActiveTab('attendance')}>Attendance</button>
            <button className={`px-3 py-1 rounded-2xl border text-sm font-semibold transition-colors ${activeTab==='materials'?'bg-[#1a5c38] border-[#1a5c38] text-[#b5e3f4] dark:bg-[#00ffff] dark:border-[#00ffff] dark:text-[#000000]':'bg-[#fff8f0] border-[#c9a96e]/45 text-[#191970] hover:bg-[#f2e1bf] dark:bg-black/20 dark:border-[#bf00ff]/35 dark:text-[#ffffff] dark:hover:bg-[#800000]/85'}`} onClick={()=>setActiveTab('materials')}>Materials</button>
            <button className={`px-3 py-1 rounded-2xl border text-sm font-semibold transition-colors ${activeTab==='live'?'bg-[#1a5c38] border-[#1a5c38] text-[#b5e3f4] dark:bg-[#00ffff] dark:border-[#00ffff] dark:text-[#000000]':'bg-[#fff8f0] border-[#c9a96e]/45 text-[#191970] hover:bg-[#f2e1bf] dark:bg-black/20 dark:border-[#bf00ff]/35 dark:text-[#ffffff] dark:hover:bg-[#800000]/85'}`} onClick={()=>setActiveTab('live')}>Live</button>
          </nav>
        </div>}

        {!!classId && <div onDrop={handleDrop} onDragOver={handleDragOver}>
          {activeTab === 'stream' && (
            <div className="flex min-h-[70vh] flex-col gap-4">
              <div className="flex-1 space-y-3">
                {sortedPosts.length === 0 ? (
                  <div className="rounded-3xl border border-[#c9a96e]/45 bg-[#b5e3f4] px-4 py-4 text-sm text-[#191970] dark:border-[#bf00ff]/35 dark:bg-[#800000]/70 dark:text-[#39ff14]">
                    No stream posts yet. New posts will appear here, with the newest update settling at the bottom.
                  </div>
                ) : (
                  sortedPosts.map(post => {
                    const authorProfile = resolveStreamAuthor(post);
                    const postTimestamp = post?.createdAt || post?.updatedAt || new Date().toISOString();
                    const postText = htmlToDisplayText(post?.content || post?.text || '');

                    return (
                      <div key={post.id} className="rounded-2xl border border-[#c9a96e]/35 bg-[#fff8f0] p-4 dark:border-[#bf00ff]/30 dark:bg-black/20">
                        <div className="flex items-start gap-4">
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setActiveStreamMenuId(currentId => currentId === post.id ? '' : post.id)}
                              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#c9a96e]/60 bg-[#b5e3f4] text-sm font-bold text-[#191970] shadow-[0_10px_24px_rgba(25,25,112,0.08)] dark:border-[#bf00ff]/35 dark:bg-black/25 dark:text-[#ffffff]"
                              aria-label={`Open ${authorProfile.name} actions`}
                            >
                              {buildAvatarLabel(authorProfile.name)}
                            </button>

                            {activeStreamMenuId === post.id && (
                              <div className="absolute left-0 top-14 z-30 w-64 rounded-[1.4rem] border border-[#c9a96e]/45 bg-[#fff8f0] p-3 shadow-[0_18px_40px_rgba(128,0,0,0.16)] dark:border-[#bf00ff]/35 dark:bg-[#26001f]">
                                <p className="text-sm font-semibold text-[#191970] dark:text-[#ffffff]">{authorProfile.name}</p>
                                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#800020] dark:text-[#bf00ff]">{authorProfile.role}</p>
                                <div className="mt-3 flex flex-col gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveStreamMenuId('');
                                      setProfileMember(authorProfile);
                                    }}
                                    className="rounded-2xl border border-[#c9a96e]/45 px-3 py-2 text-left text-sm font-semibold text-[#191970] hover:bg-[#b5e3f4] dark:border-[#bf00ff]/35 dark:text-[#ffffff] dark:hover:bg-black/25"
                                  >
                                    View Profile
                                  </button>
                                  <button
                                    type="button"
                                    disabled={authorProfile.isSelf}
                                    onClick={() => {
                                      setActiveStreamMenuId('');
                                      openChatWithMember(authorProfile);
                                    }}
                                    className="rounded-2xl border border-[#1a5c38]/35 bg-[#1a5c38]/10 px-3 py-2 text-left text-sm font-semibold text-[#191970] hover:bg-[#1a5c38]/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-[#ffffff]"
                                  >
                                    Send Private Message
                                  </button>
                                  <button
                                    type="button"
                                    disabled={authorProfile.isSelf}
                                    onClick={() => {
                                      setActiveStreamMenuId('');
                                      reportMember(authorProfile);
                                    }}
                                    className="rounded-2xl border border-[#800000]/20 bg-[#800000]/5 px-3 py-2 text-left text-sm font-semibold text-[#191970] hover:bg-[#800000]/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-[#ffffff]"
                                  >
                                    Report User
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-[#191970] dark:text-[#ffffff]">{authorProfile.name}</p>
                                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#800020] dark:text-[#bf00ff]">{authorProfile.role}{authorProfile.displayId ? ` • ${authorProfile.displayId}` : ''}</p>
                              </div>
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#800020] dark:text-[#bf00ff]">{new Date(postTimestamp).toLocaleString()}</p>
                                {canManageSelectedClass && <button type="button" onClick={() => handleEditPost(post)} className="rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] px-3 py-1 text-xs font-semibold text-[#191970] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff]">Edit</button>}
                                {canManageSelectedClass && <button type="button" onClick={() => handleDeletePost(post.id)} className="rounded-2xl border border-[#800000]/25 bg-white/70 px-3 py-1 text-xs font-semibold text-[#800000] hover:bg-[#ffe8db] dark:border-[#ff5f8d]/35 dark:bg-black/20 dark:text-[#ffffff] dark:hover:bg-[#5a1024]">Delete</button>}
                              </div>
                            </div>

                            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#191970] dark:text-[#ffffff]">{postText}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form onSubmit={handleCreatePost} className="sticky bottom-6 rounded-3xl border border-[#c9a96e]/45 bg-[#b5e3f4] p-4 shadow-[0_20px_40px_rgba(128,0,0,0.12)] dark:border-[#bf00ff]/35 dark:bg-[#800000]/78 dark:shadow-[0_0_24px_rgba(191,0,255,0.18)]">
                <textarea
                  value={draftContent}
                  onChange={event => {
                    setDraftContent(event.target.value);
                    scheduleSave(event.target.value);
                  }}
                  rows={4}
                  placeholder="Post an update to your class stream..."
                  className="w-full rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] p-3 text-sm text-[#191970] outline-none focus:ring-2 focus:ring-[#1a5c38] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff] dark:focus:ring-[#00ffff]"
                />

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStreamEmojiOpen(open => !open)}
                      className="rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] px-4 py-2 text-sm font-semibold text-[#191970] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff]"
                    >
                      Emoji
                    </button>
                  </div>
                  <button className="rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#b5e3f4] transition-colors hover:bg-[#154a2e] dark:bg-[#00ffff] dark:text-[#000000] dark:hover:bg-[#7dfcff]">Post</button>
                </div>

                {streamEmojiOpen && (
                  <div className="mt-3 flex flex-wrap gap-2 rounded-2xl border border-[#c9a96e]/35 bg-[#fff8f0] p-3 dark:border-[#bf00ff]/30 dark:bg-black/20">
                    {STREAM_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => appendStreamEmoji(emoji)}
                        className="rounded-xl border border-[#c9a96e]/35 px-3 py-2 text-lg dark:border-[#bf00ff]/30"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </form>
            </div>
          )}

          {/* upload progress indicators */}
          {Object.keys(uploadProgress).length > 0 && (
            <div className="mt-3">
              <div className="font-semibold mb-1">Upload Progress</div>
              {Object.entries(uploadProgress).map(([name, pct]) => (
                <div key={name} className="mb-2">
                  <div className="text-sm">{String(name).split(':')[0]} — {pct}%</div>
                  <div className="w-full bg-gray-200 h-2 rounded mt-1">
                    <div style={{ width: `${pct}%` }} className="h-2 bg-blue-500 rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'assignments' && (
            <TeacherAssignmentsPanel
              assignedClasses={assignedClasses}
              currentClassId={classId}
              currentClassName={selectedClass?.className || ''}
              assignments={assignments}
              canModerate={canManageSelectedClass}
              onRefreshAssignments={loadAll}
              onSelectClass={handleSelectClass}
            />
          )}

          {activeTab === 'attendance' && (
            <div className="space-y-4">
              {!canManageSelectedClass && (
                <div className="rounded-3xl border border-[#c9a96e]/45 bg-[#b5e3f4] px-4 py-4 text-sm text-[#191970] dark:border-[#bf00ff]/35 dark:bg-[#800000]/70 dark:text-[#39ff14]">
                  Only the assigned class teacher, HoS, owner, or another classroom supervisor can mark attendance for this class.
                </div>
              )}

              {canManageSelectedClass && (
                <div className="rounded-3xl border border-[#c9a96e]/45 bg-[#b5e3f4] p-5 shadow-[0_18px_42px_rgba(128,0,0,0.08)] dark:border-[#bf00ff]/35 dark:bg-[#800000]/75 dark:shadow-[0_0_28px_rgba(191,0,255,0.18)]">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-[#bf00ff]">Live Attendance</p>
                      <p className="mt-1 text-lg font-semibold text-[#800000] dark:text-[#ffffff]">Mark from class roster</p>
                    </div>
                    <span className="rounded-full bg-[#fff8f0] px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#800020] border border-[#c9a96e]/45 dark:bg-black/20 dark:border-[#bf00ff]/35 dark:text-[#bf00ff]">Roster {students.length}</span>
                  </div>

                  <form onSubmit={handleRecordAttendance} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                    <select value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)} className="rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] p-3 text-sm text-[#191970] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff]">
                      <option value="">Select student</option>
                      {students.map(student => (
                        <option key={student.id} value={student.id}>{student.name}{student.displayId ? ` (${student.displayId})` : ''}</option>
                      ))}
                    </select>
                    <input value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} type="date" className="rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] p-3 text-sm text-[#191970] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff]" />
                    <select value={attendanceStatus} onChange={e => setAttendanceStatus(e.target.value)} className="rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] p-3 text-sm text-[#191970] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff]">
                      <option value="Present">Present</option>
                      <option value="Absent">Absent</option>
                      <option value="Late">Late</option>
                      <option value="Excused">Excused</option>
                    </select>
                    <button disabled={attendanceLoading || !students.length} className="rounded-2xl bg-[#1a5c38] px-4 py-3 text-sm font-bold text-[#b5e3f4] transition-colors hover:bg-[#154a2e] disabled:opacity-60 disabled:cursor-not-allowed dark:bg-[#00ffff] dark:text-[#000000] dark:hover:bg-[#7dfcff]">
                      {attendanceLoading ? 'Recording…' : 'Record Attendance'}
                    </button>
                    <textarea value={attendanceNotes} onChange={e => setAttendanceNotes(e.target.value)} rows={3} placeholder="Optional note for this attendance mark" className="md:col-span-2 xl:col-span-4 rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] p-3 text-sm text-[#191970] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff]" />
                  </form>

                  {attendanceMessage && (
                    <p className="mt-4 text-sm font-medium text-[#800000] dark:text-[#39ff14]">{attendanceMessage}</p>
                  )}
                </div>
              )}

              <div className="rounded-3xl border border-[#c9a96e]/45 bg-[#b5e3f4] p-5 shadow-[0_18px_42px_rgba(128,0,0,0.08)] dark:border-[#bf00ff]/35 dark:bg-[#800000]/75 dark:shadow-[0_0_28px_rgba(191,0,255,0.18)]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-[#bf00ff]">Recorded Marks</p>
                    <p className="mt-1 text-lg font-semibold text-[#800000] dark:text-[#ffffff]">Latest attendance entries</p>
                  </div>
                  <span className="rounded-full bg-[#fff8f0] px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#800020] border border-[#c9a96e]/45 dark:bg-black/20 dark:border-[#bf00ff]/35 dark:text-[#bf00ff]">Records {attendance.length}</span>
                </div>

                {attendance.length === 0 ? (
                  <p className="text-sm text-[#191970] dark:text-[#39ff14]">No attendance has been recorded for this class yet.</p>
                ) : (
                  <div className="space-y-3">
                    {attendance.map(a => {
                      const student = attendanceStudentsById[a.studentId];
                      return (
                        <div key={a.id} className="rounded-2xl border border-[#c9a96e]/35 bg-[#fff8f0] p-4 dark:border-[#bf00ff]/30 dark:bg-black/20">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-[#191970] dark:text-[#ffffff]">{student?.name || a.studentId}</p>
                              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#800020] dark:text-[#bf00ff]">{a.date}</p>
                            </div>
                            <span className="rounded-full bg-[#1a5c38] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[#b5e3f4] dark:bg-[#00ffff] dark:text-[#000000]">{a.status}</span>
                          </div>
                          {(a.notes || a.recordedBy) && (
                            <div className="mt-3 space-y-1 text-sm text-[#191970] dark:text-[#39ff14]">
                              {a.notes && <p>{a.notes}</p>}
                              {a.recordedBy && <p className="text-xs font-medium text-[#800020] dark:text-[#bf00ff]">Recorded by {a.recordedBy}</p>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'subjects' && (() => {
            const subjectsList = selectedClass?.subjects || [];
            const userRole = String(storedUser?.role || '').toLowerCase();
            const canManage = selectedClass?.isClassTeacher || ['owner','hos','ict','ict_manager'].includes(userRole);
            const groupedMembers = {
              teachers: classMembers.filter(member => String(member.role || '').toLowerCase() === 'teacher'),
              caregivers: classMembers.filter(member => String(member.role || '').toLowerCase() === 'caregiver'),
              students: classMembers.filter(member => String(member.role || '').toLowerCase() === 'student'),
            };
            const currentMemberIds = new Set(classMembers.map(member => normalizeMemberIdentifier(member.id)));

            return (
              <div className="space-y-4">
                {canManageSelectedClass && (
                  <div className="rounded-3xl border border-[#c9a96e]/45 bg-[#b5e3f4] p-5 shadow-[0_18px_42px_rgba(128,0,0,0.08)] dark:border-[#bf00ff]/35 dark:bg-[#800000]/75">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-[#bf00ff]">Class Roster</p>
                        <p className="mt-1 text-lg font-semibold text-[#800000] dark:text-[#ffffff]">Add or remove teachers, students, and caregivers</p>
                      </div>
                      <span className="rounded-full bg-[#fff8f0] px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#800020] border border-[#c9a96e]/45 dark:bg-black/20 dark:border-[#bf00ff]/35 dark:text-[#bf00ff]">
                        {classMembers.length} members
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      {['teachers', 'caregivers', 'students'].map(groupKey => (
                        <div key={groupKey} className="rounded-2xl border border-[#c9a96e]/35 bg-[#fff8f0] p-3 dark:border-[#bf00ff]/30 dark:bg-black/20">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#800020] dark:text-[#bf00ff]">{groupKey}</p>
                          <div className="mt-2 space-y-2">
                            {groupedMembers[groupKey].length === 0 && <p className="text-xs text-[#191970] dark:text-[#ffffff]">None yet.</p>}
                            {groupedMembers[groupKey].map(member => (
                              <div key={`${groupKey}-${member.id}`} className="flex items-center justify-between gap-2 rounded-2xl border border-[#c9a96e]/25 bg-[#b5e3f4] px-3 py-2 dark:bg-[#35002b]">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-[#191970] dark:text-[#ffffff]">{member.name}</p>
                                  <p className="truncate text-xs text-[#800020] dark:text-[#bf00ff]">{member.displayId || member.email || member.status}</p>
                                </div>
                                <button type="button" onClick={() => handleRemoveRosterMember(member)} className="rounded-xl border border-red-300 px-3 py-1 text-xs font-semibold text-red-600">
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-2xl border border-[#c9a96e]/35 bg-[#fff8f0] p-4 dark:border-[#bf00ff]/30 dark:bg-black/20">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px,1fr]">
                        <select value={rosterRole} onChange={e => setRosterRole(e.target.value)} className="rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] p-3 text-sm text-[#191970] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff]">
                          <option value="student">Student</option>
                          <option value="teacher">Teacher</option>
                          <option value="caregiver">Caregiver</option>
                        </select>
                        <input value={rosterSearch} onChange={e => setRosterSearch(e.target.value)} placeholder={`Search ${rosterRole}s by name or email`} className="rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] p-3 text-sm text-[#191970] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff]" />
                      </div>
                      {rosterMessage && <p className="mt-3 text-sm font-medium text-[#800000] dark:text-[#39ff14]">{rosterMessage}</p>}
                      {rosterLoading && <p className="mt-3 text-sm text-[#191970] dark:text-[#ffffff]">Searching...</p>}
                      {!rosterLoading && rosterCandidates.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {rosterCandidates
                            .filter(candidate => !currentMemberIds.has(normalizeMemberIdentifier(candidate.id)))
                            .map(candidate => (
                              <div key={candidate.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#c9a96e]/35 bg-[#b5e3f4] px-3 py-2 dark:border-[#bf00ff]/30 dark:bg-[#35002b]">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-[#191970] dark:text-[#ffffff]">{candidate.name}</p>
                                  <p className="truncate text-xs text-[#800020] dark:text-[#bf00ff]">{candidate.displayId || candidate.email || candidate.role}</p>
                                </div>
                                <button type="button" onClick={() => handleAddRosterMember(rosterRole, candidate.id)} className="rounded-2xl bg-[#1a5c38] px-3 py-2 text-xs font-bold text-[#b5e3f4] dark:bg-[#00ffff] dark:text-[#000000]">
                                  Add
                                </button>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <SubjectsTab classId={classId} subjects={subjectsList} canManage={canManage} />
              </div>
            );
          })()}

          {activeTab === 'materials' && (
            <div className="space-y-4">
              <div className="rounded-3xl border border-[#c9a96e]/45 bg-[#b5e3f4] p-5 shadow-[0_18px_42px_rgba(128,0,0,0.08)] dark:border-[#bf00ff]/35 dark:bg-[#800000]/75 dark:shadow-[0_0_28px_rgba(191,0,255,0.18)]">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-[#bf00ff]">Subject Materials</p>
                    <p className="mt-1 text-lg font-semibold text-[#800000] dark:text-[#ffffff]">Publish materials by subject</p>
                  </div>
                  <span className="rounded-full bg-[#fff8f0] px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#800020] border border-[#c9a96e]/45 dark:bg-black/20 dark:border-[#bf00ff]/35 dark:text-[#bf00ff]">
                    Visibility controlled per material
                  </span>
                </div>

                {materialSubjects.length === 0 ? (
                  <div className="rounded-2xl border border-[#c9a96e]/35 bg-[#fff8f0] p-4 text-sm text-[#191970] dark:border-[#bf00ff]/30 dark:bg-black/20 dark:text-[#39ff14]">
                    Add subjects to this class before posting materials. Students only see materials tied to their class subjects.
                  </div>
                ) : (
                  <form onSubmit={handleCreateMaterial} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                    <select value={materialSubjectId} onChange={e => setMaterialSubjectId(e.target.value)} className="rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] p-3 text-sm text-[#191970] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff]">
                      {materialSubjects.map(subject => (
                        <option key={subject.id} value={subject.id}>{subject.name}</option>
                      ))}
                    </select>
                    <select value={materialType} onChange={e => setMaterialType(e.target.value)} className="rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] p-3 text-sm text-[#191970] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff]">
                      <option value="document">Document / Note</option>
                      <option value="video">Video</option>
                      <option value="audio">Audio</option>
                      <option value="image">Image</option>
                      <option value="link">External Link</option>
                    </select>
                    <input value={materialTitle} onChange={e => setMaterialTitle(e.target.value)} placeholder="Material title" className="rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] p-3 text-sm text-[#191970] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff]" />
                    <input value={materialUrl} onChange={e => setMaterialUrl(e.target.value)} placeholder="Paste a material link (optional). Leave blank for a lesson note." className="rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] p-3 text-sm text-[#191970] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff]" />
                    <input list="material-topic-options" value={materialTopic} onChange={e => setMaterialTopic(e.target.value)} placeholder="Topic — pick existing or type a new one" className="rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] p-3 text-sm text-[#191970] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff]" />
                    <datalist id="material-topic-options">
                      {materialTopicOptions.map(t => <option key={t.id || t.name} value={t.name} />)}
                    </datalist>
                    <input value={materialWeekLabel} onChange={e => setMaterialWeekLabel(e.target.value)} placeholder="Week label" className="rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] p-3 text-sm text-[#191970] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff]" />
                    <select value={materialVisibility} onChange={e => setMaterialVisibility(e.target.value)} className="rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] p-3 text-sm text-[#191970] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff]">
                      <option value="student_parent">Students + Parents</option>
                      <option value="student">Students Only</option>
                      <option value="teacher">Teacher Only</option>
                    </select>
                    <input value={materialReleaseAt} onChange={e => setMaterialReleaseAt(e.target.value)} type="datetime-local" className="rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] p-3 text-sm text-[#191970] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff]" />
                    <textarea value={materialDescription} onChange={e => setMaterialDescription(e.target.value)} rows={4} placeholder="Paste the lesson note here, or add the guidance students should read before opening the material." className="md:col-span-2 xl:col-span-4 rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] p-3 text-sm text-[#191970] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff]" />
                    <div className="md:col-span-2 xl:col-span-4 flex flex-wrap gap-3 items-center">
                      <label className="inline-flex cursor-pointer items-center rounded-2xl bg-[#fff8f0] px-4 py-3 text-sm font-semibold text-[#191970] border border-[#c9a96e]/45 dark:bg-black/20 dark:border-[#bf00ff]/35 dark:text-[#ffffff]">
                        <input id="materialFile" type="file" multiple className="hidden" onChange={(e) => { const files = e.target.files; if (!files?.length) return; queueMaterialFiles(files); e.target.value = ''; }} />
                        Upload file
                      </label>
                      <button className="rounded-2xl bg-[#1a5c38] px-4 py-3 text-sm font-bold text-[#b5e3f4] transition-colors hover:bg-[#154a2e] dark:bg-[#00ffff] dark:text-[#000000] dark:hover:bg-[#7dfcff]">
                        {pendingMaterialFiles.length > 0
                          ? `Post ${pendingMaterialFiles.length} File${pendingMaterialFiles.length === 1 ? '' : 's'}`
                          : materialUrl.trim() ? 'Post Material' : 'Publish Lesson Note'}
                      </button>
                      {selectedMaterialSubject && (
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#800020] dark:text-[#bf00ff]">
                          Posting to {selectedMaterialSubject.name} • {formatVisibilityLabel(materialVisibility)}
                        </span>
                      )}
                    </div>
                    {pendingMaterialFiles.length > 0 && (
                      <div className="md:col-span-2 xl:col-span-4 rounded-2xl border border-[#c9a96e]/35 bg-[#fff8f0] p-3 dark:border-[#bf00ff]/30 dark:bg-black/20">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#800020] dark:text-[#bf00ff]">Queued files</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {pendingMaterialFiles.map(file => {
                            const fileKey = buildMaterialUploadKey(file);
                            return (
                              <div key={fileKey} className="flex items-center gap-2 rounded-2xl border border-[#c9a96e]/35 bg-[#b5e3f4] px-3 py-2 dark:border-[#bf00ff]/30 dark:bg-[#35002b]">
                                <span className="max-w-[180px] truncate text-sm font-semibold text-[#191970] dark:text-[#ffffff]">{file.name}</span>
                                <button type="button" onClick={() => removePendingMaterialFile(fileKey)} className="rounded-xl border border-[#800000]/25 bg-white/70 px-2 py-1 text-xs font-semibold text-[#800000] hover:bg-[#ffe8db] dark:border-[#ff5f8d]/35 dark:bg-black/20 dark:text-[#ffffff] dark:hover:bg-[#5a1024]">
                                  Remove
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </form>
                )}

                {materialMessage && (
                  <p className="mt-4 text-sm font-medium text-[#800000] dark:text-[#39ff14]">{materialMessage}</p>
                )}
              </div>

              <div className="rounded-3xl border border-[#c9a96e]/45 bg-[#b5e3f4] p-5 shadow-[0_18px_42px_rgba(128,0,0,0.08)] dark:border-[#bf00ff]/35 dark:bg-[#800000]/75 dark:shadow-[0_0_28px_rgba(191,0,255,0.18)]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-[#bf00ff]">Published Materials</p>
                    <p className="mt-1 text-lg font-semibold text-[#800000] dark:text-[#ffffff]">Latest uploads and links</p>
                  </div>
                  <span className="rounded-full bg-[#fff8f0] px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#800020] border border-[#c9a96e]/45 dark:bg-black/20 dark:border-[#bf00ff]/35 dark:text-[#bf00ff]">Items {materials.length}</span>
                </div>

                {materials.length === 0 ? (
                  <p className="text-sm text-[#191970] dark:text-[#39ff14]">No materials have been posted for this class yet.</p>
                ) : (
                  <div className="space-y-3">
                    {materials.map(material => (
                      <div key={material.id} className="rounded-2xl border border-[#c9a96e]/35 bg-[#fff8f0] p-4 dark:border-[#bf00ff]/30 dark:bg-black/20">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="flex min-w-0 flex-1 items-start gap-4">
                            <MaterialTypeThumbnail material={material} />
                            <div className="min-w-0 flex-1">
                            <p className="font-semibold text-[#191970] dark:text-[#ffffff]">{material.title}</p>
                            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#800020] dark:text-[#bf00ff]">{material.subjectName || 'General Material'} • {materialTypeLabel(material)}</p>
                            {(material.topic || material.weekLabel) && <p className="mt-2 text-xs text-[#800020] dark:text-[#bf00ff]">{material.topic || 'Lesson note'}{material.weekLabel ? ` • ${material.weekLabel}` : ''}</p>}
                            {material.description && <p className="mt-2 text-sm whitespace-pre-wrap text-[#191970] dark:text-[#39ff14]">{material.description}</p>}
                            <p className="mt-2 text-xs text-[#800020] dark:text-[#bf00ff]">{formatVisibilityLabel(material.visibility)} • {formatReleaseLabel(material.releaseAt)}</p>
                            <p className="mt-2 text-xs text-[#800020] dark:text-[#bf00ff]">{material.uploadedAt ? new Date(material.uploadedAt).toLocaleString() : 'Recently uploaded'}{material.uploadedByName ? ` • ${material.uploadedByName}` : ''}</p>
                          </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {canManageSelectedClass && <button type="button" onClick={() => handleEditMaterial(material)} className="rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] px-4 py-2 text-sm font-semibold text-[#191970] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff]">Edit</button>}
                            {(canManageSelectedClass || [storedUser?.id, storedUser?.email, storedUser?.displayId].filter(Boolean).some(uid => uid && material.uploadedById && String(uid).toLowerCase() === String(material.uploadedById).toLowerCase())) && <button type="button" onClick={() => handleDeleteMaterial(material)} className="rounded-2xl border border-[#800000]/25 bg-white/70 px-4 py-2 text-sm font-semibold text-[#800000] hover:bg-[#ffe8db] dark:border-[#ff5f8d]/35 dark:bg-black/20 dark:text-[#ffffff] dark:hover:bg-[#5a1024]">Delete</button>}
                            <button type="button" onClick={() => setActiveMaterial(material)} className="rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#b5e3f4] transition-colors hover:bg-[#154a2e] dark:bg-[#00ffff] dark:text-[#000000] dark:hover:bg-[#7dfcff]">
                              {material.url ? 'Open Material' : 'Read Note'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'live' && (
            <div className="space-y-4">
              <div className="rounded-3xl border border-[#c9a96e]/45 bg-[#b5e3f4] p-5 shadow-[0_18px_42px_rgba(128,0,0,0.08)] dark:border-[#bf00ff]/35 dark:bg-[#800000]/75 dark:shadow-[0_0_28px_rgba(191,0,255,0.18)]">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-[#bf00ff]">Live Classroom</p>
                    <p className="mt-1 text-lg font-semibold text-[#800000] dark:text-[#ffffff]">Start a subject live session</p>
                  </div>
                  <span className="rounded-full bg-[#fff8f0] px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#800020] border border-[#c9a96e]/45 dark:bg-black/20 dark:border-[#bf00ff]/35 dark:text-[#bf00ff]">
                    Sessions {liveSessions.length}
                  </span>
                </div>

                {materialSubjects.length === 0 ? (
                  <div className="rounded-2xl border border-[#c9a96e]/35 bg-[#fff8f0] p-4 text-sm text-[#191970] dark:border-[#bf00ff]/30 dark:bg-black/20 dark:text-[#39ff14]">
                    Add or assign subjects to this class before starting a live class.
                  </div>
                ) : (
                  <form onSubmit={handleStartLiveSession} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                    <select value={liveSubjectId} onChange={e => setLiveSubjectId(e.target.value)} className="rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] p-3 text-sm text-[#191970] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff]">
                      {materialSubjects.map(subject => (
                        <option key={subject.id} value={subject.id}>{subject.name}</option>
                      ))}
                    </select>
                    <input value={liveTopic} onChange={e => setLiveTopic(e.target.value)} placeholder="Live topic or agenda" className="rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] p-3 text-sm text-[#191970] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff]" />
                    <select value={liveMode} onChange={e => setLiveMode(e.target.value)} className="rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] p-3 text-sm text-[#191970] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff]">
                      <option value="Video + Audio">Video + Audio</option>
                      <option value="Audio Only">Audio Only</option>
                      <option value="Screen Share">Screen Share</option>
                    </select>
                    <button disabled={liveLoading} className="rounded-2xl bg-[#1a5c38] px-4 py-3 text-sm font-bold text-[#b5e3f4] transition-colors hover:bg-[#154a2e] disabled:opacity-60 disabled:cursor-not-allowed dark:bg-[#00ffff] dark:text-[#000000] dark:hover:bg-[#7dfcff]">
                      {liveLoading ? 'Starting…' : 'Start Live Class'}
                    </button>
                  </form>
                )}

                {liveMessage && (
                  <p className="mt-4 text-sm font-medium text-[#800000] dark:text-[#39ff14]">{liveMessage}</p>
                )}
              </div>

              <div className="rounded-3xl border border-[#c9a96e]/45 bg-[#b5e3f4] p-5 shadow-[0_18px_42px_rgba(128,0,0,0.08)] dark:border-[#bf00ff]/35 dark:bg-[#800000]/75 dark:shadow-[0_0_28px_rgba(191,0,255,0.18)]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-[#bf00ff]">Live Session Feed</p>
                    <p className="mt-1 text-lg font-semibold text-[#800000] dark:text-[#ffffff]">Current and recent live classes</p>
                  </div>
                </div>

                {liveSessions.length === 0 ? (
                  <p className="text-sm text-[#191970] dark:text-[#39ff14]">No live classes have been started for this class yet.</p>
                ) : (
                  <div className="space-y-3">
                    {liveSessions.map(session => {
                      const isActive = String(session.status || '').toLowerCase() !== 'ended';
                      return (
                        <div key={session.id} className="rounded-2xl border border-[#c9a96e]/35 bg-[#fff8f0] p-4 dark:border-[#bf00ff]/30 dark:bg-black/20">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-[#191970] dark:text-[#ffffff]">{session.subjectName || 'Live Class'} • {session.topic}</p>
                              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#800020] dark:text-[#bf00ff]">{session.mode} • {session.createdByName || session.createdBy || 'Teacher'}</p>
                              <p className="mt-2 text-sm text-[#191970] dark:text-[#39ff14]">Started {session.startedAt ? new Date(session.startedAt).toLocaleString() : 'Recently'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${isActive ? 'bg-[#1a5c38] text-[#b5e3f4] dark:bg-[#00ffff] dark:text-[#000000]' : 'bg-[#fff8f0] text-[#800020] border border-[#c9a96e]/45 dark:bg-black/20 dark:text-[#bf00ff] dark:border-[#bf00ff]/35'}`}>
                                {session.status || 'Live Now'}
                              </span>
                              {isActive && (
                                <button type="button" onClick={() => handleEndLiveSession(session.id)} className="rounded-2xl border border-[#800000]/20 bg-[#fff8f0] px-4 py-2 text-sm font-semibold text-[#800000] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff]">
                                  End Live Class
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>}

        {profileMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-lg rounded-[2rem] border border-[#c9a96e]/45 bg-[#fff8f0] p-6 shadow-[0_24px_60px_rgba(15,23,42,0.35)] dark:border-[#bf00ff]/35 dark:bg-[#26001f]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#800020] dark:text-[#bf00ff]">Classroom Profile</p>
                  <h3 className="mt-2 text-2xl font-semibold text-[#191970] dark:text-[#ffffff]">{profileMember.name}</h3>
                  <p className="mt-2 text-sm text-[#191970] dark:text-[#ffffff]">{profileMember.role} • {profileMember.status}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setProfileMember(null)}
                  className="rounded-2xl border border-[#c9a96e]/45 px-4 py-2 text-sm font-semibold text-[#191970] hover:bg-[#b5e3f4] dark:border-[#bf00ff]/35 dark:text-[#ffffff] dark:hover:bg-black/25"
                >
                  Close
                </button>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-[#c9a96e]/35 bg-[#b5e3f4] p-4 dark:border-[#bf00ff]/30 dark:bg-black/20">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-[#bf00ff]">Display ID</p>
                  <p className="mt-2 text-sm text-[#191970] dark:text-[#ffffff]">{profileMember.displayId || 'Not shared'}</p>
                </div>
                <div className="rounded-2xl border border-[#c9a96e]/35 bg-[#b5e3f4] p-4 dark:border-[#bf00ff]/30 dark:bg-black/20">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-[#bf00ff]">Class</p>
                  <p className="mt-2 text-sm text-[#191970] dark:text-[#ffffff]">{profileMember.className || classroomLabel}</p>
                </div>
                <div className="rounded-2xl border border-[#c9a96e]/35 bg-[#b5e3f4] p-4 md:col-span-2 dark:border-[#bf00ff]/30 dark:bg-black/20">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-[#bf00ff]">School Email</p>
                  <p className="mt-2 text-sm text-[#191970] dark:text-[#ffffff]">{profileMember.email || 'Not shared'}</p>
                </div>
              </div>

              {!profileMember.isSelf && (
                <div className="mt-6 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMember(null);
                      openChatWithMember(profileMember);
                    }}
                    className="rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#b5e3f4] transition-colors hover:bg-[#154a2e] dark:bg-[#00ffff] dark:text-[#000000] dark:hover:bg-[#7dfcff]"
                  >
                    Send Private Message
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMember(null);
                      reportMember(profileMember);
                    }}
                    className="rounded-2xl border border-[#800000]/20 bg-[#fff8f0] px-4 py-2 text-sm font-semibold text-[#800000] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff]"
                  >
                    Report User
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeMaterial ? (
          <MaterialViewer material={activeMaterial} onClose={() => setActiveMaterial(null)} />
        ) : null}
      </div>
      <MobileRoleOverviewNav roleKey={currentRoleKey || 'teacher'} />
    </StudentSectionShell>
  );
}
