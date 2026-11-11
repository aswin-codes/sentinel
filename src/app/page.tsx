import { Suspense } from "react";
import AppShell from "@/components/AppShell";

// Server component: resolves the absolute app directory so the
// "Connect agent" modal can show copy-pasteable MCP configs.
export default function Page() {
  const appDir = process.cwd().replace(/\\/g, "/");
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <AppShell appDir={appDir} />
    </Suspense>
  );
}
