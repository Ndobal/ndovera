import React, { useRef, useState } from 'react';
import { BookOpen, CheckSquare, Calendar, User, Plus, Bell, MessageSquare, Settings } from 'lucide-react';

const sidebarItems = [
  { key: 'dashboard', label: 'Dashboard', icon: BookOpen },
  { key: 'attendance', label: 'Attendance', icon: CheckSquare },
  { key: 'schedule', label: 'Schedule', icon: Calendar },
  { key: 'messages', label: 'Messages', icon: MessageSquare },
  { key: 'settings', label: 'Settings', icon: Settings },
];

const sectionTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  attendance: 'Attendance',
  schedule: 'Schedule',
  messages: 'Messages',
  settings: 'Settings',
};

export default function TeacherDashboard() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const sectionRefs = {
    dashboard: useRef<HTMLDivElement>(null),
    attendance: useRef<HTMLDivElement>(null),
    schedule: useRef<HTMLDivElement>(null),
    messages: useRef<HTMLDivElement>(null),
    settings: useRef<HTMLDivElement>(null),
  };

  const handleSidebarClick = (key: string) => {
    setActiveTab(key);
    const ref = sectionRefs[key];
    if (ref && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className={isDarkMode ? 'dark flex h-screen overflow-hidden bg-linear-to-br from-slate-900/80 to-slate-800/90' : 'flex h-screen overflow-hidden bg-linear-to-br from-white to-slate-100'}>
      {/* Sidebar */}
      <aside className="w-64 h-full overflow-y-auto glass-card dark:glass-card p-6 flex flex-col gap-4 fixed left-0 top-0 bottom-0 z-20 backdrop-blur-xl border-r border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-emerald-500 tracking-tight">Ndovera</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Teacher Dashboard</p>
        </div>
        <nav className="flex-1 flex flex-col gap-1">
          {sidebarItems.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === key ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-700 dark:text-slate-200 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10'}`}
              onClick={() => handleSidebarClick(key)}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-8">
          <button
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold"
            onClick={() => setIsDarkMode((d) => !d)}
          >
            {isDarkMode ? 'Light Mode' : 'Night Mode'}
          </button>
        </div>
      </aside>
      {/* Main Content */}
      <main className="flex-1 ml-64 h-full overflow-y-auto p-10 space-y-16">
        {sidebarItems.map(({ key }) => (
          <section
            key={key}
            ref={sectionRefs[key]}
            className="scroll-mt-24"
          >
            <div className="mb-6 flex items-center gap-3">
              {React.createElement(sidebarItems.find(s => s.key === key)!.icon, { className: 'w-6 h-6 text-emerald-500' })}
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">{sectionTitles[key]}</h2>
            </div>
            <div className="rounded-2xl glass-card dark:glass-card p-8 border border-slate-200 dark:border-slate-800 shadow-lg">
              {/* Section content placeholder */}
              <p className="text-slate-600 dark:text-slate-300 text-base">
                {key === 'dashboard' && 'Welcome to your Teacher Dashboard. Manage your classes, lessons, and students.'}
                {key === 'attendance' && 'Take attendance, view records, and manage student presence.'}
                {key === 'schedule' && 'View and manage your teaching schedule.'}
                {key === 'messages' && 'Send announcements and communicate with staff or students.'}
                {key === 'settings' && 'Manage your account and preferences.'}
              </p>
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
import React from 'react';
import { BookOpen, CheckSquare, Calendar, User, Plus, Bell } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
    <div className="flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
        <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
      </div>
    </div>
  </div>
);

export default function TeacherDashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Teacher Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your classes, lessons, and students.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Active Classes" value="4" icon={BookOpen} color="bg-sky-500" />
        <StatCard title="Students" value="128" icon={User} color="bg-emerald-500" />
        <StatCard title="Pending Assignments" value="3" icon={CheckSquare} color="bg-amber-500" />
        <StatCard title="Today's Schedule" value="5 Classes" icon={Calendar} color="bg-indigo-500" />
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <button className="w-full flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors">
              <Plus className="w-5 h-5" />
              <span className="font-medium">Create Lesson Note</span>
            </button>
            <button className="w-full flex items-center gap-3 p-3 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 rounded-xl hover:bg-sky-100 dark:hover:bg-sky-500/20 transition-colors">
              <Calendar className="w-5 h-5" />
              <span className="font-medium">Take Attendance</span>
            </button>
            <button className="w-full flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="font-medium">Send Announcement</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Recent Submissions</h2>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            <li className="py-3 flex items-center justify-between">
              <p className="text-sm text-slate-700 dark:text-slate-300">SS3 Physics - Mock Exam Scripts</p>
              <button className="text-xs font-bold text-emerald-600 hover:underline">Grade Now</button>
            </li>
            <li className="py-3 flex items-center justify-between">
              <p className="text-sm text-slate-700 dark:text-slate-300">JS2 English - Essay on "My Hero"</p>
              <button className="text-xs font-bold text-emerald-600 hover:underline">Grade Now</button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
