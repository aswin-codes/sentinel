import type { Metadata } from "next";
import { SettingsView } from "@/components/SettingsView";
import { listApiTokens } from "@/lib/auth";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const tokens = await listApiTokens(user.id);
  return <SettingsView user={user} tokens={tokens} />;
}
