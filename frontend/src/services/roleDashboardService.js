import API_ENDPOINTS from '../config/apiEndpoints';
import { getJson } from './apiClient';

const roleFallbacks = {
  student: {
    studentName: 'Student',
    roleWatermark: 'STUDENT',
    metrics: [],
    quickLinks: [],
    notices: [],
  },
  parent: {
    role: 'Parent Oversight Console',
    metrics: [],
    priorities: [],
    activity: [],
  },
  teacher: {
    role: 'Teacher Command Board',
    metrics: [],
    priorities: [],
    activity: [],
  },
  hos: {
    role: 'Head of School Operations',
    metrics: [],
    priorities: [],
    activity: [],
  },
  accountant: {
    role: 'Finance Control Grid',
    metrics: [],
    priorities: [],
    activity: [],
  },
  owner: {
    role: 'Executive Sovereign View',
    metrics: [],
    priorities: [],
    activity: [],
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
