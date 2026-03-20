import React from 'react';
import {
  ArrowRight,
  Bell,
  BookOpen,
  ClipboardCheck,
  Clock3,
  FileText,
  Sparkles,
} from 'lucide-react';
import { Role } from '../../../types';
import { useData } from '../../../hooks/useData';
import {
  classroomAssignments,
  classroomLessonNotes,
  classroomLessonPlans,
  classroomPracticeSets,
} from '../data/classroomFixtures';
import { useStreamManager } from '../services/streamManager';

const quickCards = [
  {
    label: 'Next Assignment',
    value: '14h 20m',
    note: 'English response closes today at 6:00 PM',
    icon: <Clock3 size={16} />,
    tone: 'text-orange-400 bg-orange-500/10',
  },
  {
    label: 'Next Exam Window',
    value: '48h',
    note: 'Biology CBT opens Thursday at 9:00 AM',
    icon: <ClipboardCheck size={16} />,
    tone: 'text-blue-400 bg-blue-500/10',
  },
  {
    label: 'Attendance',
    value: '96%',
    note: '2 late arrivals recorded this term',
    icon: <Bell size={16} />,
    tone: 'text-emerald-400 bg-emerald-500/10',
  },
  {
    label: 'Recent Score',
    value: '18/20',
    note: 'Algebraic expressions marked and returned',
    icon: <FileText size={16} />,
    tone: 'text-purple-400 bg-purple-500/10',
  },
];

export default function ClassroomStream({
  role,
  onSelectTab,
}: {
  role: Role;
  onSelectTab: (tab: string) => void;
}) {
  const isParent = role === 'Parent';
  const { data: announcements } = useData<any[]>('/api/announcements');
  const { data: notes } = useData<any[]>('/api/notes');
  const streamManager = useStreamManager({ initialPosts: [], currentUser: undefined });

  const streamItems = [
    {
      id: 'stream_assignment',
      title: 'Assignment returned for correction',
      detail: 'Your English response needs stronger text evidence before final marking.',
      action: 'Open Assignments',
      tab: 'assignments',
      icon: <FileText size={16} className="text-orange-400" />,
    },
    {
      id: 'stream_note',
      title: notes?.[0]?.title || classroomLessonNotes[0].title,
      detail:
        notes?.[0]?.content ||
        classroomLessonNotes[0].summary,
      action: 'Open Materials',
      tab: 'lesson-notes',
      icon: <BookOpen size={16} className="text-blue-400" />,
    },
    {
      id: 'stream_practice',
      title: classroomPracticeSets[0].title,
      detail: classroomPracticeSets[0].note,
      action: 'Start Practice',
      tab: 'practice',
      icon: <Sparkles size={16} className="text-emerald-400" />,
    },
  ];

  const headline = announcements?.[0]?.title || 'Stay ready for this week';
  const message = announcements?.[0]?.content || 'Your classroom stream now prioritizes assignments, materials, practice, and lesson plans exactly as outlined in the blueprint.';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.9fr] gap-6">
        <div className="card-compact bg-linear-to-br from-emerald-600/10 via-white/2 to-transparent border-emerald-500/10">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-500 mb-3">
            Classroom Stream
          </p>
          <h3 className="text-2xl font-bold text-white tracking-tight mb-2">
            {isParent ? 'Your child’s learning stream' : 'Everything you need for learning today'}
          </h3>
          <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl">
            {message}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {[
              { label: 'Assignments', tab: 'assignments' },
              { label: 'Materials', tab: 'lesson-notes' },
              { label: 'Practice', tab: 'practice' },
              { label: 'Lesson Plans', tab: 'lesson-plans' },
            ].map((action) => (
              <button
                key={action.tab}
                onClick={() => onSelectTab(action.tab)}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-xs font-bold uppercase tracking-wider text-zinc-200 hover:bg-white/10 transition-all"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card-compact">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4">
            Focus right now
          </p>
          <div className="space-y-4">
            {quickCards.map((card) => (
              <div key={card.label} className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.tone}`}>
                  {card.icon}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{card.label}</p>
                  <p className="text-lg font-bold text-white">{card.value}</p>
                  <p className="text-xs text-zinc-400">{card.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Latest activity</h3>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{headline}</span>
          </div>
          {streamItems.map((item) => (
            <div key={item.id} className="card-compact flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center">
                  {item.icon}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{item.title}</p>
                  <p className="text-xs text-zinc-400 mt-1 max-w-xl">{item.detail}</p>
                </div>
              </div>
              <button
                onClick={() => onSelectTab(item.tab)}
                className="shrink-0 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-500 hover:text-emerald-400"
              >
                {item.action}
                <ArrowRight size={12} />
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <div className="card-compact">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Assignments closing soon</h3>
            <div className="space-y-3">
              {classroomAssignments.slice(0, 2).map((assignment) => (
                <button
                  key={assignment.id}
                  onClick={() => onSelectTab('assignments')}
                  className="w-full text-left p-3 rounded-xl bg-white/3 border border-white/5 hover:border-emerald-500/20 transition-all"
                >
                  <p className="text-xs font-bold text-white">{assignment.title}</p>
                  <p className="text-[10px] font-bold uppercase text-zinc-500 mt-1">{assignment.subject} • {assignment.status}</p>
                  <p className="text-[10px] text-zinc-400 mt-2">Due {assignment.due}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="card-compact">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Lesson plans this week</h3>
            <div className="space-y-3">
              {classroomLessonPlans.slice(0, 2).map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => onSelectTab('lesson-plans')}
                  className="w-full text-left p-3 rounded-xl bg-white/3 border border-white/5 hover:border-emerald-500/20 transition-all"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold text-white">{plan.topic}</p>
                    <span className="text-[10px] font-bold text-emerald-500">{plan.completion}%</span>
                  </div>
                  <p className="text-[10px] font-bold uppercase text-zinc-500 mt-1">{plan.subject} • Week {plan.week}</p>
                  <p className="text-[10px] text-zinc-400 mt-2">{plan.materialType}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
