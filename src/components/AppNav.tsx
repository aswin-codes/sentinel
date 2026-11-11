"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api, errMsg } from "./api";
import { Logo } from "./Logo";
import { Menu } from "./Menu";
import { useToast } from "./Toast";
import type { PublicUser } from "./types";

const LINKS = [
  { href: "/projects", label: "Projects" },
  { href: "/settings", label: "Settings" },
];

export function AppNav({ user }: { user: PublicUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();

  const logout = async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (e) {
      toast(`Couldn't log out: ${errMsg(e)}`);
    }
  };

  const initial = (user.name || user.email).trim().charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-[1100px] items-center gap-6 px-4 sm:px-6">
        <Logo href="/projects" />
        <nav className="flex items-center gap-1" aria-label="Main">
          {LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-[6px] px-2.5 py-1.5 text-[13px] transition-colors ${
                  active ? "text-fg" : "text-muted hover:text-fg"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto">
          <Menu
            ariaLabel="Account menu"
            triggerClassName="grid size-7 place-items-center rounded-full border border-line bg-surface text-[12px] font-medium text-fg transition-colors hover:border-fg/30"
            trigger={initial}
            header={
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">{user.name}</div>
                <div className="truncate text-[12px] text-muted">{user.email}</div>
              </div>
            }
            items={[
              { key: "settings", label: "Settings", onSelect: () => router.push("/settings") },
              { key: "logout", label: "Log out", onSelect: logout },
            ]}
          />
        </div>
      </div>
    </header>
  );
}
