"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, api, errMsg, type FieldErrors } from "./api";
import { btnPrimary, input, label } from "./ui";
import { safeNext } from "./url";

type Mode = "login" | "signup";

export function AuthForm({ mode, next }: { mode: Mode; next?: string }) {
  const router = useRouter();
  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    if (fieldErrors[k]) setFieldErrors((f) => ({ ...f, [k]: "" }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const body =
        mode === "signup"
          ? { name: values.name, email: values.email, password: values.password }
          : { email: values.email, password: values.password };
      await api(`/api/auth/${mode}`, { method: "POST", body });
      router.push(safeNext(next));
      router.refresh();
    } catch (err) {
      const fe = err instanceof ApiError ? err.fieldErrors : {};
      if (Object.keys(fe).length) setFieldErrors(fe);
      else setError(errMsg(err));
      setBusy(false);
    }
  };

  const isSignup = mode === "signup";
  const otherHref = `${isSignup ? "/login" : "/signup"}${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <div className="w-full max-w-[360px]">
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
        {isSignup ? "Create your account" : "Log in to QA Hub"}
      </h1>
      <p className="mt-1.5 text-[13.5px] text-muted">
        {isSignup ? "Start with an empty workspace." : "Welcome back."}
      </p>

      <form onSubmit={submit} noValidate className="mt-8 space-y-4">
        {isSignup && (
          <Field id="name" label="Name" error={fieldErrors.name}>
            <input
              id="name"
              className={input}
              value={values.name}
              onChange={set("name")}
              autoComplete="name"
              aria-invalid={!!fieldErrors.name}
              required
            />
          </Field>
        )}
        <Field id="email" label="Email" error={fieldErrors.email}>
          <input
            id="email"
            type="email"
            className={input}
            value={values.email}
            onChange={set("email")}
            autoComplete="email"
            aria-invalid={!!fieldErrors.email}
            required
          />
        </Field>
        <Field
          id="password"
          label="Password"
          error={fieldErrors.password}
          hint={isSignup ? "At least 8 characters." : undefined}
        >
          <input
            id="password"
            type="password"
            className={input}
            value={values.password}
            onChange={set("password")}
            autoComplete={isSignup ? "new-password" : "current-password"}
            aria-invalid={!!fieldErrors.password}
            required
          />
        </Field>

        {error && (
          <p role="alert" className="text-[13px] text-fail">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className={`${btnPrimary} h-9 w-full`}>
          {busy ? (isSignup ? "Creating account…" : "Logging in…") : isSignup ? "Create account" : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-[13px] text-muted">
        {isSignup ? "Already have an account? " : "New to QA Hub? "}
        <Link href={otherHref} className="font-medium text-fg underline-offset-4 hover:underline">
          {isSignup ? "Log in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}

function Field({
  id,
  label: text,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={label}>
        {text}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-[12.5px] text-fail">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[12.5px] text-subtle">{hint}</p>
      ) : null}
    </div>
  );
}
