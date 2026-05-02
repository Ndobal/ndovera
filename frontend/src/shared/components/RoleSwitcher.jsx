import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const roleOptions = [
  { label: 'Student', path: '/roles/student' },
  { label: 'Parent', path: '/roles/parent' },
  { label: 'Teacher', path: '/roles/teacher' },
  { label: 'Head of School', path: '/roles/hos' },
  { label: 'Accountant', path: '/roles/accountant' },
  { label: 'Owner', path: '/roles/owner' },
  { label: 'Librarian', path: '/roles/librarian' },
  { label: 'Sanitation Officer', path: '/roles/sanitation' },
  { label: 'Tuck Shop Manager', path: '/roles/tuckshopmanager' },
  { label: 'Store Keeper', path: '/roles/storekeeper' },
  { label: 'Transport Officer', path: '/roles/transport' },
  { label: 'Hostel Officer', path: '/roles/hostel' },
  { label: 'Cafeteria Manager', path: '/roles/cafeteria' },
  { label: 'Clinic Officer', path: '/roles/clinic' },
  { label: 'ICT Officer', path: '/roles/ict' },
  { label: 'Class Teacher', path: '/roles/classteacher' },
  { label: 'HOD', path: '/roles/hod' },
  { label: 'HOD Assistant', path: '/roles/hodassistant' },
  { label: 'Principal', path: '/roles/principal' },
  { label: 'Head Teacher', path: '/roles/headteacher' },
  { label: 'Nursery Head', path: '/roles/nurseryhead' },
  { label: 'Exam Officer', path: '/roles/examofficer' },
  { label: 'Sports Master', path: '/roles/sportsmaster' },
  { label: 'Ami', path: '/roles/ami' },
];

function getRoleKeyFromPath(path) {
  return path.split('/')[2];
}

export default function RoleSwitcher({ authUser = null }) {
  const navigate = useNavigate();
  const location = useLocation();

  const currentUserRole = authUser?.role || 'student';
  const canSwitchAllRoles = currentUserRole === 'ami';
  const availableOptions = canSwitchAllRoles
    ? roleOptions
    : roleOptions.filter(option => getRoleKeyFromPath(option.path) === currentUserRole);

  const selectedRole = canSwitchAllRoles
    ? (localStorage.getItem('selectedRole') || currentUserRole)
    : currentUserRole;
  const selectedPath = `/roles/${selectedRole}`;
  const currentPath = availableOptions.some(option => option.path === location.pathname)
    ? location.pathname
    : selectedPath;

  const handleSwitchRole = event => {
    if (!canSwitchAllRoles) {
      navigate(selectedPath);
      return;
    }

    const nextPath = event.target.value;
    const nextRole = getRoleKeyFromPath(nextPath);
    localStorage.setItem('selectedRole', nextRole);
    navigate(nextPath);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="micro-label neon-subtle hidden sm:inline">Switch Role</span>
      <select
        value={currentPath}
        onChange={handleSwitchRole}
        className="glass-chip text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400"
        aria-label="Switch dashboard role"
        disabled={!canSwitchAllRoles}
      >
        {availableOptions.map(option => (
          <option key={option.path} value={option.path}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
