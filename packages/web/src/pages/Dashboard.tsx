import React, { useMemo, useState } from 'react';
import { AlertCircle, BadgeCheck, BookOpen, Clock, RefreshCw, ShieldAlert, TrendingUp, Users, Video, Wallet } from 'lucide-react';
import { SchoolGuard } from '../components/SchoolGuard';
import { BillingLockBanner } from '../components/BillingLockBanner';
import { useData } from '../hooks/useData';
import { useBillingLock } from '../hooks/useBillingLock';
import { acknowledgePriceIncreaseNotice, type PriceIncreaseNotice, type StaffIncentiveReadiness } from '../services/monetizationApi';
import { Role } from '../types';
import { AdministrationDashboard } from '../features/dashboard/AdministrationDashboard';
import { DefaultDashboard } from '../features/dashboard/DefaultDashboard';
import { FinanceDashboard } from '../features/dashboard/FinanceDashboard';
import { FrontDeskDashboard } from '../features/dashboard/FrontDeskDashboard';
import { OperationsDashboard } from '../features/dashboard/OperationsDashboard';
import { ParentDashboard } from '../features/dashboard/ParentDashboard';
import { StudentDashboard } from '../features/dashboard/StudentDashboard';
import { TeacherDashboard } from '../features/dashboard/TeacherDashboard';
import type { DashboardStat } from '../features/dashboard/types';

function formatNaira(value: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatEffectiveDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
}

function PriceIncreaseBanner({ notice, onAction, busy }: { notice: PriceIncreaseNotice; busy: boolean; onAction: (noticeId: string, action: 'dismiss' | 'agree') => void }) {
  return (
    <section className="rounded-[1.8rem] border border-amber-400/20 bg-[linear-gradient(135deg,rgba(217,119,6,0.18),rgba(17,24,39,0.96))] p-5 text-white">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-100">
            <AlertCircle size={14} /> Price increase notice
          </div>
          <h3 className="mt-4 text-xl font-black">{notice.title}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-amber-50/90">{notice.message}</p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-amber-50/80">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">Current: {formatNaira(notice.currentAmountNaira)}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">New: {formatNaira(notice.newAmountNaira)}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">Effective: {formatEffectiveDate(notice.effectiveAt)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={busy} onClick={() => onAction(notice.id, 'dismiss')} className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-60">Close for today</button>
          <button type="button" disabled={busy} onClick={() => onAction(notice.id, 'agree')} className="rounded-2xl bg-amber-300 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-200 disabled:opacity-60">I have seen it and agree</button>
        </div>
      </div>
    </section>
  );
}

