import React, { useState, useMemo } from 'react';
import { Subject, Role } from '../subject/types';
import { initialSubjects } from '../subject/data';
import { SubjectCard } from '../subject/components/SubjectCard';
import { SubjectDetail } from '../subject/components/SubjectDetail';
import { useData } from '../../../hooks/useData';
import {
  createClassroomSubject,
  deleteClassroomSubject,
  type ClassroomSubject,
  type ClassroomFeedPost,
  type ClassroomNote,
  type ClassroomAssignment,
  type PracticeSet,
  type LiveClassSession,
  type SchoolClass,
  updateClassroomSubject,
} from '../services/classroomApi';
import { Plus, BookOpen, Pencil, Trash2, X } from 'lucide-react';

type SubjectHubProps = {
  role: string;
  currentUser?: { id?: string; name?: string };
  selectedClassId?: string | null;
  selectedClassName?: string | null;
  onClearClassFilter?: () => void;
};

export function SubjectHub({ role, currentUser, selectedClassId, selectedClassName, onClearClassFilter }: SubjectHubProps) {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [subjectFormOpen, setSubjectFormOpen] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [savingSubject, setSavingSubject] = useState(false);
  const [deletingSubjectId, setDeletingSubjectId] = useState<string | null>(null);
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [subjectDraft, setSubjectDraft] = useState({
    name: '',
    code: '',
    section: '',
    classId: selectedClassId || '',
    summary: '',
    room: '',
  });
  const [isDarkMode] = useState(() => document.body.classList.contains('theme-dark') || document.documentElement.classList.contains('dark'));

  // Fetch subjects from API
  const { data: apiSubjects, loading: loadingSubjects, refetch } = useData<ClassroomSubject[]>(`/api/classroom/subjects${selectedClassId ? `?classId=${encodeURIComponent(selectedClassId)}` : ''}`);
  const { data: schoolClasses } = useData<SchoolClass[]>('/api/classes');
  const classOptions = schoolClasses || [];
  const managerView = role === 'HOS' || role === 'HoS' || role === 'School Admin' || role === 'Super Admin' || role === 'ICT' || role === 'Owner' || role === 'ICT Manager';

  // Map API subjects to detailed subjects
  const subjects: Subject[] = useMemo(() => {
    if (!apiSubjects || apiSubjects.length === 0) return [];

    return apiSubjects.map((s, index) => {
      // Find a matching fallback to inherit rich data (colors, curriculum, etc) if available
      const fallback = initialSubjects[index % initialSubjects.length];

      return {
        id: s.id,
        name: s.name,
        code: s.code,
        teacherName: s.teacherName || fallback.teacherName,
        color: s.accent ? `from-[${s.accent}] to-[${s.accent}]` : fallback.color,
        pattern: fallback.pattern,
        neonColor: s.accent || fallback.neonColor,
        curriculum: s.curriculum || fallback.curriculum,
        classworks: fallback.classworks, // API doesn't return full classworks yet
        assignments: fallback.assignments,
        liveClasses: fallback.liveClasses,
        unreadCounts: {
          stream: s.studentCount > 0 ? 2 : 0, // Mock unread count based on student count
          curriculum: 0,
          classwork: 0,
          assignment: 0,
          live: 0
        }
      };
    });
  }, [apiSubjects]);

  const selectedSubject = subjects.find(s => s.id === selectedSubjectId);

  const resetSubjectDraft = () => {
    setSubjectDraft({
      name: '',
      code: '',
      section: selectedClassId ? (classOptions.find((item) => item.id === selectedClassId)?.section || '') : '',
      classId: selectedClassId || '',
      summary: '',
      room: '',
    });
    setEditingSubjectId(null);
    setSubjectError(null);
    setSubjectFormOpen(false);
  };

  const selectedDraftClass = classOptions.find((item) => item.id === subjectDraft.classId);

  const openCreateForm = () => {
    setSubjectDraft({
      name: '',
      code: '',
      section: selectedClassId ? (classOptions.find((item) => item.id === selectedClassId)?.section || '') : '',
      classId: selectedClassId || '',
      summary: '',
      room: '',
    });
    setEditingSubjectId(null);
    setSubjectError(null);
    setSubjectFormOpen(true);
  };

  const openEditForm = (subject: ClassroomSubject) => {
    setSubjectDraft({
      name: subject.name,
      code: subject.code,
      section: subject.section || '',
      classId: subject.classId || '',
      summary: subject.summary || '',
      room: subject.room || '',
    });
    setEditingSubjectId(subject.id);
    setSubjectError(null);
    setSubjectFormOpen(true);
  };

  const submitSubject = async () => {
    if (!subjectDraft.name.trim()) return;
    setSavingSubject(true);
    setSubjectError(null);
    try {
      const classRecord = classOptions.find((item) => item.id === subjectDraft.classId);
      const payload = {
        name: subjectDraft.name.trim(),
        code: subjectDraft.code.trim() || undefined,
        section: subjectDraft.section || classRecord?.section || undefined,
        classId: subjectDraft.classId || undefined,
        className: classRecord ? [classRecord.level, classRecord.name].filter(Boolean).join(' ').trim() || classRecord.name : undefined,
        summary: subjectDraft.summary.trim() || undefined,
        room: subjectDraft.room.trim() || undefined,
      };
      if (editingSubjectId) {
        await updateClassroomSubject(editingSubjectId, payload);
      } else {
        await createClassroomSubject(payload);
      }
      resetSubjectDraft();
      await refetch();
    } catch (error) {
      setSubjectError(error instanceof Error ? error.message : 'Unable to save subject right now.');
    } finally {
      setSavingSubject(false);
    }
  };

  const handleUpdateSubject = async (updatedSubject: Subject) => {
    const sourceSubject = apiSubjects?.find((item) => item.id === updatedSubject.id);
    if (!sourceSubject) return;
    await updateClassroomSubject(updatedSubject.id, {
      name: updatedSubject.name,
      code: updatedSubject.code,
      section: sourceSubject.section,
      classId: sourceSubject.classId,
      className: sourceSubject.className,
      summary: sourceSubject.summary,
      room: sourceSubject.room,
      accent: sourceSubject.accent,
      curriculum: updatedSubject.curriculum,
    });
    await refetch();
  };

  const handleDeleteSubject = async (subjectId: string) => {
    const confirmed = window.confirm('Delete this subject?');
    if (!confirmed) return;
    setDeletingSubjectId(subjectId);
    setSubjectError(null);
    try {
      await deleteClassroomSubject(subjectId);
      if (selectedSubjectId === subjectId) setSelectedSubjectId(null);
      await refetch();
    } catch (error) {
      setSubjectError(error instanceof Error ? error.message : 'Unable to delete subject right now.');
    } finally {
      setDeletingSubjectId(null);
    }
  };

  const currentRole = (role === 'Teacher' || role === 'School Admin' || role === 'HOS' || role === 'HoS' || role === 'Super Admin') ? 'teacher' : 'student';

  if (selectedSubject) {
    return (
      <SubjectDetail
        subject={selectedSubject}
        role={currentRole as any}
        onBack={() => setSelectedSubjectId(null)}
        onUpdate={handleUpdateSubject}
        isDarkMode={isDarkMode}
      />
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 max-h-[calc(100vh-180px)] overflow-y-auto pr-1 custom-scrollbar">
      {selectedClassId ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-sky-300/20 bg-sky-500/5 px-4 py-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-sky-300">Classroom focus</p>
            <p className="mt-1 text-sm font-semibold text-white">Showing subjects for {selectedClassName || 'the selected class'}.</p>
          </div>
          <button type="button" onClick={onClearClassFilter} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200">
            <X className="h-3.5 w-3.5" /> Clear filter
          </button>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200/60 bg-linear-to-r from-amber-50 via-orange-50 to-yellow-50 px-4 py-3 shadow-sm dark:border-amber-400/10 dark:from-amber-500/10 dark:via-orange-500/5 dark:to-yellow-500/10">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-600 dark:text-amber-300">Classroom hub</p>
          <h2 className="mt-1 flex items-center gap-2 text-lg font-black">
            <BookOpen className="h-5 w-5 text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.45)]" />
            <span className="bg-linear-to-r from-amber-500 via-orange-500 to-fuchsia-500 bg-clip-text text-transparent dark:from-amber-300 dark:via-yellow-300 dark:to-pink-400">
              My Subjects
            </span>
          </h2>
        </div>
        
        {managerView && (
          <button type="button" onClick={openCreateForm} className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm hover:shadow-md">
            <Plus className="w-3.5 h-3.5" />
            Create Subject
          </button>
        )}
      </div>

      {subjectFormOpen ? (
        <div className="rounded-2xl border border-amber-200/60 bg-white/90 px-4 py-4 shadow-sm dark:border-amber-400/10 dark:bg-slate-950/70">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <input value={subjectDraft.name} onChange={(event) => setSubjectDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Subject name" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-amber-400" />
            <input value={subjectDraft.code} onChange={(event) => setSubjectDraft((current) => ({ ...current, code: event.target.value }))} placeholder="Code" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-amber-400" />
            <select
              value={subjectDraft.classId}
              onChange={(event) => {
                const classRecord = classOptions.find((item) => item.id === event.target.value);
                setSubjectDraft((current) => ({ ...current, classId: event.target.value, section: classRecord?.section || current.section }));
              }}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-amber-400"
            >
              <option value="">No class selected</option>
              {classOptions.map((item) => (
                <option key={item.id} value={item.id}>{[item.level, item.name].filter(Boolean).join(' ').trim() || item.name}</option>
              ))}
            </select>
            <input value={subjectDraft.section} onChange={(event) => setSubjectDraft((current) => ({ ...current, section: event.target.value }))} placeholder="Section" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-amber-400" />
            <input value={subjectDraft.room} onChange={(event) => setSubjectDraft((current) => ({ ...current, room: event.target.value }))} placeholder="Room" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-amber-400" />
            <input value={subjectDraft.summary} onChange={(event) => setSubjectDraft((current) => ({ ...current, summary: event.target.value }))} placeholder="Summary" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-amber-400" />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">{selectedDraftClass ? `Attached to ${[selectedDraftClass.level, selectedDraftClass.name].filter(Boolean).join(' ').trim() || selectedDraftClass.name}.` : 'You can save a subject before assigning it to a class.'}</p>
            <div className="flex items-center gap-3">
              {subjectError ? <p className="text-sm text-rose-500">{subjectError}</p> : null}
              <button type="button" onClick={resetSubjectDraft} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
                <X className="h-4 w-4" /> Cancel
              </button>
              <button type="button" onClick={submitSubject} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
                <Plus className="h-4 w-4" /> {savingSubject ? 'Saving…' : editingSubjectId ? 'Save subject' : 'Create subject'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {subjectError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{subjectError}</div> : null}

      {loadingSubjects ? (
        <div className="text-center py-12 text-sm text-stone-500">Loading subjects...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {subjects.map(subject => {
              const sourceSubject = apiSubjects?.find((item) => item.id === subject.id);
              return (
                <div key={subject.id} className="space-y-2">
                  {managerView && sourceSubject ? (
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={() => openEditForm(sourceSubject)} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button type="button" onClick={() => void handleDeleteSubject(subject.id)} className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-3 py-1 text-[11px] font-semibold text-rose-600">
                        <Trash2 className="h-3.5 w-3.5" /> {deletingSubjectId === subject.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  ) : null}
                  <SubjectCard
                    subject={subject}
                    onClick={() => setSelectedSubjectId(subject.id)}
                    isDarkMode={isDarkMode}
                  />
                </div>
              );
            })}
          </div>
          {subjects.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-8 text-center text-sm text-stone-500">No saved subjects yet for this scope. Create them here so classrooms, notes, and results use live subject records.</div> : null}
        </>
      )}
    </div>
  );
}
