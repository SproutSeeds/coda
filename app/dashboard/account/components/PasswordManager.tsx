"use client";

import { useActionState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePasswordAction, type UpdatePasswordState } from "../actions";

const initialState: UpdatePasswordState = { status: "idle" };

type PasswordManagerProps = {
  hasPassword: boolean;
};

export function PasswordManager({ hasPassword }: PasswordManagerProps) {
  const [state, formAction, pending] = useActionState(updatePasswordAction, initialState);

  useEffect(() => {
    if (state.status === "success") {
      const form = document.getElementById("password-form") as HTMLFormElement | null;
      form?.reset();
    }
  }, [state.status]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>
          {hasPassword
            ? "Update your password. You’ll need your current password to make changes."
            : "Set a password so you can sign in without waiting for a magic link."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form id="password-form" action={formAction} className="space-y-4">
          {hasPassword ? (
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              minLength={12}
              autoComplete={hasPassword ? "new-password" : "create-password"}
              placeholder="At least 12 characters, include upper/lowercase and a number"
            />
          </div>
          {state.status === "error" ? (
            <p className="text-sm text-destructive" data-testid="password-update-error">
              {state.message}
            </p>
          ) : null}
          {state.status === "success" ? (
            <p className="text-sm text-green-600" data-testid="password-update-success">
              Password updated.
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : hasPassword ? "Update password" : "Set password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
