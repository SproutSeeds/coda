"use client";

import { useState, useEffect, useCallback, ReactNode } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { TerminalToggle } from "./components/TerminalToggle";
import { ContentToggle } from "./components/ContentToggle";
import { Map, Sword, Lightbulb, Compass, BarChart3, BookOpen } from "lucide-react";

// Read panel opacity from mode-based settings
const FLOW_MODE_KEY = "coda-flow-mode-settings";
const FOCUS_MODE_KEY = "coda-focus-mode-settings";

type LeftPanelId = "sorcerers-map" | "quest" | "discover" | "stats" | "grimoire";

interface DashboardShellProps {
  children: ReactNode;
  header: ReactNode;
}

export function DashboardShell({ children, header }: DashboardShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Quest-hub provides its own panel controls (TerminalToggle, etc.)
  // But TubesEffect + Minimap now come from DashboardSpaceProvider (layout level)
  const isQuestHub = pathname?.startsWith("/dashboard/quest-hub");

  // Panel state - left side (TerminalToggle) for navigation panels
  const [leftActivePanel, setLeftActivePanel] = useState<LeftPanelId | null>(null);
  const [panelOpacity, setPanelOpacity] = useState(80);

  // Visibility state - right side (ContentToggle) controls content visibility
  // Read from URL query param ?show=ideas,other,...
  const visibleContent = searchParams.get("show")?.split(",").filter(Boolean) || [];

  // Determine current mode based on URL
  const isFocusMode = visibleContent.length > 0;
  const currentStorageKey = isFocusMode ? FOCUS_MODE_KEY : FLOW_MODE_KEY;

  // Load panel opacity from current mode settings
  useEffect(() => {
    const saved = localStorage.getItem(currentStorageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.panelOpacity === "number") {
          setPanelOpacity(parsed.panelOpacity);
        }
      } catch {
        // Invalid JSON, use default
      }
    }
  }, [currentStorageKey]);

  // Listen for settings changes (from QuestFlowControl)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if ((e.key === FLOW_MODE_KEY || e.key === FOCUS_MODE_KEY) && e.newValue) {
        // Only update if it's the current mode's key
        if (e.key === currentStorageKey) {
          try {
            const parsed = JSON.parse(e.newValue);
            if (typeof parsed.panelOpacity === "number") {
              setPanelOpacity(parsed.panelOpacity);
            }
          } catch {
            // Invalid JSON
          }
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [currentStorageKey]);

  // Handle ESC key to close left panels
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && leftActivePanel) {
        setLeftActivePanel(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [leftActivePanel]);

  // Handle left tab clicks (navigation panels)
  const handleLeftTabClick = useCallback((panelId: LeftPanelId) => {
    setLeftActivePanel((current) => (current === panelId ? null : panelId));
  }, []);

  // Handle right toggle clicks (visibility toggle)
  const handleVisibilityToggle = useCallback((id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const current = params.get("show")?.split(",").filter(Boolean) || [];

    if (current.includes(id)) {
      // Remove from visible (turn off)
      const next = current.filter(c => c !== id);
      if (next.length === 0) {
        params.delete("show");
      } else {
        params.set("show", next.join(","));
      }
    } else {
      // Add to visible (turn on)
      params.set("show", [...current, id].join(","));
    }

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, pathname, router]);

  // Placeholder panels - will be replaced with actual panel components
  const PlaceholderPanel = ({ title }: { title: string }) => (
    <div className="p-6 text-white/60 text-sm">
      <p>{title} panel content coming soon...</p>
    </div>
  );

  // Left tabs for TerminalToggle (navigation panels)
  const leftTabs = [
    {
      id: "sorcerers-map" as const,
      icon: <Map className="w-5 h-5" />,
      label: "Sorcerer's Map",
      panel: <PlaceholderPanel title="Sorcerer's Map" />,
    },
    {
      id: "quest" as const,
      icon: <Sword className="w-5 h-5" />,
      label: "Quest",
      panel: <PlaceholderPanel title="Quest" />,
    },
    {
      id: "discover" as const,
      icon: <Compass className="w-5 h-5" />,
      label: "Discover",
      panel: <PlaceholderPanel title="Discover Public Ideas" />,
    },
    {
      id: "stats" as const,
      icon: <BarChart3 className="w-5 h-5" />,
      label: "Stats",
      panel: <PlaceholderPanel title="Stats" />,
    },
    {
      id: "grimoire" as const,
      icon: <BookOpen className="w-5 h-5" />,
      label: "Grimoire",
      panel: <PlaceholderPanel title="Grimoire" />,
    },
  ];

  // Right tabs for ContentToggle (visibility toggles)
  const rightTabs = [
    {
      id: "ideas" as const,
      icon: <Lightbulb className="w-5 h-5" />,
      label: "Ideas",
    },
  ];

  // Get active tab data for panel rendering
  const leftActiveTabData = leftTabs.find((t) => t.id === leftActivePanel);

  // Quest-hub provides its own panel controls (TerminalToggle, etc.)
  // TubesEffect + Minimap come from DashboardSpaceProvider at layout level
  // Just render header and children for quest-hub, no duplicate panels
  if (isQuestHub) {
    return (
      <>
        {/* Floating Header */}
        <header className="relative z-40">
          {header}
        </header>
        {children}
      </>
    );
  }

  // Calculate glass opacity from panel opacity setting
  const bgOpacity = (panelOpacity / 100) * 0.15;
  const borderOpacity = (panelOpacity / 100) * 0.2;

  // Regular dashboard pages - DashboardSpaceProvider provides TubesEffect + Minimap
  // DashboardShell adds TerminalToggle, ContentToggle, and layout structure
  return (
    <>
      {/* Terminal Toggle (LEFT) - blinking >_ that expands to show icons */}
      <TerminalToggle
        tabs={leftTabs}
        activeTab={leftActivePanel}
        onTabClick={(id) => handleLeftTabClick(id as LeftPanelId)}
      />

      {/* Content Toggle (RIGHT) - blinking _< that toggles content visibility */}
      <ContentToggle
        tabs={rightTabs}
        activeIds={visibleContent}
        onToggle={handleVisibilityToggle}
      />

      {/* Left Sliding Panel - appears when a left tab is active */}
      <AnimatePresence>
        {leftActivePanel && leftActiveTabData && (
          <motion.div
            initial={{ x: -400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -400, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed left-16 top-0 bottom-0 w-96 z-40 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glass background */}
            <div
              className="absolute inset-0"
              style={{
                background: `rgba(10, 10, 10, ${0.8 + bgOpacity})`,
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                borderRight: `1px solid rgba(255, 255, 255, ${borderOpacity})`,
              }}
            />

            {/* Edge glow */}
            <div
              className="absolute top-0 bottom-0 right-0 w-px"
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
                <span className="text-white/60">{leftActiveTabData.icon}</span>
                <h2 className="text-lg font-medium text-white">{leftActiveTabData.label}</h2>
              </div>
            </div>

            {/* Panel content */}
            <div className="relative z-10 h-[calc(100%-60px)] overflow-y-auto overflow-x-hidden custom-scrollbar">
              {leftActiveTabData.panel}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Click-away backdrop when left panel is open */}
      {leftActivePanel && (
        <div
          className="fixed inset-0 z-30 cursor-pointer"
          onClick={() => setLeftActivePanel(null)}
        />
      )}

      {/* Floating Header - no background, elements float over animation */}
      <header className="relative z-40">
        {header}
      </header>

      {/* Main Content - children handle their own fade visibility */}
      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
        {children}
      </main>
    </>
  );
}
