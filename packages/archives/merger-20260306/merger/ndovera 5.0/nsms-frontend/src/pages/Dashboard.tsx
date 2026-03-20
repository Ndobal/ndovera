import React, { useEffect, useState } from 'react';
import DashboardWidget from '../components/DashboardWidget';
import TableCard from '../components/TableCard';
import ChartCard from '../components/ChartCard';
import ApprovalCard from '../components/ApprovalCard';
import QuickActionButton from '../components/QuickActionButton';
import api from '../api/backend';

interface DashboardStats {
  activeSchools: number;
  activeStudents: number;
  activeStaff: number;
  lamsWallet: number;
  revenue: number;
  pendingApprovals: number;
}

const fallbackStats: DashboardStats = {
  activeSchools: 0,
  activeStudents: 0,
  activeStaff: 0,
  lamsWallet: 0,
  revenue: 0,
  pendingApprovals: 0,
};

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>(fallbackStats);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const data = await api.get<DashboardStats>('/dashboard-stats');
        if (mounted) setStats(data);
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
    <div className="dashboard-page">
      <div className="card card-tone-1" style={{ marginBottom: '1rem' }}>
        <h2 className="card-title">Ndovera NSMS — Owner Command Center</h2>
        <p className="card-lead">
          System-wide governance for schools, staffing, LAMS, and revenue oversight. Data tiles update as soon as
          backend analytics endpoints are live.
        </p>
      </div>

      <div className="owner-governance">
        <div className="card card-tone-2">
          <h3 className="card-title">Authority Oversight</h3>
          <ul className="card-list">
            <li>HOS appointments and removals</li>
            <li>School-wide policy enforcement</li>
            <li>System audit and escalation</li>
          </ul>
        </div>
        <div className="card card-tone-3">
          <h3 className="card-title">Multi-School Portfolio</h3>
          <ul className="card-list">
            <li>Active schools: {stats.activeSchools}</li>
            <li>At-risk schools: 2</li>
            <li>New onboarding: 1</li>
          </ul>
        </div>
        <div className="card card-tone-4">
          <h3 className="card-title">Compliance & Audit</h3>
          <ul className="card-list">
            <li>Audit trails: Enabled</li>
            <li>Policy violations: 0</li>
            <li>Next review: 10 days</li>
          </ul>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">School Media System</h3>
          <ul className="card-list">
            <li>Editorial governance: Active</li>
            <li>HOS approval gate: Enabled</li>
            <li>Publishing targets: 3</li>
          </ul>
        </div>
        <div className="card card-tone-7">
          <h3 className="card-title">Staff Dropbox</h3>
          <ul className="card-list">
            <li>Secure storage: Enabled</li>
            <li>Role-based folders: Active</li>
            <li>Approval-required zones: 4</li>
          </ul>
        </div>
        <div className="card card-tone-2">
          <h3 className="card-title">Question Bank</h3>
          <ul className="card-list">
            <li>Blueprint templates: 6</li>
            <li>Randomization engine: Active</li>
            <li>Offline exam packs: Ready</li>
          </ul>
        </div>
        <div className="card card-tone-3">
          <h3 className="card-title">Bulk Results + PDF Tagging</h3>
          <ul className="card-list">
            <li>OCR tagging engine: Active</li>
            <li>Retroactive publishing: Enabled</li>
            <li>Audit-grade trails: Locked</li>
          </ul>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Messaging (NdoChat)</h3>
          <ul className="card-list">
            <li>Encrypted school-wide chat</li>
            <li>Broadcasts + group forums</li>
            <li>Compliance mode enabled</li>
          </ul>
        </div>
        <div className="card card-tone-4">
          <h3 className="card-title">Live Events</h3>
          <ul className="card-list">
            <li>YouTube sync enabled</li>
            <li>Live chat + reminders</li>
            <li>Audit trail locked</li>
          </ul>
        </div>
        <div className="card card-tone-2">
          <h3 className="card-title">Video Gallery</h3>
          <ul className="card-list">
            <li>Private YouTube sync</li>
            <li>Role-based access control</li>
            <li>Tagging engine enabled</li>
          </ul>
        </div>
        <div className="card card-tone-3">
          <h3 className="card-title">Data Migration</h3>
          <ul className="card-list">
            <li>Legacy data imports</li>
            <li>Mapping & validation engine</li>
            <li>Approval + audit locked</li>
          </ul>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Identity Engine</h3>
          <ul className="card-list">
            <li>Device-bound trust</li>
            <li>Digital signatures</li>
            <li>Authority resolution</li>
          </ul>
        </div>
        <div className="card card-tone-4">
          <h3 className="card-title">Event Bus + Audit</h3>
          <ul className="card-list">
            <li>Immutable event stream</li>
            <li>Sync + approval pipeline</li>
            <li>Audit locked</li>
          </ul>
        </div>
      </div>

      <div className="widgets-row">
        <DashboardWidget title="Active Schools" value={stats.activeSchools} />
        <DashboardWidget title="Active Students" value={stats.activeStudents} />
        <DashboardWidget title="Active Staff" value={stats.activeStaff} />
        <DashboardWidget title="LAMS Wallet" value={stats.lamsWallet} />
        <DashboardWidget title="Revenue" value={stats.revenue} />
        <DashboardWidget title="Pending Approvals" value={stats.pendingApprovals} />
      </div>

      {loading && <p className="text-muted">Syncing dashboard metrics…</p>}

      <div className="tables-row">
        <TableCard title="Recent Schools" endpoint="/recent-schools" />
        <TableCard title="Pending Approvals" endpoint="/pending-approvals" />
        <TableCard title="Recent Payments" endpoint="/recent-payments" />
      </div>

      <div className="charts-row">
        <ChartCard title="Student Enrollment Trends" type="line" endpoint="/charts/student-trends" />
        <ChartCard title="LAMS Activity" type="bar" endpoint="/charts/lams-activity" />
        <ChartCard title="Revenue by School" type="pie" endpoint="/charts/revenue-by-school" />
      </div>

      <div className="tables-row">
        <ApprovalCard
          title="Approvals Queue"
          approvals={[
            { id: 'ap-1', title: 'New HOS request — Kivu Hills', status: 'Pending' },
            { id: 'ap-2', title: 'Staff onboarding — Sunrise Academy', status: 'Review' },
          ]}
        />
        <div className="card card-tone-5">
          <h3 className="card-title">Quick Actions</h3>
          <div className="quick-actions">
            <QuickActionButton label="Add School" />
            <QuickActionButton label="Invite HOS" />
            <QuickActionButton label="Launch Billing Cycle" />
            <QuickActionButton label="Review LAMS Wallet" />
          </div>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Operational Alerts</h3>
          <ul className="card-list">
            <li>2 campuses have pending staff contracts.</li>
            <li>1 school missed sync window in the last 24h.</li>
            <li>3 websites awaiting owner approval.</li>
          </ul>
        </div>
      </div>

      <div className="tables-row">
        <div className="card card-tone-7">
          <h3 className="card-title">Top Performing Schools</h3>
          <ul className="card-list">
            <li>Sunrise Academy — 98% attendance</li>
            <li>Lakeview International — 95% attendance</li>
            <li>Kivu Hills — 93% attendance</li>
          </ul>
        </div>
        <div className="card card-tone-2">
          <h3 className="card-title">Revenue Snapshot</h3>
          <p className="card-lead">Collections this month: $48,230</p>
          <p className="card-lead">Outstanding invoices: $7,840</p>
          <p className="card-lead">LAMS payouts pending: $2,450</p>
        </div>
        <div className="card card-tone-4">
          <h3 className="card-title">School Health</h3>
          <ul className="card-list">
            <li>6 schools synced in last hour</li>
            <li>2 schools offline</li>
            <li>1 school flagged for audit</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
