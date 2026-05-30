import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Loader from './shared/components/Loader';
import Sidebar from './shared/components/Sidebar';
import DashboardTopBar from './shared/components/DashboardTopBar';
import Classroom from './app/Classroom';
import Assignments from './app/Assignments';
import Exams from './app/Exams';
import ExamCreator from './features/exams/ExamCreator';
import AITutor from './app/AITutor';
import Attendance from './app/Attendance';
import Rewards from './app/Rewards';
import Settings from './app/Settings';
import StudentDashboard from './app/roles/StudentDashboard';
import ParentDashboard from './app/roles/ParentDashboard';
import TeacherDashboard from './app/roles/TeacherDashboard';
import TeacherClassroom from './features/classroom/TeacherClassroom';
import HoSDashboard from './app/roles/HoSDashboard';
import AccountantDashboard from './app/roles/AccountantDashboard';
import AdminDashboard from './app/roles/AdminDashboard';
import OwnerDashboard from './app/roles/OwnerDashboard';
import AmiDashboard from './app/roles/AmiDashboard';
import OperationalRoleDashboard from './app/roles/OperationalRoleDashboard';
import StudentClassroom from './app/roles/student/StudentClassroom';
import StudentAssignments from './app/roles/student/StudentAssignments';
import StudentLessonNotes from './app/roles/student/StudentLessonNotes';
import StudentPractice from './app/roles/student/StudentPractice';
import StudentExams from './app/roles/student/StudentExams';
import StudentResults from './app/roles/student/StudentResults';
import StudentAttendance from './app/roles/student/StudentAttendance';
import StudentTuckShop from './app/roles/student/StudentTuckShop';
import StaffTuckShop from './app/roles/teacher/StaffTuckShop';
import StudentProfessorAura from './app/roles/student/StudentProfessorAura';
import StudentMessaging from './app/roles/student/StudentMessaging';
import StudentSettings from './app/roles/student/StudentSettings';
import LessonPlanViewerPage from './features/lesson-plans/LessonPlanViewerPage';
import RoleLibrary from './app/RoleLibrary';
import AmiInbox from './app/roles/ami/AmiInbox';
import LoginPage from './features/auth/pages/LoginPage';
import ChangePasswordPage from './features/auth/pages/ChangePasswordPage';
import ResetPasswordPage from './features/auth/pages/ResetPasswordPage';
import SchoolRegistrationPage from './features/tenants/pages/SchoolRegistrationPage';
import PublicHomePage from './features/public/pages/PublicHomePage';
import PublicSitePage from './features/public/pages/PublicSitePage';
import { buildSelectedRoleHeader, clearStoredAuth, consumeTenantReturnUrlFromLocation, getSignedOutRedirectPath, getStoredAuth, persistAuth, syncRefreshedToken } from './features/auth/services/authApi';
import { useTenantPwaManifest } from './shared/hooks/useTenantPwaManifest';
import { getApiUrl } from './config/apiBase';
import './App.css';

const PUBLIC_ROUTE_PATHS = new Set([
  '/',
  '/about',
  '/mission',
  '/vision',
  '/mission-vision',
  '/growth-partners',
  '/partners',
  '/tutor',
  '/pricing',
  '/opportunities',
  '/events',
  '/events-gallery',
  '/gallery',
  '/login',
  '/reset-password',
  '/register-school',
  '/change-password',
]);

function normalizePublicPath(pathname) {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function getAccessibleRoles(auth) {
  const roles = new Set();

  (auth?.user?.roles || []).forEach(role => {
    if (role) roles.add(role);
  });

  (auth?.user?.switchableRoles || []).forEach(role => {
    if (role) roles.add(role);
  });

  if (auth?.user?.role) {
    roles.add(auth.user.role);
  }

  if (roles.has('headteacher') && !roles.has('nurseryhead')) {
    roles.add('nurseryhead');
  }

  return Array.from(roles);
}

function getAuthenticatedRole(auth) {
  const switchableRoles = Array.isArray(auth?.user?.switchableRoles) && auth.user.switchableRoles.length > 0
    ? auth.user.switchableRoles
    : [auth?.user?.role || 'student'];
  const storedRole = window.localStorage.getItem('selectedRole');

  if (storedRole && switchableRoles.includes(storedRole)) {
    return storedRole;
  }

  if (switchableRoles.includes(auth?.user?.role)) {
    return auth.user.role;
  }

  if (switchableRoles.includes('admin') && Array.isArray(auth?.user?.adminRoles) && auth.user.adminRoles.includes(auth?.user?.role)) {
    return 'admin';
  }

  return switchableRoles[0] || auth?.user?.role || 'student';
}

function RouteTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.995 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}

