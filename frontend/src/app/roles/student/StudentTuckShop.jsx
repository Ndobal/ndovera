import React, { useMemo, useState, useEffect } from 'react';
import StudentSectionShell from './StudentSectionShell';

export default function StudentTuckShop() {
  const studentId = localStorage.getItem('userId') || '';
  const [inventory, setInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [cart, setCart] = useState({});

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    fetch('/api/tuck/menu', { headers })
      .then(r => r.ok ? r.json() : { items: [] })
      .then(json => setInventory(json.items || json.menu || []))
      .catch(() => setInventory([]))
      .finally(() => setInventoryLoading(false));
  }, []);

  const addToCart = (item) => {
    setCart(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }));
  };
  const removeFromCart = (item) => {
    setCart(prev => {
      const next = { ...prev };
      if (!next[item.id]) return next;
      next[item.id] = next[item.id] - 1;
      if (next[item.id] <= 0) delete next[item.id];
      return next;
    });
  };

  const cartItems = useMemo(() => {
    return Object.entries(cart).map(([id, qty]) => {
      const info = inventory.find(i => i.id === id);
      return { ...info, qty };
    });
  }, [cart, inventory]);

  const total = useMemo(() => cartItems.reduce((s, it) => s + (it.price || 0) * it.qty, 0), [cartItems]);

  const checkout = async () => {
    if (cartItems.length === 0) return alert('Cart is empty');
    const payload = {
      id: `order_${Date.now()}`,
      placedBy: studentId,
      items: cartItems.map(i => ({ id: i.id, name: i.name, qty: i.qty, price: i.price })),
      total,
      notes: null,
    };
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch('/api/tuck/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      const json = await resp.json();
      if (json && json.success) {
        alert('Purchase placed! Your order will be served at lunch.');
        setCart({});
      } else {
        console.error('Order failed', json);
        alert('Could not complete purchase.');
      }
    } catch (err) {
      console.error(err);
      alert('Could not complete purchase.');
    }
  };

  // Weekly history
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!studentId) return;
    let mounted = true;
    async function loadHistory() {
      try {
        const resp = await fetch(`/api/tuck/orders?placedBy=${encodeURIComponent(studentId)}`);
        if (!resp.ok) throw new Error('Network');
        const json = await resp.json();
        if (!mounted) return;
        const rows = (json.orders || []).map(o => ({ ...o, placedAt: o.placedAt || o.placedAt || o.placedAt }));
        // group by week starting Monday
        const grouped = {};
        rows.forEach(o => {
          const d = o.placedAt ? new Date(o.placedAt) : new Date();
          // get ISO week key YYYY-WW
          const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
          const day = tmp.getUTCDay() || 7; // Mon=1..Sun=7
          const monday = new Date(tmp);
          monday.setUTCDate(tmp.getUTCDate() - (day - 1));
          const key = monday.toISOString().slice(0,10);
          if (!grouped[key]) grouped[key] = { weekStart: key, orders: [], total: 0 };
          grouped[key].orders.push(o);
          grouped[key].total += Math.round((o.total || 0) * 100) / 100;
        });
        const arr = Object.values(grouped).sort((a,b)=> b.weekStart.localeCompare(a.weekStart));
        setHistory(arr);
      } catch (err) {
        console.warn('Could not load tuck history', err && err.message);
      }
    }
    loadHistory();
    return () => { mounted = false; };
  }, [studentId]);

  return (
    <StudentSectionShell title="Tuck Shop" subtitle="Order snacks and lunches for pickup at school">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {inventoryLoading && (
              <div className="rounded-2xl p-4 bg-slate-900/20 border border-white/10">
                <p className="text-sm text-slate-400">Loading menu…</p>
              </div>
            )}
            {!inventoryLoading && inventory.length === 0 && (
              <div className="rounded-2xl p-4 bg-slate-900/20 border border-white/10">
                <p className="text-sm text-slate-400">No menu items available right now. Check back later.</p>
              </div>
            )}
            {inventory.map(item => (
              <div key={item.id} className="rounded-2xl p-4 bg-slate-900/20 border border-white/10">
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 bg-slate-800 rounded-md flex items-center justify-center text-slate-400">🍱</div>
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

          <div className="mt-4 border-t border-white/5 pt-4">
            <div className="flex justify-between text-slate-400">Subtotal <span className="mono-metric">₦{total}</span></div>
            <button onClick={checkout} className="w-full mt-3 px-4 py-2 rounded-xl bg-emerald-500/30 text-emerald-100">Checkout</button>
          </div>
        </aside>
      </div>

      {/* Weekly history */}
      <div className="mt-8">
        <h3 className="text-lg text-slate-100 font-semibold mb-3">Weekly History</h3>
        {history.length === 0 && <div className="text-slate-400">No recent orders</div>}
        <div className="space-y-3">
          {history.map(w => (
            <div key={w.weekStart} className="rounded-2xl p-3 bg-slate-900/20 border border-white/10 flex items-center justify-between">
              <div>
                <div className="text-slate-100 font-medium">Week of {w.weekStart}</div>
                <div className="text-xs neon-subtle">{w.orders.length} orders</div>
              </div>
              <div className="text-emerald-300 font-semibold">₦{w.total}</div>
            </div>
          ))}
        </div>
      </div>
    </StudentSectionShell>
  );
}
