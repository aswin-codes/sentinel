import { Skeleton, SkeletonLines } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading test plan">
      <div className="flex items-center gap-1.5 text-[13px] text-muted">
        <span>Projects</span>
        <span className="text-subtle">/</span>
        <Skeleton className="h-3.5 w-24" />
        <span className="text-subtle">/</span>
        <Skeleton className="h-3.5 w-32" />
      </div>

      <header className="mt-4">
        <Skeleton className="h-7 w-80 max-w-full" />
        <SkeletonLines lines={2} className="mt-3 max-w-[720px]" />
        <Skeleton className="mt-3 h-3.5 w-56" />
      </header>

      <div className="-mx-4 mt-6 border-y border-line px-4 py-2.5 sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-1.5 w-20" />
          </div>
          <div className="flex items-center gap-1">
            <Skeleton className="h-7 w-10" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-7 w-14" />
          </div>
          <div className="flex items-center gap-1 sm:ml-auto">
            <Skeleton className="h-7 w-[120px]" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-7 w-20" />
          </div>
        </div>
      </div>

      <div className="mt-8 flex gap-12">
        <div className="hidden w-[200px] shrink-0 space-y-2.5 lg:block">
          <Skeleton className="h-3 w-16" />
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
        <div className="min-w-0 flex-1 space-y-12">
          {Array.from({ length: 2 }, (_, s) => (
            <section key={s}>
              <Skeleton className="mb-4 h-5 w-64 max-w-full" />
              <div className="space-y-3">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="rounded-[8px] border border-line p-4">
                    <div className="flex items-start gap-3">
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-7 w-[120px]" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
