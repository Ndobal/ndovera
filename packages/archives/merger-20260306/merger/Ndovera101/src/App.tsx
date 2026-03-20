import React, { useState, useEffect, Suspense } from 'react';
import { 
  LayoutDashboard, 
  BookOpen, 
  Users, 
  Wallet, 
  Calendar, 
  Sprout, 
  Trophy, 
  Settings, 
  LogOut, 
  Bell,
  Search,
  Menu,
  X,
  GraduationCap,
  Briefcase,
  Baby,
  ShieldCheck,
  MessageSquare,
  FileText,
  Moon,
  Sun,
  Globe,
  Wifi,
  WifiOff,
  BellRing
} from 'lucide-react';
import { UserRole, User, SystemConfig, ROLE_CONFIG, AuditLog } from './shared/types/index';
import BrandLogo from './shared/BrandLogo';
import { motion, AnimatePresence } from 'motion/react';

// Import Modules from features
import { DashboardOverview } from './features/dashboard';
import ParentDashboard from './features/dashboard/components/ParentDashboard';
import { AcademicsModule } from './features/academics';
import { FinanceModule } from './features/finance';
import { FarmingModeModule } from './features/farming';
import { RewardsModule } from './features/rewards';
import { TutorialsModule } from './features/tutorials';
import { AttendanceModule } from './features/attendance';
import { CommunicationModule } from './features/communication';
import { AptitudeTestModule } from './features/aptitudeTest';
import { EventModule } from './features/events';
import { SettingsModule } from './features/settings';
import { WebsiteBuilderModule, PublicWebsite } from './features/website';
import { ResultEngineModule } from './features/results';
import { AlumniModule } from './features/alumni';
import { Zap, Sparkles, TrendingUp, ExternalLink } from 'lucide-react';

const AmiModule = React.lazy(() => import('./features/ami/components/AmiModule'));
const TeacherDashboard = React.lazy(() => import('./features/teacher/components/TeacherDashboard'));

// Mock Data
const MOCK_USER: User = {
  id: '1',
  name: 'Dr. Ndobera',
  role: UserRole.PROPRIETOR,
  birthday: '1980-05-15',
  auras: 1250,
  farmingEnabled: false,
  lastAuraReset: '2026-02-01',
  qualifiesForAppreciation: true,
  educativeIncentive: 45000
};

const DEFAULT_CONFIG: SystemConfig = {
  auraToNairaRate: 50, // 1 Aura = 50 Naira
  auraPerImpression: 1,
  dailyAuraCapPerUser: 100,
  globalDailyAuraCap: 10000
};

