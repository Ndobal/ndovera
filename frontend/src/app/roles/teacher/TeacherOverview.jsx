import React, { useEffect, useMemo, useState } from 'react';
import {
  AcademicCapIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  ArrowUpRightIcon,
  BookOpenIcon,
  ChartBarIcon,
  CheckBadgeIcon,
  ClipboardDocumentListIcon,
  EllipsisVerticalIcon,
  UsersIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/outline';
import MobileRoleOverviewNav from '../../../shared/components/MobileRoleOverviewNav';
import { getStoredAuth } from '../../../features/auth/services/authApi';
import { getTeacherDashboard } from '../../../services/roleDashboardService';

function pluralize(value, singular, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

// Material-style soft card
const CARD = 'rounded-2xl bg-white shadow-[0_2px_14px_rgba(20,33,91,0.07)] dark:bg-slate-800/50 dark:shadow-[0_2px_14px_rgba(0,0,0,0.35)]';

function GradientStatCard({ label, value, sub, icon: Icon, from, to }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-lg" style={{ backgroundImage: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}>
      <span className="pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full bg-white/10" />
      <span className="pointer-events-none absolute -right-10 top-6 h-28 w-28 rounded-full bg-white/10" />
      <div className="relative flex items-start justify-between">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/20">
          <Icon className="h-6 w-6" />
        </span>
        <EllipsisVerticalIcon className="h-5 w-5 opacity-70" />
      </div>
      <p className="relative mt-4 text-3xl font-extrabold tracking-tight">{value}</p>
      <p className="relative mt-1 text-sm font-medium text-white/80">{label}</p>
      {sub ? <p className="relative mt-3 text-xs text-white/70">{sub}</p> : null}
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, tint, trend }) {
  const positive = trend == null || String(trend).trim().startsWith('+');
  return (
    <div className={`${CARD} p-5`}>
      <div className="flex items-start justify-between">
        <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${tint}`}>
          <Icon className="h-6 w-6" />
        </span>
        {trend != null ? (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${positive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
            {positive ? <ArrowTrendingUpIcon className="h-3.5 w-3.5" /> : <ArrowTrendingDownIcon className="h-3.5 w-3.5" />}
            {trend}
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-3xl font-extrabold tracking-tight text-[#191970] dark:text-white">{value}</p>
      <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      {sub ? <p className="mt-2 text-xs text-slate-400">{sub}</p> : null}
    </div>
  );
}

function GrowthChart({ series, total }) {
  const max = Math.max(1, ...series.map(s => s.value));
  return (
    <div className={`${CARD} p-5`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Class Growth</p>
          <p className="mt-1 text-2xl font-extrabold text-[#191970] dark:text-white">{total} students</p>
        </div>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400">
          <ChartBarIcon className="h-6 w-6" />
        </span>
      </div>
      {series.length === 0 ? (
        <div className="mt-8 flex h-40 items-center justify-center text-sm text-slate-400">Class data will appear here once classes are assigned.</div>
      ) : (
        <div className="mt-6 flex h-44 items-end gap-2 sm:gap-3">
          {series.map((s, i) => (
            <div key={i} className="group flex flex-1 flex-col items-center justify-end">
              <span className="mb-1 text-[10px] font-bold text-[#2447d8] opacity-0 transition-opacity group-hover:opacity-100">{s.value}</span>
              <div
                className="w-full rounded-t-lg bg-gradient-to-t from-[#2447d8] to-[#5b8def] transition-all hover:from-[#1b34a8] hover:to-[#2447d8]"
                style={{ height: `${Math.max(6, (s.value / max) * 100)}%`, minHeight: 8 }}
                title={`${s.label}: ${s.value}`}
              />
              <span className="mt-2 w-full truncate text-center text-[10px] text-slate-400">{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PopularClasses({ classes }) {
  const rows = classes.slice(0, 6);
  return (
    <div className={`${CARD} p-5`}>
      <div className="flex items-center justify-between">
        <p className="text-base font-bold text-[#191970] dark:text-white">Popular Classes</p>
        <EllipsisVerticalIcon className="h-5 w-5 text-slate-400" />
      </div>
      <div className="mt-4 space-y-4">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-400">No classes assigned yet.</p>
        ) : (
          rows.map((c, i) => {
            const students = Number(c.studentCount || 0);
            const up = i % 2 === 0;
            return (
              <div key={c.id || c.className || i} className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-sm font-black text-blue-600 dark:text-blue-400">
                  {String(c.className || 'C').charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#191970] dark:text-white">{c.className || 'Class'}</p>
                  <p className="truncate text-xs text-slate-400">{pluralize(Number(c.assignmentCount || 0), 'assignment')} · {pluralize(Number(c.materialCount || 0), 'material')}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#191970] dark:text-white">{students}</p>
                  <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {up ? <ArrowTrendingUpIcon className="h-3 w-3" /> : <ArrowTrendingDownIcon className="h-3 w-3" />}
                    students
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function InfoPanel({ title, items }) {
  return (
    <div className={`${CARD} p-5`}>
      <p className="text-base font-bold text-[#191970] dark:text-white">{title}</p>
      <div className="mt-4 space-y-3">
        {items.map((item, i) => (
          <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-white/5 dark:bg-white/5">
            <p className="text-sm text-slate-700 dark:text-slate-200">{item.text}</p>
            {item.tag ? <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-[#2447d8] dark:text-blue-400">{item.tag}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TeacherOverview() {
  const storedAuth = getStoredAuth();
  const storedUser = storedAuth?.user || {};
  const storedName = storedUser.name && storedUser.name !== storedUser.id
    ? storedUser.name
    : storedUser.email || 'Teacher';

  const [data, setData] = useState({
    role: 'Teacher Dashboard',
    name: storedName,
    metrics: [],
    priorities: [],
    activity: [],
    classes: [],
    summary: {
      assignedClasses: 0,
      studentsReached: 0,
      activeSubjects: 0,
      reviewedSubmissions: 0,
      waitingReview: 0,
      assignmentsInClasses: 0,
      materialsInClasses: 0,
      activeLiveSessions: 0,
    },
  });

  useEffect(() => {
    let mounted = true;
    getTeacherDashboard().then(result => {
      if (!mounted || !result) return;
      setData(prev => ({
        ...prev,
        ...result,
        name: result.name && result.name !== 'User' ? result.name : storedName,
        metrics: Array.isArray(result.metrics) ? result.metrics : prev.metrics,
        priorities: Array.isArray(result.priorities) ? result.priorities : prev.priorities,
        activity: Array.isArray(result.activity) ? result.activity : prev.activity,
        classes: Array.isArray(result.classes) ? result.classes : prev.classes,
        summary: result.summary && typeof result.summary === 'object' ? { ...prev.summary, ...result.summary } : prev.summary,
      }));
    }).catch(() => {});
    return () => { mounted = false; };
  }, [storedName]);

  const s = data.summary || {};
  const classCount = Number(s.assignedClasses || data.classes.length || 0);
  const studentCount = Number(s.studentsReached || 0);

  const chartSeries = useMemo(() => (
    (data.classes || []).slice(0, 8).map(c => ({
      label: String(c.className || 'Class').replace(/\s+/g, ' ').slice(0, 6),
      value: Number(c.studentCount || 0),
    }))
  ), [data.classes]);

  const attentionItems = data.priorities.length > 0 ? data.priorities : [{ text: 'Live teacher priorities will appear here once classroom data is available.', tag: 'Waiting' }];
  const activityItems = data.activity.length > 0 ? data.activity : [{ text: 'Assignments, materials, live sessions, and review analytics appear here once you start using them.', tag: 'Waiting' }];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 pb-28 sm:px-6 md:pb-6">
      {/* Header */}
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#2447d8] dark:text-blue-400">Teacher Dashboard</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#191970] dark:text-white sm:text-3xl">Welcome, {data.name || storedName}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {classCount > 0
            ? `${pluralize(classCount, 'assigned class')} and ${pluralize(studentCount, 'student')} in your current teaching load.`
            : 'Your teaching analytics will appear here once classes and classroom activity are available.'}
        </p>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GradientStatCard label="Students Reached" value={studentCount} sub={`Across ${pluralize(classCount, 'class', 'classes')}`} icon={UsersIcon} from="#2447d8" to="#1b34a8" />
        <GradientStatCard label="Assignments" value={Number(s.assignmentsInClasses || 0)} sub={`${pluralize(Number(s.waitingReview || 0), 'submission')} waiting review`} icon={ClipboardDocumentListIcon} from="#3f51b5" to="#283593" />
        <StatCard label="Active Subjects" value={Number(s.activeSubjects || 0)} icon={BookOpenIcon} tint="bg-amber-500/10 text-amber-600 dark:text-amber-400" trend={`${pluralize(Number(s.materialsInClasses || 0), 'material')}`} />
        <StatCard label="Reviewed Submissions" value={Number(s.reviewedSubmissions || 0)} icon={CheckBadgeIcon} tint="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" trend={`${Number(s.activeLiveSessions || 0)} live`} />
      </div>

      {/* Growth chart + popular classes */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GrowthChart series={chartSeries} total={studentCount} />
        </div>
        <PopularClasses classes={data.classes || []} />
      </div>

      {/* Secondary metrics (from role dashboard service) */}
      {Array.isArray(data.metrics) && data.metrics.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {data.metrics.slice(0, 6).map(metric => (
            <div key={metric.label} className={`${CARD} p-4`}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{metric.label}</p>
              <p className="mt-1 text-xl font-extrabold text-[#191970] dark:text-white">{metric.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Info panels */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InfoPanel title="Attention Needed" items={attentionItems} />
        <InfoPanel title="Activity Snapshot" items={activityItems} />
      </div>

      {/* Quick stat strip */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Classes', value: classCount, icon: AcademicCapIcon },
          { label: 'Live Sessions', value: Number(s.activeLiveSessions || 0), icon: VideoCameraIcon },
          { label: 'Materials', value: Number(s.materialsInClasses || 0), icon: BookOpenIcon },
          { label: 'Waiting Review', value: Number(s.waitingReview || 0), icon: ArrowUpRightIcon },
        ].map(item => (
          <div key={item.label} className={`${CARD} flex items-center gap-3 p-4`}>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400">
              <item.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-lg font-extrabold text-[#191970] dark:text-white">{item.value}</p>
              <p className="text-[11px] font-medium text-slate-400">{item.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
