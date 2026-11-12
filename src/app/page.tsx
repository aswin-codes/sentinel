import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDown } from "lucide-react";
import { Logo } from "@/components/Logo";
import { btnGhost, btnPrimary, btnSecondary } from "@/components/ui";
import { LiveDemo } from "@/components/landing/LiveDemo";
import { getCurrentUser } from "@/lib/session";

const HOW = [
  {
    title: "Connect your agent over MCP",
    body: "Create an API token, paste one config block into Claude Code, Cursor or Antigravity.",
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
    a: "Anything that speaks MCP: Claude Code, Cursor, Antigravity and other MCP clients. There is also a plain REST API that takes the same token.",
  },
  {
    q: "Do I need to write tests?",
    a: "No. The agent drafts the plan from your changes. You run it by hand, the way a QA person would, and only write a note when something fails.",
  },
];

const AGENTS = ["Claude Code", "Cursor", "Antigravity"];

export default async function Home() {
  if (await getCurrentUser()) redirect("/projects");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex h-14 w-full max-w-[1100px] items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1">
          <Link href="/sign-in" className={btnGhost}>
            Sign in
          </Link>
          <Link href="/sign-up" className={btnPrimary}>
            Get started
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 sm:px-6">
        {/* Hero */}
        <section className="max-w-[700px] pb-14 pt-20 sm:pb-16 sm:pt-28">
          <h1 className="text-[34px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[48px]">
            Your agent writes the feature. Sentinel checks it works.
          </h1>
          <p className="mt-5 max-w-[560px] text-[15.5px] leading-relaxed text-muted">
            Coding agents leave test checklists in chat and stray markdown files. Sentinel gives them a home: the agent
            writes a test plan from your diff, you run it as a Pass/Fail checklist, and the failures go straight back
            to the agent to fix.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <Link href="/sign-up" className={`${btnPrimary} h-9 px-4`}>
              Get started
            </Link>
            <a href="#demo" className={`${btnSecondary} h-9 px-4`}>
              See it in action
              <ArrowDown className="size-3.5" aria-hidden />
            </a>
          </div>
          <p className="mt-4 text-[12.5px] text-subtle">Free and open source · self-hosted on your own Postgres</p>
        </section>

        {/* Live demo */}
        <section id="demo" aria-labelledby="demo-title" className="scroll-mt-6 pb-20 sm:pb-24">
          <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="demo-title" className="text-[15px] font-semibold tracking-[-0.01em]">
                The loop, start to finish
              </h2>
              <p className="mt-1 text-[13.5px] text-muted">A live demo. Nothing here is a recording — click around.</p>
            </div>
          </div>
          <LiveDemo />
        </section>

        {/* How it works */}
        <section aria-labelledby="how-title" className="border-t border-line py-16 sm:py-20">
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
        <section aria-labelledby="faq-title" className="border-t border-line py-16 sm:py-20">
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
          <span>Free, open source, self-hosted</span>
        </div>
      </footer>
    </div>
  );
}
