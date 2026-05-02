const STORAGE_KEY = 'ndovera.student.settings.v1';
const API_BASE = process.env.REACT_APP_API_BASE || '';

const seed = {
  profile: { id: 'stu-001', name: 'David N.', avatar: '', email: 'david@example.com' },
  password: 'password123',
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
    return { ...seed, ...JSON.parse(raw) };
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

export async function getSettings(studentId = 'stu-001') {
  if (API_BASE !== undefined) {
    try {
      const data = await fetchJSON(`${API_BASE}/api/settings/${studentId}`);
      if (data) return data;
    } catch (e) {
      // fall through to local
    }
  }
  return localLoad();
}

async function saveSettingsToBackend(studentId, state) {
  if (!API_BASE) return null;
  try {
    const res = await fetchJSON(`${API_BASE}/api/settings/${studentId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) });
    return res;
  } catch (e) {
    return null;
  }
}

export async function updateProfile(nextProfile, studentId = 'stu-001') {
  const state = localLoad();
  state.profile = { ...state.profile, ...nextProfile };
  localSave(state);
  await saveSettingsToBackend(studentId, state);
  await addAuditEntry(studentId, { action: 'updateProfile', data: nextProfile });
  return state.profile;
}

export async function changePassword({ current, next }, studentId = 'stu-001') {
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

export async function listDevices(studentId = 'stu-001') {
  const state = localLoad();
  return state.devices || [];
}

export async function addDevice(device, studentId = 'stu-001') {
  const state = localLoad();
  const next = { id: `dev-${Date.now()}`, ...device, lastSeen: new Date().toISOString() };
  state.devices = [next, ...(state.devices || [])];
  localSave(state);
  await saveSettingsToBackend(studentId, state);
  await addAuditEntry(studentId, { action: 'addDevice', data: next });
  return state.devices;
}

export async function removeDevice(id, studentId = 'stu-001') {
  const state = localLoad();
  state.devices = (state.devices || []).filter(d => d.id !== id);
  localSave(state);
  await saveSettingsToBackend(studentId, state);
  await addAuditEntry(studentId, { action: 'removeDevice', data: { id } });
  return state.devices;
}

export async function setTheme(theme, studentId = 'stu-001') {
  const state = localLoad();
  state.theme = theme;
  localSave(state);
  await saveSettingsToBackend(studentId, state);
  await addAuditEntry(studentId, { action: 'setTheme', data: { theme } });
  return state.theme;
}

export async function setLanguage(code, studentId = 'stu-001') {
  const state = localLoad();
  state.language = code;
  localSave(state);
  await saveSettingsToBackend(studentId, state);
  await addAuditEntry(studentId, { action: 'setLanguage', data: { code } });
  return state.language;
}

export async function setNotifications(next, studentId = 'stu-001') {
  const state = localLoad();
  state.notifications = { ...state.notifications, ...next };
  localSave(state);
  await saveSettingsToBackend(studentId, state);
  await addAuditEntry(studentId, { action: 'setNotifications', data: next });
  return state.notifications;
}

export async function blockUser(id, studentId = 'stu-001') {
  const state = localLoad();
  state.privacy = state.privacy || { blocked: [] };
  if (!state.privacy.blocked.includes(id)) state.privacy.blocked.push(id);
  localSave(state);
  await saveSettingsToBackend(studentId, state);
  await addAuditEntry(studentId, { action: 'blockUser', data: { id } });
  return state.privacy.blocked;
}

export async function unblockUser(id, studentId = 'stu-001') {
  const state = localLoad();
  state.privacy = state.privacy || { blocked: [] };
  state.privacy.blocked = state.privacy.blocked.filter(x => x !== id);
  localSave(state);
  await saveSettingsToBackend(studentId, state);
  await addAuditEntry(studentId, { action: 'unblockUser', data: { id } });
  return state.privacy.blocked;
}

export async function addAuditEntry(studentId, payload) {
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}/api/settings/${studentId}/audit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error('audit-fail');
    return await res.json();
  } catch (e) {
    return null;
  }
}

export async function getAuditLog(studentId = 'stu-001') {
  if (!API_BASE) return [];
  try {
    const res = await fetch(`${API_BASE}/api/settings/${studentId}/audit`, { headers: { Authorization: (window.__dev_token__ || '') } });
    if (!res.ok) throw new Error('audit-fetch');
    return await res.json();
  } catch (e) {
    return [];
  }
}

export async function getAllAudits(token = '') {
  if (!API_BASE) return [];
  try {
    const res = await fetch(`${API_BASE}/api/audit`, { headers: { Authorization: token } });
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
