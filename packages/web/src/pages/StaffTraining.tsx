import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  PlayCircle,
  Plus,
  Video,
  X,
} from 'lucide-react';

import { useData } from '../hooks/useData';
import { fetchWithAuth } from '../services/apiClient';
import { closeLiveClass, joinLiveClass } from '../features/classroom/services/classroomApi';
import LiveApp from '../features/classroom/components/live/App';
import { Role } from '../types';

type StaffTrainingMaterial = {
  id: string;
  title: string;
  description: string;
  materialType: string;
  resourceUrl: string;
  audience: string;
  dueDate: string;
  requiredCompletion: boolean;
  completedCount: number;
  completedByViewer: boolean;
  createdAt: string;
};

type StaffTrainingSession = {
  id: string;
  title: string;
  summary: string;
  schedule: string;
  duration: string;
  liveSessionId: string | null;
  materialIds: string[];
  attendees: number;
  limitCount: number;
  liveStatus: string;
  createdAt: string;
};

type StaffTrainingResponse = {
  materials: StaffTrainingMaterial[];
  sessions: StaffTrainingSession[];
};

type StaffTrainingViewProps = {
  role: Role;
  searchQuery?: string;
};

const MANAGER_ROLES = ['HoS', 'HOS', 'School Admin', 'ICT Manager', 'Owner'];

const initialMaterialDraft = {
  title: '',
  description: '',
  materialType: 'Guide',
  resourceUrl: '',
  audience: 'All Staff',
  dueDate: '',
  requiredCompletion: true,
};

const initialSessionDraft = {
  title: '',
  summary: '',
  schedule: '',
  duration: '60 mins',
  materialIds: [] as string[],
};

