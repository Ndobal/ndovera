import React, { useEffect, useMemo, useState } from 'react';
import StudentSectionShell from '../../app/roles/student/StudentSectionShell';
import { getAssignedClasses, getLiveSessions, getMaterials } from '../classroom/classroomService';
import { getLessonPlans, saveLessonPlan } from '../school/services/schoolApi';

const EMPTY_DRAFT = {
  id: '',
  subjectId: '',
  title: '',
  topic: '',
  weekLabel: '',
  visibility: 'student',
  releaseAt: '',
  liveSessionId: '',
  objectives: '',
  activities: '',
  assessment: '',
  notes: '',
  resourceIds: [],
};

function toDateTimeInputValue(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const offset = parsed.getTimezoneOffset() * 60000;
  return new Date(parsed.getTime() - offset).toISOString().slice(0, 16);
}

function formatDateTime(value, fallback = 'Schedule not set') {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function getStatusTone(status) {
  switch (String(status || '').toLowerCase()) {
    case 'approved':
      return 'bg-emerald-500/20 border-emerald-400/40 text-emerald-100';
    case 'returned':
      return 'bg-rose-500/15 border-rose-300/40 text-rose-100';
    case 'submitted':
      return 'bg-amber-500/20 border-amber-300/40 text-amber-50';
    default:
      return 'bg-slate-900/30 border-white/10 text-slate-100';
  }
}

export default function TeacherLessonPlansPage() {
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [materials, setMaterials] = useState([]);
  const [liveSessions, setLiveSessions] = useState([]);
  const [lessonPlans, setLessonPlans] = useState([]);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedClass = assignedClasses.find(classroom => classroom.id === classId) || null;
  const subjectOptions = selectedClass?.subjects || [];

  useEffect(() => {
    let cancelled = false;

    async function loadAssignedClasses() {
      setLoading(true);
      setError('');

      try {
        const response = await getAssignedClasses();
        if (cancelled) return;

        const classes = response?.classes || [];
        setAssignedClasses(classes);
        const preferredClassId = window.localStorage.getItem('teacherClassroomId') || '';
        const nextClassId = classes.some(classroom => classroom.id === preferredClassId)
          ? preferredClassId
          : String(classes[0]?.id || '');
        setClassId(nextClassId);
      } catch (err) {
        if (!cancelled) {
          setAssignedClasses([]);
          setError(err instanceof Error ? err.message : 'Could not load your classes.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAssignedClasses();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!classId) {
      setMaterials([]);
      setLiveSessions([]);
      setLessonPlans([]);
      return;
    }

    let cancelled = false;
    window.localStorage.setItem('teacherClassroomId', classId);
    window.localStorage.setItem('classroomId', classId);
    setError('');

    Promise.all([
      getMaterials(classId),
      getLiveSessions(classId),
      getLessonPlans({ classId }),
    ]).then(([materialsResponse, liveResponse, plansResponse]) => {
      if (cancelled) return;
      setMaterials(materialsResponse?.materials || []);
      setLiveSessions(liveResponse?.sessions || []);
      setLessonPlans(plansResponse?.lessonPlans || []);
    }).catch(err => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : 'Could not load lesson plan data.');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [classId]);

  useEffect(() => {
    if (!subjectOptions.length) {
      setDraft(current => ({ ...current, subjectId: '' }));
      return;
    }

    setDraft(current => (
      subjectOptions.some(subject => subject.id === current.subjectId)
        ? current
        : { ...current, subjectId: String(subjectOptions[0]?.id || '') }
    ));
  }, [subjectOptions]);

  const selectedLiveSession = liveSessions.find(session => session.id === draft.liveSessionId) || null;

  function resetDraft() {
    setDraft({
      ...EMPTY_DRAFT,
      subjectId: String(subjectOptions[0]?.id || ''),
    });
  }

  function updateDraft(field, value) {
    setDraft(current => ({ ...current, [field]: value }));
  }

  function toggleResource(materialId) {
    setDraft(current => ({
      ...current,
      resourceIds: current.resourceIds.includes(materialId)
        ? current.resourceIds.filter(id => id !== materialId)
        : [...current.resourceIds, materialId],
    }));
  }

  function handleEditPlan(plan) {
    setMessage('');
    setError('');
    setDraft({
      id: String(plan.id || ''),
      subjectId: String(plan.subjectId || subjectOptions[0]?.id || ''),
      title: String(plan.title || ''),
      topic: String(plan.topic || ''),
      weekLabel: String(plan.weekLabel || ''),
      visibility: String(plan.visibility || 'student'),
      releaseAt: toDateTimeInputValue(plan.releaseAt),
      liveSessionId: String(plan.liveSessionId || ''),
      objectives: String(plan.objectives || ''),
      activities: String(plan.activities || ''),
      assessment: String(plan.assessment || ''),
      notes: String(plan.notes || ''),
      resourceIds: (plan.resources || []).map(resource => String(resource.id || '')).filter(Boolean),
    });
  }

  async function persistLessonPlan(status) {
    if (!classId) {
      setError('Choose a class before saving a lesson plan.');
      return;
    }

    if (!draft.subjectId || !draft.title.trim() || !draft.topic.trim() || !draft.weekLabel.trim()) {
      setError('Subject, title, topic, and week are required.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const selectedResources = materials
        .filter(material => draft.resourceIds.includes(String(material.id || '')))
        .map(material => ({
          id: String(material.id || ''),
          title: material.title,
          url: material.url,
          type: material.type,
          description: material.description,
        }));

      const response = await saveLessonPlan({
        id: draft.id || undefined,
        classId,
        subjectId: draft.subjectId,
        title: draft.title.trim(),
        topic: draft.topic.trim(),
        weekLabel: draft.weekLabel.trim(),
        visibility: draft.visibility,
        releaseAt: draft.releaseAt,
        liveSessionId: draft.liveSessionId,
        liveSessionLabel: selectedLiveSession?.topic || selectedLiveSession?.subjectName || '',
        objectives: draft.objectives.trim(),
        activities: draft.activities.trim(),
        assessment: draft.assessment.trim(),
        notes: draft.notes.trim(),
        resources: selectedResources,
        status,
      });

      const savedPlan = response?.lessonPlan;
      setLessonPlans(current => {
        const others = current.filter(plan => plan.id !== savedPlan?.id);
        return savedPlan ? [savedPlan, ...others] : current;
      });
      setMessage(status === 'submitted' ? 'Lesson plan submitted for review.' : 'Lesson plan saved as draft.');
      resetDraft();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this lesson plan.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <StudentSectionShell
      title="Lesson Plans"
      subtitle="Draft weekly plans, link classroom resources, and submit them for review."
      dashboardLabel="Teacher Dashboard"
      watermarkText="Teacher Lesson Plans"
    >
      <div className="space-y-6">
        <section className="glass-surface rounded-3xl p-6">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div>
              <p className="micro-label neon-subtle">Assigned Classes</p>
              <p className="text-slate-100 font-semibold mt-2">Choose the class you are planning for.</p>
            </div>
            <select
              value={classId}
              onChange={event => setClassId(event.target.value)}
              className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white"
            >
              <option value="">Select class</option>
              {assignedClasses.map(classroom => (
                <option key={classroom.id} value={classroom.id}>{classroom.className}</option>
              ))}
            </select>
          </div>

          {loading && <p className="mt-4 text-sm text-slate-300">Loading teacher classes...</p>}
          {!loading && !assignedClasses.length && <p className="mt-4 text-sm text-amber-200">No class has been assigned to you yet.</p>}
          {error && <p className="mt-4 text-sm text-rose-200">{error}</p>}
          {message && <p className="mt-4 text-sm text-emerald-200">{message}</p>}
        </section>

        {selectedClass && (
          <section className="grid grid-cols-1 xl:grid-cols-[1.2fr,0.8fr] gap-6">
            <article className="glass-surface rounded-3xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="micro-label neon-subtle">Plan Builder</p>
                  <h2 className="text-xl font-semibold text-slate-100 mt-2">{draft.id ? 'Edit lesson plan' : 'Create lesson plan'}</h2>
                </div>
                {draft.id && (
                  <button
                    type="button"
                    onClick={resetDraft}
                    className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-100"
                  >
                    New Plan
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select value={draft.subjectId} onChange={event => updateDraft('subjectId', event.target.value)} className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white">
                  {subjectOptions.map(subject => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
                <input value={draft.weekLabel} onChange={event => updateDraft('weekLabel', event.target.value)} placeholder="Week or focus window" className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white" />
                <input value={draft.title} onChange={event => updateDraft('title', event.target.value)} placeholder="Lesson plan title" className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white md:col-span-2" />
                <input value={draft.topic} onChange={event => updateDraft('topic', event.target.value)} placeholder="Topic" className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white" />
                <select value={draft.visibility} onChange={event => updateDraft('visibility', event.target.value)} className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white">
                  <option value="student">Students only</option>
                  <option value="student_parent">Students + parents</option>
                  <option value="teacher">Teacher only</option>
                </select>
                <input value={draft.releaseAt} onChange={event => updateDraft('releaseAt', event.target.value)} type="datetime-local" className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white" />
                <select value={draft.liveSessionId} onChange={event => updateDraft('liveSessionId', event.target.value)} className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white">
                  <option value="">No linked live class</option>
                  {liveSessions.map(session => (
                    <option key={session.id} value={session.id}>{session.subjectName || 'Live class'}{session.topic ? ` • ${session.topic}` : ''}</option>
                  ))}
                </select>
              </div>

              <textarea value={draft.objectives} onChange={event => updateDraft('objectives', event.target.value)} rows={4} placeholder="Objectives" className="w-full rounded-3xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white" />
              <textarea value={draft.activities} onChange={event => updateDraft('activities', event.target.value)} rows={4} placeholder="Activities / methodology" className="w-full rounded-3xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white" />
              <textarea value={draft.assessment} onChange={event => updateDraft('assessment', event.target.value)} rows={3} placeholder="Assessment" className="w-full rounded-3xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white" />
              <textarea value={draft.notes} onChange={event => updateDraft('notes', event.target.value)} rows={4} placeholder="Teacher notes or delivery guide" className="w-full rounded-3xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white" />

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-100">Linked lesson resources</p>
                  <p className="text-xs text-slate-300 mt-1">Select the materials students should open alongside this plan.</p>
                </div>
                <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto pr-1">
                  {materials.length === 0 && <p className="text-sm text-slate-300">No class materials yet. Publish lesson notes first if you want to attach them here.</p>}
                  {materials.map(material => {
                    const checked = draft.resourceIds.includes(String(material.id || ''));
                    return (
                      <label key={material.id} className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 flex items-start gap-3">
                        <input type="checkbox" checked={checked} onChange={() => toggleResource(String(material.id || ''))} className="mt-1" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-100">{material.title}</p>
                          <p className="text-xs text-slate-300 mt-1">{material.subjectName || 'General Material'}{material.weekLabel ? ` • ${material.weekLabel}` : ''}</p>
                          {material.description && <p className="text-xs text-slate-400 mt-2">{material.description}</p>}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="button" disabled={saving} onClick={() => persistLessonPlan('draft')} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                  {saving ? 'Saving...' : 'Save Draft'}
                </button>
                <button type="button" disabled={saving} onClick={() => persistLessonPlan('submitted')} className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-bold text-black disabled:opacity-60">
                  {saving ? 'Submitting...' : 'Submit For Review'}
                </button>
              </div>
            </article>

            <article className="glass-surface rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="micro-label neon-subtle">Existing Plans</p>
                  <h2 className="text-xl font-semibold text-slate-100 mt-2">{selectedClass.className}</h2>
                </div>
                <span className="glass-chip px-3 py-1 rounded-full text-xs font-semibold text-slate-100">{lessonPlans.length} plan(s)</span>
              </div>

              <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                {lessonPlans.length === 0 && <p className="text-sm text-slate-300">No lesson plans saved for this class yet.</p>}
                {lessonPlans.map(plan => (
                  <div key={plan.id} className="rounded-3xl border border-white/10 bg-slate-950/30 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-slate-100 font-semibold">{plan.title}</p>
                        <p className="text-xs text-slate-300 mt-1">{plan.subjectName || 'Subject'}{plan.weekLabel ? ` • ${plan.weekLabel}` : ''}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${getStatusTone(plan.status)}`}>
                        {plan.status || 'draft'}
                      </span>
                    </div>

                    <div className="space-y-1 text-sm text-slate-300">
                      <p><span className="text-slate-100">Topic:</span> {plan.topic || 'Not set'}</p>
                      <p><span className="text-slate-100">Release:</span> {formatDateTime(plan.releaseAt, 'Immediately after approval')}</p>
                      <p><span className="text-slate-100">Updated:</span> {formatDateTime(plan.updatedAt, 'Recently')}</p>
                    </div>

                    {plan.reviewComment && (
                      <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 px-3 py-3 text-sm text-rose-100">
                        <p className="font-semibold">Reviewer comment</p>
                        <p className="mt-2 whitespace-pre-wrap">{plan.reviewComment}</p>
                      </div>
                    )}

                    <button type="button" onClick={() => handleEditPlan(plan)} className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-100">
                      Edit Plan
                    </button>
                  </div>
                ))}
              </div>
            </article>
          </section>
        )}
      </div>
    </StudentSectionShell>
  );
}