import React, { useState } from 'react';
import { 
  Users, School, Shield, Menu, X, LogOut, Bell, ChevronDown, 
  BookOpen, Calendar, Zap, Sparkles, Trophy, Briefcase, Video, 
  PenTool, MessageSquare, Wallet, ShieldCheck, Heart, 
  User as UserIcon, Settings, Activity, Clock, ArrowRight,
  CheckCircle, Layout, Book, GraduationCap, Star, FileText,
  MoreVertical, Paperclip, Send, HelpCircle, ChevronRight,
  ChevronLeft, Plus, Download, Link as LinkIcon, Type, Trash2,
  Globe, File, UserCheck, ClipboardList, Lightbulb, CreditCard,
  History, Camera, Info, Landmark, Radio, Edit2, AlertTriangle, Newspaper, Mail, Calculator, Stethoscope, Eye,
  ArrowUpRight, ExternalLink, RefreshCw, Award, ShieldAlert, Fingerprint, ShoppingBag,
  ShieldHalf, Library, Medal, Box, Layers, Navigation, Apple, Terminal, Image as ImageIcon, Gavel, Banknote
} from 'lucide-react';
import { 
  UserRole, LamsWallet, SchoolSection, StaffLoan,
  ResultSheet, BlogPost, Bulletin, SalaryRecord, SalaryMonth, TransferStatus, TransferRequest
} from '../types';
import { ProfessorNova } from './ProfessorNova';
import { TimetableBuilder } from './DashboardFeatures';
import { SchoolRegistry } from './SchoolRegistry';
import { ScoresheetManager } from './ScoresheetManager';
import { NdoveraMeeting } from './NdoveraMeeting';
import { ResultTemplate } from './ResultTemplates';
import { ChatSystem } from './ChatSystem';
import { FarmingWallet, LamsAdBanner } from './FarmingMode';
import { DutyRoster } from './DutyRoster';
import { NdoveraImpact } from './AuraImpact';
import { CommunicationHub } from './CommunicationHub';
import { AccountantModule } from './AccountantModule';
import { SecuritySandbox } from './SecuritySandbox';
import { TuckShopModule } from './TuckShopModule';
import { SecurityPassModule } from './SecurityPassModule';
import { LibraryModule } from './LibraryModule';
import { HonorHallModule } from './HonorHallModule';
import { ClearLedgerModule } from './ClearLedgerModule';
import { HeritagePortal } from './HeritagePortal';
import { CurriculumVault } from './CurriculumVault';
import { SupplySanctuary } from './SupplySanctuary';
import { TransitTracker } from './TransitTracker';
import { WellnessWatch } from './WellnessWatch';
import { SkillForge } from './SkillForge';
import { InnovationGallery } from './InnovationGallery';
import { CivicCircle } from './CivicCircle';
import { StaffLoanModule } from './StaffLoanModule';

const MOCK_PUBLISHED_RESULT: ResultSheet = {
    id: 'res_1',
    studentId: 'david_01',
    studentName: 'David Okon',
    admissionNumber: 'ADM/PRI/082',
    class: 'Primary 5',
    session: '2024/2025',
    term: 'First Term',
    attendance: 88,
    daysOpened: 92,
    status: 'PUBLISHED',
    resultType: 'TEMPLATE',
    scores: [
        { subjectId: 's1', subjectName: 'Mathematics', ca1: 18, ca2: 15, ca3: 0, ca4: 0, exam: 52, isOffered: true },
        { subjectId: 's2', subjectName: 'English Language', ca1: 17, ca2: 18, ca3: 0, ca4: 0, exam: 55, isOffered: true },
        { subjectId: 's3', subjectName: 'Basic Science', ca1: 14, ca2: 12, ca3: 0, ca4: 0, exam: 48, isOffered: true }
    ],
    psychomotor: [],
    affective: [],
    teacherComment: 'A brilliant performance. Keep it up!',
    headTeacherComment: 'Satisfactory.',
    principalComment: 'Excellent.',
    aiComment: 'David shows exceptional aptitude in quantitative reasoning and consistent participation in class discussions.'
};

const DEFAULT_GRADING = [
    { grade: 'A', min: 70, max: 100, remark: 'Distinction', color: 'green' },
    { grade: 'B', min: 60, max: 69, remark: 'Very Good', color: 'blue' },
    { grade: 'C', min: 50, max: 59, remark: 'Credit', color: 'yellow' },
    { grade: 'P', min: 40, max: 49, remark: 'Pass', color: 'orange' },
    { grade: 'F', min: 0, max: 39, remark: 'Fail', color: 'red' },
];

