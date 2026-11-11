/** Shared class strings so buttons/inputs stay consistent. */
export const btn =
  "inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-[6px] px-3 text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";

export const btnPrimary = `${btn} bg-fg text-canvas hover:bg-white`;

export const btnSecondary = `${btn} border border-line bg-surface text-fg/90 hover:border-line-strong hover:bg-surface-2 hover:text-fg`;

export const btnGhost = `${btn} text-muted hover:bg-surface-2 hover:text-fg`;

export const input =
  "w-full rounded-[6px] border border-line bg-surface-2 px-3 py-2 text-[13.5px] text-fg placeholder:text-muted/70 transition-colors hover:border-line-strong focus:border-accent/60 focus:outline-none focus-visible:outline-none";

export const monoLabel = "font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted";
