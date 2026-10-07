import React, { useCallback, useEffect, useRef, useState } from 'react';
import AcademicHistory from './features/classroom/AcademicHistory';
import TeacherSubmissionsPage from './features/submissions/TeacherSubmissionsPage';
import SubmissionReviewPage from './features/submissions/SubmissionReviewPage';
import TeacherCompliancePage from './features/compliance/TeacherCompliancePage';
import ClassReportPage from './features/compliance/ClassReportPage';
import CurriculumLibraryPage from './features/material-ai/CurriculumLibraryPage';
import ExamReadinessPage from './features/material-ai/ExamReadinessPage';
import StaffFilePage from './features/staff-file/StaffFilePage';
import StudentFileRoute from './features/students/components/StudentFileRoute';
import { ExamLetterheadPage } from './features/assessments/AiAssessmentStudio';
import { AmiSchoolClosuresPage, ClosureGate, SchoolClosurePage } from './features/school/closure/SchoolClosure';
import { MyStaffEvaluationsPage, StaffEvaluationAdminPage } from './features/evaluations/StaffEvaluationPages';
import SchoolCalendarBoard from './features/school/components/SchoolCalendarBoard';
import { PunctualityWinnerBanner, StaffPunctualityPage } from './features/attendance/punctuality/PunctualityPages';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Loader from './shared/components/Loader';
import Sidebar from './shared/components/Sidebar';
import DashboardTopBar from './shared/components/DashboardTopBar';
import MobileRoleOverviewNav from './shared/components/MobileRoleOverviewNav';
import RoleWithoutDashboard from './shared/components/RoleWithoutDashboard';
import AppErrorBoundary from './shared/components/AppErrorBoundary';
import Classroom from './app/Classroom';
import Assignments from './app/Assignments';
import Exams from './app/Exams';
import ExamCreator from './features/exams/ExamCreator';
import AITutor from './app/AITutor';
import Attendance from './app/Attendance';
import Rewards from './app/Rewards';
import NewsFeedPage from './shared/components/NewsFeedPage';
import Settings from './app/Settings';
import StudentDashboard from './app/roles/StudentDashboard';
import ParentDashboard from './app/roles/ParentDashboard';
import TeacherDashboard from './app/roles/TeacherDashboard';
import TeacherClassroom from './features/classroom/TeacherClassroom';
import HoSDashboard from './app/roles/HoSDashboard';
import AccountantDashboard from './app/roles/AccountantDashboard';
import AdminDashboard from './app/roles/AdminDashboard';
import OwnerDashboard from './app/roles/OwnerDashboard';
import GrowthPartnerDashboard from './app/roles/growthpartner/GrowthPartnerDashboard';
import StaffDocumentLibrary from './features/school/components/StaffDocumentLibrary';
import StoreKeeperPanel from './features/school/components/StoreKeeperPanel';
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
import TimetableViewer from './features/school/components/TimetableViewer';
import RoleLibrary from './app/RoleLibrary';
import AmiInbox from './app/roles/ami/AmiInbox';
import LoginPage from './features/auth/pages/LoginPage';
import ChangePasswordPage from './features/auth/pages/ChangePasswordPage';
import ResetPasswordPage from './features/auth/pages/ResetPasswordPage';
import SchoolRegistrationPage from './features/tenants/pages/SchoolRegistrationPage';
import PublicHomePage from './features/public/pages/PublicHomePage';
import PublicSitePage from './features/public/pages/PublicSitePage';
import PublicLegalPage from './features/public/pages/PublicLegalPage';
import PublicChampionshipsPage from './features/championships/pages/PublicChampionshipsPage';
import PublicChampionshipDetailPage from './features/championships/pages/PublicChampionshipDetailPage';
import ChampionshipCentre from './features/championships/ChampionshipCentre';
import ChampionshipPromoCard from './features/championships/ChampionshipPromoCard';
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
  // Legal and compliance pages must stay publicly reachable — Google OAuth verification
  // and school procurement both check them without an account.
  '/privacy',
  '/privacy-policy',
  '/terms',
  '/terms-of-service',
  '/data-handling',
  '/youtube-disclosure',
  '/youtube',
  '/contact',
  '/championships',
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

// Public sections that have their own child pages, so an exact-path Set is not enough.
const PUBLIC_ROUTE_PREFIXES = ['/championships/'];

