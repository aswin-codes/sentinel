"use client";

import Link from "next/link";
import { useState, type CSSProperties, type ReactNode } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { GitHubMark, REPO_URL } from "../landing/GitHubStar";

/* Dark tokens scoped to the preview frame so the product renders legibly on black. */
const DARK_TOKENS = {
  "--bg": "#0a0a0a",
  "--surface": "#111111",
  "--line": "#222222",
  "--fg": "#ededed",
  "--muted": "#8f8f8f",
  "--subtle": "#5c5c5c",
  "--pass": "#10b981",
  "--fail": "#f43f5e",
  colorScheme: "dark",
} as CSSProperties;

type ButtonProps = {
  children: ReactNode;
  variant?: "default" | "ghost" | "gradient";
  size?: "default" | "sm";
  className?: string;
  onClick?: () => void;
  href?: string;
};

function Button({ children, variant = "default", size = "default", className = "", href, onClick }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40";
  const variants = {
    default: "bg-white text-black hover:bg-white/90",
    ghost: "text-white/70 hover:bg-white/10 hover:text-white",
    gradient:
      "bg-gradient-to-b from-white via-white/95 to-white/60 text-black hover:scale-[1.02] hover:to-white/80 active:scale-[0.99]",
  };
  const sizes = { default: "h-10 px-5 text-[14px]", sm: "h-8 px-3 text-[13px]" };
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick}>
      {children}
    </button>
  );
}

const NAV_LINKS = [
  { label: "How it works", href: "#how" },
  { label: "Demo", href: "#demo" },
  { label: "FAQ", href: "#faq" },
];

function Navigation({ stars }: { stars?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const linkCls = "text-[13.5px] text-white/60 transition-colors hover:text-white";

  return (
    <header className="sst-slide-down fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur-md">
      <nav className="mx-auto flex h-14 w-full max-w-[1100px] items-center justify-between px-4 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2 text-[14px] font-semibold tracking-[-0.01em] text-white">
          <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden>
            <path d="M12 2.2 20 5.1v6.2c0 4.9-3.4 8.7-8 10.5-4.6-1.8-8-5.6-8-10.5V5.1Z" fill="#fff" />
            <rect x="7.4" y="8.6" width="9.2" height="2.6" rx="1.3" fill="#000" />
          </svg>
          Sentinel
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className={linkCls}>
              {l.label}
            </a>
          ))}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={`${linkCls} inline-flex items-center gap-1.5`}>
            <GitHubMark className="size-3.5" />
            GitHub
          </a>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {stars}
          <Button variant="ghost" size="sm" href="/sign-in">
            Sign in
          </Button>
          <Button variant="default" size="sm" href="/sign-up">
            Sign up
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded-md text-white/80 hover:bg-white/10 md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-white/10 bg-black/95 px-4 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-2 text-[14px] text-white/70 hover:bg-white/10 hover:text-white"
              >
                {l.label}
              </a>
            ))}
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md px-2 py-2 text-[14px] text-white/70 hover:bg-white/10 hover:text-white"
            >
              <GitHubMark className="size-4" />
              GitHub
            </a>
            <div className="mt-3 flex gap-2 border-t border-white/10 pt-4">
              <Button variant="ghost" className="flex-1" href="/sign-in" onClick={() => setOpen(false)}>
                Sign in
              </Button>
              <Button variant="default" className="flex-1" href="/sign-up" onClick={() => setOpen(false)}>
                Sign up
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function Hero({ preview }: { preview?: ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-black px-4 pt-32 sm:px-6 sm:pt-40">
      {/* soft top glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[900px] -translate-x-1/2 opacity-60"
        style={{ background: "radial-gradient(closest-side, rgba(255,255,255,0.10), transparent)" }}
      />

      <div className="relative mx-auto max-w-[1100px] text-center">
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="sst-fade-in mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[12.5px] text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden />
          Hosted MCP is live: connect any agent
          <ArrowRight className="size-3.5" aria-hidden />
        </a>

        <h1
          className="sst-fade-in mx-auto max-w-[820px] bg-gradient-to-b from-white via-white/90 to-white/40 bg-clip-text pb-2 text-[38px] font-semibold leading-[1.08] tracking-[-0.035em] text-transparent sm:text-[60px]"
          style={{ animationDelay: "0.1s" }}
        >
          Your agent writes the test plan. You run it as a checklist.
        </h1>

        <p
          className="sst-fade-in mx-auto mt-6 max-w-[600px] text-[16px] leading-relaxed text-white/60 sm:text-[17px]"
          style={{ animationDelay: "0.2s" }}
        >
          Claude Code, Cursor, Copilot, Windsurf and more draft sections, steps and expected results from your diff over
          MCP. You mark each case Pass or Fail, and the failures go straight back to the agent.
        </p>

        <div
          className="sst-fade-in mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          style={{ animationDelay: "0.3s" }}
        >
          <Button variant="gradient" href="/sign-up" className="h-11 px-7 text-[15px]">
            Get started
            <ArrowRight className="size-4" aria-hidden />
          </Button>
          <a
            href="#demo"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/15 px-6 text-[14px] text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            See it in action
          </a>
        </div>
        <p className="sst-fade-in mt-4 text-[12.5px] text-white/40" style={{ animationDelay: "0.35s" }}>
          Free and open source, self-hosted on your own Postgres
        </p>
      </div>

      {/* Product preview */}
      <div
        id="demo"
        className="sst-fade-in relative mx-auto mt-14 max-w-[1100px] scroll-mt-20 sm:mt-20"
        style={{ animationDelay: "0.45s" }}
      >
        <div className="relative overflow-hidden rounded-t-xl border border-b-0 border-white/15 bg-[#0a0a0a]">
          <div className="flex h-9 items-center gap-1.5 border-b border-white/10 bg-[#111] px-3.5">
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="ml-3 truncate rounded-md bg-white/5 px-3 py-0.5 font-mono text-[11px] text-white/40">
              sentinel / live demo
            </span>
          </div>
          <div style={DARK_TOKENS} className="bg-bg p-3 text-fg sm:p-5">
            {preview}
          </div>
        </div>
        {/* fade into page background */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-bg"
        />
      </div>
    </section>
  );
}

/**
 * Landing hero + nav. `preview` is the live product demo (passed from the server page),
 * `stars` an optional GitHub star badge shown in the nav.
 */
export default function SaaSTemplate({ preview, stars }: { preview?: ReactNode; stars?: ReactNode }) {
  return (
    <>
      <style>{`
        @keyframes sstFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes sstSlideDown { from { opacity: 0; transform: translateY(-100%); } to { opacity: 1; transform: translateY(0); } }
        .sst-fade-in { opacity: 0; animation: sstFadeIn 0.8s ease-out forwards; }
        .sst-slide-down { animation: sstSlideDown 0.6s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .sst-fade-in { opacity: 1; animation: none; }
          .sst-slide-down { animation: none; }
        }
      `}</style>
      <Navigation stars={stars} />
      <Hero preview={preview} />
    </>
  );
}

export { Button, Navigation, Hero };
