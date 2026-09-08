import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicShell } from './PublicSitePage';
import { getPublicPlatformSite } from '../services/publicSiteApi';
import { LEGAL_DOCUMENTS, parseInlineEmphasis, parseLegalBody, resolveLegalDocument } from '../legalDocuments';

// Legal pages are read by regulators, school lawyers and Google reviewers, so they keep the
// site chrome (so the pages are obviously part of ndovera.com) but drop the marketing hero
// and closing call to action.

function InlineText({ text }) {
  const parts = useMemo(() => parseInlineEmphasis(text), [text]);

  return (
    <>
      {parts.map((part, index) => (
        part.bold
          ? <strong key={index} className="font-bold text-[#191970]">{part.text}</strong>
          : <React.Fragment key={index}>{part.text}</React.Fragment>
      ))}
    </>
  );
}

function LegalBody({ body }) {
  const blocks = useMemo(() => parseLegalBody(body), [body]);

  return (
    <div className="space-y-5">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <h2
              key={index}
              className="scroll-mt-24 border-t border-[#c9a96e]/40 pt-6 text-2xl font-black tracking-tight text-[#191970] first:border-t-0 first:pt-0"
            >
              {block.text}
            </h2>
          );
        }

        if (block.type === 'subheading') {
          return (
            <h3 key={index} className="text-base font-bold uppercase tracking-[0.14em] text-[#800020]">
              {block.text}
            </h3>
          );
        }

        if (block.type === 'list') {
          return (
            <ul key={index} className="space-y-2 pl-1">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="flex gap-3 text-sm leading-7 text-[#31416f] sm:text-base">
                  <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#800020]" />
                  <span className="min-w-0 break-words"><InlineText text={item} /></span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={index} className="break-words text-sm leading-7 text-[#31416f] sm:text-base">
            <InlineText text={block.text} />
          </p>
        );
      })}
    </div>
  );
}

export default function PublicLegalPage({ docKey = 'privacy' }) {
  const [sections, setSections] = useState([]);

  useEffect(() => {
    let cancelled = false;

    // A failed fetch is not worth showing the reader: the built-in wording below is the
    // published text, and the fetch only ever layers an Ami edit on top of it.
    getPublicPlatformSite()
      .then(data => { if (!cancelled) setSections(data?.sections || []); })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  const sectionsByKey = useMemo(
    () => Object.fromEntries((sections || []).map(section => [section.section_key, section])),
    [sections],
  );

  const fallback = LEGAL_DOCUMENTS.find(item => item.key === docKey) || LEGAL_DOCUMENTS[0];
  const doc = resolveLegalDocument(docKey, sectionsByKey[fallback.sectionKey]);

  useEffect(() => {
    document.title = `NDOVERA | ${doc.title}`;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [doc.title]);

  const shellSection = {
    eyebrow: doc.eyebrow,
    title: doc.title,
    description: doc.summary,
    metadata: { stats: [], cards: [], mediaUrls: [] },
  };

  return (
    <PublicShell section={shellSection} hideHero hideCta>
      <article className="space-y-8">
        <header className="rounded-[2rem] border border-[#c9a96e]/45 bg-[#fff8ef] p-6 shadow-[0_18px_40px_rgba(25,25,112,0.08)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#800020]">{doc.eyebrow}</p>
          <h1 className="mt-3 font-serif text-3xl font-black tracking-tight text-[#191970] sm:text-4xl">{doc.title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[#31416f] sm:text-base">{doc.summary}</p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#c9a96e]">
            Effective {doc.effective}
          </p>
        </header>

        <nav aria-label="Legal pages" className="flex flex-wrap gap-2">
          {LEGAL_DOCUMENTS.map(item => (
            <Link
              key={item.key}
              to={item.path}
              className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
                item.key === docKey
                  ? 'border-[#191970] bg-[#191970] text-white'
                  : 'border-[#c9a96e]/60 bg-white text-[#191970] hover:border-[#2447d8] hover:text-[#2447d8]'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <section className="rounded-[2rem] border border-[#c9a96e]/45 bg-white p-6 shadow-[0_18px_40px_rgba(25,25,112,0.06)] sm:p-8 lg:p-10">
          <LegalBody body={doc.body} />
        </section>

        <section className="rounded-[2rem] border border-[#c9a96e]/45 bg-[#b5e3f4] p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#800020]">Still Have A Question?</p>
          <h2 className="mt-2 font-serif text-2xl font-black text-[#191970]">Ask a person, not a form.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#31416f]">
            Email <a className="font-bold underline" href="mailto:support@ndovera.com">support@ndovera.com</a> and a
            member of the NDOVERA team will answer. School account holders can also use the messaging area inside the app.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/contact" className="rounded-full bg-[#191970] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2447d8]">
              Contact NDOVERA
            </Link>
            <Link to="/about" className="rounded-full border border-[#191970]/30 px-5 py-3 text-sm font-semibold text-[#191970] transition hover:border-[#2447d8] hover:text-[#2447d8]">
              About NDOVERA
            </Link>
          </div>
        </section>
      </article>
    </PublicShell>
  );
}
