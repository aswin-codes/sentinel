const TAG_STYLES: Record<string, string> = {
  amber: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  violet: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  sky: "bg-sky-500/10 text-sky-300 border-sky-500/20",
  emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  rose: "bg-rose-500/10 text-rose-300 border-rose-500/20",
  zinc: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
};

export function tagClass(color: string | undefined) {
  return TAG_STYLES[(color ?? "").toLowerCase()] ?? TAG_STYLES.zinc;
}

export function Tag({ label, color }: { label: string; color?: string }) {
  return (
    <span
      className={`inline-flex h-[22px] items-center whitespace-nowrap rounded-full border px-2 text-[11.5px] font-medium leading-none ${tagClass(color)}`}
    >
      {label}
    </span>
  );
}
