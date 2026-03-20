import React from 'react';
import { Subject } from '../types';
import { TrendingUp, BookOpen, ClipboardList, Video } from 'lucide-react';

interface Props {
  key?: string | number;
  subject: Subject;
  onClick: () => void;
  isDarkMode: boolean;
}

export function SubjectCard({ subject, onClick, isDarkMode }: Props) {
  const allTopics = [...subject.curriculum.term1, ...subject.curriculum.term2, ...subject.curriculum.term3];
  const treated = allTopics.filter(t => t.isTreated).length;
  const progress = allTopics.length ? Math.round((treated / allTopics.length) * 100) : 0;

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl transition-all duration-300 cursor-pointer h-40 flex flex-col group shadow-sm hover:shadow-md border hover:-translate-y-1 ${
        isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-stone-200'
      }`}
      style={{
        boxShadow: isDarkMode ? `0 8px 20px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.1), 0 0 15px ${subject.neonColor}20` : undefined
      }}
    >
      {/* Header with Gradient and Pattern */}
      <div className={`relative h-20 bg-linear-to-br ${subject.color} text-white p-3 flex justify-between items-start`}>
        {/* Enhanced Pattern */}
        <div
          className="absolute inset-0 opacity-60 mix-blend-overlay dark:mix-blend-plus-lighter"
          style={{ backgroundImage: subject.pattern, backgroundSize: '24px 24px' }}
        />
        
        {/* Dark mode glow effect on hover */}
        {isDarkMode && (
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{ background: `radial-gradient(circle at 50% 0%, ${subject.neonColor}, transparent 70%)` }}
          />
        )}

        <div className="relative z-10 w-full flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <h3 className="text-[14px] font-bold truncate pr-2 drop-shadow-md">
              {subject.name}
            </h3>
            <p className="text-[10px] text-white/90 drop-shadow-md font-medium truncate">{subject.teacherName} • {subject.code}</p>
          </div>
          <button className="p-1.5 rounded-full bg-black/20 hover:bg-black/40 backdrop-blur-md transition-colors border border-white/10 shrink-0">
            <TrendingUp className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Analytics Grid in the Body */}
      <div className="flex-1 p-2 flex items-center">
        <div className="grid grid-cols-3 gap-2 w-full">
          <div className={`rounded-lg p-2 flex flex-col items-center justify-center border transition-colors ${
            isDarkMode ? 'bg-white/5 border-white/5 group-hover:bg-white/10' : 'bg-stone-50 border-stone-100 group-hover:bg-stone-100'
          }`}>
            <BookOpen className={`w-3.5 h-3.5 mb-1 ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`} />
            <span className={`text-[11px] font-bold ${isDarkMode ? 'text-stone-200' : 'text-stone-700'}`}>{progress}%</span>
            <span className={`text-[8px] uppercase tracking-wider ${isDarkMode ? 'text-stone-500' : 'text-stone-500'}`}>Syllabus</span>
          </div>
          <div className={`rounded-lg p-2 flex flex-col items-center justify-center border transition-colors ${
            isDarkMode ? 'bg-white/5 border-white/5 group-hover:bg-white/10' : 'bg-stone-50 border-stone-100 group-hover:bg-stone-100'
          }`}>
            <ClipboardList className={`w-3.5 h-3.5 mb-1 ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`} />
            <span className={`text-[11px] font-bold ${isDarkMode ? 'text-stone-200' : 'text-stone-700'}`}>{subject.assignments.length}</span>
            <span className={`text-[8px] uppercase tracking-wider ${isDarkMode ? 'text-stone-500' : 'text-stone-500'}`}>Tasks</span>
          </div>
          <div className={`rounded-lg p-2 flex flex-col items-center justify-center border transition-colors ${
            isDarkMode ? 'bg-white/5 border-white/5 group-hover:bg-white/10' : 'bg-stone-50 border-stone-100 group-hover:bg-stone-100'
          }`}>
            <Video className={`w-3.5 h-3.5 mb-1 ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`} />
            <span className={`text-[11px] font-bold ${isDarkMode ? 'text-stone-200' : 'text-stone-700'}`}>{subject.liveClasses.length}</span>
            <span className={`text-[8px] uppercase tracking-wider ${isDarkMode ? 'text-stone-500' : 'text-stone-500'}`}>Live</span>
          </div>
        </div>
      </div>
    </div>
  );
}
