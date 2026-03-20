import { useMemo, useState } from 'react';
import { Mic, MonitorUp, PlayCircle, TimerReset, Users, Video, X } from 'lucide-react';

import { useData } from '../../../hooks/useData';
import LiveApp from './live/App';
import { liveClasses } from '../data/classroomExperience';
import { closeLiveClass, createLiveClass, joinLiveClass, type LiveClassSession } from '../services/classroomApi';

type LiveClassStudioProps = {
  role: string;
};

export function LiveClassStudio({ role }: LiveClassStudioProps) {
  const teacherView = role === 'Teacher' || role === 'School Admin' || role === 'HOS' || role === 'Super Admin';
  const { data, refetch, loading } = useData<LiveClassSession[]>('/api/classroom/live-classes');
  const sessions = useMemo(() => (data && data.length ? data : liveClasses), [data]);
  const [draft, setDraft] = useState({ title: '', mode: 'Student Lesson', schedule: '', duration: '60 mins' });
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [guideSessionId, setGuideSessionId] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<{ id?: string; title: string; meetingUrl?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const launchInstantRoom = async () => {
    setBusyKey('instant_live');
    setError(null);
    try {
      const created = await createLiveClass({
        title: draft.title.trim() || 'Instant live class',
        mode: draft.mode,
        schedule: 'Now',
        duration: draft.duration.trim() || '60 mins',
      });
      await refetch();
      setActiveRoom({ id: created.id, title: draft.title.trim() || 'Instant live class', meetingUrl: `/live/${created.id}` });
      setDraft({ title: '', mode: 'Student Lesson', schedule: '', duration: '60 mins' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start instant live class.');
    } finally {
      setBusyKey(null);
    }
  };

  const saveSession = async () => {
    if (!draft.title.trim()) return;
    setBusyKey('create_live');
    setError(null);
    try {
      await createLiveClass({
        title: draft.title.trim(),
        mode: draft.mode,
        schedule: draft.schedule.trim() || 'TBD',
        duration: draft.duration.trim() || '60 mins',
      });
      setDraft({ title: '', mode: 'Student Lesson', schedule: '', duration: '60 mins' });
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to schedule live class.');
    } finally {
      setBusyKey(null);
    }
  };

  const openSession = async (sessionId: string) => {
    setBusyKey(`join_${sessionId}`);
    setError(null);
    try {
      const response = await joinLiveClass(sessionId);
      await refetch();
      setActiveRoom({ id: sessionId, title: response.title || 'Live class', meetingUrl: response.meetingUrl });
      setGuideSessionId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to join live class.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleRoomExit = async () => {
    if (teacherView && activeRoom?.id) {
      setBusyKey(`close_${activeRoom.id}`);
      setError(null);
      try {
        await closeLiveClass(activeRoom.id);
        await refetch();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to close live class.');
        setBusyKey(null);
        return;
      }
    }

    setActiveRoom(null);
    setBusyKey(null);
  };

  return (
    <div className="space-y-6 h-[calc(100vh-200px)] overflow-y-auto pr-1 custom-scrollbar">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-600">Live class</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Virtual classroom for lessons, meetings, and PTF</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Teachers can start live classes from here, and students can join from the same tab. Entering a room now opens the same live classroom surface used inside each subject.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Supported modes</p>
            <p>Class lessons, staff meetings, leadership briefings, and parent-teacher forums.</p>
          </div>
        </div>
      </section>

      {teacherView ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Start or schedule a class</p>
              <p className="text-sm text-slate-500">Use the classroom tab as the same live launch point teachers already expect inside subjects. Each tenant school can have up to 5 active live classrooms at once.</p>
            </div>
            <button type="button" onClick={launchInstantRoom} className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white">
              <PlayCircle className="h-4 w-4" />
              {busyKey === 'instant_live' ? 'Starting…' : 'Start instant class'}
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Session title" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400" />
            <select value={draft.mode} onChange={(event) => setDraft((current) => ({ ...current, mode: event.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400">
              <option>Student Lesson</option>
              <option>Staff Meeting</option>
              <option>Parents-Teachers Forum</option>
              <option>Leadership Briefing</option>
            </select>
            <input value={draft.schedule} onChange={(event) => setDraft((current) => ({ ...current, schedule: event.target.value }))} placeholder="Schedule" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400" />
            <div className="flex gap-3">
              <input value={draft.duration} onChange={(event) => setDraft((current) => ({ ...current, duration: event.target.value }))} placeholder="Duration" className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-400" />
              <button type="button" onClick={saveSession} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
                {busyKey === 'create_live' ? 'Saving…' : 'Schedule'}
              </button>
            </div>
          </div>
          {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}
        </section>
      ) : null}

      {!teacherView && error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}

      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">Loading live classes…</div> : null}

      {guideSessionId ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-600">Live class guide</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">Prepare before entering the room</h3>
              </div>
              <button type="button" onClick={() => setGuideSessionId(null)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">Before joining</p>
                <ul className="mt-3 space-y-2">
                  <li>• Confirm microphone and speaker readiness.</li>
                  <li>• Keep lesson note or assignment tab ready if needed.</li>
                  <li>• Join with your correct class identity.</li>
                </ul>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">During class</p>
                <ul className="mt-3 space-y-2">
                  <li>• Use raise hand before speaking.</li>
                  <li>• Chat should stay on the active lesson.</li>
                  <li>• Recording and attendance remain school-controlled.</li>
                </ul>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setGuideSessionId(null)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                Not now
              </button>
              <button type="button" onClick={() => openSession(guideSessionId)} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                {busyKey === `join_${guideSessionId}` ? 'Opening…' : 'Continue to room'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeRoom ? (
        <div className="fixed inset-0 z-40 bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-6xl flex-col rounded-4xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-600">Live room</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">{activeRoom.title}</h3>
              </div>
              <button type="button" onClick={handleRoomExit} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                {teacherView && activeRoom.id ? busyKey === `close_${activeRoom.id}` ? 'Closing…' : 'End class' : 'Leave room'}
              </button>
            </div>
            <div className="grid flex-1 gap-4 p-6 lg:grid-cols-[1.3fr_0.7fr]">
              <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950">
                <LiveApp />
              </div>
              <div className="space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">Room tools</p>
                  <ul className="mt-3 space-y-2">
                    <li>• Raise hand, attendance, and moderation stay active.</li>
                    <li>• Screen share and class interaction now match the subject live room.</li>
                    <li>• Use the same join surface for classroom-wide and subject-based sessions.</li>
                  </ul>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">Room reference</p>
                  <p className="mt-2 break-all">{activeRoom.meetingUrl || 'local live room'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <Users className="h-5 w-5 text-sky-600" />
          <h3 className="mt-4 text-lg font-semibold text-slate-900">Capacity</h3>
          <p className="mt-2 text-sm text-slate-600">Up to 300 attendees with host and assistant host controls.</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <MonitorUp className="h-5 w-5 text-violet-600" />
          <h3 className="mt-4 text-lg font-semibold text-slate-900">Collaboration</h3>
          <p className="mt-2 text-sm text-slate-600">Screen share, digital whiteboard, and teacher-first moderation.</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <Mic className="h-5 w-5 text-emerald-600" />
          <h3 className="mt-4 text-lg font-semibold text-slate-900">Participation</h3>
          <p className="mt-2 text-sm text-slate-600">Raise hand, moderated microphones, chat queue, and attendance log.</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <TimerReset className="h-5 w-5 text-amber-600" />
          <h3 className="mt-4 text-lg font-semibold text-slate-900">Auto-end rule</h3>
          <p className="mt-2 text-sm text-slate-600">Meeting remains open for 30 minutes after both hosts exit.</p>
        </div>
      </div>

      <div className="space-y-4">
        {sessions.map((session) => (
          <section key={session.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">{session.mode}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{session.schedule}</span>
                  <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">{session.duration}</span>
                </div>
                <h3 className="mt-3 text-xl font-semibold text-slate-900">{session.title}</h3>
                <p className="mt-2 text-sm text-slate-600">Hosts: {session.hosts.join(' • ')}</p>
                <p className="mt-3 text-sm text-slate-600">{session.note}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">Attendees</p>
                  <p>
                    {session.attendees} / {session.limit}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">Access</p>
                  <p>{teacherView ? 'Host controls enabled' : 'Join as attendee'}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">Included tools</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {session.tools.map((tool) => (
                    <span key={tool} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">Room actions</p>
                <ul className="mt-3 space-y-2">
                  <li>• Join from web, tablet, or mobile.</li>
                  <li>• Download attendance report after session.</li>
                  <li>• Save recording for controlled replay access.</li>
                </ul>
                <button type="button" onClick={() => setGuideSessionId(session.id)} className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 font-semibold text-white">
                  <Video className="h-4 w-4" />
                  {busyKey === `join_${session.id}` ? 'Opening…' : teacherView ? 'Open host room' : 'Join live class'}
                </button>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