export const DashboardShell: React.FC<{ 
    title: string; 
    user: { name: string; role: string; img: string };
    navItems: { id: string; label: string; icon: any; color?: string }[];
    activeTab: string;
    onTabChange: (id: string) => void;
    onLogout: () => void;
    children: React.ReactNode;
}> = ({ user, navItems, activeTab, onTabChange, onLogout, children }) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleTabChange = (id: string) => {
        onTabChange(id);
        setIsMobileMenuOpen(false);
    };

    return (
        <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden">
            {/* Standard Dashboard Header */}
            <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 md:px-10 shrink-0 z-[60] shadow-sm">
                <div className="flex items-center gap-6">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                        <School className="w-6 h-6"/>
                    </div>
                    <span className="font-black text-slate-900 text-xl uppercase tracking-tighter italic">NDOVERA</span>
                </div>
                
                {/* Desktop Horizontal Navigation - Centered in Header */}
                <div className="hidden lg:flex items-center gap-1 h-full">
                    {navItems.slice(0, 5).map(item => (
                        <button 
                            key={item.id} 
                            onClick={() => handleTabChange(item.id)} 
                            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === item.id ? 'text-indigo-600 bg-indigo-50 shadow-sm' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-6">
                    <div className="hidden md:flex items-center gap-3 pr-6 border-r border-slate-100">
                        <div className="text-right leading-none">
                            <p className="text-xs font-black text-slate-900 mb-0.5">{user.name}</p>
                            <p className="text-[9px] text-indigo-600 font-black uppercase tracking-widest">{user.role}</p>
                        </div>
                        <img src={user.img} className="w-10 h-10 rounded-2xl object-cover border border-slate-200 shadow-sm" alt="" />
                    </div>
                    <button onClick={onLogout} className="text-slate-300 hover:text-red-500 transition-colors">
                        <LogOut className="w-6 h-6"/>
                    </button>
                    <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-3 bg-slate-100 rounded-2xl text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all">
                        <Menu className="w-6 h-6"/>
                    </button>
                </div>
            </header>

            {/* Sub-Navigation Bar (Desktop Only) for secondary items */}
            <div className="hidden lg:flex bg-white border-b border-slate-100 px-10 py-3 gap-6 overflow-x-auto scrollbar-hide z-50">
                {navItems.slice(5).map(item => (
                    <button 
                        key={item.id} 
                        onClick={() => handleTabChange(item.id)} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                    >
                        <item.icon className="w-3.5 h-3.5" />
                        {item.label}
                    </button>
                ))}
            </div>

            {/* Mobile Nav Overlay */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-[200] lg:hidden animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setIsMobileMenuOpen(false)}></div>
                    <div className="absolute top-0 right-0 bottom-0 w-80 bg-white shadow-3xl flex flex-col p-8 animate-slide-left border-l border-slate-100">
                        <div className="flex justify-between items-center mb-10">
                            <span className="font-black text-indigo-600 uppercase tracking-widest text-lg italic">NDOVERA</span>
                            <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 bg-slate-50 rounded-xl"><X className="w-7 h-7 text-slate-900"/></button>
                        </div>
                        <div className="flex-1 space-y-2 overflow-y-auto scrollbar-hide">
                             {navItems.map(item => (
                                <button key={item.id} onClick={() => handleTabChange(item.id)} className={`w-full flex items-center gap-4 p-5 rounded-2xl font-black text-xs uppercase tracking-widest ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:bg-slate-50'}`}>
                                    <item.icon className="w-5 h-5" /> {item.label}
                                </button>
                            ))}
                        </div>
                        <div className="mt-8 pt-8 border-t border-slate-100">
                             <button onClick={onLogout} className="w-full flex items-center justify-center gap-3 p-5 rounded-2xl text-red-500 bg-red-50 font-black text-xs uppercase tracking-widest">
                                <LogOut className="w-5 h-5"/> Terminate Session
                             </button>
                        </div>
                    </div>
                </div>
            )}

            <main className="flex-1 overflow-y-auto p-6 md:p-12 scroll-smooth scrollbar-hide">
                <div className="max-w-7xl mx-auto">
                    {/* Breadcrumb Header */}
                    <div className="mb-10 flex items-center justify-between">
                         <div className="space-y-1">
                            <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">{activeTab.replace('_', ' ')}</h1>
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em]">Portal Dashboard / {activeTab}</p>
                         </div>
                    </div>
                    {children}
                </div>
            </main>
        </div>
    );
};

