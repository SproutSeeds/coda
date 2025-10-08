"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { EmailSignInForm } from "./EmailSignInForm";
import { PasswordSignInForm } from "./PasswordSignInForm";

const modes = {
  magic: {
    title: "Magic link",
    description: "We’ll send a one-time link—no password required.",
    toggleLabel: "Use password instead",
    form: <EmailSignInForm />,
  },
  password: {
    title: "Email & password",
    description: "Sign in with the password you’ve set for Coda.",
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
          <h2 className="text-lg font-medium text-foreground">{current.title}</h2>
          <p className="text-sm text-muted-foreground">{current.description}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setMode(mode === "magic" ? "password" : "magic")}
        >
          {current.toggleLabel}
        </Button>
      </div>
      <div>{current.form}</div>
    </div>
  );
}
