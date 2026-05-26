import React from 'react';
import MobileRoleOverviewNav from './MobileRoleOverviewNav';

const defaultTheme = {
  page: 'p-8 max-w-7xl mx-auto',
  panel: 'glass-surface rounded-3xl p-6 mb-6',
  eyebrow: 'micro-label neon-subtle mb-2',
  title: 'text-3xl command-title neon-title mb-2',
  body: 'text-slate-700 dark:text-slate-300 neon-subtle',
  metricsWrap: 'relative mb-6',
  metricGrid: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4',
  metricCard: 'glass-surface rounded-3xl p-5 text-center',
  metricLabel: 'micro-label neon-subtle mb-1',
  metricValue: 'text-2xl command-title mono-metric',
  emptyPanel: 'glass-surface rounded-3xl p-5 mb-6',
  emptyLabel: 'micro-label accent-amber',
  emptyBody: 'mt-2 text-slate-300',
  watermark: 'pointer-events-none absolute inset-0 flex items-center justify-center text-5xl md:text-7xl font-black tracking-[0.6rem] text-white/5 select-none',
  infoGrid: 'grid grid-cols-1 xl:grid-cols-2 gap-6',
  infoPanel: 'glass-surface rounded-3xl p-6',
  infoTitle: 'text-xl command-title neon-title mb-4',
  infoList: 'space-y-3',
  infoItem: 'rounded-2xl border border-white/10 p-4 bg-slate-900/30',
  infoText: 'text-slate-100',
  infoTag: 'micro-label mt-2',
};

const wheatTheme = {
  page: 'p-8 max-w-7xl mx-auto space-y-6',
  panel: 'rounded-3xl p-6 bg-[#f5deb3] border border-[#c9a96e]/40 shadow-[0_18px_45px_rgba(128,0,0,0.08)]',
  eyebrow: 'text-xs font-semibold uppercase tracking-[0.24em] text-[#800020] mb-2',
  title: 'text-3xl font-black tracking-tight text-[#800000] mb-2',
  body: 'text-[#191970]',
  metricsWrap: 'relative',
  metricGrid: 'grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2.5',
  metricCard: 'rounded-2xl min-h-[48px] px-3 py-2.5 text-left bg-[#fff8f0] border border-[#c9a96e]/40 shadow-[0_10px_24px_rgba(128,0,0,0.06)]',
  metricLabel: 'text-[10px] font-semibold uppercase tracking-[0.18em] text-[#800020] mb-1',
  metricValue: 'text-base font-black text-[#191970] leading-tight',
  emptyPanel: 'rounded-3xl p-5 bg-[#f5deb3] border border-[#c9a96e]/40 shadow-[0_12px_28px_rgba(128,0,0,0.06)]',
  emptyLabel: 'text-xs font-semibold uppercase tracking-[0.22em] text-[#800020]',
  emptyBody: 'mt-2 text-[#191970]',
  watermark: 'pointer-events-none absolute inset-0 flex items-center justify-center text-5xl md:text-7xl font-black tracking-[0.6rem] text-[#800020]/10 select-none',
  infoGrid: 'grid grid-cols-1 xl:grid-cols-2 gap-6',
  infoPanel: 'rounded-3xl p-6 bg-[#f5deb3] border border-[#c9a96e]/40 shadow-[0_12px_32px_rgba(128,0,0,0.08)]',
  infoTitle: 'text-xl font-bold text-[#800000] mb-4',
  infoList: 'space-y-3',
  infoItem: 'rounded-2xl border border-[#c9a96e]/40 p-4 bg-[#fff8f0]',
  infoText: 'text-[#191970]',
  infoTag: 'mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#800020]',
};

export default function RoleSectionPage({
  roleTitle,
  sectionTitle,
  sectionSubtitle,
  watermark,
  metricCards = [],
  infoCards = [],
  theme = 'default',
  showMobileRoleNav = false,
  mobileNavRoleKey = '',
  mobileNavCounts = {},
}) {
  const palette = theme === 'wheat' ? wheatTheme : defaultTheme;

  return (
    <div className={palette.page}>
      <section className={palette.panel}>
        <p className={palette.eyebrow}>{roleTitle}</p>
        <h1 className={palette.title}>{sectionTitle}</h1>
        <p className={palette.body}>{sectionSubtitle}</p>
      </section>

      {metricCards.length > 0 && (
        <div className={palette.metricsWrap}>
          <div className={palette.metricGrid}>
            {metricCards.map(card => (
              <div key={card.label} className={palette.metricCard}>
                <p className={palette.metricLabel}>{card.label}</p>
                <p className={theme === 'wheat' ? palette.metricValue : `${palette.metricValue} ${card.accent || 'accent-indigo'}`}>
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          {watermark && (
            <p className={palette.watermark}>
              {watermark}
            </p>
          )}
        </div>
      )}

      {metricCards.length === 0 && (
        <section className={palette.emptyPanel}>
          <p className={palette.emptyLabel}>Live metrics unavailable</p>
          <p className={palette.emptyBody}>This section no longer shows fabricated dashboard totals. Live metrics will appear once the connected service is available.</p>
        </section>
      )}

      <div className={palette.infoGrid}>
        {infoCards.map(card => (
          <section key={card.title} className={palette.infoPanel}>
            <h2 className={palette.infoTitle}>{card.title}</h2>
            <div className={palette.infoList}>
              {card.items.map(item => (
                <div key={`${card.title}-${item.text}`} className={palette.infoItem}>
                  <p className={palette.infoText}>{item.text}</p>
                  {item.tag && <p className={palette.infoTag}>{item.tag}</p>}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {showMobileRoleNav && mobileNavRoleKey ? <MobileRoleOverviewNav roleKey={mobileNavRoleKey} counts={mobileNavCounts} /> : null}
    </div>
  );
}
