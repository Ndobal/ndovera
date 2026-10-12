import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getToday } from './birthdaysApi';

// "Today we celebrate …" under the dashboard header. Asked once per day per tab (kept in
// sessionStorage), so it costs next to nothing; shows nothing when there are no birthdays.

const today = () => new Date().toISOString().slice(0, 10);

export default function BirthdayStrip({ roleKey }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    let cancelled = false;
    const key = `ndovera:birthdays:${roleKey}:${today()}`;
    try {
      const kept = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (Array.isArray(kept)) { setItems(kept); return undefined; }
    } catch { /* ask the server */ }
    getToday().then(result => {
      const list = (result.items || []).slice(0, 20);
      try { sessionStorage.setItem(key, JSON.stringify(list)); } catch { /* fine */ }
      if (!cancelled) setItems(list);
    }).catch(() => null);
    return () => { cancelled = true; };
  }, [roleKey]);
  if (!items.length) return null;
  const names = items.slice(0, 3).map(item => item.name).join(', ') + (items.length > 3 ? ` and ${items.length - 3} more` : '');
  return (
    <Link to={`/roles/${roleKey}/birthdays${items.length === 1 ? `?c=${encodeURIComponent(items[0].id)}` : ''}`} className="mx-auto mt-2 block max-w-7xl rounded-2xl border border-[#c9a96e]/50 bg-[#fff8f0] px-4 py-2 text-sm font-semibold text-[#800000] hover:bg-white dark:bg-[#120014]/85 dark:text-[#ffd166]">
      🎂 Today we celebrate {names}! Send a wish →
    </Link>
  );
}
