import React, { useEffect, useState } from 'react';
import { getConnectionStatus, startChangeWatcher, subscribeConnection } from './changeWatcher';
import { listOutbox, subscribe as subscribeOutbox } from './outbox';

// Offline, or Ndovera busy/unavailable: the same calm message either way. The person keeps
// their role and what is already on screen; work they do is queued and sent on its own.
export default function ConnectionBanner() {
  const [status, setStatus] = useState(getConnectionStatus);
  const [waiting, setWaiting] = useState(0);

  useEffect(() => {
    startChangeWatcher();
    const offConnection = subscribeConnection(setStatus);
    const count = items => setWaiting((items || []).filter(item => item.status === 'queued').length);
    listOutbox().then(count).catch(() => null);
    const offOutbox = subscribeOutbox(count);
    return () => { offConnection(); offOutbox(); };
  }, []);

  if (status === 'ok' && !waiting) return null;
  const message = status === 'offline'
    ? 'You are offline.'
    : status === 'unavailable'
      ? 'Ndovera is very busy right now.'
      : 'Sending your saved work…';
  return (
    <div role="status" aria-live="polite" className="mx-auto mt-2 max-w-7xl rounded-2xl border border-[#c9a96e]/50 bg-[#fff8f0] px-4 py-2 text-sm text-[#191970] dark:border-[#00ffff]/25 dark:bg-[#120014]/85 dark:text-[#b5e3f4]">
      <span className="font-bold text-[#800000] dark:text-white">{message}</span>{' '}
      {status !== 'ok' && 'You can keep reading what has already opened on this device, and your work is saved here. '}
      {waiting > 0 ? `${waiting} item(s) will be sent automatically when Ndovera is back.` : status !== 'ok' ? 'Anything you submit will be sent automatically when Ndovera is back.' : ''}
    </div>
  );
}
