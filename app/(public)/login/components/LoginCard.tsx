"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useAnimationFrame,
  useMotionValue,
} from "framer-motion";
import { ArrowRight } from "lucide-react";

import { DevLoginForm } from "./DevLoginForm";
import { SignInSwitcher } from "./SignInSwitcher";
import { AboutSnapshot } from "./AboutSnapshot";
import { MeetupSnapshot } from "./MeetupSnapshot";

function shuffle<T>(source: T[]): T[] {
  const result = [...source];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function buildPhraseSequence(base: string[]): string[] {
  if (base.length <= 2) {
    return base;
  }
  const rest = shuffle(base.slice(2));
  return [base[0], base[1], ...rest];
}

type LoginCardProps = {
  enableDevLogin: boolean;
  initialTab?: Tab;
  isAuthenticated?: boolean;
};

type Tab = "sign-in" | "about" | "meetup";

const FLOAT_MARGIN = 24;
const INITIAL_FLOAT_SPEED = { vx: 140, vy: 120 };

export function LoginCard({ enableDevLogin, initialTab = "sign-in", isAuthenticated = false }: LoginCardProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [phraseCycle, setPhraseCycle] = useState(0);
  const [floating, setFloating] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [clicked, setClicked] = useState(false);

  const controls = useAnimationControls();
  const glowControls = useAnimationControls();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const velocityRef = useRef({ vx: 0, vy: 0 });
  const storedVelocityRef = useRef<{ vx: number; vy: number } | null>(null);
  const currentTimerRef = useRef(0);
  const sequenceStartedRef = useRef(false);

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const placeholderRef = useRef<HTMLSpanElement | null>(null);

  const router = useRouter();

  const tabs = useMemo(
    () => [
      { id: "about" as Tab, label: "About us", blurb: "Why Cody built Coda and how it keeps ideas moving." },
      { id: "meetup" as Tab, label: "Meetup check-in", blurb: "" },
      { id: "sign-in" as Tab, label: "Sign in", blurb: "Enter your workspace and keep ideas, specs, and agents in sync." },
    ],
    [],
  );

  const safeTab = isAuthenticated && activeTab === "sign-in" ? "about" : activeTab;
  const activeMeta = tabs.find((tab) => tab.id === safeTab) ?? tabs[0];

  const ideaPhrases = useMemo(
    () => [
      "Ideas are calling",
      "Las ideas te llaman",
      "Les idées appellent",
      "Le idee stanno chiamando",
      "Ideen rufen dich",
      "アイデアが呼んでいる",
      "아이디어가 부르고 있어요",
      "创意在召唤你",
      "As ideias estão chamando",
      "De ideeën roepen",
      "Ideerna kallar",
      "Las idees et criden",
      "Idéerna kallar på dig",
      "Ideene kaller",
      "Asa zonuɣ ad sɛent-k",
    ],
    [],
  );

  const phraseOrder = useMemo(() => {
    // Trigger a reshuffle whenever the cycle counter changes.
    void phraseCycle;
    return buildPhraseSequence(ideaPhrases);
  }, [ideaPhrases, phraseCycle]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    const id = window.setInterval(() => {
      setPhraseIndex((index) => {
        const nextIndex = (index + 1) % phraseOrder.length;
        if (nextIndex === 0) {
          setPhraseCycle((value) => value + 1);
        }
        return nextIndex;
      });
    }, 2000);
    return () => {
      window.clearInterval(id);
    };
  }, [isAuthenticated, phraseOrder.length]);

  useEffect(() => {
    controls.set({
      scale: 1,
      rotate: 0,
      opacity: 1,
      y: 0,
      boxShadow: "0 0 42px rgba(251,191,36,0.25)",
    });
    glowControls.set({ opacity: 0, scale: 1 });
  }, [controls, glowControls]);

  useEffect(() => {
    if (!isAuthenticated || floating || clicked) return;

    const setInitialPosition = () => {
      if (!placeholderRef.current) return;
      const rect = placeholderRef.current.getBoundingClientRect();
      x.set(rect.left);
      y.set(rect.top);
    };

    setInitialPosition();

    window.addEventListener("resize", setInitialPosition);
    return () => {
      window.removeEventListener("resize", setInitialPosition);
    };
  }, [isAuthenticated, floating, clicked, x, y]);

  useEffect(() => {
    if (!isAuthenticated || floating || clicked || sequenceStartedRef.current) return;
    sequenceStartedRef.current = true;

    let cancelled = false;

    const runSequence = async () => {
      velocityRef.current = { vx: 0, vy: 0 };

      await controls.start({
        scale: 3,
        transition: { duration: 2.5, ease: [0.16, 1, 0.3, 1] },
      });
      if (cancelled) return;

      await controls.start({
        rotate: [0, -6, 6, -9, 9, -12, 12, -14, 14, 0],
        transition: { duration: 1.3, ease: "easeInOut" },
      });
      if (cancelled) return;

      await Promise.all([
        controls.start({
          rotate: [0, -8, 8, -10, 10, -12, 12, 0],
          transition: { duration: 1.1, ease: "easeInOut" },
        }),
        glowControls.start({
          opacity: [0, 0.85, 0.6],
          scale: [1.05, 1.5, 1.32],
          transition: { duration: 1.1, ease: "easeInOut" },
        }),
      ]);
      if (cancelled) return;

      await controls.start({
        boxShadow: [
          "0 0 36px rgba(251,191,36,0.3)",
          "0 0 160px rgba(253,224,71,0.75)",
          "0 0 110px rgba(251,191,36,0.5)",
        ],
        transition: { duration: 1.2, ease: "easeInOut" },
      });
      if (cancelled) return;

      await controls.start({
        scale: 2.95,
        transition: { duration: 0.6, ease: [0.45, 0, 0.2, 1] },
      });
      if (cancelled) return;

      await controls.start({
        y: [0, 24, -18, 12, -8, 0],
        transition: { duration: 1, ease: "easeInOut" },
      });
      if (cancelled) return;

      await controls.start({
        scale: 1.2,
        rotate: 0,
        transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
      });
      if (cancelled) return;

      await Promise.all([
        controls.start({
          boxShadow: "0 0 78px rgba(251,191,36,0.5)",
          transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
        }),
        glowControls.start({
          opacity: 0.55,
          scale: 1.28,
          transition: { duration: 0.6, ease: "easeOut" },
        }),
      ]);

      if (cancelled) return;

      setFloating(true);
      velocityRef.current = { ...INITIAL_FLOAT_SPEED };
    };

    runSequence();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, floating, clicked, controls, glowControls]);

  useAnimationFrame((_, delta) => {
    if (!floating || frozen || clicked) return;

    const width = buttonRef.current?.offsetWidth ?? 160;
    const height = buttonRef.current?.offsetHeight ?? 60;
    const maxX = window.innerWidth - width - FLOAT_MARGIN;
    const maxY = window.innerHeight - height - FLOAT_MARGIN;

    const deltaSeconds = delta / 1000;
    let nextX = x.get() + velocityRef.current.vx * deltaSeconds;
    let nextY = y.get() + velocityRef.current.vy * deltaSeconds;

    if (nextX <= FLOAT_MARGIN) {
      nextX = FLOAT_MARGIN;
      velocityRef.current.vx = Math.abs(velocityRef.current.vx);
    } else if (nextX >= maxX) {
      nextX = maxX;
      velocityRef.current.vx = -Math.abs(velocityRef.current.vx);
    }

    if (nextY <= FLOAT_MARGIN) {
      nextY = FLOAT_MARGIN;
      velocityRef.current.vy = Math.abs(velocityRef.current.vy);
    } else if (nextY >= maxY) {
      nextY = maxY;
      velocityRef.current.vy = -Math.abs(velocityRef.current.vy);
    }

    currentTimerRef.current += delta;
    if (currentTimerRef.current > 3600) {
      currentTimerRef.current = 0;
      velocityRef.current.vx = Math.max(
        -220,
        Math.min(220, velocityRef.current.vx + (Math.random() - 0.5) * 80),
      );
      velocityRef.current.vy = Math.max(
        -220,
        Math.min(220, velocityRef.current.vy + (Math.random() - 0.5) * 80),
      );
    }

    x.set(nextX);
    y.set(nextY);
  });

  useEffect(() => {
    if (!floating) return;

    const handleResize = () => {
      const width = buttonRef.current?.offsetWidth ?? 160;
      const height = buttonRef.current?.offsetHeight ?? 60;
      const maxX = window.innerWidth - width - FLOAT_MARGIN;
      const maxY = window.innerHeight - height - FLOAT_MARGIN;

      x.set(Math.min(Math.max(x.get(), FLOAT_MARGIN), maxX));
      y.set(Math.min(Math.max(y.get(), FLOAT_MARGIN), maxY));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [floating, x, y]);

  const handlePointerEnter = () => {
    if (!isAuthenticated || clicked) return;
    setFrozen(true);
    storedVelocityRef.current = { ...velocityRef.current };
    velocityRef.current = { vx: 0, vy: 0 };
    controls.start({
      scale: 1.5,
      rotate: -8,
      transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
    });
    glowControls.start({
      opacity: 0.85,
      scale: 1.48,
      transition: { duration: 0.45, ease: "easeOut" },
    });
  };

  const handlePointerLeave = () => {
    if (clicked) return;
    setFrozen(false);
    if (storedVelocityRef.current) {
      velocityRef.current = storedVelocityRef.current;
      storedVelocityRef.current = null;
    } else if (floating) {
      velocityRef.current = { ...INITIAL_FLOAT_SPEED };
    }
    controls.start({
      scale: 1.2,
      rotate: 0,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
    });
    glowControls.start({
      opacity: 0.55,
      scale: 1.28,
      transition: { duration: 0.6, ease: "easeOut" },
    });
  };

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (clicked) return;
    setClicked(true);
    setFrozen(true);
    setFloating(false);
    velocityRef.current = { vx: 0, vy: 0 };
    storedVelocityRef.current = null;

    await Promise.all([
      controls.start({
        scale: 0.05,
        rotate: 0,
        opacity: 0,
        y: 30,
        transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
      }),
      glowControls.start({
        opacity: 0,
        scale: 1.1,
        transition: { duration: 0.4, ease: "linear" },
      }),
    ]);

    router.push("/dashboard/ideas");
  };

  const renderContent = () => {
    switch (safeTab) {
      case "about":
        return <AboutSnapshot />;
      case "meetup":
        return <MeetupSnapshot isAuthenticated={enableDevLogin} />;
      case "sign-in":
      default:
        return (
          <div className="flex w-full flex-col gap-8 sm:flex-row sm:items-start sm:justify-end">
            <div className="min-w-[260px] flex-1 space-y-6">
              <SignInSwitcher />
            </div>
            {enableDevLogin ? (
              <div className="w-full max-w-xs">
                <DevLoginForm />
              </div>
            ) : null}
          </div>
        );
    }
  };

  const headline =
    safeTab === "sign-in"
      ? "Sign in to Coda"
      : safeTab === "about"
        ? "Our Mission is to focus noise"
        : "Check in for rewards";

  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      <Link
        href="/"
        aria-label="CodaCLI home"
        className="interactive-btn pointer-events-auto absolute left-6 top-6 inline-flex items-center gap-3 text-2xl font-semibold tracking-tight transition sm:left-8 sm:top-8 sm:text-3xl"
      >
        <span className="swirl-brand">C</span>
        <span className="swirl-brand font-light">.</span>
      </Link>
      <div className="flex h-full items-start justify-center px-6 pt-16 sm:pt-20">
        <motion.header
          className="pointer-events-auto flex w-full max-w-6xl flex-col gap-10 text-slate-100"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex flex-col gap-6">
            <nav aria-label="Workspace sections" className="relative flex flex-wrap items-center gap-3 text-sm font-medium text-white/60">
              {tabs.map((tab) => {
                if (tab.id === "sign-in" && isAuthenticated) {
                  return (
                    <span
                      key="ideas-placeholder"
                      ref={placeholderRef}
                      className="inline-flex min-w-[11rem] items-center justify-center rounded-full border border-transparent px-4 py-1 text-sm font-medium opacity-0"
                      aria-hidden="true"
                    >
                      Ideas are calling
                    </span>
                  );
                }

                const isActive = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={
                      "cursor-pointer rounded-full border border-transparent px-4 py-1 transition hover:border-white/20 hover:text-white" +
                      (isActive ? " border-white/30 bg-white/10 text-white" : "")
                    }
                    aria-pressed={isActive}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </nav>
            <div className="space-y-2">
              {headline ? (
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{headline}</h1>
              ) : null}
              {activeMeta.blurb ? <p className="max-w-xl text-sm text-white/75">{activeMeta.blurb}</p> : null}
            </div>
          </div>
          <div>{renderContent()}</div>
        </motion.header>
      </div>

      {isAuthenticated ? (
        <motion.button
          ref={buttonRef}
          type="button"
          aria-label="Ideas are calling – open your dashboard"
          animate={controls}
          style={{
            x,
            y,
            position: "fixed",
            top: 0,
            left: 0,
            zIndex: 90,
            pointerEvents: clicked ? "none" : "auto",
          }}
          className={`interactive-btn relative inline-flex origin-center items-center gap-3 rounded-full border border-transparent bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-300 px-6 py-2 text-base font-semibold uppercase tracking-wide text-slate-950 shadow-[0_0_18px_rgba(251,191,36,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 focus-visible:ring-offset-2 ${clicked ? "cursor-default" : "cursor-pointer"}`}
          onMouseEnter={handlePointerEnter}
          onMouseLeave={handlePointerLeave}
          onFocus={handlePointerEnter}
          onBlur={handlePointerLeave}
          onClick={handleClick}
        >
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-[radial-gradient(circle_at_center,rgba(253,224,71,0.55),rgba(251,191,36,0.2),transparent_75%)] blur-2xl"
            animate={glowControls}
          />
          <span className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
            <AnimatePresence mode="wait">
              <motion.span
                key={`${phraseIndex}-${phraseOrder[phraseIndex]}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                {phraseOrder[phraseIndex]}
              </motion.span>
            </AnimatePresence>
            <ArrowRight className="size-4" aria-hidden />
          </span>
        </motion.button>
      ) : null}
    </div>
  );
}
