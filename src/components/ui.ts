/** Shared class strings so buttons/inputs stay consistent. */
export const btn =
  "inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-[6px] px-3 text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";

export const btnPrimary = `${btn} bg-fg text-bg hover:bg-fg/85`;

export const btnSecondary = `${btn} border border-line bg-bg text-fg hover:bg-surface`;

export const btnGhost = `${btn} text-muted hover:bg-surface hover:text-fg`;

export const btnDanger = `${btn} bg-fail text-white hover:bg-fail/90`;

export const input =
  "block w-full rounded-[6px] border border-line bg-bg px-3 py-[7px] text-[13.5px] text-fg placeholder:text-subtle transition-colors focus:border-fg/40 focus:outline-none focus:ring-2 focus:ring-fg/10";

export const label = "mb-1.5 block text-[13px] font-medium text-fg";

export const smallLabel = "text-[11px] font-medium uppercase tracking-[0.06em] text-muted";

export const card = "rounded-[8px] border border-line bg-bg";

/** Square icon-only button (pair with btnGhost / btnSecondary). */
export const btnIcon = "w-8 px-0";
