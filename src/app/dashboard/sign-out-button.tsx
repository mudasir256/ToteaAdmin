"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isSigningOut}
      className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-xl border border-(--line) px-4 text-sm font-semibold text-(--muted) transition hover:border-(--accent) hover:text-(--accent-strong) active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isSigningOut ? "Signing out..." : "Sign out"}
    </button>
  );
}
