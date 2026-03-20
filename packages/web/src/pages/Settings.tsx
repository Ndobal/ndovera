import React, { useState } from 'react';
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
import { ResultManagementSettings } from '../features/settings/components/ResultManagementSettings';

export const SettingsView = ({ role }: { role?: string }) => {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const { showToast } = useToast();
  const [showHOSModal, setShowHOSModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  const isAdmin = role && ['HOS', 'HoS', 'Owner', 'Tenant School Owner', 'ICT Manager'].includes(role);
  const isOwner = role && ['Owner', 'Tenant School Owner'].includes(role);

  const sections = [
    { id: 'profile', label: 'School Profile', desc: 'Manage your institution name, logo, and contact info.', icon: <Globe size={20} /> },
    { id: 'security', label: 'Security & Access', desc: 'Configure multi-factor auth and password policies.', icon: <Shield size={20} /> },
    { id: 'notifications', label: 'Notifications', desc: 'Choose what updates you want to receive.', icon: <Bell size={20} /> },
    { id: 'billing', label: 'Billing & Subscription', desc: 'Manage your Ndovera SaaS plan and invoices.', icon: <CreditCard size={20} /> },
    { id: 'support', label: 'Help & Support', desc: 'Get in touch with Ndovera technical team.', icon: <HelpCircle size={20} /> },
  ];

  if (isOwner) {
    sections.push({ id: 'owner-hub', label: 'Ownership & Administration', desc: 'Transfer ownership, appoint HOS, or close the school.', icon: <Shield size={20} className="text-rose-500" /> });
  }

  if (isAdmin) {
    sections.splice(4, 0, { id: 'result-management', label: 'Result Management', desc: 'Configure assessment weights, grading keys, and report templates.', icon: <FileText size={20} /> });
  }

  if (activeSection === 'owner-hub') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setActiveSection(null)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all"><ArrowLeft size={18} /></button>
          <div>
            <h2 className="text-xl font-bold text-white">Ownership & Administration</h2>
            <p className="text-zinc-500 text-xs">High-level administrative actions for school owners.</p>
          </div>
        </div>
        <div className="card-compact border border-rose-500/20 bg-rose-500/5 space-y-6">
        {showHOSModal && <div className="p-4 mb-4 bg-white/10 rounded-xl border border-white/20"><h4 className="text-white font-bold mb-2">Select New Head of School</h4><select className="w-full bg-black/50 border border-white/10 text-white rounded p-2 mb-2"><option>Mr. A (Current Teacher)</option><option>Mrs. B (Vice Principal)</option></select><div className="flex gap-2"><button onClick={() => { showToast('New HOS appointed successfully.', 'success'); setShowHOSModal(false); }} className="bg-emerald-600 px-3 py-1 rounded text-white text-xs">Confirm</button><button onClick={() => setShowHOSModal(false)} className="px-3 py-1 text-white text-xs">Cancel</button></div></div>}
        {showTransferModal && <div className="p-4 mb-4 bg-orange-500/10 rounded-xl border border-orange-500/20"><h4 className="text-white font-bold mb-2">Transfer Ownership</h4><input placeholder="Enter new owner email" className="w-full bg-black/50 border border-white/10 text-white rounded p-2 mb-2" /><div className="flex gap-2"><button onClick={() => { showToast('Ownership transfer initiated. Verification email sent.', 'success'); setShowTransferModal(false); }} className="bg-orange-600 px-3 py-1 rounded text-white text-xs">Send Transfer Request</button><button onClick={() => setShowTransferModal(false)} className="px-3 py-1 text-white text-xs">Cancel</button></div></div>}
           <div>
             <h3 className="text-sm font-bold text-white">Appoint New HOS</h3>
             <p className="text-xs text-zinc-400 mb-2">Transfer Head of School responsibilities to another staff member.</p>
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
      <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider">Save Configuration</button>
  </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
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
