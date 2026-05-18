import React from 'react';
import { Link, Navigate } from 'react-router-dom';

const ADMIN_ROLE_META = {
  accountant: {
    label: 'Accountant',
    path: '/roles/accountant',
    description: 'Manage fees, payroll, reconciliation, and finance records.',
  },
  librarian: {
    label: 'Librarian',
    path: '/roles/librarian',
    description: 'Manage catalogue, borrowing, returns, and digital library access.',
  },
  sanitation: {
    label: 'Sanitation Officer',
    path: '/roles/sanitation',
    description: 'Track sanitation inspections, schedules, and incident response.',
  },
  tuckshopmanager: {
    label: 'Tuck Shop Manager',
    path: '/roles/tuckshopmanager',
    description: 'Handle stock, sales, pricing, and tuck-shop orders.',
  },
  storekeeper: {
    label: 'Store Keeper',
    path: '/roles/storekeeper',
    description: 'Control stock receiving, requisitions, audits, and inventory.',
  },
  transport: {
    label: 'Transport Officer',
    path: '/roles/transport',
    description: 'Monitor transport schedules, fleet tasks, and reporting.',
  },
  hostel: {
    label: 'Hostel Officer',
    path: '/roles/hostel',
    description: 'Manage hostel operations, student welfare, and boarding records.',
  },
  cafeteria: {
    label: 'Cafeteria Manager',
    path: '/roles/cafeteria',
    description: 'Coordinate cafeteria operations, meal service, and reporting.',
  },
  clinic: {
    label: 'Clinic Officer',
    path: '/roles/clinic',
    description: 'Oversee clinic logs, treatments, and health-response workflows.',
  },
  ict: {
    label: 'ICT Officer',
    path: '/roles/ict',
    description: 'Manage ICT operations, people workflows, and technical support.',
  },
  examofficer: {
    label: 'Exam Officer',
    path: '/roles/examofficer',
    description: 'Coordinate exams, schedules, and assessment operations.',
  },
  sportsmaster: {
    label: 'Sports Master',
    path: '/roles/sportsmaster',
    description: 'Manage sports programming, fixtures, and athletics reporting.',
  },
};

function getAdminRoleCards(adminRoles = []) {
  return adminRoles.map(roleKey => ({
    roleKey,
    ...(ADMIN_ROLE_META[roleKey] || {
      label: roleKey.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/(^|\s)\S/g, match => match.toUpperCase()),
      path: `/roles/${roleKey}`,
      description: 'Open the assigned operational dashboard for this responsibility.',
    }),
  }));
}

export default function AdminDashboard({ auth = null }) {
  const adminRoles = Array.isArray(auth?.user?.adminRoles) ? auth.user.adminRoles : [];
  const cards = getAdminRoleCards(adminRoles);
  const fallbackRole = auth?.user?.switchableRoles?.find(role => role !== 'admin') || auth?.user?.role || 'teacher';

  if (cards.length === 0) {
    return <Navigate to={`/roles/${fallbackRole}`} replace />;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <section className="rounded-3xl border border-[#c9a96e]/40 bg-[#f5deb3] p-6 shadow-sm dark:border-cyan-300/20 dark:bg-slate-900/30">
        <p className="micro-label text-[#800020] dark:text-[#bf00ff]">Merged Admin Role</p>
        <h1 className="mt-2 text-3xl font-black text-[#800000] dark:text-[#0000ff]">Admin Workspace</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#191970] dark:text-[#39ff14]">
          This account carries multiple operational responsibilities. Open any assigned admin dashboard below without switching away from the merged admin role.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(card => (
          <article
            key={card.roleKey}
            className="rounded-3xl border border-[#c9a96e]/40 bg-[#f5deb3] p-5 shadow-sm transition-transform hover:-translate-y-0.5 dark:border-cyan-300/20 dark:bg-slate-900/30"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#800020] dark:text-[#bf00ff]">Assigned Role</p>
            <h2 className="mt-3 text-2xl font-black text-[#800000] dark:text-[#0000ff]">{card.label}</h2>
            <p className="mt-3 text-sm leading-6 text-[#191970] dark:text-[#39ff14]">{card.description}</p>
            <Link
              to={card.path}
              className="mt-5 inline-flex items-center rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#f5deb3] transition-colors hover:bg-[#154a2e] dark:bg-[#00ffff] dark:text-black dark:hover:bg-[#7dfcff]"
            >
              Open dashboard
            </Link>
          </article>
        ))}
      </section>
    </div>
  );
}