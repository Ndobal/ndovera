import { getApiUrl } from '../../config/apiBase';
import { buildSelectedRoleHeader } from '../auth/services/authApi';

// Digital Staff Office File (Worker: staffFile.ts).

async function request(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');
  const response = await fetch(getApiUrl(path), {
    method, credentials: 'include', body: body ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...buildSelectedRoleHeader() },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const error = new Error(data.message || data.error || 'Request failed.');
    error.status = response.status;
    throw error;
  }
  return data;
}

const id = value => encodeURIComponent(value);

export const getStaffFile = staffId => request(`/api/staff-file/${id(staffId)}`);
export const getStaffRecords = staffId => request(`/api/staff-file/${id(staffId)}/records`);
export const addStaffRecord = (staffId, record) => request(`/api/staff-file/${id(staffId)}/records`, { method: 'POST', body: record });
export const reviseStaffRecord = (staffId, recordId, record) => request(`/api/staff-file/${id(staffId)}/records/${id(recordId)}`, { method: 'PUT', body: record });
export const getStaffRecordHistory = (staffId, recordId) => request(`/api/staff-file/${id(staffId)}/records/${id(recordId)}/history`);
export const getStaffLoans = staffId => request(`/api/staff-file/${id(staffId)}/loans`);
export const createStaffLoan = (staffId, loan) => request(`/api/staff-file/${id(staffId)}/loans`, { method: 'POST', body: loan });
export const getStaffLoan = loanId => request(`/api/staff-loans/${id(loanId)}`);
export const decideStaffLoan = (loanId, body) => request(`/api/staff-loans/${id(loanId)}/decision`, { method: 'POST', body });
export const addStaffLoanPayment = (loanId, body) => request(`/api/staff-loans/${id(loanId)}/payments`, { method: 'POST', body });
export const confirmStaffLoanPayment = (loanId, transactionId, body) => request(`/api/staff-loans/${id(loanId)}/payments/${id(transactionId)}/confirm`, { method: 'POST', body });
export const adjustStaffLoan = (loanId, body) => request(`/api/staff-loans/${id(loanId)}/adjust`, { method: 'POST', body });
export const getStaffTasks = staffId => request(`/api/staff-file/${id(staffId)}/tasks`);
export const assignStaffTask = body => request('/api/staff-tasks', { method: 'POST', body });
export const updateStaffTask = (assignmentId, body) => request(`/api/staff-tasks/${id(assignmentId)}/progress`, { method: 'POST', body });
export const evaluateStaffTask = (assignmentId, body) => request(`/api/staff-tasks/${id(assignmentId)}/evaluate`, { method: 'POST', body });
export const getStaffReviews = staffId => request(`/api/staff-file/${id(staffId)}/reviews`);
export const addStaffReview = (staffId, body) => request(`/api/staff-file/${id(staffId)}/reviews`, { method: 'POST', body });
export const getStaffReports = staffId => request(`/api/staff-file/${id(staffId)}/reports`);
export const fileStaffReport = (staffId, body) => request(`/api/staff-file/${id(staffId)}/reports`, { method: 'POST', body });
export const setStaffReportStatus = (reportId, body) => request(`/api/staff-reports/${id(reportId)}/status`, { method: 'POST', body });
export const respondToStaffReport = (reportId, response) => request(`/api/staff-reports/${id(reportId)}/respond`, { method: 'POST', body: { response } });
export const getStaffRewards = staffId => request(`/api/staff-file/${id(staffId)}/rewards`);
export const giveStaffReward = (staffId, body) => request(`/api/staff-file/${id(staffId)}/rewards`, { method: 'POST', body });
export const getRewardCertificate = rewardId => request(`/api/staff-rewards/${id(rewardId)}/certificate`);
export const getStaffSubmissions = staffId => request(`/api/staff-file/${id(staffId)}/submissions`);
export const getStaffAttendance = staffId => request(`/api/staff-file/${id(staffId)}/attendance`);
export const getStaffFinance = staffId => request(`/api/staff-file/${id(staffId)}/finance`);
export const getStaffAudit = staffId => request(`/api/staff-file/${id(staffId)}/audit`);
export const getStaffDirectory = () => request('/api/staff-directory');
