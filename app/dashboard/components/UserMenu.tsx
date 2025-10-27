"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Menu, Sparkles } from "lucide-react";

import { SignOutButton } from "./SignOutButton";

type UserMenuProps = {
  className?: string;
};

export function UserMenu({ className }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!menuRef.current || !triggerRef.current) return;
      if (menuRef.current.contains(target) || triggerRef.current.contains(target)) {
        return;
      }
      setOpen(false);
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const toggle = () => setOpen((value) => !value);

  return (
    <div className={cn("relative", className)}>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        size="icon"
        className="interactive-btn border-transparent text-muted-foreground hover:border-border hover:bg-muted/20 hover:text-foreground focus-visible:ring-0"
        id="workspace-menu-trigger"
        aria-label="Open workspace menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        {open ? <Sparkles className="size-5" /> : <Menu className="size-5" />}
      </Button>
      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-labelledby="workspace-menu-trigger"
          className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border/60 bg-card/95 shadow-xl backdrop-blur"
        >
          <div className="flex items-center gap-3 border-b border-border/60 bg-card/60 px-4 py-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">Coda workspace</p>
              <p className="truncate text-xs text-muted-foreground">Where ideas go live</p>
            </div>
          </div>
          <div className="flex flex-col gap-1 p-2" role="none">
            <Button
              asChild
              variant="ghost"
              className="interactive-btn w-full justify-start border-transparent px-3 py-2 text-sm font-medium text-foreground hover:border-border hover:bg-muted/30 focus-visible:ring-0"
              role="menuitem"
            >
              <Link href="/about" onClick={() => setOpen(false)}>
                About Coda
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="interactive-btn w-full justify-start border-transparent px-3 py-2 text-sm font-medium text-foreground hover:border-border hover:bg-muted/30 focus-visible:ring-0"
              role="menuitem"
            >
              <Link href="/dashboard/devmode/downloads" onClick={() => setOpen(false)}>
                Desktop Companion
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="interactive-btn w-full justify-start border-transparent px-3 py-2 text-sm font-medium text-foreground hover:border-border hover:bg-muted/30 focus-visible:ring-0"
              role="menuitem"
            >
              <Link href="/dashboard/keyboard-shortcuts" onClick={() => setOpen(false)}>
                Keyboard shortcuts
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="interactive-btn w-full justify-start border-transparent px-3 py-2 text-sm font-medium text-foreground hover:border-border hover:bg-muted/30 focus-visible:ring-0"
              role="menuitem"
            >
              <Link href="/dashboard/suggestions" onClick={() => setOpen(false)}>
                Suggestion box
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="interactive-btn w-full justify-start border-transparent px-3 py-2 text-sm font-medium text-foreground hover:border-border hover:bg-muted/30 focus-visible:ring-0"
              role="menuitem"
            >
              <Link href="/check-in" onClick={() => setOpen(false)}>
                Meetup check-in
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="interactive-btn w-full justify-between border-transparent px-3 py-2 text-left text-sm font-medium text-foreground hover:border-border hover:bg-muted/30 focus-visible:ring-0"
              role="menuitem"
            >
              <Link href="/dashboard/account" onClick={() => setOpen(false)}>
                Account settings
              </Link>
            </Button>
            <SignOutButton
              variant="ghost"
              className="interactive-btn w-full justify-start border-transparent px-3 py-2 text-sm font-medium text-foreground hover:border-border hover:bg-muted/30 focus-visible:ring-0"
              role="menuitem"
              onClick={() => setOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
