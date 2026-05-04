import React from 'react';

export default function RoleSectionPage({
  roleTitle,
  sectionTitle,
  sectionSubtitle,
  watermark,
  metricCards = [],
  infoCards = [],
}) {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <section className="glass-surface rounded-3xl p-6 mb-6">
        <p className="micro-label neon-subtle mb-2">{roleTitle}</p>
        <h1 className="text-3xl command-title neon-title mb-2">{sectionTitle}</h1>
        <p className="text-slate-700 dark:text-slate-300 neon-subtle">{sectionSubtitle}</p>
      </section>

      {metricCards.length > 0 && (
        <div className="relative mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {metricCards.map(card => (
              <div key={card.label} className="glass-surface rounded-3xl p-5 text-center">
                <p className="micro-label neon-subtle mb-1">{card.label}</p>
                <p className={`text-2xl command-title mono-metric ${card.accent || 'accent-indigo'}`}>{card.value}</p>
              </div>
            ))}
          </div>

          {watermark && (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-5xl md:text-7xl font-black tracking-[0.6rem] text-white/5 select-none">
              {watermark}
            </p>
          )}
        </div>
      )}

      {metricCards.length === 0 && (
        <section className="glass-surface rounded-3xl p-5 mb-6">
          <p className="micro-label accent-amber">Live metrics unavailable</p>
          <p className="mt-2 text-slate-300">This section no longer shows fabricated dashboard totals. Live metrics will appear once the connected service is available.</p>
        </section>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {infoCards.map(card => (
          <section key={card.title} className="glass-surface rounded-3xl p-6">
            <h2 className="text-xl command-title neon-title mb-4">{card.title}</h2>
            <div className="space-y-3">
              {card.items.map(item => (
                <div key={`${card.title}-${item.text}`} className="rounded-2xl border border-white/10 p-4 bg-slate-900/30">
                  <p className="text-slate-100">{item.text}</p>
                  {item.tag && <p className={`micro-label mt-2 ${item.accent || 'accent-indigo'}`}>{item.tag}</p>}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
