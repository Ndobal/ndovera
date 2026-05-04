import { getApiUrl } from '../../../config/apiBase';

const STORAGE_KEY = 'ndovera.student.settings.v1';

const seed = {
  profile: { id: '', name: '', avatar: '', email: '' },
  password: '',
  devices: [],
  theme: 'system',
  language: 'en',
  notifications: { push: true, email: true, sms: false },
  privacy: { blocked: [] },
};

function localLoad() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...seed };
    const state = JSON.parse(raw);
    return {
      ...seed,
      ...state,
      profile: { ...seed.profile, ...(state.profile || {}) },
      notifications: { ...seed.notifications, ...(state.notifications || {}) },
      privacy: { ...seed.privacy, ...(state.privacy || {}) },
    };
  } catch {
    return { ...seed };
  }
}

function localSave(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function fetchJSON(url, opts) {
  try {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error('Network error');
    return await res.json();
  } catch (e) {
    throw e;
  }
}

function settingsUrl(studentId) {
  return getApiUrl(`/api/settings/${studentId}`);
}

function auditUrl(studentId) {
  return getApiUrl(`/api/settings/${studentId}/audit`);
}

export async function getSettings(studentId = 'current_student') {
  try {
    const data = await fetchJSON(settingsUrl(studentId));
    if (data) return data;
  } catch (e) {
    // fall through to local
  }
  return localLoad();
}

async function saveSettingsToBackend(studentId, state) {
  try {
    const res = await fetchJSON(settingsUrl(studentId), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) });
    return res;
  } catch (e) {
    return null;
  }
}

export async function updateProfile(nextProfile, studentId = 'current_student') {
  const state = localLoad();
  state.profile = { ...state.profile, ...nextProfile };
  localSave(state);
  await saveSettingsToBackend(studentId, state);
  await addAuditEntry(studentId, { action: 'updateProfile', data: nextProfile });
  return state.profile;
}

export async function changePassword({ current, next }, studentId = 'current_student') {
  const state = localLoad();
  if (String(current) !== String(state.password)) {
    throw new Error('Current password does not match');
  }
  state.password = String(next);
  localSave(state);
  await saveSettingsToBackend(studentId, state);
  await addAuditEntry(studentId, { action: 'changePassword' });
  return true;
}

export async function listDevices(studentId = 'current_student') {
  const state = localLoad();
  return state.devices || [];
}

export async function addDevice(device, studentId = 'current_student') {
  const state = localLoad();
  const next = { id: `dev-${Date.now()}`, ...device, lastSeen: new Date().toISOString() };
  state.devices = [next, ...(state.devices || [])];
  localSave(state);
  await saveSettingsToBackend(studentId, state);
  await addAuditEntry(studentId, { action: 'addDevice', data: next });
  return state.devices;
}

export async function removeDevice(id, studentId = 'current_student') {
  const state = localLoad();
  state.devices = (state.devices || []).filter(d => d.id !== id);
  localSave(state);
  await saveSettingsToBackend(studentId, state);
  await addAuditEntry(studentId, { action: 'removeDevice', data: { id } });
  return state.devices;
}

export async function setTheme(theme, studentId = 'current_student') {
  const state = localLoad();
  state.theme = theme;
  localSave(state);
  await saveSettingsToBackend(studentId, state);
  await addAuditEntry(studentId, { action: 'setTheme', data: { theme } });
  return state.theme;
}

export async function setLanguage(code, studentId = 'current_student') {
  const state = localLoad();
  state.language = code;
  localSave(state);
  await saveSettingsToBackend(studentId, state);
  await addAuditEntry(studentId, { action: 'setLanguage', data: { code } });
  return state.language;
}

export async function setNotifications(next, studentId = 'current_student') {
  const state = localLoad();
  state.notifications = { ...state.notifications, ...next };
  localSave(state);
  await saveSettingsToBackend(studentId, state);
  await addAuditEntry(studentId, { action: 'setNotifications', data: next });
  return state.notifications;
}

export async function blockUser(id, studentId = 'current_student') {
  const state = localLoad();
  state.privacy = state.privacy || { blocked: [] };
  if (!state.privacy.blocked.includes(id)) state.privacy.blocked.push(id);
  localSave(state);
  await saveSettingsToBackend(studentId, state);
  await addAuditEntry(studentId, { action: 'blockUser', data: { id } });
  return state.privacy.blocked;
}

export async function unblockUser(id, studentId = 'current_student') {
  const state = localLoad();
  state.privacy = state.privacy || { blocked: [] };
  state.privacy.blocked = state.privacy.blocked.filter(x => x !== id);
  localSave(state);
  await saveSettingsToBackend(studentId, state);
  await addAuditEntry(studentId, { action: 'unblockUser', data: { id } });
  return state.privacy.blocked;
}

export async function addAuditEntry(studentId, payload) {
  try {
    const res = await fetch(auditUrl(studentId), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error('audit-fail');
    return await res.json();
  } catch (e) {
    return null;
  }
}

export async function getAuditLog(studentId = 'current_student') {
  try {
    const res = await fetch(auditUrl(studentId), { headers: { Authorization: (window.__dev_token__ || '') } });
    if (!res.ok) throw new Error('audit-fetch');
    return await res.json();
  } catch (e) {
    return [];
  }
}

export async function getAllAudits(token = '') {
  try {
    const res = await fetch(getApiUrl('/api/audit'), { headers: { Authorization: token } });
    if (!res.ok) throw new Error('audit-fetch-all');
    return await res.json();
  } catch (e) {
    return [];
  }
}

export default {
  getSettings,
  updateProfile,
  changePassword,
  listDevices,
  addDevice,
  removeDevice,
  setTheme,
  setLanguage,
  setNotifications,
  blockUser,
  unblockUser,
  addAuditEntry,
  getAuditLog,
};
