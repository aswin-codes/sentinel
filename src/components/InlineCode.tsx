import { Fragment } from "react";

/**
 * Renders text where `backticked` spans become inline mono code chips.
 * Plain React text nodes only — no HTML injection.
 */
export function RichText({ text }: { text: string }) {
  const parts = text.split("`");
  const unbalanced = parts.length % 2 === 0;
  return (
    <>
      {parts.map((part, i) => {
        const isCode = i % 2 === 1 && !(unbalanced && i === parts.length - 1);
        if (isCode) {
          if (!part) return null;
          return <InlineCode key={i}>{part}</InlineCode>;
        }
        return <Fragment key={i}>{i % 2 === 1 ? "`" + part : part}</Fragment>;
      })}
    </>
  );
}

export function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-[4px] border border-line bg-surface-2 px-[5px] py-px font-mono text-[0.86em] text-fg/90 [overflow-wrap:anywhere]">
      {children}
    </code>
  );
}
