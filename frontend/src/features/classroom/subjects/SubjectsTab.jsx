import React, { useEffect, useMemo, useState } from 'react';
import { getRoleAccent } from '../shared/classroomHelpers';
import { getSubjectMembers, removeStudentFromSubject, restoreStudentToSubject } from '../classroomService';

// classId + subjects come from parent (TeacherClassroom or StudentClassroomExperience)
// canManage = owner/hos/ict/classteacher can remove students from subjects
export default function SubjectsTab({ classId = '', subjects = [], canManage = false }) {
  const [activeSubjectId, setActiveSubjectId] = useState(null);
  const [subjectInnerTab, setSubjectInnerTab] = useState('members');
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  const selectedSubject = useMemo(() => subjects.find(s => s.id === activeSubjectId) || null, [activeSubjectId, subjects]);

  useEffect(() => {
    if (!activeSubjectId || !classId || subjectInnerTab !== 'members') return;
    setMembersLoading(true); setMembersError(''); setMembers([]);
    getSubjectMembers(classId, activeSubjectId)
      .then(d => setMembers(d?.members || []))
      .catch(() => setMembersError('Could not load members.'))
      .finally(() => setMembersLoading(false));
  }, [activeSubjectId, classId, subjectInnerTab]);

  async function handleRemove(studentId) {
    if (!window.confirm('Remove this student from the subject?')) return;
    try {
      await removeStudentFromSubject(classId, activeSubjectId, studentId);
      setActionMsg('Student removed from subject.');
      setMembers(prev => prev.map(m => m.id === studentId ? { ...m, excluded: true } : m));
    } catch { setActionMsg('Failed to remove student.'); }
  }

  async function handleRestore(studentId) {
    try {
      await restoreStudentToSubject(classId, activeSubjectId, studentId);
      setActionMsg('Student restored to subject.');
      setMembers(prev => prev.map(m => m.id === studentId ? { ...m, excluded: false } : m));
    } catch { setActionMsg('Failed to restore student.'); }
  }

  if (subjects.length === 0) {
    return (
      <div className="glass-surface rounded-3xl p-5 text-center">
        <p className="micro-label accent-amber">No subjects yet</p>
        <p className="mt-2 text-slate-300 text-sm">Subjects will appear here once they are added to this class in Settings → Subjects.</p>
      </div>
    );
  }

  if (!selectedSubject) {
    return (
      <div className="grid grid-cols-2 gap-3 p-1">
        {subjects.map(subject => (
          <button
            key={subject.id}
            onClick={() => { setActiveSubjectId(subject.id); setSubjectInnerTab('members'); setActionMsg(''); }}
            className="text-left glass-surface rounded-3xl p-4 space-y-2 hover:border-indigo-300/40 border border-white/10 transition-colors"
          >
            <p className="text-base command-title neon-title truncate">{subject.name}</p>
            {subject.teacherName && <p className="neon-subtle text-xs truncate">{subject.teacherName}</p>}
            <div className="flex items-center gap-1 mt-1">
              <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-500/20 border border-indigo-300/30 text-indigo-200">
                {subject.teacherId ? 'Assigned' : 'No teacher'}
              </span>
            </div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 glass-surface rounded-3xl p-4">
        <div>
          <p className="micro-label accent-indigo">Subject</p>
          <h3 className="text-lg command-title neon-title">{selectedSubject.name}</h3>
          {selectedSubject.teacherName && <p className="neon-subtle text-xs">Teacher: {selectedSubject.teacherName}</p>}
        </div>
        <button onClick={() => { setActiveSubjectId(null); setActionMsg(''); }} className="px-3 py-1.5 rounded-xl border border-white/10 bg-slate-900/30 text-sm text-slate-100">← Back</button>
      </div>

      <div className="flex flex-wrap gap-2">
        {['members'].map(tab => (
          <button key={tab} onClick={() => setSubjectInnerTab(tab)}
            className={subjectInnerTab === tab ? 'px-4 py-2 rounded-2xl bg-indigo-500/30 border border-indigo-300/40 text-white text-sm capitalize' : 'px-4 py-2 rounded-2xl bg-slate-900/30 border border-white/10 text-slate-200 text-sm capitalize'}>
            {tab}
          </button>
        ))}
      </div>

      {actionMsg && <p className="text-xs px-3 py-1.5 rounded-xl bg-emerald-900/30 text-emerald-300 border border-emerald-500/30">{actionMsg}</p>}

      {subjectInnerTab === 'members' && (
        <section className="glass-surface rounded-3xl p-4 space-y-2">
          {membersLoading && <p className="text-slate-300 text-sm">Loading members...</p>}
          {membersError && <p className="text-red-400 text-sm">{membersError}</p>}
          {!membersLoading && !membersError && members.length === 0 && (
            <p className="text-slate-400 text-sm">No students enrolled in this class yet.</p>
          )}
          {members.map(member => (
            <div key={member.id} className={`rounded-2xl border p-3 flex items-center justify-between gap-3 ${member.excluded ? 'border-red-500/20 bg-red-900/10 opacity-60' : 'border-white/10 bg-slate-900/30'}`}>
              <div>
                <p className="text-slate-100 font-semibold text-sm">{member.name}</p>
                <p className="text-xs text-slate-400">{member.email}</p>
                {member.excluded && <span className="text-xs text-red-400 font-semibold">Excluded from subject</span>}
              </div>
              {canManage && (
                member.excluded
                  ? <button onClick={() => handleRestore(member.id)} className="text-xs bg-emerald-700/60 hover:bg-emerald-600/70 text-emerald-200 px-3 py-1 rounded-xl font-bold transition-colors">Restore</button>
                  : <button onClick={() => handleRemove(member.id)} className="text-xs bg-red-900/40 hover:bg-red-700/50 text-red-300 border border-red-500/30 px-3 py-1 rounded-xl font-semibold transition-colors">Remove</button>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
