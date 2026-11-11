import { AppNav } from "@/components/AppNav";
import { ToastProvider } from "@/components/Toast";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <ToastProvider>
      <div className="min-h-screen">
        <AppNav user={user} />
        <main className="mx-auto max-w-[1100px] px-4 pb-24 pt-10 sm:px-6">{children}</main>
      </div>
    </ToastProvider>
  );
}
