import React from 'react';
import { useNavigate } from 'react-router-dom';
import { clearStoredAuth, getSignedOutRedirectPath } from '../../features/auth/services/authApi';

const ROLE_LABELS = {
  viceprincipal: 'Vice Principal',
  caregiver: 'Caregiver',
  nurseryhead: 'Nursery Head',
  hodassistant: 'HOD Assistant',
  tuckshopmanager: 'Tuck Shop Manager',
  storekeeper: 'Store Keeper',
  examofficer: 'Exam Officer',
  sportsmaster: 'Sports Master',
  growthpartner: 'Growth Partner',
};

function labelFor(roleKey) {
  const key = String(roleKey || '').trim().toLowerCase();
  if (!key) return 'This account';
  return ROLE_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Shown when a signed-in account holds a role the app has no dashboard for.
 *
 * The alternative — redirecting to some other role's home — is worse than it
 * looks: that page's guard sends the user straight back, the two trade redirects
 * forever, and the school sees a blank screen with nothing to act on. A dead end
 * that says what happened is recoverable; a white screen is not.
 */
export default function RoleWithoutDashboard({ roleKey }) {
  const navigate = useNavigate();
  const label = labelFor(roleKey);

  function signOut() {
    clearStoredAuth();
    window.location.replace(getSignedOutRedirectPath());
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-6 text-center dark:border-white/10 dark:bg-slate-900/40">
        <h1 className="text-xl font-black text-[#800000] dark:text-slate-100">
          No dashboard for {label} yet
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#191970] dark:text-slate-300">
          Your account is signed in, but this role has no workspace set up in the app.
          Ask the school owner to give you a role that does — or to add this one.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-2xl border border-[#c9a96e]/50 px-4 py-2 text-sm font-bold text-[#14215b] dark:border-white/20 dark:text-slate-200"
          >
            Go back
          </button>
          <button
            type="button"
            onClick={signOut}
            className="rounded-2xl bg-[#1a5c38] px-5 py-2 text-sm font-bold text-[#b5e3f4]"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
