import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, FileText, Plus, Sparkles, Trophy, Users, Video, X } from 'lucide-react';

import { SchoolGuard } from '../components/SchoolGuard';
import { SubjectHub } from '../features/classroom/components/SubjectHub';
import { AssignmentStudio } from '../features/classroom/components/AssignmentStudio';
import { ClassRegistry } from '../features/classroom/components/ClassRegistry';
import StreamApp from '../features/classroom/components/subjectStream/App';
import { LessonNotesWorkspace } from '../features/classroom/components/LessonNotesWorkspace';
import { LiveClassStudio } from '../features/classroom/components/LiveClassStudio';
import { PracticeArena } from '../features/classroom/components/PracticeArena';
import { ResultsCenter } from '../features/classroom/components/ResultsCenter';
import { useData } from '../hooks/useData';
import type { ClassroomSubject, SchoolClass } from '../features/classroom/services/classroomApi';
import LessonPlanModule from '../features/plans/components/LessonPlanModule';
import { Role } from '../types';

type ClassroomTab =
  | 'stream'
  | 'classes'
  | 'curriculum'
  | 'assignments'
  | 'results'
  | 'lesson-plans'
  | 'live-class'
  | 'lesson-notes'
  | 'practice'
  | 'subjects';

const getDefaultTab = (role: Role): ClassroomTab => {
  if (role === 'Parent' || role === 'parent') return 'subjects';
  if (role === 'Teacher' || role === 'School Admin' || role === 'HOS' || role === 'Super Admin') {
    return 'subjects';
  }

  return 'stream';
};

