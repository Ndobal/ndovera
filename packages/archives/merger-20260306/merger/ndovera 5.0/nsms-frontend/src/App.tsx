import React from 'react';
import { Routes, Route, Navigate, Link, useLocation, Outlet } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { I18nProvider, useI18n } from './context/I18nContext';
import ThemeToggle from './components/ThemeToggle';
import LanguageSwitcher from './components/LanguageSwitcher';
import GlassCard from './components/GlassCard';
import OwnerLayout from './components/OwnerLayout';
import HOSLayout from './components/hos/HOSLayout';
import Dashboard from './pages/Dashboard';
import Schools from './pages/Schools';
import HOS from './pages/HOS';
import Teachers from './pages/Teachers';
import Staff from './pages/Staff';
import Students from './pages/Students';
import LAMS from './pages/LAMS';
import Payments from './pages/Payments';
import Analytics from './pages/Analytics';
import Website from './pages/Website';
import Settings from './pages/Settings';
import OwnerMedia from './pages/OwnerMedia';
import OwnerDropbox from './pages/OwnerDropbox';
import OwnerQuestionBank from './pages/OwnerQuestionBank';
import OwnerBulkResults from './pages/OwnerBulkResults';
import OwnerMessaging from './pages/OwnerMessaging';
import OwnerLiveEvents from './pages/OwnerLiveEvents';
import OwnerVideoGallery from './pages/OwnerVideoGallery';
import OwnerDataMigration from './pages/OwnerDataMigration';
import OwnerIdentity from './pages/OwnerIdentity';
import OwnerEventBus from './pages/OwnerEventBus';
import DashboardOwner from './pages/DashboardOwner';
import DashboardHOS from './pages/DashboardHOS';
import HOSDashboard from './pages/hos/HOSDashboard';
import HOSStaff from './pages/hos/HOSStaff';
import HOSTeachers from './pages/hos/HOSTeachers';
import HOSStudents from './pages/hos/HOSStudents';
import HOSClasses from './pages/hos/HOSClasses';
import HOSAcademics from './pages/hos/HOSAcademics';
import HOSHostel from './pages/hos/HOSHostel';
import HOSTransport from './pages/hos/HOSTransport';
import HOSTuckShop from './pages/hos/HOSTuckShop';
import HOSStore from './pages/hos/HOSStore';
import HOSSanitation from './pages/hos/HOSSanitation';
import HOSSecurity from './pages/hos/HOSSecurity';
import HOSFinance from './pages/hos/HOSFinance';
import HOSLAMS from './pages/hos/HOSLAMS';
import HOSAnalytics from './pages/hos/HOSAnalytics';
import HOSWebsite from './pages/hos/HOSWebsite';
import HOSApprovals from './pages/hos/HOSApprovals';
import HOSSettings from './pages/hos/HOSSettings';
import Subjects from './pages/hos/Subjects';
import HOSMedia from './pages/hos/HOSMedia';
import HOSDropbox from './pages/hos/HOSDropbox';
import HOSQuestionBank from './pages/hos/HOSQuestionBank';
import HOSBulkResults from './pages/hos/HOSBulkResults';
import HOSMessaging from './pages/hos/HOSMessaging';
import HOSLiveEvents from './pages/hos/HOSLiveEvents';
import HOSVideoGallery from './pages/hos/HOSVideoGallery';
import HOSDataMigration from './pages/hos/HOSDataMigration';
import HOSIdentity from './pages/hos/HOSIdentity';
import HOSEventBus from './pages/hos/HOSEventBus';
import HOSLessonNotes from './pages/hos/HOSLessonNotes';
import HOSCASheets from './pages/hos/HOSCASheets';
import HOSExams from './pages/hos/HOSExams';
import HOSResults from './pages/hos/HOSResults';
import HOSPromotions from './pages/hos/HOSPromotions';
import HOSPerformance from './pages/hos/HOSPerformance';
import HOSCalendar from './pages/hos/HOSCalendar';
import HOSHolidays from './pages/hos/HOSHolidays';
import HOSSignatures from './pages/hos/HOSSignatures';
import HOSAcademicAudit from './pages/hos/HOSAcademicAudit';
import DashboardTeacher from './pages/DashboardTeacher';
import DashboardStaff from './pages/DashboardStaff';
import DashboardStudent from './pages/DashboardStudent';
import DashboardParent from './pages/DashboardParent';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import SchoolPublicPreview from './pages/SchoolPublicPreview';

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useI18n();
  const location = useLocation();

  const roleLinks = [
    { to: '/owner/dashboard', label: t('welcomeOwner') },
    { to: '/hos/dashboard', label: t('welcomeHOS') },
    { to: '/teacher', label: t('welcomeTeacher') },
    { to: '/staff', label: t('welcomeStaff') },
    { to: '/student', label: t('welcomeStudent') },
    { to: '/parent', label: t('welcomeParent') },
  ];

  return (
    <div className="app-root">
      <div className="app-shell">
        {!location.pathname.startsWith('/student') && (
          <>
            <header className="app-header">
              <div className="app-logo">
                <div className="app-logo-mark" />
                <div>
                  <div className="app-logo-text-top">Ndovera</div>
                  <div className="app-logo-text-bottom">School Management System</div>
                </div>
              </div>
              <div className="app-header-actions">
                <ThemeToggle />
                <LanguageSwitcher />
              </div>
            </header>

            <div className="glass-card" style={{ marginBottom: '1rem' }}>
              <div className="glass-card-inner">
                <div className="pill-nav">
                  <Link
                    to="/login"
                    className={`pill-link ${location.pathname === '/login' ? 'pill-link-active' : 'pill-link-idle'}`}
                  >
                    {t('login')}
                  </Link>
                  <Link
                    to="/signup"
                    className={`pill-link ${location.pathname === '/signup' ? 'pill-link-active' : 'pill-link-idle'}`}
                  >
                    {t('signup')}
                  </Link>
                  {roleLinks.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className={`pill-link ${location.pathname === link.to ? 'pill-link-active' : 'pill-link-idle'}`}
                    >
                      {link.label}
                    </Link>
                  ))}
                  <Link
                    to="/school-preview"
                    className={`pill-link ${
                      location.pathname === '/school-preview' ? 'pill-link-active' : 'pill-link-idle'
                    }`}
                  >
                    School Public Site
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}

        <main className="app-main-grid">
          <div className="card-grid-2" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
            {children}
          </div>
          {!location.pathname.startsWith('/student') && (
            <div className="card-grid-2">
              <GlassCard title="System Status">
                <p className="text-muted">Offline-first UI scaffold. Backend integration pending.</p>
                <ul className="text-muted" style={{ listStyle: 'none', paddingLeft: 0, marginTop: '0.5rem' }}>
                  <li>• Core NSMS shell ready</li>
                  <li>• Role dashboards stubbed</li>
                  <li>• Theme and language contexts active</li>
                </ul>
              </GlassCard>
              <GlassCard title="Next Steps">
                <p className="text-muted">
                  Wire authentication, offline event store, and sync endpoints. Replace placeholder cards with
                  live module data.
                </p>
              </GlassCard>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

const ShellLayout: React.FC = () => (
  <Shell>
    <Outlet />
  </Shell>
);

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <I18nProvider>
        <Routes>
          <Route path="/owner" element={<OwnerLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="schools" element={<Schools />} />
            <Route path="hos" element={<HOS />} />
            <Route path="teachers" element={<Teachers />} />
            <Route path="staff" element={<Staff />} />
            <Route path="students" element={<Students />} />
            <Route path="lams" element={<LAMS />} />
            <Route path="payments" element={<Payments />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="website" element={<Website />} />
            <Route path="media" element={<OwnerMedia />} />
            <Route path="dropbox" element={<OwnerDropbox />} />
            <Route path="question-bank" element={<OwnerQuestionBank />} />
            <Route path="bulk-results" element={<OwnerBulkResults />} />
            <Route path="messaging" element={<OwnerMessaging />} />
            <Route path="live-events" element={<OwnerLiveEvents />} />
            <Route path="video-gallery" element={<OwnerVideoGallery />} />
            <Route path="data-migration" element={<OwnerDataMigration />} />
            <Route path="identity" element={<OwnerIdentity />} />
            <Route path="event-bus" element={<OwnerEventBus />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="/hos" element={<HOSLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<HOSDashboard />} />
            <Route path="staff" element={<HOSStaff />} />
            <Route path="teachers" element={<HOSTeachers />} />
            <Route path="students" element={<HOSStudents />} />
            <Route path="classes" element={<HOSClasses />} />
            <Route path="academics" element={<HOSAcademics />} />
            <Route path="lesson-notes" element={<HOSLessonNotes />} />
            <Route path="ca-sheets" element={<HOSCASheets />} />
            <Route path="exams" element={<HOSExams />} />
            <Route path="results" element={<HOSResults />} />
            <Route path="promotions" element={<HOSPromotions />} />
            <Route path="performance-analytics" element={<HOSPerformance />} />
            <Route path="calendar" element={<HOSCalendar />} />
            <Route path="holidays" element={<HOSHolidays />} />
            <Route path="signatures" element={<HOSSignatures />} />
            <Route path="academic-audit" element={<HOSAcademicAudit />} />
            <Route path="hostel" element={<HOSHostel />} />
            <Route path="transport" element={<HOSTransport />} />
            <Route path="tuck-shop" element={<HOSTuckShop />} />
            <Route path="store" element={<HOSStore />} />
            <Route path="sanitation" element={<HOSSanitation />} />
            <Route path="security" element={<HOSSecurity />} />
            <Route path="finance" element={<HOSFinance />} />
            <Route path="lams" element={<HOSLAMS />} />
            <Route path="analytics" element={<HOSAnalytics />} />
            <Route path="website" element={<HOSWebsite />} />
            <Route path="media" element={<HOSMedia />} />
            <Route path="dropbox" element={<HOSDropbox />} />
            <Route path="question-bank" element={<HOSQuestionBank />} />
            <Route path="bulk-results" element={<HOSBulkResults />} />
            <Route path="messaging" element={<HOSMessaging />} />
            <Route path="live-events" element={<HOSLiveEvents />} />
            <Route path="video-gallery" element={<HOSVideoGallery />} />
            <Route path="data-migration" element={<HOSDataMigration />} />
            <Route path="identity" element={<HOSIdentity />} />
            <Route path="event-bus" element={<HOSEventBus />} />
            <Route path="approvals" element={<HOSApprovals />} />
            <Route path="settings" element={<HOSSettings />} />
            <Route path="subjects" element={<Subjects />} />
          </Route>
          <Route element={<ShellLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/owner-legacy" element={<DashboardOwner />} />
            <Route path="/hos-legacy" element={<DashboardHOS />} />
            <Route path="/teacher" element={<DashboardTeacher />} />
            <Route path="/staff" element={<DashboardStaff />} />
            <Route path="/student" element={<DashboardStudent />} />
            <Route path="/parent" element={<DashboardParent />} />
            <Route path="/school-preview" element={<SchoolPublicPreview />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Route>
        </Routes>
      </I18nProvider>
    </ThemeProvider>
  );
};

export default App;
