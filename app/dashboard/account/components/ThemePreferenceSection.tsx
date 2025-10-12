"use client";

import { useEffect, useState } from "react";

import { ThemeToggle } from "@/components/account/theme-toggle";

import { ThemeOnboardingBanner } from "./ThemeOnboardingBanner";

type ThemePreferenceSectionProps = {
  initialTheme: "light" | "dark";
  showOnboarding: boolean;
  countdownSeconds?: number;
};

export function ThemePreferenceSection({ initialTheme, showOnboarding, countdownSeconds = 10 }: ThemePreferenceSectionProps) {
  const [currentTheme, setCurrentTheme] = useState<"light" | "dark">(initialTheme);
  const [showBanner, setShowBanner] = useState(showOnboarding);
  const [forcedColorsActive, setForcedColorsActive] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(forced-colors: active)");
    const update = () => setForcedColorsActive(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <section className="rounded-xl border border-border/60 bg-card/95 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Theme</h2>
          <p className="text-sm text-muted-foreground">Flip between Good Morning and Night Lights—your pick stays put next time you sign in.</p>
          {forcedColorsActive ? (
            <p className="text-xs text-muted-foreground">
              High-contrast mode is active — system colors override Coda’s palette to keep text readable.
            </p>
          ) : null}
        </div>
        <ThemeToggle
          currentTheme={currentTheme}
          onThemeChange={(theme) => {
            setCurrentTheme(theme);
            setShowBanner(false);
          }}
        />
      </div>
      <ThemeOnboardingBanner
        showing={showBanner}
        countdownSeconds={countdownSeconds}
        onDismiss={(theme) => {
          setCurrentTheme(theme);
          setShowBanner(false);
        }}
      />
    </section>
  );
}
