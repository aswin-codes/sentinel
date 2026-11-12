import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading project">
      <div className="flex items-center gap-1.5 text-[13px] text-muted">
        <span>Projects</span>
        <span className="text-subtle">/</span>
        <Skeleton className="h-3.5 w-28" />
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="mt-2.5 h-3.5 w-80 max-w-full" />
          <Skeleton className="mt-3.5 h-3.5 w-64 max-w-full" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="h-8 w-[126px]" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>

      <div className="mt-10 flex items-center gap-1 border-b border-line pb-2">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-7 w-14" />
      </div>

      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-[8px] border border-line">
        {Array.from({ length: 4 }, (_, i) => (
          <li
            key={i}
            className="grid gap-2 py-3.5 pl-4 pr-14 sm:grid-cols-[minmax(0,1fr)_150px_88px] sm:items-center sm:gap-6"
          >
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-52 max-w-full" />
              <Skeleton className="h-3.5 w-32" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-1.5 w-[90px]" />
              <Skeleton className="h-3.5 w-8" />
            </div>
            <Skeleton className="h-3.5 w-12 sm:ml-auto" />
          </li>
        ))}
      </ul>
    </div>
  );
}
