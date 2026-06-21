import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AcademicCapIcon,
  BanknotesIcon,
  BuildingOffice2Icon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  EllipsisHorizontalCircleIcon,
  PresentationChartBarIcon,
  QrCodeIcon,
  ShieldCheckIcon,
  Squares2X2Icon,
  UserGroupIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { getHeaderBarData } from '../../services/headerBarService';
import { getRoleSidebarItems } from './Sidebar';
import StaffSignIn from '../../features/attendance/components/StaffSignIn';
import StaffSubmissionPanel from '../../features/submissions/StaffSubmissionPanel';

const STAFF_ROLES = ['teacher', 'hos', 'owner', 'admin'];

const preferredPathsByRole = {
  ami: ['/roles/ami/tenants', '/roles/ami/messaging', '/roles/ami/security', '/roles/ami/reports'],
  student: ['/roles/student/classroom', '/roles/student/assignments', '/roles/student/materials', '/roles/student/messaging'],
  teacher: ['/roles/teacher/classroom', '/roles/teacher/materials', '/roles/teacher/assignments', '/roles/teacher/lesson-plan', '/roles/teacher/messaging'],
  owner: ['/roles/owner/schools', '/roles/owner/finance', '/roles/owner/people', '/roles/owner/messaging', '/roles/owner/approvals'],
  hos: ['/roles/hos/people', '/roles/hos/academics', '/roles/hos/admissions', '/roles/hos/messaging', '/roles/hos/approvals'],
  parent: ['/roles/parent/children', '/roles/parent/materials', '/roles/parent/fees', '/roles/parent/messaging'],
};

function getItemIcon(name, path) {
  const target = `${String(name || '')} ${String(path || '')}`.toLowerCase();
  if (target.includes('security') || target.includes('audit') || target.includes('compliance')) return ShieldCheckIcon;
  if (target.includes('tenant') || target.includes('school')) return BuildingOffice2Icon;
  if (target.includes('people') || target.includes('staff') || target.includes('children')) return UserGroupIcon;
  if (target.includes('finance') || target.includes('fees') || target.includes('payroll') || target.includes('receipt')) return BanknotesIcon;
  if (target.includes('classroom') || target.includes('class')) return AcademicCapIcon;
  if (target.includes('assignment') || target.includes('approval')) return ClipboardDocumentListIcon;
  if (target.includes('material') || target.includes('lesson') || target.includes('note')) return DocumentTextIcon;
  if (target.includes('message') || target.includes('chat') || target.includes('inbox')) return ChatBubbleLeftRightIcon;
  if (target.includes('report') || target.includes('result') || target.includes('analytics')) return PresentationChartBarIcon;
  if (target.includes('setting')) return Cog6ToothIcon;
  return Squares2X2Icon;
}

