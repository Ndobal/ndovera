import React, { useEffect, useMemo, useState } from 'react';
import StudentSectionShell from '../../app/roles/student/StudentSectionShell';
import { getLearningStudents, getMaterials } from './classroomService';
import MaterialTypeThumbnail, { materialTypeLabel } from '../../shared/components/MaterialTypeThumbnail';
import { resolveActiveParentChildId, writeActiveParentChildId } from '../../app/roles/parent/parentChildSelection';

const MATERIAL_TABS = [
  { id: 'all', label: 'All' },
  { id: 'document', label: 'Notes / Files' },
  { id: 'video', label: 'Videos' },
  { id: 'image', label: 'Images' },
  { id: 'link', label: 'Links' },
];

function formatUploadedAt(value) {
  if (!value) return 'Recently uploaded';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export default function ParentMaterialsPage() {
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [materials, setMaterials] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [subjectId, setSubjectId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const selectedStudent = students.find(student => student.id === selectedStudentId) || students[0] || null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    getLearningStudents()
      .then(response => {
        if (cancelled) return;
        const audience = response?.students || [];
        setStudents(audience);
        setSelectedStudentId(currentStudentId => (
          resolveActiveParentChildId(audience, currentStudentId)
        ));
      })
      .catch(err => {
        if (!cancelled) {
          setStudents([]);
          setError(err instanceof Error ? err.message : 'Could not load your linked children.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedStudent?.classId) {
      setMaterials([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    getMaterials(selectedStudent.classId, { studentId: selectedStudent.id })
      .then(response => {
        if (cancelled) return;
        setMaterials(response?.materials || []);
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
  }, [selectedStudent?.classId, selectedStudent?.id]);

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

  useEffect(() => {
    if (selectedStudentId) {
      writeActiveParentChildId(selectedStudentId);
    }
  }, [selectedStudentId]);

  return (
    <StudentSectionShell
      title="Materials"
      subtitle="Review the resources your child can access at school and at home."
      dashboardLabel="Parent Dashboard"
      watermarkText="Parent Materials"
    >
      <div className="space-y-6">
        <section className="glass-surface rounded-3xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="micro-label neon-subtle">Linked Learner</p>
              <p className="text-slate-100 font-semibold mt-2">{selectedStudent ? `${selectedStudent.name}${selectedStudent.className ? ` • ${selectedStudent.className}` : ''}` : 'No linked child yet'}</p>
            </div>
            <select value={selectedStudentId} onChange={event => setSelectedStudentId(event.target.value)} className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white">
              {students.map(student => (
                <option key={student.id} value={student.id}>{student.name}{student.className ? ` • ${student.className}` : ''}</option>
              ))}
            </select>
          </div>

          {!loading && !students.length && <p className="text-sm text-amber-200">No linked child was found for parent materials yet.</p>}
          {error && <p className="text-sm text-rose-200">{error}</p>}
        </section>

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
              <button key={subject.id} onClick={() => setSubjectId(subject.id)} className={`burgundy-tab px-3 py-1 rounded-full text-sm border ${subjectId === subject.id ? 'dark:bg-emerald-500/30 dark:border-emerald-300/40 dark:text-white' : 'dark:bg-slate-900/30 dark:border-white/10 dark:text-slate-200'}`}>
                {subject.title}
              </button>
            ))}
          </div>

          {loading && <p className="text-sm text-slate-300">Loading materials...</p>}

          {!loading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredMaterials.map(material => (
                <article key={material.id} className="wheat-card rounded-3xl border border-white/10 overflow-hidden bg-slate-900/30 p-4 flex flex-col gap-4">
                  <div className="flex items-start gap-4">
                    <MaterialTypeThumbnail material={material} className="border-white/10 dark:border-white/10" />
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-100 font-semibold">{material.title}</p>
                      <p className="neon-subtle text-sm mt-1">{material.subjectName || 'General Material'}</p>
                      {(material.topic || material.weekLabel) && (
                        <p className="text-xs text-slate-400 mt-2">{material.topic || 'Lesson note'}{material.weekLabel ? ` • ${material.weekLabel}` : ''}</p>
                      )}
                      {material.description && <p className="text-sm text-slate-300 mt-3 whitespace-pre-wrap">{material.description}</p>}
                    </div>
                    <span className="glass-chip px-3 py-1 rounded-full micro-label accent-emerald">{materialTypeLabel(material)}</span>
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-3">
                    <div>
                      <p className="micro-label accent-indigo">Uploaded {formatUploadedAt(material.uploadedAt)}</p>
                      {material.uploadedByName && <p className="neon-subtle text-xs mt-1">By {material.uploadedByName}</p>}
                    </div>
                    {material.url ? (
                      <a href={material.url} target="_blank" rel="noreferrer" className="rounded-2xl bg-emerald-500/30 border border-emerald-300/40 px-4 py-2 text-sm font-semibold text-white">
                        Open
                      </a>
                    ) : (
                      <span className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-100">Teacher Note</span>
                    )}
                  </div>
                </article>
              ))}

              {filteredMaterials.length === 0 && !loading && (
                <div className="wheat-card rounded-3xl border border-dashed border-white/10 bg-slate-900/20 p-5 text-center md:col-span-2 xl:col-span-3">
                  <p className="micro-label accent-amber">No shared materials</p>
                  <p className="mt-2 text-sm text-slate-300">Teacher materials shared with parents will appear here automatically.</p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </StudentSectionShell>
  );
}