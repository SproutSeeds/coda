"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

export function PasswordReminder({ needsPassword }: { needsPassword: boolean }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!needsPassword) {
      window.sessionStorage.removeItem("coda-password-reminder-dismissed");
      return;
    }

    const alreadyDismissed = window.sessionStorage.getItem("coda-password-reminder-dismissed");
    if (alreadyDismissed === "true") {
      setDismissed(true);
      return;
    }

    const id = toast(
      "Set your Coda password",
      {
        description: "Create a password in Account settings so you can sign in without email links.",
        action: {
          label: "Open settings",
          onClick: () => {
            window.location.href = "/dashboard/account";
          },
        },
        duration: 6000,
      },
    );

    return () => {
      toast.dismiss(id);
    };
  }, [needsPassword]);

  if (!needsPassword || dismissed) {
    return null;
  }

  return (
    <div className="border-b border-primary/30 bg-primary/5">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-3 text-sm text-primary md:flex-row md:items-center md:justify-between">
        <div className="font-medium">Secure your account by setting a password.</div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/account"
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            Set password
          </Link>
          <button
            type="button"
            className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => {
              setDismissed(true);
              window.sessionStorage.setItem("coda-password-reminder-dismissed", "true");
            }}
          >
            Dismiss for now
          </button>
        </div>
      </div>
    </div>
  );
}
