import React, { useEffect, useMemo, useState } from 'react';
import { addTopic, deleteTopic, getAssignments, getMaterials, getSubjectMembers, getTopics, removeStudentFromSubject, restoreStudentToSubject } from '../classroomService';

const SUBJECT_PALETTES = [
  { bg: '#013220', text: '#FFD700', badge: 'rgba(255,215,0,0.18)',    badgeText: '#FFD700' },
  { bg: '#1a003a', text: '#ffffff', badge: 'rgba(255,255,255,0.15)',  badgeText: '#ffffff' },
  { bg: '#001840', text: '#87CEEB', badge: 'rgba(135,206,235,0.18)', badgeText: '#87CEEB' },
  { bg: '#004040', text: '#7FFFD4', badge: 'rgba(127,255,212,0.18)', badgeText: '#7FFFD4' },
  { bg: '#2d0030', text: '#FFB6C1', badge: 'rgba(255,182,193,0.18)', badgeText: '#FFB6C1' },
  { bg: '#001f3f', text: '#00CFFF', badge: 'rgba(0,207,255,0.18)',   badgeText: '#00CFFF' },
  { bg: '#1c1a00', text: '#FFE066', badge: 'rgba(255,224,102,0.18)', badgeText: '#FFE066' },
  { bg: '#3d0000', text: '#FFA94D', badge: 'rgba(255,169,77,0.18)',  badgeText: '#FFA94D' },
];

function typeLabel(type) {
  const map = { mcq: 'MCQ', shortanswer: 'Short Answer', fillgaps: 'Fill Blanks', essay: 'Essay', comprehension: 'Comprehension', longanswer: 'Long Answer', crossmatching: 'Cross Match', mixed: 'Mixed', assignment: 'Task' };
  return map[String(type || '').toLowerCase()] || (type || 'Task');
}

function materialIcon(type) {
  if (type === 'video') return '▶';
  if (type === 'image') return '🖼';
  if (type === 'audio') return '🎧';
  if (type === 'link') return '🔗';
  return '📄';
}

function isUsableMaterialUrl(url) {
  const value = String(url || '').trim();
  if (!value) return false;
  return /^https?:\/\//i.test(value) || value.startsWith('/');
}

function isAudioMaterial(material) {
  const type = String(material?.type || '').toLowerCase();
  if (type === 'audio') return true;
  const source = String(material?.url || material?.fileName || material?.title || '').toLowerCase();
  return /\.(mp3|wav|ogg|m4a|aac)(\?|$)/.test(source);
}

