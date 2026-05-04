import React, { useEffect, useState } from 'react';
import { fetchOfflineInventory, requestOfflineBook } from '../service/libraryService';

export default function OfflineLibrary({ schoolId, userId }) {
  const [inventory, setInventory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [pickupDate, setPickupDate] = useState('');

  useEffect(() => {
    (async () => {
      const inv = await fetchOfflineInventory(schoolId);
      setInventory(inv);
    })();
  }, [schoolId]);

  const handleRequest = async (item) => {
    try {
      const req = await requestOfflineBook({ physicalId: item.id, userId, pickupDate: pickupDate || new Date().toISOString().slice(0,10) });
      alert(`Request submitted: ${req.requestId}`);
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 p-4 bg-slate-900/20">
        <h3 className="text-lg text-slate-100 font-semibold">{`Offline Library — ${schoolId}`}</h3>
        <p className="text-sm text-slate-400">Search the physical inventory and request pickup.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {inventory.map(item => (
          <div key={item.id} className="rounded-xl border border-white/10 p-4 bg-slate-900/20">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-slate-100 font-medium">{item.title}</h4>
                <p className="text-xs text-slate-400">Copies: {item.copies} • Available: {item.available}</p>
                <p className="text-xs text-slate-400">Shelf: {item.shelf} • ISBN: {item.isbn}</p>
              </div>
              <div className="space-y-2 text-right">
                <button onClick={() => setSelected(item)} className="px-3 py-2 rounded-lg bg-indigo-500/30 text-indigo-100 text-sm">Request Book</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {inventory.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/10 p-5 bg-slate-900/20 text-center">
          <p className="micro-label accent-amber">No offline inventory</p>
          <p className="mt-2 text-sm text-slate-300">Physical library inventory is not yet connected for this school.</p>
        </div>
      )}

      {selected && (
        <div className="rounded-xl p-4 border border-white/10 bg-slate-900/30">
          <h4 className="text-slate-100">Request: {selected.title}</h4>
          <label className="text-xs text-slate-400">Pickup Date</label>
          <input type="date" value={pickupDate} onChange={e => setPickupDate(e.target.value)} className="block rounded-md p-2 bg-slate-900/20 border border-white/10 text-slate-200 mt-1" />
          <div className="mt-3 flex gap-2">
            <button onClick={() => handleRequest(selected)} className="px-4 py-2 rounded-xl bg-emerald-500/30 text-emerald-100">Submit Request</button>
            <button onClick={() => setSelected(null)} className="px-4 py-2 rounded-xl border border-white/10 text-slate-300">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
