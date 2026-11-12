import Link from "next/link";
import { redirect } from "next/navigation";
import { btnGhost, btnPrimary } from "@/components/ui";
import SaaSTemplate from "@/components/ui/saa-s-template";
import { LiveDemo } from "@/components/landing/LiveDemo";
import { GitHubMark, REPO_URL } from "@/components/landing/GitHubStar";
import { getCurrentUser } from "@/lib/session";

const HOW = [
  {
    title: "Connect your agent over MCP",
    body: "Create an API token, paste one config block into Claude Code, Cursor, Copilot, Windsurf, Codex, Gemini CLI or Antigravity.",
    code: '"sentinel": { "command": "node", … }',
  },
  {
    title: "Agent writes plans from your diffs",
    body: "It reads what changed and writes sections, steps and expected results into your project.",
    code: "upsert_test_plan → 2 sections · 5 cases",
  },
  {
    title: "Run, mark, hand failures back",
    body: "Mark each case Pass or Fail, add a note, then ask the agent to fix what failed.",
    code: "> Fix the failed QA checks",
  },
];

const FAQ = [
  {
    q: "Is it free? Can I self-host it?",
    a: "Yes. Sentinel is free and open source. Run it yourself with Node and a Postgres database.",
  },
  {
    q: "Where is my data stored?",
    a: "In your own Postgres database. Projects, plans and results are scoped to your account, and agents only see what your API token can reach.",
  },
  {
    q: "Which agents does it work with?",
    a: "Anything that speaks MCP: Claude Code, Cursor, GitHub Copilot, Windsurf, Antigravity, Codex CLI, Gemini CLI, Cline and Roo. Each has a copy-paste setup prompt and config in the Connect agent dialog. There is also a plain REST API that takes the same token.",
  },
  {
    q: "Do I need to write tests?",
    a: "No. The agent drafts the plan from your changes. You run it by hand, the way a QA person would, and only write a note when something fails.",
  },
];

const AGENTS = ["Claude Code", "Cursor", "Copilot", "Windsurf", "Codex", "Gemini CLI", "Antigravity"];

export default async function Home() {
  if (await getCurrentUser()) redirect("/projects");

  return (
    <div className="flex min-h-screen flex-col">
      <SaaSTemplate preview={<LiveDemo />} />

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 sm:px-6">
        {/* How it works */}
        <section id="how" aria-labelledby="how-title" className="scroll-mt-16 py-16 sm:py-20">
          <h2 id="how-title" className="text-[15px] font-semibold tracking-[-0.01em]">
            How it works
          </h2>
          <div className="mt-8 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {HOW.map((h, i) => (
              <div key={h.title} className="min-w-0">
                <div className="font-mono text-[12px] text-subtle">0{i + 1}</div>
                <h3 className="mt-2 text-[14px] font-medium">{h.title}</h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{h.body}</p>
                <code className="mt-3 block truncate rounded-[6px] border border-line bg-surface px-2.5 py-1.5 font-mono text-[12px] text-muted">
                  {h.code}
                </code>
              </div>
            ))}
          </div>
        </section>

        {/* Works with */}
        <section aria-labelledby="with-title" className="border-t border-line py-12">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="with-title" className="text-[13px] text-muted">
              Works with
            </h2>
            <ul className="flex flex-wrap items-center gap-x-8 gap-y-2">
              {AGENTS.map((a) => (
                <li key={a} className="text-[17px] font-semibold tracking-[-0.02em] text-muted">
                  {a}
                </li>
              ))}
              <li className="text-[13px] text-subtle">Any MCP client, or REST with an API token</li>
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" aria-labelledby="faq-title" className="scroll-mt-16 border-t border-line py-16 sm:py-20">
          <div className="grid gap-8 sm:grid-cols-[1fr_2fr]">
            <h2 id="faq-title" className="text-[15px] font-semibold tracking-[-0.01em]">
              Questions
            </h2>
            <div className="divide-y divide-line border-y border-line">
              {FAQ.map((f) => (
                <details key={f.q} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[14px] font-medium [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span
                      aria-hidden
                      className="shrink-0 font-mono text-[14px] text-subtle transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="-mt-1 max-w-[560px] pb-4 text-[13.5px] leading-relaxed text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-line py-20 text-center sm:py-24">
          <h2 className="text-[24px] font-semibold tracking-[-0.025em] sm:text-[30px]">
            Stop losing test plans in chat.
          </h2>
          <p className="mx-auto mt-3 max-w-[440px] text-[14px] leading-relaxed text-muted">
            Create a project, connect your agent, and get your first plan from the next diff.
          </p>
          <div className="mt-7 flex justify-center gap-2">
            <Link href="/sign-up" className={`${btnPrimary} h-9 px-4`}>
              Get started
            </Link>
            <Link href="/sign-in" className={`${btnGhost} h-9 px-4`}>
              Sign in
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-2 px-4 py-6 text-[12px] text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>Sentinel · test plans for AI coding agents</span>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-fg"
          >
            <GitHubMark className="size-3.5" />
            aswin-codes/sentinel
          </a>
        </div>
      </footer>
    </div>
  );
}
