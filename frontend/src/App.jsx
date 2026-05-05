import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './shared/components/Sidebar';
import LoginPage from './features/auth/pages/LoginPage';
import ChangePasswordPage from './features/auth/pages/ChangePasswordPage';
import SchoolRegistrationPage from './features/tenants/pages/SchoolRegistrationPage';
import { getStoredAuth, persistAuth, clearStoredAuth } from './features/auth/services/authApi';

// Role dashboards
import OwnerDashboard from './app/roles/OwnerDashboard';
import AmiDashboard from './app/roles/AmiDashboard';
import HoSDashboard from './app/roles/HoSDashboard';
import TeacherDashboard from './app/roles/TeacherDashboard';
import StudentDashboard from './app/roles/StudentDashboard';
import ParentDashboard from './app/roles/ParentDashboard';
import AccountantDashboard from './app/roles/AccountantDashboard';
import OperationalRoleDashboard from './app/roles/OperationalRoleDashboard';

// Legacy pages (still accessible under /roles/:role/*)
import Library from './app/Library';
import RoleLibrary from './app/RoleLibrary';

import './shared/styles/theme.css';

const ROLE_TO_DASHBOARD = {
  owner: OwnerDashboard,
  ami: AmiDashboard,
  hos: HoSDashboard,
  teacher: TeacherDashboard,
  student: StudentDashboard,
  parent: ParentDashboard,
  accountant: AccountantDashboard,
};

const OPERATIONAL_ROLES = new Set([
  'librarian','sanitation','tuckshopmanager','storekeeper','transport',
  'hostel','cafeteria','clinic','ict','classteacher','hod','hodassistant',
  'principal','headteacher','nurseryhead','examofficer','sportsmaster',
]);

function RequireAuth({ auth, children }) {
  const location = useLocation();
  if (!auth) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return children;
}

function DashboardLayout({ auth, onLogout, children }) {
  return (
    <div className="flex h-screen">
      <div className="h-full overflow-y-auto flex-shrink-0" style={{ minWidth: 256, maxWidth: 256 }}>
        <Sidebar auth={auth} onLogout={onLogout} />
      </div>
      <main className="flex-1 h-full overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

function RolePage({ auth, onLogout }) {
  const location = useLocation();
  const parts = location.pathname.split('/').filter(Boolean);
  const role = parts[1];

  const DashboardComponent = ROLE_TO_DASHBOARD[role];
  if (DashboardComponent) {
    return (
      <DashboardLayout auth={auth} onLogout={onLogout}>
        <DashboardComponent auth={auth} />
      </DashboardLayout>
    );
  }

  if (OPERATIONAL_ROLES.has(role)) {
    return (
      <DashboardLayout auth={auth} onLogout={onLogout}>
        <OperationalRoleDashboard roleKey={role} auth={auth} />
      </DashboardLayout>
    );
  }

  return <Navigate to="/login" replace />;
}

export default function App() {
  const [auth, setAuth] = useState(() => getStoredAuth());

  useEffect(() => {
    // Sync auth from storage if updated by another tab
    const onStorage = (e) => {
      if (e.key === 'authUser' || e.key === 'token') {
        setAuth(getStoredAuth());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const handleLogin = (authData) => {
    persistAuth(authData);
    setAuth(authData);
  };

  const handleLogout = () => {
    clearStoredAuth();
    setAuth(null);
  };

  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            auth && !auth.user?.mustChangePassword
              ? <Navigate to={`/roles/${auth.user?.role || 'student'}`} replace />
              : <LoginPage onLogin={handleLogin} />
          }
        />
        <Route
          path="/change-password"
          element={<ChangePasswordPage onLogin={handleLogin} />}
        />
        <Route
          path="/register-school"
          element={<SchoolRegistrationPage />}
        />

        {/* Legacy library routes (keep for backward compat) */}
        <Route
          path="/roles/:role/library"
          element={
            <RequireAuth auth={auth}>
              <DashboardLayout auth={auth} onLogout={handleLogout}>
                <RoleLibrary />
              </DashboardLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/library/admin"
          element={
            <RequireAuth auth={auth}>
              <DashboardLayout auth={auth} onLogout={handleLogout}>
                <Library />
              </DashboardLayout>
            </RequireAuth>
          }
        />

        {/* All role dashboard routes */}
        <Route
          path="/roles/:role/*"
          element={
            <RequireAuth auth={auth}>
              <RolePage auth={auth} onLogout={handleLogout} />
            </RequireAuth>
          }
        />

        {/* Root redirect */}
        <Route
          path="/"
          element={
            auth
              ? <Navigate to={`/roles/${auth.user?.role || 'student'}`} replace />
              : <Navigate to="/login" replace />
          }
        />

        {/* Catch-all */}
        <Route
          path="*"
          element={
            auth
              ? <Navigate to={`/roles/${auth.user?.role || 'student'}`} replace />
              : <Navigate to="/login" replace />
          }
        />
      </Routes>
    </Router>
  );
}
