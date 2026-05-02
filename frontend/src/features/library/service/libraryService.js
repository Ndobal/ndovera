/**
 * Library service - handles DRM packaging, uploads, AI review, purchases, and offline requests
 * Uses backend API endpoints for purchase and packaging. In production, replace
 * simulated AI/admin features with real implementations and secure storage.
 */

import { ebooks, offlineLibrary } from '../data/libraryData';

// Simulated fetch
export const fetchEbooks = async (filters = {}) => {
  // Filters: subject, class, price, type
  // For now return the full set and let UI filter client-side
  return ebooks;
};

export const fetchOfflineInventory = async (schoolId) => {
  if (offlineLibrary.schoolId === schoolId) return offlineLibrary.inventory;
  return [];
};

// Simulated AI review — this would call a real model/service in production
export const runAiReview = async (fileBuffer) => {
  // Return a mock report
  return {
    academicQuality: 'High',
    formattingIssues: 'Minor',
    plagiarismRisk: 'Low',
    ageAppropriateness: 'OK',
    recommendedAction: 'Recommend approval',
    score: 87,
  };
};

// Simulate admin decision logging
export const logAdminDecision = async ({bookId, adminId, action, reason}) => {
  // In production write to audit logs
  return { success: true, loggedAt: new Date().toISOString() };
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

// Simulate offline request
export const requestOfflineBook = async ({ physicalId, userId, pickupDate }) => {
  // Find book
  const item = offlineLibrary.inventory.find(i => i.id === physicalId);
  if (!item) throw new Error('Physical book not found');

  // Create offline request record (simulation)
  return {
    requestId: `req_${Date.now()}`,
    status: 'pending',
    book: item,
    pickupDate,
    requestedBy: userId,
  };
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
