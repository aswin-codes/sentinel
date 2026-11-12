import type { TrendPoint } from "../types";

/** Plain SVG stacked bars per recent run (oldest to newest). Pass/fail colour only. */
export function TrendChart({ points }: { points: TrendPoint[] }) {
  if (points.length === 0) return null;
  const H = 96;
  const barW = 18;
  const gap = 8;
  const W = points.length * (barW + gap) - gap;
  const summary = points
    .map((p) => `${p.planTitle} / ${p.runName}: ${p.pass} passed, ${p.fail} failed, ${p.notRun} not run`)
    .join("; ");
  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H + 1}`}
        width={W}
        height={H + 1}
        className="block max-w-none"
        role="img"
        aria-label={`Results across the last ${points.length} runs. ${summary}`}
      >
        {points.map((p, i) => {
          const x = i * (barW + gap);
          const t = p.total || 1;
          const hp = (p.pass / t) * H;
          const hf = (p.fail / t) * H;
          const hn = p.total ? H - hp - hf : H;
          return (
            <g key={p.runId}>
              <title>{`${p.planTitle} · ${p.runName}\n${p.pass} passed · ${p.fail} failed · ${p.notRun} not run`}</title>
              <rect x={x} y={0} width={barW} height={hn} rx={2} className="fill-line" opacity={p.total ? 0.7 : 0.4} />
              <rect x={x} y={hn} width={barW} height={hf} className="fill-fail" />
              <rect x={x} y={hn + hf} width={barW} height={hp} className="fill-pass" />
            </g>
          );
        })}
        <line x1={0} y1={H + 0.5} x2={W} y2={H + 0.5} className="stroke-line" strokeWidth={1} />
      </svg>
    </div>
  );
}
