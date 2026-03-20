import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {  
  Bell,
  LayoutDashboard, 
  Users, 
  BookOpen, 
  Trophy, 
  Calendar, 
  Wallet, 
  Megaphone, 
  Sprout,
  Zap,
  Settings, 
  GraduationCap,
  Globe,
  X,
  ClipboardList,
  BarChart3,
  Library,
  Stethoscope,
  Home,
  Cpu,
  ShoppingBag,
  UserCircle,
  Briefcase,
  TrendingUp,
  MessageSquareMore,
  ClipboardCheck,
  Video,
  FolderOpen
, FileText } from 'lucide-react';
import { Role } from '../types';
import { Cake, Server } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  roles: Role[];
}

// Roles that are allowed to use the school dashboard UI (exclude global/super roles)
const ROLES: Role[] = ['Tenant School Owner', 'Revoked', 
  'School Admin', 'HOS', 'Teacher', 'Student', 'Parent', 'Finance Officer', 
  'Librarian', 'Clinic Manager', 'Hostel Manager', 'ICT Manager', 'Tuckshop Manager', 'Growth Partner'
];

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: ROLES },
  { id: 'birthdays', label: 'Birthdays', icon: <Cake size={20} />, roles: ROLES },
  { id: 'classroom', label: 'Classroom', icon: <BookOpen size={20} />, roles: ['Super Admin', 'HOS', 'Teacher', 'Student', 'Parent', 'Owner', 'Tenant School Owner'] },
  { id: 'timetable', label: 'Timetable', icon: <Calendar size={20} />, roles: ['Super Admin', 'School Admin', 'HOS', 'Teacher', 'Student', 'Parent', 'Owner', 'Tenant School Owner'] },
  { id: 'attendance', label: 'Attendance', icon: <Calendar size={20} />, roles: ['Super Admin', 'School Admin', 'HOS', 'Teacher', 'Student', 'Parent', 'Owner', 'Tenant School Owner'] },
  { id: 'scoresheet', label: 'Score Sheet', icon: <ClipboardCheck size={20} />, roles: ['HOS', 'Teacher', 'Owner', 'Tenant School Owner'] },
  { id: 'finance', label: 'Finance', icon: <Wallet size={20} />, roles: ['Super Admin', 'HOS', 'Finance Officer', 'Parent', 'Owner', 'Tenant School Owner'] },
  { id: 'communication', label: 'Updates', icon: <Megaphone size={20} />, roles: ROLES },
  { id: 'chat', label: 'Chat', icon: <MessageSquareMore size={20} />, roles: ['School Admin', 'HOS', 'Teacher', 'Student', 'Parent', 'Owner', 'Tenant School Owner'] },
  { id: 'file-sharing', label: 'File Sharing', icon: <FolderOpen size={20} />, roles: ['School Admin', 'HOS', 'Teacher', 'ICT Manager', 'Finance Officer', 'Librarian', 'Clinic Manager', 'Hostel Manager', 'Tuckshop Manager', 'Owner', 'Tenant School Owner'] },
  { id: 'aptitude', label: 'Aptitude Tests', icon: <ClipboardList size={20} />, roles: ['Super Admin', 'School Admin', 'HOS', 'Teacher', 'ICT Manager', 'Owner', 'Tenant School Owner'] },
  { id: 'staff-training', label: 'Staff Training', icon: <Video size={20} />, roles: ['School Admin', 'HOS', 'Teacher', 'ICT Manager', 'Finance Officer', 'Librarian', 'Clinic Manager', 'Hostel Manager', 'Tuckshop Manager', 'Owner', 'Tenant School Owner'] },
  { id: 'library', label: 'Library', icon: <Library size={20} />, roles: ['Super Admin', 'School Admin', 'HOS', 'Librarian', 'Teacher', 'Student', 'Owner', 'Tenant School Owner'] },
  { id: 'clinic', label: 'Clinic', icon: <Stethoscope size={20} />, roles: ['Super Admin', 'School Admin', 'HOS', 'Clinic Manager', 'Teacher', 'Student', 'Parent', 'Owner', 'Tenant School Owner'] },
  { id: 'hostel', label: 'Hostel', icon: <Home size={20} />, roles: ['Super Admin', 'School Admin', 'HOS', 'Hostel Manager', 'Student', 'Parent', 'Owner', 'Tenant School Owner'] },
  { id: 'ict', label: 'ICT Management', icon: <Cpu size={20} />, roles: ['Super Admin', 'HOS', 'ICT Manager', 'Tenant School Owner', 'Owner'] },
  { id: 'tuckshop', label: 'Tuckshop', icon: <ShoppingBag size={20} />, roles: ['Super Admin', 'School Admin', 'HOS', 'Tuckshop Manager', 'Student', 'Parent', 'Owner', 'Tenant School Owner'] },
  { id: 'aurabooster', label: 'Aura Booster', icon: <Zap size={20} />, roles: ['Super Admin', 'School Admin', 'HOS', 'Teacher', 'Student', 'Owner', 'Tenant School Owner'] },
  { id: 'farming', label: 'Farming', icon: <Sprout size={20} />, roles: ['Super Admin', 'School Admin', 'HOS', 'Teacher', 'Student', 'Owner', 'Tenant School Owner'] },
  { id: 'tutorials', label: 'Tutorials', icon: <GraduationCap size={20} />, roles: ROLES },
  { id: 'website', label: 'Web Builder', icon: <Globe size={20} />, roles: ['Super Admin'] },
  { id: 'opportunities', label: 'Opportunities', icon: <Briefcase size={20} />, roles: ROLES.filter(r => r !== 'Student') },
  // Growth Partners is a global/super-admin feature — hide from regular school users
  { id: 'growth', label: 'Growth Partners', icon: <TrendingUp size={20} />, roles: ['Ami', 'Super Admin', 'Owner', 'Growth Partner'] as Role[] },
  { id: 'management', label: 'Staff/Students', icon: <Users size={20} />, roles: ['Super Admin', 'School Admin', 'HOS', 'Owner', 'Tenant School Owner'] },
  { id: 'reports', label: 'Reports', icon: <BarChart3 size={20} />, roles: ['Super Admin', 'School Admin', 'HOS', 'Finance Officer', 'Owner', 'Tenant School Owner'] },
    { id: 'duty-report', label: 'Duty Reports', icon: <FileText size={20} />, roles: ['Teacher', 'HOS', 'HoS', 'Owner', 'School Admin', 'ICT Manager'] },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={20} />, roles: ROLES },
  { id: 'settings', label: 'Settings', icon: <Settings size={20} />, roles: ['Super Admin', 'HOS', 'Owner', 'Tenant School Owner'] },
  { id: 'ads-management', label: 'Ads Management', icon: <Megaphone size={20} />, roles: ['Super Admin'] },
];

