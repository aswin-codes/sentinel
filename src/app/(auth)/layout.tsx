import { Logo } from "@/components/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex h-14 w-full max-w-[1100px] items-center px-4 sm:px-6">
        <Logo />
      </header>
      <main className="flex flex-1 justify-center px-4 pb-24 pt-[12vh]">{children}</main>
    </div>
  );
}