export default function SubjectsTab({ classId = '', subjects = [], canManage = false }) {
  const [activeSubjectId, setActiveSubjectId] = useState(null);
  const [activeTab, setActiveTab] = useState('assignments');
  const [showMembers, setShowMembers] = useState(false);

  // Assignments
  const [allAssignments, setAllAssignments] = useState([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  // Materials
  const [allMaterials, setAllMaterials] = useState([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);

  // Topics
  const [topics, setTopics] = useState([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [topicMsg, setTopicMsg] = useState('');

  // Members
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [activeNote, setActiveNote] = useState(null);

  const selectedSubject = useMemo(() => subjects.find(s => s.id === activeSubjectId) || null, [activeSubjectId, subjects]);
  const paletteIdx = useMemo(() => subjects.findIndex(s => s.id === activeSubjectId), [activeSubjectId, subjects]);
  const palette = SUBJECT_PALETTES[(paletteIdx >= 0 ? paletteIdx : 0) % SUBJECT_PALETTES.length];

  // Load assignments + materials when subject is selected
  useEffect(() => {
    if (!activeSubjectId || !classId) return;
    setAssignmentsLoading(true);
    setMaterialsLoading(true);
    getAssignments(classId)
      .then(d => setAllAssignments(d?.assignments || []))
      .catch(() => setAllAssignments([]))
      .finally(() => setAssignmentsLoading(false));
    getMaterials(classId)
      .then(d => setAllMaterials(d?.materials || []))
      .catch(() => setAllMaterials([]))
      .finally(() => setMaterialsLoading(false));
    setTopicsLoading(true);
    getTopics(classId, activeSubjectId)
      .then(d => setTopics(d?.topics || []))
      .catch(() => setTopics([]))
      .finally(() => setTopicsLoading(false));
  }, [activeSubjectId, classId]);

  async function handleAddTopic() {
    const name = newTopicName.trim();
    if (!name || !activeSubjectId) return;
    setTopicMsg('');
    try {
      const res = await addTopic(classId, { subjectId: activeSubjectId, name });
      if (res?.success) {
        setNewTopicName('');
        setTopicMsg('Topic added.');
        const data = await getTopics(classId, activeSubjectId);
        setTopics(data?.topics || []);
      } else {
        setTopicMsg(res?.message || 'Could not add topic.');
      }
    } catch {
      setTopicMsg('Could not add topic.');
    }
  }

  async function handleDeleteTopic(topicId) {
    if (!window.confirm('Remove this topic? Tagged assignments and materials keep their content.')) return;
    try {
      await deleteTopic(classId, topicId);
      setTopics(prev => prev.filter(t => t.id !== topicId));
    } catch {
      setTopicMsg('Could not remove topic.');
    }
  }

  // Load members when panel opens
  useEffect(() => {
    if (!showMembers || !activeSubjectId || !classId) return;
    setMembersLoading(true); setMembersError(''); setMembers([]);
    getSubjectMembers(classId, activeSubjectId)
      .then(d => setMembers(d?.members || []))
      .catch(() => setMembersError('Could not load members.'))
      .finally(() => setMembersLoading(false));
  }, [showMembers, activeSubjectId, classId]);

  async function handleRemove(studentId) {
    if (!window.confirm('Remove this student from the subject?')) return;
    try {
      await removeStudentFromSubject(classId, activeSubjectId, studentId);
      setActionMsg('Student removed.');
      setMembers(prev => prev.map(m => m.id === studentId ? { ...m, excluded: true } : m));
    } catch { setActionMsg('Failed to remove.'); }
  }

  async function handleRestore(studentId) {
    try {
      await restoreStudentToSubject(classId, activeSubjectId, studentId);
      setActionMsg('Student restored.');
      setMembers(prev => prev.map(m => m.id === studentId ? { ...m, excluded: false } : m));
    } catch { setActionMsg('Failed to restore.'); }
  }

  function openSubject(id) {
    setActiveSubjectId(id);
    setActiveTab('assignments');
    setShowMembers(false);
    setActionMsg('');
    setMembers([]);
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (subjects.length === 0) {
    return (
      <div className="glass-surface rounded-3xl p-5 text-center">
        <p className="micro-label accent-amber">No subjects yet</p>
        <p className="mt-2 text-slate-300 text-sm">Subjects will appear here once added in Settings → Subjects.</p>
      </div>
    );
  }

  // ── Subject grid ─────────────────────────────────────────────────────────
  if (!selectedSubject) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 p-1">
        {subjects.map((subject, idx) => {
          const p = SUBJECT_PALETTES[idx % SUBJECT_PALETTES.length];
          return (
            <button
              key={subject.id}
              onClick={() => openSubject(subject.id)}
              style={{ backgroundColor: p.bg, color: p.text }}
              className="text-left rounded-3xl p-4 space-y-2 transition-transform hover:scale-[1.03] hover:brightness-110 active:scale-100 border border-white/10 shadow-lg"
            >
              <p className="text-base font-black leading-tight truncate" style={{ color: p.text }}>{subject.name}</p>
              {subject.teacherName && (
                <p className="text-xs font-semibold truncate opacity-80" style={{ color: p.text }}>{subject.teacherName}</p>
              )}
              <span
                className="inline-block px-2 py-0.5 rounded-full text-xs font-bold border"
                style={{ background: p.badge, color: p.badgeText, borderColor: `${p.badgeText}40` }}
              >
                {subject.teacherId ? 'Assigned' : 'No teacher'}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  // ── Subject detail page ───────────────────────────────────────────────────
  const subjectAssignments = allAssignments.filter(a => String(a.subjectId || '') === activeSubjectId || String(a.subjectName || '') === selectedSubject.name);
  const subjectMaterials = allMaterials.filter(m => String(m.subjectId || '') === activeSubjectId || String(m.subjectName || '') === selectedSubject.name);

  // Merge persisted topics with topics derived from tagged assignments/materials.
  const topicCounts = (() => {
    const map = new Map();
    const ensure = rawName => {
      const name = String(rawName || '').trim();
      if (!name) return null;
      const key = name.toLowerCase();
      if (!map.has(key)) map.set(key, { id: '', name, assignments: 0, materials: 0 });
      return map.get(key);
    };
    topics.forEach(t => { const entry = ensure(t.name); if (entry) entry.id = t.id; });
    subjectAssignments.forEach(a => { const entry = ensure(a.metadata?.topic || a.topic); if (entry) entry.assignments += 1; });
    subjectMaterials.forEach(m => { const entry = ensure(m.topic); if (entry) entry.materials += 1; });
    return Array.from(map.values()).sort((x, y) => x.name.localeCompare(y.name));
  })();

  return (
    <div className="space-y-3">
      {/* Header */}
      <div
        className="rounded-3xl p-5 flex flex-wrap items-center justify-between gap-3 shadow-lg border border-white/10"
        style={{ backgroundColor: palette.bg }}
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-widest opacity-70" style={{ color: palette.text }}>Subject</p>
          <h2 className="text-xl font-black mt-0.5" style={{ color: palette.text }}>{selectedSubject.name}</h2>
          {selectedSubject.teacherName && (
            <p className="text-xs mt-1 opacity-75" style={{ color: palette.text }}>Teacher: {selectedSubject.teacherName}</p>
          )}
        </div>
        <button
          onClick={() => setActiveSubjectId(null)}
          className="px-4 py-2 rounded-2xl text-sm font-bold border border-white/20 hover:bg-white/10 transition-colors"
          style={{ color: palette.text }}
        >
          ← All Subjects
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap items-center gap-2">
        {['assignments', 'materials', 'topics'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={activeTab === tab ? { backgroundColor: palette.bg, color: palette.text, borderColor: `${palette.text}30` } : {}}
            className={`px-4 py-2 rounded-2xl text-sm font-semibold border transition-colors capitalize ${activeTab === tab ? 'border shadow-sm' : 'border-white/10 bg-slate-900/30 text-slate-200'}`}
          >
            {tab}
            {tab === 'assignments' && !assignmentsLoading && (
              <span className="ml-1.5 text-xs opacity-70">({subjectAssignments.length})</span>
            )}
            {tab === 'materials' && !materialsLoading && (
              <span className="ml-1.5 text-xs opacity-70">({subjectMaterials.length})</span>
            )}
            {tab === 'topics' && !topicsLoading && (
              <span className="ml-1.5 text-xs opacity-70">({topicCounts.length})</span>
            )}
          </button>
        ))}

        {/* Members collapsed into a button */}
        <button
          onClick={() => setShowMembers(v => !v)}
          className={`ml-auto px-4 py-2 rounded-2xl text-sm font-semibold border transition-colors ${showMembers ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-200' : 'border-white/10 bg-slate-900/30 text-slate-300'}`}
        >
          {showMembers ? '▾ Hide Members' : '👥 Members'}
        </button>
      </div>

      {actionMsg && (
        <p className="text-xs px-3 py-1.5 rounded-xl bg-emerald-900/30 text-emerald-300 border border-emerald-500/30">{actionMsg}</p>
      )}

      {/* Members collapsible panel */}
      {showMembers && (
        <section className="glass-surface rounded-3xl p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Class Members — {selectedSubject.name}</p>
          {membersLoading && <p className="text-slate-300 text-sm">Loading members...</p>}
          {membersError && <p className="text-red-400 text-sm">{membersError}</p>}
          {!membersLoading && !membersError && members.length === 0 && (
            <p className="text-slate-400 text-sm">No students enrolled yet.</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {members.map(member => (
              <div key={member.id} className={`rounded-2xl border p-3 flex items-center justify-between gap-3 ${member.excluded ? 'border-red-500/20 bg-red-900/10 opacity-60' : 'border-white/10 bg-slate-900/30'}`}>
                <div>
                  <p className="text-slate-100 font-semibold text-sm">{member.name}</p>
                  <p className="text-xs text-slate-400">{member.email}</p>
                  {member.excluded && <span className="text-xs text-red-400 font-semibold">Excluded</span>}
                </div>
                {canManage && (
                  member.excluded
                    ? <button onClick={() => handleRestore(member.id)} className="text-xs bg-emerald-700/60 hover:bg-emerald-600/70 text-emerald-200 px-3 py-1 rounded-xl font-bold">Restore</button>
                    : <button onClick={() => handleRemove(member.id)} className="text-xs bg-red-900/40 hover:bg-red-700/50 text-red-300 border border-red-500/30 px-3 py-1 rounded-xl font-semibold">Remove</button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Assignments tab */}
      {activeTab === 'assignments' && (
        <section className="space-y-3">
          {assignmentsLoading && <div className="glass-surface rounded-3xl p-4 text-slate-300 text-sm">Loading assignments...</div>}
          {!assignmentsLoading && subjectAssignments.length === 0 && (
            <div className="glass-surface rounded-3xl p-5 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">No assignments yet</p>
              <p className="mt-2 text-slate-400 text-sm">No assignments have been created for {selectedSubject.name}.</p>
            </div>
          )}
          {subjectAssignments.map(a => (
            <div key={a.id} className="glass-surface rounded-3xl p-4 space-y-2 border border-white/10">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-xs font-bold border mb-1"
                    style={{ background: palette.badge, color: palette.badgeText, borderColor: `${palette.badgeText}40` }}
                  >
                    {typeLabel(a.format || a.type)}
                  </span>
                  <p className="text-slate-100 font-bold text-base">{a.title}</p>
                  {a.description && <p className="text-slate-300 text-sm mt-1">{a.description}</p>}
                </div>
                {a.dueAt && (
                  <p className="text-xs text-slate-400 shrink-0">Due {new Date(a.dueAt).toLocaleDateString()}</p>
                )}
              </div>
              {a.questions?.length > 0 && (
                <p className="text-xs text-slate-400">{a.questions.length} question{a.questions.length !== 1 ? 's' : ''}</p>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Materials tab */}
      {activeTab === 'materials' && (
        <section className="space-y-3">
          {materialsLoading && <div className="glass-surface rounded-3xl p-4 text-slate-300 text-sm">Loading materials...</div>}
          {!materialsLoading && subjectMaterials.length === 0 && (
            <div className="glass-surface rounded-3xl p-5 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">No materials yet</p>
              <p className="mt-2 text-slate-400 text-sm">No materials or lesson notes have been posted for {selectedSubject.name}.</p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {subjectMaterials.map(m => {
              const usableUrl = isUsableMaterialUrl(m.url) ? m.url : '';
              const audio = isAudioMaterial(m) && usableUrl;
              return (
              <div key={m.id} className="glass-surface rounded-3xl p-4 border border-slate-200 dark:border-white/10 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{materialIcon(audio ? 'audio' : m.type)}</span>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full border uppercase"
                    style={{ background: palette.badge, color: palette.badgeText, borderColor: `${palette.badgeText}40` }}
                  >
                    {audio ? 'audio' : (m.type || 'doc')}
                  </span>
                </div>
                <p className="text-slate-900 dark:text-slate-100 font-bold text-sm leading-snug">{m.title || 'Untitled'}</p>
                {m.topic && <p className="text-xs text-slate-500 dark:text-slate-400">{m.topic}{m.weekLabel ? ` · ${m.weekLabel}` : ''}</p>}
                {m.description && !usableUrl && (
                  <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-3">{m.description}</p>
                )}
                {audio ? (
                  <audio controls preload="none" src={usableUrl} className="mt-2 w-full">
                    Your browser does not support audio playback.
                  </audio>
                ) : usableUrl ? (
                  <a href={usableUrl} target="_blank" rel="noreferrer"
                    className="mt-auto text-center text-xs font-bold px-3 py-1.5 rounded-xl transition-colors hover:brightness-110"
                    style={{ backgroundColor: palette.bg, color: palette.text, border: `1px solid ${palette.text}30` }}>
                    Open Material
                  </a>
                ) : m.description ? (
                  <button type="button"
                    onClick={() => setActiveNote(m)}
                    className="mt-auto text-center text-xs font-bold px-3 py-1.5 rounded-xl transition-colors hover:brightness-110"
                    style={{ backgroundColor: palette.bg, color: palette.text, border: `1px solid ${palette.text}30` }}>
                    Read Note
                  </button>
                ) : null}
              </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Topics tab */}
      {activeTab === 'topics' && (
        <section className="space-y-3">
          {canManage && (
            <div className="glass-surface rounded-3xl p-4 flex flex-wrap items-end gap-2">
              <label className="flex-1 min-w-[180px]">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">New Topic</span>
                <input
                  value={newTopicName}
                  onChange={e => setNewTopicName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTopic(); } }}
                  placeholder="e.g. Photosynthesis"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400/50"
                />
              </label>
              <button
                type="button"
                onClick={handleAddTopic}
                disabled={!newTopicName.trim()}
                className="px-4 py-2 rounded-2xl text-sm font-bold border border-white/20 transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                style={{ backgroundColor: palette.bg, color: palette.text }}
              >
                + Add Topic
              </button>
            </div>
          )}
          {topicMsg && <p className="text-xs px-3 py-1.5 rounded-xl bg-emerald-900/30 text-emerald-300 border border-emerald-500/30">{topicMsg}</p>}
          {topicsLoading && <div className="glass-surface rounded-3xl p-4 text-slate-300 text-sm">Loading topics...</div>}
          {!topicsLoading && topicCounts.length === 0 && (
            <div className="glass-surface rounded-3xl p-5 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">No topics yet</p>
              <p className="mt-2 text-slate-400 text-sm">Add a topic above, or tag one while creating an assignment or material. Students can open a topic to see its work and ask the AI to explain it.</p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {topicCounts.map(t => (
              <div key={t.name} className="glass-surface rounded-3xl p-4 border border-white/10 flex items-start justify-between gap-2">
                <div>
                  <p className="text-slate-100 font-bold">{t.name}</p>
                  <p className="text-xs text-slate-400 mt-1">{t.assignments} assignment{t.assignments !== 1 ? 's' : ''} · {t.materials} material{t.materials !== 1 ? 's' : ''}</p>
                </div>
                {canManage && t.id && (
                  <button onClick={() => handleDeleteTopic(t.id)} className="text-xs bg-red-900/40 hover:bg-red-700/50 text-red-300 border border-red-500/30 px-3 py-1 rounded-xl font-semibold shrink-0">Remove</button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Lesson note modal */}
      {activeNote && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 md:items-center" onClick={() => setActiveNote(null)}>
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#0d0d1a] p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: palette.text }}>Lesson Note</p>
                <h3 className="mt-1 text-lg font-black text-white">{activeNote.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{activeNote.subjectName || selectedSubject.name}</p>
              </div>
              <button onClick={() => setActiveNote(null)} className="text-slate-400 hover:text-white text-lg font-bold">✕</button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto rounded-2xl bg-slate-900 p-4 text-sm leading-7 text-slate-200 whitespace-pre-wrap">
              {activeNote.description || 'No content.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
