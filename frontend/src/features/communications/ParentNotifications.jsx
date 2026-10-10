import React, { useCallback, useEffect, useState } from 'react';
import * as api from './communicationsApi';
import { subscribeChanges } from '../../shared/offline/changeWatcher';

// A parent's notifications from the school (always free, in the app) and their own choice
// of WhatsApp, SMS and email. Opting out always wins over the school's general consent.

const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5 dark:border-white/10 dark:bg-slate-900/40';
const INNER = 'rounded-2xl bg-white p-4 dark:bg-slate-900';
const LABEL = 'text-[11px] font-bold uppercase tracking-[0.12em] text-[#800020] dark:text-slate-400';

export default function ParentNotifications() {
  const [items, setItems] = useState([]);
  const [choices, setChoices] = useState(null);
  const [message, setMessage] = useState('');
  const load = useCallback(() => {
    api.getInbox().then(result => setItems(result.items || [])).catch(() => {});
    api.getMyChoices().then(setChoices).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    return subscribeChanges(() => load());
  }, [load]);
  useEffect(() => {
    if (items.some(item => !item.readAt)) api.markInboxRead([]).catch(() => null);
  }, [items]);

  const choose = async (channel, status) => {
    setMessage('');
    try {
      await api.saveMyChoices({ [channel]: status });
      setChoices(current => ({ ...current, choices: { ...(current?.choices || {}), [channel]: status } }));
      setMessage('Saved.');
    } catch (error) { setMessage(error.message); }
  };
  const state = channel => {
    const choice = choices?.choices?.[channel];
    if (choice) return choice;
    if (channel === 'email') return 'granted';
    return choices?.schoolConfirmedConsent ? 'granted' : 'not set';
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className={CARD}>
        <p className={LABEL}>From the school</p>
        <h1 className="text-2xl font-black text-[#800000] dark:text-white">Notifications</h1>
      </div>
      <div className={INNER}>
        {!items.length && <p className="text-sm text-[#191970] dark:text-slate-300">No notifications yet.</p>}
        <ul className="space-y-2">{items.map(item => (
          <li key={item.id} className={`rounded-xl border p-3 text-sm ${item.readAt ? 'border-[#c9a96e]/25' : 'border-[#1a5c38] bg-[#e8f5ee] dark:bg-slate-800'}`}>
            <p className="font-bold text-[#800000] dark:text-white">{item.title}</p>
            <p className="text-[#191970] dark:text-slate-200">{item.body}</p>
            <p className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}{item.link ? <> · <a className="underline" href={item.link}>Open</a></> : null}</p>
          </li>
        ))}</ul>
      </div>
      <div className={INNER}>
        <p className={LABEL}>How the school may contact you</p>
        <p className="mt-1 text-xs text-[#191970] dark:text-slate-300">Notifications always appear here. You can choose whether you also get them by WhatsApp, SMS or email.</p>
        <ul className="mt-2 space-y-2">{['whatsapp', 'sms', 'email'].map(channel => (
          <li key={channel} className="flex items-center justify-between gap-2 text-sm text-[#191970] dark:text-slate-200">
            <span>{api.CHANNEL_LABELS[channel]}: <b>{state(channel) === 'granted' ? 'On' : state(channel) === 'withdrawn' ? 'Off' : 'Not set'}</b></span>
            <span className="flex gap-2">
              <button type="button" className="rounded-xl border px-3 py-1 text-xs font-semibold" onClick={() => choose(channel, 'granted')}>Turn on</button>
              <button type="button" className="rounded-xl border px-3 py-1 text-xs font-semibold" onClick={() => choose(channel, 'withdrawn')}>Turn off</button>
            </span>
          </li>
        ))}</ul>
        {message && <p role="status" className="mt-2 text-sm">{message}</p>}
      </div>
    </div>
  );
}
