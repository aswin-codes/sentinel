import { Loader2 } from "lucide-react";

/** Inline spinner for pending buttons. Inherits text color. */
export function Spinner({ className = "size-3.5" }: { className?: string }) {
  return <Loader2 className={`${className} shrink-0 animate-spin`} aria-hidden />;
}
