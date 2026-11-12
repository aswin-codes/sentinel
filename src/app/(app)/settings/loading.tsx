import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading settings">
      <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Settings</h1>

      <section className="mt-10 grid gap-6 border-t border-line pt-8 md:grid-cols-[240px_minmax(0,1fr)] md:gap-12">
        <div>
          <h2 className="text-[14px] font-medium">Profile</h2>
          <Skeleton className="mt-2 h-3.5 w-44" />
        </div>
        <div className="max-w-[480px] rounded-[8px] border border-line">
          <div className="flex items-center gap-3 px-4 py-4">
            <Skeleton className="size-10 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3.5 w-48 max-w-full" />
            </div>
            <Skeleton className="h-8 w-[130px]" />
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-6 border-t border-line pt-8 md:grid-cols-[240px_minmax(0,1fr)] md:gap-12">
        <div>
          <h2 className="text-[14px] font-medium">API tokens</h2>
          <Skeleton className="mt-2 h-3.5 w-52" />
        </div>
        <div className="min-w-0 space-y-5">
          <div className="flex max-w-[480px] items-end gap-2">
            <div className="min-w-0 flex-1">
              <Skeleton className="mb-1.5 h-3.5 w-20" />
              <Skeleton className="h-[34px] w-full" />
            </div>
            <Skeleton className="h-[34px] w-[112px]" />
          </div>
          <ul className="divide-y divide-line rounded-[8px] border border-line">
            {Array.from({ length: 2 }, (_, i) => (
              <li key={i} className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3.5 w-64 max-w-full" />
                </div>
                <Skeleton className="h-7 w-16" />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