export const TeacherView: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
    const [activeTab, setActiveTab] = useState('Pulse');
    const [loans, setLoans] = useState<StaffLoan[]>([]);

    const navItems = [
        { id: 'Pulse', label: 'Campus Pulse', icon: Activity },
        { id: 'Records', label: 'Scoresheets', icon: ClipboardList },
        { id: 'Vault', label: 'Curriculum Vault', icon: Layers },
        { id: 'Gallery', label: 'Innovation Gallery', icon: ImageIcon },
        { id: 'Loan', label: 'Loan Center', icon: Banknote },
        { id: 'Honors', label: 'Honor Hall', icon: Medal },
        { id: 'Messages', label: 'Ndochat', icon: MessageSquare },
    ];

    return (
        <DashboardShell title="Teacher Portal" user={{ name: 'Mr. Ibeke', role: 'Faculty', img: 'https://ui-avatars.com/api/?name=Ibeke+George' }} navItems={navItems} activeTab={activeTab} onTabChange={setActiveTab} onLogout={onLogout}>
            {activeTab === 'Pulse' && (
                <div className="space-y-10 animate-fade-in pb-20">
                    <div className="bg-slate-900 p-12 rounded-[4rem] text-white shadow-2xl relative overflow-hidden">
                        <div className="relative z-10">
                            <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">The Pulse</h2>
                            <p className="text-indigo-300 font-bold uppercase text-[10px] tracking-widest mt-2 italic">Institutional News & Blog Feed</p>
                        </div>
                        <Bell className="absolute right-[-20px] bottom-[-20px] w-64 h-64 opacity-5 rotate-12"/>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl space-y-6">
                            <span className="bg-indigo-50 text-indigo-600 px-4 py-1 rounded-full text-[9px] font-black uppercase">Staff Update</span>
                            <h4 className="text-2xl font-black">2026 Session Prep Guidelines</h4>
                            <p className="text-slate-500 font-medium italic">"Ensure all lesson plans are uploaded to the vault by Friday for AI sync."</p>
                        </div>
                    </div>
                </div>
            )}
            {activeTab === 'Records' && <ScoresheetManager role={UserRole.TEACHER} schoolName="Lagoon Academy" logo="" />}
            {activeTab === 'Vault' && <CurriculumVault role={UserRole.TEACHER} />}
            {activeTab === 'Gallery' && <InnovationGallery />}
            {activeTab === 'Loan' && <StaffLoanModule role={UserRole.TEACHER} loans={loans} onUpdateLoans={setLoans} />}
            {activeTab === 'Honors' && <HonorHallModule role={UserRole.TEACHER} />}
            {activeTab === 'Messages' && <div className="h-[calc(100vh-15rem)]"><ChatSystem /></div>}
        </DashboardShell>
    );
};

export const ParentView: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
    const [activeTab, setActiveTab] = useState('Overview');

    const navItems = [
        { id: 'Overview', label: 'Ward Progress', icon: Layout },
        { id: 'Pulse', label: 'School Blog', icon: Newspaper },
        { id: 'Transit', label: 'Transit Tracker', icon: Navigation },
        { id: 'Wellness', label: 'Wellness Watch', icon: Apple },
        { id: 'Shop', label: 'Sanctuary Mall', icon: ShoppingBag },
        { id: 'Heritage', label: 'Heritage Portal', icon: History },
        { id: 'Finances', label: 'The Clear Ledger', icon: Landmark },
        { id: 'Messages', label: 'Communication', icon: MessageSquare },
    ];

    return (
        <DashboardShell title="Parent Portal" user={{ name: 'Mr. Okon', role: 'Guardian', img: 'https://ui-avatars.com/api/?name=Okon+Senior' }} navItems={navItems} activeTab={activeTab} onTabChange={setActiveTab} onLogout={onLogout}>
            {activeTab === 'Overview' && (
                <div className="space-y-10">
                    <div className="bg-indigo-600 p-12 rounded-[4rem] text-white shadow-xl relative overflow-hidden">
                        <div className="relative z-10">
                            <h2 className="text-4xl font-black tracking-tighter uppercase italic">Ward Performance Hub</h2>
                            <p className="text-indigo-100 font-bold uppercase text-[10px] tracking-widest mt-2">Active Session: 2024/2025</p>
                        </div>
                        <GraduationCap className="absolute right-[-20px] bottom-[-20px] w-64 h-64 opacity-10 rotate-12"/>
                    </div>
                    <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-2xl">
                         <div className="flex justify-between items-center mb-8">
                             <h3 className="text-2xl font-black uppercase italic text-slate-900">David Okon - Progress Report</h3>
                             <button className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-xl"><Download className="w-4 h-4"/> Archive Report</button>
                         </div>
                         <div className="overflow-auto max-h-[600px] border-4 border-slate-50 rounded-[3rem] p-10 scrollbar-hide">
                            <ResultTemplate data={MOCK_PUBLISHED_RESULT} grading={DEFAULT_GRADING} variant="modern" school={{ id: '1', name: 'Lagoon Academy', logo: 'https://i.imgur.com/r6L4Yf8.png' }} />
                         </div>
                    </div>
                </div>
            )}
            {activeTab === 'Transit' && <TransitTracker />}
            {activeTab === 'Wellness' && <WellnessWatch role={UserRole.PARENT} />}
            {activeTab === 'Shop' && <TuckShopModule role={UserRole.PARENT} isFarmingMode={true} />}
            {activeTab === 'Heritage' && <HeritagePortal />}
            {activeTab === 'Finances' && <ClearLedgerModule role={UserRole.PARENT} />}
            {activeTab === 'Messages' && <div className="h-[calc(100vh-15rem)]"><ChatSystem /></div>}
        </DashboardShell>
    );
};

