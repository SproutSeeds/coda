"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { submitMeetupCheckIn } from "../actions";

type Status =
  | { variant: "idle" }
  | { variant: "success"; message: string }
  | { variant: "already"; message: string }
  | { variant: "error"; message: string };

export function CheckInForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ variant: "idle" });
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const normalizedEmail = email.trim().toLowerCase();
    formData.set("email", normalizedEmail);

    startTransition(async () => {
      setFieldError(undefined);
      setStatus({ variant: "idle" });

      const result = await submitMeetupCheckIn(formData);

      if (!result.success) {
        setStatus({ variant: "error", message: result.message });
        if (result.fieldErrors?.email) {
          setFieldError(result.fieldErrors.email);
        }
        return;
      }

      try {
        const magic = await signIn("email", {
          email: normalizedEmail,
          redirect: false,
          callbackUrl: "/dashboard/ideas",
        });

        if (magic?.error) {
          const friendly: Record<string, string> = {
            EmailSignin: "Too many check-in requests. Try again in a moment.",
            Verification: "The previous sign-in link expired. Request a fresh link from the login page.",
          };
          setStatus({
            variant: "error",
            message:
              friendly[magic.error] ??
              "Check-in recorded, but we couldn't send the magic link. Request a new one from the login page.",
          });
          return;
        }

        const nextVariant = result.state === "already" ? "already" : "success";
        setStatus({ variant: nextVariant, message: result.message });
        setEmail("");
      } catch {
        setStatus({
          variant: "error",
          message: "Check-in recorded, but we couldn't send the magic link. Request a new one from the login page.",
        });
      }
    });
  };

  const statusMessage = (() => {
    switch (status.variant) {
      case "success":
      case "already":
        return status.message;
      case "error":
        return status.message;
      default:
        return "Check in between 11am – 1pm CST on Saturdays to earn meetup rewards.";
    }
  })();

  return (
    <Card className="border-border/70 bg-card/95 shadow-lg">
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl font-semibold">Meetup check-in</CardTitle>
        <CardDescription>Earning rewards is as simple as confirming your email during the meetup window.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" aria-describedby="check-in-status-message">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="alex@product.team"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(fieldError)}
              disabled={isPending}
            />
            {fieldError ? (
              <p className="text-xs text-destructive" role="alert">
                {fieldError}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p id="check-in-status-message" className="text-sm text-muted-foreground">
              {statusMessage}
            </p>
            <Button type="submit" className="interactive-btn w-full sm:w-auto" disabled={isPending || email.trim().length === 0}>
              {isPending ? "Checking in…" : "Check in & send link"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
