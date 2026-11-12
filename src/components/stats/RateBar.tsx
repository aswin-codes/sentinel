import type { Counts } from "../types";

/** Stacked hairline bar: pass (emerald) / fail (rose) / not run (line). */
export function RateBar({
  counts,
  className = "",
  height = "h-1.5",
}: {
  counts: Counts;
  className?: string;
  height?: string;
}) {
  const pct = (n: number) => (counts.total ? (n / counts.total) * 100 : 0);
  return (
    <div
      className={`flex overflow-hidden rounded-full bg-line ${height} ${className}`}
      role="img"
      aria-label={`${counts.pass} passed, ${counts.fail} failed, ${counts.notRun} not run of ${counts.total}`}
    >
      <div className="h-full bg-pass" style={{ width: `${pct(counts.pass)}%` }} />
      <div className="h-full bg-fail" style={{ width: `${pct(counts.fail)}%` }} />
    </div>
  );
}
