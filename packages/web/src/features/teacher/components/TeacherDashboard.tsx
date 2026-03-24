import React, { useState } from 'react';
import { 
  LayoutDashboard, CalendarCheck, ClipboardList, BookOpen, FileText, 
  Bot, MessageSquare, Tractor, BarChart2, Library, UserCog, 
  Bell, ChevronDown, Download, WifiOff, Users, CheckCircle2, AlertTriangle, Presentation
} from 'lucide-react';
import AttendanceModule from '../../attendance/components/AttendanceModule';
import SubjectScoresModule from '../../scores/components/SubjectScoresModule';
import LessonNotesModule from '../../notes/components/LessonNotesModule';
import LessonPlanModule from '../../plans/components/LessonPlanModule';
import TeacherAiLessonAssistant from './TeacherAiLessonAssistant';
import CBTModule from '../../cbt/components/CBTModule';
import MessagingModule from '../../messaging/components/MessagingModule';
import FarmingModeModule from '../../farming/components/FarmingModeModule';
import ResultEngineModule from '../../results/components/ResultEngineModule';

const navItems = [
  { name: 'Dashboard', icon: LayoutDashboard },
  { name: 'Attendance', icon: CalendarCheck, component: AttendanceModule },
  { name: 'Subject Scores (CA)', icon: ClipboardList, component: SubjectScoresModule },
  { name: 'Offline CA Entry', icon: WifiOff, component: () => <div className="text-zinc-500 flex items-center gap-2"><WifiOff size={16} /> Offline CA Spreadsheet Entry - coming soon</div> },
  { name: 'Lesson Notes', icon: BookOpen, component: LessonNotesModule },
  { name: 'Lesson Plan', icon: FileText, component: LessonPlanModule },
  { name: 'CBT Exams', icon: Presentation, component: CBTModule },
  { name: 'Assignments & Scores', icon: ClipboardList, component: () => <div className="text-zinc-500">Assignments & Scores integration</div> },
  { name: 'Ndovera AI Lesson Assistant', icon: Bot, component: TeacherAiLessonAssistant },
  { name: 'Messaging', icon: MessageSquare, component: MessagingModule },
  { name: 'Farming Mode', icon: Tractor, component: FarmingModeModule },
  { name: 'Reports & Analytics', icon: BarChart2, component: ResultEngineModule },
  { name: 'Resources / Library', icon: Library, component: () => <div className="text-zinc-500">Resources Library Module</div> },
  { name: 'Profile & Security', icon: UserCog, component: () => <div className="text-zinc-500">Profile Management</div> },
];

