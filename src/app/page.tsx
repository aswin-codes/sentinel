import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { btnGhost, btnPrimary, btnSecondary } from "@/components/ui";
import { getCurrentUser } from "@/lib/session";

const FEATURES = [
  { title: "Agents write the plan", body: "Claude Code, Cursor or Antigravity read your diff over MCP and draft the test plan." },
  { title: "You run the checklist", body: "Every case has steps and expected results. Mark it Pass or Fail." },
  { title: "Failures go back", body: "Hand failed cases and your notes back to the agent to fix." },
];

export default async function Home() {
  if (await getCurrentUser()) redirect("/projects");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex h-14 w-full max-w-[1100px] items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1">
          <Link href="/login" className={btnGhost}>
            Log in
          </Link>
          <Link href="/signup" className={btnSecondary}>
            Sign up
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 sm:px-6">
        <section className="max-w-[640px] pb-20 pt-24 sm:pt-32">
          <h1 className="text-[32px] font-semibold leading-[1.15] tracking-[-0.025em] sm:text-[44px]">
            Test plans your coding agent writes, and you check off.
          </h1>
          <p className="mt-5 max-w-[520px] text-[15px] leading-relaxed text-muted">
            QA Hub turns your recent changes into a manual QA checklist. Run it, mark what broke, and send the
            failures straight back to the agent.
          </p>
          <div className="mt-8 flex items-center gap-2">
            <Link href="/signup" className={`${btnPrimary} h-9 px-4`}>
              Get started
            </Link>
            <Link href="/login" className={`${btnGhost} h-9 px-4`}>
              Log in
            </Link>
          </div>
        </section>

        <section className="grid gap-8 border-t border-line py-12 sm:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div key={f.title}>
              <div className="font-mono text-[12px] text-subtle">0{i + 1}</div>
              <h2 className="mt-2 text-[14px] font-medium">{f.title}</h2>
              <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="mx-auto w-full max-w-[1100px] px-4 py-8 text-[12px] text-subtle sm:px-6">
        Self-hosted QA Hub
      </footer>
    </div>
  );
}
