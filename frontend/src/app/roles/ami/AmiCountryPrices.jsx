import React, { useCallback, useEffect, useState } from 'react';
import { getCountryPrices, removeCountryPrice, saveCountryPrice } from '../../../features/showcase/showcaseApi';
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
  const [notice, setNotice] = useState('');
  const load = useCallback(() => getCountryPrices().then(setData).catch(error => setNotice(error.message)), []);
  useEffect(() => { load(); }, [load]);
  const presets = data?.presets || [];
  const nameOf = code => (code === '*' ? 'Everywhere else' : presets.find(item => item.code === code)?.name || code);
  const dollarRate = Number((data?.rates || []).find(item => item.country === '*')?.naira_per_unit) || data?.defaultDollarRate || 1500;
  const isDollar = choice === '*';
  const starters = presets.filter(item => (data?.starters || []).includes(item.code));
  const others = presets.filter(item => !(data?.starters || []).includes(item.code));
  const rateOf = code => (data?.rates || []).find(item => item.country === code);

  const choose = event => {
    const code = event.target.value;
    setChoice(code);
    setCurrency(code === '*' ? 'USD' : presets.find(item => item.code === code)?.currency || '');
  };
  const save = async event => {
    event.preventDefault();
    setNotice('');
    try {
      // Local rates are typed against the dollar, the figure people can look up; the worker keeps naira per unit.
      await saveCountryPrice({ country: choice, name: nameOf(choice), currency, nairaPerUnit: isDollar ? Number(rate) : dollarRate / Number(rate) });
      setRate('');
      await load();
    } catch (error) { setNotice(error.message); }
  };

  return (
    <div className="space-y-5">
      {notice ? <p role="status" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 dark:bg-rose-500/15 dark:text-rose-100">{notice}</p> : null}
      <section className={`${CARD} space-y-2`}>
        <h2 className={`text-lg ${HEADING}`}>Prices outside Nigeria</h2>
        <p className={BODY}>Buyers abroad pay the Nigerian price plus {Math.round((data?.surcharge || 0.2) * 100)}%, unless they have a discount code. The dollar is ₦{dollarRate.toLocaleString()}. A country with no rate of its own pays in dollars. Rates do not update by themselves: check them regularly.</p>
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
            <option value="*">The dollar (everywhere else)</option>
          </select>
        </label>
        <label className={LABEL}>Currency<input className={FIELD} value={currency} onChange={event => setCurrency(event.target.value.toUpperCase())} maxLength={3} /></label>
        <label className={LABEL}>{isDollar ? 'Naira for $1' : `${currency || 'Units'} for $1`}<input type="number" min="0" step="any" required className={FIELD} value={rate} onChange={event => setRate(event.target.value)} /></label>
        <div className="flex items-end"><button type="submit" className={PRIMARY}>Save rate</button></div>
      </form>
      <section className={`${CARD} space-y-2`} aria-label="Rates">
        <h3 className={HEADING}>Rates in use</h3>
        {!data ? <p role="status" className={BODY}>Loading…</p> : data.rates.length ? (
          <ul className="divide-y divide-slate-200 dark:divide-white/10">
            {data.rates.map(item => (
              <li key={item.country} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-sm text-slate-900 dark:text-white"><strong>{nameOf(item.country)}</strong> · ₦{Number(item.naira_per_unit).toLocaleString()} for 1 {item.currency} · a ₦{SAMPLE_NAIRA.toLocaleString()} pass costs {sample(item, data.surcharge, ['RWF', 'UGX', 'XAF', 'XOF', 'TZS', 'MWK', 'SLE'].includes(item.currency) ? 0 : 2)}</span>
                <button type="button" className={SECONDARY} onClick={() => removeCountryPrice(item.country).then(load).catch(error => setNotice(error.message))}>Remove</button>
              </li>
            ))}
          </ul>
        ) : <p className={BODY}>No rates yet.</p>}
      </section>
    </div>
  );
}