export default function App() {
  const [currentRole, setCurrentRole] = useState<UserRole>(UserRole.PROPRIETOR);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [farmingMode, setFarmingMode] = useState(false);
  const [auras, setAuras] = useState(MOCK_USER.auras);
  const [dailyAurasEarned, setDailyAurasEarned] = useState(0);
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_CONFIG);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isViewingWebsite, setIsViewingWebsite] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([
    { id: '1', user: 'Admin (Bursar)', action: 'Fee Structure Created', target: 'SS3 Second Term', date: '2026-02-25 10:30 AM', ip: '192.168.1.45' },
    { id: '2', user: 'Mr. John Doe', action: 'Lesson Note Submitted', target: 'SS3 Mathematics', date: '2026-02-25 09:15 AM', ip: '192.168.1.12' },
    { id: '3', user: 'Admin (HOS)', action: 'Lesson Note Approved', target: 'SS3 Mathematics', date: '2026-02-25 11:00 AM', ip: '192.168.1.5' },
    { id: '4', user: 'System', action: 'Automatic Backup', target: 'Database', date: '2026-02-25 03:00 AM', ip: 'Internal' },
  ]);
  const [notifications, setNotifications] = useState([
    { id: '1', title: 'Fee Structure Approved', body: 'The SS3 Second Term fee structure has been approved by the HoS.', time: '2 mins ago', read: false },
    { id: '2', title: 'Lesson Note Feedback', body: 'Mr. John, your Mathematics note for Week 5 needs revision.', time: '1 hour ago', read: false },
  ]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Daily Aura Reset Logic
  useEffect(() => {
    const checkReset = () => {
      const now = new Date();
      const lastResetStr = localStorage.getItem('last_aura_reset');
      const todayStr = now.toDateString();

      if (lastResetStr !== todayStr) {
        setDailyAurasEarned(0);
        localStorage.setItem('last_aura_reset', todayStr);
        addAuditLog('System', 'Daily Aura Reset', 'All Users', 'Internal');
      }
    };

    checkReset();
    const interval = setInterval(checkReset, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const addAuditLog = (user: string, action: string, target: string, ip: string = '127.0.0.1') => {
    const newLog = {
      id: Math.random().toString(36).substr(2, 9),
      user,
      action,
      target,
      date: new Date().toLocaleString(),
      ip
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const deductAuras = (amount: number, reason: string) => {
    if (auras >= amount) {
      setAuras(prev => prev - amount);
      addAuditLog(MOCK_USER.name, `Spent ${amount} Auras`, reason);
      return true;
    }
    return false;
  };

  const allNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'academics', label: 'Academics', icon: BookOpen },
    { id: 'finance', label: 'Finance', icon: Wallet },
    { id: 'attendance', label: 'Attendance', icon: Calendar },
    { id: 'school-farm', label: 'Aura Farm', icon: Sprout },
    { id: 'rewards', label: 'Rewards & Birthdays', icon: Trophy },
    { id: 'tutorials', label: 'Tutorials', icon: GraduationCap },
    { id: 'communication', label: 'Communication', icon: MessageSquare },
    { id: 'tests', label: 'Aptitude Tests', icon: FileText },
    { id: 'results', label: 'Result Engine', icon: ShieldCheck },
    { id: 'events', label: 'Events & Open Day', icon: Calendar },
    { id: 'website', label: 'Website Builder', icon: Globe },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'alumni', label: 'Alumni Network', icon: GraduationCap },
  ];

  const filteredNavItems = allNavItems.filter(item => 
    ROLE_CONFIG[currentRole]?.allowedModules.includes(item.id)
  );

  // Protected tabs where ads are never shown (Quizzes, Exams, Assignments)
  const isProtectedTab = ['tests', 'results', 'academics'].includes(activeTab);
  const showAds = farmingMode && !isProtectedTab;

  if (isViewingWebsite) {
    return <PublicWebsite onBack={() => setIsViewingWebsite(false)} />;
  }

  if (currentRole === UserRole.PARENT) {
    return <ParentDashboard />;
  }
  if (currentRole === UserRole.SUPER_ADMIN) {
    return (
      <Suspense fallback={<div className="w-screen h-screen flex items-center justify-center bg-slate-950 text-white">Loading Super Admin Fortress...</div>}>
        <AmiModule />
      </Suspense>
    );
  }

  if (currentRole === UserRole.TEACHER) {
    return (
      <Suspense fallback={<div className="w-screen h-screen flex items-center justify-center bg-slate-950 text-white">Loading Teacher Dashboard...</div>}>
        <TeacherDashboard auras={auras} deductAuras={deductAuras} />
      </Suspense>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        className="bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-20"
      >
        <div className="p-6 flex items-center gap-3 border-b border-slate-100 dark:border-slate-800">
          <BrandLogo size={40} text={isSidebarOpen} />
        </div>

        <nav className="flex-1 py-6 overflow-y-auto">
          {filteredNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-6 py-3.5 transition-all relative group ${ 
                activeTab === item.id 
                  ? 'text-emerald-700 dark:text-emerald-400 font-medium' 
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <item.icon className={`w-5 h-5 shrink-0 ${activeTab === item.id ? 'text-emerald-600' : ''}`} />
              {isSidebarOpen && <span className="text-sm">{item.label}</span>}
              {activeTab === item.id && (
                <motion.div 
                  layoutId="active-pill"
                  className="absolute left-0 w-1 h-8 bg-emerald-600 rounded-r-full"
                />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <div className={`flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 ${!isSidebarOpen && 'justify-center'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${ROLE_CONFIG[currentRole].color}`}>
              {MOCK_USER.name.charAt(0)}
            </div>
            {isSidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{MOCK_USER.name}</p>
                <p className="text-xs text-slate-500 truncate">{ROLE_CONFIG[currentRole].label}</p>
              </div>
            )}
          </div>
          <button className="w-full mt-4 flex items-center gap-3 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors">
            <LogOut className="w-4 h-4" />
            {isSidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500"
            >
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="relative hidden md:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search anything..." 
                className="pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-sm w-64 focus:ring-2 focus:ring-emerald-500 transition-all dark:text-slate-200"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* View Website Button */}
            <button 
              onClick={() => setIsViewingWebsite(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-sm"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">View Public Site</span>
            </button>

            {/* Farming Mode Toggle */}
            <button 
              onClick={() => setFarmingMode(!farmingMode)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${ 
                farmingMode 
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                  : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${farmingMode ? 'fill-emerald-500' : ''}`} />
              {farmingMode ? 'Farming On' : 'Farming Off'}
            </button>

            {/* Aura Display */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-full text-xs font-bold shadow-sm">
              <Sparkles className="w-3.5 h-3.5 fill-amber-400" />
              <span>{auras.toLocaleString()} Auras</span>
            </div>

            <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1"></div>

            {/* Dark Mode Toggle */}
            {/* Role Switcher (Dev Only) */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <ShieldCheck className="w-4 h-4 text-slate-400" />
              <select 
                value={currentRole}
                onChange={(e) => setCurrentRole(e.target.value as UserRole)}
                className="bg-transparent border-none text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 focus:ring-0 cursor-pointer"
              >
                {Object.values(UserRole).map(role => (
                  <option key={role} value={role}>{ROLE_CONFIG[role].label}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
            >
              {isDarkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Offline Indicator */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${ 
              isOnline 
                ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                : 'bg-rose-50 text-rose-600 border-rose-100 animate-pulse'
            }`}>
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
            </div>

            {/* Notification Center */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors relative"
              >
                <BellRing className={`w-5 h-5 ${notifications.some(n => !n.read) ? 'text-emerald-600' : ''}`} />
                {notifications.some(n => !n.read) && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl z-50 overflow-hidden"
                  >
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Notifications</h3>
                      <button 
                        onClick={() => setNotifications(notifications.map(n => ({ ...n, read: true })))} 
                        className="text-[10px] font-bold text-emerald-600 hover:underline"
                      >
                        Mark all as read
                      </button>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map((n) => (
                          <div key={n.id} className={`p-4 border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${!n.read ? 'bg-emerald-50/30 dark:bg-emerald-500/5' : ''}`}>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">{n.title}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">{n.body}</p>
                            <p className="text-[9px] text-slate-400 font-medium">{n.time}</p>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center">
                          <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                          <p className="text-xs text-slate-400">No new notifications</p>
                        </div>
                      )}
                    </div>
                    <button className="w-full p-3 text-[10px] font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-t border-slate-100 dark:border-slate-800">
                      View all notifications
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Role Switcher (For Demo Purposes) */}
            <select 
              value={currentRole}
              onChange={(e) => setCurrentRole(e.target.value as UserRole)}
              className="text-xs font-medium bg-slate-100 dark:bg-slate-800 border-none rounded-full px-4 py-1.5 focus:ring-2 focus:ring-emerald-500 cursor-pointer dark:text-slate-300"
            >
              {Object.entries(ROLE_CONFIG).map(([role, config]) => (
                <option key={role} value={role}>{config.label}</option>
              ))}
            </select>

            <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900"></span>
            </button>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-2"></div>
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Feb 25, 2026</p>
                <p className="text-xs text-slate-500">Academic Session 2025/26</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className={`flex-1 flex overflow-hidden transition-all duration-500 ${showAds ? 'p-4' : 'p-0'}`}>
          <div className={`flex-1 overflow-y-auto transition-all duration-500 ${showAds ? 'p-4 bg-white dark:bg-slate-900 rounded-3xl shadow-inner border border-slate-200 dark:border-slate-800' : 'p-8'}`}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab + currentRole}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'dashboard' && <DashboardOverview role={currentRole} />}
                {activeTab === 'academics' && <AcademicsModule role={currentRole} auras={auras} deductAuras={deductAuras} />}
                {activeTab === 'finance' && <FinanceModule role={currentRole} auras={auras} config={config} />}
                {activeTab === 'attendance' && <AttendanceModule role={currentRole} />}
                {activeTab === 'school-farm' && <FarmingModeModule role={currentRole} farmingMode={farmingMode} setFarmingMode={setFarmingMode} auras={auras} dailyAurasEarned={dailyAurasEarned} config={config} />}
                {activeTab === 'rewards' && <RewardsModule role={currentRole} auras={auras} setAuras={setAuras} />}
                {activeTab === 'tutorials' && <TutorialsModule role={currentRole} />}
                {activeTab === 'communication' && <CommunicationModule role={currentRole} />}
                {activeTab === 'tests' && <AptitudeTestModule role={currentRole} />}
                {activeTab === 'results' && <ResultEngineModule role={currentRole} />}
                {activeTab === 'events' && <EventModule role={currentRole} />}
                {activeTab === 'website' && <WebsiteBuilderModule role={currentRole} />}
                {activeTab === 'settings' && <SettingsModule role={currentRole} config={config} setConfig={setConfig} auditLogs={auditLogs} />}
                {activeTab === 'alumni' && <AlumniModule role={currentRole} />}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Ad Panel (Farming Mode) */}
          <AnimatePresence>
            {showAds && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 300, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="flex flex-col gap-4 pl-4 overflow-hidden"
              >
                <div className="flex-1 bg-slate-100 dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sponsored</span>
                    <TrendingUp className="w-3 h-3 text-emerald-500" />
                  </div>
                  
                  {[1, 2, 3].map((i) => (
                    <div 
                      key={i} 
                      onClick={() => {
                        if (dailyAurasEarned < config.dailyAuraCapPerUser) {
                          setAuras(prev => prev + config.auraPerImpression);
                          setDailyAurasEarned(prev => prev + config.auraPerImpression);
                        } else {
                          alert('Daily Aura cap reached! Come back tomorrow.');
                        }
                      }}
                      className="group relative aspect-4/3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden cursor-pointer hover:border-emerald-500 transition-all"
                    >
                      <img 
                        src={`https://picsum.photos/seed/ad${i}/400/300`} 
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                        alt="Sponsored Content" 
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent flex flex-col justify-end p-3">
                        <p className="text-[10px] font-bold text-white mb-1">Earn +{config.auraPerImpression} Aura</p>
                        <p className="text-[8px] text-white/70 line-clamp-1">Interact to grow your Educentive fund.</p>
                      </div>
                    </div>
                  ))}

                  <div className="mt-auto p-4 bg-emerald-600 rounded-2xl text-white text-center">
                    <p className="text-[10px] font-bold uppercase mb-1">Farming Active</p>
                    <p className="text-xs">You are earning Auras passively in your personal work environment.</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
