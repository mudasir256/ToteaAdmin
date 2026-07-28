import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in | ToTea Dashboard",
};

export default function LoginPage() {
  return (
    <AuthShell>
      <div className="w-full">
        <p className="text-sm font-medium text-(--accent)">ToTea dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Sign in to your workspace.
        </h1>
        <p className="mt-3 max-w-sm text-[15px] leading-6 text-(--muted)">
          Orders, menu, and daily operations in one focused place.
        </p>
        <LoginForm />
      </div>
    </AuthShell>
  );
}
