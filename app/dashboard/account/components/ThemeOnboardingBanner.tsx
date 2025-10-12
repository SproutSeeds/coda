"use client";

import { useEffect, useState, useTransition } from "react";
import { useTheme } from "next-themes";

import { updateThemePreferenceAction } from "@/app/dashboard/account/actions";

type ThemeOnboardingBannerProps = {
  showing: boolean;
  countdownSeconds?: number;
  onDismiss?: (theme: "light" | "dark") => void;
};

export function ThemeOnboardingBanner({ showing, countdownSeconds = 10, onDismiss }: ThemeOnboardingBannerProps) {
  const [visible, setVisible] = useState(showing);
  const [secondsRemaining, setSecondsRemaining] = useState(countdownSeconds);
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, startTransition] = useTransition();
  const { setTheme } = useTheme();

  useEffect(() => {
    setVisible(showing);
    setSecondsRemaining(countdownSeconds);
    setAcknowledged(false);
  }, [showing, countdownSeconds]);

  useEffect(() => {
    if (!visible || acknowledged) return;

    const timer = window.setInterval(() => {
      setSecondsRemaining((prev) => {
      const next = prev - 1;
        if (next <= 0) {
          window.clearInterval(timer);
          acknowledge("dark", "system-default");
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, acknowledged]);

  const acknowledge = (theme: "light" | "dark", source: "explicit" | "system-default" | "restored") => {
    if (acknowledged) return;
    setAcknowledged(true);
    startTransition(async () => {
      setTheme(theme);
      await updateThemePreferenceAction({ theme, source, promptDismissed: true });
      setVisible(false);
      onDismiss?.(theme);
    });
  };

  if (!visible) {
    return null;
  }

  return (
    <div
      data-testid="theme-onboarding-banner"
      className="pointer-events-auto mt-4 flex flex-col gap-3 rounded-xl border border-white/15 bg-slate-950/85 p-4 text-sm text-slate-100 shadow-xl backdrop-blur"
      role="status"
      aria-live="polite"
    >
      <div className="font-medium">Welcome back! Dark mode is on.</div>
      <p className="text-slate-300">
        Prefer a brighter canvas? Switch now or we&apos;ll keep things cozy. {secondsRemaining}s remaining.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => acknowledge("light", "explicit")}
          disabled={pending}
          className="interactive-btn rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          Switch to light mode
        </button>
        <button
          type="button"
          onClick={() => acknowledge("dark", "system-default")}
          disabled={pending}
          className="interactive-btn rounded-full border border-white/20 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          Stay in dark mode
        </button>
      </div>
    </div>
  );
}
