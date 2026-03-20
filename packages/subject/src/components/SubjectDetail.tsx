import React, { useState } from 'react';
import { Subject, Role } from '../types';
import { ArrowLeft, Video, FileText, MessageSquare, BookOpen, ClipboardList } from 'lucide-react';
import { CurriculumTab } from './CurriculumTab';
import { ClassworkTab } from './ClassworkTab';
import { AssignmentTab } from './AssignmentTab';
import { LiveClassTab } from './LiveClassTab';
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
  const [activeTab, setActiveTab] = useState<TabType>('stream');

  const tabs: { id: TabType; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'stream', label: 'Stream', icon: <MessageSquare className="w-3 h-3" />, count: subject.unreadCounts?.stream },
    { id: 'curriculum', label: 'Curriculum', icon: <BookOpen className="w-3 h-3" />, count: subject.unreadCounts?.curriculum },
    { id: 'classwork', label: 'Classwork', icon: <FileText className="w-3 h-3" />, count: subject.unreadCounts?.classwork },
    { id: 'assignment', label: 'Assignment', icon: <ClipboardList className="w-3 h-3" />, count: subject.unreadCounts?.assignment },
    { id: 'live', label: 'Live', icon: <Video className="w-3 h-3" />, count: subject.unreadCounts?.live },
  ];

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
        className={`relative overflow-hidden rounded-xl h-32 flex flex-col justify-end p-5 bg-gradient-to-br ${subject.color} text-white shadow-sm`}
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
          <p className="text-[11px] mt-0.5 text-white/90 drop-shadow-md font-medium">
            {subject.teacherName} • {subject.code}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="glass-panel rounded-lg p-1 flex overflow-x-auto hide-scrollbar">
        <div className="flex gap-1 min-w-max">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-medium transition-all duration-200 relative ${
                activeTab === tab.id
                  ? isDarkMode
                    ? 'text-white bg-white/10 shadow-[0_0_10px_rgba(255,255,255,0.1)]'
                    : 'text-stone-900 bg-white shadow-sm'
                  : isDarkMode
                    ? 'text-stone-400 hover:text-stone-200 hover:bg-white/5'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`ml-1 flex items-center justify-center min-w-[14px] h-[14px] px-1 rounded-full text-[8px] font-bold ${
                  activeTab === tab.id
                    ? isDarkMode ? 'bg-white text-black' : 'bg-stone-900 text-white'
                    : 'bg-amber-500 text-white'
                }`}>
                  {tab.count}
                </span>
              )}
              {activeTab === tab.id && isDarkMode && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute inset-0 rounded-md border border-white/20 pointer-events-none"
                  style={{ boxShadow: `0 0 8px ${subject.neonColor}40` }}
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
        {activeTab === 'live' && (
          <LiveClassTab subject={subject} role={role} onUpdate={onUpdate} isDarkMode={isDarkMode} />
        )}
        {activeTab === 'stream' && (
          <div className="glass-panel rounded-xl p-6 text-center flex flex-col items-center justify-center min-h-[200px]">
            <div className={`p-2 rounded-full mb-2 ${isDarkMode ? 'bg-white/5 text-stone-400' : 'bg-stone-100 text-stone-500'}`}>
              {tabs.find(t => t.id === activeTab)?.icon}
            </div>
            <h3 className="text-[11px] font-medium mb-1">{tabs.find(t => t.id === activeTab)?.label}</h3>
            <p className="text-[9px] text-stone-500 dark:text-stone-400 max-w-xs">
              This section is under construction. Check back later for updates.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
