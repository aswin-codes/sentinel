"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, errMsg } from "./api";
import { Avatar } from "./Avatar";
import { CopyButton } from "./CopyButton";
import { ConfirmModal } from "./Modal";
import { relativeTime } from "./time";
import { useToast } from "./Toast";
import type { ApiTokenInfo, CreatedToken, PublicUser } from "./types";
import { btnGhost, btnPrimary, btnSecondary, input, label } from "./ui";

export function SettingsView({ user, tokens: initialTokens }: { user: PublicUser; tokens: ApiTokenInfo[] }) {
  const toast = useToast();
  const router = useRouter();
  const clerk = useClerk();
  const { user: clerkUser } = useUser();

  // When the profile is edited in Clerk's modal, re-render the server page (which re-syncs our user row).
  const seenUpdate = useRef<number | null>(null);
  const updatedAt = clerkUser?.updatedAt?.getTime() ?? null;
  useEffect(() => {
    if (updatedAt === null) return;
    if (seenUpdate.current !== null && seenUpdate.current !== updatedAt) router.refresh();
    seenUpdate.current = updatedAt;
  }, [updatedAt, router]);

  const [tokens, setTokens] = useState(initialTokens);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedToken | null>(null);
  const [toRevoke, setToRevoke] = useState<ApiTokenInfo | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const t = await api<CreatedToken>("/api/tokens", { method: "POST", body: { name: name.trim() } });
      setCreated(t);
      setTokens((ts) => [{ id: t.id, name: t.name, prefix: t.prefix, createdAt: t.createdAt, lastUsedAt: null }, ...ts]);
      setName("");
    } catch (err) {
      setCreateError(errMsg(err));
    } finally {
      setCreating(false);
    }
  };

  const revoke = async () => {
    if (!toRevoke) return;
    await api(`/api/tokens/${toRevoke.id}`, { method: "DELETE" });
    setTokens((ts) => ts.filter((t) => t.id !== toRevoke.id));
    if (created?.id === toRevoke.id) setCreated(null);
    toast(`Revoked “${toRevoke.name}”`, "info");
    setToRevoke(null);
  };

  return (
    <>
      <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Settings</h1>

      <section className="mt-10 grid gap-6 border-t border-line pt-8 md:grid-cols-[240px_minmax(0,1fr)] md:gap-12">
        <div>
          <h2 className="text-[14px] font-medium">Profile</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">Sign-in methods, name and photo are managed by your account.</p>
        </div>
        <div className="max-w-[480px] rounded-[8px] border border-line">
          <div className="flex items-center gap-3 px-4 py-4">
            <Avatar user={user} size={40} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-medium">{user.name}</div>
              <div className="truncate text-[13px] text-muted">
                {[user.email, user.phone].filter(Boolean).join(" · ") || "No contact details"}
              </div>
            </div>
            <button type="button" onClick={() => clerk.openUserProfile()} className={`${btnSecondary} shrink-0`}>
              Manage account
            </button>
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-6 border-t border-line pt-8 md:grid-cols-[240px_minmax(0,1fr)] md:gap-12">
        <div>
          <h2 className="text-[14px] font-medium">API tokens</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            Coding agents use a token to reach QA Hub through MCP or the REST API. Tokens act as you.
          </p>
        </div>
        <div className="min-w-0 space-y-5">
          <form onSubmit={create} className="flex max-w-[480px] items-end gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor="token-name" className={label}>
                New token
              </label>
              <input
                id="token-name"
                className={input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Claude Code on laptop"
                maxLength={100}
              />
            </div>
            <button type="submit" disabled={creating || !name.trim()} className={`${btnPrimary} h-[34px]`}>
              {creating ? "Creating…" : "Create token"}
            </button>
          </form>
          {createError && <p className="text-[13px] text-fail">{createError}</p>}

          {created && (
            <div className="rounded-[8px] border border-line bg-surface p-4">
              <p className="text-[13px]">
                <span className="font-medium">Copy your new token now.</span>{" "}
                <span className="text-muted">You won&apos;t be able to see it again.</span>
              </p>
              <div className="mt-3 flex items-center gap-2">
                <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-[6px] border border-line bg-bg px-3 py-1.5 font-mono text-[12.5px]">
                  {created.token}
                </code>
                <CopyButton text={created.token} className="shrink-0" />
              </div>
              <button type="button" onClick={() => setCreated(null)} className={`${btnGhost} -ml-2 mt-2 h-7 px-2`}>
                Done
              </button>
            </div>
          )}

          {tokens.length === 0 ? (
            <p className="rounded-[8px] border border-line px-4 py-8 text-center text-[13px] text-muted">
              No tokens yet.
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-[8px] border border-line">
              {tokens.map((t) => (
                <li key={t.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium">{t.name}</div>
                    <div className="mt-0.5 flex flex-wrap gap-x-2 text-[12.5px] text-muted" suppressHydrationWarning>
                      <span className="font-mono text-subtle">{t.prefix}…</span>
                      <span>Created {relativeTime(t.createdAt)}</span>
                      <span className="text-subtle">·</span>
                      <span>{t.lastUsedAt ? `Last used ${relativeTime(t.lastUsedAt)}` : "Never used"}</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => setToRevoke(t)} className={`${btnGhost} h-7 px-2 hover:text-fail`}>
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <ConfirmModal
        open={!!toRevoke}
        onClose={() => setToRevoke(null)}
        title="Revoke token?"
        description={
          toRevoke ? `Agents using “${toRevoke.name}” will immediately lose access to QA Hub.` : undefined
        }
        confirmLabel="Revoke token"
        danger
        onConfirm={revoke}
      />
    </>
  );
}
