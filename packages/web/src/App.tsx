import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { Layout } from './components/Layout';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { Role } from './types';
import { ToastContainer, useToast } from './components/Toast';
import { StoredUser } from './services/authLocal';
import { SUPER_ADMIN_URL } from './services/runtimeConfig';
import { ACTIVE_SCHOOL_CHANGED_EVENT, clearStoredActiveSchoolId, fetchWithAuth, getStoredActiveSchoolId, setStoredActiveSchoolId } from './services/apiClient';

const LandingPage = lazy(() => import('./pages/LandingPage').then((module) => ({ default: module.LandingPage })));
const AuthView = lazy(() => import('./pages/Auth').then((module) => ({ default: module.AuthView })));
const DashboardHome = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.DashboardHome })));
const FarmingView = lazy(() => import('./pages/Farming').then((module) => ({ default: module.FarmingView })));
const AuraBoosterView = lazy(() => import('./pages/AuraBooster').then((module) => ({ default: module.AuraBoosterView })));
const WebsiteBuilder = lazy(() => import('./pages/WebsiteBuilder').then((module) => ({ default: module.WebsiteBuilder })));
const TutorialsView = lazy(() => import('./pages/Tutorials').then((module) => ({ default: module.TutorialsView })));
const ChampionshipsView = lazy(() => import('./pages/Championships').then((module) => ({ default: module.ChampionshipsView })));
const CommunicationHub = lazy(() => import('./pages/Communication').then((module) => ({ default: module.CommunicationHub })));
const AptitudeTests = lazy(() => import('./pages/AptitudeTests.tsx'));
const ManagementView = lazy(() => import('./pages/Management').then((module) => ({ default: module.ManagementView })));
const SettingsView = lazy(() => import('./pages/Settings').then((module) => ({ default: module.SettingsView })));
const ReportsView = lazy(() => import('./pages/Reports').then((module) => ({ default: module.ReportsView })));
const ClassroomView = lazy(() => import('./pages/Academics').then((module) => ({ default: module.ClassroomView })));
const FinanceView = lazy(() => import('./pages/Finance').then((module) => ({ default: module.FinanceView })));
const TimetableStudio = lazy(() => import('./features/classroom/components/TimetableStudio').then(m => ({ default: m.TimetableStudio })));
const LibraryView = lazy(() => import('./pages/Library').then((module) => ({ default: module.LibraryView })));
const ClinicView = lazy(() => import('./pages/Clinic').then((module) => ({ default: module.ClinicView })));
const HostelView = lazy(() => import('./pages/Hostel').then((module) => ({ default: module.HostelView })));
const ICTView = lazy(() => import('./pages/ICT').then((module) => ({ default: module.ICTView })));
const TuckshopView = lazy(() => import('./pages/Tuckshop').then((module) => ({ default: module.TuckshopView })));
const OpportunitiesView = lazy(() => import('./pages/Opportunities').then((module) => ({ default: module.OpportunitiesView })));
const GrowthPartnersView = lazy(() => import('./pages/GrowthPartners').then((module) => ({ default: module.GrowthPartnersView })));
const NotificationsPage = lazy(() => import('./pages/Notifications').then((module) => ({ default: module.NotificationsPage })));
const TeacherDashboard = lazy(() => import('./features/teacher/components/TeacherDashboard'));
const AttendanceModule = lazy(() => import('./features/attendance/components/AttendanceModule'));
const CreateLessonPlan = lazy(() => import('./features/plans/components/CreateLessonPlan'));
const UploadLessonPlan = lazy(() => import('./features/plans/components/UploadLessonPlan'));
const MessagingModule = lazy(() => import('./features/messaging/components/MessagingModule'));
const AdsManagement = lazy(() => import('./pages/AdsManagement').then((module) => ({ default: module.default })));
const ScoreSheetView = lazy(() => import('./pages/ScoreSheet').then((module) => ({ default: module.ScoreSheetView })));
const StaffTrainingView = lazy(() => import('./pages/StaffTraining').then((module) => ({ default: module.StaffTrainingView })));
const SchoolFileSharingView = lazy(() => import('./pages/SchoolFileSharing').then((module) => ({ default: module.SchoolFileSharingView })));
const ProfileManagerView = lazy(() => import('./pages/ProfileManager').then((module) => ({ default: module.default })));
const SchoolHistoryView = lazy(() => import('./pages/SchoolHistory').then((module) => ({ default: module.SchoolHistoryView })));
const MarketplaceView = lazy(() => import('./pages/Marketplace').then((module) => ({ default: module.MarketplaceView })));
const PayslipsView = lazy(() => import('./pages/Payslips').then((module) => ({ default: module.PayslipsView })));

