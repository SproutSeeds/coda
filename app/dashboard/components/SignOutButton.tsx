"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    try {
      setIsLoading(true);
      await signOut({ callbackUrl: "/login" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="hover:bg-transparent hover:text-foreground focus-visible:bg-transparent focus-visible:ring-0"
      onClick={handleClick}
      disabled={isLoading}
    >
      {isLoading ? "Signing out…" : "Sign out"}
    </Button>
  );
}
