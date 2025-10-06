"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function EmailSignInForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      setError(null);
      try {
        const result = await signIn("email", {
          email,
          redirect: false,
          callbackUrl: "/dashboard/ideas",
        });
        if (result?.error) {
          const friendly: Record<string, string> = {
            EmailSignin: "Too many requests. Please try again shortly.",
            Verification: "The verification link was invalid or expired. Request a new email.",
          };
          throw new Error(friendly[result.error] ?? "Unable to send magic link.");
        }
        setStatus("sent");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to send magic link.";
        setError(message);
        setStatus("idle");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="email">
          Email address
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">We’ll email a link that expires in 10 minutes.</p>
      </div>
      {error ? (
        <p data-testid="magic-link-error" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {status === "sent" ? (
        <p className="text-xs text-green-600">Check your inbox for the sign-in link.</p>
      ) : null}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
