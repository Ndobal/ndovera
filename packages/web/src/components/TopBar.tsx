import React, { useMemo, useState } from 'react';
import { 
  Bell, 
  Search,
  Menu,
  UserCircle,
  Moon,
  SunMedium,
  Building2,
  Plus,
  X
} from 'lucide-react';
import { Role } from '../types';
import { NotificationBell } from './NotificationBell';
import { ChatIcon } from './ChatIcon';

type TopBarSchool = {
  id: string;
  name: string;
  subdomain?: string;
  accessLevel?: 'member' | 'owner';
  logoUrl?: string | null;
  websiteUrl?: string | null;
  primaryColor?: string;
}

type OwnerAccountSummary = {
  id: string;
  tier: 'growth' | 'pro' | 'enterprise';
  policyControl: 'none' | 'limited' | 'full';
  maxSchools: number | null;
  allowedSchoolCount: number | null;
  extraSchoolSlots: number;
  ownedSchoolCount: number;
  canAddSchools: boolean;
  upgradeRequired: boolean;
  ownerName: string;
  ownerEmail: string | null;
}

export const TopBar = ({ currentRole, toggleSidebar, searchQuery, setSearchQuery, setActiveTab, themeMode, setThemeMode, tenantBrand, accessibleSchools, activeSchoolId, ownerAccount, onSwitchSchool, onCreateSchool }: { 
  currentRole: Role, 
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
  },
  accessibleSchools?: TopBarSchool[],
  activeSchoolId?: string | null,
  ownerAccount?: OwnerAccountSummary | null,
  onSwitchSchool?: (schoolId: string) => Promise<void> | void,
  onCreateSchool?: (input: { schoolName: string; subdomain: string }) => Promise<void> | void,
}) => {
  const globalRole = ['Super Admin', 'Ami', 'Owner'].includes(currentRole);
  const [isSchoolModalOpen, setIsSchoolModalOpen] = useState(false);
  const [schoolName, setSchoolName] = useState('');
  const [schoolSubdomain, setSchoolSubdomain] = useState('');
  const [isSubmittingSchool, setIsSubmittingSchool] = useState(false);
  const [schoolError, setSchoolError] = useState<string | null>(null);
  const [schoolSuccess, setSchoolSuccess] = useState<string | null>(null);
  const schools = accessibleSchools || [];
  const showSchoolSwitcher = schools.length > 1 || Boolean(ownerAccount);
  const activeSchool = useMemo(() => schools.find((school) => school.id === activeSchoolId) || null, [schools, activeSchoolId]);

  const submitSchoolCreation = async () => {
    if (!onCreateSchool) return;
    const nextName = schoolName.trim();
    const nextSubdomain = schoolSubdomain.trim().toLowerCase();
    if (!nextName || nextName.length < 2) {
      setSchoolError('Enter a school name with at least 2 characters.');
      return;
    }
    if (!/^[a-z0-9-]{2,40}$/.test(nextSubdomain)) {
      setSchoolError('Use a 2-40 character subdomain with letters, numbers, or hyphens only.');
      return;
    }
    try {
      setIsSubmittingSchool(true);
      setSchoolError(null);
      setSchoolSuccess(null);
      await onCreateSchool({ schoolName: nextName, subdomain: nextSubdomain });
      setSchoolName('');
      setSchoolSubdomain('');
      setSchoolSuccess('School created and switched successfully.');
      setIsSchoolModalOpen(false);
    } catch (error) {
      setSchoolError(error instanceof Error ? error.message : 'Unable to create the school right now.');
    } finally {
      setIsSubmittingSchool(false);
    }
  };

  const switchSchool = async (schoolId: string) => {
    if (!schoolId || schoolId === activeSchoolId || !onSwitchSchool) return;
    setSchoolError(null);
    setSchoolSuccess(null);
    try {
      await onSwitchSchool(schoolId);
      setIsSchoolModalOpen(false);
    } catch (error) {
      setSchoolError(error instanceof Error ? error.message : 'Unable to switch schools right now.');
    }
  };

  return (
    <>
    <header className="app-topbar h-14 flex items-center justify-between px-3 lg:px-5 sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
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
        {showSchoolSwitcher && (
          <div className="hidden lg:flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-1.5 backdrop-blur-xl">
            <Building2 size={14} className="text-slate-400" />
            <label htmlFor="active-school-selector" className="sr-only">Active school</label>
            <select
              id="active-school-selector"
              value={activeSchoolId || ''}
              onChange={(event) => { void switchSchool(event.target.value); }}
              className="min-w-[180px] bg-transparent text-[11px] font-semibold outline-none"
            >
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}{school.accessLevel === 'owner' ? ' • Owner' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

        <div className="flex items-center gap-2.5 lg:gap-4">
        {showSchoolSwitcher && (
          <button
            type="button"
            onClick={() => setIsSchoolModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-1.5 text-[11px] font-semibold backdrop-blur-xl transition hover:bg-white/15 lg:hidden"
          >
            <Building2 size={14} />
            <span>{activeSchool?.name || 'Schools'}</span>
          </button>
        )}
        {ownerAccount && (
          <button
            type="button"
            onClick={() => setIsSchoolModalOpen(true)}
            className="hidden md:inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 backdrop-blur-xl transition hover:bg-emerald-500/15"
          >
            <Plus size={14} />
            <span>Add school</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-1.5 text-[11px] font-semibold backdrop-blur-xl transition hover:bg-white/15"
        >
          {themeMode === 'dark' ? <SunMedium size={14} /> : <Moon size={14} />}
          <span>{themeMode === 'dark' ? 'Light mode' : 'Night mode'}</span>
        </button>

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
    {isSchoolModalOpen && (
      <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm">
        <div className="flex h-full flex-col overflow-y-auto px-4 py-5 text-white">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between rounded-3xl border border-white/10 bg-slate-900/90 px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">School workspace</p>
              <h2 className="text-lg font-bold">Switch or create a school context</h2>
            </div>
            <button
              type="button"
              onClick={() => setIsSchoolModalOpen(false)}
              className="rounded-2xl border border-white/10 p-2 transition hover:bg-white/10"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mx-auto mt-4 grid w-full max-w-3xl gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-3xl border border-white/10 bg-slate-900/90 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Accessible schools</p>
                  <h3 className="text-base font-bold">Choose the active tenant</h3>
                </div>
                {activeSchool && (
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100">
                    Active: {activeSchool.name}
                  </span>
                )}
              </div>
              <div className="mt-4 grid gap-3">
                {schools.map((school) => (
                  <button
                    key={school.id}
                    type="button"
                    onClick={() => { void switchSchool(school.id); }}
                    className={`rounded-3xl border px-4 py-4 text-left transition ${school.id === activeSchoolId ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold">{school.name}</p>
                        <p className="text-xs text-slate-400">{school.subdomain ? `${school.subdomain}.ndovera.com` : 'Tenant workspace'}</p>
                      </div>
                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                        {school.accessLevel === 'owner' ? 'Owner' : 'Member'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-slate-900/90 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Owner account</p>
              {ownerAccount ? (
                <>
                  <div className="mt-2 rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold capitalize">{ownerAccount.tier} tier</p>
                        <p className="text-xs text-slate-400">Policy control: {ownerAccount.policyControl}</p>
                      </div>
                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                        {ownerAccount.allowedSchoolCount === null ? 'Unlimited schools' : `${ownerAccount.ownedSchoolCount}/${ownerAccount.allowedSchoolCount} schools`}
                      </span>
                    </div>
                    {ownerAccount.upgradeRequired && (
                      <p className="mt-3 text-xs text-amber-200">This account has reached its school limit. Upgrade or add a paid school slot before creating another school.</p>
                    )}
                  </div>
                  <div className="mt-4 space-y-3">
                    <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      School name
                      <input
                        type="text"
                        value={schoolName}
                        onChange={(event) => setSchoolName(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
                        placeholder="Ndovera East Campus"
                      />
                    </label>
                    <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Subdomain
                      <input
                        type="text"
                        value={schoolSubdomain}
                        onChange={(event) => setSchoolSubdomain(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
                        placeholder="east-campus"
                      />
                    </label>
                    {schoolError && <p className="text-xs text-rose-200">{schoolError}</p>}
                    {schoolSuccess && <p className="text-xs text-emerald-200">{schoolSuccess}</p>}
                    <button
                      type="button"
                      disabled={isSubmittingSchool || !onCreateSchool}
                      onClick={() => { void submitSchoolCreation(); }}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Plus size={15} />
                      <span>{isSubmittingSchool ? 'Creating school...' : 'Create school'}</span>
                    </button>
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-400">This account is working inside a single-school workspace.</p>
              )}
            </section>
          </div>
        </div>
      </div>
    )}
    </>
  );
};
