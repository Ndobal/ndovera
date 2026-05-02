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

function getSelectedRole() {
  const storedRole = localStorage.getItem('selectedRole');
  if (storedRole && VALID_ROLES.includes(storedRole)) {
    return storedRole;
  }

  localStorage.setItem('selectedRole', 'student');
  return 'student';
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

function RoleGuard({ expectedRole, children }) {
  const activeRole = getSelectedRole();

  if (activeRole !== expectedRole) {
    return <Navigate to={`/roles/${activeRole}`} replace />;
  }

  return children;
}

function AnimatedRoutes() {
  const location = useLocation();
  const selectedRole = getSelectedRole();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Navigate to={`/roles/${selectedRole}`} replace />} />
        <Route path="/classroom" element={<RouteTransition><Classroom /></RouteTransition>} />
        <Route path="/assignments" element={<RouteTransition><Assignments /></RouteTransition>} />
        <Route path="/exams" element={<RouteTransition><Exams /></RouteTransition>} />
        <Route path="/exams/create" element={<RouteTransition><ExamCreator /></RouteTransition>} />
        <Route path="/ai-tutor" element={<RouteTransition><AITutor /></RouteTransition>} />
        <Route path="/attendance" element={<RouteTransition><Attendance /></RouteTransition>} />
        <Route path="/rewards" element={<RouteTransition><Rewards /></RouteTransition>} />
        <Route path="/settings" element={<RouteTransition><Settings /></RouteTransition>} />
        <Route path="/roles/student" element={<RoleGuard expectedRole="student"><RouteTransition><StudentDashboard /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/classroom" element={<RoleGuard expectedRole="student"><RouteTransition><StudentClassroom /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/assignments" element={<RoleGuard expectedRole="student"><RouteTransition><StudentAssignments /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/assignments/:assignmentId" element={<RoleGuard expectedRole="student"><RouteTransition><StudentAssignments /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/materials" element={<RoleGuard expectedRole="student"><RouteTransition><StudentLessonNotes /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/lesson-notes" element={<Navigate to="/roles/student/materials" replace />} />
        <Route path="/roles/student/practice" element={<RoleGuard expectedRole="student"><RouteTransition><StudentPractice /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/exams" element={<RoleGuard expectedRole="student"><RouteTransition><StudentExams /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/results" element={<RoleGuard expectedRole="student"><RouteTransition><StudentResults /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/attendance" element={<RoleGuard expectedRole="student"><RouteTransition><StudentAttendance /></RouteTransition></RoleGuard>} />
        {/* role-specific library view */}
        <Route path="/roles/:role/library" element={<RouteTransition><RoleLibrary /></RouteTransition>} />
        {/* teacher resource old path -> library redirect to new role path */}
        <Route path="/roles/teacher/resources" element={<Navigate to="/roles/teacher/library" replace />} />
        <Route path="/roles/student/tuck-shop" element={<RoleGuard expectedRole="student"><RouteTransition><StudentTuckShop /></RouteTransition></RoleGuard>} />
        <Route path="/roles/teacher/tuck-shop" element={<RoleGuard expectedRole="teacher"><RouteTransition><StaffTuckShop /></RouteTransition></RoleGuard>} />
        <Route path="/roles/teacher/messaging" element={<RoleGuard expectedRole="teacher"><RouteTransition><TeacherMessaging /></RouteTransition></RoleGuard>} />
        <Route path="/roles/classteacher/tuck-shop" element={<RoleGuard expectedRole="classteacher"><RouteTransition><StaffTuckShop /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/professor-vera" element={<RoleGuard expectedRole="student"><RouteTransition><StudentProfessorAura /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/messaging" element={<RoleGuard expectedRole="student"><RouteTransition><StudentMessaging /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/settings" element={<RoleGuard expectedRole="student"><RouteTransition><StudentSettings /></RouteTransition></RoleGuard>} />
        <Route path="/roles/parent/*" element={<RoleGuard expectedRole="parent"><RouteTransition><ParentDashboard /></RouteTransition></RoleGuard>} />
        <Route path="/roles/teacher/classroom" element={<RoleGuard expectedRole="teacher"><RouteTransition><TeacherClassroom /></RouteTransition></RoleGuard>} />
        <Route path="/roles/teacher/*" element={<RoleGuard expectedRole="teacher"><RouteTransition><TeacherDashboard /></RouteTransition></RoleGuard>} />
        <Route path="/roles/hos/*" element={<RoleGuard expectedRole="hos"><RouteTransition><HoSDashboard /></RouteTransition></RoleGuard>} />
        <Route path="/roles/accountant/*" element={<RoleGuard expectedRole="accountant"><RouteTransition><AccountantDashboard /></RouteTransition></RoleGuard>} />
        <Route path="/roles/owner/*" element={<RoleGuard expectedRole="owner"><RouteTransition><OwnerDashboard /></RouteTransition></RoleGuard>} />
        <Route path="/roles/librarian/*" element={<RoleGuard expectedRole="librarian"><RouteTransition><OperationalRoleDashboard roleKey="librarian" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/sanitation/*" element={<RoleGuard expectedRole="sanitation"><RouteTransition><OperationalRoleDashboard roleKey="sanitation" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/tuckshopmanager/*" element={<RoleGuard expectedRole="tuckshopmanager"><RouteTransition><OperationalRoleDashboard roleKey="tuckshopmanager" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/storekeeper/*" element={<RoleGuard expectedRole="storekeeper"><RouteTransition><OperationalRoleDashboard roleKey="storekeeper" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/transport/*" element={<RoleGuard expectedRole="transport"><RouteTransition><OperationalRoleDashboard roleKey="transport" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/hostel/*" element={<RoleGuard expectedRole="hostel"><RouteTransition><OperationalRoleDashboard roleKey="hostel" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/cafeteria/*" element={<RoleGuard expectedRole="cafeteria"><RouteTransition><OperationalRoleDashboard roleKey="cafeteria" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/clinic/*" element={<RoleGuard expectedRole="clinic"><RouteTransition><OperationalRoleDashboard roleKey="clinic" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/ict/*" element={<RoleGuard expectedRole="ict"><RouteTransition><OperationalRoleDashboard roleKey="ict" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/classteacher/*" element={<RoleGuard expectedRole="classteacher"><RouteTransition><OperationalRoleDashboard roleKey="classteacher" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/hod/*" element={<RoleGuard expectedRole="hod"><RouteTransition><OperationalRoleDashboard roleKey="hod" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/hodassistant/*" element={<RoleGuard expectedRole="hodassistant"><RouteTransition><OperationalRoleDashboard roleKey="hodassistant" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/principal/*" element={<RoleGuard expectedRole="principal"><RouteTransition><OperationalRoleDashboard roleKey="principal" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/headteacher/*" element={<RoleGuard expectedRole="headteacher"><RouteTransition><OperationalRoleDashboard roleKey="headteacher" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/nurseryhead/*" element={<RoleGuard expectedRole="nurseryhead"><RouteTransition><OperationalRoleDashboard roleKey="nurseryhead" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/examofficer/*" element={<RoleGuard expectedRole="examofficer"><RouteTransition><OperationalRoleDashboard roleKey="examofficer" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/sportsmaster/*" element={<RoleGuard expectedRole="sportsmaster"><RouteTransition><OperationalRoleDashboard roleKey="sportsmaster" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/ami/*" element={<RoleGuard expectedRole="ami"><RouteTransition><OperationalRoleDashboard roleKey="ami" /></RouteTransition></RoleGuard>} />
        <Route path="*" element={<Navigate to={`/roles/${selectedRole}`} replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function AppWorkspace() {
  const location = useLocation();
  const inDashboardMode = location.pathname.startsWith('/roles/');
  const inStudentClassroom = location.pathname.startsWith('/roles/student/classroom');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const mobileClassroomMode = inStudentClassroom && isMobile;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-500">
      {!mobileClassroomMode && <Sidebar />}
      <main className={`flex-1 min-h-0 relative ${inStudentClassroom ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {inDashboardMode && !mobileClassroomMode && <DashboardTopBar />}
        <AnimatedRoutes />
      </main>
    </div>
  );
}

function App() {
  const [loading, setLoading] = useState(true);

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

  return (
    <Router>
      <AppWorkspace />
    </Router>
  );
}

export default App;
