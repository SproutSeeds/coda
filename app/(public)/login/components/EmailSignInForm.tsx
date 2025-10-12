"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Status = "idle" | "pending" | "sent" | "error";
const RATE_LIMIT_WINDOW_MS = 30_000;

export const AUTH_INPUT_STYLE =
  "border-white/20 bg-white/[0.02] text-slate-100 placeholder:text-slate-200/60 backdrop-blur-lg focus-visible:border-white/35 focus-visible:ring-white/30 focus:bg-white/[0.02] focus:text-slate-100";

export function EmailSignInForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [lastRequest, setLastRequest] = useState<{ email: string; at: number } | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const now = Date.now();
    const normalizedEmail = email.trim().toLowerCase();
    if (lastRequest && lastRequest.email === normalizedEmail && now - lastRequest.at < RATE_LIMIT_WINDOW_MS) {
      setError("Too many requests. Please try again shortly.");
      setStatus("error");
      return;
    }

    setLastRequest({ email: normalizedEmail, at: now });
    setStatus("pending");
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
        setStatus("error");
      }
    });
  };

  const statusText =
    status === "pending"
      ? "Sending magic link…"
      : status === "sent"
        ? "Check your inbox for the sign-in link."
        : "";

  return (
    <form onSubmit={handleSubmit} className="space-y-3" data-testid="magic-link-form">
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="email">
          Email address
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
            className={`${AUTH_INPUT_STYLE} sm:flex-1`}
          />
          <Button
            type="submit"
            className="cursor-pointer w-full border border-white/12 bg-slate-950/90 text-white shadow-lg transition hover:bg-slate-950 focus-visible:ring-white/40 focus-visible:ring-offset-0 sm:w-auto sm:min-w-[200px]"
            disabled={isPending}
          >
            {isPending ? "Sending…" : "Email me a sign-in link"}
          </Button>
        </div>
      </div>
      {error ? (
        <p data-testid="magic-link-error" className="text-xs text-white">
          {error}
        </p>
      ) : null}
      <p
        data-testid="magic-link-status"
        aria-live="polite"
        className={
          status === "pending"
            ? "text-xs text-white transition-opacity duration-150"
            : status === "sent"
              ? "text-xs text-emerald-300 transition-opacity duration-150"
              : "sr-only"
        }
      >
        {statusText}
      </p>
    </form>
  );
}
