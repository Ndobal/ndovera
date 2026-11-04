// Prices in what the buyer pays. The worker sends the rule and always sets the real charge;
// this repeats its sum (countryPricing.ts) so a price on screen matches the payment page.

export function chargeFor(rule, naira, { discounted = false } = {}) {
  const base = Number(naira) || 0;
  if (!rule || !rule.foreign) return { currency: 'NGN', amount: base };
  const surcharge = discounted ? 0 : Number(rule.surcharge) || 0;
  const scale = 10 ** (Number(rule.decimals) || 0);
  const units = (base * (1 + surcharge)) / (Number(rule.nairaPerUnit) || 1);
  return { currency: rule.currency, amount: Math.ceil(Number((units * scale).toFixed(6))) / scale };
}

export function formatMoney(currency, amount) {
  const value = Number(amount) || 0;
  if (currency === 'NGN') return `₦${value.toLocaleString()}`;
  return `${currency} ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function localMoney(naira, rule, options) {
  const charge = chargeFor(rule, naira, options);
  return formatMoney(charge.currency, charge.amount);
}
