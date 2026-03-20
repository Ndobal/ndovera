import React, { useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, CalendarClock, CheckCircle2, LayoutTemplate, Sparkles, UploadCloud, Video } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';

export default function CreateLessonPlan({ goBack }: { goBack: () => void }) {
  const navigate = useNavigate();
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState('');
  const [week, setWeek] = useState('');
  const [objectives, setObjectives] = useState('');
  const [materials, setMaterials] = useState('');
  const [activities, setActivities] = useState('');
  const [assessment, setAssessment] = useState('');
  const [notes, setNotes] = useState('');
  const [visibility, setVisibility] = useState('Immediate release');
  const [releaseAt, setReleaseAt] = useState('');
  const [liveClassMode, setLiveClassMode] = useState('Attach later');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const weekNumber = Number.parseInt(week, 10);
  const isValid = topic.trim() && subject.trim() && Number.isFinite(weekNumber) && weekNumber > 0;

  const checklist = useMemo(
    () => [
      { label: 'Topic and subject selected', done: Boolean(topic.trim() && subject.trim()), helper: 'Add a topic and subject to mark this ready.' },
      { label: 'Week mapped to curriculum flow', done: Number.isFinite(weekNumber) && weekNumber > 0, helper: 'Set a valid week number linked to curriculum pacing.' },
      { label: 'Objectives and activities drafted', done: Boolean(objectives.trim() && activities.trim()), helper: 'Fill in learning objectives and the teaching flow.' },
      { label: 'Assessment or follow-up ready', done: Boolean(assessment.trim()), helper: 'Add an assessment or follow-up action.' },
    ],
    [assessment, activities, objectives, subject, topic, weekNumber]
  );

  const completedChecklist = useMemo(() => checklist.filter((item) => item.done).length, [checklist]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      setError('Please enter topic, subject, and a valid week number.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.createLessonPlan({
        topic,
        subject,
        week: weekNumber,
        objectives,
        materials,
        activities,
        assessment,
        notes,
        visibility,
        releaseAt,
        liveClassMode,
      });
      setSuccess(true);
      setTimeout(() => {
        navigate('/classroom');
      }, 2000);
    } catch (err) {
      setError('Failed to create lesson plan');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto max-w-2xl rounded-[28px] border border-emerald-500/20 bg-slate-950 p-8 text-center shadow-2xl shadow-emerald-950/20">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
        <h1 className="mt-4 text-3xl font-black text-slate-100">Lesson plan created</h1>
        <p className="mt-2 text-slate-400">Redirecting you back to the classroom workspace...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <button onClick={goBack} className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" />
        Back to Lesson Plans
      </button>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <form onSubmit={handleSubmit} className="rounded-4xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black/20">
          <div className="rounded-[28px] border border-emerald-500/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(14,165,233,0.08),rgba(15,23,42,0.96))] p-6">
            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-emerald-300">Lesson plan creation</p>
            <h1 className="mt-3 text-3xl font-black text-white">Build a lesson plan that fits the classroom workflow</h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-300">
              Prepare the topic, weekly flow, classroom activities, assessment, materials, and release settings in one place.
            </p>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="topic" className="block text-sm font-semibold text-slate-200">Topic</label>
              <input
                type="text"
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="For example: Quadratic equations"
                className="mt-2 block w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white shadow-sm outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="subject" className="block text-sm font-semibold text-slate-200">Subject</label>
              <input
                type="text"
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="For example: Mathematics"
                className="mt-2 block w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white shadow-sm outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="week" className="block text-sm font-semibold text-slate-200">Week</label>
              <input
                type="number"
                id="week"
                min="1"
                value={week}
                onChange={(e) => setWeek(e.target.value)}
                placeholder="Week number"
                className="mt-2 block w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white shadow-sm outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="visibility" className="block text-sm font-semibold text-slate-200">Release setting</label>
              <select
                id="visibility"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className="mt-2 block w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white shadow-sm outline-none focus:border-emerald-500"
              >
                <option>Immediate release</option>
                <option>Schedule for later</option>
                <option>Draft only</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="releaseAt" className="block text-sm font-semibold text-slate-200">Release date and time</label>
              <input
                type="datetime-local"
                id="releaseAt"
                value={releaseAt}
                onChange={(e) => setReleaseAt(e.target.value)}
                className="mt-2 block w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white shadow-sm outline-none focus:border-emerald-500"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="objectives" className="block text-sm font-semibold text-slate-200">Learning objectives</label>
              <textarea
                id="objectives"
                value={objectives}
                onChange={(e) => setObjectives(e.target.value)}
                rows={4}
                placeholder="Outline what learners should understand or demonstrate after the lesson."
                className="mt-2 block w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white shadow-sm outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="materials" className="block text-sm font-semibold text-slate-200">Materials and resources</label>
              <textarea
                id="materials"
                value={materials}
                onChange={(e) => setMaterials(e.target.value)}
                rows={5}
                placeholder="Books, slides, worksheets, videos, links, or classroom materials."
                className="mt-2 block w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white shadow-sm outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="activities" className="block text-sm font-semibold text-slate-200">Activities and teaching flow</label>
              <textarea
                id="activities"
                value={activities}
                onChange={(e) => setActivities(e.target.value)}
                rows={5}
                placeholder="Starter, explanation, guided practice, group task, recap, and homework."
                className="mt-2 block w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white shadow-sm outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="assessment" className="block text-sm font-semibold text-slate-200">Assessment</label>
              <textarea
                id="assessment"
                value={assessment}
                onChange={(e) => setAssessment(e.target.value)}
                rows={4}
                placeholder="Exit ticket, observation, quiz, assignment, or oral questioning."
                className="mt-2 block w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white shadow-sm outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="liveClassMode" className="block text-sm font-semibold text-slate-200">Live class attachment</label>
              <select
                id="liveClassMode"
                value={liveClassMode}
                onChange={(e) => setLiveClassMode(e.target.value)}
                className="mt-2 block w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white shadow-sm outline-none focus:border-emerald-500"
              >
                <option>Attach later</option>
                <option>Prepare for next live class</option>
                <option>Use as pre-read material</option>
                <option>Use as post-class follow-up</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="notes" className="block text-sm font-semibold text-slate-200">Teacher notes</label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Add reminders for delivery, differentiation, or follow-up actions."
                className="mt-2 block w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white shadow-sm outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {error && <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6">
            <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-400">
              <span className="rounded-full bg-slate-900 px-3 py-1">Subject aligned</span>
              <span className="rounded-full bg-slate-900 px-3 py-1">Schedule aware</span>
              <span className="rounded-full bg-slate-900 px-3 py-1">Live-class ready</span>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? 'Creating...' : 'Create Lesson Plan'}
            </button>
          </div>
        </form>

        <aside className="space-y-4">
          <div className="rounded-4xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black/20">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black uppercase tracking-[0.35em] text-sky-300">Blueprint checklist</p>
              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-emerald-300">{completedChecklist}/{checklist.length} ready</p>
            </div>
            <div className="mt-4 space-y-3">
              {checklist.map((item) => (
                <div key={item.label} className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/3 p-3">
                  <CheckCircle2 className={`mt-0.5 h-4 w-4 ${item.done ? 'text-emerald-400' : 'text-slate-600'}`} />
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{item.label}</p>
                    <p className="text-xs text-slate-400">{item.done ? 'Ready' : item.helper}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-4xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black/20">
            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-amber-300">Plan summary</p>
            <div className="mt-4 space-y-4 text-sm text-slate-300">
              <div className="flex items-start gap-3">
                <BookOpen className="mt-0.5 h-4 w-4 text-emerald-400" />
                <div>
                  <p className="font-semibold text-white">{subject || 'Subject not selected yet'}</p>
                  <p className="text-slate-400">{topic || 'Topic will appear here as you type.'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CalendarClock className="mt-0.5 h-4 w-4 text-sky-400" />
                <div>
                  <p className="font-semibold text-white">Week {week || '—'}</p>
                  <p className="text-slate-400">{visibility}{releaseAt ? ` • ${releaseAt}` : ''}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Video className="mt-0.5 h-4 w-4 text-fuchsia-400" />
                <div>
                  <p className="font-semibold text-white">{liveClassMode}</p>
                  <p className="text-slate-400">Attach this plan to a classroom live session when ready.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-4xl border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black/20">
            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-violet-300">Suggested structure</p>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="flex items-center gap-3"><LayoutTemplate className="h-4 w-4 text-violet-400" /> Objectives and expected outcomes</div>
              <div className="flex items-center gap-3"><UploadCloud className="h-4 w-4 text-amber-400" /> Materials, links, and uploaded assets</div>
              <div className="flex items-center gap-3"><Sparkles className="h-4 w-4 text-sky-400" /> Activities, assessment, and classroom follow-up</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
