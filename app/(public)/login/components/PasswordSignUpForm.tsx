"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { registerWithPasswordAction, type PasswordSignUpState } from "../actions";
import { AUTH_INPUT_STYLE, AUTH_PRIMARY_BUTTON_STYLE } from "./EmailSignInForm";
import { ConsentNotice } from "./ConsentNotice";

const initialState: PasswordSignUpState = { status: "idle" };

type PasswordSignUpFormProps = {
  onSwitchToSignIn?: () => void;
};

export function PasswordSignUpForm({ onSwitchToSignIn }: PasswordSignUpFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hasConsented, setHasConsented] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [state, formAction, isPending] = useActionState(registerWithPasswordAction, initialState);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (password !== confirmPassword) {
      event.preventDefault();
      setLocalError("Passwords must match.");
      return;
    }
    setLocalError(null);
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setLocalError(null);
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setLocalError(null);
  };

  const handleConfirmChange = (value: string) => {
    setConfirmPassword(value);
    setLocalError(null);
  };

  const serverError = state.status === "error" ? state.message : null;
  const errorMessage = localError ?? serverError ?? null;
  const verificationEmail = state.status === "pending" ? state.email : null;
  const disableSubmit = isPending || !hasConsented || verificationEmail !== null;

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-3" noValidate>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="signup-email">
          Email address
        </label>
        <Input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(event) => handleEmailChange(event.target.value)}
          disabled={isPending}
          className={AUTH_INPUT_STYLE}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="signup-password">
          Password
        </label>
        <Input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          placeholder="At least 12 characters"
          value={password}
          onChange={(event) => handlePasswordChange(event.target.value)}
          disabled={isPending}
          className={AUTH_INPUT_STYLE}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="signup-confirm-password">
          Confirm password
        </label>
        <Input
          id="signup-confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChange={(event) => handleConfirmChange(event.target.value)}
          disabled={isPending}
          className={AUTH_INPUT_STYLE}
        />
      </div>
      <ConsentNotice checked={hasConsented} onChange={setHasConsented} />
      {errorMessage ? (
        <p className="text-xs text-white" data-testid="password-signup-error">
          {errorMessage}
          {serverError === "An account with this email already exists. Sign in instead." && onSwitchToSignIn ? (
            <button
              type="button"
              onClick={onSwitchToSignIn}
              className="ml-2 inline-flex cursor-pointer items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-white/80 transition hover:bg-white/10"
            >
              Sign in
            </button>
          ) : null}
        </p>
      ) : null}
      {verificationEmail ? (
        <p className="rounded-md border border-white/20 bg-white/[0.06] p-3 text-xs text-white/80" data-testid="password-signup-pending">
          We sent a verification link to <strong className="font-semibold text-white">{verificationEmail}</strong>. Confirm it within 24 hours to activate your password.
        </p>
      ) : null}
      <Button
        type="submit"
        className={cn(AUTH_PRIMARY_BUTTON_STYLE, "w-full")}
        disabled={disableSubmit}
      >
        {verificationEmail ? "Verification required" : isPending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
