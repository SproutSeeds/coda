"use client";

import { useState, type MouseEvent } from "react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DoorOpen, Loader2 } from "lucide-react";

type SignOutButtonProps = React.ComponentProps<typeof Button> & {
  iconOnly?: boolean;
  srLabel?: string;
};

export function SignOutButton({
  iconOnly = false,
  srLabel = "Sign out",
  className,
  variant,
  size,
  onClick,
  ...props
}: SignOutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
    if (onClick) {
      onClick(event);
    }
    if (event.defaultPrevented) {
      return;
    }
    try {
      setIsLoading(true);
      await signOut({ callbackUrl: "/login" });
    } finally {
      setIsLoading(false);
    }
  };

  const resolvedVariant = variant ?? "ghost";
  const resolvedSize = size ?? (iconOnly ? "icon" : "sm");

  return (
    <Button
      type="button"
      variant={resolvedVariant}
      size={resolvedSize}
      className={cn(
        "cursor-pointer hover:bg-transparent hover:text-foreground focus-visible:bg-transparent focus-visible:ring-0",
        className,
      )}
      onClick={handleClick}
      disabled={isLoading}
      {...props}
    >
      {isLoading ? (
        iconOnly ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          "Signing out…"
        )
      ) : iconOnly ? (
        <>
          <DoorOpen className="size-5" />
          <span className="sr-only">{srLabel}</span>
        </>
      ) : (
        "Sign out"
      )}
    </Button>
  );
}
