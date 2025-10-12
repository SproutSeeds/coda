"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { LOGIN_ANIMATION_CYCLE_MS } from "./LoginHero";
import { LoginCard } from "./LoginCard";

type LoginExperienceProps = {
  enableDevLogin: boolean;
  initialTab: "sign-in" | "about" | "meetup";
  isAuthenticated?: boolean;
};

export function LoginExperience({ enableDevLogin, initialTab, isAuthenticated = false }: LoginExperienceProps) {
  const [showCard, setShowCard] = useState(false);
  const timerRef = useRef<number | null>(null);

  const reveal = useCallback(() => {
    if (!showCard) {
      setShowCard(true);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [showCard]);

  useEffect(() => {
    timerRef.current = window.setTimeout(reveal, LOGIN_ANIMATION_CYCLE_MS);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [reveal]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        reveal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [reveal]);

  return (
    <div className="pointer-events-none">
      <AnimatePresence>
        {showCard ? (
          <motion.div
            key="login-card"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <LoginCard enableDevLogin={enableDevLogin} initialTab={initialTab} isAuthenticated={isAuthenticated} />
          </motion.div>
        ) : null}
      </AnimatePresence>
      {!showCard ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-4">
          <span className="text-xs font-medium uppercase tracking-[0.28em] text-white/60">
            Esc to Skip
          </span>
        </div>
      ) : null}
    </div>
  );
}
