import Link from "next/link";
import type { ProjectStats } from "../types";
import { RateBar } from "./RateBar";
import { TrendChart } from "./TrendChart";

const pct = (r: number) => `${Math.round(r * 100)}%`;

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: "pass" | "fail" }) {
  return (
    <div className="bg-bg px-4 py-3.5">
      <div className="text-[11.5px] text-muted">{label}</div>
      <div
        className={`mt-1 text-[22px] font-semibold tabular-nums tracking-[-0.02em] ${
          tone === "pass" ? "text-pass" : tone === "fail" ? "text-fail" : "text-fg"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export function StatsPanel({ stats, projectId }: { stats: ProjectStats; projectId: number }) {
  const hasCases = stats.counts.total > 0;
  const executed = stats.counts.pass + stats.counts.fail;

  if (stats.planCount === 0) {
    return (
      <div className="mt-3 rounded-[8px] border border-line px-6 py-14 text-center">
        <h3 className="text-[15px] font-medium">No stats yet</h3>
        <p className="mx-auto mt-1.5 max-w-[420px] text-[13.5px] leading-relaxed text-muted">
          Once your agent writes a test plan and you start marking cases, pass rates and trends show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-10">
      <div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[8px] border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Pass rate" value={hasCases ? pct(stats.passRate) : "–"} tone={executed ? "pass" : undefined} />
          <Kpi
            label="Failure rate"
            value={hasCases ? pct(stats.failRate) : "–"}
            tone={stats.counts.fail ? "fail" : undefined}
          />
          <Kpi label="Not run" value={hasCases ? pct(stats.notRunRate) : "–"} />
          <Kpi label="Cases" value={stats.caseCount} />
          <Kpi label="Plans" value={stats.planCount} />
          <Kpi label="Runs" value={stats.runCount} />
        </div>
        <RateBar counts={stats.counts} className="mt-4" />
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-pass" aria-hidden />
            {stats.counts.pass} passed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-fail" aria-hidden />
            {stats.counts.fail} failed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-line" aria-hidden />
            {stats.counts.notRun} not run
          </span>
          <span className="text-subtle">· latest run of each plan</span>
        </div>
      </div>

      <section>
        <h2 className="text-[14px] font-medium">Recent runs (all plans)</h2>
        {stats.trend.length === 0 ? (
          <p className="mt-2 text-[13px] text-muted">No runs yet.</p>
        ) : (
          <div className="mt-3 rounded-[8px] border border-line p-4">
            <TrendChart points={stats.trend} />
            <p className="mt-3 text-[12px] text-subtle">
              Last {stats.trend.length} run{stats.trend.length === 1 ? "" : "s"}, oldest to newest. Hover a bar for
              details.
            </p>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-[14px] font-medium">By plan</h2>
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-[8px] border border-line">
          {stats.plans.map((p) => (
            <li key={p.planId}>
              <Link
                href={`/projects/${projectId}/plans/${p.planId}`}
                className="grid gap-2 px-4 py-3 transition-colors hover:bg-surface sm:grid-cols-[minmax(0,1fr)_160px_56px_72px] sm:items-center sm:gap-6"
              >
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium">{p.title}</div>
                  <div className="mt-0.5 text-[12.5px] capitalize text-muted">{p.status}</div>
                </div>
                <RateBar counts={p.counts} />
                <div className="text-[12.5px] tabular-nums text-muted sm:text-right">
                  {p.counts.total ? pct(p.passRate) : "–"}
                </div>
                <div className="text-[12.5px] tabular-nums text-subtle sm:text-right">
                  {p.runCount} run{p.runCount === 1 ? "" : "s"}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-[14px] font-medium">Most failing cases</h2>
        {stats.mostFailing.length === 0 ? (
          <p className="mt-2 text-[13px] text-muted">No failures recorded.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-[8px] border border-line">
            {stats.mostFailing.map((c) => (
              <li key={c.caseId}>
                <Link
                  href={`/projects/${projectId}/plans/${c.planId}`}
                  className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface"
                >
                  <span className="mt-0.5 shrink-0 font-mono text-[12px] text-muted">{c.code}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px]">{c.title}</div>
                    <div className="mt-0.5 truncate text-[12.5px] text-muted">{c.planTitle}</div>
                  </div>
                  <span className="shrink-0 text-[12.5px] tabular-nums text-fail">
                    {c.failCount}/{c.runCount} runs
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
