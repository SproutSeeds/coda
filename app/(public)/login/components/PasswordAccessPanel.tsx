"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import { PasswordSignInForm } from "./PasswordSignInForm";
import { PasswordSignUpForm } from "./PasswordSignUpForm";

type View = "sign-in" | "sign-up";

export function PasswordAccessPanel() {
  const [view, setView] = useState<View>("sign-in");

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-full border border-white/15 bg-white/[0.06] p-1 text-xs font-semibold uppercase tracking-wide text-white/70">
        <button
          type="button"
          onClick={() => setView("sign-in")}
          className={cn(
            "cursor-pointer rounded-full px-4 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-0",
            view === "sign-in"
              ? "bg-white text-slate-950 shadow-[0_12px_24px_rgba(15,23,42,0.25)]"
              : "text-white/75 hover:text-white",
          )}
          aria-pressed={view === "sign-in"}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setView("sign-up")}
          className={cn(
            "cursor-pointer rounded-full px-4 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-0",
            view === "sign-up"
              ? "bg-white text-slate-950 shadow-[0_12px_24px_rgba(15,23,42,0.25)]"
              : "text-white/75 hover:text-white",
          )}
          aria-pressed={view === "sign-up"}
        >
          Create account
        </button>
      </div>

      {view === "sign-in" ? <PasswordSignInForm /> : <PasswordSignUpForm onSwitchToSignIn={() => setView("sign-in")} />}

      <p className="text-xs text-white/70">
        {view === "sign-in" ? (
          <>
            Need an account?{" "}
            <button
              type="button"
              onClick={() => setView("sign-up")}
              className="cursor-pointer font-medium text-white transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Create one with a password
            </button>
            .
          </>
        ) : (
          <>
            Already have a password?{" "}
            <button
              type="button"
              onClick={() => setView("sign-in")}
              className="cursor-pointer font-medium text-white transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Sign in
            </button>
            .
          </>
        )}
      </p>
    </div>
  );
}
