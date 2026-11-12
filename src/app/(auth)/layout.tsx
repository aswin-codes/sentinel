import { Logo } from "@/components/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center px-4 pb-24 pt-[12vh]">
      <div className="mb-8">
        <Logo />
      </div>
      {children}
    </main>
  );
}
