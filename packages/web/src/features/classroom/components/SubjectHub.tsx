import React, { useState, useMemo } from 'react';
import { Subject, Role } from '../subject/types';
import { initialSubjects } from '../subject/data';
import { SubjectCard } from '../subject/components/SubjectCard';
import { SubjectDetail } from '../subject/components/SubjectDetail';
import { useData } from '../../../hooks/useData';
import {
  type ClassroomSubject,
  type ClassroomFeedPost,
  type ClassroomNote,
  type ClassroomAssignment,
  type PracticeSet,
  type LiveClassSession,
} from '../services/classroomApi';
import { Plus, BookOpen, X } from 'lucide-react';

type SubjectHubProps = {
  role: string;
  currentUser?: { id?: string; name?: string };
  selectedClassId?: string | null;
  selectedClassName?: string | null;
  onClearClassFilter?: () => void;
};

export function SubjectHub({ role, currentUser, selectedClassId, selectedClassName, onClearClassFilter }: SubjectHubProps) {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [isDarkMode] = useState(() => document.body.classList.contains('theme-dark') || document.documentElement.classList.contains('dark'));

  // Fetch subjects from API
  const { data: apiSubjects, loading: loadingSubjects, refetch } = useData<ClassroomSubject[]>(`/api/classroom/subjects${selectedClassId ? `?classId=${encodeURIComponent(selectedClassId)}` : ''}`);

  // Map API subjects to detailed subjects
  const subjects: Subject[] = useMemo(() => {
    if (!apiSubjects || apiSubjects.length === 0) {
      return initialSubjects;
    }

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

  const handleUpdateSubject = async (updatedSubject: Subject) => {
    // In a real app, this would persist changes to the API
    console.log('Update subject:', updatedSubject);
    await refetch();
  };

  const currentRole = (role === 'Teacher' || role === 'School Admin' || role === 'HOS' || role === 'Super Admin') ? 'teacher' : 'student';

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
        
        {/* Only HOS, Admins, etc can create subjects; NOT Teachers */}
        {(role === 'HOS' || role === 'School Admin' || role === 'Super Admin' || role === 'ICT' || role === 'Owner' || role === 'ICT Manager') && (
          <button className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm hover:shadow-md">
            <Plus className="w-3.5 h-3.5" />
            Create Subject
          </button>
        )}
      </div>

      {loadingSubjects ? (
        <div className="text-center py-12 text-sm text-stone-500">Loading subjects...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {subjects.map(subject => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              onClick={() => setSelectedSubjectId(subject.id)}
              isDarkMode={isDarkMode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
