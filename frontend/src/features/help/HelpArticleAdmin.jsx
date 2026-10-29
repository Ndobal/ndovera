import React, { useCallback, useEffect, useState } from 'react';
import { getApiUrl } from '../../config/apiBase';
import { getStoredAuth, buildSelectedRoleHeader } from '../auth/services/authApi';

const ROLES = ['student', 'parent', 'teacher', 'hos', 'accountant', 'owner'];
const EMPTY = { title: '', category: 'General', keywords: '', roles: ['student', 'parent', 'teacher', 'hos', 'accountant', 'owner'], steps: [''] };

async function helpAdminRequest(path, options = {}) {
  const auth = getStoredAuth();
  if (!auth?.token) throw new Error('Please sign in again.');
  const response = await fetch(getApiUrl(path), {
    credentials: 'include',
    ...options,
    headers: {
      Authorization: `Bearer ${auth.token}`,
      ...buildSelectedRoleHeader(),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) throw new Error(data?.error || data?.message || 'Help article service is unavailable.');
  return data;
}

export default function HelpArticleAdmin({ role }) {
  const [articles, setArticles] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [articleId, setArticleId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const canEdit = role === 'owner' || role === 'hos';

  const reload = useCallback(async () => {
    if (!canEdit) return;
    try {
      const result = await helpAdminRequest('/api/help/articles/editor');
      setArticles(Array.isArray(result.articles) ? result.articles : []);
      setError('');
    } catch (err) { setError(err.message); }
  }, [canEdit]);

  useEffect(() => { reload(); }, [reload]);

  const setField = (field, value) => setForm(previous => ({ ...previous, [field]: value }));
  const changeStep = (index, value) => setField('steps', form.steps.map((step, i) => i === index ? value : step));
  const saveDraft = async event => {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await helpAdminRequest('/api/help/articles/editor', {
        method: 'POST',
        body: JSON.stringify({ ...form, steps: form.steps.map(step => step.trim()).filter(Boolean), ...(articleId.trim() ? { articleId: articleId.trim() } : {}) }),
      });
      setMessage(`Draft revision ${result.revision} saved. Submit it for review before publishing.`);
      setArticleId(result.articleId || '');
      await reload();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const transition = async (revision, state) => {
    setBusy(true); setError(''); setMessage('');
    try {
      await helpAdminRequest(`/api/help/articles/editor/${encodeURIComponent(revision.id)}/state`, {
        method: 'PATCH', body: JSON.stringify({ state }),
      });
      setMessage(`Article moved to ${state.replace('_', ' ')}.`);
      await reload();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  if (!canEdit) return <p role="alert">Only authorised school management can edit help articles.</p>;
  return <main className="mx-auto max-w-6xl space-y-6 p-4 text-slate-900 dark:text-white">
    <header><h1 className="text-2xl font-bold">Help Centre article management</h1><p className="mt-2 text-sm">Create a new draft revision, request an independent review, and publish only approved articles. All changes require the authenticated article API.</p></header>
    {error && <p role="alert" className="rounded-xl border border-rose-400 p-3 text-sm">{error}</p>}
    {message && <p role="status" className="rounded-xl border border-slate-300 p-3 text-sm">{message}</p>}
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={saveDraft} className="space-y-4 rounded-2xl border border-slate-300 p-5">
        <h2 className="text-lg font-bold">New article revision</h2>
        <label className="block text-sm font-semibold">Existing article ID (optional)
          <input value={articleId} onChange={event => setArticleId(event.target.value)} maxLength={100} pattern="[a-zA-Z0-9-]*" className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900" />
        </label>
        {['title', 'category', 'keywords'].map(field => <label key={field} className="block text-sm font-semibold">{field[0].toUpperCase() + field.slice(1)}
          <input required={field !== 'keywords'} maxLength={field === 'title' ? 160 : field === 'category' ? 80 : 500} value={form[field]} onChange={event => setField(field, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900" />
        </label>)}
        <fieldset><legend className="text-sm font-semibold">Who can read this article?</legend><div className="mt-2 flex flex-wrap gap-3">{ROLES.map(item => <label key={item} className="text-sm"><input type="checkbox" checked={form.roles.includes(item)} onChange={event => setField('roles', event.target.checked ? [...form.roles, item] : form.roles.filter(role => role !== item))} /> {item}</label>)}</div></fieldset>
        <fieldset className="space-y-2"><legend className="text-sm font-semibold">Instructions</legend>
          {form.steps.map((step, index) => <div key={index} className="flex gap-2"><textarea aria-label={`Step ${index + 1}`} value={step} maxLength={1500} rows={2} onChange={event => changeStep(index, event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900" /><button type="button" disabled={form.steps.length === 1} onClick={() => setField('steps', form.steps.filter((_, i) => i !== index))} className="rounded-lg border px-3">Remove</button></div>)}
          <button type="button" disabled={form.steps.length >= 20} onClick={() => setField('steps', [...form.steps, ''])} className="rounded-lg border px-3 py-2 text-sm">Add step</button>
        </fieldset>
        <button type="submit" disabled={busy || !form.roles.length} className="rounded-lg bg-[#191970] px-4 py-2 font-semibold text-white disabled:opacity-50">Save draft</button>
      </form>
      <section className="space-y-3"><h2 className="text-lg font-bold">Editorial queue</h2>
        <button type="button" onClick={reload} className="rounded-lg border px-3 py-2 text-sm">Refresh queue</button>
        {!articles.length && <p className="text-sm">No article revisions available, or the article API is not connected.</p>}
        {articles.map(item => <article key={item.id} className="rounded-xl border border-slate-300 p-4">
          <h3 className="font-bold">{item.title}</h3><p className="mt-1 text-sm">Revision {item.revision} · {item.state} · {item.category}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {({ draft: ['in_review'], in_review: ['approved', 'draft'], approved: ['published', 'draft'], published: ['archived'] })[item.state]?.map(next => <button type="button" key={next} disabled={busy || (next === 'approved' && item.created_by === getStoredAuth()?.user?.id)} onClick={() => transition(item, next)} className="rounded-lg border border-[#191970] px-3 py-2 text-sm disabled:opacity-50">{next.replace('_', ' ')}</button>)}
            <button type="button" onClick={() => { setArticleId(item.article_id); setMessage('Enter updated content and save to create a new revision. Published revisions remain unchanged.'); }} className="rounded-lg border px-3 py-2 text-sm">Create revision</button>
          </div>
        </article>)}
      </section>
    </div>
  </main>;
}
