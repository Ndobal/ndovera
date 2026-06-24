import { getApiUrl } from '../../../config/apiBase';
import { clearStoredAuth, getSignedOutRedirectPath, getStoredAuth, syncRefreshedToken } from '../../auth/services/authApi';

function buildAuthHeaders(includeJson = true) {
  const auth = getStoredAuth();
  return {
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
  };
}

function handleUnauthorized() {
  clearStoredAuth();
  window.location.replace(getSignedOutRedirectPath());
}

async function parseResponse(res, { requiresAuth = false } = {}) {
  if (res.status === 401 && requiresAuth) {
    handleUnauthorized();
    return {};
  }

  syncRefreshedToken(res);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || 'Request failed.');
  }

  return data;
}

async function publicRequest(path) {
  const res = await fetch(getApiUrl(path), {
    method: 'GET',
    credentials: 'include',
  });
  return parseResponse(res);
}

async function authedRequest(path, { method = 'GET', body } = {}) {
  const res = await fetch(getApiUrl(path), {
    method,
    credentials: 'include',
    headers: buildAuthHeaders(!body ? false : true),
    body: body ? JSON.stringify(body) : undefined,
  });
  return parseResponse(res, { requiresAuth: true });
}

async function uploadAsset(path, file, extraFields = {}) {
  const formData = new FormData();
  formData.append('file', file);
  Object.entries(extraFields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      formData.append(key, value);
    }
  });

  const res = await fetch(getApiUrl(path), {
    method: 'POST',
    credentials: 'include',
    headers: buildAuthHeaders(false),
    body: formData,
  });

  return parseResponse(res, { requiresAuth: true });
}

export const getPublicPlatformSite = () => publicRequest('/api/public/platform-site');
export const getPublicOpportunities = (tenantId) => publicRequest(`/api/public/opportunities${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''}`);
export const submitGrowthPartnerApplication = (data) => authedRequest('/api/public/growth-partner-applications', { method: 'POST', body: data });
export const getManagedOpportunities = () => authedRequest('/api/opportunities/manage');
export const createOpportunity = (data) => authedRequest('/api/opportunities', { method: 'POST', body: data });
export const updateOpportunity = (id, data) => authedRequest(`/api/opportunities/${encodeURIComponent(id)}`, { method: 'PUT', body: data });
export const deleteOpportunity = (id) => authedRequest(`/api/opportunities/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const getAmiWebsiteSections = () => authedRequest('/api/ami/website/sections');
export const saveAmiWebsiteSection = (data) => authedRequest('/api/ami/website/sections', { method: 'POST', body: data });
export const uploadAmiWebsiteAsset = (file, sectionKey) => uploadAsset('/api/ami/website/sections/upload', file, { sectionKey });