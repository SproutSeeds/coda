"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Github } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const FLOATING_PATHS = new Set(["/login", "/about", "/check-in"]);
const REVEAL_THRESHOLD_PX = 16;
const FOOTER_OFFSET_PX = 24;

export function Footer() {
  const pathname = usePathname();
  const isFloating = pathname ? FLOATING_PATHS.has(pathname) : false;

  return isFloating ? <FloatingFooter /> : <StaticFooter />;
}

function StaticFooter() {
  return (
    <footer className="bg-transparent">
      <FooterChrome className="mx-auto w-full max-w-5xl px-4 py-4 sm:px-6">
        <FooterContent />
      </FooterChrome>
    </footer>
  );
}

function FloatingFooter() {
  const footerRef = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const previousPadding = useRef<{ body: string; html: string } | null>(null);

  useEffect(() => {
    const evaluate = () => {
      const footerHeight = footerRef.current?.offsetHeight ?? 0;
      const offset = footerHeight + FOOTER_OFFSET_PX;

      const docEl = document.documentElement;
      const body = document.body;
      const docHeight = Math.max(docEl.scrollHeight, body.scrollHeight);
      const viewportHeight = window.innerHeight;
      const scrollY = window.scrollY;

      const hasExtraPadding = previousPadding.current !== null;
      const effectiveHeight = hasExtraPadding ? docHeight - offset : docHeight;
      const distanceFromBottom = effectiveHeight - (viewportHeight + scrollY);
      const shouldShow = scrollY > 0 && distanceFromBottom <= REVEAL_THRESHOLD_PX;

      setIsVisible((prev) => (prev === shouldShow ? prev : shouldShow));
    };

    evaluate();

    window.addEventListener("scroll", evaluate, { passive: true });
    window.addEventListener("resize", evaluate);

    return () => {
      window.removeEventListener("scroll", evaluate);
      window.removeEventListener("resize", evaluate);
    };
  }, []);

  useEffect(() => {
    const docEl = document.documentElement;
    const footerEl = footerRef.current;
    const footerHeight = footerEl?.offsetHeight ?? 0;
    const offset = footerHeight + FOOTER_OFFSET_PX;
    const paddingValue = `${offset}px`;

    if (isVisible && footerEl) {
      if (!previousPadding.current) {
        previousPadding.current = {
          body: document.body.style.paddingBottom,
          html: docEl.style.paddingBottom,
        };
      }

      document.body.style.paddingBottom = paddingValue;
      docEl.style.paddingBottom = paddingValue;
    } else if (previousPadding.current) {
      document.body.style.paddingBottom = previousPadding.current.body;
      docEl.style.paddingBottom = previousPadding.current.html;
      previousPadding.current = null;
    }

    return () => {
      if (previousPadding.current) {
        document.body.style.paddingBottom = previousPadding.current.body;
        docEl.style.paddingBottom = previousPadding.current.html;
        previousPadding.current = null;
      }
    };
  }, [isVisible]);

  useEffect(() => {
    return () => {
      if (previousPadding.current) {
        document.body.style.paddingBottom = previousPadding.current.body;
        document.documentElement.style.paddingBottom = previousPadding.current.html;
        previousPadding.current = null;
      }
    };
  }, []);

  return (
    <footer
      ref={(node) => {
        footerRef.current = node;
      }}
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center transition-all duration-300 ease-out",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
      )}
    >
      <FooterChrome className="pointer-events-auto w-full max-w-5xl px-4 py-3 sm:px-6">
        <FooterContent />
      </FooterChrome>
    </footer>
  );
}

function FooterContent({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 text-center text-sm sm:flex-row sm:items-center sm:justify-between sm:text-left",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-1 sm:items-start">
        <span className="text-sm font-semibold tracking-wide text-foreground">Coda CLI</span>
        <span className="text-xs italic text-muted-foreground">“Can&apos;t stop won&apos;t stop.”</span>
      </div>

      <Link
        href="https://github.com/SproutSeeds/coda"
        target="_blank"
        rel="noreferrer noopener"
        className={cn(
          "inline-flex items-center justify-center rounded-full border border-border/40 p-2 text-muted-foreground transition-colors",
          "hover:border-border hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "motion-safe:transition-transform motion-safe:hover:scale-105 motion-reduce:transition-none motion-reduce:hover:scale-100",
        )}
      >
        <span className="sr-only">Coda on GitHub</span>
        <Github className="h-5 w-5" aria-hidden="true" />
      </Link>
    </div>
  );
}

function FooterChrome({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("relative overflow-visible", className)}>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-6 h-10 rounded-full bg-gradient-to-r from-primary/35 via-accent/60 to-primary/35 blur-[48px] opacity-80 sm:-top-5 sm:h-9"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-accent/90 to-transparent opacity-95 shadow-[0_0_26px_rgba(96,165,250,0.35)]"
      />
      {children}
    </div>
  );
}
