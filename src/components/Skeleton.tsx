/** Quiet placeholder block. Pulses only when the user hasn't requested reduced motion. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`rounded-[6px] bg-line/60 motion-safe:animate-pulse ${className}`} />;
}

/** A stack of text-line placeholders; the last line is shorter. */
export function SkeletonLines({ lines = 2, className = "" }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={`h-3.5 ${i === lines - 1 && lines > 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}