function normalizeCount(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function buildPrimaryItems(roleKey, allItems) {
  const seen = new Set();
  const byPath = new Map(allItems.map(item => [item.path, item]));
  const preferred = (preferredPathsByRole[roleKey] || [])
    .map(path => byPath.get(path))
    .filter(Boolean)
    .filter(item => {
      if (seen.has(item.path)) return false;
      seen.add(item.path);
      return true;
    });

  const fallback = allItems.filter(item => {
    const path = String(item.path || '').toLowerCase();
    if (seen.has(item.path)) return false;
    if (path === `/roles/${roleKey}`) return false;
    if (path.endsWith('/settings')) return false;
    if (path.endsWith('/library') || path.endsWith('/library-admin')) return false;
    if (path.endsWith('/newsroom')) return false;
    return true;
  });

  return [...preferred, ...fallback].slice(0, 4);
}

export default function MobileRoleOverviewNav({ roleKey, counts = {} }) {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [headerCounts, setHeaderCounts] = useState({ chats: 0, notifications: 0 });
  const isStaff = STAFF_ROLES.includes(roleKey);

  const allItems = useMemo(() => getRoleSidebarItems(roleKey) || [], [roleKey]);
  const primaryItems = useMemo(() => buildPrimaryItems(roleKey, allItems), [allItems, roleKey]);

  useEffect(() => {
    let mounted = true;
    getHeaderBarData(roleKey)
      .then(data => {
        if (!mounted) return;
        setHeaderCounts({
          chats: normalizeCount(data?.chats),
          notifications: normalizeCount(data?.notifications),
        });
      })
      .catch(() => {
        if (!mounted) return;
        setHeaderCounts({ chats: 0, notifications: 0 });
      });

    return () => {
      mounted = false;
    };
  }, [roleKey]);

  const navItems = useMemo(() => {
    const items = primaryItems.slice(0, isStaff ? 3 : 4).map(item => ({ ...item, isMore: false, isSignIn: false }));
    if (isStaff) items.push({ name: 'Sign in', path: '#signin', isSignIn: true });
    items.push({ name: 'More', path: '#more', isMore: true });
    return items;
  }, [primaryItems, isStaff]);

  function resolveCount(item) {
    if (item.isMore) return headerCounts.notifications;
    const name = String(item.name || '').toLowerCase();
    const path = String(item.path || '').toLowerCase();

    if (name.includes('message') || name.includes('chat') || name.includes('inbox') || path.includes('/messaging')) {
      return headerCounts.chats;
    }
    if (name.includes('assignment') || path.includes('/assignments')) {
      return normalizeCount(counts.assignments);
    }
    if (name.includes('material') || name.includes('lesson') || path.includes('/materials') || path.includes('/lesson')) {
      return normalizeCount(counts.materials);
    }
    if (name.includes('approval') || path.includes('/approvals')) {
      return normalizeCount(counts.approvals);
    }
    if (name.includes('tenant') || name.includes('school')) {
      return normalizeCount(counts.tenants || counts.schools);
    }

    return 0;
  }

  return (
    <>
      <div className="h-24 md:hidden" />
      <section className="bottom-nav bottom-nav--subtle light overflow-x-hidden px-2 py-2 md:hidden">
        <div className="mx-auto grid w-full max-w-screen-sm grid-cols-5 gap-1.5 pb-1">
          {navItems.map(item => {
            const Icon = item.isMore ? EllipsisHorizontalCircleIcon : item.isSignIn ? QrCodeIcon : getItemIcon(item.name, item.path);
            const count = resolveCount(item);
            const active = !item.isMore && !item.isSignIn && location.pathname === item.path;
            const content = (
              <>
                <span className="relative inline-flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                  {count > 0 ? (
                    <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#2447d8] px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {count > 99 ? '99+' : count}
                    </span>
                  ) : null}
                </span>
                <span className="label text-[10px] font-semibold text-[#191970]">{item.name}</span>
              </>
            );

            if (item.isSignIn) {
              return (
                <button
                  key="signin"
                  type="button"
                  onClick={() => setSignInOpen(true)}
                  className="nav-button border border-[#2447d8] bg-[#2447d8] text-white"
                >
                  <span className="relative inline-flex items-center justify-center">
                    <QrCodeIcon className="h-5 w-5" />
                  </span>
                  <span className="label text-[10px] font-bold text-white">Sign in</span>
                </button>
              );
            }

            return item.isMore ? (
              <button
                key={item.name}
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="nav-button border border-[#2447d8]/20 bg-white/95 text-[#191970]"
              >
                {content}
              </button>
            ) : (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-button border ${active ? 'active border-[#2447d8]/30 bg-[#2447d8]/10 text-[#2447d8]' : 'border-[#2447d8]/20 bg-white/95 text-[#191970]'}`}
              >
                {content}
              </Link>
            );
          })}
        </div>
      </section>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm md:hidden" onClick={() => setDrawerOpen(false)} role="presentation">
          <div className="absolute bottom-0 left-0 right-0 flex max-h-[82vh] flex-col rounded-t-[2rem] border border-[#2447d8]/30 bg-white shadow-[0_-20px_60px_rgba(20,33,91,0.18)]" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="More role actions">
            <div className="flex items-center justify-between gap-3 rounded-t-[2rem] border-b border-[#2447d8]/10 bg-white px-5 pb-3 pt-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#2447d8]">More Actions</p>
                <h2 className="text-lg font-bold text-[#191970]">{roleKey.toUpperCase()} shortcuts</h2>
              </div>
              <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-full border border-[#2447d8]/30 p-2 text-[#2447d8]">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 overflow-y-auto px-5 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              {allItems.map(item => {
                const Icon = getItemIcon(item.name, item.path);
                const count = resolveCount(item);
                if (item.path === '#submit-work') {
                  return (
                    <button
                      key="submit-work"
                      type="button"
                      onClick={() => { setDrawerOpen(false); setSubmitOpen(true); }}
                      className="flex items-center gap-3 rounded-2xl border border-[#2447d8] bg-[#2447d8] px-4 py-3 text-sm font-semibold text-white"
                    >
                      <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 text-white">📤</span>
                      <span>Submit Work</span>
                    </button>
                  );
                }
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-3 rounded-2xl border border-[#2447d8]/20 bg-white px-4 py-3 text-sm font-semibold text-[#191970]"
                  >
                    <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e8edff] text-[#2447d8]">
                      <Icon className="h-5 w-5" />
                      {count > 0 ? (
                        <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#2447d8] px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {count > 99 ? '99+' : count}
                        </span>
                      ) : null}
                    </span>
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {signInOpen ? <StaffSignIn onClose={() => setSignInOpen(false)} /> : null}

      {submitOpen ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center overflow-y-auto bg-slate-950/60 backdrop-blur-sm p-0 sm:items-center sm:p-4" onClick={() => setSubmitOpen(false)} role="presentation">
          <div className="w-full max-w-lg" onClick={event => event.stopPropagation()}>
            <div className="mb-2 flex justify-end">
              <button type="button" onClick={() => setSubmitOpen(false)} className="rounded-full bg-white/90 p-2 text-[#191970] shadow">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <StaffSubmissionPanel role={roleKey} />
          </div>
        </div>
      ) : null}
    </>
  );
}
