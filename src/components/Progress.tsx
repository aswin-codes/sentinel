import type { Counts } from "./types";

/** Thin pass/fail meter. */
export function ProgressBar({ counts, className = "" }: { counts: Counts; className?: string }) {
  const pct = (n: number) => (counts.total ? (n / counts.total) * 100 : 0);
  return (
    <div
      className={`flex h-1 overflow-hidden rounded-full bg-line ${className}`}
      role="img"
      aria-label={`${counts.pass} passed, ${counts.fail} failed, ${counts.notRun} not run of ${counts.total}`}
    >
      <div className="h-full bg-pass transition-[width] duration-300" style={{ width: `${pct(counts.pass)}%` }} />
      <div className="h-full bg-fail transition-[width] duration-300" style={{ width: `${pct(counts.fail)}%` }} />
    </div>
  );
}
