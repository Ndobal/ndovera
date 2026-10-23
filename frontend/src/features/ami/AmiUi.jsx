import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

// The command centre's building blocks: a light canvas with a breadcrumb and page title,
// white stat cards and panels, status pills, and the money chart. Ndovera's colours:
// navy #191970 / #0b1f3a, maroon #800000, gold #c9a96e, green #1a5c38.

export const naira = (value, digits = 0) => `₦${Number(value || 0).toLocaleString('en-NG', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
export const compactNaira = value => {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1e6) return `₦${(amount / 1e6).toLocaleString('en-NG', { maximumFractionDigits: 1 })}M`;
  if (Math.abs(amount) >= 1e3) return `₦${(amount / 1e3).toLocaleString('en-NG', { maximumFractionDigits: 0 })}k`;
  return naira(amount);
};
export const shortDate = value => (value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const monthLabel = month => {
  const [year, number] = String(month || '').split('-').map(Number);
  return year ? new Date(Date.UTC(year, number - 1, 1)).toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }) : month;
};

export function AmiPage({ title, subtitle, crumbs = [], actions = null, children }) {
  const location = useLocation();
  const home = `/roles/${location.pathname.split('/')[2] || 'ami'}`;
  return (
    <div className="min-h-full bg-[#eef1f6] px-4 py-5 text-[#1e2a3b] sm:px-6 lg:px-8 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <nav aria-label="Breadcrumb" className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              <Link to={home} className="hover:text-[#191970] dark:hover:text-white">Home</Link>
              {crumbs.map(crumb => <span key={crumb}> <span aria-hidden="true">›</span> {crumb}</span>)}
            </nav>
            {title ? <h1 className="mt-1 text-2xl font-black tracking-tight text-[#0b1f3a] dark:text-white">{title}</h1> : null}
            {subtitle ? <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {children}
      </div>
    </div>
  );
}

const TONES = {
  navy: 'bg-[#191970]/10 text-[#191970] dark:bg-indigo-400/15 dark:text-indigo-200',
  green: 'bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200',
  gold: 'bg-[#c9a96e]/20 text-[#7a5a1c] dark:bg-amber-300/15 dark:text-amber-200',
  maroon: 'bg-[#800000]/10 text-[#800000] dark:bg-rose-400/15 dark:text-rose-200',
};

export function StatCard({ icon: Icon, label, value, hint, tone = 'navy' }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${TONES[tone] || TONES.navy}`}>
        {Icon ? <Icon className="h-7 w-7" aria-hidden="true" /> : null}
      </div>
      <div className="min-w-0 flex-1 border-l border-slate-200 pl-4 dark:border-white/10">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">{label}</p>
        <p className="truncate text-2xl font-black tabular-nums text-[#0b1f3a] dark:text-white">{value}</p>
        {hint ? <p className="truncate text-xs text-slate-600 dark:text-slate-400">{hint}</p> : null}
      </div>
    </div>
  );
}

export function Panel({ title, actions = null, children, className = '', bodyClassName = 'p-4' }) {
  return (
    <section className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900 ${className}`}>
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-white/10">
          <h2 className="text-sm font-black uppercase tracking-wide text-[#0b1f3a] dark:text-white">{title}</h2>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

const PILL = {
  good: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200',
  warn: 'bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200',
  bad: 'bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-200',
  info: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200',
};
const PILL_ICON = { good: '✓', warn: '!', bad: '✕', info: '•' };

/** A status in words with an icon (never colour alone). */
export function Pill({ tone = 'info', children }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${PILL[tone] || PILL.info}`}>
      <span aria-hidden="true">{PILL_ICON[tone]}</span>{children}
    </span>
  );
}

/** This term's fee as a pill. */
export function TermFeePill({ fee }) {
  if (!fee || fee.status === 'unknown') return <Pill tone="info">No term set</Pill>;
  if (fee.status === 'paid') return <Pill tone="good">Paid</Pill>;
  if (fee.status === 'overdue') return <Pill tone="bad">Overdue</Pill>;
  if (fee.status === 'not_invoiced') return <Pill tone="warn">Unpaid · no invoice</Pill>;
  return <Pill tone="warn">Unpaid</Pill>;
}

export const BUTTON = 'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50';
export const PRIMARY = `${BUTTON} bg-[#191970] text-white hover:bg-[#12124f]`;
export const SECONDARY = `${BUTTON} border border-slate-300 bg-white text-[#191970] hover:bg-slate-50 dark:border-white/15 dark:bg-slate-800 dark:text-white`;
export const FIELD = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#191970] focus:ring-2 focus:ring-[#191970]/15 dark:border-white/15 dark:bg-slate-800 dark:text-white';
export const TH = 'px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400';
export const TD = 'px-4 py-3 align-middle';

