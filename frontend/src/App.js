import React, { useState, useEffect } from 'react';
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
import RoleLibrary from './app/RoleLibrary';
import TeacherMessaging from './app/roles/teacher/TeacherMessaging';
import LoginPage from './features/auth/pages/LoginPage';
import SchoolRegistrationPage from './features/tenants/pages/SchoolRegistrationPage';
import { clearStoredAuth, getStoredAuth } from './features/auth/services/authApi';
import './App.css';

const VALID_ROLES = [
  'student',
  'parent',
  'teacher',
  'hos',
  'accountant',
  'owner',
  'librarian',
  'sanitation',
  'tuckshopmanager',
  'storekeeper',
  'transport',
  'hostel',
  'cafeteria',
  'clinic',
  'ict',
  'classteacher',
  'hod',
  'hodassistant',
  'principal',
  'headteacher',
  'nurseryhead',
  'examofficer',
  'sportsmaster',
  'ami',
];

function getSelectedRole(authRole) {
  if (!authRole) {
    return null;
  }

  const storedRole = localStorage.getItem('selectedRole');
  if (authRole === 'ami' && storedRole && VALID_ROLES.includes(storedRole)) {
    return storedRole;
  }

  localStorage.setItem('selectedRole', authRole);
  return authRole;
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
  const authRole = auth?.user?.role;
  const activeRole = getSelectedRole(authRole);

  if (!auth?.token) {
    return <Navigate to="/login" replace />;
  }

  if (authRole !== 'ami' && activeRole !== expectedRole) {
    return <Navigate to={`/roles/${activeRole}`} replace />;
  }

  return children;
}

function AnimatedRoutes({ auth, onLogin }) {
  const location = useLocation();
  const selectedRole = getSelectedRole(auth?.user?.role) || 'student';
  const defaultAppRoute = auth?.token ? `/roles/${selectedRole}` : '/login';

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Navigate to={defaultAppRoute} replace />} />
        <Route path="/login" element={auth?.token ? <Navigate to={defaultAppRoute} replace /> : <LoginPage onLogin={onLogin} />} />
        <Route path="/register-school" element={<SchoolRegistrationPage />} />
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
        <Route path="/roles/teacher/messaging" element={<RoleGuard auth={auth} expectedRole="teacher"><RouteTransition><TeacherMessaging /></RouteTransition></RoleGuard>} />
        <Route path="/roles/classteacher/tuck-shop" element={<RoleGuard auth={auth} expectedRole="classteacher"><RouteTransition><StaffTuckShop /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/professor-vera" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentProfessorAura /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/messaging" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentMessaging /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/settings" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentSettings /></RouteTransition></RoleGuard>} />
        <Route path="/roles/parent/*" element={<RoleGuard auth={auth} expectedRole="parent"><RouteTransition><ParentDashboard /></RouteTransition></RoleGuard>} />
        <Route path="/roles/teacher/classroom" element={<RoleGuard auth={auth} expectedRole="teacher"><RouteTransition><TeacherClassroom /></RouteTransition></RoleGuard>} />
        <Route path="/roles/teacher/*" element={<RoleGuard auth={auth} expectedRole="teacher"><RouteTransition><TeacherDashboard /></RouteTransition></RoleGuard>} />
        <Route path="/roles/hos/*" element={<RoleGuard auth={auth} expectedRole="hos"><RouteTransition><HoSDashboard /></RouteTransition></RoleGuard>} />
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
        <Route path="/roles/ami/*" element={<RoleGuard auth={auth} expectedRole="ami"><RouteTransition><AmiDashboard /></RouteTransition></RoleGuard>} />
        <Route path="*" element={<Navigate to={defaultAppRoute} replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function AppWorkspace({ auth, onLogin, onLogout }) {
  const location = useLocation();
  const isPublicRoute = location.pathname === '/login' || location.pathname === '/register-school';
  const inDashboardMode = location.pathname.startsWith('/roles/');
  const inStudentClassroom = location.pathname.startsWith('/roles/student/classroom');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const mobileClassroomMode = inStudentClassroom && isMobile;

  if (isPublicRoute) {
    return <AnimatedRoutes auth={auth} onLogin={onLogin} />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-500">
      {!mobileClassroomMode && <Sidebar />}
      <main className={`flex-1 min-h-0 relative ${inStudentClassroom ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {inDashboardMode && !mobileClassroomMode && <DashboardTopBar authUser={auth?.user} onLogout={onLogout} />}
        <AnimatedRoutes auth={auth} onLogin={onLogin} />
      </main>
    </div>
  );
}

function App() {
  const [loading, setLoading] = useState(true);
  const [auth, setAuth] = useState(() => getStoredAuth());

  useEffect(() => {
    // Check initial system/localStorage theme
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(timer);
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
  };

  return (
    <Router>
      <AppWorkspace auth={auth} onLogin={handleLogin} onLogout={handleLogout} />
    </Router>
  );
}

export default App;
