import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import lazyPage from './shared/lazyPage';
import { AmiSchoolClosuresPage, ClosureGate, SchoolClosurePage } from './features/school/closure/SchoolClosure';
import { PunctualityWinnerBanner, StaffPunctualityPage } from './features/attendance/punctuality/PunctualityPages';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate, useParams, Navigate } from 'react-router-dom';
import { ReadAloudPlayer } from './shared/components/ReadAloud';
import Loader from './shared/components/Loader';
import Sidebar from './shared/components/Sidebar';
import DashboardTopBar from './shared/components/DashboardTopBar';
import HelpCentre from './features/help/HelpCentre';
import HelpArticleAdmin from './features/help/HelpArticleAdmin';
import MobileRoleOverviewNav from './shared/components/MobileRoleOverviewNav';
import RoleWithoutDashboard from './shared/components/RoleWithoutDashboard';
import AppErrorBoundary from './shared/components/AppErrorBoundary';
import Assignments from './app/Assignments';
import Exams from './app/Exams';
import { canBuildExams, examHomeFor } from './app/examAccess';
import NewsFeedPage from './shared/components/NewsFeedPage';
import { AmiPage } from './features/ami/AmiUi';
import ChampionshipPromoCard from './features/championships/ChampionshipPromoCard';
import { buildSelectedRoleHeader, clearStoredAuth, consumeTenantReturnUrlFromLocation, getSignedOutRedirectPath, getStoredAuth, persistAuth, syncRefreshedToken } from './features/auth/services/authApi';
import { useTenantPwaManifest } from './shared/hooks/useTenantPwaManifest';
import { getApiUrl } from './config/apiBase';
import './App.css';
import { AppDialogHost, askConfirm } from './shared/components/AppDialog';