/** A school's logo, or its initials on a tinted square. */
export function SchoolMark({ name, logoUrl }) {
  const initials = String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('');
  if (logoUrl) return <img src={logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 bg-white object-contain p-0.5 dark:border-white/10" />;
  return <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#191970] text-xs font-black text-[#c9a96e]">{initials || '?'}</span>;
}

// Money in vs money out per month: two series, one axis, grouped bars. Colours validated
// (light #2f5fb3 / #c0763a; dark #4f7bd0 / #c27f45). Hover shows the month's figures; a table view
// carries the same numbers.
const SERIES = [
  { key: 'collected', label: 'Money in', bar: 'fill-[#2f5fb3] dark:fill-[#4f7bd0]', swatch: 'bg-[#2f5fb3] dark:bg-[#4f7bd0]' },
  { key: 'expenses', label: 'Money out', bar: 'fill-[#c0763a] dark:fill-[#c27f45]', swatch: 'bg-[#c0763a] dark:bg-[#c27f45]' },
];

export function MoneyChart({ monthly = [] }) {
  const [hover, setHover] = useState(null);
  const [asTable, setAsTable] = useState(false);
  const width = 640;
  const height = 240;
  const pad = { top: 12, right: 8, bottom: 26, left: 52 };
  const max = Math.max(1, ...monthly.flatMap(row => [row.collected, row.expenses]));
  const step = 10 ** Math.floor(Math.log10(max));
  const top = Math.ceil(max / step) * step;
  const ticks = [0, top / 2, top];
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const slot = plotW / Math.max(1, monthly.length);
  const barW = Math.max(4, Math.min(16, slot / 3 - 2));
  const y = value => pad.top + plotH - (value / top) * plotH;
  const empty = monthly.every(row => !row.collected && !row.expenses);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-600 dark:text-slate-300" aria-label="Legend">
          {SERIES.map(series => <span key={series.key} className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${series.swatch}`} />{series.label}</span>)}
        </div>
        <button type="button" className="text-xs font-bold text-[#191970] underline dark:text-indigo-200" onClick={() => setAsTable(value => !value)}>{asTable ? 'Show chart' : 'Show as table'}</button>
      </div>
      {asTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr><th className={TH}>Month</th><th className={`${TH} text-right`}>Money in</th><th className={`${TH} text-right`}>Money out</th><th className={`${TH} text-right`}>Net</th></tr></thead>
            <tbody>{monthly.map(row => (
              <tr key={row.month} className="border-t border-slate-100 dark:border-white/5">
                <td className={TD}>{monthLabel(row.month)} {row.month.slice(0, 4)}</td>
                <td className={`${TD} text-right tabular-nums`}>{naira(row.collected)}</td>
                <td className={`${TD} text-right tabular-nums`}>{naira(row.expenses)}</td>
                <td className={`${TD} text-right font-bold tabular-nums`}>{naira(row.net)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Money in and money out, last 12 months">
            {ticks.map(tick => (
              <g key={tick}>
                <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} className="stroke-slate-200 dark:stroke-white/10" strokeWidth="1" />
                <text x={pad.left - 6} y={y(tick) + 4} textAnchor="end" className="fill-slate-500 text-[10px] dark:fill-slate-400">{compactNaira(tick)}</text>
              </g>
            ))}
            {monthly.map((row, index) => {
              const x0 = pad.left + index * slot + slot / 2 - barW - 1;
              return (
                <g key={row.month} onMouseEnter={() => setHover(index)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(index)} onBlur={() => setHover(null)} tabIndex={0}>
                  <rect x={pad.left + index * slot} y={pad.top} width={slot} height={plotH} className={hover === index ? 'fill-slate-100 dark:fill-white/5' : 'fill-transparent'} />
                  {SERIES.map((series, s) => {
                    const value = row[series.key] || 0;
                    const h = Math.max(0, pad.top + plotH - y(value));
                    if (!h) return null;
                    const x = x0 + s * (barW + 2);
                    const r = Math.min(4, barW / 2, h);
                    return <path key={series.key} className={series.bar} d={`M${x},${pad.top + plotH} V${pad.top + plotH - h + r} Q${x},${pad.top + plotH - h} ${x + r},${pad.top + plotH - h} H${x + barW - r} Q${x + barW},${pad.top + plotH - h} ${x + barW},${pad.top + plotH - h + r} V${pad.top + plotH} Z`} />;
                  })}
                  <text x={pad.left + index * slot + slot / 2} y={height - 8} textAnchor="middle" className="fill-slate-500 text-[10px] dark:fill-slate-400">{monthLabel(row.month)}</text>
                </g>
              );
            })}
            <line x1={pad.left} x2={width - pad.right} y1={pad.top + plotH} y2={pad.top + plotH} className="stroke-slate-300 dark:stroke-white/20" strokeWidth="1" />
          </svg>
          {empty ? <p className="absolute inset-0 flex items-center justify-center text-sm text-slate-600 dark:text-slate-300">No money recorded in the last 12 months yet.</p> : null}
          {hover !== null && monthly[hover] ? (
            <div className="pointer-events-none absolute top-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-slate-800"
              style={{ left: `${Math.min(80, Math.max(0, ((pad.left + hover * slot) / width) * 100))}%` }}>
              <p className="font-bold text-[#0b1f3a] dark:text-white">{monthLabel(monthly[hover].month)} {monthly[hover].month.slice(0, 4)}</p>
              {SERIES.map(series => <p key={series.key} className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200"><span className={`h-2 w-2 rounded-sm ${series.swatch}`} />{series.label}: <b className="tabular-nums">{naira(monthly[hover][series.key])}</b></p>)}
              <p className="mt-0.5 font-bold text-slate-800 dark:text-white">Net: {naira(monthly[hover].net)}</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
