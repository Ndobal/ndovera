import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AcademicCapIcon,
  ArrowLeftIcon,
  BookOpenIcon,
  BookmarkIcon,
  ChatBubbleBottomCenterTextIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  LightBulbIcon,
  MegaphoneIcon,
  MicrophoneIcon,
  PaperAirplaneIcon,
  PhoneXMarkIcon,
  PlayCircleIcon,
  UserGroupIcon,
  VideoCameraIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

export default function StudentClassroom() {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeTab, setActiveTab] = useState('stream');
  const [groupMode, setGroupMode] = useState('week');
  const [expandedGroups, setExpandedGroups] = useState(['week-1']);
  const [openTaskId, setOpenTaskId] = useState(null);
  const [taskDraft, setTaskDraft] = useState('');
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [teacherChatInput, setTeacherChatInput] = useState('');
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
  const [taskChat, setTaskChat] = useState([]);
  const [liveSessions] = useState([]);
  const [classroomMaterials, setClassroomMaterials] = useState([]);
  const [practiceItems] = useState([]);
  const [classMembers, setClassMembers] = useState([]);
  const [classroomLoading, setClassroomLoading] = useState(true);

  useEffect(() => {
    const classId = localStorage.getItem('classroomId');
    if (!classId) { setClassroomLoading(false); return; }
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    setClassroomLoading(true);
    Promise.all([
      fetch(`/api/classrooms/${classId}/posts`, { headers }).then(r => r.ok ? r.json() : { posts: [] }),
      fetch(`/api/classrooms/${classId}/assignments`, { headers }).then(r => r.ok ? r.json() : { assignments: [] }),
      fetch(`/api/classrooms/${classId}/materials`, { headers }).then(r => r.ok ? r.json() : { materials: [] }),
      fetch(`/api/classrooms/${classId}/members`, { headers }).then(r => r.ok ? r.json() : { members: [] }),
    ]).then(([postsRes, assignRes, matRes, membersRes]) => {
      setStreamPosts(postsRes.posts || []);
      setTasks(assignRes.assignments || []);
      setClassroomMaterials(matRes.materials || []);
      setClassMembers(membersRes.members || []);
    }).catch(() => {}).finally(() => setClassroomLoading(false));
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!openTaskId) return;
    const saved = localStorage.getItem(`ndovera-task-draft-${openTaskId}`);
    setTaskDraft(saved || '');
  }, [openTaskId]);

  useEffect(() => {
    if (!openTaskId) return;
    const timer = setTimeout(() => {
      localStorage.setItem(`ndovera-task-draft-${openTaskId}`, taskDraft);
    }, 500);
    return () => clearTimeout(timer);
  }, [openTaskId, taskDraft]);

  const currentTask = tasks.find(task => task.id === openTaskId) || null;

  const groupedTasks = useMemo(() => {
    const keyByMode = {
      week: 'week',
      topic: 'topic',
      scheme: 'scheme',
    };

    const key = keyByMode[groupMode];
    const groups = tasks.reduce((accumulator, task) => {
      const groupValue = task[key];
      if (!accumulator[groupValue]) {
        accumulator[groupValue] = [];
      }
      accumulator[groupValue].push(task);
      return accumulator;
    }, {});

    return Object.entries(groups).map(([label, items], index) => ({
      id: `${groupMode}-${index + 1}`,
      label,
      items,
    }));
  }, [groupMode, tasks]);

  const statusCounts = useMemo(() => {
    const pending = tasks.filter(task => task.status === 'Pending').length;
    const submitted = tasks.filter(task => task.status === 'Submitted').length;
    const needsImprovement = tasks.filter(task => task.status === 'Needs Improvement').length;
    return { pending, submitted, needsImprovement };
  }, [tasks]);

  const postAnnouncement = () => {
    if (!teacherSettings.studentAnnouncementsEnabled) return;
    if (!streamInput.trim()) return;

    setStreamPosts(prev => [
      {
        id: `stream-${Date.now()}`,
        author: 'Student Post • You',
        text: streamInput.trim(),
        pinned: false,
        comments: [],
        isStudentPost: true,
      },
      ...prev,
    ]);
    setStreamInput('');
  };

  const addComment = (postId) => {
    if (!teacherSettings.commentsEnabled) return;
    const text = (commentInputs[postId] || '').trim();
    if (!text) return;

    setStreamPosts(prev => prev.map(post => (
      post.id === postId
        ? {
          ...post,
          comments: [...post.comments, { id: `cm-${Date.now()}`, user: 'You', text }],
        }
        : post
    )));

    setCommentInputs(prev => ({ ...prev, [postId]: '' }));
  };

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => (
      prev.includes(groupId)
        ? prev.filter(item => item !== groupId)
        : [...prev, groupId]
    ));
  };

  const openTaskWorkspace = (taskId) => {
    setOpenTaskId(taskId);
    setChatPanelOpen(false);
  };

  const closeTaskWorkspace = () => {
    setOpenTaskId(null);
    setTeacherChatInput('');
  };

  const submitTask = () => {
    if (!currentTask) return;

    setTasks(prev => prev.map(task => {
      if (task.id !== currentTask.id) return task;
      const version = task.submissions.length + 1;
      return {
        ...task,
        status: 'Submitted',
        dueDate: 'Awaiting teacher review',
        submissions: [
          ...task.submissions,
          {
            version,
            content: taskDraft || `Submission version ${version}`,
            time: new Date().toLocaleString(),
          },
        ],
      };
    }));
  };

  const improveAndResubmit = () => {
    if (!currentTask) return;
    submitTask();
  };

  const sendTeacherMessage = () => {
    if (!teacherChatInput.trim()) return;
    setTaskChat(prev => [...prev, { id: `m-${Date.now()}`, sender: 'You', text: teacherChatInput.trim() }]);
    setTeacherChatInput('');
  };

  const goBackToDashboard = () => {
    navigate('/roles/student');
  };

  const typeClass = taskType => {
    if (taskType === 'Assignment') return 'accent-indigo';
    if (taskType === 'Essay') return 'accent-rose';
    if (taskType === 'Classwork') return 'accent-emerald';
    return 'accent-amber';
  };

  const statusClass = status => {
    if (status === 'Submitted') return 'accent-emerald';
    if (status === 'Needs Improvement') return 'accent-rose';
    return 'accent-amber';
  };

  const tabButtonClass = tabKey => (
    activeTab === tabKey
      ? 'px-4 py-2 rounded-2xl font-semibold bg-indigo-500/30 text-white border border-indigo-300/40'
      : 'px-4 py-2 rounded-2xl font-semibold bg-slate-900/30 text-slate-200 border border-white/10 hover:bg-indigo-500/15'
  );

  const bottomTabs = [
    { key: 'subjects', label: 'Subjects', icon: AcademicCapIcon },
    { key: 'materials', label: 'Materials', icon: DocumentTextIcon },
    { key: 'practice', label: 'Practice', icon: LightBulbIcon },
    { key: 'assignment', label: 'Assignment', icon: ClipboardDocumentListIcon },
    { key: 'stream', label: 'Stream', icon: MegaphoneIcon },
    { key: 'live', label: 'Live', icon: PlayCircleIcon },
    { key: 'students', label: 'Classmates', icon: UserGroupIcon },
    { key: 'teachers', label: 'Teachers', icon: BookOpenIcon },
  ];

  const subjectRows = Array.from(new Set(tasks.map(task => task.topic))).map(topic => {
    const linkedTasks = tasks.filter(task => task.topic === topic);
    return {
      topic,
      count: linkedTasks.length,
      nextDue: linkedTasks[0]?.dueDate || 'No due item',
    };
  });

  const studentMembers = classMembers.filter(member => member.role === 'Student');
  const teacherMembers = classMembers.filter(member => member.role === 'Teacher');

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
          <p className="font-semibold text-slate-800 dark:text-slate-100">SS2A • Focus Learning Space</p>
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
            <p className="neon-subtle mt-2">Track each subject area and current learning focus.</p>
          </section>

          <section className="space-y-3">
            {subjectRows.map(subject => (
              <div key={subject.topic} className="glass-surface rounded-3xl p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-slate-100 font-semibold">{subject.topic}</p>
                  <span className="glass-chip px-3 py-1 rounded-full micro-label accent-indigo">{subject.count} item(s)</span>
                </div>
                <p className="text-sm neon-subtle mt-1">Next due: {subject.nextDue}</p>
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
              <p className="micro-label neon-subtle">Completed</p>
              <p className="text-2xl command-title accent-emerald">{statusCounts.submitted}</p>
            </div>
            <div className="glass-surface rounded-3xl p-4">
              <p className="micro-label neon-subtle">Needs Work</p>
              <p className="text-2xl command-title accent-rose">{statusCounts.needsImprovement}</p>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'materials' && (
        <section className="glass-surface rounded-3xl p-5">
          <h2 className="text-xl command-title neon-title mb-4">Materials</h2>
          <div className="space-y-3">
            {classroomMaterials.map(material => (
              <div key={material.id} className="rounded-2xl border border-white/10 p-4 bg-slate-900/30">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-slate-100 font-semibold">{material.title}</p>
                  <span className="glass-chip px-3 py-1 rounded-full micro-label accent-emerald">{material.type}</span>
                </div>
                <p className="text-sm neon-subtle mt-1">Subject: {material.subject}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'practice' && (
        <section className="glass-surface rounded-3xl p-5">
          <h2 className="text-xl command-title neon-title mb-4">Practice</h2>
          <div className="space-y-3">
            {practiceItems.map(item => (
              <div key={item.id} className="rounded-2xl border border-white/10 p-4 bg-slate-900/30">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-slate-100 font-semibold">{item.title}</p>
                  <span className="glass-chip px-3 py-1 rounded-full micro-label accent-indigo">{item.mode}</span>
                </div>
                <p className="text-sm neon-subtle mt-1">Availability: {item.due}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'assignment' && (
        <div className="space-y-4">
          <section className="glass-surface rounded-3xl p-4 flex flex-wrap items-center gap-2">
            <span className="micro-label neon-subtle mr-2">Group by</span>
            <button onClick={() => setGroupMode('week')} className={groupMode === 'week' ? 'glass-chip px-3 py-1 rounded-full micro-label accent-indigo' : 'px-3 py-1 rounded-full border border-white/10 micro-label'}>Week</button>
            <button onClick={() => setGroupMode('topic')} className={groupMode === 'topic' ? 'glass-chip px-3 py-1 rounded-full micro-label accent-indigo' : 'px-3 py-1 rounded-full border border-white/10 micro-label'}>Topic</button>
            <button onClick={() => setGroupMode('scheme')} className={groupMode === 'scheme' ? 'glass-chip px-3 py-1 rounded-full micro-label accent-indigo' : 'px-3 py-1 rounded-full border border-white/10 micro-label'}>Scheme of Work</button>
          </section>

          <section className="space-y-3">
            {groupedTasks.map(group => {
              const expanded = expandedGroups.includes(group.id);
              return (
                <div key={group.id} className="glass-surface rounded-3xl p-4">
                  <button onClick={() => toggleGroup(group.id)} className="w-full flex items-center justify-between">
                    <p className="text-slate-100 font-semibold">{group.label}</p>
                    <span className="micro-label accent-indigo">{expanded ? 'Collapse' : 'Expand'}</span>
                  </button>

                  {expanded && (
                    <div className="mt-3 space-y-3">
                      {group.items.map(task => (
                        <button key={task.id} onClick={() => openTaskWorkspace(task.id)} className="w-full text-left rounded-2xl border border-white/10 p-4 bg-slate-900/30">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-slate-100 font-semibold">{task.title}</p>
                            <span className={`micro-label ${typeClass(task.type)}`}>{task.type}</span>
                          </div>
                          <p className="text-sm neon-subtle mt-1">Due: {task.dueDate}</p>
                          <p className={`micro-label mt-2 ${statusClass(task.status)}`}>{task.status}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
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
                disabled={!teacherSettings.studentAnnouncementsEnabled}
                className="flex-1 rounded-2xl bg-slate-900/50 border border-white/10 px-4 py-2 text-sm text-slate-100"
                placeholder={teacherSettings.studentAnnouncementsEnabled ? 'Post class announcement' : 'Teacher has disabled student announcements'}
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
                    disabled={!teacherSettings.commentsEnabled}
                    className="flex-1 rounded-2xl bg-slate-900/50 border border-white/10 px-4 py-2 text-sm text-slate-100"
                    placeholder={teacherSettings.commentsEnabled ? 'Comment respectfully' : 'Comments disabled by teacher'}
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
              const isLive = session.status === 'Live Now';
              return (
                <div key={session.id} className="glass-surface rounded-3xl p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-slate-100 font-semibold">{session.subject} • {session.topic}</p>
                      <p className="text-sm neon-subtle mt-1">{session.teacher} • Starts: {session.startsAt}</p>
                    </div>
                    <span className={`glass-chip px-3 py-1 rounded-full micro-label ${isLive ? 'accent-rose' : 'accent-amber'}`}>
                      {session.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 mt-3">
                    <p className="text-sm text-slate-300">Mode: {session.mode}</p>
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

      {currentTask && (
        <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-4 md:p-6 pb-28">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="micro-label neon-subtle">Task Workspace</p>
                <h2 className="text-xl command-title neon-title">{currentTask.title}</h2>
              </div>
              <button onClick={closeTaskWorkspace} className="p-2 rounded-xl border border-white/10 bg-slate-900/30">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <section className="glass-surface rounded-3xl p-5 mb-4">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className={`glass-chip px-3 py-1 rounded-full micro-label ${typeClass(currentTask.type)}`}>{currentTask.type}</span>
                <span className={`glass-chip px-3 py-1 rounded-full micro-label ${statusClass(currentTask.status)}`}>{currentTask.status}</span>
              </div>
              <p className="text-slate-300 text-sm">Due: {currentTask.dueDate}</p>
              {currentTask.teacherComment && (
                <div className="mt-3 rounded-2xl border border-rose-400/30 p-3 bg-rose-500/10">
                  <p className="micro-label accent-rose mb-1">Teacher Comment</p>
                  <p className="text-slate-100 text-sm">{currentTask.teacherComment}</p>
                </div>
              )}
            </section>

            <section className="glass-surface rounded-3xl p-5 mb-4">
              <p className="micro-label neon-subtle mb-2">Auto-save enabled</p>
              <textarea
                value={taskDraft}
                onChange={(event) => setTaskDraft(event.target.value)}
                className="w-full min-h-[260px] rounded-2xl bg-slate-900/50 border border-white/10 px-4 py-3 text-sm text-slate-100"
                placeholder="Work on your task here. Your draft saves automatically."
              />
            </section>

            {currentTask.submissions.length > 0 && (
              <section className="glass-surface rounded-3xl p-5 mb-4">
                <p className="font-semibold text-slate-100 mb-2">Previous Versions</p>
                <div className="space-y-2">
                  {currentTask.submissions.map(item => (
                    <div key={`${currentTask.id}-${item.version}`} className="rounded-2xl border border-white/10 p-3 bg-slate-900/30">
                      <p className="micro-label accent-indigo">Version {item.version}</p>
                      <p className="text-xs neon-subtle mt-1">{item.time}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="fixed bottom-4 right-4 left-4 md:left-auto md:w-[22rem] z-50 flex flex-wrap gap-2 justify-end">
            <button onClick={() => setChatPanelOpen(true)} className="px-4 py-2 rounded-2xl bg-indigo-500/30 border border-indigo-300/40 text-white text-sm font-semibold flex items-center gap-2">
              <ChatBubbleBottomCenterTextIcon className="w-4 h-4" /> Ask Teacher
            </button>
            <button onClick={submitTask} className="px-4 py-2 rounded-2xl bg-emerald-500/30 border border-emerald-300/40 text-white text-sm font-semibold flex items-center gap-2">
              <PaperAirplaneIcon className="w-4 h-4" /> Submit
            </button>
            <button onClick={() => localStorage.setItem(`ndovera-task-draft-${currentTask.id}`, taskDraft)} className="px-4 py-2 rounded-2xl bg-slate-800/40 border border-white/10 text-white text-sm font-semibold flex items-center gap-2">
              <BookmarkIcon className="w-4 h-4" /> Save Draft
            </button>
            {currentTask.status === 'Needs Improvement' && (
              <button onClick={improveAndResubmit} className="px-4 py-2 rounded-2xl bg-rose-500/25 border border-rose-300/40 text-white text-sm font-semibold">
                Improve & Resubmit
              </button>
            )}
          </div>

          <div className={`fixed left-0 right-0 bottom-0 z-50 transition-transform duration-300 ${chatPanelOpen ? 'translate-y-0' : 'translate-y-full'}`}>
            <div className="mx-auto max-w-3xl rounded-t-3xl p-4 bottom-nav bottom-nav--subtle">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-slate-100">Private Help Chat (You + Teacher)</p>
                <button onClick={() => setChatPanelOpen(false)} className="p-1 rounded-lg hover:bg-slate-800/70">
                  <XMarkIcon className="w-4 h-4 text-slate-200" />
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-2 mb-3">
                {taskChat.map(item => (
                  <div key={item.id} className="rounded-2xl border border-white/10 p-3 bg-slate-800/50">
                    <p className="text-xs micro-label neon-subtle">{item.sender}</p>
                    <p className="text-sm text-slate-100 mt-1">{item.text}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={teacherChatInput}
                  onChange={(event) => setTeacherChatInput(event.target.value)}
                  className="flex-1 rounded-2xl bg-slate-900/60 border border-white/10 px-4 py-2 text-sm text-slate-100"
                  placeholder="Ask your teacher privately"
                />
                <button onClick={sendTeacherMessage} className="px-4 py-2 rounded-2xl bg-indigo-500/30 border border-indigo-300/40 text-white text-sm font-semibold">
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
