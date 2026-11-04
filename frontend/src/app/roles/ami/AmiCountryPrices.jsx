import React, { useCallback, useEffect, useState } from 'react';
import { getAiLimits, getContactChangePrice, getCountryPrices, removeCountryPrice, saveAiLimits, saveContactChangePrice, saveCountryPrice } from '../../../features/showcase/showcaseApi';
import { chargeFor, formatMoney } from '../../../shared/pricing/localPrice';

// What buyers outside Nigeria pay: the Nigerian price plus 20%, in their currency at the rate
// typed here. A country with no rate pays dollars.

const CARD = 'rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900';
const HEADING = 'font-black text-slate-900 dark:text-white';
const BODY = 'text-sm text-slate-700 dark:text-slate-200';
const LABEL = 'block text-xs font-bold text-slate-700 dark:text-slate-200';
const FIELD = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/20 dark:bg-slate-800 dark:text-white';
const PRIMARY = 'rounded-xl bg-indigo-700 px-4 py-2 text-sm font-black text-white disabled:opacity-50';
const SECONDARY = 'rounded-xl border border-slate-400 bg-white px-3 py-1.5 text-xs font-black text-slate-800 dark:border-white/30 dark:bg-slate-800 dark:text-white';
const SAMPLE_NAIRA = 1500;

const sample = (rate, surcharge, decimals) => {
  const charge = chargeFor({ foreign: true, currency: rate.currency, nairaPerUnit: Number(rate.naira_per_unit), surcharge, decimals }, SAMPLE_NAIRA);
  return formatMoney(charge.currency, charge.amount);
};

