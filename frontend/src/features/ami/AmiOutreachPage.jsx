import React, { useCallback, useEffect, useState } from 'react';
import { EnvelopeIcon, GlobeAltIcon, NoSymbolIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { addOutreachSources, gatherOutreachNow, getOutreach, removeOutreachSource, saveOutreachSettings, setProspectStatus } from '../tenants/services/tenantApi';
import { getApiUrl } from '../../config/apiBase';
import { getStoredAuth } from '../auth/services/authApi';
import { AmiPage, FIELD, Panel, Pill, PRIMARY, SECONDARY, StatCard, TD, TH, shortDate } from './AmiUi';

// School outreach: every Sunday night Ndovera visits the school pages listed here and keeps the
// email addresses printed on them, once each. When sending is on, schools get the plan's emails —
// day 1, day 15, then every two months — until they reply, book a demo, opt out or join.

const STATUS = {
  new: ['info', 'Not emailed yet'], active: ['good', 'Being emailed'], replied: ['good', 'Replied'], demo: ['good', 'Demo booked'],
  converted: ['good', 'Joined Ndovera'], opted_out: ['bad', 'Opted out'], bounced: ['warn', 'Address failing'], paused: ['warn', 'Paused'],
};
const STEP_LABELS = { first: 'First email (day 1)', second: 'Follow-up (day 15)', later: 'Every two months' };

export default function AmiOutreachPage() {
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({ status: '', country: '', q: '' });
  const [settings, setSettings] = useState(null);
  const [sourceForm, setSourceForm] = useState({ country: 'NG', urls: '' });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const result = await getOutreach(filters);
      setData(result);
      setSettings(current => current || result.settings);
      setError('');
    } catch (err) { setError(err.message); }
  }, [filters]);
  useEffect(() => { load(); }, [load]);

  const run = async (key, action, message) => {
    setBusy(key); setError(''); setNotice('');
    try { const result = await action(); setNotice(typeof message === 'function' ? message(result) : message); await load(); }
    catch (err) { setError(err.message); }
    finally { setBusy(''); }
  };

  const exportCsv = async () => {
    const response = await fetch(getApiUrl('/api/ami/outreach/export'), { headers: { Authorization: `Bearer ${getStoredAuth()?.token || ''}` } });
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url; link.download = 'ndovera-school-outreach.csv'; link.click();
    URL.revokeObjectURL(url);
  };

  const count = status => Number((data?.byStatus || []).find(row => row.status === status)?.n || 0);
  const total = (data?.byStatus || []).reduce((sum, row) => sum + Number(row.n || 0), 0);
  const countries = data?.countries || {};

  return (
    <AmiPage title="School outreach" subtitle="School email addresses gathered weekly from public school pages across Nigeria and Africa, and the introduction emails sent to them." crumbs={['School outreach']}>
      {error ? <p role="alert" className="rounded-lg bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-800">{error}</p> : null}
      {notice ? <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p> : null}
      {!data && !error ? <p role="status" className="text-sm text-slate-600 dark:text-slate-300">Loading…</p> : null}
      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={GlobeAltIcon} label="Schools gathered" value={total.toLocaleString()} hint={`${data.thisWeek?.found_new || 0} new this week`} />
            <StatCard icon={PaperAirplaneIcon} label="Being emailed" value={count('active').toLocaleString()} hint={`${data.sentToday} sent today`} tone="green" />
            <StatCard icon={EnvelopeIcon} label="Replied or demo" value={(count('replied') + count('demo') + count('converted')).toLocaleString()} hint={`${count('converted')} joined Ndovera`} tone="gold" />
            <StatCard icon={NoSymbolIcon} label="Opted out" value={count('opted_out').toLocaleString()} hint="never emailed again" tone="maroon" />
          </div>

          {settings ? (
            <Panel title="Sending">
              <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
                {!data.emailReady ? <p className="rounded-lg bg-amber-100 px-3 py-2 font-semibold text-amber-900">Email is not set up on the server, so nothing can be sent yet.</p> : null}
                <label className="flex items-start gap-3">
                  <input type="checkbox" className="mt-1 h-4 w-4" checked={settings.sending} onChange={event => setSettings({ ...settings, sending: event.target.checked })} />
                  <span><b className="text-[#0b1f3a] dark:text-white">Send the emails automatically</b><br />Weekday mornings, 09:00–11:00 Lagos: day 1, day 15, then every two months, until the school replies, books a demo, opts out or joins. Every email has a one-click unsubscribe link.</span>
                </label>
                <label className="block max-w-xs text-xs font-bold uppercase text-slate-600 dark:text-slate-400">Most emails a day
                  <input type="number" min={1} max={300} className={`${FIELD} mt-1`} value={settings.dailyCap} onChange={event => setSettings({ ...settings, dailyCap: Number(event.target.value) })} />
                </label>
                <p className="text-xs">Keep the daily number modest: a sudden burst from the school mailbox can get it marked as spam, which would also stop school emails such as fee reminders and payslips.</p>
                <fieldset>
                  <legend className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400">Gather but do not email automatically</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(countries).map(([code, name]) => (
                      <label key={code} className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-2 py-0.5 text-xs dark:border-white/15">
                        <input type="checkbox" checked={settings.noAutoSend.includes(code)} onChange={event => setSettings({ ...settings, noAutoSend: event.target.checked ? [...settings.noAutoSend, code] : settings.noAutoSend.filter(item => item !== code) })} /> {name}
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-xs">South Africa starts here: its law (POPIA) needs a school's agreement before marketing emails. Check each country's rules before switching it on.</p>
                </fieldset>
                {Object.entries(STEP_LABELS).map(([key, label]) => (
                  <details key={key} className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
                    <summary className="cursor-pointer font-bold text-[#0b1f3a] dark:text-white">{label}: {settings.templates[key].subject}</summary>
                    <label className="mt-2 block text-xs font-bold uppercase text-slate-600 dark:text-slate-400">Subject
                      <input className={`${FIELD} mt-1`} value={settings.templates[key].subject} onChange={event => setSettings({ ...settings, templates: { ...settings.templates, [key]: { ...settings.templates[key], subject: event.target.value } } })} />
                    </label>
                    <label className="mt-2 block text-xs font-bold uppercase text-slate-600 dark:text-slate-400">Message ({'{schoolName}'} is filled in)
                      <textarea rows={8} className={`${FIELD} mt-1 font-normal normal-case`} value={settings.templates[key].body} onChange={event => setSettings({ ...settings, templates: { ...settings.templates, [key]: { ...settings.templates[key], body: event.target.value } } })} />
                    </label>
                  </details>
                ))}
                <button type="button" className={PRIMARY} disabled={busy === 'settings'} onClick={() => run('settings', async () => { const result = await saveOutreachSettings(settings); setSettings(result.settings); }, 'Saved.')}>{busy === 'settings' ? 'Saving…' : 'Save sending settings'}</button>
              </div>
            </Panel>
          ) : null}

          <Panel title="Where Ndovera looks (sources)" actions={<button type="button" className={SECONDARY} disabled={busy === 'gather'} onClick={() => run('gather', gatherOutreachNow, result => `Visited ${result.crawled} source${result.crawled === 1 ? '' : 's'}; ${result.added} new address${result.added === 1 ? '' : 'es'}.`)}>{busy === 'gather' ? 'Visiting…' : 'Visit new sources now'}</button>}>
            <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
              <p>Every Sunday night (Lagos) Ndovera visits each page below, plus its contact page, and keeps the email addresses printed there — each address once, ever. Pages that ask robots not to visit are skipped. {data.searchReady ? 'Ndovera also searches for schools in two more countries each week.' : 'Searching for new school pages each week needs a search key on the server (BRAVE_SEARCH_API_KEY); until then, add school websites or school directories here.'}</p>
              <form className="grid gap-2 sm:grid-cols-[12rem_1fr_auto]" onSubmit={event => { event.preventDefault(); run('sources', () => addOutreachSources(sourceForm), result => { setSourceForm({ ...sourceForm, urls: '' }); return `Added ${result.added} source${result.added === 1 ? '' : 's'}.`; }); }}>
                <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400">Country
                  <select className={`${FIELD} mt-1`} value={sourceForm.country} onChange={event => setSourceForm({ ...sourceForm, country: event.target.value })}>
                    {Object.entries(countries).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                  </select>
                </label>
                <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400">School websites or directory pages (one per line)
                  <textarea rows={3} className={`${FIELD} mt-1 font-normal normal-case`} value={sourceForm.urls} onChange={event => setSourceForm({ ...sourceForm, urls: event.target.value })} placeholder="https://www.kingsacademy.edu.ng" />
                </label>
                <button type="submit" className={`${PRIMARY} self-end`} disabled={busy === 'sources' || !sourceForm.urls.trim()}>Add</button>
              </form>
              <div className="max-h-72 overflow-auto rounded-lg border border-slate-200 dark:border-white/10">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-slate-50 dark:bg-white/5"><tr><th className={TH}>Page</th><th className={TH}>Country</th><th className={TH}>Last visit</th><th className={TH}>Found</th><th className={TH}><span className="sr-only">Remove</span></th></tr></thead>
                  <tbody>
                    {data.sources.map(source => (
                      <tr key={source.id} className="border-t border-slate-100 dark:border-white/5">
                        <td className={`${TD} max-w-xs truncate`}>{source.url}{source.last_error ? <span className="block text-xs text-rose-700 dark:text-rose-300">{source.last_error}</span> : null}</td>
                        <td className={TD}>{countries[source.country] || source.country}</td>
                        <td className={TD}>{source.last_crawled_at ? shortDate(source.last_crawled_at) : 'Not yet'}</td>
                        <td className={TD}>{source.last_found || 0}</td>
                        <td className={TD}><button type="button" className="text-xs font-bold text-rose-700 underline dark:text-rose-300" onClick={() => run(`rm-${source.id}`, () => removeOutreachSource(source.id), 'Source removed.')}>Remove</button></td>
                      </tr>
                    ))}
                    {!data.sources.length ? <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-600 dark:text-slate-300">No sources yet. Add school websites or directory pages above.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </div>
          </Panel>

          <Panel title="Schools" actions={<button type="button" className={SECONDARY} onClick={exportCsv}>Download CSV</button>}>
            <div className="mb-3 grid gap-2 sm:grid-cols-3">
              <input aria-label="Search schools" className={FIELD} placeholder="Search email or school" value={filters.q} onChange={event => setFilters({ ...filters, q: event.target.value })} />
              <select aria-label="Filter by status" className={FIELD} value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })}>
                <option value="">Every status</option>
                {Object.entries(STATUS).map(([key, [, label]]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <select aria-label="Filter by country" className={FIELD} value={filters.country} onChange={event => setFilters({ ...filters, country: event.target.value })}>
                <option value="">Every country</option>
                {(data.byCountry || []).map(row => <option key={row.country} value={row.country}>{countries[row.country] || row.country} ({row.n})</option>)}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm text-slate-800 dark:text-slate-100">
                <thead className="bg-slate-50 dark:bg-white/5"><tr><th className={TH}>School</th><th className={TH}>Country</th><th className={TH}>Status</th><th className={TH}>Emails sent</th><th className={TH}>Next email</th><th className={TH}>Mark as</th></tr></thead>
                <tbody>
                  {data.prospects.map(row => {
                    const [tone, label] = STATUS[row.status] || STATUS.new;
                    return (
                      <tr key={row.id} className="border-t border-slate-100 dark:border-white/5">
                        <td className={TD}><b>{row.school_name || row.domain}</b><span className="block text-xs text-slate-600 dark:text-slate-300">{row.email}</span></td>
                        <td className={TD}>{countries[row.country] || row.country}</td>
                        <td className={TD}><Pill tone={tone}>{label}</Pill></td>
                        <td className={TD}>{row.step}</td>
                        <td className={TD}>{row.next_due_at ? shortDate(row.next_due_at) : '—'}</td>
                        <td className={TD}>
                          {row.status === 'opted_out' ? <span className="text-xs text-slate-600 dark:text-slate-300">Never emailed again</span> : (
                            <select aria-label={`Mark ${row.email}`} className={`${FIELD} py-1 text-xs`} value="" onChange={event => event.target.value && run(`st-${row.id}`, () => setProspectStatus(row.id, event.target.value), 'Updated.')}>
                              <option value="">Choose…</option>
                              <option value="replied">Replied</option>
                              <option value="demo">Demo booked</option>
                              <option value="converted">Joined Ndovera</option>
                              <option value="paused">Pause</option>
                              <option value="opted_out">Asked to stop</option>
                              {['replied', 'demo', 'paused', 'bounced'].includes(row.status) ? <option value="resume">Resume emails</option> : null}
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!data.prospects.length ? <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-600 dark:text-slate-300">No schools yet. They appear after the first Sunday visit, or press "Visit new sources now".</td></tr> : null}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      ) : null}
    </AmiPage>
  );
}
