import React, { useCallback, useEffect, useState } from 'react';
import {
  deleteAmiPartnerUpdate, getAmiPartnerToolkit, getAmiPartnerUpdates, publishAmiPartnerUpdate, saveAmiPartnerToolkit, saveAmiPartnerUpdate,
} from '../../../features/public/services/publicSiteApi';

// Ami writes what partners see: updates under What's new, and the messages in their Toolkit.

const BOX = 'mt-6 space-y-3 rounded-2xl border border-slate-300 bg-white p-4 text-slate-900 dark:border-white/20 dark:bg-slate-900 dark:text-white';
const INNER = 'space-y-2 rounded-2xl bg-slate-100 p-3 dark:bg-white/5';
const TITLE = 'font-black text-slate-900 dark:text-white';
const TEXT = 'whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100';
const LABEL = 'block text-xs font-bold text-slate-800 dark:text-slate-100';
const FIELD = 'mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/20 dark:bg-slate-800 dark:text-white';
const PRIMARY = 'rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white disabled:opacity-60';
const SECONDARY = 'rounded-xl border border-slate-400 bg-white px-3 py-2 text-xs font-black text-slate-800 dark:border-white/30 dark:bg-slate-800 dark:text-white';
const EMPTY = { id: '', title: '', body: '', explain: '' };

export default function AmiPartnerUpdates() {
  const [updates, setUpdates] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [messages, setMessages] = useState([]);
  const [notice, setNotice] = useState('');
  const load = useCallback(() => getAmiPartnerUpdates().then(result => setUpdates(result.updates)).catch(error => setNotice(error.message)), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { getAmiPartnerToolkit().then(result => setMessages(result.messages)).catch(error => setNotice(error.message)); }, []);
  const set = name => event => setForm(current => ({ ...current, [name]: event.target.value }));
  const fail = error => setNotice(error.message);
  const save = event => {
    event.preventDefault();
    saveAmiPartnerUpdate(form).then(() => { setForm(EMPTY); setNotice('Saved as a draft. Partners see it once you publish it.'); return load(); }).catch(fail);
  };
  const publish = (item, published) => publishAmiPartnerUpdate(item.id, published).then(() => { setNotice(published ? 'Published. Partners now see it as new.' : 'Taken down.'); return load(); }).catch(fail);
  const remove = item => deleteAmiPartnerUpdate(item.id).then(load).catch(fail);
  const change = (index, name, value) => setMessages(current => current.map((item, at) => (at === index ? { ...item, [name]: value } : item)));
  const saveMessages = () => saveAmiPartnerToolkit(messages).then(result => { setMessages(result.messages); setNotice('Toolkit messages saved.'); }).catch(fail);
  return (
    <section className={BOX} aria-label="Partner updates and Toolkit">
      <h3 className={TITLE}>What's new for partners</h3>
      <p className={TEXT}>Partners repeat this to schools, so publish only what works today.</p>
      {notice ? <p role="status" className="text-sm font-bold text-slate-900 dark:text-white">{notice}</p> : null}
      <form onSubmit={save} className="space-y-2" aria-label="Write an update">
        <label className={LABEL}>Title<input className={FIELD} value={form.title} onChange={set('title')} /></label>
        <label className={LABEL}>What changed<textarea rows={3} className={FIELD} value={form.body} onChange={set('body')} /></label>
        <label className={LABEL}>How to explain it to a school (optional)<textarea rows={2} className={FIELD} value={form.explain} onChange={set('explain')} /></label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={PRIMARY}>{form.id ? 'Save changes' : 'Save as draft'}</button>
          {form.id ? <button type="button" className={SECONDARY} onClick={() => setForm(EMPTY)}>Cancel</button> : null}
        </div>
      </form>
      <ul className="space-y-2">
        {updates.map(item => (
          <li key={item.id} className={INNER}>
            <p className={TITLE}>{item.title} · {item.status === 'published' ? 'Published' : 'Draft'}</p>
            <p className={TEXT}>{item.body}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={item.status === 'published' ? SECONDARY : PRIMARY} onClick={() => publish(item, item.status !== 'published')}>{item.status === 'published' ? 'Take down' : 'Publish'}</button>
              <button type="button" className={SECONDARY} onClick={() => setForm({ id: item.id, title: item.title, body: item.body, explain: item.explain })}>Edit</button>
              <button type="button" className={SECONDARY} onClick={() => remove(item)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>

      <h3 className={TITLE}>Toolkit messages</h3>
      <p className={TEXT}>{'Each partner sees these with their own details: {link}, {setupFee}, {perUser} and {code}. Every message needs {link}.'}</p>
      {messages.map((item, index) => (
        // The position is the identity while a title is being typed.
        // eslint-disable-next-line react/no-array-index-key
        <div key={index} className={INNER}>
          <label className={LABEL}>Title<input className={FIELD} value={item.title} onChange={event => change(index, 'title', event.target.value)} /></label>
          <label className={LABEL}>Message<textarea rows={5} className={FIELD} value={item.body} onChange={event => change(index, 'body', event.target.value)} /></label>
          <button type="button" className={SECONDARY} onClick={() => setMessages(current => current.filter((_, at) => at !== index))}>Remove</button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={SECONDARY} onClick={() => setMessages(current => [...current, { title: '', body: '{link}' }])}>Add a message</button>
        <button type="button" className={PRIMARY} onClick={saveMessages}>Save Toolkit messages</button>
      </div>
    </section>
  );
}
