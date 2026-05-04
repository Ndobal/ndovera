import { getApiUrl } from '../../../config/apiBase';

export const fetchEbooks = async () => {
  try {
    const response = await fetch(getApiUrl('/api/library/books'));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    return Array.isArray(payload?.books) ? payload.books : [];
  } catch {
    return [];
  }
};

export const fetchOfflineInventory = async () => [];

export const runAiReview = async () => {
  throw new Error('AI library review is not configured for this environment.');
};

export const logAdminDecision = async () => {
  throw new Error('Library admin review logging is not configured for this environment.');
};

// DRM packaging — call server API to exchange license for download token
export const packageForDownload = async ({ book, userId, deviceFingerprint, license }) => {
  const resp = await fetch('/api/package', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ license, deviceFingerprint }),
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error || 'Packaging failed');
  }
  return resp.json();
};

// Purchase flow — call backend purchase endpoint
export const purchaseBook = async ({ bookId, userId, amount, deviceFingerprint }) => {
  const resp = await fetch('/api/purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookId, userId, amount, deviceFingerprint }),
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error || 'Purchase failed');
  }
  return resp.json();
};

export const requestOfflineBook = async () => {
  throw new Error('Offline library requests are not configured for this environment.');
};

const libraryService = {
  fetchEbooks,
  fetchOfflineInventory,
  runAiReview,
  logAdminDecision,
  packageForDownload,
  purchaseBook,
  requestOfflineBook,
};

export default libraryService;
