import React, { useMemo, useState, useEffect } from 'react';
import StudentSectionShell from '../student/StudentSectionShell';

const INVENTORY = [
  { id: 'itm-lunch', name: 'Lunch Combo', price: 1500, desc: 'Rice, stew & protein' },
  { id: 'itm-juice', name: 'Fruit Juice', price: 400, desc: 'Freshly squeezed' },
  { id: 'itm-snack', name: 'Snack Pack', price: 500, desc: 'Chips + cookie' },
  { id: 'itm-sandwich', name: 'Sandwich', price: 700, desc: 'Ham & cheese' },
  { id: 'itm-salad', name: 'Fresh Salad', price: 650, desc: 'Seasonal greens' },
];

function saveOrderToHistory(order) {
  const raw = localStorage.getItem('staffTuckOrders') || '[]';
  const arr = JSON.parse(raw);
  arr.unshift(order);
  localStorage.setItem('staffTuckOrders', JSON.stringify(arr.slice(0, 50)));
}

export default function StaffTuckShop() {
  const [cart, setCart] = useState({});
  const [notes, setNotes] = useState('');
  const [history, setHistory] = useState([]);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [weeklySummary, setWeeklySummary] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoadingHistory(true);
      try {
        const resp = await fetch('/api/tuck/orders?placedBy=staff-1');
        const json = await resp.json();
        if (json && json.success && Array.isArray(json.orders)) {
          setHistory(json.orders);
          localStorage.setItem('staffTuckOrders', JSON.stringify(json.orders.slice(0,50)));
          setLoadingHistory(false);
          return;
        }
      } catch (err) {
        // ignore and fallback to local
      }
      const raw = localStorage.getItem('staffTuckOrders') || '[]';
      setHistory(JSON.parse(raw));
      setLoadingHistory(false);
    };
    load();
    // also fetch weekly summary for all users
    (async function loadWeekly(){
      try {
        const resp = await fetch('/api/tuck/orders/weekly?weeks=8');
        const json = await resp.json();
        if (json && json.success) setWeeklySummary(json.weeks || []);
      } catch (err) { /* ignore */ }
    })();
  }, []);

  const addToCart = (item) => setCart(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }));
  const removeFromCart = (item) => setCart(prev => {
    const next = { ...prev };
    if (!next[item.id]) return next;
    next[item.id] -= 1;
    if (next[item.id] <= 0) delete next[item.id];
    return next;
  });

  const cartItems = useMemo(() => Object.entries(cart).map(([id, qty]) => ({ ...INVENTORY.find(i => i.id === id), qty })), [cart]);
  const total = useMemo(() => cartItems.reduce((s, it) => s + (it.price || 0) * it.qty, 0), [cartItems]);

  const cartFromItems = (items) => {
    const map = {};
    (items || []).forEach(i => { map[i.id] = i.qty; });
    return map;
  };

  const placeOrder = async () => {
    if (cartItems.length === 0) return alert('Cart is empty');
    const payload = { id: editingOrderId || `order_${Date.now()}`, items: cartItems, total, notes, placedBy: 'staff-1', status: 'pending' };
    try {
      if (editingOrderId) {
        const resp = await fetch(`/api/tuck/orders/${editingOrderId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: cartItems, total, notes, placedBy: 'staff-1' }) });
        const json = await resp.json();
        if (json && json.success) {
          // refresh history
          const hresp = await fetch('/api/tuck/orders?placedBy=staff-1');
          const hj = await hresp.json();
          if (hj && hj.success) setHistory(hj.orders);
          // persist locally for offline quick access
          saveOrderToHistory({ id: editingOrderId, items: cartItems, total, notes, placedBy: 'staff-1', status: 'pending', placedAt: new Date().toISOString() });
          setEditingOrderId(null);
          setCart({});
          setNotes('');
          alert('Order updated');
        } else {
          alert('Could not update order');
        }
      } else {
        const resp = await fetch('/api/tuck/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const json = await resp.json();
        if (json && json.success) {
          // prepend to history
          const newOrder = json.order;
          setHistory(prev => [newOrder, ...prev].slice(0,50));
          localStorage.setItem('staffTuckOrders', JSON.stringify([newOrder, ...history].slice(0,50)));
          saveOrderToHistory(newOrder);
          setCart({});
          setNotes('');
          alert('Order placed — kitchen will prepare it for pickup.');
        } else {
          alert('Could not place order');
        }
      }
    } catch (err) {
      console.error(err);
      alert('Could not place order.');
    }
  };

  const amendOrder = (order) => {
    setCart(cartFromItems(order.items));
    setNotes(order.notes || '');
    setEditingOrderId(order.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelOrder = async (orderId) => {
    if (!window.confirm('Cancel this pending order?')) return;
    try {
      const resp = await fetch(`/api/tuck/orders/${orderId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }) });
      const json = await resp.json();
      if (json && json.success) {
        const hresp = await fetch('/api/tuck/orders?placedBy=staff-1');
        const hj = await hresp.json();
        if (hj && hj.success) setHistory(hj.orders);
        alert('Order cancelled');
      } else alert('Could not cancel order');
    } catch (err) { console.error(err); alert('Could not cancel order'); }
  };

  return (
    <StudentSectionShell title="Staff Tuck Shop" subtitle="Order meals and snacks for staff.">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {INVENTORY.map(item => (
              <div key={item.id} className="rounded-2xl p-4 bg-slate-900/20 border border-white/10">
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 bg-slate-800 rounded-md flex items-center justify-center text-slate-400">🍽️</div>
                  <div className="flex-1">
                    <div className="text-slate-100 font-medium">{item.name}</div>
                    <div className="text-xs text-slate-400">{item.desc}</div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="mono-metric text-slate-100">₦{item.price}</div>
                      <button onClick={() => addToCart(item)} className="px-3 py-1 rounded-lg bg-indigo-500/30 text-indigo-100 text-sm">Add</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="col-span-1 rounded-2xl p-4 bg-slate-900/20 border border-white/10">
          <h3 className="text-lg text-slate-100 font-semibold">Your Cart</h3>
          <div className="mt-3">
            {cartItems.length === 0 && <div className="text-slate-400">No items in cart</div>}
            {cartItems.map(it => (
              <div key={it.id} className="flex items-center justify-between py-2 border-t border-white/5">
                <div>
                  <div className="text-slate-100">{it.name} <span className="text-xs text-slate-400">x{it.qty}</span></div>
                  <div className="text-xs text-slate-400">₦{it.price} each</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => removeFromCart(it)} className="px-2 py-1 rounded bg-white/5">-</button>
                  <button onClick={() => addToCart(it)} className="px-2 py-1 rounded bg-white/5">+</button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <label className="text-sm text-slate-400">Notes (optional)</label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} className="w-full mt-2 p-2 rounded-md bg-slate-900/10 text-slate-200" placeholder="Delivery note or allergies" />
          </div>

          <div className="mt-4">
            <div className="flex justify-between text-slate-400">Subtotal <span className="mono-metric">₦{total}</span></div>
            <button onClick={placeOrder} className="w-full mt-3 px-4 py-2 rounded-xl bg-emerald-500/30 text-emerald-100">Place Order</button>
          </div>

          <div className="mt-6">
            <h4 className="text-sm text-slate-100 font-medium">Recent Orders</h4>
            <div className="mt-2 text-xs text-slate-400 max-h-48 overflow-y-auto">
              {history.length === 0 && <div className="text-slate-400">No recent orders</div>}
              {loadingHistory && <div className="text-slate-400">Loading…</div>}
              {history.map(h => (
                <div key={h.id} className="py-2 border-t border-white/5">
                  <div className="text-slate-100">{(h.items||[]).map(i=>`${i.name} x${i.qty}`).join(', ')}</div>
                  <div className="text-xs text-slate-400">{new Date(h.placedAt).toLocaleString()} • ₦{h.total} • {h.status}</div>
                  {h.status === 'pending' && (
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => amendOrder(h)} className="px-2 py-1 rounded bg-indigo-600 text-white text-xs">Amend</button>
                      <button onClick={() => cancelOrder(h.id)} className="px-2 py-1 rounded bg-rose-600 text-white text-xs">Cancel</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>
        <aside className="col-span-1 lg:col-span-3 mt-6 rounded-2xl p-4 bg-slate-900/20 border border-white/10">
          <h4 className="text-sm text-slate-100 font-medium">Weekly Summary (All Users)</h4>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            {weeklySummary.length === 0 && <div className="text-slate-400">No data</div>}
            {weeklySummary.map(w => (
              <div key={`${w.placedBy}-${w.weekStart}`} className="rounded-xl p-3 bg-slate-800/30">
                <div className="text-xs neon-subtle">{w.placedBy}</div>
                <div className="text-sm text-slate-100 font-semibold">Week of {w.weekStart}</div>
                <div className="text-emerald-300">₦{w.total} • {w.orders.length} orders</div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </StudentSectionShell>
  );
}