export const StudentView: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
    const [activeTab, setActiveTab] = useState('Learning');
    const navItems = [
        { id: 'Learning', label: 'Nova AI', icon: Sparkles },
        { id: 'Pulse', label: 'School Blog', icon: Newspaper },
        { id: 'Forge', label: 'Skill Forge', icon: Terminal },
        { id: 'Gallery', label: 'Innovation Gallery', icon: ImageIcon },
        { id: 'Wellness', label: 'Wellness Watch', icon: Apple },
        { id: 'Civic', label: 'Civic Circle', icon: Gavel },
        { id: 'Results', label: 'Academic Hub', icon: FileText },
        { id: 'Wallet', label: 'Reward Wallet', icon: Wallet },
        { id: 'Messages', label: 'Ndochat', icon: MessageSquare },
    ];

    return (
        <DashboardShell title="Student Sanctuary" user={{ name: 'David Okon', role: 'Student', img: 'https://ui-avatars.com/api/?name=David+Okon' }} navItems={navItems} activeTab={activeTab} onTabChange={setActiveTab} onLogout={onLogout}>
            {activeTab === 'Learning' && <ProfessorNova credits={1250} onSpendCredits={() => {}} />}
            {activeTab === 'Forge' && <SkillForge />}
            {activeTab === 'Gallery' && <InnovationGallery />}
            {activeTab === 'Wellness' && <WellnessWatch role={UserRole.STUDENT} />}
            {activeTab === 'Civic' && <CivicCircle />}
            {activeTab === 'Results' && (
                <div className="space-y-10 animate-fade-in pb-20">
                    <div className="bg-indigo-900 p-12 rounded-[4rem] text-white shadow-2xl relative overflow-hidden">
                        <div className="relative z-10">
                            <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">Academic Hub</h2>
                            <p className="text-indigo-300 font-bold uppercase text-[10px] tracking-widest mt-2 italic">Official Published Learning Outcomes</p>
                        </div>
                        <Award className="absolute right-[-20px] bottom-[-20px] w-64 h-64 opacity-10 rotate-12"/>
                    </div>
                    <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-2xl flex flex-col items-center">
                        <div className="max-h-[700px] overflow-auto border-8 border-slate-50 rounded-[3.5rem] p-10 scrollbar-hide w-full max-w-4xl shadow-inner">
                            <ResultTemplate data={MOCK_PUBLISHED_RESULT} grading={DEFAULT_GRADING} variant="classic" school={{ id: '1', name: 'Lagoon Academy', logo: 'https://i.imgur.com/r6L4Yf8.png' }} />
                        </div>
                    </div>
                </div>
            )}
            {activeTab === 'Wallet' && <FarmingWallet wallet={{ balance: 1250, isFarmingActive: false, lifetimeEarned: 5000, pendingWithdrawal: 0 }} onToggle={() => {}} userAge={15} role={UserRole.STUDENT} onWithdraw={() => {}} onUpdateBalance={() => {}} onPurchase={() => {}} ownedItems={[]} />}
            {activeTab === 'Messages' && <div className="h-[calc(100vh-15rem)]"><ChatSystem /></div>}
        </DashboardShell>
    );
};

export const SuperAdminView: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
    const [activeTab, setActiveTab] = useState('Sandbox');

    const navItems = [
        { id: 'Sandbox', label: 'Security Sandbox', icon: ShieldAlert },
        { id: 'Impact', label: 'Humanity Impact', icon: Heart },
        { id: 'Registry', label: 'Global Registry', icon: Users },
        { id: 'Messages', label: 'Ndochat', icon: MessageSquare },
    ];

    return (
        <DashboardShell title="Super Admin Sanctuary" user={{ name: 'Ndovera Root', role: 'System Sovereign', img: 'https://ui-avatars.com/api/?name=Root+Admin' }} navItems={navItems} activeTab={activeTab} onTabChange={setActiveTab} onLogout={onLogout}>
            {activeTab === 'Sandbox' && <SecuritySandbox />}
            {activeTab === 'Impact' && <NdoveraImpact role={UserRole.SUPER_ADMIN} />}
            {activeTab === 'Registry' && <SchoolRegistry isAdminMode={true} />}
            {activeTab === 'Messages' && <div className="h-[calc(100vh-15rem)]"><ChatSystem /></div>}
        </DashboardShell>
    );
};
