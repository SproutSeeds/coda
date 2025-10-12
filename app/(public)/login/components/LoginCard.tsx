"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { motion } from "framer-motion";

import { DevLoginForm } from "./DevLoginForm";
import { SignInSwitcher } from "./SignInSwitcher";
import { AboutSnapshot } from "./AboutSnapshot";
import { MeetupSnapshot } from "./MeetupSnapshot";

type LoginCardProps = {
  enableDevLogin: boolean;
  initialTab?: Tab;
};

type Tab = "sign-in" | "about" | "meetup";

export function LoginCard({ enableDevLogin, initialTab = "sign-in" }: LoginCardProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  const tabs = useMemo(
    () => [
      { id: "about" as Tab, label: "About us", blurb: "Why Cody built Coda and how it keeps ideas moving." },
      { id: "meetup" as Tab, label: "Meetup check-in", blurb: "" },
      { id: "sign-in" as Tab, label: "Sign in", blurb: "Enter your workspace and keep ideas, specs, and agents in sync." },
    ],
    [],
  );

  const activeMeta = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  const renderContent = () => {
    switch (activeTab) {
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
    activeTab === "sign-in"
      ? "Sign in to Coda"
      : activeTab === "about"
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
                <nav aria-label="Workspace sections" className="flex flex-wrap items-center gap-2 text-sm font-medium text-white/60">
                  {tabs.map((tab) => {
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
    </div>
  );
}