export function StaffTrainingView({ role, searchQuery }: StaffTrainingViewProps) {
  const { data, loading, error, refetch } = useData<StaffTrainingResponse>('/api/staff-training');
  const [materialDraft, setMaterialDraft] = useState(initialMaterialDraft);
  const [sessionDraft, setSessionDraft] = useState(initialSessionDraft);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<{ id: string; title: string; sessionId: string } | null>(null);

  const canManage = MANAGER_ROLES.includes(role);
  const materials = data?.materials || [];
  const sessions = data?.sessions || [];

  const filteredMaterials = useMemo(() => {
    if (!searchQuery) return materials;
    const query = searchQuery.toLowerCase();
    return materials.filter((material) => [material.title, material.description, material.materialType, material.audience].join(' ').toLowerCase().includes(query));
  }, [materials, searchQuery]);

  const filteredSessions = useMemo(() => {
    if (!searchQuery) return sessions;
    const query = searchQuery.toLowerCase();
    return sessions.filter((session) => [session.title, session.summary, session.schedule, session.duration].join(' ').toLowerCase().includes(query));
  }, [searchQuery, sessions]);

  const materialMap = useMemo(() => new Map(materials.map((material) => [material.id, material])), [materials]);

  const handleCreateMaterial = async () => {
    if (!materialDraft.title.trim()) return;
    setSavingKey('material');
    setFeedback(null);
    try {
      await fetchWithAuth('/api/staff-training/materials', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(materialDraft),
      });
      setMaterialDraft(initialMaterialDraft);
      setFeedback('Training material added.');
      await refetch();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Unable to save material.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleCreateSession = async () => {
    if (!sessionDraft.title.trim()) return;
    setSavingKey('session');
    setFeedback(null);
    try {
      await fetchWithAuth('/api/staff-training/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(sessionDraft),
      });
      setSessionDraft(initialSessionDraft);
      setFeedback('Live training session created.');
      await refetch();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Unable to create session.');
    } finally {
      setSavingKey(null);
    }
  };

  const toggleMaterialSelection = (materialId: string) => {
    setSessionDraft((current) => ({
      ...current,
      materialIds: current.materialIds.includes(materialId)
        ? current.materialIds.filter((id) => id !== materialId)
        : [...current.materialIds, materialId],
    }));
  };

  const handleJoinSession = async (session: StaffTrainingSession) => {
    if (!session.liveSessionId) return;
    setSavingKey(`join_${session.id}`);
    setFeedback(null);
    try {
      await joinLiveClass(session.liveSessionId);
      setActiveRoom({ id: session.liveSessionId, title: session.title, sessionId: session.id });
      await refetch();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Unable to open live training.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleMarkComplete = async (materialId: string) => {
    setSavingKey(`complete_${materialId}`);
    setFeedback(null);
    try {
      await fetchWithAuth(`/api/staff-training/materials/${materialId}/complete`, {
        method: 'POST',
      });
      setFeedback('Training material marked as completed.');
      await refetch();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Unable to record completion.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleExitRoom = async () => {
    if (!activeRoom) return;
    setSavingKey(`close_${activeRoom.sessionId}`);
    setFeedback(null);
    try {
      if (canManage) {
        await closeLiveClass(activeRoom.id);
        await refetch();
      }
      setActiveRoom(null);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Unable to close live training room.');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Staff Training & Retraining</h2>
          <p className="text-xs text-zinc-500">Distribute staff development materials, schedule retraining sessions, and launch live training rooms from one workspace.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-sky-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.28em] text-sky-300">
          <Video size={14} /> Live-connected delivery
        </div>
      </div>

      {feedback ? <div className="card-compact border border-emerald-500/20 bg-emerald-500/5 text-sm text-emerald-200">{feedback}</div> : null}
      {error ? <div className="card-compact border border-red-500/20 bg-red-500/5 text-sm text-red-200">{error}</div> : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="card-mini flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400"><BookOpen size={18} /></div>
          <div>
            <p className="text-[9px] font-bold uppercase text-zinc-500">Materials</p>
            <p className="text-base font-mono font-bold text-white">{materials.length}</p>
          </div>
        </div>
        <div className="card-mini flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400"><PlayCircle size={18} /></div>
          <div>
            <p className="text-[9px] font-bold uppercase text-zinc-500">Sessions</p>
            <p className="text-base font-mono font-bold text-white">{sessions.length}</p>
          </div>
        </div>
        <div className="card-mini flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400"><CheckCircle2 size={18} /></div>
          <div>
            <p className="text-[9px] font-bold uppercase text-zinc-500">Required</p>
            <p className="text-base font-mono font-bold text-white">{materials.filter((material) => material.requiredCompletion).length}</p>
          </div>
        </div>
        <div className="card-mini flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400"><Clock3 size={18} /></div>
          <div>
            <p className="text-[9px] font-bold uppercase text-zinc-500">Active rooms</p>
            <p className="text-base font-mono font-bold text-white">{sessions.filter((session) => session.liveStatus === 'active').length}</p>
          </div>
        </div>
      </div>

      {canManage ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="card-compact space-y-4 border border-sky-500/20 bg-sky-500/5">
            <div className="flex items-center gap-2 text-sm font-bold text-white"><Plus size={16} /> Add training material</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input value={materialDraft.title} onChange={(event) => setMaterialDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Material title" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none md:col-span-2" />
              <select value={materialDraft.materialType} onChange={(event) => setMaterialDraft((current) => ({ ...current, materialType: event.target.value }))} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none">
                <option>Guide</option>
                <option>Video</option>
                <option>Policy</option>
                <option>Slide Deck</option>
                <option>Checklist</option>
              </select>
              <input value={materialDraft.audience} onChange={(event) => setMaterialDraft((current) => ({ ...current, audience: event.target.value }))} placeholder="Audience" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
              <input value={materialDraft.resourceUrl} onChange={(event) => setMaterialDraft((current) => ({ ...current, resourceUrl: event.target.value }))} placeholder="Video or document URL" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none md:col-span-2" />
              <input type="date" value={materialDraft.dueDate} onChange={(event) => setMaterialDraft((current) => ({ ...current, dueDate: event.target.value }))} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-200">
                <input type="checkbox" checked={materialDraft.requiredCompletion} onChange={(event) => setMaterialDraft((current) => ({ ...current, requiredCompletion: event.target.checked }))} />
                Required completion
              </label>
              <textarea value={materialDraft.description} onChange={(event) => setMaterialDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Outline what staff should learn or review..." className="min-h-30 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none md:col-span-2" />
            </div>
            <div className="flex justify-end">
              <button onClick={() => void handleCreateMaterial()} disabled={savingKey === 'material'} className="rounded-xl bg-sky-600 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white disabled:opacity-50">
                {savingKey === 'material' ? 'Saving…' : 'Save material'}
              </button>
            </div>
          </div>

          <div className="card-compact space-y-4 border border-violet-500/20 bg-violet-500/5">
            <div className="flex items-center gap-2 text-sm font-bold text-white"><Video size={16} /> Schedule live training</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input value={sessionDraft.title} onChange={(event) => setSessionDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Session title" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none md:col-span-2" />
              <input value={sessionDraft.schedule} onChange={(event) => setSessionDraft((current) => ({ ...current, schedule: event.target.value }))} placeholder="Schedule e.g. 2026-03-20 10:00" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
              <input value={sessionDraft.duration} onChange={(event) => setSessionDraft((current) => ({ ...current, duration: event.target.value }))} placeholder="Duration" className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
              <textarea value={sessionDraft.summary} onChange={(event) => setSessionDraft((current) => ({ ...current, summary: event.target.value }))} placeholder="Session outcome, goals, or facilitator notes..." className="min-h-30 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none md:col-span-2" />
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-400">Attach materials</p>
              <div className="grid gap-2">
                {materials.length ? materials.map((material) => (
                  <label key={material.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-sm text-zinc-200">
                    <input type="checkbox" checked={sessionDraft.materialIds.includes(material.id)} onChange={() => toggleMaterialSelection(material.id)} />
                    <span className="font-semibold text-white">{material.title}</span>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{material.materialType}</span>
                  </label>
                )) : <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-sm text-zinc-500">Add a material first, then attach it to the training room.</div>}
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={() => void handleCreateSession()} disabled={savingKey === 'session'} className="rounded-xl bg-violet-600 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white disabled:opacity-50">
                {savingKey === 'session' ? 'Creating…' : 'Create live session'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? <div className="inline-flex items-center gap-2 text-xs text-zinc-400"><LoaderCircle size={14} className="animate-spin" /> Loading staff training...</div> : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="card-compact">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">Training library</h3>
                <p className="text-xs text-zinc-500">Videos, guides, policies, and retraining packs for staff.</p>
              </div>
            </div>
            <div className="space-y-3">
              {filteredMaterials.map((material) => (
                <div key={material.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-sky-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-sky-300">{material.materialType}</span>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-400">{material.audience}</span>
                    {material.requiredCompletion ? <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-300">Required</span> : null}
                  </div>
                  <h4 className="mt-3 text-sm font-bold text-white">{material.title}</h4>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400">{material.description || 'No description added yet.'}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
                    {material.dueDate ? <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> Due {new Date(material.dueDate).toLocaleDateString()}</span> : null}
                    <span className="inline-flex items-center gap-1"><CheckCircle2 size={12} /> {material.completedCount} completed</span>
                    {material.resourceUrl ? (
                      <a href={material.resourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200">
                        <PlayCircle size={12} /> Open resource
                      </a>
                    ) : <span>No resource link yet</span>}
                  </div>
                  {!material.completedByViewer ? (
                    <button onClick={() => void handleMarkComplete(material.id)} disabled={savingKey === `complete_${material.id}`} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white disabled:opacity-50">
                      <CheckCircle2 size={14} /> {savingKey === `complete_${material.id}` ? 'Saving…' : 'Mark complete'}
                    </button>
                  ) : (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                      <CheckCircle2 size={14} /> Completed
                    </div>
                  )}
                </div>
              ))}
              {!filteredMaterials.length && !loading ? <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No training materials available yet.</div> : null}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card-compact border border-violet-500/20 bg-violet-500/5">
            <h3 className="text-sm font-bold text-white">Live training sessions</h3>
            <div className="mt-4 space-y-3">
              {filteredSessions.map((session) => (
                <div key={session.id} className="rounded-2xl border border-white/10 bg-black/15 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-violet-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-violet-300">{session.liveStatus}</span>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-400">{session.duration}</span>
                  </div>
                  <h4 className="mt-3 text-sm font-bold text-white">{session.title}</h4>
                  <p className="mt-2 text-xs text-zinc-400">{session.summary || 'No session notes added yet.'}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
                    <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {session.schedule || 'TBD'}</span>
                    <span className="inline-flex items-center gap-1"><Clock3 size={12} /> {session.attendees}/{session.limitCount} joined</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {session.materialIds.length ? session.materialIds.map((materialId) => {
                      const material = materialMap.get(materialId);
                      return material ? <span key={materialId} className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-300">{material.title}</span> : null;
                    }) : <span className="text-[11px] text-zinc-500">No linked materials</span>}
                  </div>
                  <button onClick={() => void handleJoinSession(session)} disabled={!session.liveSessionId || savingKey === `join_${session.id}`} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white disabled:opacity-50">
                    <Video size={14} /> {savingKey === `join_${session.id}` ? 'Opening…' : canManage ? 'Open live room' : 'Join training'}
                  </button>
                </div>
              ))}
              {!filteredSessions.length && !loading ? <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No live training sessions scheduled yet.</div> : null}
            </div>
          </div>
        </div>
      </div>

      {activeRoom ? (
        <div className="fixed inset-0 z-40 bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-6xl flex-col rounded-4xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-violet-600">Staff training room</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">{activeRoom.title}</h3>
              </div>
              <button type="button" onClick={() => void handleExitRoom()} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                {savingKey === `close_${activeRoom.sessionId}` ? 'Closing…' : canManage ? 'End session' : 'Leave room'}
              </button>
            </div>
            <div className="grid flex-1 gap-4 p-6 lg:grid-cols-[1.3fr_0.7fr]">
              <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950">
                <LiveApp />
              </div>
              <div className="space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">Training room tools</p>
                  <ul className="mt-3 space-y-2">
                    <li>• Run live retraining with the same video stack used for classroom delivery.</li>
                    <li>• Attach policies, video links, and guides before the session starts.</li>
                    <li>• Keep compliance and attendance in one place for staff follow-up.</li>
                  </ul>
                </div>
                <button type="button" onClick={() => setActiveRoom(null)} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                  <X size={14} /> Return to training hub
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default StaffTrainingView;
