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
          <h2 className="text-lg font-medium text-foreground">{current.title}</h2>
          <p className="text-sm text-muted-foreground">{current.description}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer border-border text-foreground hover:bg-transparent hover:text-foreground focus-visible:bg-transparent focus-visible:ring-0"
          onClick={() => setMode(mode === "magic" ? "password" : "magic")}
        >
          {current.toggleLabel}
        </Button>
      </div>
      <div>{current.form}</div>
    </div>
  );
}
