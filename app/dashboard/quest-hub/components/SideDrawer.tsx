"use client";

import { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  icon: ReactNode;
  label: string;
  panel: ReactNode;
}

interface SideDrawerProps {
  side: "left" | "right";
  tabs: Tab[];
  activeTab: string | null;
  onTabClick: (tabId: string) => void;
  panelWidth?: number;
  panelOpacity?: number;
}

export function SideDrawer({
  side,
  tabs,
  activeTab,
  onTabClick,
  panelWidth = 400,
  panelOpacity = 80,
}: SideDrawerProps) {
  const isLeft = side === "left";
  const activeTabData = tabs.find((t) => t.id === activeTab);

  // Glass opacity calculation (similar to choose-path GlassCard)
  const bgOpacity = (panelOpacity / 100) * 0.15;
  const borderOpacity = (panelOpacity / 100) * 0.2;

  return (
    <>
      {/* Tab Strip - Always Visible */}
      <div
        className={cn(
          "fixed top-0 bottom-0 z-50 flex flex-col items-center py-6 gap-2",
          isLeft ? "left-0" : "right-0"
        )}
        style={{ width: 56 }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabClick(tab.id)}
              className={cn(
                "group relative w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-300 cursor-pointer",
                isActive
                  ? "bg-white/10 text-white"
                  : "bg-transparent text-white/40 hover:text-white/70 hover:bg-white/5"
              )}
              title={tab.label}
            >
              {/* Active indicator glow */}
              {isActive && (
                <motion.div
                  layoutId={`tab-glow-${side}`}
                  className="absolute inset-0 rounded-xl"
                  style={{
                    boxShadow: "0 0 20px rgba(255, 255, 255, 0.15), inset 0 0 10px rgba(255, 255, 255, 0.05)",
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}

              {/* Icon */}
              <span className="relative z-10">{tab.icon}</span>

              {/* Label tooltip */}
              <span
                className={cn(
                  "absolute whitespace-nowrap bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none",
                  isLeft ? "left-14" : "right-14"
                )}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sliding Panel */}
      <AnimatePresence>
        {activeTab && activeTabData && (
          <motion.div
            initial={{
              x: isLeft ? -panelWidth : panelWidth,
              opacity: 0
            }}
            animate={{
              x: 0,
              opacity: 1
            }}
            exit={{
              x: isLeft ? -panelWidth : panelWidth,
              opacity: 0
            }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30
            }}
            className={cn(
              "fixed top-0 bottom-0 z-40 overflow-hidden",
              isLeft ? "left-14" : "right-14"
            )}
            style={{ width: panelWidth }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glass background */}
            <div
              className="absolute inset-0"
              style={{
                background: `rgba(10, 10, 10, ${0.8 + bgOpacity})`,
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                borderLeft: isLeft ? "none" : `1px solid rgba(255, 255, 255, ${borderOpacity})`,
                borderRight: isLeft ? `1px solid rgba(255, 255, 255, ${borderOpacity})` : "none",
              }}
            />

            {/* Edge glow */}
            <div
              className={cn(
                "absolute top-0 bottom-0 w-px",
                isLeft ? "right-0" : "left-0"
              )}
              style={{
                background: `linear-gradient(
                  to bottom,
                  transparent,
                  rgba(255, 255, 255, ${borderOpacity * 2}) 20%,
                  rgba(255, 255, 255, ${borderOpacity * 2}) 80%,
                  transparent
                )`,
                boxShadow: `0 0 10px rgba(255, 255, 255, ${borderOpacity})`,
              }}
            />

            {/* Panel header */}
            <div
              className="relative z-10 px-6 py-4 border-b"
              style={{ borderColor: `rgba(255, 255, 255, ${borderOpacity})` }}
            >
              <div className="flex items-center gap-3">
                <span className="text-white/60">{activeTabData.icon}</span>
                <h2 className="text-lg font-medium text-white">{activeTabData.label}</h2>
              </div>
            </div>

            {/* Panel content */}
            <div className="relative z-10 h-[calc(100%-60px)] overflow-y-auto overflow-x-hidden custom-scrollbar">
              {activeTabData.panel}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
