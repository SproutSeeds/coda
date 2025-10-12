"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { EmailSignInForm } from "./EmailSignInForm";
import { PasswordSignInForm } from "./PasswordSignInForm";

const modes = {
  magic: {
    title: "Magic link",
    description: "No password required.",
    toggleLabel: "Use password instead",
    form: <EmailSignInForm />,
  },
  password: {
    title: "Email & password",
    description: "After your first magic link, set a password in Account to sign in instantly.",
    toggleLabel: "Use magic link instead",
    form: <PasswordSignInForm />,
  },
} as const;

export function SignInSwitcher() {
  const [mode, setMode] = useState<keyof typeof modes>("magic");
  const current = modes[mode];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-medium text-white">{current.title}</h2>
          <p className="text-sm text-white/75">{current.description}</p>
        </div>
        <Button
          type="button"
          size="sm"
          className="cursor-pointer rounded-full border border-white/20 bg-slate-950/80 px-5 text-white shadow-sm transition hover:bg-slate-950 focus-visible:ring-white/40 focus-visible:ring-offset-0"
          onClick={() => setMode(mode === "magic" ? "password" : "magic")}
        >
          {current.toggleLabel}
        </Button>
      </div>
      <div>{current.form}</div>
    </div>
  );
}
