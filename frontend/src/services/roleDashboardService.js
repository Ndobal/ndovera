import API_ENDPOINTS from '../config/apiEndpoints';
import { getJson } from './apiClient';

const roleFallbacks = {
  student: {
    studentName: 'David',
    roleWatermark: 'STUDENT',
    metrics: [
      { label: 'Tasks To Do', value: '4', accent: 'accent-amber' },
      { label: 'Attendance', value: '98%', accent: 'accent-emerald' },
      { label: 'Latest Score', value: 'A-', accent: 'accent-indigo' },
      { label: 'Auras', value: '320', accent: 'accent-rose' },
    ],
    quickLinks: [
      { name: 'Classroom', path: '/roles/student/classroom' },
      { name: 'Practice', path: '/roles/student/practice' },
      { name: 'Assignments', path: '/roles/student/assignments' },
      { name: 'Materials', path: '/roles/student/materials' },
      { name: 'Results', path: '/roles/student/results' },
    ],
    notices: [
      { text: 'Math assignment is due today.', time: 'Due Today', accent: 'accent-amber' },
      { text: 'Biology quiz starts in 2 days.', time: 'Upcoming', accent: 'accent-indigo' },
      { text: 'Your attendance this week is very good.', time: 'Great Job', accent: 'accent-emerald' },
    ],
  },
  parent: {
    role: 'Parent Oversight Console',
    metrics: [
      { label: 'Children Linked', value: '2', accent: 'accent-indigo' },
      { label: 'Fee Health', value: 'Good', accent: 'accent-emerald' },
      { label: 'Action Alerts', value: '3', accent: 'accent-amber' },
      { label: 'Live Notices', value: '1', accent: 'accent-rose' },
    ],
    priorities: [
      { title: 'Approve excursion consent form', state: 'Action Needed', stateAccent: 'accent-amber' },
      { title: 'Settle transport fee balance', state: 'Due in 3 days', stateAccent: 'accent-amber' },
      { title: 'Parent-teacher video briefing', state: 'Live Tomorrow', stateAccent: 'accent-rose' },
    ],
    activity: [
      { item: 'Child 1 Weekly Performance', status: 'Published', owner: 'Grade 10 Office', eta: 'A-' },
      { item: 'Child 2 Attendance Audit', status: 'Stable', owner: 'Attendance Desk', eta: '97%' },
      { item: 'Meal Plan Renewal', status: 'Open', owner: 'School Services', eta: '2 items' },
    ],
  },
  teacher: {
    role: 'Teacher Command Board',
    metrics: [
      { label: 'Classes Today', value: '5', accent: 'accent-indigo' },
      { label: 'Marked Scripts', value: '84', accent: 'accent-emerald' },
      { label: 'Unmarked', value: '17', accent: 'accent-amber' },
      { label: 'Live Rooms', value: '1', accent: 'accent-rose' },
    ],
    priorities: [
      { title: 'Publish SS2 Biology quiz scores', state: 'Pending Review', stateAccent: 'accent-amber' },
      { title: 'Start live revision room', state: 'Starts in 8m', stateAccent: 'accent-rose' },
      { title: 'Upload lesson note pack', state: 'Ready', stateAccent: 'accent-emerald' },
    ],
    activity: [
      { item: 'Biology SS2A', status: 'Active', owner: 'Lesson Unit 4', eta: '42 students' },
      { item: 'Lab Report Batch 1', status: 'Marked', owner: 'Assessment', eta: '100%' },
      { item: 'Parent Feedback Logs', status: 'Open', owner: 'Portal Inbox', eta: '11 items' },
    ],
  },
  hos: {
    role: 'Head of School Operations',
    metrics: [
      { label: 'Campus Uptime', value: '99.94%', accent: 'accent-indigo' },
      { label: 'Compliance', value: '96%', accent: 'accent-emerald' },
      { label: 'Escalations', value: '4', accent: 'accent-amber' },
      { label: 'Critical', value: '1', accent: 'accent-rose' },
    ],
    priorities: [
      { title: 'Discipline board review', state: '2 cases', stateAccent: 'accent-amber' },
      { title: 'Campus security drill node', state: 'Live', stateAccent: 'accent-rose' },
      { title: 'Staff punctuality trend check', state: 'Healthy', stateAccent: 'accent-emerald' },
    ],
    activity: [
      { item: 'Academic Department Sync', status: 'Completed', owner: 'Leadership Office', eta: 'Today' },
      { item: 'Infrastructure Ticket Queue', status: 'In Progress', owner: 'Admin Ops', eta: '6 open' },
      { item: 'Student Welfare Escalation', status: 'Escalated', owner: 'Counsel Unit', eta: '1 urgent' },
    ],
  },
  accountant: {
    role: 'Finance Control Grid',
    metrics: [
      { label: 'Revenue MTD', value: '₦18.4M', accent: 'accent-indigo' },
      { label: 'Collected', value: '₦16.9M', accent: 'accent-emerald' },
      { label: 'Outstanding', value: '₦1.5M', accent: 'accent-amber' },
      { label: 'Disputes', value: '2', accent: 'accent-rose' },
    ],
    priorities: [
      { title: 'Reconcile scholarship discounts', state: 'In Review', stateAccent: 'accent-amber' },
      { title: 'Invoice generation batch', state: 'Processing', stateAccent: 'accent-indigo' },
      { title: 'Payroll transfer confirmation', state: 'Completed', stateAccent: 'accent-emerald' },
    ],
    activity: [
      { item: 'Fee Collection Ledger', status: 'Balanced', owner: 'Accounts', eta: '100%' },
      { item: 'Transport Fee Exceptions', status: 'Open', owner: 'Parent Billing', eta: '7 cases' },
      { item: 'Audit Trail Export', status: 'Ready', owner: 'Compliance', eta: 'Q1' },
    ],
  },
  owner: {
    role: 'Executive Sovereign View',
    metrics: [
      { label: 'Institution Score', value: '94.7', accent: 'accent-indigo' },
      { label: 'Growth Index', value: '+12.4%', accent: 'accent-emerald' },
      { label: 'Risk Signals', value: '5', accent: 'accent-amber' },
      { label: 'Live Incident', value: '1', accent: 'accent-rose' },
    ],
    priorities: [
      { title: 'Quarterly strategic review', state: 'Board in 2h', stateAccent: 'accent-amber' },
      { title: 'Live institution health monitor', state: 'Synchronized', stateAccent: 'accent-rose' },
      { title: 'Expansion budget readiness', state: 'Approved', stateAccent: 'accent-emerald' },
    ],
    activity: [
      { item: 'Multi-campus Snapshot', status: 'Stable', owner: 'National Ops', eta: '5 campuses' },
      { item: 'Teacher Quality Matrix', status: 'Improving', owner: 'Academics', eta: '+4.2%' },
      { item: 'Finance Compliance Pulse', status: 'Audited', owner: 'Audit Office', eta: 'Passed' },
    ],
  },
};

export function getRoleDashboard(roleKey) {
  return getJson(API_ENDPOINTS.roles[roleKey], roleFallbacks[roleKey]);
}

export function getStudentDashboard() {
  return getRoleDashboard('student');
}

export function getParentDashboard() {
  return getRoleDashboard('parent');
}

export function getTeacherDashboard() {
  return getRoleDashboard('teacher');
}

export function getHoSDashboard() {
  return getRoleDashboard('hos');
}

export function getAccountantDashboard() {
  return getRoleDashboard('accountant');
}

export function getOwnerDashboard() {
  return getRoleDashboard('owner');
}
