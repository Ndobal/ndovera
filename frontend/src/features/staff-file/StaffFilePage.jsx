import React, { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import StudentSectionShell from '../../app/roles/student/StudentSectionShell';
import { getStaffFile } from './staffFileApi';
import { ActivityTab, AttendanceTab, FinanceTab, LoansTab, RecordsTab, ReportsTab, RewardsTab, ReviewsTab, SubmissionsTab, TasksTab } from './StaffFileTabs';
import { BODY, CARD, HEADING, INNER, LABEL, PRIMARY, SECONDARY, naira } from '../compliance/complianceUi';

// The Digital Staff Office File: one page for a member of staff, reached from
// their name anywhere in Ndovera. Tabs appear only where the viewer has access.

const SECTION_LABELS = { nursery: 'Nursery', primary: 'Primary', secondary: 'Secondary' };
const ATTENTION = { red: '🔴', orange: '🟠', yellow: '🟡' };

/** Wrap a staff member's name so it opens their file. */
export function StaffLink({ staffId, children, className = 'font-semibold underline-offset-2 hover:underline' }) {
  const location = useLocation();
  const role = location.pathname.split('/').filter(Boolean)[1] || 'teacher';
  if (!staffId) return <>{children}</>;
  return <Link to={`/roles/${role}/staff/${encodeURIComponent(staffId)}`} className={className}>{children}</Link>;
}

function Stat({ label, value }) {
  return (
    <div className={INNER}>
      <p className={LABEL}>{label}</p>
      <p className={`mt-1 text-xl font-black ${HEADING}`}>{value}</p>
    </div>
  );
}

export default function StaffFilePage({ staffId: fixedStaffId, dashboardLabel = 'Staff File' }) {
  const params = useParams();
  const staffId = fixedStaffId || decodeURIComponent(params.staffId || '');
  const [file, setFile] = useState(null);
  const [tab, setTab] = useState('overview');
  const [error, setError] = useState('');

  useEffect(() => {
    setFile(null);
    getStaffFile(staffId).then(data => { setFile(data); setError(''); }).catch(err => setError(err.message));
  }, [staffId]);

  if (error) return <StudentSectionShell title="Staff File" dashboardLabel={dashboardLabel}><p role="alert" className="text-sm font-semibold text-rose-700">{error}</p></StudentSectionShell>;
  if (!file) return <StudentSectionShell title="Staff File" dashboardLabel={dashboardLabel}><p role="status" className={BODY}>Loading…</p></StudentSectionShell>;

  const { profile, permissions, overview } = file;
  const isSelf = permissions.applyForLoan;
  const tabs = [
    { key: 'overview', label: 'Overview', show: true },
    { key: 'records', label: 'Employment & Records', show: true },
    { key: 'submissions', label: 'Submissions', show: permissions.submissions && file.teaching.length > 0 },
    { key: 'tasks', label: 'Tasks', show: permissions.tasks },
    { key: 'reviews', label: 'Reviews', show: permissions.reviews },
    { key: 'reports', label: 'Reports', show: permissions.reports || !isSelf },
    { key: 'loans', label: 'Loans', show: permissions.loans },
    { key: 'finance', label: 'Payroll', show: permissions.payroll },
    { key: 'attendance', label: 'Attendance', show: permissions.attendance },
    { key: 'rewards', label: 'Rewards', show: true },
    { key: 'activity', label: 'Activity', show: true },
  ].filter(item => item.show);
  const teachingLine = [...new Set(file.teaching.filter(item => item.subjectName).map(item => `${item.subjectName} ${item.className}`))].slice(0, 6).join(', ');

  return (
    <StudentSectionShell title={profile.name} dashboardLabel={dashboardLabel} subtitle={[profile.position || profile.roles.join(', '), profile.displayId ? `Staff ID: ${profile.displayId}` : ''].filter(Boolean).join(' · ')}>
      <div className="space-y-4">
        <section className={`${CARD} flex flex-wrap items-center gap-4`}>
          {profile.avatar
            ? <img src={profile.avatar} alt="" className="h-20 w-20 rounded-3xl object-cover" />
            : <span aria-hidden="true" className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-2xl font-black text-[#800000]">{profile.name.split(/\s+/).map(part => part[0]).slice(0, 2).join('')}</span>}
          <div className="min-w-0 flex-1">
            <h2 className={`text-2xl font-black ${HEADING}`}>{profile.name}</h2>
            <p className={`text-sm ${BODY}`}>
              <span className="mr-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold capitalize text-emerald-800">{profile.status} staff</span>
              {profile.roles.join(', ')}{file.sections.length ? ` · ${file.sections.map(section => SECTION_LABELS[section]).join(', ')}` : ''}{profile.employedOn ? ` · employed ${profile.employedOn}` : ''}
            </p>
            {teachingLine && <p className={`text-xs ${BODY}`}>Teaches {teachingLine}</p>}
            {overview.badges.length > 0 && <p className="mt-1 text-lg" title={overview.badges.map(badge => badge.title).join(', ')}>{overview.badges.map(badge => badge.badge).join(' ')}</p>}
          </div>
        </section>

        <nav className="flex flex-wrap gap-2" aria-label="Staff file sections">
          {tabs.map(item => <button key={item.key} type="button" aria-pressed={tab === item.key} onClick={() => setTab(item.key)} className={tab === item.key ? PRIMARY : SECONDARY}>{item.label}</button>)}
        </nav>

        {tab === 'overview' && (
          <div className="space-y-4">
            <section className={`${CARD} space-y-3`}>
              <h3 className={`font-black ${HEADING}`}>This week</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {overview.submissions && <Stat label="Submissions" value={`${overview.submissions.done}/${overview.submissions.total}`} />}
                {overview.attendanceRate != null && <Stat label="Attendance" value={`${overview.attendanceRate}%`} />}
                {permissions.tasks && <Stat label="Tasks" value={`${overview.openTasks} open`} />}
                {overview.latestReview && <Stat label="Review" value={`${overview.latestReview.overall}%`} />}
                {overview.loanOutstanding != null && <Stat label="Loan balance" value={naira(overview.loanOutstanding)} />}
                <Stat label="Rewards" value={overview.rewards} />
              </div>
            </section>
            <section className={`${CARD} space-y-2`}>
              <h3 className={`font-black ${HEADING}`}>Requires attention</h3>
              {!file.attention.length && <p className={`text-sm ${BODY}`}>Nothing needs attention.</p>}
              <ul className={`space-y-1 text-sm ${BODY}`}>{file.attention.map((item, index) => <li key={index}><span aria-hidden="true">{ATTENTION[item.level]}</span> {item.text}</li>)}</ul>
            </section>
            <section className={`${CARD} space-y-2`}>
              <h3 className={`font-black ${HEADING}`}>Recent activity</h3>
              {!file.activity.length && <p className={`text-sm ${BODY}`}>Nothing recorded yet.</p>}
              <ul className={`space-y-1 text-sm ${BODY}`}>{file.activity.map((entry, index) => <li key={index}>✓ {entry.text} <span className="text-xs opacity-70">— {new Date(entry.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span></li>)}</ul>
            </section>
          </div>
        )}
        {tab === 'records' && <RecordsTab staffId={profile.id} />}
        {tab === 'submissions' && <SubmissionsTab staffId={profile.id} />}
        {tab === 'tasks' && <TasksTab staffId={profile.id} />}
        {tab === 'reviews' && <ReviewsTab staffId={profile.id} />}
        {tab === 'reports' && <ReportsTab staffId={profile.id} isSelf={isSelf} />}
        {tab === 'loans' && <LoansTab staffId={profile.id} staffName={profile.name} />}
        {tab === 'finance' && <FinanceTab staffId={profile.id} />}
        {tab === 'attendance' && <AttendanceTab staffId={profile.id} />}
        {tab === 'rewards' && <RewardsTab staffId={profile.id} />}
        {tab === 'activity' && <ActivityTab staffId={profile.id} activity={file.activity} canAudit={permissions.investigateReports && !isSelf} />}
      </div>
    </StudentSectionShell>
  );
}