const DutyReport = lazy(() => import('./features/reports/components/DutyReport').then((module) => ({ default: module.default })));
function PageLoader() {
  return (
    <div className="glass-card-soft rounded-4xl border border-white/10 p-5 text-sm" style={{ color: 'var(--app-muted)' }}>
      Loading workspace…
    </div>
  );
}

// --- Main App ---

export default function App() {
  const [activeChildId, setActiveChildId] = useState<string | null>(() => localStorage.getItem('activeChildId') || null);
  useEffect(() => {
    const handleChildSelected = (e: any) => {
      setActiveChildId(e.detail);
      localStorage.setItem('activeChildId', e.detail);
      window.location.href = '/classroom';
    };
    window.addEventListener('child-selected', handleChildSelected);
    return () => window.removeEventListener('child-selected', handleChildSelected);
  }, []);
  const SIDEBAR_OPEN_BREAKPOINT = 768;
  const location = useLocation();
  const navigate = useNavigate();
  const isPublicTutorialsRoute = location.pathname === '/tutorials';
  const isPublicLegalRoute = location.pathname === '/privacy-policy' || location.pathname === '/terms-of-service';
  const isPublicSignInRoute = location.pathname === '/signin';
  const isRootRoute = location.pathname === '/' || location.pathname === '';

  const openPublicSignIn = () => {
    setShowAuth(false);
    navigate('/signin');
  };

  const getDefaultTabForRole = (role: Role) => role === 'Student' ? 'classroom' : role === 'Alumni' ? 'classroom' : role === 'Parent' ? 'dashboard' : role === 'Growth Partner' ? 'growth' : 'dashboard';
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [currentRole, setCurrentRole] = useState<Role>('HoS');
  const [currentUser, setCurrentUser] = useState<StoredUser | undefined>(undefined);
  // activeTab derived from route
  const activeTab = location.pathname.split('/')[1] || getDefaultTabForRole(currentRole);
  const setActiveTab = (tab: string) => navigate(`/${tab}`);
  // activeSubView derived from route
  const activeSubView = location.pathname.includes('/create-lesson-plan')
    ? 'create-lesson-plan'
    : location.pathname.includes('/upload-lesson-plan')
      ? 'upload-lesson-plan'
      : null;
  const setActiveSubView = (sub: string | null) => navigate(sub ? `/classroom/${sub}` : `/${activeTab}`);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { toasts, showToast, removeToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('ndovera_theme_mode') as 'light' | 'dark') || 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    let frameId = 0;
    const handleResize = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        setIsSidebarOpen(window.innerWidth >= SIDEBAR_OPEN_BREAKPOINT);
      });
    };
    handleResize();
    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [SIDEBAR_OPEN_BREAKPOINT]);

  const handleLogin = (user: StoredUser) => {
    setStoredActiveSchoolId(user.activeSchoolId || user.schoolId || null)
    try { localStorage.setItem('ndovera_user', JSON.stringify(user)) } catch (e) {}
    setCurrentRole((user.activeRole || user.roles[0] || 'HoS') as Role)
    setCurrentUser(user);
    setIsLoggedIn(true);
    showToast('Successfully signed in.', 'success');
  };

  const reloadCurrentUser = async () => {
    try {
      const user = await fetchWithAuth('/api/users/me') as StoredUser
      setCurrentUser(user)
      setCurrentRole((user.activeRole || user.roles[0] || 'HoS') as Role)
      setIsLoggedIn(true)
      if (!getStoredActiveSchoolId()) {
        setStoredActiveSchoolId(user.activeSchoolId || user.schoolId || null)
      }
      try { localStorage.setItem('ndovera_user', JSON.stringify(user)) } catch (e) {}
      if (user?.activeRole && isRootRoute) {
        navigate(`/${getDefaultTabForRole(user.activeRole)}`, { replace: true })
      }
      return user
    } catch (error) {
      const status = typeof error === 'object' && error && 'status' in error ? Number((error as any).status) : undefined
      const message = error instanceof Error ? error.message : ''
      if (status === 403 && message.toLowerCase().includes('selected school')) {
        clearStoredActiveSchoolId()
        const user = await fetchWithAuth('/api/users/me') as StoredUser
        setCurrentUser(user)
        setCurrentRole((user.activeRole || user.roles[0] || 'HoS') as Role)
        setIsLoggedIn(true)
        setStoredActiveSchoolId(user.activeSchoolId || user.schoolId || null)
        try { localStorage.setItem('ndovera_user', JSON.stringify(user)) } catch (e) {}
        return user
      }
      setIsLoggedIn(false)
      throw error
    }
  }

  const openSchoolRegistration = () => {
    try {
      sessionStorage.setItem('ndovera_open_register_school', '1');
    } catch {}
    setShowAuth(false);
    navigate('/', { replace: false });
  };

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const user = await reloadCurrentUser()
        if (!mounted) return
      } catch {
        if (!mounted) return
        setIsLoggedIn(false)
      }
    })()
    return () => { mounted = false }
  }, [isRootRoute, navigate])

  useEffect(() => {
    const handleSchoolContextRefresh = () => {
      void reloadCurrentUser().catch(() => undefined)
    }
    window.addEventListener(ACTIVE_SCHOOL_CHANGED_EVENT, handleSchoolContextRefresh)
    return () => window.removeEventListener(ACTIVE_SCHOOL_CHANGED_EVENT, handleSchoolContextRefresh)
  }, [isRootRoute, navigate])

  useEffect(() => {
    const currentPath = location.pathname;
    // Catch the broken URL literal and fix it automatically
    if (currentPath.includes('prev%20=')) {
      navigate('/classroom', { replace: true });
      return;
    }
    
    if (currentRole === 'Student' || currentRole === 'Alumni') {
      const pathSegment = currentPath.split('/')[1] || '';
      if (pathSegment === 'dashboard' || pathSegment === 'academics') {
        navigate('/classroom', { replace: true });
      }
    }
  }, [currentRole, location.pathname, navigate]);

  useEffect(() => {
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(themeMode === 'light' ? 'theme-light' : 'theme-dark');
    try {
      localStorage.setItem('ndovera_theme_mode', themeMode);
    } catch {}
  }, [themeMode]);

  const SUPER_ROLES: Role[] = ['Ami']

  if (isPublicLegalRoute) {
    return (
      <Suspense fallback={<PageLoader />}>
        <LandingPage onLogin={openPublicSignIn} initialPublicPageId={location.pathname === '/terms-of-service' ? 'terms-of-service' : 'privacy-policy'} />
      </Suspense>
    );
  }

  // If user switched to a global/super role, block school UI and point them to the super-admin app
  if (isLoggedIn && SUPER_ROLES.includes(currentRole)) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0A0B0D]">
        <div className="max-w-lg p-8 bg-[#151619] rounded-2xl border border-white/5 text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Super Admin Mode Detected</h2>
          <p className="text-zinc-400 mb-4">You are currently acting as a global/system administrator. School dashboards are restricted for this role to prevent accidental access to tenant data.</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.open(SUPER_ADMIN_URL, '_blank')}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold"
            >Open Super Admin App</button>
          </div>
        </div>
      </div>
    )
  }

  const renderContent = () => {
    return (
      <Routes>
        <Route path="/" element={<Navigate to={`/${getDefaultTabForRole(currentRole)}`} replace />} />
        <Route path="/classroom/create-lesson-plan" element={<CreateLessonPlan goBack={() => setActiveSubView(null)} />} />
        <Route path="/classroom/upload-lesson-plan" element={<UploadLessonPlan goBack={() => setActiveSubView(null)} />} />
        <Route path="/dashboard" element={<DashboardHome role={currentRole} setActiveTab={setActiveTab} />} />
        <Route path="/aptitude" element={<AptitudeTests role={currentRole} />} />
        <Route path="/aurabooster" element={<AuraBoosterView role={currentRole} />} />
        <Route path="/farming" element={<FarmingView role={currentRole} />} />
        <Route path="/website" element={<WebsiteBuilder />} />
        <Route path="/management" element={<ManagementView />} />
        <Route path="/tutorials" element={<TutorialsView />} />
        <Route path="/championships" element={<ChampionshipsView role={currentRole} />} />
        <Route path="/academics" element={<ClassroomView role={currentRole} setActiveSubView={setActiveSubView} currentUser={currentUser} />} />
        <Route path="/classroom" element={<ClassroomView role={currentRole} setActiveSubView={setActiveSubView} currentUser={currentUser} />} />
        <Route path="/attendance" element={<AttendanceModule role={currentRole} />} />
        <Route path="/scoresheet" element={<ScoreSheetView role={currentRole} />} />
        <Route path="/timetable" element={<TimetableStudio role={currentRole} />} />
        <Route path="/finance" element={<FinanceView role={currentRole} />} />
        <Route path="/library" element={<LibraryView role={currentRole} />} />
        <Route path="/clinic" element={<ClinicView role={currentRole} />} />
        <Route path="/hostel" element={<HostelView role={currentRole} />} />
        <Route path="/ict" element={<ICTView role={currentRole} />} />
        <Route path="/tuckshop" element={<TuckshopView role={currentRole} />} />
        <Route path="/opportunities" element={<OpportunitiesView role={currentRole} />} />
        <Route path="/growth" element={<GrowthPartnersView role={currentRole} />} />
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="/communication" element={<CommunicationHub role={currentRole} />} />
        <Route path="/chat" element={<MessagingModule role={currentRole} />} />
        <Route path="/file-sharing" element={<SchoolFileSharingView role={currentRole} />} />
        <Route path="/school-history" element={<SchoolHistoryView role={currentRole} />} />
        <Route path="/marketplace" element={<MarketplaceView />} />
        <Route path="/payslips" element={<PayslipsView />} />
        <Route path="/staff-training" element={<StaffTrainingView role={currentRole} />} />
        <Route path="/reports" element={<ReportsView />} />
        <Route path="/duty-report" element={<DutyReport />} />
        <Route path="/profile-manager" element={<ProfileManagerView />} />
        <Route path="/evaluations" element={<ReportsView />} />
        <Route path="/settings" element={<SettingsView role={currentRole} />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/ads-management" element={<AdsManagement />} />
        <Route path="*" element={
          <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-600">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4 border border-white/5">
              <Settings size={32} />
            </div>
            <h3 className="text-lg font-bold text-zinc-300">Module Under Construction</h3>
            <p className="text-xs">The {activeTab} module is being refined for this workspace.</p>
          </div>
        } />
      </Routes>
    );
  };

  if (!isLoggedIn) {
    if (isPublicTutorialsRoute) {
      return (
        <>
          <div className="min-h-screen bg-[#0A0B0D] p-4 md:p-6">
            <Suspense fallback={<PageLoader />}>
              <TutorialsView publicMode />
            </Suspense>
          </div>
          <ToastContainer toasts={toasts} removeToast={removeToast} />
        </>
      );
    }
    if (isPublicLegalRoute) {
      return (
        <Suspense fallback={<PageLoader />}>
          <LandingPage onLogin={openPublicSignIn} initialPublicPageId={location.pathname === '/terms-of-service' ? 'terms-of-service' : 'privacy-policy'} />
        </Suspense>
      );
    }
    if (isPublicSignInRoute) {
      return (
        <>
          <Suspense fallback={<PageLoader />}>
            <AuthView onLogin={handleLogin} onBack={() => navigate('/')} onRegisterSchool={openSchoolRegistration} />
          </Suspense>
          <ToastContainer toasts={toasts} removeToast={removeToast} />
        </>
      );
    }
    if (showAuth) {
      return (
        <>
          <Suspense fallback={<PageLoader />}>
            <AuthView onLogin={handleLogin} onBack={() => setShowAuth(false)} onRegisterSchool={openSchoolRegistration} />
          </Suspense>
          <ToastContainer toasts={toasts} removeToast={removeToast} />
        </>
      );
    }
    return (
      <Suspense fallback={<PageLoader />}>
        <LandingPage onLogin={openPublicSignIn} />
      </Suspense>
    );
  }

  return (
    <>
      {currentRole === 'Parent' && activeChildId && (
        <button
          onClick={() => {
            setActiveChildId(null);
            localStorage.removeItem('activeChildId');
            window.location.href = '/dashboard';
          }}
          className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white rounded-full p-4 shadow-xl flex items-center justify-center hover:bg-emerald-500 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"> <path d="m12 19-7-7 7-7"/> <path d="M19 12H5"/> </svg>
          <span className="ml-2 font-bold whitespace-nowrap">Back to Wards</span>
        </button>
      )}
      <Layout
        currentRole={currentRole}
        activeTab={activeTab}
        activeSubView={activeSubView}
        setActiveTab={setActiveTab}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        themeMode={themeMode}
        setThemeMode={setThemeMode}
        onSchoolContextRefresh={async () => {
          await reloadCurrentUser();
        }}
      >
        <AppErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            {renderContent()}
          </Suspense>
        </AppErrorBoundary>
      </Layout>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  );
}