function IncentiveReadinessBanner({ readiness, onOpenPayslips }: { readiness: StaffIncentiveReadiness; onOpenPayslips?: (tab: string) => void }) {
  if (!readiness.eligible) return null;
  const tone = readiness.profile?.kycStatus === 'verified' ? 'emerald' : readiness.requiresProfileSubmission ? 'rose' : 'amber';
  return (
    <section className={`rounded-[1.8rem] border p-5 ${tone === 'emerald' ? 'border-emerald-500/20 bg-emerald-500/10' : tone === 'amber' ? 'border-amber-500/20 bg-amber-500/10' : 'border-rose-500/20 bg-rose-500/10'}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-200">
            {tone === 'emerald' ? <BadgeCheck size={14} /> : <ShieldAlert size={14} />} Staff incentive readiness
          </div>
          <h3 className="mt-4 text-xl font-black text-white">Top-50 focus mode incentive status</h3>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-300">You are currently ranked #{readiness.rank || '—'} for this period. Estimated payout: {formatNaira(readiness.payoutEstimateNaira)}. {readiness.requiresProfileSubmission ? 'Submit payout details once so future incentives can be processed.' : readiness.kycRequired ? 'Your details are saved, but KYC must verify before release.' : 'Your payout profile is verified and ready.'}</p>
        </div>
        <button type="button" onClick={() => onOpenPayslips?.('payslips')} className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/15">Open payslips</button>
      </div>
    </section>
  );
}

export const DashboardHome = ({ role, setActiveTab }: { role: Role; setActiveTab?: (tab: string) => void }) => {
  const { data: currentUser } = useData<any>('/api/users/me');
  const { shouldShowDashboardNotice, overdueInvoice, dismissNotice } = useBillingLock(role);
  const { data: priceNoticeData, mutate: refreshPriceNotices } = useData<{ notices: PriceIncreaseNotice[] }>('/api/finance/monetization/price-increase-notices');
  const { data: incentiveData } = useData<{ readiness: StaffIncentiveReadiness | null }>('/api/finance/payroll/incentive-readiness');
  const [noticeBusyId, setNoticeBusyId] = useState<string | null>(null);
  if (role && ['Super Admin'].includes(role)) return <SchoolGuard role={role} />;

  const { data: dashboardSummary } = useData<any>('/api/dashboard/summary');
  const { data: students } = useData<any[]>('/api/students');
  const { data: announcements } = useData<any[]>('/api/announcements');
  const { data: financeStats } = useData<any>('/api/finance/stats');
  const { data: teachers } = useData<any[]>('/api/teachers');
  const { data: children } = useData<any[]>('/api/parents/me/children');
  const { data: liveClassData } = useData<any[]>('/api/classroom/live-classes');

  const isStudent = role === 'Student';
  const isParent = role === 'Parent';
  const isTeacher = role === 'Teacher';
  const isAdministration = ['HOS', 'HoS', 'Owner', 'Tenant School Owner', 'Principal', 'Head Teacher', 'Nursery Head', 'HOD', 'Ami'].includes(role);
  const isFrontDesk = role === 'School Admin';
  const isFinance = role === 'Accountant' || role === 'Bursar';
  const isOperations = ['Librarian', 'Tuckshop Manager', 'Transport Manager', 'Clinic Officer'].includes(role);

  const studentSummary = dashboardSummary?.student;
  const teacherSummary = dashboardSummary?.teacher;
  const genericSummary = dashboardSummary?.generic;
  const dashboardAnnouncements = studentSummary?.announcements || teacherSummary?.announcements || genericSummary?.announcements || announcements || [];
  const visiblePriceNotices = useMemo(() => (priceNoticeData?.notices || []).filter((notice) => notice.showToday), [priceNoticeData?.notices]);
  const incentiveReadiness = incentiveData?.readiness || null;

  const handlePriceNoticeAction = async (noticeId: string, action: 'dismiss' | 'agree') => {
    setNoticeBusyId(noticeId);
    try {
      await acknowledgePriceIncreaseNotice({ noticeId, action });
      await refreshPriceNotices();
    } finally {
      setNoticeBusyId(null);
    }
  };

  const withBillingNotice = (content: React.ReactNode) => (
    <div className="space-y-6">
      {shouldShowDashboardNotice ? <BillingLockBanner invoiceId={overdueInvoice?.id} onDismiss={dismissNotice} compact /> : null}
      {visiblePriceNotices.map((notice) => <PriceIncreaseBanner key={notice.id} notice={notice} busy={noticeBusyId === notice.id} onAction={handlePriceNoticeAction} />)}
      {incentiveReadiness?.eligible ? <IncentiveReadinessBanner readiness={incentiveReadiness} onOpenPayslips={setActiveTab} /> : null}
      {content}
    </div>
  );

  const stats: DashboardStat[] = isStudent
    ? [
        { label: 'Latest Average', value: studentSummary?.stats?.latestAverage || '—', change: `${studentSummary?.stats?.subjectCount || 0} subjects`, icon: <TrendingUp size={16} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
        { label: 'Live Classes', value: String(studentSummary?.stats?.liveClassCount || 0), change: 'Ready', icon: <Clock size={16} />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        { label: 'Assignments', value: `${studentSummary?.stats?.pendingAssignments || 0} Due`, change: `${studentSummary?.stats?.submittedAssignments || 0} Submitted`, icon: <Users size={16} />, color: 'text-orange-400', bg: 'bg-orange-500/10' },
        { label: 'Updates', value: String(dashboardAnnouncements.length), change: 'School feed', icon: <AlertCircle size={16} />, color: 'text-red-400', bg: 'bg-red-500/10' },
      ]
    : isTeacher
      ? [
          { label: 'My Subjects', value: String(teacherSummary?.stats?.subjectCount || 0), change: `${teacherSummary?.stats?.classCount || 0} classes`, icon: <BookOpen size={16} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Assignments', value: String(teacherSummary?.stats?.assignmentCount || 0), change: `${teacherSummary?.stats?.pendingGrading || 0} to review`, icon: <Users size={16} />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Lesson Plans', value: String(teacherSummary?.stats?.lessonPlanCount || 0), change: 'Planner live', icon: <Clock size={16} />, color: 'text-orange-400', bg: 'bg-orange-500/10' },
          { label: 'Live Rooms', value: String(teacherSummary?.stats?.liveClassCount || 0), change: 'Connected', icon: <Video size={16} />, color: 'text-purple-400', bg: 'bg-purple-500/10' },
        ]
      : isAdministration
        ? [
            { label: 'Total Collections', value: financeStats ? `₦${(financeStats.totalCollected / 1000000).toFixed(1)}M` : '...', change: financeStats ? `₦${(financeStats.outstanding / 1000000).toFixed(1)}M due` : '...', icon: <Wallet size={16} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            { label: 'Active Students', value: students?.length || '...', change: '+5% this term', icon: <TrendingUp size={16} />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { label: 'Total Staff', value: teachers?.length || '...', change: 'Stable', icon: <Users size={16} />, color: 'text-purple-400', bg: 'bg-purple-500/10' },
            { label: 'Active Subjects', value: teacherSummary?.stats?.subjectCount || genericSummary?.stats?.subjectCount || 0, change: `${teacherSummary?.stats?.classCount || 0} Classes`, icon: <BookOpen size={16} />, color: 'text-orange-400', bg: 'bg-orange-500/10' },
          ]
        : isParent
          ? [
              { label: 'Children', value: children?.length || 0, change: 'Active', icon: <Users size={16} />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
              { label: 'Avg. Grade', value: 'B+', change: '+5%', icon: <TrendingUp size={16} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
              { label: 'Attendance', value: '98%', change: 'Good', icon: <Clock size={16} />, color: 'text-orange-400', bg: 'bg-orange-500/10' },
              { label: 'Fees Paid', value: '₦120k', change: '₦15k Bal', icon: <AlertCircle size={16} />, color: 'text-red-400', bg: 'bg-red-500/10' },
            ]
          : isFrontDesk
            ? [
                { label: 'Check-ins Today', value: '184', change: '+12', icon: <Users size={16} />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                { label: 'Active Inquiries', value: '12', change: '-3', icon: <AlertCircle size={16} />, color: 'text-orange-400', bg: 'bg-orange-500/10' },
                { label: 'Announcements', value: '3', change: 'Live', icon: <RefreshCw size={16} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                { label: 'Pending Approvals', value: '8', change: 'Urgent', icon: <Clock size={16} />, color: 'text-red-400', bg: 'bg-red-500/10' },
              ]
            : isFinance
              ? [
                  { label: 'Total Collections', value: '₦12.5M', change: '+15%', icon: <Wallet size={16} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                  { label: 'Outstanding Balance', value: '₦2.1M', change: '-5%', icon: <AlertCircle size={16} />, color: 'text-orange-400', bg: 'bg-orange-500/10' },
                  { label: 'Daily Inflow', value: '₦450k', change: '+2%', icon: <TrendingUp size={16} />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                  { label: 'Pending Invoices', value: '34', change: '-12', icon: <Clock size={16} />, color: 'text-red-400', bg: 'bg-red-500/10' },
                ]
              : isOperations
                ? [
                    { label: 'Active Tasks', value: '24', change: '+3', icon: <TrendingUp size={16} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { label: 'Pending Requests', value: '12', change: '-2', icon: <Clock size={16} />, color: 'text-orange-400', bg: 'bg-orange-500/10' },
                    { label: 'Issues Reported', value: '5', change: 'Stable', icon: <AlertCircle size={16} />, color: 'text-red-400', bg: 'bg-red-500/10' },
                    { label: 'Training Left', value: String(genericSummary?.stats?.pendingTraining || 0), change: 'Compliance', icon: <RefreshCw size={16} />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                  ]
                : [
                    { label: 'Total Students', value: students?.length || '...', change: '+12%', icon: <Users size={16} />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                    { label: 'Avg. Attendance', value: '94%', change: '+2%', icon: <TrendingUp size={16} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { label: 'Active Staff', value: teachers?.length || '...', change: '0%', icon: <Clock size={16} />, color: 'text-orange-400', bg: 'bg-orange-500/10' },
                    { label: 'Pending Fees', value: financeStats ? `₦${(financeStats.outstanding / 1000000).toFixed(1)}M` : '...', change: '-5%', icon: <AlertCircle size={16} />, color: 'text-red-400', bg: 'bg-red-500/10' },
                  ];

  if (isStudent) return withBillingNotice(<StudentDashboard role={role} currentUser={currentUser} setActiveTab={setActiveTab} stats={stats} studentSummary={studentSummary} liveClassData={liveClassData ?? undefined} announcements={dashboardAnnouncements} />);
  if (isTeacher) return withBillingNotice(<TeacherDashboard role={role} currentUser={currentUser} setActiveTab={setActiveTab} stats={stats} teacherSummary={teacherSummary} />);
  if (isParent) return withBillingNotice(<ParentDashboard role={role} currentUser={currentUser} setActiveTab={setActiveTab} stats={stats} children={children ?? undefined} announcements={dashboardAnnouncements} financeStats={financeStats} />);
  if (isFrontDesk) return withBillingNotice(<FrontDeskDashboard role={role} currentUser={currentUser} setActiveTab={setActiveTab} stats={stats} />);
  if (isAdministration) return withBillingNotice(<AdministrationDashboard role={role} currentUser={currentUser} setActiveTab={setActiveTab} stats={stats} financeStats={financeStats} students={students ?? undefined} teachers={teachers ?? undefined} liveClassData={liveClassData ?? undefined} teacherSummary={teacherSummary} />);
  if (isFinance) return withBillingNotice(<FinanceDashboard role={role} currentUser={currentUser} setActiveTab={setActiveTab} stats={stats} financeStats={financeStats} />);
  if (isOperations) return withBillingNotice(<OperationsDashboard role={role} currentUser={currentUser} setActiveTab={setActiveTab} stats={stats} />);
  return withBillingNotice(<DefaultDashboard role={role} currentUser={currentUser} stats={stats} />);
};