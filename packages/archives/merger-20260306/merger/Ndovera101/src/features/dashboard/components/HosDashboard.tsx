
import React, { useRef, useState, RefObject } from 'react';
import { Users, Wallet, CheckSquare, BarChart2, Briefcase, User, Layers, MessageSquare, Settings } from 'lucide-react';

const sidebarItems = [
  { key: 'overview', label: 'Overview', icon: Layers },
  { key: 'operations', label: 'Operations', icon: BarChart2 },
  { key: 'staff', label: 'Staff', icon: Briefcase },
  { key: 'students', label: 'Students', icon: Users },
  { key: 'finance', label: 'Finance', icon: Wallet },
  { key: 'approvals', label: 'Approvals', icon: CheckSquare },
  { key: 'messages', label: 'Messages', icon: MessageSquare },
  { key: 'settings', label: 'Settings', icon: Settings },
];

const sectionTitles: Record<string, string> = {
  overview: 'Overview',
  operations: 'Operations',
  staff: 'Staff',
  students: 'Students',
  finance: 'Finance',
  approvals: 'Approvals',
  messages: 'Messages',
  settings: 'Settings',
};


type SectionKey = typeof sidebarItems[number]['key'];
type SectionRefs = Record<SectionKey, RefObject<HTMLDivElement | null>>;

export default function HosDashboard() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState<SectionKey>('overview');
  const sectionRefs = sidebarItems.reduce((acc, item) => {
    acc[item.key as SectionKey] = useRef<HTMLDivElement>(null);
    return acc;
  }, {} as SectionRefs);

  const handleSidebarClick = (key: SectionKey) => {
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
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">HoS Dashboard</p>
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
                {key === 'overview' && 'See all school operations and analytics.'}
                {key === 'operations' && 'Manage operational commands and ICT.'}
                {key === 'staff' && 'Manage staff, roles, and attendance.'}
                {key === 'students' && 'Manage students, admissions, and records.'}
                {key === 'finance' && 'View and manage school finances.'}
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
