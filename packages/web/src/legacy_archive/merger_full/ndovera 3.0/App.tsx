
import React, { useState, useEffect } from 'react';
import { LandingPage } from './components/LandingPage';
// Added DashboardShell to named imports
import { DashboardShell, SuperAdminView, StudentView, ParentView, TeacherView } from './components/Dashboards';
import { SchoolOwnerView } from './components/SchoolOwnerView';
import { SchoolPublicWeb } from './components/SchoolPublicWeb';
// Added TuckShopModule import
import { TuckShopModule } from './components/TuckShopModule';
import { ViewState, UserRole, WebsiteContent, BlogPost, Bulletin } from './types';
import { 
  Shield, School as SchoolIcon, UserPlus, GraduationCap, Users, 
  User, X, ArrowLeft, CheckCircle, Loader2, Mail, 
  Lock, Sparkles, ArrowRight, UserCircle, LogIn,
  Search, Globe, ShieldCheck, Bookmark, Building, CreditCard, RefreshCw, Landmark, DollarSign,
  Clock, Rocket, Palette, Link as LinkIcon, Camera, ShoppingBag
} from 'lucide-react';

/**
 * Authentication Gateway component for handling Login and Sign-up UI.
 */
const AuthGateway: React.FC<{ initialMode: 'LOGIN' | 'SIGNUP'; onAuth: (role: UserRole, name?: string) => void; onCancel: () => void }> = ({ initialMode, onAuth, onCancel }) => {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.STUDENT);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAuth(role, name || email);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md animate-scale-in">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold uppercase tracking-tight text-slate-900">
            {mode === 'LOGIN' ? 'Portal Login' : 'Sign Up'}
          </h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-red-500 transition-colors">
            <X className="w-6 h-6"/>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'SIGNUP' && (
            <input 
              placeholder="Full Name" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              className="w-full p-4 bg-slate-50 border rounded-xl font-bold outline-none" 
              required 
            />
          )}
          <input 
            type="email" 
            placeholder="Email Address" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            className="w-full p-4 bg-slate-50 border rounded-xl font-bold outline-none" 
            required 
          />
          <input 
            type="password" 
            placeholder="Passcode" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            className="w-full p-4 bg-slate-50 border rounded-xl font-bold outline-none" 
            required 
          />
          {mode === 'SIGNUP' && (
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Institutional Role</label>
              <select 
                value={role} 
                onChange={e => setRole(e.target.value as UserRole)} 
                className="w-full p-4 bg-slate-50 border rounded-xl font-bold outline-none"
              >
                {Object.values(UserRole).filter(r => r !== UserRole.GUEST).map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          )}
          <button 
            type="submit" 
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
          >
            {mode === 'LOGIN' ? <LogIn className="w-4 h-4"/> : <UserPlus className="w-4 h-4"/>}
            {mode === 'LOGIN' ? 'Enter Portal' : 'Create Account'}
          </button>
        </form>
        <button 
          onClick={() => setMode(mode === 'LOGIN' ? 'SIGNUP' : 'LOGIN')} 
          className="w-full mt-6 text-[10px] font-black uppercase text-indigo-600 tracking-widest text-center hover:underline"
        >
          {mode === 'LOGIN' ? "Don't have an account? Request access" : "Already registered? Sign in"}
        </button>
      </div>
    </div>
  );
};

