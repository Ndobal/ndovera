import React, { useEffect, useMemo, useState } from 'react';
import { getTuckOrders, getTuckWeekly } from '../services/schoolApi';

const PAGE = 'p-8 max-w-7xl mx-auto space-y-6';
const HEADER = 'rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10';
const CARD = 'rounded-3xl p-6 bg-[#f5deb3] border border-[#c9a96e]/40 dark:border-white/10 dark:bg-slate-900/30';

function formatNaira(value) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

const STATUS_PILL = {
  completed: 'bg-emerald-100 text-emerald-700',
  fulfilled: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  processing: 'bg-indigo-100 text-indigo-700',
  cancelled: 'bg-red-100 text-red-700',
};

function itemCount(order) {
  if (!Array.isArray(order?.items)) return 0;
  return order.items.reduce((sum, item) => sum + Number(item?.quantity || item?.qty || 1), 0);
}

export default function TuckShopFinanceBoard() {
  const [orders, setOrders] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    Promise.all([
      getTuckOrders().then(d => d?.orders || []).catch(() => []),
      getTuckWeekly(8).then(d => d?.weeks || []).catch(() => []),
    ])
      .then(([orderData, weekData]) => {
        if (ignore) return;
        setOrders(orderData);
        setWeeks(weekData);
      })
      .catch(e => { if (!ignore) setError(e.message || 'Could not load tuck shop data.'); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, []);

  const stats = useMemo(() => {
    const active = orders.filter(o => String(o.status || '').toLowerCase() !== 'cancelled');
    const totalSales = active.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const todayKey = new Date().toISOString().slice(0, 10);
    const todaySales = active
      .filter(o => String(o.placedAt || '').slice(0, 10) === todayKey)
      .reduce((sum, o) => sum + Number(o.total || 0), 0);
    const pending = orders.filter(o => String(o.status || '').toLowerCase() === 'pending').length;
    const completed = orders.filter(o => ['completed', 'fulfilled'].includes(String(o.status || '').toLowerCase())).length;
    return { totalSales, todaySales, pending, completed, orderCount: active.length };
  }, [orders]);

  const weeklySales = useMemo(() => {
    const byWeek = new Map();
    weeks.forEach(group => {
      const key = group.weekStart;
      byWeek.set(key, (byWeek.get(key) || 0) + Number(group.total || 0));
    });
    return Array.from(byWeek.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([weekStart, total]) => ({ weekStart, total }));
  }, [weeks]);

  const maxWeekly = useMemo(() => Math.max(1, ...weeklySales.map(w => w.total)), [weeklySales]);

  if (loading) return <div className={PAGE}><div className={CARD}><p className="text-[#800020]">Loading tuck shop finance…</p></div></div>;

  return (
    <div className={PAGE}>
      <div className={HEADER}>
        <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">Tuck Shop Finance</h1>
        <p className="text-[#191970] dark:text-slate-300 mt-1 text-sm">Monitor tuck shop sales, daily takings, and settlement status from live orders.</p>
      </div>

      {error ? <div className={CARD}><p className="text-[#800000] text-sm">{error}</p></div> : null}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={CARD}><p className="text-xs text-[#800020] uppercase font-semibold">Total Sales</p><p className="text-xl font-bold text-emerald-700 mt-1">{formatNaira(stats.totalSales)}</p><p className="text-xs text-[#191970] mt-0.5">{stats.orderCount} order{stats.orderCount === 1 ? '' : 's'}</p></div>
        <div className={CARD}><p className="text-xs text-[#800020] uppercase font-semibold">Today's Sales</p><p className="text-xl font-bold text-[#800000] mt-1">{formatNaira(stats.todaySales)}</p></div>
        <div className={CARD}><p className="text-xs text-[#800020] uppercase font-semibold">Pending Orders</p><p className="text-xl font-bold text-amber-600 mt-1">{stats.pending}</p></div>
        <div className={CARD}><p className="text-xs text-[#800020] uppercase font-semibold">Completed</p><p className="text-xl font-bold text-emerald-700 mt-1">{stats.completed}</p></div>
      </div>

      <div className={CARD}>
        <h2 className="text-lg font-bold text-[#800000] mb-4">Weekly Sales (last 8 weeks)</h2>
        {weeklySales.length === 0 ? <p className="text-[#800020] text-sm">No sales recorded in the last 8 weeks.</p> : (
          <div className="space-y-3">
            {weeklySales.map(w => (
              <div key={w.weekStart}>
                <div className="flex justify-between text-xs text-[#800020] font-semibold mb-1">
                  <span>Week of {new Date(w.weekStart).toLocaleDateString()}</span>
                  <span>{formatNaira(w.total)}</span>
                </div>
                <div className="h-6 rounded-full bg-[#f0d090] overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.round((w.total / maxWeekly) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={CARD}>
        <h2 className="text-lg font-bold text-[#800000] mb-4">Recent Orders</h2>
        {orders.length === 0 ? <p className="text-[#800020] text-sm">No tuck shop orders have been placed yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[#800020] font-semibold border-b border-[#c9a96e]/40">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Placed By</th>
                  <th className="pb-2 pr-4">Items</th>
                  <th className="pb-2 pr-4">Total</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 50).map((o, i) => (
                  <tr key={o.id || i} className="border-b border-[#c9a96e]/20">
                    <td className="py-2 pr-4 text-[#191970]">{o.placedAt ? new Date(o.placedAt).toLocaleString() : '—'}</td>
                    <td className="py-2 pr-4 text-[#191970]">{o.placedBy || '—'}</td>
                    <td className="py-2 pr-4 text-[#191970]">{itemCount(o)}</td>
                    <td className="py-2 pr-4 text-emerald-700 font-semibold">{formatNaira(o.total)}</td>
                    <td className="py-2"><span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_PILL[String(o.status || '').toLowerCase()] || 'bg-slate-100 text-slate-600'}`}>{o.status || '—'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
