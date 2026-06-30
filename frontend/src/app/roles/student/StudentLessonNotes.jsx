import React, { useEffect, useMemo, useState } from 'react';
import StudentSectionShell from './StudentSectionShell';
import { getStoredAuth } from '../../../features/auth/services/authApi';
import { getMaterials } from '../../../features/classroom/classroomService';
import MaterialTypeThumbnail, { materialTypeLabel } from '../../../shared/components/MaterialTypeThumbnail';

const MATERIAL_TABS = [
  { id: 'all', label: 'All' },
  { id: 'document', label: 'Notes / Files' },
  { id: 'video', label: 'Videos' },
  { id: 'image', label: 'Images' },
  { id: 'link', label: 'Links' },
];

const CARD_COLORS = [
  'from-indigo-500/30 to-indigo-700/15 border-indigo-400/40',
  'from-emerald-500/30 to-emerald-700/15 border-emerald-400/40',
  'from-amber-500/30 to-amber-700/15 border-amber-400/40',
  'from-rose-500/30 to-rose-700/15 border-rose-400/40',
  'from-cyan-500/30 to-cyan-700/15 border-cyan-400/40',
  'from-fuchsia-500/30 to-fuchsia-700/15 border-fuchsia-400/40',
];
function matColor(seed) {
  const hash = String(seed || '').split('').reduce((acc, ch) => ((acc * 31) + ch.charCodeAt(0)) >>> 0, 7);
  return CARD_COLORS[hash % CARD_COLORS.length];
}

function resolveCurrentClassroom(authUser) {
  return localStorage.getItem('classroomId') || authUser?.classId || '';
}

function formatUploadedAt(value) {
  if (!value) return 'Recently uploaded';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export default function StudentLessonNotes() {
  const storedAuth = getStoredAuth();
  const storedUser = storedAuth?.user || JSON.parse(localStorage.getItem('authUser') || '{}');
  const classroomId = resolveCurrentClassroom(storedUser);

  const [activeTab, setActiveTab] = useState('all');
  const [subjectId, setSubjectId] = useState('all');
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(Boolean(classroomId));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!classroomId) {
      setMaterials([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    getMaterials(classroomId)
      .then(response => {
        if (cancelled) return;
        if (!response?.success) {
          throw new Error(response?.message || 'Could not load materials.');
        }
        setMaterials(response.materials || []);
      })
      .catch(err => {
        if (!cancelled) {
          setMaterials([]);
          setError(err instanceof Error ? err.message : 'Could not load materials.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [classroomId]);

  const subjectCards = useMemo(() => {
    const subjects = new Map();
    materials.forEach(material => {
      const nextSubjectId = material.subjectId || material.metadata?.subjectId || 'general';
      const nextSubjectName = material.subjectName || material.metadata?.subjectName || 'General Material';
      if (!subjects.has(nextSubjectId)) {
        subjects.set(nextSubjectId, { id: nextSubjectId, title: nextSubjectName });
      }
    });
    return Array.from(subjects.values()).sort((left, right) => left.title.localeCompare(right.title));
  }, [materials]);

  const filteredMaterials = useMemo(() => materials.filter(material => {
    const nextSubjectId = material.subjectId || material.metadata?.subjectId || 'general';
    const nextType = String(material.type || '').toLowerCase() || 'document';
    return (subjectId === 'all' || nextSubjectId === subjectId) && (activeTab === 'all' || nextType === activeTab);
  }), [activeTab, materials, subjectId]);

  return (
    <StudentSectionShell title="Materials" subtitle={storedUser.className ? `See every teacher-posted material for ${storedUser.className}.` : 'See every teacher-posted material for your subjects.'}>
      {!classroomId && (
        <section className="glass-surface rounded-3xl p-6 mb-6">
          <p className="micro-label accent-amber">No class assigned yet</p>
          <p className="mt-2 text-sm text-slate-300">A class must be assigned before subject materials can appear here.</p>
        </section>
      )}

      <section className="glass-surface rounded-3xl p-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          {MATERIAL_TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`burgundy-tab px-4 py-2 rounded-2xl font-semibold border ${activeTab === tab.id ? 'dark:bg-indigo-500/30 dark:text-white dark:border-indigo-300/40' : 'dark:bg-slate-900/30 dark:text-slate-200 dark:border-white/10'}`}>
              {tab.label}
            </button>
          ))}
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

        {loading && <p className="text-sm text-slate-300">Loading materials...</p>}

        {!loading && error && <p className="text-sm text-rose-300">{error}</p>}

        {!loading && !error && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {filteredMaterials.map(material => (
              <a
                key={material.id}
                href={material.url}
                target="_blank"
                rel="noreferrer"
                className={`flex min-h-[140px] flex-col justify-between gap-2 rounded-2xl border bg-gradient-to-br p-3 transition-transform hover:scale-[1.03] ${matColor(`${material.subjectName || ''}-${material.id}`)}`}
              >
                <div className="min-w-0">
                  <span className="inline-block rounded-full bg-black/30 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white/85">{materialTypeLabel(material)}</span>
                  <p className="mt-2 line-clamp-2 text-sm font-bold leading-snug text-white">{material.title}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-white/65">{material.subjectName || 'General'}</p>
                  {(material.topic || material.weekLabel) && <p className="mt-1 line-clamp-1 text-[10px] text-white/55">{material.topic || 'Lesson note'}{material.weekLabel ? ` • ${material.weekLabel}` : ''}</p>}
                </div>
                <span className="rounded-xl bg-white/20 px-2 py-1 text-center text-[11px] font-black text-white">Open</span>
              </a>
            ))}

            {filteredMaterials.length === 0 && (
              <div className="col-span-2 wheat-card rounded-3xl border border-dashed border-white/10 bg-slate-900/20 p-5 text-center sm:col-span-3 lg:col-span-4 xl:col-span-6">
                <p className="micro-label accent-amber">No live materials</p>
                <p className="mt-2 text-sm text-slate-300">Teacher-posted subject materials will appear here automatically for your class.</p>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="wheat-card glass-surface rounded-3xl p-6 mt-6">
        <p className="text-slate-100 font-semibold">Upload Rule</p>
        <p className="text-slate-300 mt-2">Teachers now publish materials against a subject. Anything posted to your class subjects shows here automatically.</p>
      </section>
    </StudentSectionShell>
  );
}
