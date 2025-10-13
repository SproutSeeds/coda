"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { CSSProperties } from "react";

import { LOGIN_ANIMATION_CYCLE_MS } from "./LoginHero";
import { LoginCard } from "./LoginCard";

type LoginExperienceProps = {
  initialTab: "sign-in" | "about" | "meetup";
  isAuthenticated?: boolean;
  cardScale?: number;
  cardOffsetY?: number;
  cardContainerClassName?: string;
  cardContainerStyle?: CSSProperties;
};

export function LoginExperience({
  initialTab,
  isAuthenticated = false,
  cardScale,
  cardOffsetY,
  cardContainerClassName,
  cardContainerStyle,
}: LoginExperienceProps) {
  const [showCard, setShowCard] = useState(() => isAuthenticated);
  const [skipLabel, setSkipLabel] = useState("ESC to skip");
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
    if (isAuthenticated || showCard) {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setShowCard(true);
      return;
    }

    timerRef.current = window.setTimeout(reveal, LOGIN_ANIMATION_CYCLE_MS);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [isAuthenticated, reveal, showCard]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const coarsePointer = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    setSkipLabel(coarsePointer ? "TAP to skip" : "ESC to skip");
  }, []);

  useEffect(() => {
    if (showCard) {
      return;
    }
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
  }, [reveal, showCard]);

  useEffect(() => {
    if (isAuthenticated || showCard) {
      return;
    }

    const handlePointer = () => {
      reveal();
    };

    window.addEventListener("pointerdown", handlePointer, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", handlePointer);
    };
  }, [isAuthenticated, reveal, showCard]);

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
            <LoginCard
              initialTab={initialTab}
              isAuthenticated={isAuthenticated}
              scale={cardScale}
              offsetY={cardOffsetY}
              containerClassName={cardContainerClassName}
              containerStyle={cardContainerStyle}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
      {!showCard ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-4">
          <span
            role="button"
            tabIndex={0}
            onClick={() => reveal()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                reveal();
              }
            }}
            className="pointer-events-auto cursor-pointer text-xs font-medium tracking-[0.24em] text-white/65 transition hover:text-white"
          >
            {skipLabel}
          </span>
        </div>
      ) : null}
    </div>
  );
}
