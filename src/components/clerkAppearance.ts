/**
 * Clerk appearance that follows our design tokens (globals.css). Because the values are CSS variables,
 * Clerk's components switch between light and dark with `prefers-color-scheme` like the rest of the app.
 */
const LINE = "var(--line)";
const FOCUS = "color-mix(in oklab, var(--fg) 40%, transparent)";
const RING = "color-mix(in oklab, var(--fg) 10%, transparent)";

export const clerkAppearance = {
  variables: {
    colorPrimary: "var(--fg)",
    colorPrimaryForeground: "var(--bg)",
    colorForeground: "var(--fg)",
    colorMutedForeground: "var(--muted)",
    colorMuted: "var(--surface)",
    colorBackground: "var(--bg)",
    colorInput: "var(--bg)",
    colorInputForeground: "var(--fg)",
    colorNeutral: "var(--fg)",
    colorBorder: "var(--line)",
    colorShadow: "transparent",
    colorRing: RING,
    colorDanger: "var(--fail)",
    colorSuccess: "var(--pass)",
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
    fontSize: "14px",
    borderRadius: "6px",
  },
  elements: {
    cardBox: { boxShadow: "none", border: "1px solid var(--line)", borderRadius: "8px" },
    card: { boxShadow: "none" },
    footer: { background: "var(--surface)" },
    // `&&` doubles the selector so these win over Clerk's built-in (shadow-based) borders.
    socialButtonsBlockButton: { "&&": { boxShadow: `0 0 0 1px ${LINE}` } },
    formFieldInput: {
      "&&": { boxShadow: `0 0 0 1px ${LINE}` },
      "&&:focus": { boxShadow: `0 0 0 1px ${FOCUS}, 0 0 0 4px ${RING}` },
    },
    formButtonPrimary: { "&&&": { backgroundImage: "none", boxShadow: "none" } },
    userButtonPopoverCard: { boxShadow: "none", border: "1px solid var(--line)" },
  },
};
