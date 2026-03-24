import React, { useMemo, useState } from 'react';
import {
  Users,
  UserPlus,
  MoreVertical,
  Mail,
  GraduationCap,
  Briefcase,
  QrCode,
  Lock,
  Unlock,
  BadgeCheck,
} from 'lucide-react';

import { useData } from '../hooks/useData';
import { SmartIDManager } from '../features/management/components/SmartIDManager';
import { fetchWithAuth } from '../services/apiClient';
import { loadUser } from '../services/authLocal';
import { BillingLockBanner } from '../components/BillingLockBanner';
import { useBillingLock } from '../hooks/useBillingLock';

type ActiveTab = 'students' | 'teachers' | 'parents' | 'alumni' | 'id_cards';

type DirectoryUser = {
  id: string;
  schoolId: string;
  schoolName: string;
  name: string;
  email?: string | null;
  status: 'active' | 'inactive';
  category: 'student' | 'staff' | 'parent' | 'admin' | 'alumni' | 'global';
  roles: string[];
  activeRole: string;
  aliases: string[];
  createdAt: string;
  updatedAt: string;
};

type DirectoryLifecycleEvent = {
  id: string;
  userId: string;
  action: 'deactivated' | 'reactivated';
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  reason?: string;
  createdAt: string;
};

type DirectoryStudent = {
  id: string;
  schoolId: string;
  schoolName: string;
  userId: string;
  name: string;
  parentUserIds: string[];
  status: 'active' | 'transferred' | 'alumni';
  previousUserIds: string[];
  createdAt: string;
  updatedAt: string;
};

type DirectoryResponse = {
  schoolId: string;
  users: DirectoryUser[];
  students: DirectoryStudent[];
  lifecycleEvents?: DirectoryLifecycleEvent[];
};

type ResultSummary = {
  promotion?: string;
};

type ResultTerm = {
  name: string;
  summary: ResultSummary;
};

type ResultSession = {
  session: string;
  terms: ResultTerm[];
};

type StudentResultRecord = {
  studentId: string;
  studentName: string;
  className: string;
  classSection?: string;
  sessions: ResultSession[];
};

type ClassroomResultsResponse = {
  studentResults?: StudentResultRecord[];
};

type ManagementCardRecord = {
  id: string;
  name: string;
  email?: string | null;
  status?: 'active' | 'inactive';
  headline: string;
  detail: string;
  badge: string;
  badgeTone: 'emerald' | 'blue' | 'violet' | 'amber' | 'slate';
  primaryType: 'student' | 'staff' | 'parent' | 'alumni';
  canGraduate?: boolean;
  graduateDisabled?: boolean;
  graduateReason?: string;
  graduationLabel?: string;
  linkedStudentId?: string;
  lifecycleSummary?: string | null;
};

