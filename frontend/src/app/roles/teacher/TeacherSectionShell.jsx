import React from 'react';

export default function TeacherSectionShell({
  title,
  subtitle,
  children,
  compact = false,
  viewportLocked = false,
  hideHeader = false,
  watermarkText = '',
  diagonalWatermark = false,
}) {
  return (
    <div className={`${compact ? 'p-4 md:p-5' : 'p-8'} max-w-7xl mx-auto relative ${viewportLocked ? 'h-[calc(100vh-4.5rem)] overflow-hidden flex flex-col' : ''}`}>
      {watermarkText && (
        <p className={`pointer-events-none select-none absolute text-slate-300/20 dark:text-white/10 font-black tracking-[0.35rem] z-0 ${diagonalWatermark ? 'top-10 left-6 -rotate-12 text-lg md:text-2xl' : 'top-4 right-4 text-xs md:text-sm'}`}>
          {watermarkText}
        </p>
      )}

      {!hideHeader && (
        <section className={compact ? 'glass-surface rounded-3xl p-4 mb-3' : 'glass-surface rounded-3xl p-6 mb-6'}>
          <p className={compact ? 'micro-label neon-subtle mb-1 text-[9px]' : 'micro-label neon-subtle mb-2'}>Teacher Dashboard</p>
          <h1 className={compact ? 'text-xl md:text-2xl command-title neon-title mb-1' : 'text-3xl command-title neon-title mb-2'}>{title}</h1>
          <p className="text-slate-700 dark:text-slate-300 neon-subtle">{subtitle}</p>
        </section>
      )}

      <div className={`${viewportLocked ? 'flex-1 min-h-0 overflow-hidden' : ''} relative z-10`}>
        {children}
      </div>
    </div>
  );
}
