import React, { useMemo, useState } from 'react';
import { subjects } from '../data/classroomData';
import { getRoleAccent, renderProgressBars } from '../shared/classroomHelpers';

export default function SubjectsTab() {
  const [activeSubjectId, setActiveSubjectId] = useState(null);
  const [subjectInnerTab, setSubjectInnerTab] = useState('stream');

  const selectedSubject = useMemo(() => subjects.find(item => item.id === activeSubjectId) || null, [activeSubjectId]);

  if (!selectedSubject) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {subjects.map(subject => (
          <button
            key={subject.id}
            onClick={() => {
              setActiveSubjectId(subject.id);
              setSubjectInnerTab('stream');
            }}
            className="text-left glass-surface rounded-3xl p-5 space-y-3 hover:border-indigo-300/40 border border-white/10 transition-colors"
          >
            <p className="text-lg command-title neon-title">{subject.name}</p>
            <p className="neon-subtle text-sm">{subject.teacher}</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-xl bg-slate-900/30 border border-white/10 p-2"><p className="micro-label accent-indigo">Performance</p><p className="text-slate-100 mt-1">{subject.performance}%</p></div>
              <div className="rounded-xl bg-slate-900/30 border border-white/10 p-2"><p className="micro-label accent-emerald">Attendance</p><p className="text-slate-100 mt-1">{subject.attendance}%</p></div>
              <div className="rounded-xl bg-slate-900/30 border border-white/10 p-2"><p className="micro-label accent-amber">Completion</p><p className="text-slate-100 mt-1">{subject.completion}%</p></div>
            </div>
            {renderProgressBars(subject.graph)}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 glass-surface rounded-3xl p-4">
        <div>
          <p className="micro-label accent-indigo">Subject Page</p>
          <h3 className="text-xl command-title neon-title">{selectedSubject.name}</h3>
          <p className="neon-subtle text-sm">Teacher: {selectedSubject.teacher}</p>
        </div>
        <button onClick={() => setActiveSubjectId(null)} className="px-4 py-2 rounded-xl border border-white/10 bg-slate-900/30 text-sm text-slate-100">Back to Subjects</button>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'stream', label: 'Subject Stream' },
          { id: 'assignments', label: 'Assignments' },
          { id: 'materials', label: 'Materials' },
          { id: 'members', label: 'Members' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setSubjectInnerTab(tab.id)} className={subjectInnerTab === tab.id ? 'px-4 py-2 rounded-2xl bg-indigo-500/30 border border-indigo-300/40 text-white' : 'px-4 py-2 rounded-2xl bg-slate-900/30 border border-white/10 text-slate-200'}>{tab.label}</button>
        ))}
      </div>

      {subjectInnerTab === 'stream' && (
        <section className="glass-surface rounded-3xl p-5 space-y-3">
          {selectedSubject.stream.map(item => (
            <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-900/30 p-4">
              <p className="text-slate-100"><span className="font-semibold">{item.author}:</span> {item.text}</p>
              <p className="micro-label mt-1 accent-indigo">{item.time}</p>
            </div>
          ))}
        </section>
      )}

      {subjectInnerTab === 'assignments' && (
        <section className="glass-surface rounded-3xl p-5 space-y-3">
          {selectedSubject.assignments.map(item => (
            <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-900/30 p-4 flex items-center justify-between gap-3">
              <div><p className="text-slate-100 font-semibold">{item.title}</p><p className="neon-subtle text-sm">Due: {item.due}</p></div>
              <span className="glass-chip rounded-full px-3 py-1 micro-label accent-amber">{item.status}</span>
            </div>
          ))}
        </section>
      )}

      {subjectInnerTab === 'materials' && (
        <section className="glass-surface rounded-3xl p-5 space-y-3">
          {selectedSubject.materials.map(item => (
            <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-900/30 p-4 flex items-center justify-between gap-3">
              <div><p className="text-slate-100 font-semibold">{item.title}</p><p className="neon-subtle text-sm">{item.type}</p></div>
              <span className="glass-chip rounded-full px-3 py-1 micro-label accent-indigo">{item.size}</span>
            </div>
          ))}
        </section>
      )}

      {subjectInnerTab === 'members' && (
        <section className="glass-surface rounded-3xl p-5 space-y-3">
          {selectedSubject.members.map(member => (
            <div key={member.name} className="rounded-2xl border border-white/10 bg-slate-900/30 p-4 flex items-center justify-between gap-3">
              <p className="text-slate-100 font-semibold">{member.name}</p>
              <span className={`glass-chip rounded-full px-3 py-1 micro-label ${getRoleAccent(member.role)}`}>{member.role}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
