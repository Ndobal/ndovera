import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

// Four items live in the mobile bar; everything else lives behind "More". The first three
// are the ones a partner opens daily, so they get the permanent slots.
export const PARTNER_NAV = [
  { key: 'overview', label: 'Overview', icon: '🏠', path: '/roles/growthpartner', end: true, primary: true },
  { key: 'referrals', label: 'Referrals', icon: '🏫', path: '/roles/growthpartner/referrals', primary: true },
  { key: 'messages', label: 'Messages', icon: '💬', path: '/roles/growthpartner/messages', primary: true },
  { key: 'community', label: 'Community', icon: '👥', path: '/roles/growthpartner/community' },
  { key: 'earnings', label: 'Earnings', icon: '💰', path: '/roles/growthpartner/earnings' },
  { key: 'pricing', label: 'Code pricing', icon: '🏷️', path: '/roles/growthpartner/pricing' },
  { key: 'toolkit', label: 'Toolkit', icon: '🧰', path: '/roles/growthpartner/toolkit' },
  { key: 'verification', label: 'Verification', icon: '🪪', path: '/roles/growthpartner/verification' },
  { key: 'bank', label: 'Payout account', icon: '🏦', path: '/roles/growthpartner/bank' },
  { key: 'security', label: 'Security', icon: '🔒', path: '/roles/growthpartner/security' },
];

const PRIMARY = PARTNER_NAV.filter(item => item.primary);
const SECONDARY = PARTNER_NAV.filter(item => !item.primary);

function linkClass(isActive) {
  return `flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
    isActive
      ? 'bg-[#800020] text-[#b5e3f4]'
      : 'text-[#191970] hover:bg-[#efd4a0]/60 dark:text-slate-200 dark:hover:bg-slate-800'
  }`;
}

export default function PartnerShell({ partnerName, unreadCount = 0, children }) {
  const [trayOpen, setTrayOpen] = useState(false);
  const location = useLocation();

  // Any secondary page being open should light up "More" in the mobile bar.
  const onSecondary = SECONDARY.some(item => location.pathname.startsWith(item.path));

  return (
    <div className="min-h-screen bg-[#fff8ee] dark:bg-slate-950">
      <div className="mx-auto flex max-w-7xl gap-6 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-6 rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-4 dark:border-white/10 dark:bg-slate-900/40">
            <p className="px-2 text-xs font-bold uppercase tracking-[0.22em] text-[#800020] dark:text-slate-400">Growth Partner</p>
            <p className="mt-1 truncate px-2 text-lg font-black text-[#191970] dark:text-slate-100">{partnerName || 'Partner'}</p>
            <nav className="mt-4 space-y-1">
              {PARTNER_NAV.map(item => (
                <NavLink key={item.key} to={item.path} end={item.end} className={({ isActive }) => linkClass(isActive)}>
                  <span aria-hidden="true">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {item.key === 'messages' && unreadCount > 0 ? (
                    <span className="rounded-full bg-[#1a5c38] px-2 py-0.5 text-[11px] font-bold text-white">{unreadCount}</span>
                  ) : null}
                </NavLink>
              ))}
            </nav>
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-5">{children}</main>
      </div>

      {/* Mobile: three fixed destinations plus a tray for the rest. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#c9a96e]/40 bg-[#b5e3f4] pb-[env(safe-area-inset-bottom)] lg:hidden dark:border-white/10 dark:bg-slate-900">
        <div className="grid grid-cols-4">
          {PRIMARY.map(item => (
            <NavLink
              key={item.key}
              to={item.path}
              end={item.end}
              onClick={() => setTrayOpen(false)}
              className={({ isActive }) => `relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-bold transition ${
                isActive && !trayOpen ? 'text-[#800020] dark:text-fuchsia-300' : 'text-[#191970]/70 dark:text-slate-400'
              }`}
            >
              <span className="text-lg" aria-hidden="true">{item.icon}</span>
              {item.label}
              {item.key === 'messages' && unreadCount > 0 ? (
                <span className="absolute right-1/4 top-1 rounded-full bg-[#1a5c38] px-1.5 text-[10px] font-bold text-white">{unreadCount}</span>
              ) : null}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setTrayOpen(open => !open)}
            aria-expanded={trayOpen}
            aria-label="More pages"
            className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-bold transition ${
              trayOpen || onSecondary ? 'text-[#800020] dark:text-fuchsia-300' : 'text-[#191970]/70 dark:text-slate-400'
            }`}
          >
            <span className="text-lg" aria-hidden="true">{trayOpen ? '✕' : '⋯'}</span>
            More
          </button>
        </div>
      </nav>

      {trayOpen ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setTrayOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          />
          <div className="fixed inset-x-0 bottom-[4.25rem] z-50 mx-3 rounded-3xl border border-[#c9a96e]/40 bg-[#fff8ee] p-3 shadow-2xl lg:hidden dark:border-white/10 dark:bg-slate-900">
            <div className="grid grid-cols-3 gap-2">
              {SECONDARY.map(item => (
                <NavLink
                  key={item.key}
                  to={item.path}
                  onClick={() => setTrayOpen(false)}
                  className={({ isActive }) => `flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-center text-[11px] font-bold transition ${
                    isActive ? 'bg-[#800020] text-[#b5e3f4]' : 'bg-[#b5e3f4] text-[#191970] dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  <span className="text-xl" aria-hidden="true">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