function isPublicRoutePath(pathname) {
  const normalized = normalizePublicPath(pathname);
  if (PUBLIC_ROUTE_PATHS.has(normalized)) return true;
  return PUBLIC_ROUTE_PREFIXES.some(prefix => normalized.startsWith(prefix));
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

// Pages fade in with a plain CSS animation. They used to go through framer-motion's
// AnimatePresence in "wait" mode, where a new page stays invisible until the old one's
// exit animation reports it finished; login changes the route twice at once, and on
// some devices that hand-off never completed, leaving a blank screen after signing in.
function RouteTransition({ children }) {
  return <div className="route-enter h-full">{children}</div>;
}

function RequireAuth({ auth, children }) {
  const location = useLocation();

  if (!auth?.token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

function RoleGuard({ expectedRole, auth, children }) {
  const location = useLocation();
  const authRole = getAuthenticatedRole(auth);
  const accessibleRoles = getAccessibleRoles(auth);

  if (!auth?.token) {
    return <Navigate to="/login" replace />;
  }

  // Being on a role's dashboard means acting as that role. Without this, someone who holds
  // two roles (a teacher who is also HOS) could open the HOS pages by link, refresh or the
  // home redirect while every request still said "teacher" — and the server refused them
  // ("forbidden") everywhere. Written before the page renders, so its first requests count.
  if (accessibleRoles.includes(expectedRole) && authRole !== expectedRole
    && Array.isArray(auth?.user?.switchableRoles) && auth.user.switchableRoles.includes(expectedRole)) {
    try { window.localStorage.setItem('selectedRole', expectedRole); } catch { /* storage unavailable */ }
  }

  if (!accessibleRoles.includes(expectedRole)) {
    const home = `/roles/${authRole}`;
    // Sending someone to the page they are already on is an infinite redirect,
    // and an infinite redirect is a blank screen. Say so instead.
    if (location.pathname === home) {
      return <RoleWithoutDashboard roleKey={authRole} />;
    }
    return <Navigate to={home} replace />;
  }

  return children;
}

function AnimatedRoutes({ auth, onLogin }) {
  const location = useLocation();
  const authRole = getAuthenticatedRole(auth);
  const defaultAppRoute = auth?.token ? `/roles/${authRole}` : '/';

  return (
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
        <Route path="/privacy" element={<PublicLegalPage docKey="privacy" />} />
        <Route path="/privacy-policy" element={<Navigate to="/privacy" replace />} />
        <Route path="/terms" element={<PublicLegalPage docKey="terms" />} />
        <Route path="/terms-of-service" element={<Navigate to="/terms" replace />} />
        <Route path="/data-handling" element={<PublicLegalPage docKey="data" />} />
        <Route path="/youtube-disclosure" element={<PublicLegalPage docKey="youtube" />} />
        <Route path="/youtube" element={<Navigate to="/youtube-disclosure" replace />} />
        <Route path="/contact" element={<PublicLegalPage docKey="contact" />} />
        <Route path="/championships" element={<PublicChampionshipsPage />} />
        <Route path="/championships/:slug" element={<PublicChampionshipDetailPage />} />
        <Route path="/roles/:role/championships" element={<RequireAuth auth={auth}><RouteTransition><ChampionshipCentre /></RouteTransition></RequireAuth>} />
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
        <Route path="/news" element={<RequireAuth auth={auth}><RouteTransition><NewsFeedPage /></RouteTransition></RequireAuth>} />
        <Route path="/roles/student" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentDashboard /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/classroom" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentClassroom /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/assignments" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentAssignments /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/assignments/:assignmentId" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentAssignments /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/academic-history" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><AcademicHistory /></RouteTransition></RoleGuard>} />
        <Route path="/roles/owner/calendar" element={<RoleGuard auth={auth} expectedRole="owner"><RouteTransition><div className="mx-auto max-w-7xl p-4 sm:p-8"><SchoolCalendarBoard /></div></RouteTransition></RoleGuard>} />
        <Route path="/roles/hos/calendar" element={<RoleGuard auth={auth} expectedRole="hos"><RouteTransition><div className="mx-auto max-w-7xl p-4 sm:p-8"><SchoolCalendarBoard /></div></RouteTransition></RoleGuard>} />
        <Route path="/roles/owner/punctuality" element={<RoleGuard auth={auth} expectedRole="owner"><RouteTransition><StaffPunctualityPage dashboardLabel="Owner Dashboard" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/hos/punctuality" element={<RoleGuard auth={auth} expectedRole="hos"><RouteTransition><StaffPunctualityPage dashboardLabel="Head of School" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/teacher/staff-evaluation" element={<RoleGuard auth={auth} expectedRole="teacher"><RouteTransition><MyStaffEvaluationsPage dashboardLabel="Teacher Dashboard" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/owner/staff-evaluation" element={<RoleGuard auth={auth} expectedRole="owner"><RouteTransition><StaffEvaluationAdminPage dashboardLabel="Owner Dashboard" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/hos/staff-evaluation" element={<RoleGuard auth={auth} expectedRole="hos"><RouteTransition><StaffEvaluationAdminPage dashboardLabel="Head of School" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/hos/evaluate-colleagues" element={<RoleGuard auth={auth} expectedRole="hos"><RouteTransition><MyStaffEvaluationsPage dashboardLabel="Head of School" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/teacher/submissions" element={<RoleGuard auth={auth} expectedRole="teacher"><RouteTransition><TeacherSubmissionsPage /></RouteTransition></RoleGuard>} />
        <Route path="/roles/teacher/compliance" element={<RoleGuard auth={auth} expectedRole="teacher"><RouteTransition><TeacherCompliancePage /></RouteTransition></RoleGuard>} />
        <Route path="/roles/teacher/class-report" element={<RoleGuard auth={auth} expectedRole="teacher"><RouteTransition><ClassReportPage /></RouteTransition></RoleGuard>} />
        <Route path="/roles/teacher/ai-assessments" element={<AiAssessmentsRedirect />} />
        <Route path="/roles/owner/curriculum" element={<RoleGuard auth={auth} expectedRole="owner"><RouteTransition><CurriculumLibraryPage scope="school" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/hos/curriculum" element={<RoleGuard auth={auth} expectedRole="hos"><RouteTransition><CurriculumLibraryPage scope="school" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/exam-readiness" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><ExamReadinessPage /></RouteTransition></RoleGuard>} />
        <Route path="/roles/owner/exam-letterhead" element={<RoleGuard auth={auth} expectedRole="owner"><RouteTransition><ExamLetterheadPage dashboardLabel="Owner Dashboard" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/hos/exam-letterhead" element={<RoleGuard auth={auth} expectedRole="hos"><RouteTransition><ExamLetterheadPage dashboardLabel="Head of School" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/owner/submissions" element={<RoleGuard auth={auth} expectedRole="owner"><RouteTransition><SubmissionReviewPage dashboardLabel="Owner Dashboard" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/hos/submissions" element={<RoleGuard auth={auth} expectedRole="hos"><RouteTransition><SubmissionReviewPage dashboardLabel="Head of School" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/teacher/academic-history" element={<RoleGuard auth={auth} expectedRole="teacher"><RouteTransition><AcademicHistory role="teacher" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/last-session" element={<Navigate to="/roles/student/academic-history" replace />} />
        <Route path="/roles/teacher/last-session" element={<Navigate to="/roles/teacher/academic-history" replace />} />
        <Route path="/roles/student/materials" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentLessonNotes /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/lesson-notes" element={<Navigate to="/roles/student/materials" replace />} />
        <Route path="/roles/student/lesson-plans" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><LessonPlanViewerPage /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/practice" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentPractice /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/exams" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentExams /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/results" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentResults /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/attendance" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentAttendance /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/timetable" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><TimetableViewer viewerRole="student" title="My Timetable" subtitle="Your weekly class schedule." /></RouteTransition></RoleGuard>} />
        {/* role-specific library view */}
        <Route path="/roles/:role/library" element={<RequireAuth auth={auth}><RouteTransition><RoleLibrary /></RouteTransition></RequireAuth>} />
        {/* One staff file, from any role's dashboard; the server decides what each viewer sees. */}
        <Route path="/roles/:role/staff/:staffId" element={<RequireAuth auth={auth}><RouteTransition><StaffFilePage /></RouteTransition></RequireAuth>} />
        <Route path="/roles/:role/students/:studentId" element={<RequireAuth auth={auth}><RouteTransition><StudentFileRoute /></RouteTransition></RequireAuth>} />
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
        <Route path="/roles/parent/timetable" element={<RoleGuard auth={auth} expectedRole="parent"><RouteTransition><TimetableViewer viewerRole="parent" title="Class Timetable" subtitle="Your child's weekly class schedule." /></RouteTransition></RoleGuard>} />
        <Route path="/roles/parent/*" element={<RoleGuard auth={auth} expectedRole="parent"><RouteTransition><ParentDashboard /></RouteTransition></RoleGuard>} />
        <Route path="/roles/caregiver/*" element={<RoleGuard auth={auth} expectedRole="caregiver"><RouteTransition><OperationalRoleDashboard roleKey="caregiver" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/teacher/classroom" element={<RoleGuard auth={auth} expectedRole="teacher"><RouteTransition><TeacherClassroom /></RouteTransition></RoleGuard>} />
        <Route path="/roles/teacher/resources" element={<RoleGuard auth={auth} expectedRole="teacher"><RouteTransition><StaffDocumentLibrary /></RouteTransition></RoleGuard>} />
        <Route path="/roles/teacher/*" element={<RoleGuard auth={auth} expectedRole="teacher"><RouteTransition><TeacherDashboard /></RouteTransition></RoleGuard>} />
        <Route path="/roles/hos/resources" element={<RoleGuard auth={auth} expectedRole="hos"><RouteTransition><StaffDocumentLibrary /></RouteTransition></RoleGuard>} />
        <Route path="/roles/hos/store" element={<RoleGuard auth={auth} expectedRole="hos"><RouteTransition><StoreKeeperPanel /></RouteTransition></RoleGuard>} />
        <Route path="/roles/hos/*" element={<RoleGuard auth={auth} expectedRole="hos"><RouteTransition><HoSDashboard /></RouteTransition></RoleGuard>} />
        <Route path="/roles/admin/*" element={<RoleGuard auth={auth} expectedRole="admin"><RouteTransition><AdminDashboard auth={auth} /></RouteTransition></RoleGuard>} />
        <Route path="/roles/accountant/*" element={<RoleGuard auth={auth} expectedRole="accountant"><RouteTransition><AccountantDashboard /></RouteTransition></RoleGuard>} />
        <Route path="/roles/owner/resources" element={<RoleGuard auth={auth} expectedRole="owner"><RouteTransition><StaffDocumentLibrary /></RouteTransition></RoleGuard>} />
        <Route path="/roles/owner/store" element={<RoleGuard auth={auth} expectedRole="owner"><RouteTransition><StoreKeeperPanel /></RouteTransition></RoleGuard>} />
        <Route path="/roles/owner/*" element={<RoleGuard auth={auth} expectedRole="owner"><RouteTransition><OwnerDashboard auth={auth} /></RouteTransition></RoleGuard>} />
        <Route path="/roles/growthpartner/*" element={<RoleGuard auth={auth} expectedRole="growthpartner"><RouteTransition><GrowthPartnerDashboard /></RouteTransition></RoleGuard>} />
        <Route path="/roles/librarian/*" element={<RoleGuard auth={auth} expectedRole="librarian"><RouteTransition><OperationalRoleDashboard roleKey="librarian" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/sanitation/*" element={<RoleGuard auth={auth} expectedRole="sanitation"><RouteTransition><OperationalRoleDashboard roleKey="sanitation" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/tuckshopmanager/*" element={<RoleGuard auth={auth} expectedRole="tuckshopmanager"><RouteTransition><OperationalRoleDashboard roleKey="tuckshopmanager" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/storekeeper/*" element={<RoleGuard auth={auth} expectedRole="storekeeper"><RouteTransition><OperationalRoleDashboard roleKey="storekeeper" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/transport/*" element={<RoleGuard auth={auth} expectedRole="transport"><RouteTransition><OperationalRoleDashboard roleKey="transport" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/hostel/*" element={<RoleGuard auth={auth} expectedRole="hostel"><RouteTransition><OperationalRoleDashboard roleKey="hostel" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/cafeteria/*" element={<RoleGuard auth={auth} expectedRole="cafeteria"><RouteTransition><OperationalRoleDashboard roleKey="cafeteria" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/clinic/*" element={<RoleGuard auth={auth} expectedRole="clinic"><RouteTransition><OperationalRoleDashboard roleKey="clinic" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/ict/*" element={<RoleGuard auth={auth} expectedRole="ict"><RouteTransition><OperationalRoleDashboard roleKey="ict" /></RouteTransition></RoleGuard>} />
        {/* ICT merged into one role; keep the old path working for saved links. */}
        <Route path="/roles/ict_manager/*" element={<Navigate to="/roles/ict" replace />} />
        <Route path="/roles/classteacher/*" element={<RoleGuard auth={auth} expectedRole="classteacher"><RouteTransition><OperationalRoleDashboard roleKey="classteacher" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/hod/*" element={<RoleGuard auth={auth} expectedRole="hod"><RouteTransition><OperationalRoleDashboard roleKey="hod" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/hodassistant/*" element={<RoleGuard auth={auth} expectedRole="hodassistant"><RouteTransition><OperationalRoleDashboard roleKey="hodassistant" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/principal/*" element={<RoleGuard auth={auth} expectedRole="principal"><RouteTransition><OperationalRoleDashboard roleKey="principal" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/viceprincipal/*" element={<RoleGuard auth={auth} expectedRole="viceprincipal"><RouteTransition><OperationalRoleDashboard roleKey="viceprincipal" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/headteacher/*" element={<RoleGuard auth={auth} expectedRole="headteacher"><RouteTransition><OperationalRoleDashboard roleKey="headteacher" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/nurseryhead/*" element={<RoleGuard auth={auth} expectedRole="nurseryhead"><RouteTransition><OperationalRoleDashboard roleKey="nurseryhead" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/examofficer/*" element={<RoleGuard auth={auth} expectedRole="examofficer"><RouteTransition><OperationalRoleDashboard roleKey="examofficer" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/sportsmaster/*" element={<RoleGuard auth={auth} expectedRole="sportsmaster"><RouteTransition><OperationalRoleDashboard roleKey="sportsmaster" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/ami/messaging" element={<RoleGuard auth={auth} expectedRole="ami"><RouteTransition><AmiInbox /></RouteTransition></RoleGuard>} />
        <Route path="/roles/ami/curriculum" element={<RoleGuard auth={auth} expectedRole="ami"><RouteTransition><CurriculumLibraryPage scope="ami" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/ami/school-closures" element={<RoleGuard auth={auth} expectedRole="ami"><RouteTransition><AmiSchoolClosuresPage /></RouteTransition></RoleGuard>} />
        <Route path="/roles/owner/school-closure" element={<RoleGuard auth={auth} expectedRole="owner"><RouteTransition><SchoolClosurePage dashboardLabel="Owner Dashboard" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/hos/school-closure" element={<RoleGuard auth={auth} expectedRole="hos"><RouteTransition><SchoolClosurePage dashboardLabel="Head of School" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/ami/*" element={<RoleGuard auth={auth} expectedRole="ami"><RouteTransition><AmiDashboard /></RouteTransition></RoleGuard>} />
        <Route
          path="*"
          element={location.pathname === defaultAppRoute
            ? <RoleWithoutDashboard roleKey={authRole} />
            : <Navigate to={defaultAppRoute} replace />}
        />
      </Routes>
  );
}

function AppWorkspace({ auth, onLogin, onLogout }) {
  const location = useLocation();
  useTenantPwaManifest(auth);
  const isPublicRoute = isPublicRoutePath(location.pathname);
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
  // The growth partner workspace carries its own sidebar and mobile bottom bar, so the
  // shared one would be a second, duplicate navigation.
  const partnerWorkspace = location.pathname.startsWith('/roles/growthpartner');

  if (isPublicRoute) {
    return <AnimatedRoutes auth={auth} onLogin={onLogin} />;
  }

  return (
    <div className="flex h-screen overflow-hidden text-slate-900 dark:text-slate-100 transition-colors duration-500 dashboard-bg dark:bg-slate-950">
      {!mobileClassroomMode && !partnerWorkspace && <Sidebar mobileOpen={isSidebarOpen} onClose={handleCloseSidebar} />}
      <main className={`flex-1 min-h-0 relative ${inStudentClassroom ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'} ${inDashboardMode && !inStudentClassroom ? 'pb-[calc(8rem+var(--safe-bottom))] scroll-pb-[calc(8rem+var(--safe-bottom))] md:pb-0 md:scroll-pb-0' : ''}`}>
        {inDashboardMode && !mobileClassroomMode && (
          <DashboardTopBar
            authUser={auth?.user}
            onLogout={onLogout}
            onToggleSidebar={partnerWorkspace ? null : () => setIsSidebarOpen(open => !open)}
            isSidebarOpen={isSidebarOpen}
          />
        )}
        {/* Inline, dismissible and self-expiring. It sits in normal flow above the page so it
            can never cover navigation or block a student reaching a lesson. */}
        {inDashboardMode && !mobileClassroomMode ? (
          <div className="px-4 pt-4 sm:px-6 lg:px-8">
            <ChampionshipPromoCard />
          </div>
        ) : null}
        {/* The month's punctuality winner, celebrated once for each member of staff. */}
        {inDashboardMode && !['student', 'parent', 'growthpartner', 'ami'].includes(String(auth?.user?.activeRole || auth?.user?.role || '').toLowerCase()) ? (
          <PunctualityWinnerBanner variant="celebration" />
        ) : null}
        {inDashboardMode ? (
          <ClosureGate role={auth?.user?.activeRole || auth?.user?.role}><AnimatedRoutes auth={auth} onLogin={onLogin} /></ClosureGate>
        ) : <AnimatedRoutes auth={auth} onLogin={onLogin} />}
        {inDashboardMode && !mobileClassroomMode ? (
          <MobileRoleOverviewNav roleKey={location.pathname.split('/')[2] || 'student'} />
        ) : null}
      </main>
      <ReturnToAmiBanner />
    </div>
  );
}

// AI Assessments moved inside Ndovera AI; old links (and the topic hub) still land there.
function AiAssessmentsRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set('tab', 'assessment');
  return <Navigate to={`/roles/teacher/ai-assistant?${params.toString()}`} replace />;
}

// When NDOVERA support (Ami) opens a school as its owner, show a way back to Ami.
function ReturnToAmiBanner() {
  const returnToken = typeof window !== 'undefined' ? window.localStorage.getItem('ami_return_token') : '';
  if (!returnToken) return null;
  function back() {
    persistAuth({ token: returnToken, user: { role: 'ami', name: 'Ami' } }, {});
    window.localStorage.removeItem('ami_return_token');
    window.location.href = '/roles/ami';
  }
  return (
    <div className="fixed inset-x-0 bottom-0 z-[200] flex flex-wrap items-center justify-between gap-2 bg-[#800020] px-4 pt-2 pb-[calc(0.5rem+var(--safe-bottom))] text-sm text-white">
      <span>You are managing this school as its owner (NDOVERA support session).</span>
      <button type="button" onClick={back} className="rounded-lg bg-white px-3 py-1 text-xs font-bold text-[#800020]">Return to Ami</button>
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

      // No local token (cleared storage, a fresh tab, or a tenant subdomain): fall
      // back to the cross-subdomain .ndovera.com session cookie before declaring the
      // user logged out, so an active session (e.g. Ami) persists across the platform
      // as long as the 30-day sliding cookie is alive.
      if (!stored?.token) {
        if (hydrationInFlightRef.current) {
          if (!cancelled && initial) setLoading(false);
          return;
        }
        hydrationInFlightRef.current = true;
        try {
          const res = await fetch(getApiUrl('/api/users/me'), {
            credentials: 'include',
            headers: { ...buildSelectedRoleHeader() },
          });
          syncRefreshedToken(res);
          const data = await res.json().catch(() => ({}));
          const cookieToken = res.headers.get('X-Refresh-Token') || '';
          if (res.ok && data?.user && cookieToken && !cancelled) {
            setAuth(persistAuth({ token: cookieToken, user: data.user }, { preserveSelectedRole: true }));
          } else if (!cancelled) {
            setAuth(null);
          }
        } catch {
          if (!cancelled) setAuth(null);
        } finally {
          hydrationInFlightRef.current = false;
          if (!cancelled && initial) setLoading(false);
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
            // The local token may be stale while the shared .ndovera.com cookie is
            // still valid (e.g. signed in from another tab/device). Retry cookie-only
            // before logging out, so the session stays persistent.
            try {
              const cookieRes = await fetch(getApiUrl('/api/users/me'), {
                credentials: 'include',
                headers: { ...buildSelectedRoleHeader() },
              });
              syncRefreshedToken(cookieRes);
              const cookieData = await cookieRes.json().catch(() => ({}));
              const cookieToken = cookieRes.headers.get('X-Refresh-Token') || '';
              if (cookieRes.ok && cookieData?.user && cookieToken && !cancelled) {
                setAuth(persistAuth({ token: cookieToken, user: cookieData.user }, { preserveSelectedRole: true }));
                if (initial) setLoading(false);
                return;
              }
            } catch { /* fall through */ }
            // Only force a sign-out when first establishing the session. A 401 during
            // a background focus/visibility refresh (transient edge/network blip) must
            // NOT wipe an active session — that is what caused frequent logouts.
            if (initial && !cancelled) {
              clearStoredAuth();
              setAuth(null);
              setLoading(false);
              window.location.replace(getSignedOutRedirectPath());
            } else if (!cancelled) {
              setAuth(stored);
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
    <AppErrorBoundary>
      <Router>
        <AppWorkspace auth={auth} onLogin={handleLogin} onLogout={handleLogout} />
      </Router>
    </AppErrorBoundary>
  );
}

export default App;
