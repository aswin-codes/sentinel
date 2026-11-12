import Link from "next/link";

/** Sentinel mark: a shield with a visor slit — a guard keeping watch over what ships. */
export function LogoMark({ className = "size-[18px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 2.2 20 5.1v6.2c0 4.9-3.4 8.7-8 10.5-4.6-1.8-8-5.6-8-10.5V5.1Z" fill="var(--fg)" />
      <rect x="7.4" y="8.6" width="9.2" height="2.6" rx="1.3" fill="var(--bg)" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-[6px] text-[14px] font-semibold tracking-[-0.01em]"
    >
      <LogoMark />
      Sentinel
    </Link>
  );
}