const SchoolOnboarding: React.FC<{ onComplete: (data: Partial<WebsiteContent>) => void; onCancel: () => void }> = ({ onComplete, onCancel }) => {
  const [formData, setFormData] = useState({
    schoolName: '',
    slug: '',
    logo: 'https://i.imgur.com/r6L4Yf8.png',
    brandColor: '#4f46e5'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete(formData);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden relative z-10 animate-scale-in border border-white/10">
        <div className="p-10 space-y-8">
          <div className="flex justify-between items-center">
            <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 shadow-sm">
              <Rocket className="w-6 h-6"/>
            </div>
            <button onClick={onCancel} className="text-slate-300 hover:text-red-500 transition-colors"><X className="w-6 h-6"/></button>
          </div>
          
          <div className="space-y-1">
            <h2 className="text-3xl font-bold uppercase text-slate-900">Setup Your School</h2>
            <p className="text-slate-500 font-medium text-sm">Enter basic details to create your school portal.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1.5 tracking-widest flex items-center gap-2"><SchoolIcon className="w-3 h-3"/> School Name</label>
                <input required value={formData.schoolName} onChange={e => setFormData({...formData, schoolName: e.target.value})} placeholder="e.g. Lagoon Academy" className="w-full bg-slate-50 p-4 rounded-xl outline-none focus:ring-2 ring-indigo-500/20 border border-slate-200 font-bold" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1.5 tracking-widest flex items-center gap-2"><LinkIcon className="w-3 h-3"/> School Web Address (Link)</label>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-4">
                  <span className="text-slate-400 text-xs font-bold mr-1">ndovera.com/</span>
                  <input required value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})} placeholder="lagoon-high" className="flex-1 bg-transparent py-4 outline-none font-bold text-slate-900" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1.5 tracking-widest flex items-center gap-2"><Camera className="w-3 h-3"/> Logo Image Link</label>
                <input required value={formData.logo} onChange={e => setFormData({...formData, logo: e.target.value})} placeholder="https://..." className="w-full bg-slate-50 p-4 rounded-xl outline-none border border-slate-200 font-bold" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1.5 tracking-widest flex items-center gap-2"><Palette className="w-3 h-3"/> School Theme Color</label>
                <div className="flex gap-3 items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <input type="color" value={formData.brandColor} onChange={e => setFormData({...formData, brandColor: e.target.value})} className="w-10 h-10 rounded bg-transparent cursor-pointer border-none"/>
                  <span className="font-bold text-slate-900 uppercase text-xs tracking-widest">{formData.brandColor}</span>
                </div>
              </div>
            </div>
            
            <button type="submit" className="w-full bg-slate-900 text-white py-6 rounded-xl font-black text-sm uppercase shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3 mt-4">
              Save School Setup <ArrowRight className="w-5 h-5"/>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.LANDING);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>(UserRole.GUEST);
  const [ownerName, setOwnerName] = useState('');
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [authMode, setAuthMode] = useState<'LOGIN' | 'SIGNUP'>('SIGNUP');
  
  const [websiteContent, setWebsiteContent] = useState<WebsiteContent>({
      slug: 'lagoon', activeTemplateId: 'trad', maintenanceMode: { isUnderMaintenance: false },
      schoolName: 'Lagoon Academy', motto: 'Developing Total Excellence.', foundingYear: '1995', logo: 'https://i.imgur.com/r6L4Yf8.png', brandColor: '#4f46e5',
      features: { boarding: false, transport: false, hostel: false, sports: false, aiSummaries: true, vacancies: false, financialPortal: true },
      attendanceConfig: { resumptionTime: '08:00', gracePeriodMinutes: 15, finePerDay: 500, isEnabled: true },
      holidays: [
        { id: 'h1', name: 'Christmas Break', date: '2024-12-25' },
        { id: 'h2', name: 'New Year Day', date: '2025-01-01' }
      ],
      home: { headline: "Developing <b>Total Excellence.</b>", subheadline: "A premium institution built for the next generation.", heroImage: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=2070', features: [{ title: 'Academic Rigor', desc: 'Global standards.' }, { title: 'Character', desc: 'Ethical leadership.' }, { title: 'Digital', desc: 'Integrated tech.' }] },
      about: { philosophy: 'Excellence.', history: 'Est 1995.', mission: 'Smart learning.', vision: 'Digital revolution.' },
      academics: { curriculum: 'International.', levels: [{ name: 'Lower School', desc: 'Foundations.' }, { name: 'Upper School', desc: 'Advanced.' }] },
      admissions: { steps: ['Apply'], policy: 'Merit.', deadline: 'Dec 2024' },
      contact: { address: 'Lekki, Lagos', phone: '0800-NDOVERA', email: 'hello@lagoon.edu' },
      blogPosts: [], gallery: [], bulletins: []
  });

  const handleAuthSuccess = (role: UserRole, name?: string) => {
    setCurrentUserRole(role);
    if (name) setOwnerName(name);
    if (role === UserRole.SCHOOL_OWNER && authMode === 'SIGNUP') setCurrentView(ViewState.ONBOARDING);
    else setCurrentView(ViewState.DASHBOARD);
  };

  const handleLogout = () => {
    setCurrentUserRole(UserRole.GUEST);
    setCurrentView(ViewState.LANDING);
    setPaymentVerified(false);
  };

  const renderDashboard = () => {
    switch (currentUserRole) {
      case UserRole.SUPER_ADMIN: return <SuperAdminView onLogout={handleLogout} />;
      case UserRole.SCHOOL_OWNER:
      case UserRole.SCHOOL_ADMIN:
        return <SchoolOwnerView ownerName={ownerName} role={currentUserRole} onLogout={handleLogout} websiteContent={websiteContent} setWebsiteContent={setWebsiteContent} paymentStatus="PAID" />;
      case UserRole.TEACHER: return <TeacherView onLogout={handleLogout} />;
      case UserRole.STUDENT: return <StudentView onLogout={handleLogout} />;
      case UserRole.PARENT: return <ParentView onLogout={handleLogout} />;
      case UserRole.TUCKSHOP_MANAGER:
        return (
            <DashboardShell title="Mall Management" user={{ name: 'Shop Manager', role: 'Tuckshop Merchant', img: 'https://ui-avatars.com/api/?name=Shop+Manager' }} navItems={[{ id: 'Mall', label: 'Sanctuary Mall', icon: ShoppingBag }]} activeTab="Mall" onTabChange={() => {}} onLogout={handleLogout}>
                <TuckShopModule role={UserRole.TUCKSHOP_MANAGER} />
            </DashboardShell>
        );
      default: return null;
    }
  };

  return (
    <>
      {currentView === ViewState.LANDING && <LandingPage onStartOnboarding={() => { setAuthMode('SIGNUP'); setCurrentView(ViewState.AUTH); }} onLogin={() => { setAuthMode('LOGIN'); setCurrentView(ViewState.AUTH); }} onSignup={() => { setAuthMode('SIGNUP'); setCurrentView(ViewState.AUTH); }} />}
      {currentView === ViewState.AUTH && <AuthGateway initialMode={authMode} onAuth={handleAuthSuccess} onCancel={() => setCurrentView(ViewState.LANDING)} />}
      {currentView === ViewState.ONBOARDING && <SchoolOnboarding onComplete={(data) => { setWebsiteContent(prev => ({...prev, ...data} as WebsiteContent)); setCurrentView(ViewState.PAYMENT_PENDING); }} onCancel={() => setCurrentView(ViewState.LANDING)} />}
      {currentView === ViewState.DASHBOARD && <div className="h-screen w-full bg-slate-50">{renderDashboard()}</div>}
    </>
  );
};

export default App;