export const ClassroomView = ({ role, setActiveSubView, currentUser }: { role: Role; setActiveSubView: (view: string | null) => void; currentUser?: { id?: string; name?: string } }) => {
  if (role && ['Ami', 'Super Admin', 'Owner'].includes(role)) return <SchoolGuard role={role} />;
  const isTeacher = role === 'Teacher' || role === 'School Admin' || role === 'Super Admin' || role === 'HOS';
  const isHOS = role === 'HOS' || role === 'School Admin' || role === 'Super Admin';
  const isParent = role === 'Parent';
  const [activeTab, setActiveTab] = useState<ClassroomTab>(getDefaultTab(role));
  const [selectedClass, setSelectedClass] = useState<SchoolClass | null>(null);
  const { data: curriculumSubjects } = useData<ClassroomSubject[]>(`/api/classroom/subjects${selectedClass?.id ? `?classId=${encodeURIComponent(selectedClass.id)}` : ''}`);

  const curriculumCards = useMemo(() => (curriculumSubjects || []).map((subject) => {
    const curriculum = subject.curriculum || { term1: [], term2: [], term3: [] };
    const totalTopics = ['term1', 'term2', 'term3'].reduce((count, term) => count + ((curriculum as any)[term]?.length || 0), 0);
    const completedTopics = ['term1', 'term2', 'term3'].reduce((count, term) => count + (((curriculum as any)[term] || []).filter((topic: any) => topic?.isTreated).length || 0), 0);
    const progress = totalTopics ? Math.round((completedTopics / totalTopics) * 100) : 0;
    return {
      id: subject.id,
      name: subject.name,
      code: subject.code,
      className: subject.className,
      progress,
      totalTopics,
      completedTopics,
    };
  }), [curriculumSubjects]);

  useEffect(() => {
    setActiveTab(getDefaultTab(role));
  }, [role]);

  const allStudentTabs = [
    { id: 'stream', label: 'Stream', icon: <Sparkles size={14} /> },
    { id: 'subjects', label: 'Subjects', icon: <BookOpen size={14} /> },
    { id: 'assignments', label: 'Assignments', icon: <FileText size={14} /> },
    { id: 'lesson-notes', label: 'Materials', icon: <BookOpen size={14} /> },
    { id: 'practice', label: 'Practice', icon: <Sparkles size={14} /> },
    { id: 'results', label: 'Results', icon: <Trophy size={14} /> },
  ] as const;
  const studentTabs = isParent ? allStudentTabs.filter(t => t.id !== 'stream' && t.id !== 'practice') : allStudentTabs;

  const teacherTabs = [
    { id: 'stream', label: 'Stream', icon: <Sparkles size={14} /> },
    { id: 'subjects', label: 'Subjects', icon: <BookOpen size={14} /> },
    { id: 'classes', label: isHOS ? 'All Classes' : 'My Classes', icon: <Users size={14} /> },
    { id: 'curriculum', label: isTeacher ? 'Curriculum' : 'Courses', icon: <BookOpen size={14} /> },
    { id: 'assignments', label: 'Assignments', icon: <FileText size={14} /> },
    { id: 'results', label: isTeacher ? 'Gradebook' : 'Results', icon: <Trophy size={14} /> },
    { id: 'lesson-plans', label: 'Lesson Plans', icon: <BookOpen size={14} /> },
    { id: 'live-class', label: 'Live Class', icon: <Video size={14} /> },
  ] as const;

  return (
    <div className="space-y-6 max-h-[calc(100vh-120px)] overflow-y-auto pr-1 custom-scrollbar max-w-6xl mx-auto w-full px-4">
      <div className="classroom-sticky-header space-y-4 rounded-[28px] p-4 shadow-sm">
        {isTeacher ? (
          <div className="flex justify-end">
            <button 
              onClick={() => setActiveSubView('create-lesson-plan')}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-900/20"
            >
              <Plus size={14} /> New Lesson Plan
            </button>
          </div>
        ) : null}

        <div className="flex items-center gap-6 border-b border-white/5 overflow-x-auto scrollbar-hide">
          {(isTeacher ? teacherTabs : studentTabs).map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ClassroomTab)}
              className={`rounded-t-2xl px-4 py-3 text-[10px] font-bold uppercase tracking-widest transition-all relative flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id ? 'bg-[#0b1f4d] text-amber-300 shadow-lg' : 'bg-[#091734] text-orange-200/80 hover:text-amber-200'
              }`}
            >
              {tab.icon}
              {tab.label}
              {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-300 rounded-full"></div>}
            </button>
          ))}
        </div>
        {selectedClass ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-sky-300/20 bg-sky-500/5 px-4 py-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-sky-300">Active class workspace</p>
              <p className="mt-1 text-sm font-semibold text-white">{[selectedClass.level, selectedClass.name].filter(Boolean).join(' ')} is now the active classroom focus.</p>
            </div>
            <button type="button" onClick={() => setSelectedClass(null)} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200">
              <X className="h-3.5 w-3.5" /> Clear class focus
            </button>
          </div>
        ) : null}
      </div>

      {/* Content Area */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6 max-h-[calc(100vh-220px)] overflow-y-auto pr-1 custom-scrollbar">
        {activeTab === 'stream' && (
          <StreamApp />
        )}

        {activeTab === 'classes' && isTeacher && (
          <ClassRegistry role={role} onOpenClass={(schoolClass) => {
            setSelectedClass(schoolClass);
            setActiveTab('subjects');
          }} />
        )}

        {activeTab === 'lesson-plans' && isTeacher && (
          <LessonPlanModule />
        )}

        {activeTab === 'curriculum' && isTeacher && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {curriculumCards.map((course) => (
              <button key={course.id} type="button" onClick={() => setActiveTab('subjects')} className="card-compact group cursor-pointer text-left transition hover:-translate-y-0.5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 font-bold">
                      {course.code.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-200">{course.name}</h4>
                      <p className="text-[10px] text-zinc-500 font-mono">{course.code} • {course.className || 'Class linked in subjects'}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-zinc-500 uppercase">Subject topics only</span>
                    <span className="text-white">{course.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${course.progress}%` }}></div>
                  </div>
                  <p className="text-[11px] text-zinc-400">{course.completedTopics} of {course.totalTopics} subject topics treated.</p>
                </div>
              </button>
            ))}
            {!curriculumCards.length ? <div className="card-compact text-sm text-zinc-400">No subject curriculum has been configured yet. Open a subject to add term topics.</div> : null}
          </div>
        )}

        {activeTab === 'lesson-notes' && !isTeacher && (
          <LessonNotesWorkspace role={role} />
        )}

        {activeTab === 'lesson-notes' && isTeacher && <LessonNotesWorkspace role={role} />}

        {activeTab === 'practice' && !isTeacher && (
          <PracticeArena role={role} />
        )}

        {activeTab === 'practice' && isTeacher && <PracticeArena role={role} />}

        {activeTab === 'assignments' && (
          <AssignmentStudio role={role} />
        )}

        {activeTab === 'subjects' && (
          <SubjectHub role={role} currentUser={currentUser} selectedClassId={selectedClass?.id || null} selectedClassName={[selectedClass?.level, selectedClass?.name].filter(Boolean).join(' ')} onClearClassFilter={() => setSelectedClass(null)} />
        )}

        {/* Subject tab removed */}

        {activeTab === 'results' && (
          <ResultsCenter role={role} />
        )}

        {activeTab === 'live-class' && isTeacher && <LiveClassStudio role={role} />}
      </div>
    </div>
  );
};

export const AcademicsView = ClassroomView;
