"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/about", label: "About" },
  { href: "/check-in", label: "Meetup Check-in" },
];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  if (isLogin) {
    return <div className="min-h-screen bg-background text-foreground">{children}</div>;
  }

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
            {NAV_ITEMS.map((item) => {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="interactive-btn inline-flex items-center justify-center rounded-full border border-transparent px-3 py-1.5 transition hover:border-border hover:bg-muted/40 hover:text-foreground"
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <Button asChild size="sm" className="interactive-btn hidden sm:inline-flex">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="interactive-btn sm:hidden">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
