import React, { useRef, useState } from 'react';
import { Users, CheckSquare, Wallet, BookOpen, BarChart2, Briefcase, Shield, Layers, MessageSquare, Settings } from 'lucide-react';

const sidebarItems = [
  { key: 'overview', label: 'Overview', icon: Layers },
  { key: 'students', label: 'Students', icon: Users },
  { key: 'staff', label: 'Staff', icon: Briefcase },
  { key: 'fees', label: 'Fees', icon: Wallet },
  { key: 'approvals', label: 'Approvals', icon: CheckSquare },
  { key: 'messages', label: 'Messages', icon: MessageSquare },
  { key: 'settings', label: 'Settings', icon: Settings },
];

const sectionTitles: Record<string, string> = {
  overview: 'Overview',
  students: 'Students',
  staff: 'Staff',
  fees: 'Fees',
  approvals: 'Approvals',
  messages: 'Messages',
  settings: 'Settings',
};

export default function ProprietorDashboard() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const sectionRefs = {
    overview: useRef<HTMLDivElement>(null),
    students: useRef<HTMLDivElement>(null),
    staff: useRef<HTMLDivElement>(null),
    fees: useRef<HTMLDivElement>(null),
    approvals: useRef<HTMLDivElement>(null),
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
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Proprietor Dashboard</p>
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
                {key === 'overview' && 'See all school analytics and summaries.'}
                {key === 'students' && 'Manage students, admissions, and records.'}
                {key === 'staff' && 'Manage staff, roles, and attendance.'}
                {key === 'fees' && 'View and manage school fees and payments.'}
                {key === 'approvals' && 'Approve results, requests, and more.'}
                {key === 'messages' && 'Send and receive messages.'}
                {key === 'settings' && 'Manage your account and school settings.'}
              </p>
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
import React from 'react';
import { TrendingUp, Users, Wallet, BookOpen, CheckSquare, BarChart2, Briefcase, User, Shield } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, trend, color }: { title: string, value: string, icon: any, trend?: string, color: string }) => (
  <div className={`bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between`}>
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
    <div>
      <p className="text-3xl font-bold text-slate-800 dark:text-slate-100 mt-4">{value}</p>
      {trend && (
        <div className="flex items-center gap-1 text-xs text-emerald-600 mt-1">
          <TrendingUp className="w-3 h-3" />
          <span>{trend}</span>
        </div>
      )}
    </div>
  </div>
);

const QuickAction = ({ label, icon: Icon, color }) => (
  <button className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl text-center transition-all ${color} hover:scale-105 hover:shadow-lg`}>
    <Icon className="w-6 h-6 text-white" />
    <span className="text-xs font-bold text-white">{label}</span>
  </button>
);

export default function ProprietorDashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Proprietor Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Oversee all school operations and analytics.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Students" value="1,284" icon={Users} trend="+2.5% this month" color="bg-emerald-500" />
        <StatCard title="Staff Present" value="96%" icon={CheckSquare} trend="-0.5% today" color="bg-sky-500" />
        <StatCard title="Fees Collected (Term)" value="₦15.2M" icon={Wallet} trend="78% of target" color="bg-amber-500" />
        <StatCard title="Pending Approvals" value="8" icon={BookOpen} color="bg-rose-500" />
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-3 gap-4">
            <QuickAction label="New Student" icon={User} color="bg-emerald-600" />
            <QuickAction label="New Staff" icon={Briefcase} color="bg-sky-600" />
            <QuickAction label="Approve Result" icon={Shield} color="bg-amber-600" />
            <QuickAction label="View Attendance" icon={BarChart2} color="bg-indigo-600" />
            <QuickAction label="Send Message" icon={Users} color="bg-rose-600" />
            <QuickAction label="New Fee" icon={Wallet} color="bg-teal-600" />
          </div>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Recent Activity</h2>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            <li className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">JD</div>
                <div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">Mr. John Doe submitted a lesson note for SS3 Mathematics.</p>
                  <p className="text-xs text-slate-400">2 hours ago</p>
                </div>
              </div>
              <button className="text-xs font-bold text-emerald-600 hover:underline">View</button>
            </li>
            <li className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-xs font-bold">SS</div>
                <div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">Mrs. Sarah Smith approved the PTA meeting minutes.</p>
                  <p className="text-xs text-slate-400">5 hours ago</p>
                </div>
              </div>
              <button className="text-xs font-bold text-emerald-600 hover:underline">Details</button>
            </li>
            <li className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs font-bold">FA</div>
                <div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">Mr. Femi Adekunle paid outstanding fees for his child.</p>
                  <p className="text-xs text-slate-400">1 day ago</p>
                </div>
              </div>
              <button className="text-xs font-bold text-emerald-600 hover:underline">Receipt</button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
