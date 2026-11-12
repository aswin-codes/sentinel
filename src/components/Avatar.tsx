import type { PublicUser } from "./types";

/** Round avatar: Clerk profile image when present, otherwise the name's initial. */
export function Avatar({ user, size = 28 }: { user: PublicUser; size?: number }) {
  const initial = (user.name || "U").trim().charAt(0).toUpperCase();
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-surface font-medium text-fg"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.43) }}
      aria-hidden
    >
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote Clerk avatar; no need for next/image config
        <img src={user.avatarUrl} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        initial
      )}
    </span>
  );
}

/** Email if the user has one, otherwise their phone number (phone-only Clerk accounts). */
export const contactOf = (user: PublicUser) => user.email ?? user.phone ?? null;
