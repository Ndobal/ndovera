import React, { useEffect, useMemo, useState } from 'react';
import StudentSectionShell from './StudentSectionShell';
import { askAiTutor, getAiAccess, initiateAiTopUp } from '../../../features/ai/services/aiTutorApi';

const modes = ['Explain Mode', 'Practice Mode', 'Weak Area Mode', 'Exam Review Mode'];
const currencyFormatter = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

function StudentProfessorAura() {
  const [selectedMode, setSelectedMode] = useState(modes[0]);
  const [input, setInput] = useState('');
  const [reply, setReply] = useState(null);
  const [accessPayload, setAccessPayload] = useState(null);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [asking, setAsking] = useState(false);
  const [purchaseQuantity, setPurchaseQuantity] = useState(10);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [error, setError] = useState('');

  const access = accessPayload?.access || null;

  useEffect(() => {
    let active = true;

    async function loadAccess() {
      setLoadingAccess(true);
      try {
        const data = await getAiAccess();
        if (!active) return;
        setAccessPayload(data);
        setError('');
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message || 'Could not load AI access.');
      } finally {
        if (active) {
          setLoadingAccess(false);
        }
      }
    }

    loadAccess();
    return () => {
      active = false;
    };
  }, []);

  const summaryCards = useMemo(() => {
    if (!access) return [];

    return [
      {
        label: 'Free Requests Left Today',
        value: `${access.usage.remainingFreeRequests}/${access.usage.dailyFreeRequests}`,
        helper: 'Each student gets 50 free AI requests per day before credits are used.',
      },
      {
        label: 'Billing Mode',
        value: access.policy.billingModel === 'school' ? 'School Sponsored' : 'Individual Billing',
        helper: access.policy.billingModel === 'school'
          ? 'The school wallet covers paid AI requests after the free daily allowance.'
          : 'Your personal wallet covers paid AI requests after the free daily allowance.',
      },
      {
        label: 'Available Credits',
        value: String(access.wallet.availableCredits || 0),
        helper: access.policy.billingModel === 'school'
          ? `${access.wallet.schoolCredits || 0} school credits available.`
          : `${access.wallet.userCredits || 0} personal credits available.`,
      },
      {
        label: 'Credit Price',
        value: access.policy.pricePerCreditNaira > 0 ? currencyFormatter.format(access.policy.pricePerCreditNaira) : 'Not Set',
        helper: 'Credits are charged only after the free daily requests are exhausted.',
      },
    ];
  }, [access]);

  async function ask() {
    if (!input.trim()) return;

    setAsking(true);
    setError('');

    try {
      const data = await askAiTutor({ prompt: input.trim(), mode: selectedMode });
      setReply({ type: 'answer', text: data.answer, source: data.source, chargedCredits: data.chargedCredits || 0 });
      setAccessPayload(current => ({ ...(current || {}), access: data.access, management: current?.management || {} }));
    } catch (askError) {
      setReply(null);
      setError(askError.message || 'Could not process the AI request.');
      if (askError.data?.access) {
        setAccessPayload(current => ({ ...(current || {}), access: askError.data.access, management: current?.management || {} }));
      }
    } finally {
      setAsking(false);
    }
  }

  async function buyCredits() {
    if (!access || access.policy.billingModel !== 'individual') return;

    setPurchaseBusy(true);
    setError('');

    try {
      const data = await initiateAiTopUp({ quantity: purchaseQuantity, target: 'individual' });
      if (data.paymentLink) {
        window.location.assign(data.paymentLink);
        return;
      }
      throw new Error('Flutterwave checkout link was not returned.');
    } catch (purchaseError) {
      setError(purchaseError.message || 'Could not start the AI credit checkout.');
    } finally {
      setPurchaseBusy(false);
    }
  }

  return (
    <StudentSectionShell title="Ndovera AI" subtitle="Academic-only assistant with daily free requests and live credit control.">
      <div className="space-y-5">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {modes.map(mode => {
            const active = selectedMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setSelectedMode(mode)}
                className={`rounded-3xl border p-4 text-left transition ${active
                  ? 'border-[#1a5c38] bg-[#f5deb3] shadow-[0_16px_34px_rgba(26,92,56,0.14)] dark:border-[#00ffff] dark:bg-[#800000]/75'
                  : 'border-[#800000]/15 bg-[#fff7ea] hover:-translate-y-0.5 hover:border-[#800000]/30 dark:border-[#bf00ff]/25 dark:bg-[#800000]/55'
                }`}
              >
                <p className="text-sm font-semibold text-[#800000] dark:text-[#0000ff]">{mode}</p>
                <p className="mt-2 text-xs leading-6 text-[#191970] dark:text-[#39ff14]">Focused academic support with quota and billing enforcement.</p>
              </button>
            );
          })}
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <div className="rounded-[2rem] border border-[#800000]/15 bg-[#f5deb3] p-5 shadow-[0_22px_48px_rgba(128,0,0,0.10)] dark:border-[#bf00ff]/30 dark:bg-[#800000]/72">
            <div className="flex items-start justify-between gap-4 border-b border-[#800000]/10 pb-4 dark:border-[#bf00ff]/20">
              <div>
                <h3 className="text-2xl font-semibold text-[#800000] dark:text-[#0000ff]">Professor Vera</h3>
                <p className="mt-1 text-sm leading-6 text-[#191970] dark:text-[#39ff14]">Ask about lessons, exam review, weak topics, and guided practice.</p>
              </div>
              <span className="rounded-full bg-[#1a5c38] px-4 py-2 text-xs font-bold text-[#f5deb3] dark:bg-[#00ffff] dark:text-black">
                {selectedMode}
              </span>
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl border border-red-300/60 bg-red-50 px-4 py-3 text-sm font-semibold text-[#800000] dark:border-[#ff5f8d]/35 dark:bg-[#4a0014] dark:text-[#ffffff]">
                {error}
              </div>
            ) : null}

            <div className="mt-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#800020] dark:text-[#bf00ff]">
                Ask An Academic Question
              </label>
              <textarea
                value={input}
                onChange={event => setInput(event.target.value)}
                rows={5}
                placeholder="Example: Explain why we borrow in subtraction and give me one practice question."
                className="w-full rounded-[1.5rem] border border-[#800000]/15 bg-[#fff8ea] px-4 py-4 text-[15px] leading-7 text-[#191970] outline-none transition focus:border-[#1a5c38] focus:ring-4 focus:ring-[#1a5c38]/10 dark:border-[#bf00ff]/25 dark:bg-[#191970]/45 dark:text-[#ffffff]"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-[#bf00ff]">
                Social chat is blocked. Academic prompts only.
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setInput(''); setReply(null); setError(''); }}
                  className="rounded-2xl border border-[#800000]/20 px-4 py-3 text-sm font-semibold text-[#800000] dark:border-[#bf00ff]/25 dark:text-[#ffffff]"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={ask}
                  disabled={asking || loadingAccess}
                  className="rounded-2xl bg-[#1a5c38] px-5 py-3 text-sm font-bold text-[#f5deb3] transition hover:bg-[#154a2e] disabled:opacity-60 dark:bg-[#00ffff] dark:text-black dark:hover:bg-[#7dfcff]"
                >
                  {asking ? 'Thinking...' : 'Ask Professor Vera'}
                </button>
              </div>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-[#800000]/10 bg-white/55 p-4 dark:border-[#bf00ff]/20 dark:bg-[#191970]/35">
              {!reply ? (
                <p className="text-sm leading-6 text-[#191970] dark:text-[#39ff14]">
                  Your reply will appear here with the billing source used for the request.
                </p>
              ) : (
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[#800000] dark:text-[#ffffff]">AI Reply</p>
                    <span className="rounded-full bg-[#800000]/10 px-3 py-1 text-xs font-semibold text-[#800020] dark:bg-[#00ffff]/20 dark:text-[#bf00ff]">
                      {reply.source === 'free' ? 'Free Daily Request' : reply.source === 'school_credits' ? 'School Credit' : 'Individual Credit'}
                    </span>
                  </div>
                  <div className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-[#191970] dark:text-[#39ff14]">
                    {reply.text}
                  </div>
                  {reply.chargedCredits > 0 ? (
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-[#bf00ff]">
                      {reply.chargedCredits} credit used for this request.
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <section className="rounded-[2rem] border border-[#800000]/15 bg-[#f5deb3]/95 p-5 shadow-[0_18px_40px_rgba(25,25,112,0.08)] dark:border-[#bf00ff]/30 dark:bg-[#800000]/70">
              <h3 className="text-lg font-semibold text-[#800000] dark:text-[#0000ff]">AI Access Summary</h3>
              <p className="mt-1 text-sm leading-6 text-[#191970] dark:text-[#39ff14]">The current account follows the live quota and payment policy below.</p>

              <div className="mt-4 space-y-3">
                {loadingAccess ? (
                  <p className="text-sm text-[#191970] dark:text-[#39ff14]">Loading AI access...</p>
                ) : summaryCards.map(card => (
                  <div key={card.label} className="rounded-3xl border border-[#800000]/10 bg-white/50 p-4 dark:border-[#bf00ff]/20 dark:bg-[#191970]/35">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#800020] dark:text-[#bf00ff]">{card.label}</p>
                    <p className="mt-2 text-xl font-semibold text-[#800000] dark:text-[#ffffff]">{card.value}</p>
                    <p className="mt-2 text-sm leading-6 text-[#191970] dark:text-[#39ff14]">{card.helper}</p>
                  </div>
                ))}
              </div>
            </section>

            {access?.policy?.billingModel === 'individual' ? (
              <section className="rounded-[2rem] border border-[#800000]/15 bg-[#f5deb3]/95 p-5 shadow-[0_18px_40px_rgba(128,0,0,0.08)] dark:border-[#bf00ff]/30 dark:bg-[#800000]/70">
                <h3 className="text-lg font-semibold text-[#800000] dark:text-[#0000ff]">Buy AI Credits</h3>
                <p className="mt-1 text-sm leading-6 text-[#191970] dark:text-[#39ff14]">
                  After the 50 free daily requests are used up, your personal wallet pays for additional AI help.
                </p>

                <div className="mt-4">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#800020] dark:text-[#bf00ff]">
                    Credit Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={purchaseQuantity}
                    onChange={event => setPurchaseQuantity(Math.max(1, Number(event.target.value) || 1))}
                    className="w-full rounded-2xl border border-[#800000]/15 bg-white/70 px-4 py-3 text-sm text-[#191970] outline-none transition focus:border-[#1a5c38] focus:ring-4 focus:ring-[#1a5c38]/10 dark:border-[#bf00ff]/20 dark:bg-[#191970]/35 dark:text-[#ffffff]"
                  />
                </div>

                <p className="mt-3 text-sm leading-6 text-[#191970] dark:text-[#39ff14]">
                  {access?.policy?.pricePerCreditNaira > 0
                    ? `Current price: ${currencyFormatter.format(access.policy.pricePerCreditNaira)} per credit.`
                    : 'AI credit price has not been configured yet.'}
                </p>

                <button
                  type="button"
                  onClick={buyCredits}
                  disabled={purchaseBusy || !(access?.policy?.pricePerCreditNaira > 0)}
                  className="mt-4 w-full rounded-2xl bg-[#1a5c38] px-5 py-3 text-sm font-bold text-[#f5deb3] transition hover:bg-[#154a2e] disabled:opacity-60 dark:bg-[#00ffff] dark:text-black dark:hover:bg-[#7dfcff]"
                >
                  {purchaseBusy ? 'Opening Checkout...' : 'Buy Credits'}
                </button>
              </section>
            ) : (
              <section className="rounded-[2rem] border border-[#800000]/15 bg-[#f5deb3]/95 p-5 shadow-[0_18px_40px_rgba(128,0,0,0.08)] dark:border-[#bf00ff]/30 dark:bg-[#800000]/70">
                <h3 className="text-lg font-semibold text-[#800000] dark:text-[#0000ff]">School Sponsored AI</h3>
                <p className="mt-2 text-sm leading-6 text-[#191970] dark:text-[#39ff14]">
                  The school wallet is currently responsible for paid AI requests after the free daily quota. If the balance runs low, contact the school owner or Ami to top it up.
                </p>
                <p className="mt-3 text-sm font-semibold text-[#800020] dark:text-[#bf00ff]">
                  Current school credit balance: {access?.wallet?.schoolCredits || 0}
                </p>
              </section>
            )}
          </div>
        </section>
      </div>
    </StudentSectionShell>
  );
}

export default StudentProfessorAura;