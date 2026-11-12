import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";

export const metadata: Metadata = { title: "Sign up" };

export default function SignUpPage() {
  return <SignUp path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/projects" />;
}
