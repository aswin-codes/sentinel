import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading projects">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Projects</h1>
        <Skeleton className="h-8 w-[112px]" />
      </div>

      <div className="mt-8 overflow-hidden rounded-[8px] border border-line">
        <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4 lg:grid-cols-7 lg:divide-y-0">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="min-w-0 px-4 py-3">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="mt-1.5 h-5 w-10" />
            </div>
          ))}
        </div>
        <div className="border-t border-line bg-surface px-4 py-2.5">
          <Skeleton className="h-1.5 w-full" />
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-[8px] border border-line">
        <div className="hidden grid-cols-1 gap-6 border-b border-line bg-surface px-4 py-2 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,220px)_56px_120px_88px]">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="ml-auto h-3 w-8" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="ml-auto h-3 w-12" />
        </div>
        <ul className="divide-y divide-line">
          {Array.from({ length: 4 }, (_, i) => (
            <li
              key={i}
              className="grid gap-1 px-4 py-3.5 md:grid-cols-[minmax(0,1fr)_minmax(0,220px)_56px_120px_88px] md:items-center md:gap-6"
            >
              <div className="min-w-0 space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3.5 w-64 max-w-full" />
              </div>
              <Skeleton className="h-3.5 w-40 max-w-full" />
              <Skeleton className="h-3.5 w-6 md:ml-auto" />
              <Skeleton className="h-1.5 w-full md:mr-2" />
              <Skeleton className="hidden h-3.5 w-14 md:ml-auto md:block" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
