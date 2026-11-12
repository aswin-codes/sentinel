import { redirect } from "next/navigation";

/** Legacy route — sign-in is handled by Clerk at /sign-in. */
export default function LoginRedirect() {
  redirect("/sign-in");
}
