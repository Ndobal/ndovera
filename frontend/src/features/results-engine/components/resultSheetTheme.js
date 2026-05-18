export const RESULT_SURFACE = 'rounded-3xl border border-[#c9a96e]/45 bg-[#f5deb3] shadow-[0_16px_40px_rgba(128,0,0,0.08)] dark:border-[#bf00ff]/45 dark:bg-[#800000]/55 dark:backdrop-blur-xl dark:shadow-[0_22px_60px_rgba(0,0,0,0.45)]';

export const RESULT_INNER_SURFACE = 'rounded-2xl border border-[#c9a96e]/35 bg-[#fff8ef] dark:border-[#00ffff]/25 dark:bg-black/20';

export const RESULT_HEADING = 'text-[#800000] dark:text-[#0000ff]';

export const RESULT_BODY = 'text-[#191970] dark:text-[#39ff14]';

export const RESULT_LABEL = 'text-[#800020] dark:text-[#bf00ff]';

export const RESULT_BUTTON = 'rounded-2xl border border-[#15482d] bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#f5deb3] transition disabled:opacity-50 dark:border-[#00ffff] dark:bg-[#00ffff] dark:text-black';

export const RESULT_SECONDARY_BUTTON = 'rounded-2xl border border-[#c9a96e]/50 bg-[#fff8ef] px-4 py-2 text-sm font-semibold text-[#191970] transition disabled:opacity-50 dark:border-[#bf00ff]/45 dark:bg-black/20 dark:text-white';

export const RESULT_INPUT = 'w-full rounded-xl border border-[#c9a96e]/45 bg-[#fffef9] px-3 py-2 text-[#191970] outline-none transition focus:border-[#800000] focus:ring-2 focus:ring-[#800000]/15 dark:border-[#00ffff]/30 dark:bg-black/25 dark:text-white dark:focus:border-[#00ffff] dark:focus:ring-[#00ffff]/20';

export const RESULT_TABLE_HEAD = 'bg-[#f0d090] text-[#800020] dark:bg-black/25 dark:text-[#bf00ff]';

export const RESULT_TABLE_ROW = 'border-t border-[#c9a96e]/35 dark:border-white/10';

export function getBatchTone(state) {
  switch (String(state || '').toLowerCase()) {
    case 'published':
      return 'border-emerald-500/35 bg-emerald-500/15 text-emerald-800 dark:text-[#00ffff]';
    case 'submitted':
      return 'border-amber-500/35 bg-amber-500/15 text-[#800020] dark:text-[#39ff14]';
    default:
      return 'border-[#c9a96e]/45 bg-[#f0d090] text-[#800020] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#bf00ff]';
  }
}

export function getWorkflowTone(state) {
  switch (state) {
    case 'done':
      return 'border-emerald-500/35 bg-emerald-500/15 text-emerald-800 dark:text-[#00ffff]';
    case 'active':
      return 'border-amber-500/35 bg-amber-500/15 text-[#800020] dark:text-[#39ff14]';
    default:
      return 'border-[#c9a96e]/35 bg-[#fff8ef] text-[#191970] dark:border-white/10 dark:bg-black/15 dark:text-white';
  }
}