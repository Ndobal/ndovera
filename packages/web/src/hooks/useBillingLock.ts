import { useEffect, useMemo, useState } from 'react';
import { getInvoices, type Invoice } from '../services/monetizationApi';

const NOTICE_REMINDER_MS = 6 * 60 * 60 * 1000;
const DASHBOARD_NOTICE_ROLES = new Set(['Owner', 'Tenant School Owner', 'HOS', 'HoS', 'Finance Officer', 'Accountant', 'Bursar']);

function getInvoiceDueTime(invoice: Invoice) {
  const source = invoice.dueAt || invoice.createdAt;
  const timestamp = new Date(source).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getDismissKey(invoiceId: string) {
  return `ndovera:payment-notice-dismissed:${invoiceId}`;
}

export function useBillingLock(role?: string) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getInvoices()
      .then((nextInvoices) => {
        if (!mounted) return;
        setInvoices(nextInvoices || []);
      })
      .catch(() => {
        if (!mounted) return;
        setInvoices([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  const overdueInvoice = useMemo(() => {
    const now = Date.now();
    return [...invoices]
      .filter((invoice) => Number(invoice.balanceNaira || 0) > 0 && getInvoiceDueTime(invoice) > 0 && getInvoiceDueTime(invoice) <= now)
      .sort((left, right) => getInvoiceDueTime(right) - getInvoiceDueTime(left))[0] || null;
  }, [invoices]);

  const noticeVisible = useMemo(() => {
    if (!overdueInvoice) return false;
    try {
      const raw = localStorage.getItem(getDismissKey(overdueInvoice.id));
      if (!raw) return true;
      return Date.now() - Number(raw) >= NOTICE_REMINDER_MS;
    } catch {
      return true;
    }
  }, [overdueInvoice]);

  return {
    loading,
    invoices,
    overdueInvoice,
    softLockActive: Boolean(overdueInvoice),
    noticeVisible,
    shouldShowDashboardNotice: Boolean(overdueInvoice && DASHBOARD_NOTICE_ROLES.has(String(role || '').trim())),
    dismissNotice: () => {
      if (!overdueInvoice) return;
      try {
        localStorage.setItem(getDismissKey(overdueInvoice.id), String(Date.now()));
      } catch {}
      setRefreshKey((current) => current + 1);
    },
    refresh: () => setRefreshKey((current) => current + 1),
  };
}
