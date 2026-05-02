// Attendance Helper Utilities

/**
 * Format time in HH:MM format
 */
export const formatTime = (timeString) => {
  if (!timeString) return 'N/A';
  return timeString.match(/\d{2}:\d{2}/) ? timeString : new Date(timeString).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Format date in readable format
 */
export const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Calculate days since a date
 */
export const daysSince = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

/**
 * Get status color class
 */
export const getStatusColor = (status) => {
  const colors = {
    Present: 'from-green-500 to-emerald-600',
    Late: 'from-amber-500 to-orange-600',
    Absent: 'from-red-500 to-rose-600',
    Excused: 'from-blue-500 to-cyan-600',
  };
  return colors[status] || 'from-slate-500 to-slate-600';
};

/**
 * Get role display name
 */
export const getRoleDisplayName = (role) => {
  const names = {
    admin: 'Administrator',
    staff: 'Teacher',
    hos: 'Head of School',
    owner: 'School Owner',
    security: 'Security Officer',
    parent: 'Parent/Guardian',
    student: 'Student',
  };
  return names[role] || role;
};

/**
 * Check if attendance is late
 */
export const isLate = (timeIn, lateThreshold = 30) => {
  if (!timeIn) return false;
  const [hours, minutes] = timeIn.split(':').map(Number);
  const timeInMinutes = hours * 60 + minutes;
  const thresholdMinutes = 7 * 60 + 30 + lateThreshold; // 7:30 AM + threshold
  return timeInMinutes > thresholdMinutes;
};

/**
 * Calculate attendance percentage
 */
export const calculateAttendancePercentage = (presentDays, totalDays) => {
  if (totalDays === 0) return 0;
  return ((presentDays / totalDays) * 100).toFixed(2);
};

/**
 * Download report as file
 */
export const downloadReport = (data, filename, format = 'json') => {
  let content = data;
  let mimeType = 'application/json';

  if (format === 'csv') {
    content = convertToCSV(data);
    mimeType = 'text/csv';
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Convert JSON to CSV
 */
const convertToCSV = (data) => {
  if (!Array.isArray(data) || data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => JSON.stringify(row[header] ?? '')).join(',')
    ),
  ].join('\n');

  return csv;
};

/**
 * Validate QR code format
 */
export const validateQRCode = (qrCode) => {
  return /^[A-Z0-9_]{10,}$/.test(qrCode);
};

/**
 * Get offline status color
 */
export const getOfflineStatusColor = (isOnline) => {
  return isOnline
    ? 'from-green-500 to-emerald-600'
    : 'from-red-500 to-rose-600';
};

/**
 * Format attendance record for display
 */
export const formatAttendanceRecord = (record) => {
  return {
    ...record,
    dateFormatted: formatDate(record.date),
    timeInFormatted: formatTime(record.timeIn),
    timeOutFormatted: formatTime(record.timeOut),
  };
};
