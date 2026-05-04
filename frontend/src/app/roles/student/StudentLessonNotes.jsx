import React, { useMemo, useState } from 'react';
import StudentSectionShell from './StudentSectionShell';
import { notesMaterials, subjectCards, videoMaterials } from './studentLearningData';

export default function StudentLessonNotes() {
  const [activeTab, setActiveTab] = useState('notes');
  const [subjectId, setSubjectId] = useState('all');

  const filteredNotes = useMemo(() => (
    subjectId === 'all' ? notesMaterials : notesMaterials.filter(item => item.subjectId === subjectId)
  ), [subjectId]);

  const filteredVideos = useMemo(() => (
    subjectId === 'all' ? videoMaterials : videoMaterials.filter(item => item.subjectId === subjectId)
  ), [subjectId]);

  return (
    <StudentSectionShell title="Materials" subtitle="See all notes and videos from every subject in one place.">
      <section className="glass-surface rounded-3xl p-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setActiveTab('notes')} className={`burgundy-tab px-4 py-2 rounded-2xl font-semibold border ${activeTab === 'notes' ? 'dark:bg-indigo-500/30 dark:text-white dark:border-indigo-300/40' : 'dark:bg-slate-900/30 dark:text-slate-200 dark:border-white/10'}`}>Notes</button>
          <button onClick={() => setActiveTab('videos')} className={`burgundy-tab px-4 py-2 rounded-2xl font-semibold border ${activeTab === 'videos' ? 'dark:bg-indigo-500/30 dark:text-white dark:border-indigo-300/40' : 'dark:bg-slate-900/30 dark:text-slate-200 dark:border-white/10'}`}>Videos</button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => setSubjectId('all')} className={`burgundy-tab px-3 py-1 rounded-full text-sm border ${subjectId === 'all' ? 'dark:bg-emerald-500/30 dark:border-emerald-300/40 dark:text-white' : 'dark:bg-slate-900/30 dark:border-white/10 dark:text-slate-200'}`}>All Subjects</button>
          {subjectCards.map(subject => (
            <button
              key={subject.id}
              onClick={() => setSubjectId(subject.id)}
              className={`burgundy-tab px-3 py-1 rounded-full text-sm border ${subjectId === subject.id ? 'dark:bg-emerald-500/30 dark:border-emerald-300/40 dark:text-white' : 'dark:bg-slate-900/30 dark:border-white/10 dark:text-slate-200'}`}
            >
              {subject.title}
            </button>
          ))}
        </div>

        {activeTab === 'notes' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredNotes.map(note => (
              <article key={note.id} className="wheat-card rounded-3xl border border-white/10 overflow-hidden bg-slate-900/30">
                <img src={note.cover} alt={note.title} className="w-full h-36 object-cover" />
                <div className="p-4">
                  <p className="text-slate-100 font-semibold">{note.title}</p>
                  <p className="neon-subtle text-sm mt-1">{note.subject} • {note.pages} pages</p>
                  <p className="micro-label mt-2 accent-indigo">Uploaded by {note.teacher}</p>
                </div>
              </article>
            ))}
            {filteredNotes.length === 0 && (
              <div className="wheat-card rounded-3xl border border-dashed border-white/10 bg-slate-900/20 p-5 text-center md:col-span-2 xl:col-span-3">
                <p className="micro-label accent-amber">No live notes</p>
                <p className="mt-2 text-sm text-slate-300">Lesson notes will appear here when teachers upload real materials for your subjects.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'videos' && (
          <div className="space-y-3">
            {filteredVideos.map(video => (
              <div key={video.id} className="wheat-card rounded-2xl border border-white/10 p-4 bg-slate-900/30 flex items-center justify-between gap-3">
                <div>
                  <p className="text-slate-100 font-semibold">{video.title}</p>
                  <p className="neon-subtle text-sm">{video.subject} • {video.teacher}</p>
                </div>
                <div className="text-right">
                  <p className="micro-label accent-amber">{video.duration}</p>
                  <p className="neon-subtle text-xs">{video.uploaded}</p>
                </div>
              </div>
            ))}
            {filteredVideos.length === 0 && (
              <div className="wheat-card rounded-3xl border border-dashed border-white/10 bg-slate-900/20 p-5 text-center">
                <p className="micro-label accent-amber">No live videos</p>
                <p className="mt-2 text-sm text-slate-300">Teacher-uploaded video lessons will appear here when available.</p>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="wheat-card glass-surface rounded-3xl p-6 mt-6">
        <p className="text-slate-100 font-semibold">Upload Rule</p>
        <p className="text-slate-300 mt-2">Teachers can upload materials and assignments from their assigned subjects only. Students can view, learn, and submit work here.</p>
      </section>
    </StudentSectionShell>
  );
}
