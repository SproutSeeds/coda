"use client";

import { useState, useEffect, useCallback, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  icon: ReactNode;
  label: string;
}

interface ContentToggleProps {
  tabs: Tab[];
  activeIds: string[];  // Which content sections are currently visible
  onToggle: (id: string) => void;
}

export function ContentToggle({ tabs, activeIds, onToggle }: ContentToggleProps) {
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

  // Handle tab click - toggle visibility
  const handleTabClick = useCallback((id: string) => {
    onToggle(id);
  }, [onToggle]);

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

      {/* Content toggle - fixed right center */}
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40">
        <AnimatePresence mode="wait">
          {!isExpanded ? (
            // Collapsed: blinking _< cursor (mirrored)
            <motion.button
              key="cursor"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(true);
              }}
              className="px-2 py-4 rounded-l-lg bg-white/5 backdrop-blur-md
                border border-white/10 border-r-0
                text-white/60 hover:text-white/80 hover:bg-white/10
                transition-all duration-300 font-mono text-sm"
              aria-label="Expand content panels"
            >
              <span className="animate-[blink_1s_step-end_infinite]">_</span>
              <span className="text-white/60">{"<"}</span>
            </motion.button>
          ) : (
            // Expanded: icon strip with lit/dim states
            <motion.div
              key="icons"
              initial={{ x: 60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 60, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="flex flex-col gap-2 p-2 rounded-l-xl
                bg-black/40 backdrop-blur-xl border border-white/10 border-r-0"
              onClick={(e) => e.stopPropagation()}
            >
              {tabs.map((tab) => {
                const isVisible = activeIds.includes(tab.id);
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab.id)}
                    className={cn(
                      "group relative w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-300",
                      isVisible
                        ? "bg-yellow-400/10 text-yellow-400"
                        : "bg-transparent text-white/30 hover:text-white/50 hover:bg-white/5"
                    )}
                    style={isVisible ? {
                      filter: "drop-shadow(0 0 8px rgba(250, 204, 21, 0.5))",
                    } : undefined}
                    title={tab.label}
                    aria-label={`${tab.label} ${isVisible ? "(visible)" : "(hidden)"}`}
                  >
                    {/* Active indicator glow */}
                    {isVisible && (
                      <motion.div
                        layoutId="content-tab-glow"
                        className="absolute inset-0 rounded-xl"
                        style={{
                          boxShadow: "0 0 20px rgba(250, 204, 21, 0.3), inset 0 0 10px rgba(250, 204, 21, 0.1)",
                        }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">{tab.icon}</span>
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
