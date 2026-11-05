import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTenantPricing } from '../../tenants/services/tenantApi';
import { localMoney } from '../../../shared/pricing/localPrice';
import { HOME_FAQS, ROLE_BENEFITS, START_STEPS, STRENGTHS } from './marketingCopy';

// The home page below the hero: who it is for, how to start, what it costs, and the questions owners ask.

const CARD = 'rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900';
const HEADING = 'text-2xl font-black text-[#191970] sm:text-3xl dark:text-white';
const TITLE = 'text-lg font-black text-[#191970] dark:text-white';
const BODY = 'text-sm leading-7 text-[#31416f] dark:text-slate-200';
const PRIMARY = 'inline-block rounded-full bg-[#191970] px-7 py-3 text-center text-sm font-black text-white dark:bg-white dark:text-[#191970]';
const SECONDARY = 'inline-block rounded-full border border-[#191970]/40 bg-white px-7 py-3 text-center text-sm font-black text-[#191970] dark:border-white/40 dark:bg-slate-900 dark:text-white';

export function RoleBenefits() {
  return (
    <section aria-label="Who Ndovera is for" className="space-y-5">
      <h2 className={HEADING}>One platform. Everyone in your school.</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ROLE_BENEFITS.map(item => (
          <article key={item.title} className={CARD}>
            <h3 className={TITLE}>{item.title}</h3>
            <ul className="mt-3 space-y-2">
              {item.points.map(point => (
                <li key={point} className={`flex gap-2 ${BODY}`}><span aria-hidden="true" className="font-black text-[#1a5c38] dark:text-emerald-300">✓</span><span>{point}</span></li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

export function StartSteps() {
  return (
    <section aria-label="How to start" className="space-y-5">
      <h2 className={HEADING}>Start in three steps.</h2>
      <ol className="grid gap-4 md:grid-cols-3">
        {START_STEPS.map((step, index) => (
          <li key={step.title} className={CARD}>
            <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-full bg-[#191970] text-lg font-black text-white dark:bg-white dark:text-[#191970]">{index + 1}</span>
            <h3 className={`mt-3 ${TITLE}`}>{step.title}</h3>
            <p className={`mt-1 ${BODY}`}>{step.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Today's real price, in the visitor's own currency where one is set. Without it, the section still points to the pricing page. */
export function PriceTeaser() {
  const [price, setPrice] = useState(null);
  useEffect(() => {
    let live = true;
    getTenantPricing({}).then(data => {
      const plan = (data?.plans || []).find(item => item.key === 'growth');
      if (live && plan) setPrice({ setupFee: plan.setupFee, perStudent: plan.studentFeePerTerm, rule: data?.localPricing || null });
    }).catch(() => null);
    return () => { live = false; };
  }, []);
  const money = amount => (price?.rule?.foreign ? localMoney(amount, price.rule) : `₦${Number(amount).toLocaleString()}`);
  return (
    <section aria-label="Pricing" className={`${CARD} flex flex-wrap items-center justify-between gap-6`}>
      <div className="max-w-2xl">
        <h2 className={HEADING}>Simple pricing, with no surprises.</h2>
        {price ? (
          <p className={`mt-2 ${BODY}`}><strong>{money(price.setupFee)}</strong> once to get started, then <strong>{money(price.perStudent)}</strong> per student each term, starting the term after launch. Staff, teachers and parents are free.</p>
        ) : (
          <p className={`mt-2 ${BODY}`}>One onboarding fee to get started, then a small amount per student each term. Staff, teachers and parents are free.</p>
        )}
      </div>
      <Link to="/pricing" className={PRIMARY}>Work out your cost</Link>
    </section>
  );
}

export function Strengths() {
  return (
    <section aria-label="Why schools choose Ndovera" className="space-y-5">
      <h2 className={HEADING}>Made for schools like yours.</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {STRENGTHS.map(item => (
          <article key={item.title} className={CARD}>
            <h3 className={TITLE}>{item.title}</h3>
            <p className={`mt-1 ${BODY}`}>{item.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function HomeQuestions() {
  return (
    <section aria-label="Common questions" className="space-y-5">
      <h2 className={HEADING}>Questions school owners ask.</h2>
      <div className="space-y-3">
        {HOME_FAQS.map(item => (
          <details key={item.question} className={CARD}>
            <summary className={`cursor-pointer ${TITLE}`}>{item.question}</summary>
            <p className={`mt-2 ${BODY}`}>{item.answer}</p>
          </details>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <Link to="/features" className={SECONDARY}>See every feature</Link>
        <Link to="/contact" className={SECONDARY}>Talk to us</Link>
      </div>
    </section>
  );
}
