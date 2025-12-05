"use client";

import { useState, useEffect, useCallback, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  icon: ReactNode;
  label: string;
}

interface TerminalToggleProps {
  tabs: Tab[];
  activeTab: string | null;
  onTabClick: (id: string) => void;
}

export function TerminalToggle({ tabs, activeTab, onTabClick }: TerminalToggleProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // ESC key to collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isExpanded) {
        setIsExpanded(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  // Click-away to collapse (when expanded)
  const handleClickAway = useCallback(() => {
    setIsExpanded(false);
  }, []);

  // Handle tab click
  const handleTabClick = useCallback((id: string) => {
    onTabClick(id);
  }, [onTabClick]);

  return (
    <>
      {/* Click-away backdrop when expanded */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30"
            onClick={handleClickAway}
          />
        )}
      </AnimatePresence>

      {/* Terminal toggle - fixed left center */}
      <div className="fixed left-0 top-1/2 -translate-y-1/2 z-40">
        <AnimatePresence mode="wait">
          {!isExpanded ? (
            // Collapsed: blinking >_ cursor
            <motion.button
              key="cursor"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(true);
              }}
              className="px-2 py-4 rounded-r-lg bg-white/5 backdrop-blur-md
                border border-white/10 border-l-0
                text-white/60 hover:text-white/80 hover:bg-white/10
                transition-all duration-300 font-mono text-sm"
              aria-label="Expand navigation"
            >
              <span className="text-white/60">{">"}</span>
              <span className="animate-[blink_1s_step-end_infinite]">_</span>
            </motion.button>
          ) : (
            // Expanded: icon strip
            <motion.div
              key="icons"
              initial={{ x: -60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -60, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="flex flex-col gap-2 p-2 rounded-r-xl
                bg-black/40 backdrop-blur-xl border border-white/10 border-l-0"
              onClick={(e) => e.stopPropagation()}
            >
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab.id)}
                    className={cn(
                      "group relative w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-300",
                      isActive
                        ? "bg-white/10 text-white"
                        : "bg-transparent text-white/40 hover:text-white/70 hover:bg-white/5"
                    )}
                    title={tab.label}
                    aria-label={tab.label}
                  >
                    {/* Active indicator glow */}
                    {isActive && (
                      <motion.div
                        layoutId="terminal-tab-glow"
                        className="absolute inset-0 rounded-xl"
                        style={{
                          boxShadow: "0 0 20px rgba(255, 255, 255, 0.15), inset 0 0 10px rgba(255, 255, 255, 0.05)",
                        }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">{tab.icon}</span>
                    {/* Tooltip */}
                    <span className="absolute left-14 whitespace-nowrap bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
