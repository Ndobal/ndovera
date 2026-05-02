import React, { useState, useEffect } from 'react';
import { fetchOfflineInventory } from '../service/libraryService';

export default function LibrarianPanel({ schoolId }) {
  const [inventory, setInventory] = useState([]);

  useEffect(() => {
    (async () => {
      const inv = await fetchOfflineInventory(schoolId);
      setInventory(inv);
    })();
  }, [schoolId]);

  const handleIssue = (item) => {
    // decrement count locally - in a real app, send to server to update inventory
    setInventory(prev => prev.map(i => i.id === item.id ? { ...i, copies: i.copies - 1 } : i));
  };

  const handleReturn = (item) => {
    setInventory(prev => prev.map(i => i.id === item.id ? { ...i, copies: i.copies + 1 } : i));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4 border border-white/10 bg-slate-900/20">
        <h3 className="text-lg text-slate-100">Librarian Panel — {schoolId}</h3>
        <p className="text-sm text-slate-400">Manage inventory, waiting lists, and overdue tracking.</p>
      </div>

      <div className="space-y-2">
        {inventory.map(item => (
          <div key={item.id} className="rounded-xl border border-white/10 p-3 bg-slate-900/20 flex items-center justify-between">
            <div>
              <div className="text-slate-100 font-medium">{item.title}</div>
              <div className="text-xs text-slate-400">Available: {item.available} • Shelf: {item.shelf}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleIssue(item)} className="px-3 py-1 rounded-lg bg-indigo-500/30 text-indigo-100">Issue</button>
              <button onClick={() => handleReturn(item)} className="px-3 py-1 rounded-lg bg-emerald-500/30 text-emerald-100">Return</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
