"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function GitHubSignInButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    try {
      setIsLoading(true);
      await signIn("github", { callbackUrl: "/dashboard/ideas" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button type="button" className="w-full" onClick={handleClick} disabled={isLoading}>
      {isLoading ? "Redirecting…" : "Continue with GitHub"}
    </Button>
  );
}