export default function AmiCountryPrices() {
  const [data, setData] = useState(null);
  const [choice, setChoice] = useState('GH');
  const [currency, setCurrency] = useState('GHS');
  const [rate, setRate] = useState('');
  const [otherCode, setOtherCode] = useState('');
  const [otherName, setOtherName] = useState('');
  const [packNaira, setPackNaira] = useState('');
  const [notice, setNotice] = useState('');
  const [limits, setLimits] = useState({ freeAiPerDay: '', freeReportsPerDay: '', reportCredits: '' });
  useEffect(() => { getAiLimits().then(result => setLimits(result.limits)).catch(() => null); }, []);
  const setLimit = name => event => setLimits(current => ({ ...current, [name]: event.target.value }));
  const saveLimits = event => {
    event.preventDefault();
    saveAiLimits({ freeAiPerDay: Number(limits.freeAiPerDay), freeReportsPerDay: Number(limits.freeReportsPerDay), reportCredits: Number(limits.reportCredits) })
      .then(result => { setLimits(result.limits); setNotice('Saved.'); }).catch(error => setNotice(error.message));
  };
  useEffect(() => { getContactChangePrice().then(result => setPackNaira(String(result.naira))).catch(() => null); }, []);
  const savePack = event => { event.preventDefault(); saveContactChangePrice(Number(packNaira)).then(result => { setPackNaira(String(result.naira)); setNotice('Saved.'); }).catch(error => setNotice(error.message)); };
  const load = useCallback(() => getCountryPrices().then(setData).catch(error => setNotice(error.message)), []);
  useEffect(() => { load(); }, [load]);
  const presets = data?.presets || [];
  const nameOf = code => (code === '*' ? 'Everywhere else' : presets.find(item => item.code === code)?.name || code);
  const dollarRate = Number((data?.rates || []).find(item => item.country === '*')?.naira_per_unit) || data?.defaultDollarRate || 1500;
  const starters = presets.filter(item => (data?.starters || []).includes(item.code));
  const others = presets.filter(item => !(data?.starters || []).includes(item.code));
  const rateOf = code => (data?.rates || []).find(item => item.country === code);

  const choose = event => {
    const code = event.target.value;
    setChoice(code);
    setCurrency(code === '*' ? 'USD' : code === 'other' ? '' : presets.find(item => item.code === code)?.currency || '');
  };
  const save = async event => {
    event.preventDefault();
    setNotice('');
    try {
      await saveCountryPrice({ country: choice === 'other' ? otherCode : choice, name: choice === 'other' ? otherName : nameOf(choice), currency, nairaPerUnit: Number(rate) });
      setRate('');
      await load();
    } catch (error) { setNotice(error.message); }
  };

  return (
    <div className="space-y-5">
      {notice ? <p role="status" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 dark:bg-rose-500/15 dark:text-rose-100">{notice}</p> : null}
      <section className={`${CARD} space-y-2`}>
        <h2 className={`text-lg ${HEADING}`}>Prices outside Nigeria</h2>
        <p className={BODY}>Buyers abroad pay the Nigerian price plus {Math.round((data?.surcharge || 0.2) * 100)}%, unless they have a discount code. The dollar is ₦{dollarRate.toLocaleString()}. Buyers in a country with a rate see only their own currency. A country with no rate would see dollars, so set a rate for every country you sell in. Rates do not update by themselves: check them regularly.</p>
        <p className={BODY}>Before you add a currency, confirm in your Flutterwave dashboard that your account can collect it. A payment in a currency your account does not accept will fail at checkout.</p>
      </section>
      <section className={`${CARD} space-y-2`} aria-label="Launch countries">
        <h3 className={HEADING}>Launch countries</h3>
        <ul className="divide-y divide-slate-200 dark:divide-white/10">
          {starters.map(item => (
            <li key={item.code} className="py-2 text-sm text-slate-900 dark:text-white"><strong>{item.name}</strong> · {rateOf(item.code) ? `pays in ${rateOf(item.code).currency}` : `pays in dollars until you set a ${item.currency} rate`}</li>
          ))}
        </ul>
      </section>
      <form onSubmit={save} className={`${CARD} grid gap-3 sm:grid-cols-4`} aria-label="Set a rate">
        <label className={LABEL}>Country
          <select className={FIELD} value={choice} onChange={choose}>
            <optgroup label="Launch countries">{starters.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</optgroup>
            <optgroup label="Other countries">{others.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</optgroup>
            <option value="other">Another country…</option>
            <option value="*">The dollar (only where a country has no rate)</option>
          </select>
        </label>
        <label className={LABEL}>Currency<input className={FIELD} value={currency} onChange={event => setCurrency(event.target.value.toUpperCase())} maxLength={3} /></label>
        {choice === 'other' ? <><label className={LABEL}>Two-letter country code<input className={FIELD} maxLength={2} required value={otherCode} onChange={event => setOtherCode(event.target.value.toUpperCase())} /></label><label className={LABEL}>Country name<input className={FIELD} required value={otherName} onChange={event => setOtherName(event.target.value)} /></label></> : null}
        <label className={LABEL}>Exact naira for 1 {currency || 'unit'}<input type="number" min="0" step="any" required className={FIELD} value={rate} onChange={event => setRate(event.target.value)} /></label>
        <div className="flex items-end"><button type="submit" className={PRIMARY}>Save rate</button></div>
      </form>
      <form onSubmit={saveLimits} className={`${CARD} space-y-2`} aria-label="Free AI limits">
        <h3 className={HEADING}>Free AI limits</h3>
        <p className={BODY}>For each person, each day. More free AI means more of Cloudflare's daily AI allowance is used, and a new number applies within a minute.</p>
        <label className={LABEL}>Free AI uses a day<input type="number" min="0" max="100" className={FIELD} value={limits.freeAiPerDay} onChange={setLimit('freeAiPerDay')} /></label>
        <label className={LABEL}>Free AI reports a day<input type="number" min="0" max="100" className={FIELD} value={limits.freeReportsPerDay} onChange={setLimit('freeReportsPerDay')} /></label>
        <label className={LABEL}>AI credits for each further report<input type="number" min="1" max="5000" className={FIELD} value={limits.reportCredits} onChange={setLimit('reportCredits')} /></label>
        <button type="submit" className={PRIMARY}>Save limits</button>
      </form>
      <form onSubmit={savePack} className={`${CARD} space-y-2`} aria-label="Extra email and phone changes">
        <h3 className={HEADING}>Extra email and phone changes</h3>
        <p className={BODY}>Schools get 3 free changes a month. This is the naira price of 5 more; schools see it in their own currency.</p>
        <label className={LABEL}>Price in naira<input type="number" min="1" className={FIELD} value={packNaira} onChange={event => setPackNaira(event.target.value)} /></label>
        <button type="submit" className={PRIMARY}>Save price</button>
      </form>
      <section className={`${CARD} space-y-2`} aria-label="Rates">
        <h3 className={HEADING}>Rates in use</h3>
        {!data ? <p role="status" className={BODY}>Loading…</p> : data.rates.length ? (
          <ul className="divide-y divide-slate-200 dark:divide-white/10">
            {data.rates.map(item => (
              <li key={item.country} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-sm text-slate-900 dark:text-white"><strong>{item.name && item.country !== '*' ? item.name : nameOf(item.country)}</strong> · ₦{Number(item.naira_per_unit).toLocaleString()} for 1 {item.currency} · a ₦{SAMPLE_NAIRA.toLocaleString()} pass costs {sample(item, data.surcharge, ['RWF', 'UGX', 'XAF', 'XOF', 'TZS', 'MWK', 'SLE'].includes(item.currency) ? 0 : 2)}</span>
                <button type="button" className={SECONDARY} onClick={() => removeCountryPrice(item.country).then(load).catch(error => setNotice(error.message))}>Remove</button>
              </li>
            ))}
          </ul>
        ) : <p className={BODY}>No rates yet.</p>}
      </section>
    </div>
  );
}
