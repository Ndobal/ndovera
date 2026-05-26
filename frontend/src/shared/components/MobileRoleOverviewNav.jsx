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
  ShieldCheckIcon,
  Squares2X2Icon,
  UserGroupIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { getHeaderBarData } from '../../services/headerBarService';
import { getRoleSidebarItems } from './Sidebar';

const preferredPathsByRole = {
  ami: ['/roles/ami/tenants', '/roles/ami/messaging', '/roles/ami/security', '/roles/ami/reports'],
  student: ['/roles/student/classroom', '/roles/student/assignments', '/roles/student/materials', '/roles/student/messaging'],
  teacher: ['/roles/teacher/classroom', '/roles/teacher/materials', '/roles/teacher/assignments', '/roles/teacher/lesson-plan', '/roles/teacher/messaging'],
  owner: ['/roles/owner/schools', '/roles/owner/finance', '/roles/owner/people', '/roles/owner/messaging', '/roles/owner/approvals'],
  hos: ['/roles/hos/people', '/roles/hos/academics', '/roles/hos/admissions', '/roles/hos/messaging', '/roles/hos/approvals'],
  parent: ['/roles/parent/children', '/roles/parent/assignments', '/roles/parent/materials', '/roles/parent/messaging'],
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
  const [headerCounts, setHeaderCounts] = useState({ chats: 0, notifications: 0 });

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
    const items = primaryItems.map(item => ({ ...item, isMore: false }));
    items.push({ name: 'More', path: '#more', isMore: true });
    return items;
  }, [primaryItems]);

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
      <section className="bottom-nav bottom-nav--subtle light overflow-x-hidden px-3 py-2 md:hidden">
        <div className="mx-auto grid max-w-screen-sm grid-cols-5 gap-2 pb-1">
          {navItems.map(item => {
            const Icon = item.isMore ? EllipsisHorizontalCircleIcon : getItemIcon(item.name, item.path);
            const count = resolveCount(item);
            const active = !item.isMore && location.pathname === item.path;
            const content = (
              <>
                <span className="relative inline-flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                  {count > 0 ? (
                    <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#800020] px-1.5 py-0.5 text-[10px] font-bold text-[#f5deb3]">
                      {count > 99 ? '99+' : count}
                    </span>
                  ) : null}
                </span>
                <span className="label text-[10px] font-semibold text-[#191970]">{item.name}</span>
              </>
            );

            return item.isMore ? (
              <button
                key={item.name}
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="nav-button border border-[#c9a96e]/30 bg-[#fff8ee]/95 text-[#191970]"
              >
                {content}
              </button>
            ) : (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-button border ${active ? 'active border-[#800020]/25 bg-[#800020]/10 text-[#800020]' : 'border-[#c9a96e]/30 bg-[#fff8ee]/95 text-[#191970]'}`}
              >
                {content}
              </Link>
            );
          })}
        </div>
      </section>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm md:hidden" onClick={() => setDrawerOpen(false)} role="presentation">
          <div className="absolute bottom-0 left-0 right-0 rounded-t-[2rem] border border-[#c9a96e]/40 bg-[#fff8ee] p-5 shadow-[0_-20px_60px_rgba(128,0,0,0.18)]" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="More role actions">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#800020]">More Actions</p>
                <h2 className="text-lg font-bold text-[#800000]">{roleKey.toUpperCase()} shortcuts</h2>
              </div>
              <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-full border border-[#c9a96e]/40 p-2 text-[#800020]">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {allItems.map(item => {
                const Icon = getItemIcon(item.name, item.path);
                const count = resolveCount(item);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-3 rounded-2xl border border-[#c9a96e]/35 bg-white px-4 py-3 text-sm font-semibold text-[#191970]"
                  >
                    <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f5deb3] text-[#800020]">
                      <Icon className="h-5 w-5" />
                      {count > 0 ? (
                        <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#800020] px-1.5 py-0.5 text-[10px] font-bold text-[#f5deb3]">
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
    </>
  );
}
