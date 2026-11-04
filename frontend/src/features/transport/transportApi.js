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
export const saveHome = (studentId, body) => request(`/api/transport/mine/${id(studentId)}/home`, { method: 'PUT', body });

const place = home => (home.lat !== null && home.lat !== undefined ? `${home.lat},${home.lng}` : home.address);
/** A saved pin is exact, so it wins over the typed address. */
export const hasHome = home => Boolean(home && (home.address || (home.lat !== null && home.lat !== undefined)));

/** Opens turn-by-turn directions in the Google Maps app or site. A plain link: no key and no charge to Ndovera. */
export function directionsLink(homes) {
  const stops = homes.filter(hasHome).map(place);
  if (!stops.length) return '';
  const params = new URLSearchParams({ api: '1', destination: stops[stops.length - 1], travelmode: 'driving', dir_action: 'navigate' });
  if (stops.length > 1) params.set('waypoints', stops.slice(0, -1).join('|'));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
/** Google's limit on phones: three stops on the way, then the destination. */
export const MAX_STOPS_IN_ONE_LINK = 4;
