
import React, { useState } from 'react';
import { 
  Users, GraduationCap, Mail, Settings, LayoutDashboard, 
  Database, ShieldCheck, Activity, Heart, Video, X, Send, 
  CheckCircle, AlertTriangle, Image as ImageIcon, Palette, Globe, 
  Smartphone, Lock, Bell, Newspaper, Image, Plus, Trash2, Edit2, Eye, Landmark, Trophy, Stethoscope, Calculator, Clock, Calendar,
  ArrowRight, Check, History, ShoppingBag, ShieldHalf, Library, Medal, Box, Layers, Banknote
} from 'lucide-react';
// Added LoanAudit to types imports
import { 
  WebsiteContent, UserRole, Scoresheet, TransferStatus, TransferRequest, BlogPost, Bulletin, FeatureToggles, Holiday, LatenessConfig, StaffLoan, LoanAudit
} from '../types';
import { DashboardShell } from './Dashboards';
import { SchoolRegistry } from './SchoolRegistry';
import { ScoresheetManager } from './ScoresheetManager';
import { CommunicationHub } from './CommunicationHub';
import { ResultManager } from './ResultManager';
import { ClinicModule } from './ClinicModule';
import { HostelModule } from './HostelModule';
import { SportsModule } from './SportsModule';
import { AccountantModule } from './AccountantModule';
import { AttendanceModule } from './AttendanceModule';
import { TuckShopModule } from './TuckShopModule';
import { SecurityPassModule } from './SecurityPassModule';
import { LibraryModule } from './LibraryModule';
import { HonorHallModule } from './HonorHallModule';
import { ClearLedgerModule } from './ClearLedgerModule';
import { HeritagePortal } from './HeritagePortal';
import { CurriculumVault } from './CurriculumVault';
import { SupplySanctuary } from './SupplySanctuary';
import { StaffLoanModule } from './StaffLoanModule';

