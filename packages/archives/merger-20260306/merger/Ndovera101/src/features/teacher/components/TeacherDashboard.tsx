import React, { useState } from 'react';
import { LayoutDashboard, CalendarCheck, ClipboardList, BookOpen, FileText, Bot, MessageSquare, Tractor, BarChart2, Library, UserCog } from 'lucide-react';
import AttendanceModule from '../../attendance/components/AttendanceModule';
import SubjectScoresModule from '../../scores/components/SubjectScoresModule';

import LessonNotesModule from '../../notes/components/LessonNotesModule';

import LessonPlanModule from '../../plans/components/LessonPlanModule';

import CBTModule from '../../cbt/components/CBTModule';

import AILessonAssistantModule from '../../ai/components/AILessonAssistantModule';

import MessagingModule from '../../messaging/components/MessagingModule';

import FarmingModeModule from '../../farming/components/FarmingModeModule';

const navItems = [
  { name: 'Dashboard', icon: LayoutDashboard, component: () => <div>Dashboard</div> },
  { name: 'Attendance', icon: CalendarCheck, component: AttendanceModule },
  { name: 'Subject Scores (CA)', icon: ClipboardList, component: SubjectScoresModule },
  { name: 'Lesson Notes', icon: BookOpen, component: LessonNotesModule },
  { name: 'Lesson Plan', icon: FileText, component: LessonPlanModule },
  { name: 'CBT Exams', icon: ClipboardList, component: CBTModule },
  { name: 'AI Lesson Assistant', icon: Bot, component: AILessonAssistantModule },
  { name: 'Messaging', icon: MessageSquare, component: MessagingModule },
  { name: 'Farming Mode', icon: Tractor, component: FarmingModeModule },
  { name: 'Reports & Analytics', icon: BarChart2, component: () => <div>Reports & Analytics</div> },
  { name: 'Library', icon: Library, component: () => <div>Library</div> },
  { name: 'Profile & Security', icon: UserCog, component: () => <div>Profile & Security</div> },
];

const NavLink = ({ item, isActive, onClick }) => {
  const Icon = item.icon;
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full text-left ${
        isActive ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:bg-slate-800'
      }`}>
      <Icon className="w-4 h-4" />
      {item.name}
    </button>
  )
}

export default function TeacherDashboard({ auras, deductAuras }) {
  const [activeModule, setActiveModule] = useState('Farming Mode');

  const ActiveComponent = navItems.find(item => item.name === activeModule)?.component || (() => <div>Not Found</div>);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex">
      <aside className="w-64 bg-slate-900 p-4 border-r border-slate-800 flex flex-col">
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white">NDOVERA</h2>
          <p className="text-xs text-slate-400">Teacher Dashboard</p>
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map(item => (
            <NavLink 
              key={item.name} 
              item={item} 
              isActive={activeModule === item.name} 
              onClick={() => setActiveModule(item.name)} 
            />
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8 overflow-y-auto">
        <ActiveComponent role="TEACHER" auras={auras} deductAuras={deductAuras} />
      </main>
    </div>
  )
}
