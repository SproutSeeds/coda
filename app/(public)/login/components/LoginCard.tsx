"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { SignInSwitcher } from "./SignInSwitcher";
import { AboutSnapshot } from "./AboutSnapshot";
import { MeetupSnapshot } from "./MeetupSnapshot";

type LoginCardProps = {
  initialTab?: Tab;
  isAuthenticated?: boolean;
};

type Tab = "sign-in" | "about" | "meetup";

const LANGUAGE_PHRASES = [
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
];

export function LoginCard({ initialTab = "sign-in", isAuthenticated = false }: LoginCardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [currentPhrase, setCurrentPhrase] = useState(LANGUAGE_PHRASES[0]);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const otherPhrases = useMemo(() => LANGUAGE_PHRASES.slice(1), []);
  const restIndexRef = useRef(0);
  const tickRef = useRef(0);
  const redirectTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setCurrentPhrase(LANGUAGE_PHRASES[0]);
      restIndexRef.current = 0;
      tickRef.current = 0;
      return;
    }

    setCurrentPhrase(LANGUAGE_PHRASES[0]);
    restIndexRef.current = 0;
    tickRef.current = 0;

    const intervalId = window.setInterval(() => {
      tickRef.current += 1;
      if (tickRef.current % 6 === 0) {
        setCurrentPhrase(LANGUAGE_PHRASES[0]);
      } else {
        const message = otherPhrases[restIndexRef.current % otherPhrases.length];
        setCurrentPhrase(message);
        restIndexRef.current += 1;
      }
    }, 2_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated, otherPhrases]);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current !== null) {
        window.clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

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

  const renderContent = () => {
    switch (safeTab) {
      case "about":
        return <AboutSnapshot />;
      case "meetup":
        return <MeetupSnapshot isAuthenticated={isAuthenticated} />;
      case "sign-in":
      default:
        return (
          <div className="flex w-full flex-col gap-8 sm:flex-row sm:items-start sm:justify-end">
            <div className="min-w-[260px] flex-1 space-y-6">
              <SignInSwitcher />
            </div>
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

  const navItems = tabs.map((tab) => {
    if (tab.id === "sign-in" && isAuthenticated) {
      return null;
    }

    const isActive = tab.id === activeTab;
    return (
      <button
        key={tab.id}
        type="button"
        onClick={() => setActiveTab(tab.id)}
        className={
          "pointer-events-auto cursor-pointer rounded-full border border-transparent px-4 py-1 transition hover:border-white/20 hover:text-white" +
          (isActive ? " border-white/30 bg-white/10 text-white" : "")
        }
        aria-pressed={isActive}
      >
        {tab.label}
      </button>
    );
  });

  if (isAuthenticated) {
    navItems.splice(
      2,
      0,
      <motion.button
        key="ideas-button"
        type="button"
        onClick={() => {
          if (isRedirecting) return;
          setIsRedirecting(true);
          redirectTimeoutRef.current = window.setTimeout(() => {
            router.push("/dashboard/ideas");
          }, 720);
        }}
        disabled={isRedirecting}
        animate={
          isRedirecting
            ? {
                scale: [1, 1.08, 0.82, 0.54, 0.27, 0.09, 0.02],
                rotate: [0, -1.5, 1, -1.8, 1.2, -0.8, 0],
                y: [0, -2, -8, -16, -26, -34, -36],
                opacity: [1, 1, 0.85, 0.6, 0.35, 0.18, 0],
              }
            : { scale: 1, opacity: 1, rotate: 0, y: 0 }
        }
        transition={{
          duration: 0.68,
          ease: "easeInOut",
          times: [0, 0.08, 0.25, 0.45, 0.65, 0.85, 1],
        }}
        style={{ transformOrigin: "center" }}
        className="pointer-events-auto inline-flex cursor-pointer items-center gap-3 rounded-full border border-white/15 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-white shadow-[0_8px_24px_rgba(251,191,36,0.35)] transition hover:shadow-[0_10px_28px_rgba(251,191,36,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-default disabled:opacity-70"
        aria-label="Ideas are calling – open your dashboard"
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={currentPhrase}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="whitespace-nowrap"
          >
            {currentPhrase}
          </motion.span>
        </AnimatePresence>
        <ArrowRight className="size-4" aria-hidden />
      </motion.button>,
    );
  }

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
          animate={
            isRedirecting
              ? {
                  opacity: [1, 0.9, 0.55, 0],
                  y: [0, -10, -24, -36],
                  filter: ["blur(0px)", "blur(2px)", "blur(6px)", "blur(10px)"],
                }
              : { opacity: 1, y: 0, filter: "blur(0px)" }
          }
          transition={{
            duration: 0.7,
            ease: "easeInOut",
            times: isRedirecting ? [0, 0.35, 0.7, 1] : undefined,
          }}
        >
          <div className="flex flex-col gap-6">
            <nav
              aria-label="Workspace sections"
              className="flex flex-wrap items-center gap-3 text-sm font-medium text-white/60"
            >
              {navItems}
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
    </div>
  );
}
