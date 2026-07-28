"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { AuthButton } from "@/components/auth/auth-button";
import { AuthTextField } from "@/components/auth/auth-text-field";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setIsSubmitting(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form className="mt-7 grid gap-3.5" onSubmit={handleSubmit} noValidate>
      <AuthTextField id="email" name="email" type="email" label="Email address" placeholder="you@totea.com" autoComplete="email" required />
      <AuthTextField id="password" name="password" type="password" label="Password" placeholder="Enter your password" autoComplete="current-password" required />
      {error ? (
        <p role="alert" className="rounded-xl border border-[#c98b26]/35 bg-(--accent-soft) px-3.5 py-3 text-sm leading-6 text-[#7a4d00]">
          {error}
        </p>
      ) : null}
      <AuthButton type="submit" disabled={isSubmitting}>{isSubmitting ? "Signing in..." : "Sign in"}</AuthButton>
    </form>
  );
}
