"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Share2, Smartphone } from "lucide-react";

type MobilePlatform = "ios" | "android" | "unknown";

const STORAGE_KEY = "coda.install-reminder.dismissed";
const SESSION_KEY = "coda.install-reminder.session";

function detectPlatform(): MobilePlatform {
  if (typeof navigator === "undefined") {
    return "unknown";
  }
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) {
    return "ios";
  }
  if (/android/.test(ua)) {
    return "android";
  }
  return "unknown";
}

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const mediaStandalone = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  const navigatorStandalone = typeof (navigator as unknown as { standalone?: boolean }).standalone === "boolean"
    ? Boolean((navigator as unknown as { standalone?: boolean }).standalone)
    : false;
  return mediaStandalone || navigatorStandalone;
}

export function AppInstallReminder() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<MobilePlatform>("unknown");
  const [dontRemind, setDontRemind] = useState(false);
  const reminderCheckboxId = useId();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const dismissed = window.localStorage.getItem(STORAGE_KEY) === "true";
    if (dismissed) {
      return;
    }

    if (window.sessionStorage.getItem(SESSION_KEY) === "true") {
      return;
    }

    const detectedPlatform = detectPlatform();
    if (detectedPlatform === "unknown") {
      return;
    }

    if (isStandaloneMode()) {
      return;
    }

    window.sessionStorage.setItem(SESSION_KEY, "true");
    setPlatform(detectedPlatform);
    setVisible(true);
  }, []);

  const headline = useMemo(() => {
    switch (platform) {
      case "ios":
        return "Add Coda to your Home Screen";
      case "android":
        return "Pin Coda to your home screen";
      default:
        return "Add Coda to your Home Screen";
    }
  }, [platform]);

  const instructions = useMemo(() => {
    if (platform === "android") {
      return [
        "Tap the browser menu (⋮) in the upper-right corner.",
        "Choose \"Add to Home screen\".",
        "Confirm the shortcut to launch Coda like a native app.",
      ];
    }
    return [
      "Tap the share icon on the right side of your browser's address bar.",
      "Select \"Add to Home Screen\".",
      "Use the new icon to jump back into Coda instantly.",
    ];
  }, [platform]);

  const handleClose = () => {
    if (typeof window !== "undefined" && dontRemind) {
      window.localStorage.setItem(STORAGE_KEY, "true");
    }
    setVisible(false);
  };

  if (!visible) {
    return null;
  }

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-slate-950/90 p-6 text-slate-100 shadow-[0_24px_60px_rgba(15,23,42,0.55)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-reminder-title"
          >
            <div className="mb-4 flex items-center gap-3">
              <span className="inline-flex size-12 items-center justify-center rounded-full bg-white/10 text-white">
                {platform === "android" ? <Smartphone className="size-6" aria-hidden /> : <Share2 className="size-6" aria-hidden />}
              </span>
              <div>
                <h2 id="install-reminder-title" className="text-lg font-semibold text-white">
                  {headline}
                </h2>
                <p className="text-sm text-white/70">Keep Coda one tap away for quicker idea sprints.</p>
              </div>
            </div>
            <ol className="space-y-2 text-sm text-white/75">
              {instructions.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="mt-0.5 inline-flex size-6 flex-none items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/80">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <div className="mt-6 space-y-4">
              <label className="flex items-center gap-3 text-xs text-white/70" htmlFor={reminderCheckboxId}>
                <input
                  type="checkbox"
                  id={reminderCheckboxId}
                  name="app-install-reminder-dismiss"
                  className="size-4 rounded border border-white/40 bg-transparent text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
                  checked={dontRemind}
                  onChange={(event) => setDontRemind(event.target.checked)}
                />
                <span>Don&apos;t remind me again</span>
              </label>
              <Button onClick={handleClose} className="w-full justify-center bg-white text-slate-950 hover:bg-amber-200">
                Got it
              </Button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