function normalizeText(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function formatLifecycleSummary(event?: DirectoryLifecycleEvent | null) {
  if (!event) return null;
  const actor = event.actorName || event.actorId || 'System';
  const actionLabel = event.action === 'deactivated' ? 'Deactivated' : 'Reactivated';
  const timestamp = new Date(event.createdAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return `${actionLabel} by ${actor}${event.actorRole ? ` • ${event.actorRole}` : ''} • ${timestamp}`;
}

function normalizeSection(value?: string) {
  const normalized = normalizeText(value);
  if (!normalized) return '';
  if (normalized === 'pre-school' || normalized === 'primary' || normalized === 'junior-secondary' || normalized === 'senior-secondary') return normalized;
  if (/(pre[- ]school|preschool|nursery|reception)/.test(normalized)) return 'pre-school';
  if (/(primary|grade|basic)/.test(normalized)) return 'primary';
  if (/(jss|jhs|junior secondary)/.test(normalized)) return 'junior-secondary';
  if (/(sss|ss\s*[123]|shs|senior secondary)/.test(normalized)) return 'senior-secondary';
  return '';
}

function inferSectionFromClassName(className?: string) {
  return normalizeSection(className);
}

function parseClassRank(className?: string, classSection?: string) {
  const normalizedName = normalizeText(className);
  const section = normalizeSection(classSection) || inferSectionFromClassName(className);
  const numberMatch = normalizedName.match(/(?:^|\D)(\d{1,2})(?:\D|$)/);
  if (numberMatch) return Number(numberMatch[1]);
  if (/(final|graduating|graduation|leavers)/.test(normalizedName)) return 999;
  if (section === 'pre-school' && /(kg\s*2|kindergarten\s*2)/.test(normalizedName)) return 2;
  return 0;
}

function pickLatestTerm(record?: StudentResultRecord | null) {
  if (!record?.sessions?.length) return null;
  const latestSession = [...record.sessions].sort((left, right) => right.session.localeCompare(left.session))[0];
  if (!latestSession?.terms?.length) return null;
  return [...latestSession.terms].sort((left, right) => {
    const leftNum = Number(String(left.name || '').replace(/\D/g, '') || '0');
    const rightNum = Number(String(right.name || '').replace(/\D/g, '') || '0');
    return rightNum - leftNum;
  })[0] || null;
}

function determineGraduatingSection(records: StudentResultRecord[]) {
  const sections = new Set(records.map((record) => normalizeSection(record.classSection) || inferSectionFromClassName(record.className)).filter(Boolean));
  if (sections.has('senior-secondary')) return 'senior-secondary';
  if (sections.has('junior-secondary')) return 'junior-secondary';
  if (sections.has('primary')) return 'primary';
  if (sections.has('pre-school')) return 'pre-school';
  return '';
}

function graduationReadiness(allResults: StudentResultRecord[], resultRecord?: StudentResultRecord | null) {
  if (!resultRecord) {
    return { finalClass: false, eligible: false, reason: 'No result record found yet.' };
  }
  const graduatingSection = determineGraduatingSection(allResults);
  if (!graduatingSection) {
    return { finalClass: false, eligible: false, reason: 'No class progression data found yet.' };
  }
  const targetSection = normalizeSection(resultRecord.classSection) || inferSectionFromClassName(resultRecord.className);
  if (targetSection !== graduatingSection) {
    return { finalClass: false, eligible: false, reason: 'This learner is not in the school\'s current final graduating section.' };
  }
  const sameSectionRecords = allResults.filter((record) => (normalizeSection(record.classSection) || inferSectionFromClassName(record.className)) === graduatingSection);
  const highestRank = Math.max(...sameSectionRecords.map((record) => parseClassRank(record.className, record.classSection)), 0);
  const targetRank = parseClassRank(resultRecord.className, resultRecord.classSection);
  if (highestRank > 0 && targetRank < highestRank) {
    return { finalClass: false, eligible: false, reason: 'This learner is not in the highest class yet.' };
  }
  const latestTerm = pickLatestTerm(resultRecord);
  if (!latestTerm) {
    return { finalClass: true, eligible: false, reason: 'No term result found yet.' };
  }
  const termNumber = Number(String(latestTerm.name || '').replace(/\D/g, '') || '0');
  if (termNumber && termNumber < 3) {
    return { finalClass: true, eligible: false, reason: 'Awaiting third-term promotion.' };
  }
  if (normalizeText(latestTerm.summary?.promotion) !== 'promoted') {
    return { finalClass: true, eligible: false, reason: 'Latest promotion badge is not Promoted.' };
  }
  return { finalClass: true, eligible: true, reason: 'Ready for alumni graduation.' };
}

function badgeToneFromType(type: ManagementCardRecord['primaryType']): ManagementCardRecord['badgeTone'] {
  if (type === 'student') return 'blue';
  if (type === 'staff') return 'emerald';
  if (type === 'parent') return 'violet';
  return 'amber';
}

function badgeToneClass(tone: ManagementCardRecord['badgeTone']) {
  if (tone === 'emerald') return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
  if (tone === 'blue') return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
  if (tone === 'violet') return 'bg-violet-500/10 text-violet-400 border-violet-500/20';
  if (tone === 'amber') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  return 'bg-white/5 text-zinc-300 border-white/10';
}

export const ManagementView = ({ searchQuery }: { searchQuery?: string }) => {
  const currentUser = loadUser();
  const currentRole = currentUser?.activeRole || currentUser?.roles?.[0] || '';
  const canManageGraduation = ['HoS', 'HOS', 'Owner', 'Tenant School Owner'].includes(currentRole);
  const [activeTab, setActiveTab] = useState<ActiveTab>('students');
  const [showInactive, setShowInactive] = useState(false);
  const [actionState, setActionState] = useState<{ busyId: string | null; message: string | null; error: string | null }>({ busyId: null, message: null, error: null });

  const { data: directory, loading: directoryLoading, error: directoryError, refetch: refetchDirectory } = useData<DirectoryResponse>('/api/users/directory?includeInactive=1');
  const { data: results, refetch: refetchResults } = useData<ClassroomResultsResponse>('/api/classroom/results');

  const users = Array.isArray(directory?.users) ? directory.users : [];
  const studentRecords = Array.isArray(directory?.students) ? directory.students : [];
  const lifecycleEvents = Array.isArray(directory?.lifecycleEvents) ? directory.lifecycleEvents : [];
  const resultRecords = Array.isArray(results?.studentResults) ? results.studentResults : [];

  const resultByStudentId = useMemo(() => new Map(resultRecords.map((record) => [record.studentId, record])), [resultRecords]);
  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const latestLifecycleEventByUserId = useMemo(() => {
    const next = new Map<string, DirectoryLifecycleEvent>();
    lifecycleEvents.forEach((event) => {
      if (!next.has(event.userId)) next.set(event.userId, event);
    });
    return next;
  }, [lifecycleEvents]);
  const inactiveUserCount = useMemo(() => users.filter((user) => user.status === 'inactive').length, [users]);

  const parentCards = useMemo<ManagementCardRecord[]>(() => users.filter((user) => user.category === 'parent').map((user) => {
    const linkedChildren = studentRecords.filter((student) => student.parentUserIds.includes(user.id));
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      headline: linkedChildren.length ? `${linkedChildren.length} child${linkedChildren.length === 1 ? '' : 'ren'} linked` : 'No linked children yet',
      detail: linkedChildren.length ? linkedChildren.map((student) => student.name).join(', ') : 'Parent account',
      badge: 'Parent',
      badgeTone: badgeToneFromType('parent'),
      primaryType: 'parent',
      lifecycleSummary: formatLifecycleSummary(latestLifecycleEventByUserId.get(user.id)),
    };
  }), [latestLifecycleEventByUserId, studentRecords, users]);

  const staffCards = useMemo<ManagementCardRecord[]>(() => users.filter((user) => user.category === 'staff' || user.category === 'admin').map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    headline: user.activeRole || user.roles[0] || 'Staff',
    detail: user.roles.join(', '),
    badge: user.category === 'admin' ? 'Admin' : 'Staff',
    badgeTone: badgeToneFromType('staff'),
    primaryType: 'staff',
    lifecycleSummary: formatLifecycleSummary(latestLifecycleEventByUserId.get(user.id)),
  })), [latestLifecycleEventByUserId, users]);

  const studentCards = useMemo<ManagementCardRecord[]>(() => studentRecords.filter((student) => student.status !== 'alumni').map((student) => {
    const linkedUser = usersById.get(student.userId);
    const resultRecord = resultByStudentId.get(student.id) || null;
    const readiness = graduationReadiness(resultRecords, resultRecord);
    const latestTerm = pickLatestTerm(resultRecord);
    const className = resultRecord?.className || 'No class on result record yet';
    return {
      id: linkedUser?.id || student.userId,
      linkedStudentId: student.id,
      name: student.name,
      email: linkedUser?.email,
      status: linkedUser?.status || 'active',
      headline: className,
      detail: latestTerm ? `${latestTerm.name} • ${latestTerm.summary?.promotion || 'Pending review'}` : readiness.reason,
      badge: readiness.finalClass ? 'Graduating class' : 'Student',
      badgeTone: badgeToneFromType('student'),
      primaryType: 'student',
      canGraduate: canManageGraduation && readiness.finalClass,
      graduateDisabled: !readiness.eligible,
      graduateReason: readiness.reason,
      graduationLabel: readiness.eligible ? 'Graduate to Alumni' : 'Not ready',
      lifecycleSummary: formatLifecycleSummary(linkedUser ? latestLifecycleEventByUserId.get(linkedUser.id) : undefined),
    };
  }), [canManageGraduation, latestLifecycleEventByUserId, resultByStudentId, resultRecords, studentRecords, usersById]);

  const alumniCards = useMemo<ManagementCardRecord[]>(() => users.filter((user) => user.category === 'alumni').map((user) => {
    const linkedStudent = studentRecords.find((student) => student.userId === user.id);
    const resultRecord = linkedStudent ? resultByStudentId.get(linkedStudent.id) : null;
    return {
      id: user.id,
      linkedStudentId: linkedStudent?.id,
      name: user.name,
      email: user.email,
      status: user.status,
      headline: resultRecord?.className || 'Alumni record',
      detail: resultRecord ? `Latest class: ${resultRecord.className}` : 'Graduated learner',
      badge: 'Alumni',
      badgeTone: badgeToneFromType('alumni'),
      primaryType: 'alumni',
      lifecycleSummary: formatLifecycleSummary(latestLifecycleEventByUserId.get(user.id)),
    };
  }), [latestLifecycleEventByUserId, resultByStudentId, studentRecords, users]);

  const sourceList = useMemo(() => {
    if (activeTab === 'students') return studentCards;
    if (activeTab === 'teachers') return staffCards;
    if (activeTab === 'parents') return parentCards;
    if (activeTab === 'alumni') return alumniCards;
    return [] as ManagementCardRecord[];
  }, [activeTab, alumniCards, parentCards, staffCards, studentCards]);

  const list = useMemo(() => {
    const statusFiltered = showInactive ? sourceList : sourceList.filter((item) => item.status !== 'inactive');
    if (!searchQuery) return statusFiltered;
    const normalizedQuery = searchQuery.toLowerCase();
    return statusFiltered.filter((item) => item.name.toLowerCase().includes(normalizedQuery) || String(item.headline || '').toLowerCase().includes(normalizedQuery) || String(item.detail || '').toLowerCase().includes(normalizedQuery) || String(item.status || '').toLowerCase().includes(normalizedQuery));
  }, [searchQuery, showInactive, sourceList]);

  const handleToggleUserStatus = async (item: ManagementCardRecord) => {
    const nextStatus = item.status === 'inactive' ? 'active' : 'inactive';
    const actionLabel = nextStatus === 'inactive' ? 'deactivate' : 'reactivate';
    if (!confirm(`Are you sure you want to ${actionLabel} ${item.name}?`)) return;
    setActionState({ busyId: item.id, message: null, error: null });
    try {
      await fetchWithAuth(`/api/users/${encodeURIComponent(item.id)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      await refetchDirectory();
      setActionState({ busyId: null, message: `${item.name} is now ${nextStatus}.`, error: null });
    } catch (error) {
      setActionState({ busyId: null, message: null, error: error instanceof Error ? error.message : 'Status update failed.' });
    }
  };

  const handleGraduate = async (item: ManagementCardRecord) => {
    if (!item.linkedStudentId) return;
    if (item.graduateDisabled) return;
    if (!confirm(`Graduate ${item.name} to Alumni? This moves the learner out of active student status and keeps access under Alumni.`)) return;
    setActionState({ busyId: item.linkedStudentId, message: null, error: null });
    try {
      await fetchWithAuth(`/api/students/${encodeURIComponent(item.linkedStudentId)}/graduate-to-alumni`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Graduated from the school\'s highest class after promotion' }),
      });
      await Promise.all([refetchDirectory(), refetchResults()]);
      setActionState({ busyId: null, message: `${item.name} has been graduated to Alumni.`, error: null });
    } catch (error) {
      setActionState({ busyId: null, message: null, error: error instanceof Error ? error.message : 'Graduation failed.' });
    }
  };

  const headerCounts = {
    students: studentCards.length,
    teachers: staffCards.length,
    parents: parentCards.length,
    alumni: alumniCards.length,
  };
  const { softLockActive, overdueInvoice } = useBillingLock('Tenant School Owner');

  return (
    <div className="space-y-6">
      {softLockActive ? <BillingLockBanner invoiceId={overdueInvoice?.id} dismissible={false} compact /> : null}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Institutional Management</h2>
          <p className="text-zinc-500 text-xs">Manage school users, track graduating classes, and move promoted final-year learners into alumni.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-300">
            <span>Active {users.length - inactiveUserCount}</span>
            <span className="text-zinc-600">/</span>
            <span className="text-rose-300">Inactive {inactiveUserCount}</span>
          </div>
          <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-300">
            <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
            Show inactive
          </label>
          <button disabled={softLockActive} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors shadow-lg shadow-emerald-900/20 flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50">
            <UserPlus size={16} /> Add {activeTab === 'students' ? 'Student' : activeTab === 'parents' ? 'Parent' : activeTab === 'alumni' ? 'Alumni' : 'Staff'}
          </button>
        </div>
      </div>

      {actionState.message ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs text-emerald-200">{actionState.message}</div> : null}
      {actionState.error ? <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-200">{actionState.error}</div> : null}
      {directoryError ? <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-200">{directoryError}</div> : null}

      <div className="flex items-center gap-4 border-b border-white/5 overflow-x-auto">
        <button onClick={() => setActiveTab('students')} className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all relative ${activeTab === 'students' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'}`}>
          Students ({headerCounts.students})
          {activeTab === 'students' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-full"></div>}
        </button>
        <button onClick={() => setActiveTab('teachers')} className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all relative ${activeTab === 'teachers' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'}`}>
          Staff ({headerCounts.teachers})
          {activeTab === 'teachers' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-full"></div>}
        </button>
        <button onClick={() => setActiveTab('parents')} className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all relative ${activeTab === 'parents' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'}`}>
          Parents ({headerCounts.parents})
          {activeTab === 'parents' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-full"></div>}
        </button>
        <button onClick={() => setActiveTab('alumni')} className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all relative ${activeTab === 'alumni' ? 'text-amber-400' : 'text-zinc-500 hover:text-zinc-300'}`}>
          Alumni ({headerCounts.alumni})
          {activeTab === 'alumni' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-400 rounded-full"></div>}
        </button>
        <button onClick={() => setActiveTab('id_cards')} className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all relative ${activeTab === 'id_cards' ? 'text-purple-500' : 'text-zinc-500 hover:text-zinc-300'}`}>
          <div className="flex items-center gap-2">
            <QrCode size={14} /> Smart IDs
          </div>
          {activeTab === 'id_cards' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-purple-500 rounded-full"></div>}
        </button>
      </div>

      {activeTab === 'id_cards' ? (
        <SmartIDManager />
      ) : directoryLoading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-zinc-400">Loading school directory...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.length ? list.map((item) => (
            <div key={item.id} className="card-compact group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-emerald-600/10 border border-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 font-bold text-lg">
                    {item.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-200">{item.name}</h4>
                    <div className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeToneClass(item.badgeTone)}`}>
                      {item.primaryType === 'alumni' ? <BadgeCheck size={10} /> : item.primaryType === 'student' ? <GraduationCap size={10} /> : item.primaryType === 'parent' ? <Users size={10} /> : <Briefcase size={10} />}
                      {item.badge}
                    </div>
                  </div>
                </div>
                <button className="p-1.5 text-zinc-600 hover:text-white transition-colors">
                  <MoreVertical size={16} />
                </button>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                  <Mail size={12} /> {item.email || 'No email'}
                </div>
                <div className="flex items-center justify-between gap-3 text-[10px] text-zinc-500">
                  <div className="flex items-center gap-2 min-w-0">
                    {item.primaryType === 'student' || item.primaryType === 'alumni' ? <GraduationCap size={12} /> : item.primaryType === 'parent' ? <Users size={12} /> : <Briefcase size={12} />}
                    <span className="truncate">{item.headline}</span>
                  </div>
                  {item.status ? (
                    <button disabled={softLockActive || actionState.busyId === item.id} onClick={() => void handleToggleUserStatus(item)} className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full border ${item.status === 'inactive' ? 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'} disabled:cursor-not-allowed disabled:opacity-50`}>
                      {item.status === 'inactive' ? <><Lock size={10} /> Inactive</> : <><Unlock size={10} /> Active</>}
                    </button>
                  ) : null}
                </div>
                <p className="text-[11px] text-zinc-400">{item.detail}</p>
                {item.lifecycleSummary ? <p className="text-[11px] text-zinc-500">{item.lifecycleSummary}</p> : null}
                {item.canGraduate ? (
                  <p className={`text-[11px] ${item.graduateDisabled ? 'text-amber-300' : 'text-emerald-300'}`}>{item.graduateReason}</p>
                ) : null}
              </div>

              <div className="flex gap-2 pt-4 border-t border-white/5">
                <button className="flex-1 bg-white/5 hover:bg-white/10 text-zinc-300 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all">
                  View Profile
                </button>
                {item.canGraduate ? (
                  <button onClick={() => void handleGraduate(item)} disabled={softLockActive || Boolean(item.graduateDisabled) || actionState.busyId === item.linkedStudentId} className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    {actionState.busyId === item.linkedStudentId ? 'Graduating…' : item.graduationLabel}
                  </button>
                ) : (
                  <button className="flex-1 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all">
                    Message
                  </button>
                )}
              </div>
            </div>
          )) : <div className="col-span-full text-center py-12 text-zinc-600">No {activeTab} found.</div>}
        </div>
      )}
    </div>
  );
};
