import { redirect } from "next/navigation";

/** Legacy route — sign-up is handled by Clerk at /sign-up. */
export default function SignupRedirect() {
  redirect("/sign-up");
}
