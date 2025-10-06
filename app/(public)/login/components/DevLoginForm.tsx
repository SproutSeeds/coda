"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DevLoginForm() {
  const router = useRouter();
  const [token, setToken] = useState("owner-token");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await signIn("credentials", {
      token,
      callbackUrl: "/dashboard/ideas",
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid owner token");
      setIsSubmitting(false);
      return;
    }

    router.push(result?.url ?? "/dashboard/ideas");
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-3">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase text-muted-foreground">Developer shortcut</p>
        <Input
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="owner-token"
          required
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          Available only in development for Playwright and local testing.
        </p>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting} variant="secondary">
        {isSubmitting ? "Signing in…" : "Use owner token"}
      </Button>
    </form>
  );
}
