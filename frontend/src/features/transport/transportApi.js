import { getApiUrl } from '../../config/apiBase';
import { buildSelectedRoleHeader, getStoredAuth } from '../auth/services/authApi';

async function request(path, { method = 'GET', body } = {}) {
  const auth = getStoredAuth();
  const response = await fetch(getApiUrl(path), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
      ...buildSelectedRoleHeader(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data.message || data.error || 'Request failed.');
  return data;
}

const id = value => encodeURIComponent(String(value || ''));

// The school: routes, drivers and the students on each route.
export const getTransportAdmin = () => request('/api/transport/admin');
export const createRoute = body => request('/api/transport/routes', { method: 'POST', body });
export const updateRoute = (routeId, body) => request(`/api/transport/routes/${id(routeId)}`, { method: 'PUT', body });
export const removeRoute = routeId => request(`/api/transport/routes/${id(routeId)}`, { method: 'DELETE' });
export const assignRouteStudents = (routeId, body) => request(`/api/transport/routes/${id(routeId)}/students`, { method: 'PUT', body });
export const unassignRouteStudent = (routeId, studentId) => request(`/api/transport/routes/${id(routeId)}/students/${id(studentId)}`, { method: 'DELETE' });

// The driver.
export const getDriverTransport = () => request('/api/transport/driver');
export const setDriverTrips = trips => request('/api/transport/driver/trips', { method: 'PUT', body: { trips } });
export const openDriverRun = (direction, tripNo) => request('/api/transport/driver/runs', { method: 'POST', body: { direction, tripNo } });
export const boardChild = (runId, body) => request(`/api/transport/driver/runs/${id(runId)}/board`, { method: 'POST', body });
export const markArrived = runId => request(`/api/transport/driver/runs/${id(runId)}/arrive`, { method: 'POST', body: {} });
export const markDeparted = runId => request(`/api/transport/driver/runs/${id(runId)}/depart`, { method: 'POST', body: {} });

// Parents and students.
export const getMyBus = () => request('/api/transport/mine');