export const Sidebar = ({ currentRole, activeTab, setActiveTab, isOpen, setIsOpen, onRoleChange, tenantBrand }: { 
  currentRole: Role, 
  activeTab: string, 
  setActiveTab: (id: string) => void,
  isOpen: boolean,
  setIsOpen: (val: boolean) => void,
  onRoleChange?: (role: Role) => void,
  tenantBrand?: {
    name: string;
    logoUrl?: string | null;
    websiteUrl?: string | null;
    primaryColor?: string | null;
  }
}) => {
  const [tutorialsVisible, setTutorialsVisible] = useState(activeTab === 'tutorials');

  useEffect(() => {
    const updateTutorialsVisibility = () => {
      try {
        const raw = localStorage.getItem('ndovera_tutorial_hub');
        if (!raw) {
          setTutorialsVisible(activeTab === 'tutorials');
          return;
        }
        const parsed = JSON.parse(raw) as {
          tutorProfile?: unknown;
          joinedClasses?: unknown[];
        };
        setTutorialsVisible(Boolean(parsed?.tutorProfile) || Boolean(parsed?.joinedClasses?.length) || activeTab === 'tutorials');
      } catch {
        setTutorialsVisible(activeTab === 'tutorials');
      }
    };

    updateTutorialsVisibility();
    window.addEventListener('storage', updateTutorialsVisibility);
    window.addEventListener('ndovera:tutorials-updated', updateTutorialsVisibility as EventListener);
    return () => {
      window.removeEventListener('storage', updateTutorialsVisibility);
      window.removeEventListener('ndovera:tutorials-updated', updateTutorialsVisibility as EventListener);
    };
  }, [activeTab]);

  const filteredNav = useMemo(
    () => NAV_ITEMS.filter((item) => item.roles.includes(currentRole) && (item.id !== 'tutorials' || tutorialsVisible)),
    [currentRole, tutorialsVisible],
  );

  const globalRole = ['Super Admin', 'Ami', 'Owner', 'Tenant School Owner'].includes(currentRole);
  const tenantName = tenantBrand?.name || 'School Workspace';
  const tenantLink = (() => {
    if (!tenantBrand?.websiteUrl) return undefined;
    try {
      const parsed = new URL(tenantBrand.websiteUrl);
      const host = parsed.hostname.trim().toLowerCase();
      if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && (host === 'localhost' || host === '127.0.0.1' || host.includes('.'))) {
        return tenantBrand.websiteUrl;
      }
    } catch {}
    return undefined;
  })();
  const tenantAccent = tenantBrand?.primaryColor || '#10b981';

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/80 z-40 lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <motion.aside 
        initial={false}
        animate={{ 
          width: isOpen ? 236 : 0,
          x: isOpen ? 0 : -236
        }}
        className={`app-sidebar fixed lg:relative z-50 h-full flex flex-col overflow-hidden sidebar-gradient`}
      >
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Show global branding only for global roles (Super Admin / Ami / Owner) */}
            {globalRole ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8">
                  <img src="/ndovera.png" alt="Ndovera" className="w-full h-full object-contain" />
                </div>
                <span className="text-lg font-bold tracking-tight">Platform Control</span>
              </div>
            ) : (
              <a
                href={tenantLink}
                target={tenantLink ? '_blank' : undefined}
                rel={tenantLink ? 'noreferrer' : undefined}
                className="flex items-center gap-3 min-w-0"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg overflow-hidden" style={{ backgroundColor: tenantAccent }}>
                  {tenantBrand?.logoUrl ? (
                    <img src={tenantBrand.logoUrl} alt={tenantName} className="w-full h-full object-cover" />
                  ) : (
                    <Sprout className="text-white" size={20} />
                  )}
                </div>
                <span className="text-lg font-bold tracking-tight truncate">{tenantName}</span>
              </a>
            )}
          </div>
          <button onClick={() => setIsOpen(false)} className="lg:hidden opacity-70 hover:opacity-100">
            <X size={20} />
          </button>
        </div>

        {/* Role Switcher for Testing */}
        <div className="px-3 mb-3">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-xl">
            <div className="flex items-center gap-2 mb-2">
              <UserCircle size={14} className="text-emerald-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">Test Role Switcher</span>
            </div>
            <select 
              value={currentRole}
              onChange={(e) => onRoleChange?.(e.target.value as Role)}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-2 py-1.5 text-[11px] outline-none transition-all focus:border-emerald-500/50"
            >
              {ROLES.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {filteredNav.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (window.innerWidth < 768) setIsOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl transition-all duration-200 group ${
                activeTab === item.id 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
                  : 'opacity-75 hover:bg-white/10 hover:opacity-100'
              }`}
            >
              <span className={`${activeTab === item.id ? 'text-white' : 'group-hover:text-emerald-400'}`}>
                {item.icon}
              </span>
              <span className="text-base font-bold leading-5 tracking-tight">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10">
          <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2 opacity-70">Current School</p>
            <p className="text-xs font-bold truncate">{globalRole ? 'Global Workspace' : tenantName}</p>
            <p className="text-[10px] text-emerald-500 font-mono mt-1">{tenantLink ? 'CONNECTED SITE' : 'TENANT READY'}</p>
          </div>
        </div>
      </motion.aside>
    </>
  );
};
