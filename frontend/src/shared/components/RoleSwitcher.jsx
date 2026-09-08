import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const roleOptions = [
  { label: 'Student', path: '/roles/student' },
  { label: 'Parent', path: '/roles/parent' },
  { label: 'Caregiver', path: '/roles/caregiver' },
  { label: 'Teacher', path: '/roles/teacher' },
  { label: 'Admin', path: '/roles/admin' },
  { label: 'Head of School', path: '/roles/hos' },
  { label: 'Accountant', path: '/roles/accountant' },
  { label: 'Owner', path: '/roles/owner' },
  { label: 'Growth Partner', path: '/roles/growthpartner' },
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
  { label: 'Vice Principal', path: '/roles/viceprincipal' },
  { label: 'Head Teacher', path: '/roles/headteacher' },
  { label: 'Nursery Head', path: '/roles/nurseryhead' },
  { label: 'Exam Officer', path: '/roles/examofficer' },
  { label: 'Sports Master', path: '/roles/sportsmaster' },
  { label: 'Ami', path: '/roles/ami' },
];

function getRoleKeyFromPath(path) {
  return path.split('/')[2];
}

function normalizeRoles(values, fallbackRole = '') {
  const roles = [];
  const seen = new Set();

  const appendRole = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    roles.push(normalized);
  };

  (Array.isArray(values) ? values : String(values || '').split(',')).forEach(appendRole);
  if (!roles.length && fallbackRole) appendRole(fallbackRole);
  return roles;
}

/**
 * The roles this account may work as, and which one it is working as now.
 *
 * `switchableRoles` and nothing else. It is the server's own statement of what
 * this account may switch into, and the only set the app honours end to end: the
 * stored role is ignored unless it appears there, so every request would keep
 * going out as the previous role. Offering anything wider makes a menu that
 * changes the page but not who the user is — the new dashboard would load and
 * then answer 403 to its own data. Roles the server merges under Admin
 * (accountant, librarian, ICT and the rest) are reached by switching to Admin,
 * which is how it hands them over; Ami opens other schools through its own
 * support session rather than through this list.
 */
export function resolveRoleOptions(authUser) {
  const currentUserRole = String(authUser?.role || '').trim().toLowerCase();
  const switchable = new Set(normalizeRoles(authUser?.switchableRoles, currentUserRole));
  const options = roleOptions.filter(option => switchable.has(getRoleKeyFromPath(option.path)));

  let stored = '';
  try {
    stored = String(window.localStorage.getItem('selectedRole') || '').trim().toLowerCase();
  } catch {
    // A browser with site data blocked still gets a working switcher.
    stored = '';
  }

  const known = key => options.some(option => getRoleKeyFromPath(option.path) === key);
  const activeRole = (stored && known(stored) && stored)
    || (known(currentUserRole) && currentUserRole)
    || getRoleKeyFromPath(options[0]?.path || '')
    || currentUserRole;

  return { options, activeRole };
}

/**
 * Switch the account into another of its roles.
 *
 * The stored role is what the app reads on its next render and what every API
 * request carries in X-Selected-Role, so it is written before navigating —
 * otherwise the new dashboard's first requests would still be made as the old
 * role and its guard would bounce the user straight back.
 */
export function switchToRole(roleKey) {
  try {
    window.localStorage.setItem('selectedRole', roleKey);
  } catch {
    // Non-fatal: the route still changes, it just will not be remembered.
  }
}

/**
 * The role list inside the avatar menu. Renders nothing for the great majority
 * of people, who hold exactly one role and should not be shown a choice.
 */
export default function RoleSwitcher({ authUser = null, onSwitch = () => {} }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { options, activeRole } = resolveRoleOptions(authUser);

  if (options.length <= 1) return null;

  // The role in the address bar wins while the user is inside it: it is where
  // they actually are, whatever was last stored.
  const pathRole = location.pathname.startsWith('/roles/')
    ? location.pathname.split('/')[2] || ''
    : '';
  const current = options.some(option => getRoleKeyFromPath(option.path) === pathRole) ? pathRole : activeRole;

  function choose(option) {
    const roleKey = getRoleKeyFromPath(option.path);
    switchToRole(roleKey);
    onSwitch(roleKey);
    navigate(option.path);
  }

  return (
    <div className="border-b border-slate-100 dark:border-slate-800">
      <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        Switch role
      </p>
      <ul className="max-h-56 overflow-y-auto pb-2">
        {options.map(option => {
          const roleKey = getRoleKeyFromPath(option.path);
          const isCurrent = roleKey === current;
          return (
            <li key={option.path}>
              <button
                type="button"
                onClick={() => choose(option)}
                aria-current={isCurrent ? 'true' : undefined}
                className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm transition-colors ${
                  isCurrent
                    ? 'font-bold text-emerald-700 dark:text-emerald-300'
                    : 'text-slate-700 hover:bg-emerald-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-emerald-700/25 dark:hover:text-white'
                }`}
              >
                <span>{option.label}</span>
                {isCurrent ? <span aria-hidden="true">✓</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
