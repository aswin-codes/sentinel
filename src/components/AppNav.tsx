"use client";

import { useClerk } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { errMsg } from "./api";
import { Avatar, contactOf } from "./Avatar";
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
  const clerk = useClerk();
  const contact = contactOf(user);

  const signOut = async () => {
    try {
      await clerk.signOut({ redirectUrl: "/" });
    } catch (e) {
      toast(`Couldn't sign out: ${errMsg(e)}`);
    }
  };

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
            triggerClassName="rounded-full transition-opacity hover:opacity-80"
            trigger={<Avatar user={user} />}
            header={
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">{user.name}</div>
                {contact && <div className="truncate text-[12px] text-muted">{contact}</div>}
              </div>
            }
            items={[
              { key: "settings", label: "Settings", onSelect: () => router.push("/settings") },
              { key: "account", label: "Manage account", onSelect: () => clerk.openUserProfile() },
              { key: "signout", label: "Sign out", onSelect: signOut },
            ]}
          />
        </div>
      </div>
    </header>
  );
}
