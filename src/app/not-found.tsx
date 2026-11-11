import Link from "next/link";
import { btnSecondary } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="grid min-h-[70vh] place-items-center px-4">
      <div className="text-center">
        <p className="font-mono text-[12px] text-subtle">404</p>
        <h1 className="mt-2 text-[20px] font-semibold tracking-[-0.015em]">Page not found</h1>
        <p className="mt-1.5 text-[13.5px] text-muted">It may have been deleted, or you don&apos;t have access.</p>
        <Link href="/projects" className={`${btnSecondary} mt-6`}>
          Back to projects
        </Link>
      </div>
    </main>
  );
}
