import Link from "next/link";
import { Github } from "lucide-react";

import { cn } from "@/lib/utils";

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto w-full max-w-5xl px-4 py-4 sm:px-6">
        <div className="flex flex-col items-center gap-4 text-center lg:flex-row lg:items-center lg:justify-between lg:text-left">
          <div className="flex flex-col items-center gap-1 lg:items-start">
            <span className="text-sm font-semibold tracking-wide text-foreground">Coda CLI</span>
            <span className="text-xs italic text-muted-foreground">“Can&apos;t stop won&apos;t stop.”</span>
          </div>

          <Link
            href="https://github.com/SproutSeeds/coda"
            target="_blank"
            rel="noreferrer noopener"
            className={cn(
              "rounded-full border border-border/40 p-2 text-muted-foreground transition-colors",
              "hover:border-border hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "motion-safe:transition-transform motion-safe:hover:scale-105 motion-reduce:transition-none motion-reduce:hover:scale-100",
            )}
          >
            <span className="sr-only">Coda on GitHub</span>
            <Github className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </footer>
  );
}
