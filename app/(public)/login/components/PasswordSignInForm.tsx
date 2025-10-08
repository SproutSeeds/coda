"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PasswordSignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      setError(null);
      try {
        const result = await signIn("password", {
          email,
          password,
          redirect: false,
          callbackUrl: "/dashboard/ideas",
        });
        if (result?.error) {
          if (result.error === "CredentialsSignin") {
            throw new Error("Invalid email or password. If you haven't set a password yet, request a magic link instead.");
          }
          throw new Error("Unable to sign in with password.");
        }
        if (result?.ok && result.url) {
          router.push(result.url);
          return;
        }
        if (result === undefined || result === null) {
          // Credentials providers sometimes redirect directly; as a fallback refresh the page.
          router.refresh();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to sign in with password.";
        setError(message);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="password-email">
          Email address
        </label>
        <Input
          id="password-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isPending}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="password-password">
          Password
        </label>
        <Input
          id="password-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isPending}
        />
      </div>
      {error ? (
        <p className="text-xs text-destructive" data-testid="password-error">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Signing in…" : "Sign in with password"}
      </Button>
    </form>
  );
}
