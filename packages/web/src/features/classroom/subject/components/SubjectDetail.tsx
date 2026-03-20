import React, { useState } from 'react';
import { Subject, Role } from '../types';
import { ArrowLeft, Video, FileText, MessageSquare, BookOpen, ClipboardList } from 'lucide-react';
import { CurriculumTab } from './CurriculumTab';
import { ClassworkTab } from './ClassworkTab';
import { AssignmentTab } from './AssignmentTab';
import { LiveClassTab } from './LiveClassTab';
import StreamApp from '../../components/subjectStream/App';
import LiveApp from '../../components/live/App';
import { motion } from 'motion/react';

interface Props {
  subject: Subject;
  role: Role;
  onBack: () => void;
  onUpdate: (subject: Subject) => void;
  isDarkMode: boolean;
}

type TabType = 'stream' | 'curriculum' | 'classwork' | 'assignment' | 'live';

export function SubjectDetail({ subject, role, onBack, onUpdate, isDarkMode }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>(role === 'parent' || role === 'Parent' ? 'curriculum' : 'stream');
  const [liveRoomOpen, setLiveRoomOpen] = useState(false);
  const canSeeLive = role === 'teacher';

  const allTabs: { id: TabType; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'stream', label: 'Stream', icon: <MessageSquare className="w-3 h-3" />, count: subject.unreadCounts?.stream },
    { id: 'curriculum', label: 'Curriculum', icon: <BookOpen className="w-3 h-3" />, count: subject.unreadCounts?.curriculum },
    { id: 'classwork', label: 'Classwork', icon: <FileText className="w-3 h-3" />, count: subject.unreadCounts?.classwork },
    { id: 'assignment', label: 'Assignment', icon: <ClipboardList className="w-3 h-3" />, count: subject.unreadCounts?.assignment },
    ...(canSeeLive ? [{ id: 'live' as TabType, label: 'Live', icon: <Video className="w-3 h-3" />, count: subject.unreadCounts?.live }] : []),
  ];

  const isParent = role === 'parent' || role === 'Parent';
  const tabs = isParent ? allTabs.filter(t => t.id !== 'stream') : allTabs;

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-[10px] font-medium text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 transition-colors"
      >
        <ArrowLeft className="w-3 h-3" />
        Back
      </button>

      {/* Hero Banner */}
      <div
        className={`relative overflow-hidden rounded-xl h-32 flex flex-col justify-end p-5 bg-linear-to-br ${subject.color} text-white shadow-sm`}
        style={{
          boxShadow: isDarkMode ? `0 0 20px ${subject.neonColor}40, inset 0 0 0 1px rgba(255,255,255,0.05)` : undefined
        }}
      >
        <div
          className="absolute inset-0 opacity-60 mix-blend-overlay dark:mix-blend-plus-lighter"
          style={{ backgroundImage: subject.pattern, backgroundSize: '24px 24px' }}
        />
        {isDarkMode && (
          <div
            className="absolute inset-0 opacity-50 pointer-events-none"
            style={{ background: `radial-gradient(circle at 80% 20%, ${subject.neonColor}, transparent 60%)` }}
          />
        )}
        <div className="relative z-10">
          <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-md">
            {subject.name}
          </h1>
          <p className={`text-[11px] mt-0.5 drop-shadow-md font-bold ${isDarkMode ? 'text-white/90' : 'text-black'}`}>
            {subject.teacherName} • {subject.code}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="hide-scrollbar sticky top-14 z-30 flex overflow-x-auto rounded-xl border border-[#1d4e89]/20 bg-linear-to-r from-[#dbeafe] via-[#eff6ff] to-[#f8fafc] p-1.5 shadow-lg backdrop-blur-xl transition-all duration-300 dark:border-[#facc15]/15 dark:bg-linear-to-r dark:from-[#061a40] dark:via-[#0b1f4d] dark:to-[#102a63]">
        <div className="flex gap-1 min-w-max">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition-all duration-200 ${
                activeTab === tab.id
                  ? isDarkMode
                    ? 'bg-[#facc15] text-[#0b1f4d] shadow-[0_0_18px_rgba(250,204,21,0.28)]'
                    : 'bg-[#0b1f4d] text-[#facc15] shadow-[0_10px_24px_rgba(11,31,77,0.18)]'
                  : isDarkMode
                    ? 'bg-[#0f2d6b]/65 text-[#fde68a] hover:bg-[#163b85] hover:text-[#fef08a]'
                    : 'bg-white/85 text-[#0b3b75] hover:bg-[#1d4e89] hover:text-[#fef08a]'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`ml-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[8px] font-black ${
                  activeTab === tab.id
                    ? isDarkMode ? 'bg-[#0b1f4d] text-[#facc15]' : 'bg-[#facc15] text-[#0b1f4d]'
                    : isDarkMode ? 'bg-[#facc15] text-[#0b1f4d]' : 'bg-[#0b1f4d] text-[#facc15]'
                }`}>
                  {tab.count}
                </span>
              )}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="pointer-events-none absolute inset-0 rounded-lg border"
                  style={{
                    borderColor: isDarkMode ? 'rgba(11, 31, 77, 0.25)' : 'rgba(250, 204, 21, 0.45)',
                    boxShadow: isDarkMode
                      ? '0 0 0 1px rgba(11,31,77,0.08), 0 0 22px rgba(250,204,21,0.22)'
                      : '0 0 0 1px rgba(250,204,21,0.18), 0 12px 24px rgba(11,31,77,0.12)',
                  }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="mt-3">
        {activeTab === 'curriculum' && (
          <CurriculumTab subject={subject} role={role} onUpdate={onUpdate} isDarkMode={isDarkMode} />
        )}
        {activeTab === 'classwork' && (
          <ClassworkTab subject={subject} role={role} onUpdate={onUpdate} isDarkMode={isDarkMode} />
        )}
        {activeTab === 'assignment' && (
          <AssignmentTab subject={subject} role={role} onUpdate={onUpdate} isDarkMode={isDarkMode} />
        )}
        {activeTab === 'live' && canSeeLive && (
          <div className="glass-panel rounded-xl overflow-hidden p-4 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-sky-400">Simple live entry</p>
              <h3 className="mt-2 text-lg font-bold text-white">{subject.name} live room</h3>
              <p className="mt-2 text-sm text-stone-400">Start with a simple launch surface for teachers and students, then open the room only when you are ready.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-stone-300">1. Confirm device readiness and class identity.</div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-stone-300">2. Keep notes or assignments open in another tab if needed.</div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-stone-300">3. Join the room only when teaching or learning is about to begin.</div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={() => setLiveRoomOpen((current) => !current)} className="rounded-full bg-sky-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white">
                  {liveRoomOpen ? 'Close live room' : 'Open live room'}
                </button>
                <span className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-stone-300">Attendance, moderation, and recording stay enabled.</span>
              </div>
            </div>

            {liveRoomOpen ? (
              <div className="rounded-xl overflow-hidden min-h-130 border border-white/10">
                <LiveApp />
              </div>
            ) : null}
          </div>
        )}
        {activeTab === 'stream' && (
          <div className="glass-panel rounded-xl overflow-hidden">
             <StreamApp />
          </div>
        )}
      </div>
    </div>
  );
}
