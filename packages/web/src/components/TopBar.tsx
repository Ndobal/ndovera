import React from 'react';
import { 
  Bell, 
  Search,
  Menu,
  UserCircle,
  Moon,
  SunMedium
} from 'lucide-react';
import { Role } from '../types';
import { NotificationBell } from './NotificationBell';
import { ChatIcon } from './ChatIcon';

const ROLES: Role[] = [
  'Super Admin', 
  'School Admin', 
  'Ami',
  'HOS',
  'Teacher', 
  'Student', 
  'Parent', 
  'Finance Officer', 
  'Librarian',
  'Clinic Manager',
  'Hostel Manager',
  'ICT Manager',
  'Tuckshop Manager'
];

export const TopBar = ({ currentRole, setRole, toggleSidebar, searchQuery, setSearchQuery, setActiveTab, themeMode, setThemeMode, tenantBrand }: { 
  currentRole: Role, 
  setRole: (role: Role) => void,
  toggleSidebar: () => void,
  searchQuery: string,
  setSearchQuery: (query: string) => void,
  setActiveTab: (tab: string) => void,
  themeMode: 'light' | 'dark',
  setThemeMode: (mode: 'light' | 'dark') => void,
  tenantBrand?: {
    name: string;
    logoUrl?: string | null;
    websiteUrl?: string | null;
  }
}) => {
  const globalRole = ['Super Admin', 'Ami', 'Owner'].includes(currentRole);
  return (
    <header className="app-topbar h-14 flex items-center justify-between px-3 lg:px-5 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button 
          onClick={toggleSidebar}
          className="rounded-xl p-2 transition hover:bg-white/10 lg:hidden"
        >
          <Menu size={20} />
        </button>
        {/* show global logo for Super Admin / Ami / Owner */}
        {globalRole && (
          <div className="hidden md:flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg logo-white flex items-center justify-center overflow-hidden">
                <img src="/ndovera.png" alt="Ndovera" className="h-7 w-7 object-contain logo-rotate" />
              </div>
            </div>
        )}
        <div className="hidden md:flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-1.5 w-56 backdrop-blur-xl">
          <Search size={14} className="text-slate-400" />
          <label htmlFor="topbar-search" className="sr-only">Search</label>
          <input
            id="topbar-search"
            type="text"
            aria-label="Search"
            className="w-full border-none bg-transparent text-[11px] outline-none"
            value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      // switch to search results tab
                      setActiveTab('search');
                    }
                  }}
          />
        </div>
      </div>

        <div className="flex items-center gap-2.5 lg:gap-4">
        <button
          type="button"
          onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-1.5 text-[11px] font-semibold backdrop-blur-xl transition hover:bg-white/15"
        >
          {themeMode === 'dark' ? <SunMedium size={14} /> : <Moon size={14} />}
          <span>{themeMode === 'dark' ? 'Light mode' : 'Night mode'}</span>
        </button>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/10 rounded-2xl backdrop-blur-xl">
          <span className="text-[10px] font-bold uppercase">Role:</span>
          <select 
            value={currentRole}
            onChange={(e) => setRole(e.target.value as Role)}
            className="bg-transparent text-[11px] font-bold outline-none cursor-pointer"
          >
            {ROLES.map(r => <option key={r} value={r} className="bg-[#151619] text-white">{r}</option>)}
          </select>
        </div>

        <ChatIcon setActiveTab={setActiveTab} />
        <NotificationBell setActiveTab={setActiveTab} />
        <div className="flex items-center gap-2.5 pl-1">
          <div className="text-right hidden sm:block">
            <p className="text-[11px] font-bold">{globalRole ? 'Platform Admin' : (tenantBrand?.name || 'School Workspace')}</p>
            <p className="text-[10px] font-medium opacity-70">{currentRole}</p>
          </div>
          <div className="w-8 h-8 bg-emerald-600/20 border border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-500">
            <UserCircle size={20} />
          </div>
        </div>
      </div>
    </header>
  );
};