// Each page downloads when it is opened. Loading them all first made a first visit take over 20 seconds on a phone.
const AcademicHistory = lazyPage(() => import('./features/classroom/AcademicHistory'));
const TeacherSubmissionsPage = lazyPage(() => import('./features/submissions/TeacherSubmissionsPage'));
const SubmissionReviewPage = lazyPage(() => import('./features/submissions/SubmissionReviewPage'));
const TeacherCompliancePage = lazyPage(() => import('./features/compliance/TeacherCompliancePage'));
const ClassReportPage = lazyPage(() => import('./features/compliance/ClassReportPage'));
const CurriculumLibraryPage = lazyPage(() => import('./features/material-ai/CurriculumLibraryPage'));
const NotificationsCenter = lazyPage(() => import('./features/communications/NotificationsCenter'));
const AmiCommunications = lazyPage(() => import('./features/communications/AmiCommunications'));
const ParentNotifications = lazyPage(() => import('./features/communications/ParentNotifications'));
const TeacherNotifications = lazyPage(() => import('./features/communications/TeacherNotifications'));
const BirthdaysPage = lazyPage(() => import('./features/birthdays/BirthdaysPage'));
const TeacherPayslip = lazyPage(() => import('./app/roles/teacher/TeacherPayslip'));
const CompetitionLinksPage = lazyPage(() => import('./features/competitions/CompetitionLinksPage'));
const CompetitionByLinkPage = lazyPage(() => import('./features/competitions/CompetitionByLinkPage'));
const SetupCentrePage = lazyPage(() => import('./features/setup/SetupCentrePage'));
const TermsCalendarPage = lazyPage(() => import('./features/calendar/TermsCalendarPage'));
const GrowthCentrePage = lazyPage(() => import('./features/growth/GrowthCentrePage'));
const ClubsPage = lazyPage(() => import('./features/clubs/ClubsPage'));
const PracticePassesPage = lazyPage(() => import('./features/practice-arena/PracticePassesPage'));
const ExamReadinessPage = lazyPage(() => import('./features/material-ai/ExamReadinessPage'));
const OfflineNotesPage = lazyPage(() => import('./features/offline-notes/OfflineNotesPage'));
const StaffFilePage = lazyPage(() => import('./features/staff-file/StaffFilePage'));
const StudentFileRoute = lazyPage(() => import('./features/students/components/StudentFileRoute'));
const ExamLetterheadPage = lazyPage(() => import('./features/assessments/AiAssessmentStudio').then(module => ({ default: module.ExamLetterheadPage })));
const MyStaffEvaluationsPage = lazyPage(() => import('./features/evaluations/StaffEvaluationPages').then(module => ({ default: module.MyStaffEvaluationsPage })));
const StaffEvaluationAdminPage = lazyPage(() => import('./features/evaluations/StaffEvaluationPages').then(module => ({ default: module.StaffEvaluationAdminPage })));
const SchoolCalendarBoard = lazyPage(() => import('./features/school/components/SchoolCalendarBoard'));
const PremisesSecurityDashboard = lazyPage(() => import('./features/security/PremisesSecurityDashboard'));
const Classroom = lazyPage(() => import('./app/Classroom'));
const ExamCreator = lazyPage(() => import('./features/exams/ExamCreator'));
const AITutor = lazyPage(() => import('./app/AITutor'));
const Attendance = lazyPage(() => import('./app/Attendance'));
const Rewards = lazyPage(() => import('./app/Rewards'));
const Settings = lazyPage(() => import('./app/Settings'));
const StudentDashboard = lazyPage(() => import('./app/roles/StudentDashboard'));
const ParentDashboard = lazyPage(() => import('./app/roles/ParentDashboard'));
const TeacherDashboard = lazyPage(() => import('./app/roles/TeacherDashboard'));
const TeacherClassroom = lazyPage(() => import('./features/classroom/TeacherClassroom'));
const HoSDashboard = lazyPage(() => import('./app/roles/HoSDashboard'));
const AccountantDashboard = lazyPage(() => import('./app/roles/AccountantDashboard'));
const AdminDashboard = lazyPage(() => import('./app/roles/AdminDashboard'));
const OwnerDashboard = lazyPage(() => import('./app/roles/OwnerDashboard'));
const GrowthPartnerDashboard = lazyPage(() => import('./app/roles/growthpartner/GrowthPartnerDashboard'));
const StaffDocumentLibrary = lazyPage(() => import('./features/school/components/StaffDocumentLibrary'));
const StoreKeeperPanel = lazyPage(() => import('./features/school/components/StoreKeeperPanel'));
const AmiDashboard = lazyPage(() => import('./app/roles/AmiDashboard'));
const ShareholderHome = lazyPage(() => import('./features/ami/ShareholderHome'));
const OperationalRoleDashboard = lazyPage(() => import('./app/roles/OperationalRoleDashboard'));
const StudentClassroom = lazyPage(() => import('./app/roles/student/StudentClassroom'));
const StudentAssignments = lazyPage(() => import('./app/roles/student/StudentAssignments'));
const StudentLessonNotes = lazyPage(() => import('./app/roles/student/StudentLessonNotes'));
const StudentPractice = lazyPage(() => import('./app/roles/student/StudentPractice'));
const StudentExams = lazyPage(() => import('./app/roles/student/StudentExams'));
const StudentResults = lazyPage(() => import('./app/roles/student/StudentResults'));
const StudentMedals = lazyPage(() => import('./app/roles/student/StudentMedals'));
const FinancialStandingsReport = lazyPage(() => import('./features/finance/simple/FinancialStandingsReport'));
const StudentAttendance = lazyPage(() => import('./app/roles/student/StudentAttendance'));
const StudentTuckShop = lazyPage(() => import('./app/roles/student/StudentTuckShop'));
const StaffTuckShop = lazyPage(() => import('./app/roles/teacher/StaffTuckShop'));
const StudentProfessorAura = lazyPage(() => import('./app/roles/student/StudentProfessorAura'));
const StudentMessaging = lazyPage(() => import('./app/roles/student/StudentMessaging'));
const StudentSettings = lazyPage(() => import('./app/roles/student/StudentSettings'));
const TimetableViewer = lazyPage(() => import('./features/school/components/TimetableViewer'));
const RoleLibrary = lazyPage(() => import('./app/RoleLibrary'));
const AmiInbox = lazyPage(() => import('./app/roles/ami/AmiInbox'));
const AmiHomeShowcase = lazyPage(() => import('./app/roles/ami/AmiHomeShowcase'));
const AmiPassCodes = lazyPage(() => import('./app/roles/ami/AmiPassCodes'));
const AmiCountryPrices = lazyPage(() => import('./app/roles/ami/AmiCountryPrices'));
const MyReviewPage = lazyPage(() => import('./features/showcase/MyReviewPage'));
const ExamRequestPage = lazyPage(() => import('./features/showcase/ExamRequestPage'));
const ParentInvitePage = lazyPage(() => import('./features/auth/pages/ParentInvitePage'));
const PassPayPage = lazyPage(() => import('./features/practice-arena/PassPayPage'));
const BankPayPage = lazyPage(() => import('./features/practice-arena/BankPayPage'));
const PortalLinkPage = lazyPage(() => import('./features/school/components/PortalLinkPage'));
const AmiExamRequests = lazyPage(() => import('./app/roles/ami/AmiExamRequests'));
const LoginPage = lazyPage(() => import('./features/auth/pages/LoginPage'));
const ChangePasswordPage = lazyPage(() => import('./features/auth/pages/ChangePasswordPage'));
const ResetPasswordPage = lazyPage(() => import('./features/auth/pages/ResetPasswordPage'));
const SchoolRegistrationPage = lazyPage(() => import('./features/tenants/pages/SchoolRegistrationPage'));
const InvoicePayPage = lazyPage(() => import('./features/tenants/pages/InvoicePayPage'));
const TransportAdminPage = lazyPage(() => import('./features/transport/TransportAdminPage'));
const DriverTransportPage = lazyPage(() => import('./features/transport/DriverTransportPage'));
const MyBusPage = lazyPage(() => import('./features/transport/MyBusPage'));
const HealthRegisterPage = lazyPage(() => import('./features/health/HealthRegisterPage'));
const HealthReportPage = lazyPage(() => import('./features/health/HealthReportPage'));
const ParentHealthPage = lazyPage(() => import('./features/health/ParentHealthPage'));
const PublicHomePage = lazyPage(() => import('./features/public/pages/PublicHomePage'));
const PublicSitePage = lazyPage(() => import('./features/public/pages/PublicSitePage'));
const PublicLegalPage = lazyPage(() => import('./features/public/pages/PublicLegalPage'));
const PublicChampionshipsPage = lazyPage(() => import('./features/championships/pages/PublicChampionshipsPage'));
const PublicChampionshipDetailPage = lazyPage(() => import('./features/championships/pages/PublicChampionshipDetailPage'));
const ChampionshipCentre = lazyPage(() => import('./features/championships/ChampionshipCentre'));

