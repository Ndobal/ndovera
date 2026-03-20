import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import { useData } from '../../../hooks/useData';
import { lessonNotesLibrary } from '../data/classroomExperience';
import type { ClassroomNote } from '../services/classroomApi';
import { ClassroomMaterialComposer } from './ClassroomMaterialComposer';
import { ClassroomMaterialViewer } from './ClassroomMaterialViewer';

type LessonNotesWorkspaceProps = {
  role: string;
};

function hexToRgba(hex: string, alpha: number) {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((part) => `${part}${part}`).join('') : raw.padEnd(6, '0').slice(0, 6);
  const value = Number.parseInt(full, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildMaterialSurface(format: string) {
  const normalized = format.toLowerCase();
  const base = '#2a4272';
  const accent = normalized.includes('video')
    ? '#fb7185'
    : normalized.includes('audio')
      ? '#10b981'
      : normalized.includes('image')
        ? '#f59e0b'
        : '#38bdf8';

  return {
    backgroundImage: [
      `radial-gradient(circle at top right, ${hexToRgba(accent, 0.18)} 0%, transparent 34%)`,
      `radial-gradient(circle at bottom left, ${hexToRgba(accent, 0.12)} 0%, transparent 30%)`,
      `linear-gradient(145deg, ${hexToRgba(base, 0.98)} 0%, ${hexToRgba(base, 0.96)} 54%, ${hexToRgba(base, 0.98)} 100%)`,
      `linear-gradient(135deg, transparent 0%, transparent 56%, ${hexToRgba(accent, 0.08)} 56%, ${hexToRgba(accent, 0.08)} 60%, transparent 60%, transparent 100%)`,
      `linear-gradient(45deg, transparent 0%, transparent 74%, ${hexToRgba(accent, 0.06)} 74%, ${hexToRgba(accent, 0.06)} 78%, transparent 78%, transparent 100%)`,
    ].join(', '),
    backgroundSize: 'auto, auto, auto, 180px 180px, 130px 130px',
    backgroundPosition: 'top right, bottom left, center, center, center',
    borderColor: hexToRgba(accent, 0.18),
  };
}

export function LessonNotesWorkspace({ role }: LessonNotesWorkspaceProps) {
  const teacherView = role === 'Teacher' || role === 'School Admin';
  const { data, refetch, loading } = useData<ClassroomNote[]>('/api/classroom/notes');
  const notes = useMemo(() => (data && data.length ? data : (lessonNotesLibrary as ClassroomNote[])), [data]);
  const visibleNotes = teacherView ? notes : notes.filter((note) => note.visibility !== 'Teacher-only');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  const selectedNote = useMemo(
    () => visibleNotes.find((note) => note.id === selectedNoteId) || null,
    [selectedNoteId, visibleNotes],
  );

  return (
    <div className="space-y-6">
      {teacherView ? (
        <ClassroomMaterialComposer onSaved={refetch} submitLabel="Publish material" />
      ) : null}

      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">Loading lesson notes…</div> : null}

      {selectedNote ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <button type="button" onClick={() => setSelectedNoteId(null)} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
            <ArrowLeft className="h-4 w-4" />
            Back to note cards
          </button>

          <div className="mt-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">{selectedNote.subject}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Week {selectedNote.week}</span>
                <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">{selectedNote.format}</span>
                {selectedNote.viewerType ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{selectedNote.viewerType}</span> : null}
              </div>
              <h3 className="mt-3 text-2xl font-semibold text-slate-900">{selectedNote.title}</h3>
              <p className="mt-2 text-sm text-slate-500">{selectedNote.topic} • {selectedNote.duration}</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <ClassroomMaterialViewer note={selectedNote} />

            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">Analytics</p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm text-slate-600">
                <div className="rounded-2xl bg-slate-50 px-3 py-3"><p className="font-semibold text-slate-900">Views</p><p>{selectedNote.analytics.views}</p></div>
                <div className="rounded-2xl bg-slate-50 px-3 py-3"><p className="font-semibold text-slate-900">Downloads</p><p>{selectedNote.analytics.downloads}</p></div>
                <div className="rounded-2xl bg-slate-50 px-3 py-3"><p className="font-semibold text-slate-900">Completion</p><p>{selectedNote.analytics.completion}</p></div>
              </div>
            </div>

            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">Study summary</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">{selectedNote.summary}</p>
            </div>
          </div>
        </section>
      ) : (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleNotes.map((note) => (
          <button
            key={note.id}
            type="button"
            onClick={() => setSelectedNoteId(note.id)}
            className="overflow-hidden rounded-3xl border bg-white p-6 text-left shadow-sm transition hover:border-sky-200"
            style={buildMaterialSurface(note.format)}
          >
            <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1 overflow-hidden rounded-[1.6rem] border border-amber-200/18 bg-[linear-gradient(180deg,rgba(12,22,52,0.26)_0%,rgba(18,31,70,0.36)_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-amber-300/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.18)_0%,rgba(180,83,9,0.24)_100%)] px-3 py-1 text-xs font-semibold text-yellow-100">{note.subject}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Week {note.week}</span>
                  <span className="rounded-full border border-orange-300/20 bg-[linear-gradient(180deg,rgba(249,115,22,0.18)_0%,rgba(194,65,12,0.24)_100%)] px-3 py-1 text-xs font-semibold text-orange-100">{note.format}</span>
                  <span className="rounded-full border border-amber-900/30 bg-[linear-gradient(180deg,rgba(120,53,15,0.3)_0%,rgba(92,39,12,0.42)_100%)] px-3 py-1 text-xs font-semibold text-amber-100">{note.visibility}</span>
                  {note.viewerType ? <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-sky-100">{note.viewerType}</span> : null}
                </div>
                <h3 className="mt-3 line-clamp-2 wrap-break-word text-xl font-semibold text-white">{note.title}</h3>
                <p className="mt-2 truncate text-sm font-semibold text-amber-300">{note.topic} • {note.duration}</p>
                <p className="mt-4 line-clamp-4 wrap-break-word text-sm leading-7 text-orange-100/92">{note.summary}</p>
              </div>

              <div className="grid shrink-0 gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <div className="rounded-2xl border border-amber-300/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.18)_0%,rgba(180,83,9,0.24)_100%)] px-4 py-3 text-sm text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <p className="font-semibold text-yellow-100">Views</p>
                  <p className="font-extrabold text-yellow-300">{note.analytics.views}</p>
                </div>
                <div className="rounded-2xl border border-orange-300/20 bg-[linear-gradient(180deg,rgba(249,115,22,0.18)_0%,rgba(194,65,12,0.24)_100%)] px-4 py-3 text-sm text-orange-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <p className="font-semibold text-amber-50">Downloads</p>
                  <p className="font-extrabold text-orange-300">{note.analytics.downloads}</p>
                </div>
                <div className="rounded-2xl border border-amber-900/30 bg-[linear-gradient(180deg,rgba(120,53,15,0.3)_0%,rgba(92,39,12,0.42)_100%)] px-4 py-3 text-sm text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <p className="font-semibold text-orange-100">Completion</p>
                  <p className="font-extrabold text-amber-200">{note.analytics.completion}</p>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
      )}
    </div>
  );
}
