import React, { useEffect, useState } from 'react';
import HOSWidget from '../../components/hos/HOSWidget';
import HOSTable from '../../components/hos/HOSTable';
import HOSChart from '../../components/hos/HOSChart';
import HOSApprovalCard from '../../components/hos/HOSApprovalCard';
import HOSQuickAction from '../../components/hos/HOSQuickAction';
import api from '../../api/backend';

interface HOSStats {
  students?: number;
  staff?: number;
  teachers?: number;
  attendance?: string | number;
  fee_status?: string;
  approvals?: number;
  lams_users?: number;
  wallet?: string | number;
  sync_status?: string;
}

const fallbackStats: HOSStats = {
  students: 0,
  staff: 0,
  teachers: 0,
  attendance: '0%',
  fee_status: 'Pending',
  approvals: 0,
  lams_users: 0,
  wallet: '0',
  sync_status: 'Offline queue ready',
};

const HOSDashboard: React.FC = () => {
  const [stats, setStats] = useState<HOSStats>(fallbackStats);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const data = await api.get<HOSStats>('/hos/dashboard-stats');
        if (mounted) setStats({ ...fallbackStats, ...data });
      } catch {
        if (mounted) setStats(fallbackStats);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="hos-dashboard">
      <div className="card card-tone-1" style={{ marginBottom: '1rem' }}>
        <h2 className="card-title">Ndovera NSMS — HOS Academic Governance Dashboard</h2>
        <p className="card-lead">
          HOS is the final academic authority in the school. Nothing academic becomes official without HOS approval.
        </p>
      </div>

      <div className="hos-governance">
        <div className="card card-tone-2">
          <h3 className="card-title">Academic Authority Flow</h3>
          <p className="card-lead">
            Teacher → Head of Section (Nursery Head / Headteacher / Principal) → HOS → System Lock + Digital
            Signatures + Audit Log
          </p>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">School Media Governance</h3>
          <ul className="card-list">
            <li>Editorial workflow enforced</li>
            <li>HOS final approval gate</li>
            <li>Multi-platform publishing queue</li>
          </ul>
        </div>
        <div className="card card-tone-7">
          <h3 className="card-title">Staff Dropbox Control</h3>
          <ul className="card-list">
            <li>HOS restricted folders</li>
            <li>Approval-required files</li>
            <li>Audit log locked</li>
          </ul>
        </div>
        <div className="card card-tone-4">
          <h3 className="card-title">Question Bank Governance</h3>
          <ul className="card-list">
            <li>Paper templates approved</li>
            <li>Anti-leak controls active</li>
            <li>Audit trail enforced</li>
          </ul>
        </div>
        <div className="card card-tone-3">
          <h3 className="card-title">Bulk Results Control</h3>
          <ul className="card-list">
            <li>OCR tagging queue monitored</li>
            <li>HOS approval gate enforced</li>
            <li>Audit log locked</li>
          </ul>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Messaging Governance</h3>
          <ul className="card-list">
            <li>Broadcast moderation</li>
            <li>Compliance override controls</li>
            <li>Encrypted logs</li>
          </ul>
        </div>
        <div className="card card-tone-2">
          <h3 className="card-title">Live Events Control</h3>
          <ul className="card-list">
            <li>HOS approval required</li>
            <li>Live chat moderation</li>
            <li>Replay archive enabled</li>
          </ul>
        </div>
        <div className="card card-tone-4">
          <h3 className="card-title">Video Gallery Governance</h3>
          <ul className="card-list">
            <li>Private/unlisted approvals</li>
            <li>Class & event tagging</li>
            <li>Audit trail enforced</li>
          </ul>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Data Migration Governance</h3>
          <ul className="card-list">
            <li>HOS approval gate enforced</li>
            <li>Rollback points retained</li>
            <li>Audit trail locked</li>
          </ul>
        </div>
        <div className="card card-tone-2">
          <h3 className="card-title">Identity Engine Governance</h3>
          <ul className="card-list">
            <li>Trust scoring enforced</li>
            <li>Device binding active</li>
            <li>Signature compliance</li>
          </ul>
        </div>
        <div className="card card-tone-4">
          <h3 className="card-title">Event Bus + Audit</h3>
          <ul className="card-list">
            <li>Event pipeline monitored</li>
            <li>Immutable logs enforced</li>
            <li>Sync health visible</li>
          </ul>
        </div>
        <div className="card card-tone-3">
          <h3 className="card-title">Lesson Governance Panel</h3>
          <ul className="card-list">
            <li>Pending Lesson Endorsements</li>
            <li>Approved Lesson Notes</li>
            <li>Rejected Notes</li>
            <li>Revision Requests</li>
            <li>Audit History</li>
          </ul>
        </div>
        <div className="card card-tone-4">
          <h3 className="card-title">C.A. Control Panel</h3>
          <ul className="card-list">
            <li>Pending CA Approvals</li>
            <li>Locked CA Sheets</li>
            <li>Change Requests</li>
            <li>Audit Trail</li>
            <li>Approval History</li>
          </ul>
        </div>
      </div>

      <div className="hos-widgets">
        <HOSWidget title="Total Students" value={stats.students} />
        <HOSWidget title="Total Staff" value={stats.staff} />
        <HOSWidget title="Active Teachers" value={stats.teachers} />
        <HOSWidget title="Daily Attendance" value={stats.attendance} />
        <HOSWidget title="Fee Collection" value={stats.fee_status} />
        <HOSWidget title="Pending Approvals" value={stats.approvals} />
        <HOSWidget title="Active LAMS Users" value={stats.lams_users} />
        <HOSWidget title="School Wallet" value={stats.wallet} />
        <HOSWidget title="Offline Sync" value={stats.sync_status} />
      </div>

      {loading && <p className="text-muted">Syncing HOS metrics…</p>}

      <div className="hos-tables">
        <HOSTable title="Recent Enrollments" endpoint="/hos/recent-students" />
        <HOSTable title="Recent Staff Activity" endpoint="/hos/staff-activity" />
        <HOSTable title="Recent Payments" endpoint="/hos/recent-payments" />
      </div>

      <div className="hos-charts">
        <HOSChart title="Attendance Trend" endpoint="/hos/charts/attendance" />
        <HOSChart title="Fee Collection" endpoint="/hos/charts/fees" />
        <HOSChart title="LAMS Activity" endpoint="/hos/charts/lams" />
      </div>

      <div className="hos-approvals">
        <HOSApprovalCard />
      </div>

      <div className="hos-actions">
        <div className="card card-tone-5">
          <h3 className="card-title">Quick Actions</h3>
          <div className="quick-actions">
            <HOSQuickAction label="Review Admissions" />
            <HOSQuickAction label="Approve Staff" />
            <HOSQuickAction label="Publish Results" />
            <HOSQuickAction label="Resolve Fee Waivers" />
          </div>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Operational Alerts</h3>
          <ul className="text-muted" style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
            <li>• 4 approvals waiting for review</li>
            <li>• 1 class missing attendance submission</li>
            <li>• 2 students flagged for discipline review</li>
          </ul>
        </div>
        <div className="card card-tone-7">
          <h3 className="card-title">School Health</h3>
          <ul className="text-muted" style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}>
            <li>• Sync latency: 12 minutes</li>
            <li>• Offline queue: 8 actions</li>
            <li>• Critical alerts: none</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HOSDashboard;
