import React, { useEffect, useState } from 'react';
import { getUpcomingCalendar } from '../services/schoolApi';

// "Coming up" on a dashboard: the school calendar events addressed to this
// person over the next few weeks, with any reminder that is now due flagged.

function when(event) {
  const date = new Date(`${event.startDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${date}${event.startTime ? ` · ${event.startTime}` : ''}`;
}

export default function UpcomingEventsCard({ days = 30, limit = 5 }) {
  const [events, setEvents] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getUpcomingCalendar(days).then(data => { if (!cancelled) setEvents(data?.events || []); }).catch(() => { if (!cancelled) setEvents([]); });
    return () => { cancelled = true; };
  }, [days]);

  if (!events || events.length === 0) return null;
  const due = events.filter(event => event.reminderDue);

  return (
    <section aria-label="Coming up" className="rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5 dark:border-white/10 dark:bg-slate-900/40">
      <h2 className="text-base font-black text-[#800000] dark:text-white">Coming up at school</h2>
      {due.length > 0 && (
        <p role="status" className="mt-2 rounded-xl bg-[#c9a96e]/30 px-3 py-2 text-sm font-semibold text-[#191970] dark:text-white">
          🔔 Reminder: {due.map(event => `${event.title} (${when(event)})`).join(' · ')}
        </p>
      )}
      <ul className="mt-3 space-y-2">
        {events.slice(0, limit).map(event => (
          <li key={event.id} className="rounded-2xl bg-white/70 px-3 py-2 text-sm text-[#191970] dark:bg-slate-800 dark:text-slate-100">
            <p className="font-bold">{event.title}</p>
            <p className="text-xs text-[#800020] dark:text-slate-300">{when(event)}{event.location ? ` · ${event.location}` : ''}</p>
            {event.description && <p className="mt-1 text-xs">{event.description}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
