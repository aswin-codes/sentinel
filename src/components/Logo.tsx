import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-[6px] text-[14px] font-semibold tracking-[-0.01em]">
      <span aria-hidden className="grid size-[18px] place-items-center rounded-[5px] bg-fg">
        <svg viewBox="0 0 12 12" className="size-[10px] text-bg" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M2.5 6.2 5 8.5l4.5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      QA Hub
    </Link>
  );
}
