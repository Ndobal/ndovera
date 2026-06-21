// Light mode: royal-blue theme on light-blue/white surfaces with midnight-blue text.
// Dark-mode variants mirror the rest of the dashboard (slate surfaces + light text).

export const RESULT_SURFACE = 'rounded-3xl border border-[#7cc4e8]/45 bg-[#b5e3f4] shadow-[0_16px_40px_rgba(20,33,91,0.08)] dark:border-white/10 dark:bg-slate-900/70 dark:backdrop-blur-xl dark:shadow-[0_22px_60px_rgba(0,0,0,0.45)]';

export const RESULT_INNER_SURFACE = 'rounded-2xl border border-[#7cc4e8]/40 bg-white dark:border-white/10 dark:bg-slate-800/50';

export const RESULT_HEADING = 'text-[#191970] dark:text-white';

export const RESULT_BODY = 'text-[#191970] dark:text-slate-200';

export const RESULT_LABEL = 'text-[#2447d8] dark:text-slate-400';

export const RESULT_BUTTON = 'rounded-2xl border border-[#1b34a8] bg-[#2447d8] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#1b34a8] disabled:opacity-50 dark:border-[#1a5c38] dark:bg-[#1a5c38] dark:text-white dark:hover:bg-[#1f6e43]';

export const RESULT_SECONDARY_BUTTON = 'rounded-2xl border border-[#7cc4e8]/60 bg-white px-4 py-2 text-sm font-semibold text-[#191970] transition hover:bg-[#eaf6fd] disabled:opacity-50 dark:border-white/15 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700';

export const RESULT_INPUT = 'w-full rounded-xl border border-[#7cc4e8]/55 bg-white px-3 py-2 text-[#191970] outline-none transition focus:border-[#2447d8] focus:ring-2 focus:ring-[#2447d8]/15 dark:border-white/15 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-[#7cc4e8] dark:focus:ring-[#7cc4e8]/25';

export const RESULT_TABLE_HEAD = 'bg-[#ade1f4] text-[#191970] dark:bg-slate-800 dark:text-slate-300';

export const RESULT_TABLE_ROW = 'border-t border-[#7cc4e8]/35 dark:border-white/10';

export function getBatchTone(state) {
  switch (String(state || '').toLowerCase()) {
    case 'published':
      return 'border-emerald-500/35 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300';
    case 'submitted':
      return 'border-amber-500/35 bg-amber-500/15 text-amber-800 dark:text-amber-300';
    default:
      return 'border-[#7cc4e8]/45 bg-[#ade1f4] text-[#191970] dark:border-white/10 dark:bg-slate-800 dark:text-slate-300';
  }
}

export function getWorkflowTone(state) {
  switch (state) {
    case 'done':
      return 'border-emerald-500/35 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300';
    case 'active':
      return 'border-amber-500/35 bg-amber-500/15 text-amber-800 dark:text-amber-300';
    default:
      return 'border-[#7cc4e8]/35 bg-white text-[#191970] dark:border-white/10 dark:bg-slate-800/40 dark:text-slate-200';
  }
}