const NavLink = ({ item, isActive, onClick }: { item: any; isActive: boolean; onClick: ()=>void }) => {
  const Icon = item.icon;
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full text-left ${
        isActive ? 'bg-sky-500/10 text-sky-400 font-bold' : 'text-slate-400 hover:bg-slate-800'
      }`}>
      <Icon className="w-4 h-4" />
      {item.name}
    </button>
  )
}

function DashboardOverview() {
  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Classes Taught</p>
              <p className="text-2xl font-bold text-white mt-1">4</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-sky-500/10 flex items-center justify-center text-sky-500">
               <Users size={16} />
            </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Pending CA</p>
              <p className="text-2xl font-bold text-white mt-1">12</p>
              <p className="text-[10px] text-red-400 mt-1">Due next week</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
               <AlertTriangle size={16} />
            </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Lesson Plans</p>
              <p className="text-2xl font-bold text-white mt-1">3</p>
              <p className="text-[10px] text-emerald-400 mt-1">Awaiting HOS approval</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
               <CheckCircle2 size={16} />
            </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Avg Attendance</p>
              <p className="text-2xl font-bold text-white mt-1">94%</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
               <CalendarCheck size={16} />
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-4">Today's Schedule</h3>
            <div className="space-y-3">
               <div className="flex items-center gap-4 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                  <div className="w-12 text-center text-xs font-mono text-slate-400">08:00 AM</div>
                  <div className="w-1 h-8 bg-sky-500 rounded-full" />
                  <div>
                    <p className="text-sm font-bold text-white">Mathematics (JSS 3A)</p>
                    <p className="text-xs text-slate-400">Room 12 • 45 Students</p>
                  </div>
               </div>
               <div className="flex items-center gap-4 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                  <div className="w-12 text-center text-xs font-mono text-slate-400">10:30 AM</div>
                  <div className="w-1 h-8 bg-emerald-500 rounded-full" />
                  <div>
                    <p className="text-sm font-bold text-white">Algebra (SSS 1B)</p>
                    <p className="text-xs text-slate-400">Room 5 • 38 Students</p>
                  </div>
               </div>
            </div>
         </div>
         <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-4">Action Items</h3>
            <div className="space-y-3">
               <button className="w-full flex items-center justify-between p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 transition text-left">
                  <div>
                     <p className="text-xs font-bold uppercase tracking-wider">Unmarked Attendance</p>
                     <p className="text-sm font-medium mt-1">JSS 3A • Yesterday</p>
                  </div>
                  <ChevronDown className="w-4 h-4 -rotate-90" />
               </button>
               <button className="w-full flex items-center justify-between p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 transition text-left">
                  <div>
                     <p className="text-xs font-bold uppercase tracking-wider">CA Entry Needed</p>
                     <p className="text-sm font-medium mt-1">Mid-term Quiz • SSS 1B</p>
                  </div>
                  <ChevronDown className="w-4 h-4 -rotate-90" />
               </button>
            </div>
         </div>
      </div>
    </div>
  );
}

export default function TeacherDashboard({ auras, deductAuras }: { auras?: number; deductAuras?: (n:number)=>void }) {
  const [activeModule, setActiveModule] = useState('Dashboard');

  const ActiveComponentItem = navItems.find(item => item.name === activeModule);
  const ActiveComponent = ActiveComponentItem?.component || DashboardOverview;

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col">
      {/* Top Bar (matches Ndovera generic spec) */}
      <header className="h-16 border-b border-slate-800/60 bg-slate-900/50 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-6">
           <h1 className="text-xl font-black text-white tracking-widest">NDOVERA</h1>
           <div className="h-6 w-px bg-slate-800" />
           <div className="flex flex-col">
              <span className="text-xs font-bold text-sky-400 tracking-wider">2025/2026 • Term 2</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Teacher Mode</span>
           </div>
        </div>

        <div className="flex items-center gap-4">
           {/* Notifications */}
           <button className="w-10 h-10 rounded-full bg-slate-800/50 hover:bg-slate-800 flex items-center justify-center text-slate-400 transition-colors relative">
              <Bell size={18} />
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-sky-500 border-2 border-slate-900 rounded-full" />
           </button>
           
           {/* Smart ID / Profile */}
           <div className="flex items-center gap-3 pl-4 border-l border-slate-800/60 cursor-pointer hover:bg-slate-800/30 p-1.5 rounded-xl transition">
              <div className="text-right hidden sm:block">
                 <p className="text-sm font-bold text-white">Chukwuemeka Obi</p>
                 <p className="text-[10px] text-sky-400 uppercase tracking-widest font-bold">Mathematics Teacher</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-linear-to-br from-sky-500 to-indigo-500 flex items-center justify-center text-white font-bold border-2 border-slate-800 shadow-sm">
                 CO
              </div>
           </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Tabs */}
        <aside className="w-64 bg-slate-900/40 border-r border-slate-800/60 flex flex-col pt-6 overflow-y-auto custom-scrollbar">
          <nav className="flex flex-col gap-1 px-3">
            {navItems.map(item => (
              <NavLink 
                key={item.name} 
                item={item} 
                isActive={activeModule === item.name} 
                onClick={() => setActiveModule(item.name)} 
              />
            ))}
          </nav>
          
          <div className="mt-auto p-4 border-t border-slate-800/60">
             <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 text-center">
                <p className="text-xs font-bold text-sky-400 uppercase tracking-widest">Active Role</p>
                <div className="mt-2 text-sm font-semibold text-white bg-slate-900 py-1.5 rounded-lg border border-slate-800">
                   Teacher
                </div>
             </div>
          </div>
        </aside>

        {/* Dynamic Canvas */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto bg-slate-950 relative custom-scrollbar">
          <div className="max-w-400 mx-auto">
             {/* Render Active Component */}
             {React.createElement(ActiveComponent as any, { role: 'Teacher', auras, deductAuras })}
          </div>
        </main>
      </div>
    </div>
  )
}
