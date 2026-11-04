import React, { useEffect, useState } from 'react';
import { createBulkInvites, createParentInvite, getStudentEmailDomain, saveStudentEmailDomain } from '../services/schoolApi';

// Two school-wide settings for families: the email ending for students, and invitation links for parents.

const CARD = 'space-y-3 rounded-3xl border border-[#c9a96e]/40 bg-white p-5 text-[#191970] dark:border-white/10 dark:bg-slate-900 dark:text-slate-100';
const FIELD = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/20 dark:bg-slate-800 dark:text-white';
const PRIMARY = 'rounded-xl bg-[#1a5c38] px-4 py-2 text-sm font-black text-white disabled:opacity-60';
const LINK = 'rounded-xl border border-[#191970]/40 bg-white px-4 py-2 text-sm font-black text-[#191970] dark:border-white/30 dark:bg-slate-800 dark:text-white';
const MAX_CHILDREN = 6;

export function StudentEmailDomain() {
  const [domain, setDomain] = useState('');
  const [inUse, setInUse] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    getStudentEmailDomain().then(result => { setDomain(result.domain ? `@${result.domain}` : ''); setInUse(result.inUse); }).catch(err => setMessage(err.message));
  }, []);
  const save = event => {
    event.preventDefault();
    saveStudentEmailDomain(domain).then(result => { setInUse(result.inUse); setMessage('Saved. New students use this now. Existing students change when you press "Use school email" on their profile.'); }).catch(err => setMessage(err.message));
  };
  return (
    <form onSubmit={save} className={CARD} aria-label="Student email ending">
      <label className="block text-sm font-bold">Student email ending<input className={FIELD} value={domain} onChange={event => setDomain(event.target.value)} placeholder="@yourschool.com" /></label>
      <p className="text-sm">New students get {inUse ? `first.surname@${inUse}` : 'an address from their name'}. It is for signing in only: students never receive email.</p>
      <button type="submit" className={PRIMARY}>Save</button>
      {message ? <p role="status" className="text-sm font-bold">{message}</p> : null}
    </form>
  );
}

const BULK_PAGE = 30;

/** One invitation for each student in a class whose parent is not linked yet. */
export function ClassInvites({ students = [] }) {
  const classes = [...new Set(students.map(student => student.className).filter(Boolean))].sort();
  const [className, setClassName] = useState('');
  const [invites, setInvites] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const made = new Set(invites.map(item => item.studentId));
  const waiting = students.filter(student => student.className === className && !(student.parents || []).length && !made.has(student.id));
  const create = async () => {
    setBusy(true); setMessage('');
    try {
      const result = await createBulkInvites(waiting.slice(0, BULK_PAGE).map(student => student.id));
      setInvites(current => [...current, ...result.invites]);
    } catch (err) { setMessage(err.message); } finally { setBusy(false); }
  };
  const download = () => {
    const rows = ['student,class,student_code,link', ...invites.map(item => [item.name, item.className, item.code, item.url].map(value => `"${String(value || '').replace(/"/g, '""')}"`).join(','))];
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
    link.download = 'parent-invitations.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };
  return (
    <section className={CARD} aria-label="Invite a whole class">
      <h3 className="text-lg font-black text-[#800000] dark:text-white">Invite a whole class</h3>
      <label className="block text-sm font-bold">Class
        <select className={FIELD} value={className} onChange={event => setClassName(event.target.value)}>
          <option value="">Choose a class…</option>{classes.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
      </label>
      {className ? <p className="text-sm">{waiting.length} student{waiting.length === 1 ? '' : 's'} in {className} with no parent linked.</p> : null}
      <button type="button" className={PRIMARY} disabled={!waiting.length || busy} onClick={create}>{busy ? 'Creating…' : `Create ${Math.min(waiting.length, BULK_PAGE) || ''} invitations`}</button>
      {message ? <p role="alert" className="text-sm font-bold">{message}</p> : null}
      {invites.length ? (
        <>
          <button type="button" className={LINK} onClick={download}>Download all as a spreadsheet</button>
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {invites.map(item => (
              <li key={item.url} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm dark:bg-white/10">
                <span className="font-semibold">{item.name}</span>
                <a href={`https://wa.me/?text=${encodeURIComponent(item.message)}`} target="_blank" rel="noreferrer noopener" className="rounded-lg bg-[#25D366] px-2 py-1 text-xs font-black text-[#06301a]">WhatsApp</a>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

export default function ParentInvitePanel({ students = [] }) {
  const [search, setSearch] = useState('');
  const [chosen, setChosen] = useState([]);
  const [sendTo, setSendTo] = useState('');
  const [invite, setInvite] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const needle = search.trim().toLowerCase();
  const found = needle ? students.filter(student => [student.name, student.displayId, student.className].some(value => String(value || '').toLowerCase().includes(needle))).slice(0, 8) : [];
  const toggle = id => setChosen(current => (current.includes(id) ? current.filter(item => item !== id) : current.length < MAX_CHILDREN ? [...current, id] : current));
  const picked = students.filter(student => chosen.includes(student.id));

  const create = async () => {
    setBusy(true); setMessage(''); setInvite(null);
    try {
      const result = await createParentInvite({ studentIds: chosen, sendTo: sendTo.trim() });
      setInvite(result);
      setMessage(result.emailedTo ? `Emailed to ${result.emailedTo}.` : 'Invitation ready. Send it by WhatsApp or copy the link.');
    } catch (err) { setMessage(err.message); } finally { setBusy(false); }
  };

  return (
    <section className={CARD} aria-label="Invite a parent">
      <h3 className="text-lg font-black text-[#800000] dark:text-white">Invite a parent by link</h3>
      <label className="block text-sm font-bold">Find their children<input className={FIELD} value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, student code or class" /></label>
      {found.length ? (
        <ul className="space-y-1">
          {found.map(student => (
            <li key={student.id}><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={chosen.includes(student.id)} onChange={() => toggle(student.id)} />{student.name}{student.className ? ` · ${student.className}` : ''}{student.displayId ? ` · ${student.displayId}` : ''}</label></li>
          ))}
        </ul>
      ) : null}
      {picked.length ? <p className="text-sm font-bold">Invitation for: {picked.map(student => student.name).join(', ')}</p> : null}
      <label className="block text-sm font-bold">Parent's email, if you have it (optional)<input type="email" className={FIELD} value={sendTo} onChange={event => setSendTo(event.target.value)} /></label>
      <button type="button" className={PRIMARY} disabled={!chosen.length || busy} onClick={create}>{busy ? 'Creating…' : 'Create invitation'}</button>
      {message ? <p role="status" className="text-sm font-bold">{message}</p> : null}
      {invite ? (
        <div className="space-y-2">
          <input readOnly aria-label="Invitation link" className={FIELD} value={invite.url} />
          <div className="flex flex-wrap gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(invite.message)}`} target="_blank" rel="noreferrer noopener" className={LINK}>Send on WhatsApp</a>
            <button type="button" className={LINK} onClick={() => navigator.clipboard?.writeText(invite.url).then(() => setMessage('Link copied.')).catch(() => setMessage('Select the link above and copy it.'))}>Copy link</button>
          </div>
          <p className="text-xs">The link works once, for {invite.days} days.</p>
        </div>
      ) : null}
    </section>
  );
}
