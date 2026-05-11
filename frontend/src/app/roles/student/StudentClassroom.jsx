import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStoredAuth } from '../../../features/auth/services/authApi';
import * as svc from '../../../features/classroom/classroomService';
import {
  AcademicCapIcon,
  ArrowLeftIcon,
  BookOpenIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  LightBulbIcon,
  MegaphoneIcon,
  MicrophoneIcon,
  PhoneXMarkIcon,
  PlayCircleIcon,
  UserGroupIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/outline';

function normalizeStreamPost(post) {
  return {
    ...post,
    author: post?.author || post?.authorName || post?.authorId || 'Teacher',
    text: post?.text || post?.content || '',
    comments: Array.isArray(post?.comments) ? post.comments : [],
  };
}

export default function StudentClassroom() {
  const navigate = useNavigate();
  const storedAuth = getStoredAuth();
  const storedClassName = storedAuth?.user?.className || null;
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeTab, setActiveTab] = useState('stream');
  const [groupMode, setGroupMode] = useState('subject');
  const [joinedLiveId, setJoinedLiveId] = useState(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  const [teacherSettings] = useState({
    commentsEnabled: true,
    studentAnnouncementsEnabled: false,
  });

  const [streamPosts, setStreamPosts] = useState([]);
  const [streamInput, setStreamInput] = useState('');
  const [commentInputs, setCommentInputs] = useState({});
  const [tasks, setTasks] = useState([]);
  const [liveSessions, setLiveSessions] = useState([]);
  const [classroomMaterials, setClassroomMaterials] = useState([]);
  const [classSubjects, setClassSubjects] = useState([]);
  const [classMembers, setClassMembers] = useState([]);
  const [classroomLoading, setClassroomLoading] = useState(true);
  const [classroomLabel, setClassroomLabel] = useState(storedClassName || localStorage.getItem('classroomId') || 'Assigned Classroom');

  useEffect(() => {
    const classId = localStorage.getItem('classroomId');
    if (!classId) { setClassroomLoading(false); return; }
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    setClassroomLoading(true);
    Promise.all([
      fetch(`/api/classrooms/${classId}`, { headers }).then(r => r.ok ? r.json() : { success: false, class: null }),
      fetch(`/api/classrooms/${classId}/stream`, { headers }).then(r => r.ok ? r.json() : { posts: [] }),
      fetch(`/api/classrooms/${classId}/assignments`, { headers }).then(r => r.ok ? r.json() : { assignments: [] }),
      fetch(`/api/classrooms/${classId}/materials`, { headers }).then(r => r.ok ? r.json() : { materials: [] }),
      fetch(`/api/classrooms/${classId}/members`, { headers }).then(r => r.ok ? r.json() : { members: [] }),
      svc.getClassSubjects(classId).catch(() => ({ subjects: [] })),
      svc.getLiveSessions(classId).catch(() => ({ sessions: [] })),
    ]).then(([classRes, postsRes, assignRes, matRes, membersRes, subjectsRes, liveRes]) => {
      const resolvedClassName = classRes?.class?.name
        ? `${classRes.class.name}${classRes.class.arm ? ` ${classRes.class.arm}` : ''}`
        : (storedClassName || classId);
      const classSubjectRows = subjectsRes?.subjects || [];
      setClassroomLabel(resolvedClassName);
      try {
        const authUser = JSON.parse(localStorage.getItem('authUser') || '{}');
        localStorage.setItem('authUser', JSON.stringify({ ...authUser, classId, className: resolvedClassName }));
      } catch {}
      setStreamPosts((postsRes.posts || []).map(normalizeStreamPost));
      setTasks(assignRes.assignments || []);
      setClassroomMaterials(matRes.materials || []);
      setClassSubjects(classSubjectRows);
      setClassMembers(membersRes.members || []);
      setLiveSessions(liveRes.sessions || []);
    }).catch(() => {}).finally(() => setClassroomLoading(false));
  }, [storedClassName]);

  // Poll stream every 15 s so all users see new posts without full reload
  useEffect(() => {
    const classId = localStorage.getItem('classroomId');
    if (!classId) return;
    const poll = setInterval(() => {
      Promise.all([
        fetch(`/api/classrooms/${classId}/stream`, { headers: localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {} }).then(r => r.ok ? r.json() : null),
        svc.getLiveSessions(classId).catch(() => null),
      ]).then(([json, liveJson]) => {
        if (json && json.posts) {
            setStreamPosts(prev => {
              // merge: keep optimistic posts not yet confirmed, prepend new server posts
              const nextPosts = json.posts.map(normalizeStreamPost);
              const serverIds = new Set(nextPosts.map(p => p.id));
              const optimistic = prev.filter(p => !serverIds.has(p.id) && p.isStudentPost);
              return [...optimistic, ...nextPosts];
            });
        }

        if (liveJson && liveJson.success) {
          setLiveSessions(liveJson.sessions || []);
        }
      }).catch(() => {});
    }, 15000);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const groupedTasks = useMemo(() => {
    const labelByMode = {
      subject: task => task.subjectName || 'General Subject',
      format: task => {
        const format = String(task.format || '').toLowerCase();
        if (format === 'mcq') return 'MCQ';
        if (format === 'shortanswer') return 'Short Answer';
        if (format === 'fillgaps') return 'Fill In The Blanks';
        if (format === 'crossmatching') return 'Cross Matching';
        if (format === 'essay') return 'Essay';
        if (format === 'comprehension') return 'Comprehension';
        if (format === 'longanswer') return 'Long Answer';
        if (format === 'mixed') return 'Mixed Format';
        return 'Assignment';
      },
      status: task => (task.mySubmission ? 'Submitted' : 'Pending'),
    };

    const resolver = labelByMode[groupMode] || labelByMode.subject;
    const groups = tasks.reduce((accumulator, task) => {
      const groupValue = resolver(task);
      if (!accumulator[groupValue]) {
        accumulator[groupValue] = [];
      }
      accumulator[groupValue].push(task);
      return accumulator;
    }, {});

    return Object.entries(groups).map(([label, items]) => ({
      label,
      items,
    }));
  }, [groupMode, tasks]);

  const statusCounts = useMemo(() => {
    const pending = tasks.filter(task => !task.mySubmission).length;
    const submitted = tasks.filter(task => task.mySubmission && task.mySubmission.grade == null && !task.mySubmission.feedback).length;
    const reviewed = tasks.filter(task => task.mySubmission && (task.mySubmission.grade != null || task.mySubmission.feedback)).length;
    return { pending, submitted, reviewed };
  }, [tasks]);

  const postAnnouncement = async () => {
    if (!teacherSettings.studentAnnouncementsEnabled) return;
    if (!streamInput.trim()) return;
    const classId = localStorage.getItem('classroomId');
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId') || 'student';
    const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const optimistic = {
      id: `stream-${Date.now()}`,
      author: 'You',
      text: streamInput.trim(),
      pinned: false,
      comments: [],
      isStudentPost: true,
      createdAt: new Date().toISOString(),
    };
    setStreamPosts(prev => [optimistic, ...prev]);
    setStreamInput('');
    if (classId) {
      try {
        const res = await fetch(`/api/classrooms/${classId}/stream`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ text: optimistic.text, authorId: userId }),
        });
        const json = res.ok ? await res.json() : null;
        if (json && (json.post || json.id)) {
          const saved = normalizeStreamPost(json.post || json);
          setStreamPosts(prev => prev.map(p => p.id === optimistic.id ? { ...optimistic, ...saved } : p));
        }
      } catch { /* keep optimistic */ }
    }
  };

  const addComment = async (postId) => {
    if (!teacherSettings.commentsEnabled) return;
    const text = (commentInputs[postId] || '').trim();
    if (!text) return;
    const classId = localStorage.getItem('classroomId');
    const userId = localStorage.getItem('userId') || 'student';
    const optimistic = { id: `cm-${Date.now()}`, user: 'You', text };
    setStreamPosts(prev => prev.map(post => (
      post.id === postId ? { ...post, comments: [...post.comments, optimistic] } : post
    )));
    setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    if (classId) {
      try {
        await svc.addPostComment(classId, postId, { text, authorId: userId });
      } catch { /* keep optimistic */ }
    }
  };

  const openTaskWorkspace = (taskId) => {
    navigate(`/roles/student/assignments/${taskId}`);
  };

  const goBackToDashboard = () => {
    navigate('/roles/student');
  };

  const formatAssignmentType = assignment => {
    const format = String(assignment.format || '').toLowerCase();
    if (format === 'mcq') return 'MCQ';
    if (format === 'shortanswer') return 'Short Answer';
    if (format === 'fillgaps') return 'Fill In The Blanks';
    if (format === 'crossmatching') return 'Cross Matching';
    if (format === 'essay') return 'Essay';
    if (format === 'comprehension') return 'Comprehension';
    if (format === 'longanswer') return 'Long Answer';
    if (format === 'mixed') return 'Mixed Format';
    return 'Assignment';
  };

  const formatAssignmentDue = value => {
    if (!value) return 'No due date';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
  };

  const formatMaterialType = value => {
    switch (String(value || '').toLowerCase()) {
      case 'video':
        return 'Video';
      case 'image':
        return 'Image';
      case 'link':
        return 'Link';
      default:
        return 'Document';
    }
  };

  const materialSubjectName = material => material.subjectName || material.metadata?.subjectName || 'General Material';

  const typeClass = taskType => {
    if (taskType === 'MCQ' || taskType === 'Short Answer') return 'accent-indigo';
    if (taskType === 'Essay' || taskType === 'Long Answer' || taskType === 'Comprehension') return 'accent-rose';
    if (taskType === 'Cross Matching' || taskType === 'Fill In The Blanks') return 'accent-emerald';
    return 'accent-amber';
  };

  const statusClass = status => {
    if (status === 'Submitted' || status === 'Reviewed') return 'accent-emerald';
    return 'accent-amber';
  };

  const tabButtonClass = tabKey => (
    activeTab === tabKey
      ? 'px-4 py-2 rounded-2xl font-semibold bg-[#800020] text-white border border-[#c27a8d] shadow-[0_12px_30px_rgba(128,0,32,0.28)]'
      : 'px-4 py-2 rounded-2xl font-semibold bg-[#800020] text-white border border-[#a64d68] hover:bg-[#670019] hover:border-[#d196a6] transition-colors'
  );

  const bottomTabs = [
    { key: 'stream', label: 'Stream', icon: MegaphoneIcon },
    { key: 'subjects', label: 'Subjects', icon: AcademicCapIcon },
    { key: 'materials', label: 'Materials', icon: DocumentTextIcon },
    { key: 'practice', label: 'Practice', icon: LightBulbIcon },
    { key: 'assignment', label: 'Assignment', icon: ClipboardDocumentListIcon },
    { key: 'live', label: 'Live', icon: PlayCircleIcon },
    { key: 'students', label: 'Classmates', icon: UserGroupIcon },
    { key: 'teachers', label: 'Teachers', icon: BookOpenIcon },
  ];

  const subjectRows = useMemo(() => {
    const subjectMap = new Map();

    classSubjects.forEach(subject => {
      const subjectName = String(subject.name || '').trim();
      if (!subjectName) return;
      subjectMap.set(subjectName, {
        topic: subjectName,
        count: 0,
        nextDue: 'No due item',
        submittedCount: 0,
        items: [],
      });
    });

    tasks.forEach(task => {
      const subjectName = String(task.subjectName || 'General Subject').trim() || 'General Subject';
      if (!subjectMap.has(subjectName)) {
        subjectMap.set(subjectName, {
          topic: subjectName,
          count: 0,
          nextDue: 'No due item',
          submittedCount: 0,
          items: [],
        });
      }

      const currentRow = subjectMap.get(subjectName);
      currentRow.items.push(task);
      currentRow.count = currentRow.items.length;
      currentRow.submittedCount = currentRow.items.filter(item => item.mySubmission).length;
      currentRow.nextDue = currentRow.items[0]?.dueAt ? formatAssignmentDue(currentRow.items[0].dueAt) : 'No due item';
    });

    return Array.from(subjectMap.values()).sort((first, second) => first.topic.localeCompare(second.topic));
  }, [classSubjects, tasks]);

  const practiceRows = useMemo(() => {
    return subjectRows.map(subject => {
      const materialCount = classroomMaterials.filter(material => materialSubjectName(material) === subject.topic).length;
      const pendingItems = subject.items.filter(item => !item.mySubmission);

      return {
        ...subject,
        materialCount,
        pendingCount: pendingItems.length,
        primaryTask: pendingItems[0] || subject.items[0] || null,
      };
    });
  }, [classroomMaterials, subjectRows]);

  const studentMembers = classMembers.filter(member => String(member.role || '').toLowerCase() === 'student');
  const teacherMembers = classMembers.filter(member => String(member.role || '').toLowerCase() === 'teacher');

  return (
    <div className={`min-h-screen ${isMobile ? 'p-4 pb-24' : 'p-8'} max-w-5xl mx-auto`}>
      {classroomLoading && (
        <div className="glass-surface rounded-3xl p-6 mb-4">
          <p className="neon-subtle text-sm">Loading classroom data…</p>
        </div>
      )}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={goBackToDashboard}
          className="p-2 rounded-xl border border-slate-200 dark:border-cyan-300/20 bg-white/80 dark:bg-slate-800/45"
          aria-label="Exit Classroom"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div>
          <p className="micro-label neon-subtle">Classroom Mode</p>
          <p className="font-semibold text-slate-800 dark:text-slate-100">{classroomLabel}</p>
        </div>
      </div>

      {!isMobile && (
        <div className="glass-surface rounded-3xl p-4 mb-4 flex flex-wrap gap-2">
          {bottomTabs.map(tab => (
            <button key={tab.key} className={tabButtonClass(tab.key)} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>
          ))}
        </div>
      )}

      {activeTab === 'subjects' && (
        <div className="space-y-4">
          <section className="glass-surface rounded-3xl p-5">
            <h2 className="text-xl command-title neon-title">Subjects</h2>
            <p className="neon-subtle mt-2">See each subject and the assignments your teachers created for it.</p>
          </section>

          <section className="space-y-3">
            {subjectRows.map(subject => (
              <div key={subject.topic} className="glass-surface rounded-3xl p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-slate-100 font-semibold">{subject.topic}</p>
                  <span className="glass-chip px-3 py-1 rounded-full micro-label accent-indigo">{subject.count} item(s)</span>
                </div>
                <p className="text-sm neon-subtle mt-1">Next due: {subject.nextDue}</p>
                <p className="micro-label mt-2 accent-emerald">Submitted: {subject.submittedCount}</p>
                <div className="mt-3 space-y-2">
                  {subject.items.map(task => {
                    const assignmentType = formatAssignmentType(task);
                    const assignmentStatus = task.mySubmission ? (task.mySubmission.grade != null || task.mySubmission.feedback ? 'Reviewed' : 'Submitted') : 'Pending';
                    return (
                      <button key={task.id} onClick={() => openTaskWorkspace(task.id)} className="w-full text-left rounded-2xl border border-white/10 p-4 bg-slate-900/30 hover:bg-indigo-500/10 transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-slate-100 font-semibold">{task.title}</p>
                          <span className={`micro-label ${typeClass(assignmentType)}`}>{assignmentType}</span>
                        </div>
                        <p className="text-sm neon-subtle mt-1">Due: {formatAssignmentDue(task.dueAt)}</p>
                        <p className={`micro-label mt-2 ${statusClass(assignmentStatus)}`}>{assignmentStatus}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {subjectRows.length === 0 && (
              <div className="glass-surface rounded-3xl p-4">
                <p className="text-sm text-slate-300">No subject data available yet.</p>
              </div>
            )}
          </section>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="glass-surface rounded-3xl p-4">
              <p className="micro-label neon-subtle">Due</p>
              <p className="text-2xl command-title accent-amber">{statusCounts.pending}</p>
            </div>
            <div className="glass-surface rounded-3xl p-4">
              <p className="micro-label neon-subtle">Submitted</p>
              <p className="text-2xl command-title accent-emerald">{statusCounts.submitted}</p>
            </div>
            <div className="glass-surface rounded-3xl p-4">
              <p className="micro-label neon-subtle">Reviewed</p>
              <p className="text-2xl command-title accent-indigo">{statusCounts.reviewed}</p>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'materials' && (
        <section className="glass-surface rounded-3xl p-5">
          <h2 className="text-xl command-title neon-title mb-4">Materials</h2>
          <div className="space-y-3">
            {classroomMaterials.map(material => (
              <div key={material.id} className="rounded-2xl border border-white/10 p-4 bg-slate-900/30 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-slate-100 font-semibold">{material.title}</p>
                    <span className="glass-chip px-3 py-1 rounded-full micro-label accent-emerald">{formatMaterialType(material.type)}</span>
                  </div>
                  <p className="text-sm neon-subtle mt-1">Subject: {materialSubjectName(material)}</p>
                  {material.description && <p className="text-sm text-slate-300 mt-2">{material.description}</p>}
                  <p className="neon-subtle text-xs mt-2">{material.uploadedAt ? new Date(material.uploadedAt).toLocaleString() : 'Recently uploaded'}{material.uploadedByName ? ` • ${material.uploadedByName}` : ''}</p>
                </div>
                {material.url ? (
                  <a href={material.url} target="_blank" rel="noreferrer" className="rounded-2xl bg-emerald-500/30 border border-emerald-300/40 px-4 py-2 text-sm font-semibold text-white">
                    Open
                  </a>
                ) : (
                  <span className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200">
                    Teacher Note
                  </span>
                )}
              </div>
            ))}
            {classroomMaterials.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 p-4 bg-slate-900/20 text-center">
                <p className="micro-label accent-amber">No materials yet</p>
                <p className="mt-2 text-sm text-slate-300">Teacher-posted subject materials will show here automatically.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === 'practice' && (
        <section className="glass-surface rounded-3xl p-5">
          <h2 className="text-xl command-title neon-title mb-4">Practice</h2>
          <div className="space-y-3">
            {practiceRows.map(item => (
              <div key={item.topic} className="rounded-2xl border border-white/10 p-4 bg-slate-900/30">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-slate-100 font-semibold">{item.topic}</p>
                  <span className="glass-chip px-3 py-1 rounded-full micro-label accent-indigo">{item.count} assignment(s)</span>
                </div>
                <p className="text-sm neon-subtle mt-1">Pending practice: {item.pendingCount} • Materials: {item.materialCount}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.primaryTask ? (
                    <button onClick={() => openTaskWorkspace(item.primaryTask.id)} className="px-4 py-2 rounded-2xl bg-indigo-500/30 border border-indigo-300/40 text-white text-sm font-semibold">
                      Open Practice Assignment
                    </button>
                  ) : (
                    <button onClick={() => setActiveTab('subjects')} className="px-4 py-2 rounded-2xl bg-slate-800/40 border border-white/10 text-slate-100 text-sm font-semibold">
                      Review Subject
                    </button>
                  )}
                  {item.materialCount > 0 && (
                    <button onClick={() => setActiveTab('materials')} className="px-4 py-2 rounded-2xl bg-emerald-500/30 border border-emerald-300/40 text-white text-sm font-semibold">
                      Review Materials
                    </button>
                  )}
                </div>
              </div>
            ))}
            {practiceRows.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 p-4 bg-slate-900/20 text-center">
                <p className="micro-label accent-amber">No linked practice yet</p>
                <p className="mt-2 text-sm text-slate-300">Practice cards will appear once subjects, assignments, or materials are available for this class.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === 'assignment' && (
        <div className="space-y-4">
          <section className="glass-surface rounded-3xl p-4 flex flex-wrap items-center gap-2">
            <span className="micro-label neon-subtle mr-2">Group by</span>
            <button onClick={() => setGroupMode('subject')} className={groupMode === 'subject' ? 'glass-chip px-3 py-1 rounded-full micro-label accent-indigo' : 'px-3 py-1 rounded-full border border-white/10 micro-label'}>Subject</button>
            <button onClick={() => setGroupMode('format')} className={groupMode === 'format' ? 'glass-chip px-3 py-1 rounded-full micro-label accent-indigo' : 'px-3 py-1 rounded-full border border-white/10 micro-label'}>Format</button>
            <button onClick={() => setGroupMode('status')} className={groupMode === 'status' ? 'glass-chip px-3 py-1 rounded-full micro-label accent-indigo' : 'px-3 py-1 rounded-full border border-white/10 micro-label'}>Status</button>
          </section>

          <section className="space-y-3">
            {groupedTasks.map(group => (
              <div key={group.label} className="glass-surface rounded-3xl p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-slate-100 font-semibold">{group.label}</p>
                  <span className="micro-label accent-indigo">{group.items.length} assignment(s)</span>
                </div>

                <div className="mt-3 space-y-3">
                  {group.items.map(task => {
                    const assignmentType = formatAssignmentType(task);
                    const assignmentStatus = task.mySubmission ? (task.mySubmission.grade != null || task.mySubmission.feedback ? 'Reviewed' : 'Submitted') : 'Pending';
                    return (
                      <button key={task.id} onClick={() => openTaskWorkspace(task.id)} className="w-full text-left rounded-2xl border border-white/10 p-4 bg-slate-900/30 hover:bg-indigo-500/10 transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-slate-100 font-semibold">{task.title}</p>
                          <span className={`micro-label ${typeClass(assignmentType)}`}>{assignmentType}</span>
                        </div>
                        <p className="text-sm neon-subtle mt-1">{task.subjectName || 'General Subject'} • Due: {formatAssignmentDue(task.dueAt)}</p>
                        <p className={`micro-label mt-2 ${statusClass(assignmentStatus)}`}>{assignmentStatus}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {groupedTasks.length === 0 && (
              <div className="glass-surface rounded-3xl p-4">
                <p className="text-sm text-slate-300">No assignments published for this class yet.</p>
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === 'stream' && (
        <div className="space-y-4">
          <section className="glass-surface rounded-3xl p-4">
            <div className="flex flex-wrap gap-2 mb-3">
              <span className={`glass-chip px-3 py-1 rounded-full micro-label ${teacherSettings.commentsEnabled ? 'accent-emerald' : 'accent-rose'}`}>
                Comments {teacherSettings.commentsEnabled ? 'Enabled' : 'Disabled'}
              </span>
              <span className={`glass-chip px-3 py-1 rounded-full micro-label ${teacherSettings.studentAnnouncementsEnabled ? 'accent-emerald' : 'accent-amber'}`}>
                Student Posts {teacherSettings.studentAnnouncementsEnabled ? 'Enabled' : 'Teacher Only'}
              </span>
            </div>

            <div className="flex gap-2">
              <input
                value={streamInput}
                onChange={(event) => setStreamInput(event.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && postAnnouncement()}
                disabled={!teacherSettings.studentAnnouncementsEnabled}
                className="flex-1 rounded-2xl border border-amber-300/60 px-4 py-2 text-sm text-slate-800 font-medium placeholder:text-amber-700/60"
                style={{ backgroundColor: '#f5deb3' }}
                placeholder={teacherSettings.studentAnnouncementsEnabled ? 'Post class announcement…' : 'Teacher has disabled student posts'}
              />
              <button
                onClick={postAnnouncement}
                disabled={!teacherSettings.studentAnnouncementsEnabled}
                className="px-4 py-2 rounded-2xl bg-indigo-500/30 border border-indigo-300/40 text-white text-sm font-semibold disabled:opacity-40"
              >
                Post
              </button>
            </div>
          </section>

          {streamPosts
            .sort((first, second) => Number(second.pinned) - Number(first.pinned))
            .map(post => (
              <section key={post.id} className="glass-surface rounded-3xl p-5">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-slate-100 font-semibold">{post.author}</p>
                  <div className="flex gap-2">
                    {post.pinned && <span className="glass-chip px-3 py-1 rounded-full micro-label accent-amber">Pinned</span>}
                    {post.isStudentPost && <span className="glass-chip px-3 py-1 rounded-full micro-label accent-indigo">Student Post</span>}
                  </div>
                </div>

                <p className="text-slate-100 mb-3">{post.text}</p>

                <div className="space-y-2 mb-3">
                  {post.comments.map(comment => (
                    <div key={comment.id} className="rounded-2xl border border-white/10 p-3 bg-slate-900/30">
                      <p className="text-sm text-slate-100"><span className="font-semibold">{comment.user}:</span> {comment.text}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    value={commentInputs[post.id] || ''}
                    onChange={(event) => setCommentInputs(prev => ({ ...prev, [post.id]: event.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && addComment(post.id)}
                    disabled={!teacherSettings.commentsEnabled}
                    className="flex-1 rounded-2xl border border-amber-300/60 px-4 py-2 text-sm text-slate-800 font-medium placeholder:text-amber-700/60"
                    style={{ backgroundColor: '#f5deb3' }}
                    placeholder={teacherSettings.commentsEnabled ? 'Comment respectfully…' : 'Comments disabled by teacher'}
                  />
                  <button
                    onClick={() => addComment(post.id)}
                    disabled={!teacherSettings.commentsEnabled}
                    className="px-4 py-2 rounded-2xl bg-emerald-500/30 border border-emerald-300/40 text-white text-sm font-semibold disabled:opacity-40"
                  >
                    Comment
                  </button>
                </div>
              </section>
            ))}
        </div>
      )}

      {activeTab === 'live' && (
        <div className="space-y-4">
          <section className="glass-surface rounded-3xl p-5">
            <h2 className="text-xl command-title neon-title">Live Classes</h2>
            <p className="neon-subtle mt-2">Join video/audio classes, ask questions, and learn in real time.</p>
          </section>

          <section className="space-y-3">
            {liveSessions.map(session => {
              const joined = joinedLiveId === session.id;
              const isLive = String(session.status || '').toLowerCase() !== 'ended';
              return (
                <div key={session.id} className="glass-surface rounded-3xl p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-slate-100 font-semibold">{session.subjectName || 'Live Class'} • {session.topic}</p>
                      <p className="text-sm neon-subtle mt-1">{session.createdByName || session.createdBy || 'Teacher'} • Starts: {session.startedAt ? new Date(session.startedAt).toLocaleString() : 'Now'}</p>
                    </div>
                    <span className={`glass-chip px-3 py-1 rounded-full micro-label ${isLive ? 'accent-rose' : 'accent-amber'}`}>
                      {session.status || 'Live Now'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 mt-3">
                    <p className="text-sm text-slate-300">Mode: {session.mode || 'Video + Audio'}</p>
                    {!joined ? (
                      <button
                        onClick={() => setJoinedLiveId(session.id)}
                        className="px-4 py-2 rounded-2xl bg-emerald-500/30 border border-emerald-300/40 text-white text-sm font-semibold"
                      >
                        Join Live Class
                      </button>
                    ) : (
                      <button
                        onClick={() => setJoinedLiveId(null)}
                        className="px-4 py-2 rounded-2xl bg-rose-500/25 border border-rose-300/40 text-white text-sm font-semibold flex items-center gap-2"
                      >
                        <PhoneXMarkIcon className="w-4 h-4" /> Leave Class
                      </button>
                    )}
                  </div>

                  {joined && (
                    <div className="mt-3 rounded-2xl border border-cyan-300/20 bg-slate-900/40 p-3">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <p className="micro-label accent-emerald">Connected</p>
                        <span className="micro-label neon-subtle">Live Room Active</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setMicEnabled(prev => !prev)}
                          className={`px-3 py-2 rounded-xl border text-sm font-semibold flex items-center gap-2 ${
                            micEnabled
                              ? 'bg-emerald-500/25 border-emerald-300/40 text-slate-100'
                              : 'bg-slate-800/40 border-white/10 text-slate-300'
                          }`}
                        >
                          <MicrophoneIcon className="w-4 h-4" /> {micEnabled ? 'Mic On' : 'Mic Off'}
                        </button>
                        <button
                          onClick={() => setCameraEnabled(prev => !prev)}
                          className={`px-3 py-2 rounded-xl border text-sm font-semibold flex items-center gap-2 ${
                            cameraEnabled
                              ? 'bg-indigo-500/25 border-indigo-300/40 text-slate-100'
                              : 'bg-slate-800/40 border-white/10 text-slate-300'
                          }`}
                        >
                          <VideoCameraIcon className="w-4 h-4" /> {cameraEnabled ? 'Camera On' : 'Camera Off'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {liveSessions.length === 0 && (
              <div className="glass-surface rounded-3xl p-4">
                <p className="text-sm text-slate-300">No live class has been started for this classroom yet.</p>
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === 'students' && (
        <section className="glass-surface rounded-3xl p-5">
          <h2 className="text-xl command-title neon-title mb-4">Classmates / Students</h2>
          <div className="space-y-3">
            {studentMembers.map(member => (
              <div key={member.name} className="rounded-2xl border border-white/10 p-4 bg-slate-900/30 flex items-center justify-between">
                <div>
                  <p className="text-slate-100 font-semibold">{member.name}</p>
                  <p className="neon-subtle text-sm">{member.role}</p>
                </div>
                <span className={`micro-label ${member.status === 'Active' ? 'accent-emerald' : member.status === 'Muted' ? 'accent-amber' : 'accent-rose'}`}>{member.status}</span>
              </div>
            ))}
            {studentMembers.length === 0 && <p className="text-sm text-slate-300">No classmates are visible for this class yet.</p>}
          </div>
        </section>
      )}

      {activeTab === 'teachers' && (
        <div className="space-y-4">
          <section className="glass-surface rounded-3xl p-5">
            <h2 className="text-xl command-title neon-title mb-3">Teachers</h2>
            <p className="text-slate-300">Meet your active classroom teachers and support staff.</p>
          </section>
          {teacherMembers.map(member => (
            <section key={member.name} className="glass-surface rounded-3xl p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-slate-100 font-semibold">{member.name}</p>
                  <p className="text-sm neon-subtle">{member.role}</p>
                </div>
                <span className={`micro-label ${member.status === 'Active' ? 'accent-emerald' : 'accent-amber'}`}>{member.status}</span>
              </div>
            </section>
          ))}
          {teacherMembers.length === 0 && (
            <section className="glass-surface rounded-3xl p-5">
              <p className="text-sm text-slate-300">No teachers are visible for this class yet.</p>
            </section>
          )}
          <button onClick={goBackToDashboard} className="w-full px-4 py-3 rounded-2xl bg-rose-500/25 border border-rose-300/40 text-slate-100 font-semibold">
            Exit Classroom
          </button>
        </div>
      )}

      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 frost-panel px-2 py-2">
          <div className="flex items-stretch gap-1 overflow-x-auto no-scrollbar">
            {bottomTabs.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`min-w-[84px] flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-colors ${active ? 'glass-chip bg-indigo-500/25 text-white border border-indigo-300/20' : 'text-slate-700 dark:text-slate-200 hover:bg-white/5 dark:hover:bg-slate-800/40'}`}>
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] mt-1 neon-subtle">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