const PUBLIC_ROUTE_PATHS = new Set([
  '/',
  '/about',
  '/features',
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
const PUBLIC_ROUTE_PREFIXES = ['/championships/', '/invoice/', '/invite/', '/pay/', '/bank-pay/', '/c/'];

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
    // Keep the query too: a notification link (?receipt=…) should still open its item after sign-in.
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return children;
}

function RoleGuard({ expectedRole, auth, children }) {
  const location = useLocation();
  const authRole = getAuthenticatedRole(auth);
  const accessibleRoles = getAccessibleRoles(auth);

  if (!auth?.token) {
    // After signing in, return to the page the link was for (a receipt from a notification, say).
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
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

function HelpArticleAdminRoute({ auth }) {
  const { role } = useParams();
  const activeRole = getAuthenticatedRole(auth);
  if (role !== activeRole) return <Navigate to={`/roles/${activeRole}/help`} replace />;
  if (!['owner', 'hos'].includes(activeRole)) return <Navigate to={`/roles/${activeRole}/help`} replace />;
  return <HelpArticleAdmin role={activeRole} />;
}

function HelpRoleRoute({ auth }) {
  const { role } = useParams();
  const activeRole = getAuthenticatedRole(auth);
  if (role !== activeRole) {
    return <Navigate to={`/roles/${activeRole}/help`} replace />;
  }
  return <HelpCentre role={activeRole} />;
}

function AnimatedRoutes({ auth, onLogin }) {
  const location = useLocation();
  const authRole = getAuthenticatedRole(auth);
  const defaultAppRoute = auth?.token ? `/roles/${authRole}` : '/';

  return (
      <Suspense fallback={<Loader />}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PublicHomePage />} />
        <Route path="/about" element={<PublicSitePage pageKey="about" />} />
        <Route path="/mission" element={<PublicSitePage pageKey="mission" />} />
        <Route path="/vision" element={<PublicSitePage pageKey="vision" />} />
        <Route path="/mission-vision" element={<PublicSitePage pageKey="mission" />} />
        <Route path="/growth-partners" element={<PublicSitePage pageKey="partners" />} />
        <Route path="/partners" element={<PublicSitePage pageKey="partners" />} />
        <Route path="/tutor" element={<PublicSitePage pageKey="tutor" />} />
        <Route path="/features" element={<PublicSitePage pageKey="features" />} />
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
        {/* A competition shared by link: only people holding the link reach it (not listed, not indexed). */}
        <Route path="/c/:token" element={<CompetitionByLinkPage />} />
        <Route path="/invoice/:token" element={<InvoicePayPage />} />
        <Route path="/invite/:token" element={<ParentInvitePage />} />
        <Route path="/pay/:token" element={<PassPayPage />} />
        <Route path="/bank-pay/:id" element={<BankPayPage />} />
        <Route path="/roles/:role/own-website" element={<RequireAuth auth={auth}><RouteTransition><PortalLinkPage /></RouteTransition></RequireAuth>} />
        <Route path="/championships/:slug" element={<PublicChampionshipDetailPage />} />
        <Route path="/roles/chiefsecurityofficer/*" element={<RoleGuard auth={auth} expectedRole="chiefsecurityofficer"><RouteTransition><PremisesSecurityDashboard role="chiefsecurityofficer" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/securityofficer/*" element={<RoleGuard auth={auth} expectedRole="securityofficer"><RouteTransition><PremisesSecurityDashboard role="securityofficer" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/owner/premises-security" element={<RoleGuard auth={auth} expectedRole="owner"><RouteTransition><PremisesSecurityDashboard role="owner" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/hos/premises-security" element={<RoleGuard auth={auth} expectedRole="hos"><RouteTransition><PremisesSecurityDashboard role="hos" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/:role/help" element={<RequireAuth auth={auth}><HelpRoleRoute auth={auth} /></RequireAuth>} />
        <Route path="/roles/:role/help/articles" element={<RequireAuth auth={auth}><HelpArticleAdminRoute auth={auth} /></RequireAuth>} />
        {/* One payslip page for every staff role (teachers, HoS, accountant, ICT, librarian, clinic, …). */}
        <Route path="/roles/:role/growth" element={<RequireAuth auth={auth}><RouteTransition><GrowthCentrePage /></RouteTransition></RequireAuth>} />
        <Route path="/roles/:role/terms-calendar" element={<RequireAuth auth={auth}><RouteTransition><TermsCalendarPage /></RouteTransition></RequireAuth>} />
        <Route path="/roles/:role/setup" element={<RequireAuth auth={auth}><RouteTransition><SetupCentrePage /></RouteTransition></RequireAuth>} />
        <Route path="/roles/:role/competitions" element={<RequireAuth auth={auth}><RouteTransition><CompetitionLinksPage /></RouteTransition></RequireAuth>} />
        <Route path="/roles/:role/payslip" element={<RequireAuth auth={auth}><RouteTransition><TeacherPayslip auth={auth} /></RouteTransition></RequireAuth>} />
        <Route path="/roles/:role/finance-report" element={<RequireAuth auth={auth}><RouteTransition><FinancialStandingsReport /></RouteTransition></RequireAuth>} />
        <Route path="/finance-report" element={<RequireAuth auth={auth}><RouteTransition><FinancialStandingsReport /></RouteTransition></RequireAuth>} />
        <Route path="/roles/:role/birthdays" element={<RequireAuth auth={auth}><RouteTransition><BirthdaysPage /></RouteTransition></RequireAuth>} />
        <Route path="/roles/:role/clubs" element={<RequireAuth auth={auth}><RouteTransition><ClubsPage /></RouteTransition></RequireAuth>} />
        <Route path="/roles/owner/health" element={<RoleGuard auth={auth} expectedRole="owner"><RouteTransition><HealthRegisterPage /></RouteTransition></RoleGuard>} />
        <Route path="/roles/hos/health" element={<RoleGuard auth={auth} expectedRole="hos"><RouteTransition><HealthRegisterPage /></RouteTransition></RoleGuard>} />
        <Route path="/roles/clinic" element={<RoleGuard auth={auth} expectedRole="clinic"><RouteTransition><HealthRegisterPage /></RouteTransition></RoleGuard>} />
        <Route path="/roles/clinic/visits" element={<RoleGuard auth={auth} expectedRole="clinic"><RouteTransition><HealthRegisterPage /></RouteTransition></RoleGuard>} />
        <Route path="/roles/clinic/patients" element={<RoleGuard auth={auth} expectedRole="clinic"><RouteTransition><HealthRegisterPage /></RouteTransition></RoleGuard>} />
        <Route path="/roles/clinic/emergencies" element={<RoleGuard auth={auth} expectedRole="clinic"><RouteTransition><HealthRegisterPage /></RouteTransition></RoleGuard>} />
        <Route path="/roles/parent/health" element={<RoleGuard auth={auth} expectedRole="parent"><RouteTransition><ParentHealthPage /></RouteTransition></RoleGuard>} />
        <Route path="/roles/:role/health" element={<RequireAuth auth={auth}><RouteTransition><HealthReportPage /></RouteTransition></RequireAuth>} />
        <Route path="/roles/owner/transport" element={<RoleGuard auth={auth} expectedRole="owner"><RouteTransition><TransportAdminPage /></RouteTransition></RoleGuard>} />
        <Route path="/roles/hos/transport" element={<RoleGuard auth={auth} expectedRole="hos"><RouteTransition><TransportAdminPage /></RouteTransition></RoleGuard>} />
        <Route path="/roles/transport/routes" element={<RoleGuard auth={auth} expectedRole="transport"><RouteTransition><TransportAdminPage /></RouteTransition></RoleGuard>} />
        <Route path="/roles/transport/attendance" element={<RoleGuard auth={auth} expectedRole="transport"><RouteTransition><TransportAdminPage /></RouteTransition></RoleGuard>} />
        <Route path="/roles/driver" element={<RoleGuard auth={auth} expectedRole="driver"><RouteTransition><DriverTransportPage /></RouteTransition></RoleGuard>} />
        <Route path="/roles/driver/*" element={<RoleGuard auth={auth} expectedRole="driver"><RouteTransition><DriverTransportPage /></RouteTransition></RoleGuard>} />
        <Route path="/roles/parent/transport" element={<RoleGuard auth={auth} expectedRole="parent"><RouteTransition><MyBusPage /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/transport" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><MyBusPage /></RouteTransition></RoleGuard>} />
        <Route path="/roles/parent/practice-passes" element={<RoleGuard auth={auth} expectedRole="parent"><RouteTransition><PracticePassesPage mode="parent" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/:role/practice-passes" element={<RequireAuth auth={auth}><RouteTransition><PracticePassesPage mode="school" /></RouteTransition></RequireAuth>} />
        <Route path="/roles/:role/championships" element={<RequireAuth auth={auth}><RouteTransition><ChampionshipCentre /></RouteTransition></RequireAuth>} />
        <Route path="/login" element={auth?.token ? <Navigate to={defaultAppRoute} replace /> : <LoginPage onLogin={onLogin} />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/register-school" element={<SchoolRegistrationPage />} />
        <Route path="/change-password" element={<ChangePasswordPage onLogin={onLogin} />} />
        <Route path="/classroom" element={<RequireAuth auth={auth}><RouteTransition><Classroom /></RouteTransition></RequireAuth>} />
        <Route path="/assignments" element={<RequireAuth auth={auth}><RouteTransition><Assignments /></RouteTransition></RequireAuth>} />
        <Route path="/exams" element={<RequireAuth auth={auth}>{examHomeFor(getAuthenticatedRole(auth)) === '/exams' ? <RouteTransition><Exams canCreate={canBuildExams(getAuthenticatedRole(auth))} /></RouteTransition> : <Navigate to={examHomeFor(getAuthenticatedRole(auth))} replace />}</RequireAuth>} />
        <Route path="/exams/create" element={<RequireAuth auth={auth}>{canBuildExams(getAuthenticatedRole(auth)) ? <RouteTransition><ExamCreator /></RouteTransition> : <Navigate to={examHomeFor(getAuthenticatedRole(auth))} replace />}</RequireAuth>} />
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
        <Route path="/roles/teacher/notifications" element={<RoleGuard auth={auth} expectedRole="teacher"><RouteTransition><TeacherNotifications /></RouteTransition></RoleGuard>} />
        <Route path="/roles/teacher/submissions" element={<RoleGuard auth={auth} expectedRole="teacher"><RouteTransition><TeacherSubmissionsPage /></RouteTransition></RoleGuard>} />
        <Route path="/roles/teacher/compliance" element={<RoleGuard auth={auth} expectedRole="teacher"><RouteTransition><TeacherCompliancePage /></RouteTransition></RoleGuard>} />
        <Route path="/roles/teacher/class-report" element={<RoleGuard auth={auth} expectedRole="teacher"><RouteTransition><ClassReportPage /></RouteTransition></RoleGuard>} />
        <Route path="/roles/teacher/ai-assessments" element={<AiAssessmentsRedirect />} />
        <Route path="/roles/owner/curriculum" element={<RoleGuard auth={auth} expectedRole="owner"><RouteTransition><CurriculumLibraryPage scope="school" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/owner/communications" element={<RoleGuard auth={auth} expectedRole="owner"><RouteTransition><NotificationsCenter /></RouteTransition></RoleGuard>} />
        <Route path="/roles/hos/communications" element={<RoleGuard auth={auth} expectedRole="hos"><RouteTransition><NotificationsCenter /></RouteTransition></RoleGuard>} />
        <Route path="/roles/hos/curriculum" element={<RoleGuard auth={auth} expectedRole="hos"><RouteTransition><CurriculumLibraryPage scope="school" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/exam-readiness" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><ExamReadinessPage /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/offline-notes" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><OfflineNotesPage /></RouteTransition></RoleGuard>} />
        <Route path="/roles/owner/exam-letterhead" element={<RoleGuard auth={auth} expectedRole="owner"><RouteTransition><ExamLetterheadPage dashboardLabel="Owner Dashboard" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/hos/exam-letterhead" element={<RoleGuard auth={auth} expectedRole="hos"><RouteTransition><ExamLetterheadPage dashboardLabel="Head of School" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/owner/submissions" element={<RoleGuard auth={auth} expectedRole="owner"><RouteTransition><SubmissionReviewPage dashboardLabel="Owner Dashboard" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/hos/submissions" element={<RoleGuard auth={auth} expectedRole="hos"><RouteTransition><SubmissionReviewPage dashboardLabel="Head of School" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/teacher/academic-history" element={<RoleGuard auth={auth} expectedRole="teacher"><RouteTransition><AcademicHistory role="teacher" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/last-session" element={<Navigate to="/roles/student/academic-history" replace />} />
        <Route path="/roles/teacher/last-session" element={<Navigate to="/roles/teacher/academic-history" replace />} />
        <Route path="/roles/student/materials" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentLessonNotes /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/lesson-notes" element={<Navigate to="/roles/student/materials" replace />} />
        {/* Lesson plans are for staff; an old student link goes to the dashboard. */}
        <Route path="/roles/student/lesson-plans" element={<Navigate to="/roles/student" replace />} />
        <Route path="/roles/student/practice" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentPractice /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/exams" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentExams /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/results" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentResults /></RouteTransition></RoleGuard>} />
        <Route path="/roles/student/medals" element={<RoleGuard auth={auth} expectedRole="student"><RouteTransition><StudentMedals /></RouteTransition></RoleGuard>} />
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
        <Route path="/roles/parent/notifications" element={<RoleGuard auth={auth} expectedRole="parent"><RouteTransition><ParentNotifications /></RouteTransition></RoleGuard>} />
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
        <Route path="/roles/accountant/communications" element={<RoleGuard auth={auth} expectedRole="accountant"><RouteTransition><NotificationsCenter /></RouteTransition></RoleGuard>} />
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
        <Route path="/roles/ami/home-showcase" element={<RoleGuard auth={auth} expectedRole="ami"><RouteTransition><AmiPage crumbs={['Reviews & Home Schools']}><AmiHomeShowcase /></AmiPage></RouteTransition></RoleGuard>} />
        <Route path="/roles/ami/pass-codes" element={<RoleGuard auth={auth} expectedRole="ami"><RouteTransition><AmiPage crumbs={['Pass Codes']}><AmiPassCodes /></AmiPage></RouteTransition></RoleGuard>} />
        <Route path="/roles/ami/country-prices" element={<RoleGuard auth={auth} expectedRole="ami"><RouteTransition><AmiPage crumbs={['Country Prices']}><AmiCountryPrices /></AmiPage></RouteTransition></RoleGuard>} />
        <Route path="/roles/ami/exam-requests" element={<RoleGuard auth={auth} expectedRole="ami"><RouteTransition><AmiPage crumbs={['Exam Requests']}><AmiExamRequests /></AmiPage></RouteTransition></RoleGuard>} />
        <Route path="/roles/:role/exam-requests" element={<RequireAuth auth={auth}><RouteTransition><ExamRequestPage /></RouteTransition></RequireAuth>} />
        <Route path="/roles/:role/feedback" element={<RequireAuth auth={auth}><RouteTransition><MyReviewPage /></RouteTransition></RequireAuth>} />
        <Route path="/roles/ami/messaging" element={<RoleGuard auth={auth} expectedRole="ami"><RouteTransition><AmiPage crumbs={['Inbox']}><AmiInbox /></AmiPage></RouteTransition></RoleGuard>} />
        <Route path="/roles/ami/communications" element={<RoleGuard auth={auth} expectedRole="ami"><RouteTransition><AmiPage crumbs={['Communications']}><AmiCommunications /></AmiPage></RouteTransition></RoleGuard>} />
        <Route path="/roles/ami/curriculum" element={<RoleGuard auth={auth} expectedRole="ami"><RouteTransition><AmiPage crumbs={['Curriculum Library']}><CurriculumLibraryPage scope="ami" /></AmiPage></RouteTransition></RoleGuard>} />
        <Route path="/roles/ami/school-closures" element={<RoleGuard auth={auth} expectedRole="ami"><RouteTransition><AmiPage crumbs={['School Closures']}><AmiSchoolClosuresPage /></AmiPage></RouteTransition></RoleGuard>} />
        <Route path="/roles/owner/school-closure" element={<RoleGuard auth={auth} expectedRole="owner"><RouteTransition><SchoolClosurePage dashboardLabel="Owner Dashboard" /></RouteTransition></RoleGuard>} />
        <Route path="/roles/hos/school-closure" element={<RoleGuard auth={auth} expectedRole="hos"><RouteTransition><SchoolClosurePage dashboardLabel="Head of School" /></RouteTransition></RoleGuard>} />
        {/* Shareholders: Ndovera's finances, read-only. */}
        <Route path="/roles/shareholder/*" element={<RoleGuard auth={auth} expectedRole="shareholder"><RouteTransition><ShareholderHome /></RouteTransition></RoleGuard>} />
        <Route path="/roles/ami/*" element={<RoleGuard auth={auth} expectedRole="ami"><RouteTransition><AmiDashboard /></RouteTransition></RoleGuard>} />
        <Route
          path="*"
          element={location.pathname === defaultAppRoute
            ? <RoleWithoutDashboard roleKey={authRole} />
            : <Navigate to={defaultAppRoute} replace />}
        />
      </Routes>
      </Suspense>
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
  // A new page opens at its top. The scrolling area is <main>, which keeps its position across
  // route changes, so opening an assignment from far down a list left it above the screen.
  const mainRef = useRef(null);
  useEffect(() => {
    try { mainRef.current?.scrollTo?.(0, 0); window.scrollTo?.(0, 0); } catch { /* old browsers */ }
  }, [location.pathname]);

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
    <div className="flex ndv-app-height overflow-hidden text-slate-900 dark:text-slate-100 transition-colors duration-500 dashboard-bg dark:bg-slate-950">
      {!mobileClassroomMode && !partnerWorkspace && <Sidebar mobileOpen={isSidebarOpen} onClose={handleCloseSidebar} />}
      <main ref={mainRef} className={`flex-1 min-h-0 relative ${inStudentClassroom ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'} ${inDashboardMode && !inStudentClassroom ? 'pb-[calc(8rem+var(--safe-bottom))] scroll-pb-[calc(8rem+var(--safe-bottom))] md:pb-0 md:scroll-pb-0' : ''}`}>
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
      <GlobalReadAloud />
      <AppDialogHost />
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

/** Reading aloud carries on across pages (and stops in Practice, Assignments and Exams). */
function GlobalReadAloud() {
  const location = useLocation();
  const navigate = useNavigate();
  return <ReadAloudPlayer pathname={location.pathname} search={location.search} onOpen={href => navigate(href)} />;
}

// When NDOVERA support (Ami) opens a school as its owner: the time left, "Task done", and a way
// back. When the owner's approval ends (time up, task done, deactivated), Ami returns by herself.
function ReturnToAmiBanner() {
  const returnToken = typeof window !== 'undefined' ? window.localStorage.getItem('ami_return_token') : '';
  const grant = (() => { try { return JSON.parse(window.localStorage.getItem('ami_support_grant') || 'null'); } catch { return null; } })();
  const [now, setNow] = useState(() => Date.now());
  function back(message) {
    persistAuth({ token: returnToken, user: { role: 'ami', name: 'Ami' } }, {});
    window.localStorage.removeItem('ami_return_token');
    window.localStorage.removeItem('ami_support_grant');
    if (message) { try { window.sessionStorage.setItem('ami_support_notice', message); } catch { /* ignore */ } }
    window.location.href = '/roles/ami';
  }
  useEffect(() => {
    if (!returnToken) return undefined;
    const tick = async () => {
      setNow(Date.now());
      if (grant?.until && Date.parse(grant.until) <= Date.now()) { back('Your support access to that school has ended (time is up).'); return; }
      // Ended early (task done elsewhere, or the owner deactivated it): the server refuses the session.
      try {
        const token = window.localStorage.getItem('token');
        const response = await fetch('/api/users/me', { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' });
        if (response.status === 401) back('Your support access to that school has ended.');
      } catch { /* offline: try again next time */ }
    };
    const timer = window.setInterval(tick, 60000);
    return () => window.clearInterval(timer);
  }, [returnToken]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!returnToken) return null;
  const left = grant?.until ? Math.max(0, Date.parse(grant.until) - now) : 0;
  const leftText = left ? `${Math.floor(left / 3600000)}h ${Math.floor((left % 3600000) / 60000)}m left` : '';
  async function done() {
    if (!await askConfirm('Mark this task done? Access to the school ends now; a new request is needed to continue.')) return;
    try {
      if (grant?.id) await fetch(`/api/ami/school-access/${encodeURIComponent(grant.id)}/complete`, { method: 'POST', headers: { Authorization: `Bearer ${returnToken}` } });
    } catch { /* the owner can still end it; it also ends when time is up */ }
    back('Task marked done. Access to that school has ended.');
  }
  return (
    <div className="fixed inset-x-0 bottom-0 z-[200] flex flex-wrap items-center justify-between gap-2 bg-[#800020] px-4 pt-2 pb-[calc(0.5rem+var(--safe-bottom))] text-sm text-white">
      <span>You are managing this school as its owner (NDOVERA support session){leftText ? ` · ${leftText}` : ''}. It ends when the time is up, when you mark the task done, or if the owner deactivates it.</span>
      <span className="flex gap-2">
        <button type="button" onClick={done} className="rounded-lg bg-[#1a5c38] px-3 py-1 text-xs font-bold text-white">Task done</button>
        <button type="button" onClick={() => back('')} className="rounded-lg bg-white px-3 py-1 text-xs font-bold text-[#800020]">Return to Ami</button>
      </span>
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