function RequireAuth({ auth, children }) {
  const location = useLocation();

  if (!auth?.token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

function RoleGuard({ expectedRole, auth, children }) {
  const authRole = getAuthenticatedRole(auth);
  const accessibleRoles = getAccessibleRoles(auth);

  if (!auth?.token) {
    return <Navigate to="/login" replace />;
  }

  if (!accessibleRoles.includes(expectedRole)) {
    return <Navigate to={`/roles/${authRole}`} replace />;
  }

  return children;
}

function AnimatedRoutes({ auth, onLogin }) {
  const location = useLocation();
  const authRole = getAuthenticatedRole(auth);
  const defaultAppRoute = auth?.token ? `/roles/${authRole}` : '/';

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PublicHomePage />} />
        <Route path="/about" element={<PublicSitePage pageKey="about" />} />
        <Route path="/mission" element={<PublicSitePage pageKey="mission" />} />
        <Route path="/vision" element={<PublicSitePage pageKey="vision" />} />
        <Route path="/mission-vision" element={<PublicSitePage pageKey="mission" />} />
        <Route path="/growth-partners" element={<PublicSitePage pageKey="partners" />} />
        <Route path="/partners" element={<PublicSitePage pageKey="partners" />} />
        <Route path="/tutor" element={<PublicSitePage pageKey="tutor" />} />
        <Route path="/pricing" element={<PublicSitePage pageKey="pricing" />} />
        <Route path="/opportunities" element={<PublicSitePage pageKey="opportunities" />} />
        <Route path="/events" element={<PublicSitePage pageKey="events" />} />
        <Route path="/events-gallery" element={<PublicSitePage pageKey="events" />} />
        <Route path="/gallery" element={<PublicSitePage pageKey="gallery" />} />
        <Route path="/login" element={auth?.token ? <Navigate to={defaultAppRoute} replace /> : <LoginPage onLogin={onLogin} />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/register-school" element={<SchoolRegistrationPage />} />
        <Route path="/change-password" element={<ChangePasswordPage onLogin={onLogin} />} />
        <Route path="/classroom" element={<RequireAuth auth={auth}><RouteTransition><Classroom /></RouteTransition></RequireAuth>} />
        <Route path="/assignments" element={<RequireAuth auth={auth}><RouteTransition><Assignments /></RouteTransition></RequireAuth>} />
        <Route path="/exams" element={<RequireAuth auth={auth}><RouteTransition><Exams /></RouteTransition></RequireAuth>} />
        <Route path="/exams/create" element={<RequireAuth auth={auth}><RouteTransition><ExamCreator /></RouteTransition></RequireAuth>} />
        <Route path="/ai-tutor" element={<RequireAuth auth={auth}><RouteTransition><AITutor /></RouteTransition></RequireAuth>} />
        <Route path="/attendance" element={<RequireAuth auth={auth}><RouteTransition><Attendance /></RouteTransition></RequireAuth>} />
        <Route path="/rewards" element={<RequireAuth auth={auth}><RouteTransition><Rewards /></RouteTransition></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth auth={auth}><RouteTransition><Settings /></RouteTransition></RequireAuth>} />
        <Route path="/roles/student" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentDashboard /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/classroom" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentClassroom /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/assignments" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentAssignments /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/assignments/:assignmentId" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentAssignments /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/materials" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentLessonNotes /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/lesson-notes" element={<Navigate to="/roles/student/materials" replace />} />
        <Route path="/roles/student/lesson-plans" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><LessonPlanViewerPage /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/practice" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentPractice /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/exams" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentExams /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/results" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentResults /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/attendance" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentAttendance /></RouteTransition></RoleGuard>} />
        {/* role-specific library view */}
        <Route path="/roles/:role/library" element={<RequireAuth auth={auth}><RouteTransition><RoleLibrary /></RouteTransition></RequireAuth>} />
        {/* teacher resource old path -> library redirect to new role path */}
        <Route path="/roles/teacher/resources" element={<Navigate to="/roles/teacher/library" replace />} />
        <Route path="/roles/student/tuck-shop" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentTuckShop /></RouteTransition></RoleGuard>} />
        <Route path="/roles/teacher/tuck-shop" element={<RoleGuard auth={auth} expectedRole="teacher"><RouteTransition><StaffTuckShop /></RouteTransition></RoleGuard>} />
        <Route path="/roles/teacher/messaging" element={<RoleGuard auth={auth} expectedRole="teacher"><RouteTransition><StudentMessaging viewerRole="teacher" dashboardLabel="Teacher Dashboard" title="Messaging" subtitle="A clean school chat workspace for students, parents, staff, school admins, and helpdesk support." /></RouteTransition></RoleGuard>} />
        <Route path="/roles/classteacher/tuck-shop" element={<RoleGuard auth={auth} expectedRole="classteacher"><RouteTransition><StaffTuckShop /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/professor-vera" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentProfessorAura /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/messaging" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentMessaging /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/newsroom" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentDashboard /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/settings" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentSettings /></RouteTransition></RoleGuard>} />
        <Route path="/roles/parent/*" element={<RoleGuard auth={auth} expectedRole="parent"><RouteTransition><ParentDashboard /></RouteTransition></RoleGuard>} />
        <Route path="/roles/caregiver/*" element={<RoleGuard auth={auth} expectedRole="caregiver"><RouteTransition><OperationalRoleDashboard roleKey="caregiver" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/teacher/classroom" element={<RoleGuard auth={auth} expectedRole="teacher"><RouteTransition><TeacherClassroom /></RouteTransition></RoleGuard>} />
        <Route path="/roles/teacher/*" element={<RoleGuard auth={auth} expectedRole="teacher"><RouteTransition><TeacherDashboard /></RouteTransition></RoleGuard>} />
        <Route path="/roles/hos/*" element={<RoleGuard auth={auth} expectedRole="hos"><RouteTransition><HoSDashboard /></RouteTransition></RoleGuard>} />
        <Route path="/roles/admin/*" element={<RoleGuard auth={auth} expectedRole="admin"><RouteTransition><AdminDashboard auth={auth} /></RouteTransition></RoleGuard>} />
        <Route path="/roles/accountant/*" element={<RoleGuard auth={auth} expectedRole="accountant"><RouteTransition><AccountantDashboard /></RouteTransition></RoleGuard>} />
        <Route path="/roles/owner/*" element={<RoleGuard auth={auth} expectedRole="owner"><RouteTransition><OwnerDashboard auth={auth} /></RouteTransition></RoleGuard>} />
        <Route path="/roles/librarian/*" element={<RoleGuard auth={auth} expectedRole="librarian"><RouteTransition><OperationalRoleDashboard roleKey="librarian" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/sanitation/*" element={<RoleGuard auth={auth} expectedRole="sanitation"><RouteTransition><OperationalRoleDashboard roleKey="sanitation" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/tuckshopmanager/*" element={<RoleGuard auth={auth} expectedRole="tuckshopmanager"><RouteTransition><OperationalRoleDashboard roleKey="tuckshopmanager" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/storekeeper/*" element={<RoleGuard auth={auth} expectedRole="storekeeper"><RouteTransition><OperationalRoleDashboard roleKey="storekeeper" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/transport/*" element={<RoleGuard auth={auth} expectedRole="transport"><RouteTransition><OperationalRoleDashboard roleKey="transport" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/hostel/*" element={<RoleGuard auth={auth} expectedRole="hostel"><RouteTransition><OperationalRoleDashboard roleKey="hostel" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/cafeteria/*" element={<RoleGuard auth={auth} expectedRole="cafeteria"><RouteTransition><OperationalRoleDashboard roleKey="cafeteria" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/clinic/*" element={<RoleGuard auth={auth} expectedRole="clinic"><RouteTransition><OperationalRoleDashboard roleKey="clinic" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/ict/*" element={<RoleGuard auth={auth} expectedRole="ict"><RouteTransition><OperationalRoleDashboard roleKey="ict" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/classteacher/*" element={<RoleGuard auth={auth} expectedRole="classteacher"><RouteTransition><OperationalRoleDashboard roleKey="classteacher" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/hod/*" element={<RoleGuard auth={auth} expectedRole="hod"><RouteTransition><OperationalRoleDashboard roleKey="hod" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/hodassistant/*" element={<RoleGuard auth={auth} expectedRole="hodassistant"><RouteTransition><OperationalRoleDashboard roleKey="hodassistant" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/principal/*" element={<RoleGuard auth={auth} expectedRole="principal"><RouteTransition><OperationalRoleDashboard roleKey="principal" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/headteacher/*" element={<RoleGuard auth={auth} expectedRole="headteacher"><RouteTransition><OperationalRoleDashboard roleKey="headteacher" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/nurseryhead/*" element={<RoleGuard auth={auth} expectedRole="nurseryhead"><RouteTransition><OperationalRoleDashboard roleKey="nurseryhead" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/examofficer/*" element={<RoleGuard auth={auth} expectedRole="examofficer"><RouteTransition><OperationalRoleDashboard roleKey="examofficer" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/sportsmaster/*" element={<RoleGuard auth={auth} expectedRole="sportsmaster"><RouteTransition><OperationalRoleDashboard roleKey="sportsmaster" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/ami/messaging" element={<RoleGuard auth={auth} expectedRole="ami"><RouteTransition><AmiInbox /></RouteTransition></RoleGuard>} />
        <Route path="/roles/ami/*" element={<RoleGuard auth={auth} expectedRole="ami"><RouteTransition><AmiDashboard /></RouteTransition></RoleGuard>} />
        <Route path="*" element={<Navigate to={defaultAppRoute} replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function AppWorkspace({ auth, onLogin, onLogout }) {
  const location = useLocation();
  useTenantPwaManifest(auth);
  const normalizedPath = normalizePublicPath(location.pathname);
  const isPublicRoute = PUBLIC_ROUTE_PATHS.has(normalizedPath);
  const inDashboardMode = location.pathname.startsWith('/roles/');
  const inStudentClassroom = location.pathname.startsWith('/roles/student/classroom');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const handleCloseSidebar = useCallback(() => setIsSidebarOpen(false), []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setIsSidebarOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobile || !isSidebarOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobile, isSidebarOpen]);

  const mobileClassroomMode = inStudentClassroom && isMobile;

  if (isPublicRoute) {
    return <AnimatedRoutes auth={auth} onLogin={onLogin} />;
  }

  return (
    <div className="flex h-screen overflow-hidden text-slate-900 dark:text-slate-100 transition-colors duration-500 dashboard-bg dark:bg-slate-950">
      {!mobileClassroomMode && <Sidebar mobileOpen={isSidebarOpen} onClose={handleCloseSidebar} />}
      <main className={`flex-1 min-h-0 relative ${inStudentClassroom ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'}`}>
        {inDashboardMode && !mobileClassroomMode && (
          <DashboardTopBar
            authUser={auth?.user}
            onLogout={onLogout}
            onToggleSidebar={() => setIsSidebarOpen(open => !open)}
            isSidebarOpen={isSidebarOpen}
          />
        )}
        <AnimatedRoutes auth={auth} onLogin={onLogin} />
      </main>
    </div>
  );
}

function App() {
  const [loading, setLoading] = useState(true);
  const [auth, setAuth] = useState(() => getStoredAuth());
  const hydrationInFlightRef = useRef(false);

  useEffect(() => {
    // Check initial system/localStorage theme
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  useEffect(() => {
	consumeTenantReturnUrlFromLocation();

    let cancelled = false;
    async function hydrateSession({ initial = false } = {}) {
      const stored = getStoredAuth();
      if (!stored?.token) {
        if (!cancelled) {
          setAuth(null);
          if (initial) setLoading(false);
        }
        return;
      }

      if (!stored?.needsHydration) {
        if (!cancelled) {
          setAuth(stored);
          if (initial) setLoading(false);
        }
        return;
      }

      if (hydrationInFlightRef.current) {
        if (!cancelled && initial) {
          setLoading(false);
        }
        return;
      }

      hydrationInFlightRef.current = true;
      try {
        try {
          const res = await fetch(getApiUrl('/api/users/me'), {
            credentials: 'include',
            headers: {
              Authorization: `Bearer ${stored.token}`,
              ...buildSelectedRoleHeader(),
            },
          });
          syncRefreshedToken(res);
          if (res.status === 401) {
            clearStoredAuth();
            if (!cancelled) {
              setAuth(null);
              if (initial) setLoading(false);
              window.location.replace(getSignedOutRedirectPath());
            }
            return;
          }
          const data = await res.json().catch(() => ({}));
          if (res.ok && data?.user && !cancelled) {
            const nextAuth = persistAuth({ token: stored.token, user: data.user }, { preserveSelectedRole: true });
            setAuth(nextAuth);
          } else if (!cancelled) {
            setAuth(stored);
          }
        } catch {
          // Keep the existing token state; guarded pages will redirect if it is invalid.
          if (!cancelled) {
            setAuth(stored);
          }
        }
      } finally {
        hydrationInFlightRef.current = false;
        if (!cancelled && initial) setLoading(false);
      }
    }

    function handleSessionResume() {
      if (document.visibilityState === 'hidden') return;
      hydrateSession();
    }

    const timer = setTimeout(() => hydrateSession({ initial: true }), 500);
    window.addEventListener('focus', handleSessionResume);
    document.addEventListener('visibilitychange', handleSessionResume);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener('focus', handleSessionResume);
      document.removeEventListener('visibilitychange', handleSessionResume);
    };
  }, []);

  if (loading) {
    return <Loader />;
  }

  const handleLogin = nextAuth => {
    setAuth(nextAuth);
  };

  const handleLogout = () => {
    clearStoredAuth();
    setAuth(null);
    window.location.replace(getSignedOutRedirectPath());
  };

  return (
    <Router>
      <AppWorkspace auth={auth} onLogin={handleLogin} onLogout={handleLogout} />
    </Router>
  );
}

export default App;
