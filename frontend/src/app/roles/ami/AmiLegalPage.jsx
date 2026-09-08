import React, { useEffect, useMemo, useState } from 'react';
import { getAmiWebsiteSections, saveAmiWebsiteSection } from '../../../features/public/services/publicSiteApi';
import {
  LEGAL_DOCUMENTS,
  LEGAL_DOCUMENTS_BY_KEY,
  parseInlineEmphasis,
  parseLegalBody,
  resolveLegalDocument,
} from '../../../features/public/legalDocuments';

// Ami owns the published wording of every legal and compliance page. Saving writes to the
// same `platform_site_sections` store the rest of the public website uses, so the public
// page picks the change up on its next load with no deploy.

const inputClass = 'mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#fff8ee] px-3 py-2 text-sm text-[#191970] outline-none focus:ring-2 focus:ring-[#1a5c38] dark:border-white/10 dark:bg-slate-800 dark:text-slate-100';
const labelClass = 'text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-slate-400';

function BodyPreview({ body }) {
  const blocks = useMemo(() => parseLegalBody(body), [body]);

  return (
    <div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-2xl border border-[#c9a96e]/35 bg-white p-4 dark:border-white/10 dark:bg-slate-900/60">
      {blocks.length === 0 ? (
        <p className="text-sm italic text-[#800020]/70 dark:text-slate-400">Nothing to preview yet.</p>
      ) : null}

      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return <h3 key={index} className="pt-2 text-lg font-black text-[#191970] dark:text-slate-100">{block.text}</h3>;
        }
        if (block.type === 'subheading') {
          return <h4 key={index} className="text-xs font-bold uppercase tracking-[0.14em] text-[#800020] dark:text-fuchsia-300">{block.text}</h4>;
        }
        if (block.type === 'list') {
          return (
            <ul key={index} className="space-y-1.5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="flex gap-2 text-sm leading-6 text-[#31416f] dark:text-slate-300">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#800020]" />
                  <span className="min-w-0 break-words">{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} className="break-words text-sm leading-6 text-[#31416f] dark:text-slate-300">
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(text) {
  return parseInlineEmphasis(text).map((part, index) => (
    part.bold
      ? <strong key={index} className="font-bold text-[#191970] dark:text-slate-100">{part.text}</strong>
      : <React.Fragment key={index}>{part.text}</React.Fragment>
  ));
}

function DocumentEditor({ docKey, savedSection, onSaved }) {
  const definition = LEGAL_DOCUMENTS_BY_KEY[docKey];
  const [form, setForm] = useState({ title: '', summary: '', effective: '', body: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const resolved = resolveLegalDocument(docKey, savedSection);
    setForm({
      title: resolved.title,
      summary: resolved.summary,
      effective: resolved.effective,
      body: resolved.body,
    });
    setMessage('');
  }, [docKey, savedSection]);

  const isOverridden = Boolean(String(savedSection?.content || '').trim());

  function restoreDefault() {
    setForm({
      title: definition.title,
      summary: definition.summary,
      effective: definition.effective,
      body: definition.body,
    });
    setMessage('NDOVERA default loaded into the form. Click "Publish" to make it live.');
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      await saveAmiWebsiteSection({
        sectionKey: definition.sectionKey,
        title: form.title,
        content: form.body,
        metadata: { summary: form.summary, effective: form.effective },
      });
      setMessage('Published. The public page shows this wording now.');
      onSaved?.();
    } catch (error) {
      setMessage(error.message || 'Could not publish this document.');
    } finally {
      setSaving(false);
    }
  }

  const isGood = message.startsWith('Published') || message.startsWith('NDOVERA default');

  return (
    <section className="rounded-3xl border border-[#c9a96e]/45 bg-[#b5e3f4] p-5 shadow-[0_18px_40px_rgba(128,0,0,0.08)] dark:border-white/10 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-[#800000] dark:text-slate-100">{definition.label}</p>
          <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">
            Published at{' '}
            <a href={definition.path} target="_blank" rel="noreferrer" className="font-bold underline">
              ndovera.com{definition.path}
            </a>
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${isOverridden ? 'bg-[#1a5c38] text-white' : 'bg-[#c9a96e] text-[#191970]'}`}>
          {isOverridden ? 'Edited by Ami' : 'NDOVERA default'}
        </span>
      </div>

      <form onSubmit={handleSave} className="mt-5 space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={labelClass}>Page Title</label>
            <input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Effective Date</label>
            <input value={form.effective} onChange={event => setForm(current => ({ ...current, effective: event.target.value }))} className={inputClass} placeholder="9 August 2026" />
          </div>
        </div>

        <div>
          <label className={labelClass}>Summary (shown under the title)</label>
          <textarea rows={3} value={form.summary} onChange={event => setForm(current => ({ ...current, summary: event.target.value }))} className={`${inputClass} resize-none`} />
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className={labelClass}>Document Body</label>
            <button type="button" onClick={() => setShowPreview(open => !open)} className="text-xs font-bold uppercase tracking-wide text-[#1a5c38] underline dark:text-emerald-300">
              {showPreview ? 'Hide preview' : 'Show preview'}
            </button>
          </div>
          <p className="mt-1 text-xs leading-5 text-[#191970]/80 dark:text-slate-400">
            Start a line with <code>## </code> for a section heading, <code>### </code> for a sub-heading,
            and <code>- </code> for a bullet. Wrap words in <code>**</code> to make them bold. Leave a blank
            line between blocks. Nothing is treated as HTML.
          </p>
          <textarea
            rows={20}
            value={form.body}
            onChange={event => setForm(current => ({ ...current, body: event.target.value }))}
            className={`${inputClass} font-mono text-xs leading-5`}
          />
        </div>

        {showPreview ? <BodyPreview body={form.body} /> : null}

        {message ? <p className={`text-sm ${isGood ? 'text-[#1a5c38] dark:text-emerald-300' : 'text-red-600'}`}>{message}</p> : null}

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={saving} className="rounded-2xl bg-[#800020] px-5 py-2.5 text-sm font-bold text-[#b5e3f4] transition hover:bg-[#670019] disabled:opacity-60">
            {saving ? 'Publishing…' : 'Publish'}
          </button>
          <button type="button" onClick={restoreDefault} className="rounded-2xl border border-[#800020]/30 px-5 py-2.5 text-sm font-bold text-[#800020] transition hover:bg-[#800020]/5 dark:border-white/20 dark:text-slate-200">
            Load NDOVERA default
          </button>
        </div>
      </form>
    </section>
  );
}

export default function AmiLegalPage() {
  const [sections, setSections] = useState([]);
  const [activeKey, setActiveKey] = useState(LEGAL_DOCUMENTS[0].key);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadSections() {
    setLoading(true);
    try {
      const data = await getAmiWebsiteSections();
      setSections(data?.sections || []);
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Could not load the published legal documents.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSections(); }, []);

  const sectionsByKey = useMemo(
    () => Object.fromEntries((sections || []).map(section => [section.section_key, section])),
    [sections],
  );

  const activeDefinition = LEGAL_DOCUMENTS_BY_KEY[activeKey] || LEGAL_DOCUMENTS[0];

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-[#c9a96e]/45 bg-[#fff8ee] p-5 dark:border-white/10 dark:bg-slate-900/40">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#800020] dark:text-slate-400">Legal &amp; Policies</p>
        <h2 className="mt-2 text-2xl font-black text-[#800000] dark:text-slate-100">The public documents NDOVERA is held to</h2>
        <p className="mt-2 max-w-4xl text-sm leading-7 text-[#191970] dark:text-slate-300">
          These pages are what Google reviews during OAuth verification, what school procurement teams
          read before signing, and what a regulator would ask for. Each one ships with an NDOVERA default
          written against how the platform actually works. Edit the wording here and it goes live
          immediately — no deploy. Keep the effective date current whenever you change something material.
        </p>
      </section>

      {loading ? <p className="text-sm text-[#800020] dark:text-slate-400">Loading legal documents…</p> : null}
      {error ? <p className="rounded-2xl border border-red-300/30 bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-200">{error}</p> : null}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {LEGAL_DOCUMENTS.map(doc => (
          <button
            key={doc.key}
            type="button"
            onClick={() => setActiveKey(doc.key)}
            className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold transition ${activeKey === doc.key ? 'bg-[#1a5c38] text-[#f5deb3] dark:bg-cyan-300 dark:text-black' : 'bg-white text-[#800020] hover:bg-[#f5deb3] dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'}`}
          >
            {doc.label}
          </button>
        ))}
      </div>

      <DocumentEditor
        key={activeDefinition.key}
        docKey={activeDefinition.key}
        savedSection={sectionsByKey[activeDefinition.sectionKey]}
        onSaved={loadSections}
      />
    </div>
  );
}