const AttendanceSettings: React.FC<{ 
    config: LatenessConfig; 
    setConfig: (c: LatenessConfig) => void; 
    holidays: Holiday[]; 
    setHolidays: (h: Holiday[]) => void 
}> = ({ config, setConfig, holidays, setHolidays }) => {
    return (
        <div className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <h3 className="text-xl font-black uppercase text-slate-900">Timing & Fines</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest">Resumption Time</label>
                            <input type="time" value={config.resumptionTime} onChange={e => setConfig({...config, resumptionTime: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 font-bold" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest">Grace Period (Mins)</label>
                            <input type="number" value={config.gracePeriodMinutes} onChange={e => setConfig({...config, gracePeriodMinutes: Number(e.target.value)})} className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 font-bold" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest">Late Fine (₦)</label>
                            <input type="number" value={config.finePerDay} onChange={e => setConfig({...config, finePerDay: Number(e.target.value)})} className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 font-bold" />
                        </div>
                    </div>
                </div>
                <div className="space-y-6">
                    <h3 className="text-xl font-black uppercase text-slate-900">Institutional Holidays</h3>
                    <div className="space-y-4 max-h-[300px] overflow-y-auto scrollbar-hide">
                        {holidays.map(h => (
                            <div key={h.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-slate-900">{h.name}</p>
                                    <p className="text-[10px] text-slate-400 font-black uppercase">{h.date}</p>
                                </div>
                                <button onClick={() => setHolidays(holidays.filter(x => x.id !== h.id))} className="text-red-300 hover:text-red-500"><Trash2 className="w-5 h-5"/></button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const BulletinStudio: React.FC<{ bulletins: Bulletin[]; setBulletins: (b: Bulletin[]) => void }> = ({ bulletins, setBulletins }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [category, setCategory] = useState<Bulletin['category']>('GENERAL');

    const handlePublish = () => {
        if (!title || !content) return;
        const newBulletin: Bulletin = {
            id: Date.now().toString(),
            title,
            content,
            category,
            date: new Date().toLocaleDateString('en-GB'),
            status: 'PUBLISHED',
            author: 'HOS Office'
        };
        setBulletins([newBulletin, ...bulletins]);
        setTitle(''); setContent('');
    };

    return (
        <div className="space-y-10 animate-fade-in">
            <div className="bg-indigo-900 p-12 rounded-[4rem] text-white shadow-2xl relative overflow-hidden">
                <div className="relative z-10">
                    <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">Bulletin Studio</h2>
                    <p className="text-indigo-200 font-bold uppercase text-[10px] tracking-widest mt-2 italic">Institutional News & Blog Hub</p>
                </div>
                <Newspaper className="absolute right-[-40px] bottom-[-40px] w-80 h-80 opacity-5 rotate-12"/>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl space-y-6">
                    <h3 className="text-xl font-black uppercase text-slate-900">New Publication</h3>
                    <div className="space-y-4">
                        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Bulletin Title" className="w-full bg-slate-50 p-5 rounded-2xl outline-none border border-slate-100 font-bold" />
                        <select value={category} onChange={e => setCategory(e.target.value as any)} className="w-full bg-slate-50 p-5 rounded-2xl outline-none border border-slate-100 font-bold">
                            <option value="GENERAL">General Bulletin</option>
                            <option value="ACADEMICS">Academic Update</option>
                            <option value="SPORTS">Sports News</option>
                            <option value="COMMUNITY">Community Care</option>
                        </select>
                        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Publication content..." className="w-full h-56 bg-slate-50 p-5 rounded-2xl outline-none border border-slate-100 font-medium italic resize-none" />
                        <button onClick={handlePublish} className="w-full bg-indigo-600 text-white py-6 rounded-[2.5rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3">
                             <Send className="w-5 h-5"/> Publish to Web & Pulse
                        </button>
                    </div>
                </div>

                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl flex flex-col">
                    <h3 className="text-xl font-black uppercase text-slate-900 mb-6">Live Archive</h3>
                    <div className="flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-hide">
                        {bulletins.map(b => (
                            <div key={b.id} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex justify-between items-start group hover:bg-white hover:shadow-lg transition-all">
                                <div className="space-y-2">
                                    <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[8px] font-black uppercase">{b.category}</span>
                                    <h4 className="font-bold text-slate-900">{b.title}</h4>
                                    <p className="text-[10px] font-black text-slate-400 uppercase">{b.date}</p>
                                </div>
                                <button onClick={() => setBulletins(bulletins.filter(x => x.id !== b.id))} className="text-red-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-5 h-5"/></button>
                            </div>
                        ))}
                        {bulletins.length === 0 && <div className="h-full flex flex-col items-center justify-center opacity-30 italic p-10 text-center"><Newspaper className="w-12 h-12 mb-4 mx-auto"/> No publications recorded.</div>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const SchoolOwnerView: React.FC<{ 
    onLogout: () => void; 
    websiteContent: WebsiteContent; 
    setWebsiteContent: (c: WebsiteContent) => void;
    paymentStatus: 'PAID' | 'UNPAID' | 'TRIAL';
    role: UserRole;
    ownerName: string;
}> = ({ onLogout, websiteContent, setWebsiteContent, role, ownerName }) => {
    const [activeTab, setActiveTab] = useState('Overview');
    const [settingsTab, setSettingsTab] = useState<'GENERAL' | 'ATTENDANCE' | 'FEATURES'>('GENERAL');
    
    // Logic for Transfer Request Simulation
    const [mockRequests, setMockRequests] = useState<TransferRequest[]>([
        { id: 'tr_1', studentId: 'stu_82', studentName: 'Okon Junior', oldSchoolName: 'Lagoon Academy', oldSchoolId: 's1', requestingParentId: 'p1', targetSchoolName: 'Summit High', status: TransferStatus.PENDING, withdrawalReason: 'Relocation to Lekki Phase 1.', timestamp: '2024-11-20 11:00' }
    ]);

    const [loans, setLoans] = useState<StaffLoan[]>([]);

    const navItems = [
        { id: 'Overview', label: 'Admin Home', icon: LayoutDashboard },
        { id: 'Loan', label: 'Loan Recovery', icon: Banknote },
        { id: 'Attendance', label: 'Attendance Kiosk', icon: Clock },
        { id: 'Academics', label: 'Academic Records', icon: GraduationCap },
        { id: 'People', label: 'School Register', icon: Users },
        { id: 'Shop', label: 'Sanctuary Mall', icon: ShoppingBag },
        { id: 'Finance', label: 'Clear Ledger', icon: Landmark },
        { id: 'Bulletins', label: 'Bulletin Studio', icon: Newspaper },
        { id: 'Settings', label: 'Governance', icon: Settings },
    ];

    const handleRequestAction = (id: string, action: 'APPROVE' | 'REJECT') => {
        setMockRequests(prev => prev.map(r => r.id === id ? { ...r, status: action === 'APPROVE' ? TransferStatus.APPROVED_RELEASED : TransferStatus.REJECTED } : r));
        alert(`Request ${id} has been ${action === 'APPROVE' ? 'Approved' : 'Rejected'}.`);
    };

    const renderContent = () => {
        switch(activeTab) {
            case 'Overview':
                return (
                    <div className="space-y-10 animate-fade-in pb-20">
                        <div className="bg-slate-900 rounded-[4rem] p-12 md:p-16 text-white relative overflow-hidden shadow-2xl border border-white/5">
                            <div className="relative z-10 space-y-6">
                                <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-none italic">{websiteContent.schoolName} <br /><span className="text-indigo-400">Head of School Desk.</span></h1>
                            </div>
                            <Globe className="absolute right-[-40px] bottom-[-40px] w-96 h-96 opacity-5 rotate-12"/>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-8">
                                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl">
                                    <h3 className="text-2xl font-black uppercase italic text-slate-900 mb-8 flex items-center gap-3">
                                        <AlertTriangle className="text-amber-500 w-6 h-6"/> Pending Approvals
                                    </h3>
                                    <div className="space-y-4">
                                        {mockRequests.filter(r => r.status === TransferStatus.PENDING).map(req => (
                                            <div key={req.id} className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
                                                <div className="flex items-center gap-5">
                                                    <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-indigo-600 shadow-sm font-black italic">TR</div>
                                                    <div>
                                                        <h4 className="font-black text-slate-900 uppercase tracking-tight">Transfer: {req.studentName}</h4>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Reason: {req.withdrawalReason}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-3">
                                                    <button onClick={() => handleRequestAction(req.id, 'REJECT')} className="bg-white text-red-500 px-6 py-3 rounded-xl font-black text-[10px] uppercase border border-red-100 hover:bg-red-50 transition-all">Reject</button>
                                                    <button onClick={() => handleRequestAction(req.id, 'APPROVE')} className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-emerald-700 transition-all">Release Student</button>
                                                </div>
                                            </div>
                                        ))}
                                        {loans.filter(l => l.status === 'HOS_FILED').map(loan => (
                                            <div key={loan.id} className="p-8 bg-amber-50 rounded-[2.5rem] border border-amber-100 flex flex-col md:flex-row justify-between items-center gap-6 animate-pulse">
                                                <div className="flex items-center gap-5">
                                                    <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-amber-600 shadow-sm font-black italic">LN</div>
                                                    <div>
                                                        <h4 className="font-black text-slate-900 uppercase tracking-tight">Loan Escalated: {loan.staffName}</h4>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Principal: ₦{loan.amount.toLocaleString()}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-3">
                                                    <button onClick={() => {
                                                        const audit: LoanAudit = { status: 'OWNER_APPROVED', timestamp: new Date().toLocaleString(), note: 'Owner approved and disbursed funds.', actorName: 'Owner' };
                                                        setLoans(loans.map(l => l.id === loan.id ? {...l, status: 'OWNER_APPROVED', auditTrail: [...l.auditTrail, audit]} : l));
                                                        alert("Loan Approved and Sent to Accountant for Disbursement.");
                                                    }} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg">Approve & Pay Staff</button>
                                                </div>
                                            </div>
                                        ))}
                                        {mockRequests.filter(r => r.status === TransferStatus.PENDING).length === 0 && loans.filter(l => l.status === 'HOS_FILED').length === 0 && <div className="p-16 text-center opacity-30 italic font-medium">Clear Queue • No pending institutional requests.</div>}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-8">
                                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl space-y-6">
                                    <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner"><Activity className="w-7 h-7"/></div>
                                    <h4 className="text-xl font-black uppercase text-slate-900 tracking-tight">System Pulse</h4>
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-end border-b border-slate-50 pb-4">
                                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Active Staff</span>
                                            <span className="text-3xl font-black italic">68</span>
                                        </div>
                                        <div className="flex justify-between items-end border-b border-slate-50 pb-4">
                                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Avg Punctuality</span>
                                            <span className="text-3xl font-black italic text-emerald-500">94.2%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'Attendance': return <AttendanceModule config={websiteContent.attendanceConfig} holidays={websiteContent.holidays} />;
            case 'Finance': return <ClearLedgerModule role={role} />;
            case 'People': return <SchoolRegistry isAdminMode />;
            case 'Shop': return <TuckShopModule role={role} />;
            case 'Loan': return <StaffLoanModule role={role} loans={loans} onUpdateLoans={setLoans} />;
            case 'Academics': return <ScoresheetManager role={role} schoolName={websiteContent.schoolName} logo={websiteContent.logo} />;
            case 'Bulletins': return <BulletinStudio bulletins={websiteContent.bulletins} setBulletins={(b) => setWebsiteContent({...websiteContent, bulletins: b})} />;
            case 'Settings':
                return (
                    <div className="space-y-8 animate-fade-in pb-20">
                        <div className="bg-white p-10 rounded-[4rem] border border-slate-100 shadow-2xl">
                            <h2 className="text-4xl font-black italic tracking-tighter uppercase text-slate-900 mb-10">Institutional Governance</h2>
                            <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit mb-10">
                                {['GENERAL', 'ATTENDANCE', 'FEATURES'].map(tab => (
                                    <button key={tab} onClick={() => setSettingsTab(tab as any)} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${settingsTab === tab ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-500'}`}>{tab}</button>
                                ))}
                            </div>
                            {settingsTab === 'ATTENDANCE' ? (
                                <AttendanceSettings config={websiteContent.attendanceConfig} setConfig={(c) => setWebsiteContent({...websiteContent, attendanceConfig: c})} holidays={websiteContent.holidays} setHolidays={(h) => setWebsiteContent({...websiteContent, holidays: h})} />
                            ) : (
                                <div className="p-20 text-center opacity-30 italic">Select a sub-tab to proceed.</div>
                            )}
                        </div>
                    </div>
                );
            default: return null;
        }
    };

    return (
        <DashboardShell user={{ name: ownerName || 'Admin', role: 'Head of School', img: `https://ui-avatars.com/api/?name=${ownerName || 'Admin'}&background=4f46e5&color=fff` }} navItems={navItems} activeTab={activeTab} onTabChange={setActiveTab} onLogout={onLogout} title="HOS Desk">
            <div className="h-full scroll-smooth scrollbar-hide">{renderContent()}</div>
        </DashboardShell>
    );
};
