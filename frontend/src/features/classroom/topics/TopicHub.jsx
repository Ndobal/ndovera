import React, { useCallback, useEffect, useState } from 'react';
import RichContent from '../../../shared/rich/RichContent';
import MaterialViewer from '../materials/MaterialViewer';
import TopicStudyChat from './TopicStudyChat';
import { getTopicHub, recordTopicProgress } from '../classroomService';

// One topic as a learning hub: the teacher's overview and objectives, every
// note, material, assignment and quiz filed under it, the student's progress,
// and a way into studying it with Ndovera AI.

const STEPS = [
  ['studying', 'Studying'],
  ['materialsViewed', 'Materials Viewed'],
  ['assignmentCompleted', 'Assignment Completed'],
  ['quizCompleted', 'Quiz Completed'],
];

function ProgressSteps({ progress }) {
  if (!progress) return null;
  return (
    <section aria-label="Your progress" className="rounded-2xl border border-[#c9a96e]/40 bg-white/80 p-4 dark:border-white/10 dark:bg-slate-900/40">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#800020] dark:text-slate-300">Your progress · {progress.label}</p>
      <ol className="mt-3 grid gap-2 sm:grid-cols-4">
        {STEPS.map(([key, label]) => (
          <li key={key} className={`rounded-xl px-3 py-2 text-xs font-bold ${progress.stages[key] ? 'bg-[#1a5c38] text-[#b5e3f4]' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
            {progress.stages[key] ? '✓ ' : ''}{label}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
        {progress.counts.materialsViewed}/{progress.counts.materials} materials viewed · {progress.counts.assignmentsSubmitted}/{progress.counts.assignments} assignments · {progress.counts.quizzesSubmitted}/{progress.counts.quizzes} quizzes.
        This shows what you have done; your teacher and assessments decide completion.
      </p>
    </section>
  );
}

export default function TopicHub({ classId, topicId, subjectName = '', studentId = '', onBack }) {
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const [openMaterial, setOpenMaterial] = useState(null);
  const [studying, setStudying] = useState(false);

  const load = useCallback(() => {
    return getTopicHub(classId, topicId, studentId ? { studentId } : {})
      .then(data => {
        if (!data?.success) throw new Error(data?.message || 'Could not load this topic.');
        setState({ loading: false, error: '', data });
      })
      .catch(err => setState({ loading: false, error: err.message, data: null }));
  }, [classId, topicId, studentId]);

  useEffect(() => {
    load();
    recordTopicProgress(classId, topicId, { event: 'opened' }).catch(() => null);
  }, [classId, topicId, load]);

  function openMaterialItem(material) {
    setOpenMaterial(material);
    recordTopicProgress(classId, topicId, { event: 'material_viewed', materialId: material.id }).then(load).catch(() => null);
  }

  if (state.loading) return <p role="status" className="p-4 text-sm text-[#800020]">Loading topic…</p>;
  if (state.error) return <p role="alert" className="p-4 text-sm font-semibold text-red-700">{state.error}</p>;
  const { topic, materials, assignments, progress, canManage } = state.data;
  const quizzes = assignments.filter(item => item.isQuiz);
  const tasks = assignments.filter(item => !item.isQuiz);

  return (
    <div className="space-y-4">
      <header className="rounded-3xl bg-gradient-to-br from-[#191970] to-[#2447d8] p-5 text-white shadow-lg">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#b5e3f4]">{subjectName || 'Topic'}{topic.week ? ` · ${topic.week}` : ''}{canManage && topic.status === 'draft' ? ' · Draft (students cannot see this yet)' : ''}</p>
            <h2 className="mt-1 text-2xl font-black">{topic.name}</h2>
            {topic.description && <RichContent className="mt-2 text-sm text-white/90" text={topic.description} />}
          </div>
          {onBack && <button type="button" onClick={onBack} className="rounded-2xl border border-white/30 px-3 py-1.5 text-sm font-bold">← Topics</button>}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setStudying(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#c9a96e] px-5 py-3 text-base font-black text-[#191970] shadow transition hover:bg-[#e0c48c]">
            ✨ Study with Ndovera AI
          </button>
          {canManage && typeof window !== 'undefined' && window.location.pathname.startsWith('/roles/teacher') && (
            <span className="inline-flex flex-wrap items-center gap-1 rounded-2xl border border-white/30 px-2 py-1.5 text-sm font-bold">
              <span className="px-1">Create with Ndovera AI:</span>
              {[['quiz', 'Quiz'], ['assignment', 'Assignment'], ['exam', 'Exam']].map(([kind, label]) => (
                <a key={kind} className="rounded-xl bg-white/15 px-3 py-1 hover:bg-white/25"
                  href={`/roles/teacher/ai-assistant?tab=assessment&classId=${encodeURIComponent(classId)}&subjectId=${encodeURIComponent(topic.subjectId)}&topicId=${encodeURIComponent(topic.id)}&kind=${kind}`}>{label}</a>
              ))}
            </span>
          )}
        </div>
      </header>

      {topic.objectives.length > 0 && (
        <section aria-label="Learning objectives" className="rounded-2xl border border-[#1a5c38]/30 bg-[#e8f5ee] p-4 dark:bg-emerald-950/30">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5c38] dark:text-emerald-300">By the end of this topic you should be able to</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#191970] dark:text-slate-100">{topic.objectives.map((item, index) => <li key={index}>{item}</li>)}</ul>
        </section>
      )}

      <ProgressSteps progress={progress} />

      <section aria-label="Notes and materials" className="space-y-2">
        <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-[#800020] dark:text-slate-300">Notes and materials ({materials.length})</h3>
        {materials.length === 0 ? <p className="text-sm text-slate-500">Nothing has been added to this topic yet.</p> : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {materials.map(material => {
              const viewed = progress?.viewedMaterialIds?.includes(material.id);
              return (
                <li key={material.id}>
                  <button type="button" onClick={() => openMaterialItem(material)} className="w-full rounded-2xl border border-[#c9a96e]/40 bg-white p-3 text-left shadow-sm transition hover:border-[#2447d8] dark:border-white/10 dark:bg-slate-900">
                    <p className="font-bold text-[#191970] dark:text-white">{material.title}</p>
                    <p className="text-xs text-[#800020] dark:text-slate-400">
                      {material.url ? material.type : 'Teacher’s note'}{material.metadata?.postedByLabel ? ` · Posted by ${material.metadata.postedByLabel}` : ''}{viewed ? ' · ✓ Viewed' : ''}
                      {canManage && material.status !== 'published' ? ` · ${material.status}` : ''}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {[['Assignments and exercises', tasks], ['Quizzes', quizzes]].map(([label, items]) => (
        <section key={label} aria-label={label} className="space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-[#800020] dark:text-slate-300">{label} ({items.length})</h3>
          {items.length === 0 ? <p className="text-sm text-slate-500">None yet.</p> : (
            <ul className="space-y-2">
              {items.map(item => (
                <li key={item.id} className="rounded-2xl border border-[#c9a96e]/40 bg-white p-3 dark:border-white/10 dark:bg-slate-900">
                  <p className="font-bold text-[#191970] dark:text-white">{item.title}</p>
                  <p className="text-xs text-[#800020] dark:text-slate-400">{item.dueAt ? `Due ${new Date(item.dueAt).toLocaleString()}` : 'No due date'}{item.postedByLabel ? ` · Posted by ${item.postedByLabel}` : ''}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {openMaterial && <MaterialViewer material={openMaterial} onClose={() => setOpenMaterial(null)} />}
      {studying && <TopicStudyChat classId={classId} topic={topic} subjectName={subjectName} onClose={() => { setStudying(false); load(); }} />}
    </div>
  );
}
