import type { Metadata } from "next";
import { SettingsView } from "@/components/SettingsView";
import { listApiTokens } from "@/lib/auth";
import { requireUser, syncCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  // Refresh the local copy of the Clerk profile so edits made in "Manage account" show up here.
  const user = (await syncCurrentUser()) ?? (await requireUser());
  const tokens = await listApiTokens(user.id);
  return <SettingsView user={user} tokens={tokens} />;
}
