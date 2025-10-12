"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { AUTH_INPUT_STYLE } from "./EmailSignInForm";

export function DevLoginForm() {
  const router = useRouter();
  const [token, setToken] = useState("owner-token");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await signIn("credentials", {
      token,
      callbackUrl: "/dashboard/ideas",
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid owner token");
      setIsSubmitting(false);
      return;
    }

    router.push(result?.url ?? "/dashboard/ideas");
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-3">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase text-white/70">Developer shortcut</p>
        <Input
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="owner-token"
          required
          autoComplete="off"
          className={AUTH_INPUT_STYLE}
        />
        <p className="text-xs text-white/70">
          Available only in development for Playwright and local testing.
        </p>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
      <Button
        type="submit"
        className="cursor-pointer w-full border border-white/12 bg-slate-950/90 text-white shadow-lg transition hover:bg-slate-950 focus-visible:ring-white/40 focus-visible:ring-offset-0"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Signing in…" : "Use owner token"}
      </Button>
    </form>
  );
}
