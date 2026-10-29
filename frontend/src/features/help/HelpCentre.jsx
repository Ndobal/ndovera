import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { findHelpArticles, HELP_ARTICLE_VERSION } from './helpArticles';

export default function HelpCentre({ role = 'student' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const [category, setCategory] = useState('All');
  const [feedback, setFeedback] = useState('');
  const origin = location.state?.from;
  const safeOrigin = typeof origin === 'string' && origin.startsWith('/roles/') && !origin.startsWith('//') && !origin.includes('\\') && !origin.includes('?')
    ? origin : `/roles/${role}`;
  const articles = useMemo(() => findHelpArticles(query, role, safeOrigin), [query, role, safeOrigin]);
  const categories = ['All', ...new Set(articles.map(article => article.category))];
  const visible = articles.filter(article => category === 'All' || article.category === category);
  const active = visible.find(article => article.id === selected) || visible[0];

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 pb-12 text-slate-900 dark:text-slate-100 sm:p-6">
      <div className="rounded-3xl border border-[#c9a96e]/40 bg-[#fff8ee] p-6 text-[#191970] dark:bg-slate-900 dark:text-white">
        <button type="button" onClick={() => navigate(safeOrigin)} className="rounded-lg border border-[#191970]/30 px-3 py-2 text-sm font-semibold dark:border-white/30">← Return to your dashboard</button>
        <h1 className="mt-5 text-3xl font-bold">Ndovera Help Centre</h1>
        <p className="mt-2 text-sm">Search built-in guidance for your current role. Help articles do not access private school records.</p>
        <label htmlFor="help-search" className="mt-5 block text-sm font-semibold">What would you like help with?</label>
        <input id="help-search" type="search" value={query} onChange={event => { setQuery(event.target.value); setSelected(''); setCategory('All'); }} placeholder="Try: upload photos, fees, results, messages…" className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 focus-visible:outline focus-visible:outline-4 focus-visible:outline-cyan-500" />
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Help categories">
        {categories.map(item => <button key={item} type="button" onClick={() => { setCategory(item); setSelected(''); }} aria-pressed={category === item} className={`rounded-full border px-4 py-2 text-sm font-semibold ${category === item ? 'bg-[#191970] text-white' : 'border-slate-300 bg-white text-slate-800 dark:bg-slate-800 dark:text-white'}`}>{item}</button>)}
      </div>
      {active ? (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <nav aria-label="Help articles" className="space-y-2">
            {visible.map(article => <button type="button" key={article.id} onClick={() => { setSelected(article.id); setFeedback(''); }} aria-current={active.id === article.id ? 'true' : undefined} className={`w-full rounded-xl border p-3 text-left text-sm font-semibold ${active.id === article.id ? 'border-[#191970] bg-[#eaf8fa] text-[#191970]' : 'border-slate-300 bg-white text-slate-800 dark:bg-slate-800 dark:text-white'}`}>{article.title}</button>)}
          </nav>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#800020] dark:text-rose-300">{active.category}</p>
            <h2 className="mt-2 text-xl font-bold">{active.title}</h2>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6">{active.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
            {active.route && active.roles.includes(role) ? <button type="button" onClick={() => navigate(active.route)} className="mt-5 rounded-xl bg-[#191970] px-4 py-2 font-semibold text-white">Go to dashboard</button> : null}
            <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700">
              <p className="text-sm font-semibold">Was this article helpful?</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setFeedback('This article was helpful. Your selection has not been submitted to support.')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Yes</button>
                <button type="button" onClick={() => setFeedback('This feedback has not been sent to support. Please contact your school administrator for additional assistance. Do not include student details or passwords.')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Not yet</button>
              </div>
              {feedback && <p role="status" className="mt-2 text-sm">{feedback}</p>}
            </div>
          </article>
        </div>
      ) : <p role="status" className="rounded-xl border border-slate-300 p-5">No help article matches your search. Try different words or contact your school administrator.</p>}
      <p className="text-xs text-slate-500 dark:text-slate-400">Help catalogue version {HELP_ARTICLE_VERSION}. Guidance is role-specific; actions remain subject to your account permissions.</p>
    </main>
  );
}
