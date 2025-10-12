"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const IMMERSIVE_ROUTES = new Set(["/login", "/about", "/check-in"]);

type PublicLayoutFrameProps = {
  children: React.ReactNode;
  isSignedIn: boolean;
};

export function PublicLayoutFrame({ children, isSignedIn }: PublicLayoutFrameProps) {
  const pathname = usePathname();
  const isImmersive = IMMERSIVE_ROUTES.has(pathname);

  if (isImmersive) {
    return <div className="min-h-screen bg-background text-foreground">{children}</div>;
  }

  const ctaLabel = isSignedIn ? (
    <span className="flex items-center gap-2">
      <span>Ideas are calling</span>
      <ArrowRight className="size-4 stroke-[3]" aria-hidden />
    </span>
  ) : (
    "Sign in"
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-card/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:flex-nowrap sm:px-6">
          <Link
            href="/"
            className="text-xl font-semibold tracking-tight text-foreground transition hover:text-primary"
            aria-label="CodaCLI home"
          >
            CodaCLI
          </Link>
          <nav className="flex w-full items-center justify-start gap-3 text-sm font-medium text-muted-foreground sm:w-auto sm:justify-center sm:gap-4">
            {Array.from(IMMERSIVE_ROUTES)
              .filter((route) => route !== "/login")
              .map((href) => {
                const label = href === "/about" ? "About" : "Meetup Check-in";
                return (
                  <Link
                    key={href}
                    href={href}
                    className="interactive-btn inline-flex items-center justify-center rounded-full border border-transparent px-3 py-1.5 transition hover:border-border hover:bg-muted/40 hover:text-foreground"
                  >
                    {label}
                  </Link>
                );
              })}
              </nav>
          <div className="flex items-center gap-3">
            {isSignedIn ? (
              <>
                <Button
                  asChild
                  size="sm"
                  className={cn(
                    "interactive-btn hidden sm:inline-flex border-none bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-300 text-slate-950 shadow-[0_0_14px_rgba(250,204,21,0.55)]",
                    "hover:shadow-[0_0_20px_rgba(251,191,36,0.75)] focus-visible:ring-yellow-400/70 focus-visible:ring-offset-0",
                  )}
                >
                  <Link href="/dashboard/ideas">{ctaLabel}</Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className={cn(
                    "interactive-btn sm:hidden border-none bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-300 text-slate-950 shadow-[0_0_14px_rgba(250,204,21,0.55)]",
                    "hover:shadow-[0_0_20px_rgba(251,191,36,0.75)] focus-visible:ring-yellow-400/70 focus-visible:ring-offset-0",
                  )}
                >
                  <Link href="/dashboard/ideas">{ctaLabel}</Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild size="sm" className="interactive-btn hidden sm:inline-flex">
                  <Link href="/login">{ctaLabel}</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="interactive-btn sm:hidden">
                  <Link href="/login">{ctaLabel}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
