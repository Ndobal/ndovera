import { useMemo, useState } from 'react';
import {
  Settings as SettingsIcon,
  Shield,
  Bell,
  Globe,
  CreditCard,
  HelpCircle,
  LogOut,
  ChevronRight,
  ArrowLeft,
  FileText
} from 'lucide-react';
import { useToast } from '../components/Toast';
import { BillingLockBanner } from '../components/BillingLockBanner';
import { useData } from '../hooks/useData';
import { useBillingLock } from '../hooks/useBillingLock';
import { fetchWithAuth } from '../services/apiClient';
import { ResultManagementSettings } from '../features/settings/components/ResultManagementSettings';

type DirectoryUser = {
  id: string;
  name: string;
  email?: string | null;
  category: string;
  status: 'active' | 'inactive';
  roles: string[];
  activeRole: string;
};

type DirectoryResponse = {
  schoolId: string;
  users: DirectoryUser[];
};

const SECTION_HEAD_ROLES = ['Nursery Head', 'Head Teacher', 'Junior School Principal', 'Principal'] as const;
const ALL_HEAD_ROLES = ['HoS', ...SECTION_HEAD_ROLES] as const;

function normalizeRoleName(value?: string) {
  return String(value || '').trim().toLowerCase();
}

export const SettingsView = ({ role }: { role?: string }) => {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const { showToast } = useToast();
  const [showHOSModal, setShowHOSModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedHOSUserId, setSelectedHOSUserId] = useState('');
  const [selectedHeadUserId, setSelectedHeadUserId] = useState('');
  const [selectedHeadRole, setSelectedHeadRole] = useState<(typeof SECTION_HEAD_ROLES)[number]>('Head Teacher');
  const [savingHeadRole, setSavingHeadRole] = useState<string | null>(null);
  const [showInactiveStaff, setShowInactiveStaff] = useState(false);

  const isAdmin = role && ['HOS', 'HoS', 'Owner', 'Tenant School Owner', 'ICT Manager'].includes(role);
  const isOwner = role && ['Owner', 'Tenant School Owner'].includes(role);
  const canManageHeads = !!role && ['HOS', 'HoS', 'Owner', 'Tenant School Owner', 'Admin', 'Super Admin'].includes(role);
  const { softLockActive, overdueInvoice } = useBillingLock(role);
  const { data: directory, loading: directoryLoading, error: directoryError, refetch: refetchDirectory } = useData<DirectoryResponse>('/api/users/directory?includeInactive=1', { enabled: canManageHeads });

  const staffUsers = useMemo(() => {
    const users = Array.isArray(directory?.users) ? directory.users : [];
    return users.filter((user) => ['staff', 'admin'].includes(String(user.category || '').toLowerCase()));
  }, [directory]);

  const assignableStaffUsers = useMemo(() => staffUsers.filter((user) => user.status === 'active'), [staffUsers]);

  const visibleStaffUsers = useMemo(() => showInactiveStaff ? staffUsers : assignableStaffUsers, [assignableStaffUsers, showInactiveStaff, staffUsers]);

  const inactiveStaffCount = useMemo(() => staffUsers.filter((user) => user.status === 'inactive').length, [staffUsers]);

  const currentHeadAssignments = useMemo(() => {
    return staffUsers.filter((user) => user.roles.some((entry) => normalizeRoleName(entry) === 'hos' || SECTION_HEAD_ROLES.some((headRole) => normalizeRoleName(headRole) === normalizeRoleName(entry))));
  }, [staffUsers]);

  const assignHeadRole = async (userId: string, nextRole: (typeof ALL_HEAD_ROLES)[number]) => {
    if (!userId) {
      showToast('Select a staff member first.', 'error');
      return;
    }

    setSavingHeadRole(nextRole);
    try {
      await fetchWithAuth('/api/users/assign-head-role', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId, role: nextRole }),
      });
      await refetchDirectory();
      showToast(`${nextRole} assigned successfully.`, 'success');
      if (nextRole === 'HoS') {
        setShowHOSModal(false);
        setSelectedHOSUserId('');
      } else {
        setSelectedHeadUserId('');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to assign head role.', 'error');
    } finally {
      setSavingHeadRole(null);
    }
  };

  const sections = [
    { id: 'profile', label: 'School Profile', desc: 'Manage your institution name, logo, and contact info.', icon: <Globe size={20} /> },
    { id: 'security', label: 'Security & Access', desc: 'Configure multi-factor auth and password policies.', icon: <Shield size={20} /> },
    { id: 'notifications', label: 'Notifications', desc: 'Choose what updates you want to receive.', icon: <Bell size={20} /> },
    { id: 'billing', label: 'Billing & Subscription', desc: 'Manage your Ndovera SaaS plan and invoices.', icon: <CreditCard size={20} /> },
    { id: 'support', label: 'Help & Support', desc: 'Get in touch with Ndovera technical team.', icon: <HelpCircle size={20} /> },
  ];

  if (canManageHeads) {
    sections.splice(4, 0, { id: 'head-appointments', label: 'Head Appointments', desc: 'Assign sectional heads and keep sign-off roles current.', icon: <Shield size={20} className="text-emerald-500" /> });
  }

  if (isOwner) {
    sections.push({ id: 'owner-hub', label: 'Ownership & Administration', desc: 'Transfer ownership, appoint HOS, or close the school.', icon: <Shield size={20} className="text-rose-500" /> });
  }

  if (isAdmin) {
    sections.splice(4, 0, { id: 'result-management', label: 'Result Management', desc: 'Configure assessment weights, grading keys, and report templates.', icon: <FileText size={20} /> });
  }

  if (activeSection === 'head-appointments') {
    return (
      <div className="space-y-6">
        {softLockActive ? <BillingLockBanner invoiceId={overdueInvoice?.id} dismissible={false} compact /> : null}
        <div className="flex items-center gap-4">
          <button onClick={() => setActiveSection(null)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all"><ArrowLeft size={18} /></button>
          <div>
            <h2 className="text-xl font-bold text-white">Head Appointments</h2>
            <p className="text-zinc-500 text-xs">Assign the sectional heads that lesson notes and results now enforce.</p>
          </div>
        </div>

        <div className="card-compact space-y-6">
          <div>
            <h3 className="text-sm font-bold text-white">Current Head Roles</h3>
            <p className="text-xs text-zinc-400 mt-1">Each head role is unique per school. Reassigning it automatically removes that same role from the previous holder.</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">Active staff {assignableStaffUsers.length}</span>
              <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-rose-200">Inactive staff {inactiveStaffCount}</span>
              <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 cursor-pointer">
                <input type="checkbox" checked={showInactiveStaff} onChange={(event) => setShowInactiveStaff(event.target.checked)} />
                Show inactive staff
              </label>
            </div>
          </div>

          {directoryLoading ? <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-zinc-400">Loading staff directory...</div> : null}
          {directoryError ? <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-200">{directoryError}</div> : null}

          <div className="grid gap-3 md:grid-cols-2">
            {SECTION_HEAD_ROLES.map((headRole) => {
              const holder = currentHeadAssignments.find((user) => user.roles.some((entry) => normalizeRoleName(entry) === normalizeRoleName(headRole)));
              return (
                <div key={headRole} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500">{headRole}</p>
                  <p className="mt-2 text-sm font-bold text-white">{holder?.name || 'Not assigned'}</p>
                  <p className="text-xs text-zinc-500">{holder?.id || 'No staff member currently holds this role.'}</p>
                  {holder ? <p className={`mt-2 inline-flex rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${holder.status === 'inactive' ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'}`}>{holder.status}</p> : null}
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-4">
            <div>
              <h4 className="text-sm font-bold text-white">Assign Sectional Head</h4>
              <p className="text-xs text-zinc-400 mt-1">Choose a staff member and promote them into the section-specific head role.</p>
            </div>
            <select value={selectedHeadUserId} onChange={(event) => setSelectedHeadUserId(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white outline-none">
              <option value="">Select staff member</option>
              {visibleStaffUsers.filter((user) => user.status === 'active').map((user) => (
                <option key={user.id} value={user.id}>{user.name} ({user.activeRole || user.roles[0] || user.id})</option>
              ))}
            </select>
            <select value={selectedHeadRole} onChange={(event) => setSelectedHeadRole(event.target.value as (typeof SECTION_HEAD_ROLES)[number])} className="w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white outline-none">
              {SECTION_HEAD_ROLES.map((headRole) => (
                <option key={headRole} value={headRole}>{headRole}</option>
              ))}
            </select>
            <button onClick={() => void assignHeadRole(selectedHeadUserId, selectedHeadRole)} disabled={!selectedHeadUserId || savingHeadRole !== null} className="rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-60">
              {savingHeadRole === selectedHeadRole ? 'Assigning...' : `Assign ${selectedHeadRole}`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activeSection === 'owner-hub') {
    return (
      <div className="space-y-6">
        {softLockActive ? <BillingLockBanner invoiceId={overdueInvoice?.id} dismissible={false} compact /> : null}
        <div className="flex items-center gap-4">
          <button onClick={() => setActiveSection(null)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all"><ArrowLeft size={18} /></button>
          <div>
            <h2 className="text-xl font-bold text-white">Ownership & Administration</h2>
            <p className="text-zinc-500 text-xs">High-level administrative actions for school owners.</p>
          </div>
        </div>
        <div className="card-compact border border-rose-500/20 bg-rose-500/5 space-y-6">
        {showHOSModal && (
          <div className="p-4 mb-4 bg-white/10 rounded-xl border border-white/20 space-y-3">
            <h4 className="text-white font-bold">Select New Head of School</h4>
            <select value={selectedHOSUserId} onChange={(event) => setSelectedHOSUserId(event.target.value)} className="w-full bg-black/50 border border-white/10 text-white rounded p-2">
              <option value="">Select staff member</option>
              {assignableStaffUsers.map((user) => (
                <option key={user.id} value={user.id}>{user.name} ({user.activeRole || user.roles[0] || user.id})</option>
              ))}
            </select>
            {directoryLoading ? <p className="text-xs text-zinc-400">Loading staff directory...</p> : null}
            {directoryError ? <p className="text-xs text-rose-200">{directoryError}</p> : null}
            <div className="flex gap-2">
              <button onClick={() => void assignHeadRole(selectedHOSUserId, 'HoS')} disabled={!selectedHOSUserId || savingHeadRole !== null} className="bg-emerald-600 px-3 py-1 rounded text-white text-xs disabled:cursor-not-allowed disabled:opacity-60">{savingHeadRole === 'HoS' ? 'Confirming...' : 'Confirm'}</button>
              <button onClick={() => setShowHOSModal(false)} className="px-3 py-1 text-white text-xs">Cancel</button>
            </div>
          </div>
        )}
        {showTransferModal && <div className="p-4 mb-4 bg-orange-500/10 rounded-xl border border-orange-500/20"><h4 className="text-white font-bold mb-2">Transfer Ownership</h4><input placeholder="Enter new owner email" className="w-full bg-black/50 border border-white/10 text-white rounded p-2 mb-2" /><div className="flex gap-2"><button onClick={() => { showToast('Ownership transfer initiated. Verification email sent.', 'success'); setShowTransferModal(false); }} className="bg-orange-600 px-3 py-1 rounded text-white text-xs">Send Transfer Request</button><button onClick={() => setShowTransferModal(false)} className="px-3 py-1 text-white text-xs">Cancel</button></div></div>}
           <div>
             <h3 className="text-sm font-bold text-white">Appoint New HOS</h3>
             <p className="text-xs text-zinc-400 mb-2">Transfer Head of School responsibilities to another real staff member from the current school directory.</p>
             <button onClick={() => setShowHOSModal(true)} className="bg-white/10 border border-white/5 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-white/20 transition-colors">Select New HOS</button>
           </div>
           <div className="h-px bg-white/10"></div>
           <div>
             <h3 className="text-sm font-bold text-white">Transfer Ownership</h3>
             <p className="text-xs text-zinc-400 mb-2">Securely transfer full ownership of this tenant to another user.</p>
             <button onClick={() => setShowTransferModal(true)} className="bg-orange-500/20 text-orange-500 px-4 py-2 rounded-lg text-xs font-bold hover:bg-orange-500/30 transition-colors">Transfer Ownership</button>
           </div>
           <div className="h-px bg-white/10"></div>
           <div>
             <h3 className="text-sm font-bold text-rose-500 mb-2">Danger Zone: Close School</h3>
             <p className="text-xs text-zinc-400 mb-2">Permanently deactivate this school tenant and archive all data.</p>
             <button onClick={() => { if(confirm('Are you absolutely sure you want to close this school? This action is irreversible.')) { showToast('School closed successfully.', 'success'); } }} className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors">Close School</button>
           </div>
        </div>
      </div>
    );
  }

  if (activeSection === 'result-management') {
    return (
      <div className="space-y-6">
        {softLockActive ? <BillingLockBanner invoiceId={overdueInvoice?.id} dismissible={false} compact /> : null}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setActiveSection(null)}
            className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white">Result Management</h2>
            <p className="text-zinc-500 text-xs">Configure assessment weights, grading keys, and report templates per section.</p>
          </div>
        </div>
        <ResultManagementSettings />
      </div>
    );
  }

  if (activeSection) {
    return (
      <div className="space-y-6">
        {softLockActive ? <BillingLockBanner invoiceId={overdueInvoice?.id} dismissible={false} compact /> : null}
         <div className="flex items-center gap-4">
          <button 
            onClick={() => setActiveSection(null)}
            className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white">{sections.find(s => s.id === activeSection)?.label}</h2>
            <p className="text-zinc-500 text-xs">Settings for {activeSection}</p>
          </div>
        </div>
        <div className="card-compact">
            <div className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
        <div>
          <h4 className="text-white font-bold text-sm">Enable Modules</h4>
          <p className="text-zinc-500 text-xs text-wrap max-w-sm">Toggle global features on or off for your school</p>
        </div>
        <div className="w-10 h-6 bg-emerald-600 rounded-full flex items-center p-1"><div className="w-4 h-4 bg-white rounded-full translate-x-4"></div></div>
      </div>
      <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
        <div>
          <h4 className="text-white font-bold text-sm">Strict Security Mode</h4>
          <p className="text-zinc-500 text-xs text-wrap max-w-sm">Require 2FA for all staff roles</p>
        </div>
        <div className="w-10 h-6 bg-zinc-600 rounded-full flex items-center p-1"><div className="w-4 h-4 bg-white rounded-full"></div></div>
      </div>
      <button disabled={softLockActive} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-50">Save Configuration</button>
  </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {softLockActive ? <BillingLockBanner invoiceId={overdueInvoice?.id} dismissible={false} compact /> : null}
      <div>
        <h2 className="text-xl font-bold text-white">System Settings</h2>
        <p className="text-zinc-500 text-xs">Configure your Ndovera experience and school preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {sections.map((section) => (
            <div 
              key={section.id} 
              onClick={() => setActiveSection(section.id)}
              className="card-compact group cursor-pointer hover:bg-white/3 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-zinc-500 group-hover:text-emerald-500 transition-all">
                    {section.icon}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-200">{section.label}</h4>
                    <p className="text-xs text-zinc-500">{section.desc}</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-zinc-700 group-hover:text-white transition-colors" />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <div className="card-compact bg-red-500/5 border-red-500/10">
            <h3 className="text-xs font-bold uppercase tracking-widest text-red-500 mb-4">Danger Zone</h3>
            <p className="text-[10px] text-zinc-500 mb-4 leading-relaxed">
              Actions here are irreversible. Please be careful when modifying these settings.
            </p>
            <button className="w-full flex items-center justify-center gap-2 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-xs font-bold transition-all">
              <LogOut size={16} /> Sign Out of All Devices
            </button>
          </div>

          <div className="card-compact">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Plan Details</h3>
            <div className="p-4 bg-emerald-600/10 border border-emerald-500/20 rounded-2xl mb-4">
              <p className="text-[10px] font-bold text-emerald-500 uppercase mb-1">Current Plan</p>
              <p className="text-lg font-bold text-white">Ndovera Ultimate Pro</p>
              <p className="text-[10px] text-zinc-500 mt-1">Renews on April 12, 2026</p>
            </div>
            <button className="w-full py-3 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl text-xs font-bold transition-all">
              Upgrade Plan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
