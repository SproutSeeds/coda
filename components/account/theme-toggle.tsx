"use client";

import { useTransition } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { updateThemePreferenceAction } from "@/app/dashboard/account/actions";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  currentTheme: "light" | "dark";
  onThemeChange?: (theme: "light" | "dark") => void;
};

export function ThemeToggle({ currentTheme, onThemeChange }: ThemeToggleProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const [pending, startTransition] = useTransition();

  const activeTheme = (resolvedTheme ?? currentTheme) as "light" | "dark";
  const isLight = activeTheme === "light";
  const label = isLight ? "Night Lights ✨" : "Good Morning";
  const ariaLabel = isLight ? "Switch to Night Lights" : "Switch to Good Morning";

  const handleToggle = () => {
    const nextTheme = isLight ? "dark" : "light";
    startTransition(async () => {
      setTheme(nextTheme);
      await updateThemePreferenceAction({ theme: nextTheme, source: "explicit", promptDismissed: true });
      onThemeChange?.(nextTheme);
    });
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        data-testid="theme-toggle-button"
        onClick={handleToggle}
        disabled={pending}
        aria-pressed={isLight}
        aria-label={ariaLabel}
        className={cn(
          "interactive-btn inline-flex h-12 w-12 items-center justify-center rounded-full border text-base font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          isLight
            ? "border-slate-900/50 bg-slate-950/90 text-slate-50 hover:bg-slate-900"
            : "border-white/60 bg-white/15 text-white hover:bg-white/25"
        )}
      >
        {isLight ? <Moon className="h-6 w-6" /> : <Sun className="h-6 w-6 text-white" />}
      </button>
      <span
        className={cn(
          "text-sm font-semibold",
          isLight ? "text-black" : "text-white",
        )}
      >
        {label}
      </span>
    </div>
  );
}
