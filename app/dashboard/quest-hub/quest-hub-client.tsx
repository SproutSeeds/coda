"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BubbleTitle } from "@/components/effects/BubbleTitle";
import { TerminalToggle } from "@/app/dashboard/components/TerminalToggle";
import { JourneyMapPanel } from "./components/JourneyMapPanel";
import { CurrentQuestPanel } from "./components/CurrentQuestPanel";
import { IdeaSelectorPanel } from "./components/IdeaSelectorPanel";
import { ProgressStatsPanel } from "./components/ProgressStatsPanel";
import { GrimoirePanel } from "./components/GrimoirePanel";
import type { StageDefinition } from "@/lib/journey/constants";
import type { JourneyState } from "@/lib/journey/types";
import type { IdeaSummary } from "../path/components/IdeaSelector";
import type { IdeaQuestState } from "@/lib/journey/idea-progress";

// Icons for tabs
import { Map, Sword, Lightbulb, BarChart3, BookOpen } from "lucide-react";

// Storage key for panel opacity (shared with DashboardSpaceProvider)
const STORAGE_KEY = "coda-flow-mode-settings";

type PanelId = "journey-map" | "current-quest" | "idea-selector" | "progress-stats" | "grimoire";

interface QuestHubClientProps {
  journeyState: JourneyState;
  stages: StageDefinition[];
  totalStages: number;
  wandererPathStages: number;
  ideas: IdeaSummary[];
  selectedIdeaId: string | null;
  ideaProgress: IdeaQuestState | null;
  completionPercent: number;
}

export function QuestHubClient({
  journeyState,
  stages,
  totalStages,
  wandererPathStages,
  ideas,
  selectedIdeaId,
  ideaProgress,
  completionPercent,
}: QuestHubClientProps) {
  // Panel state
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  const [focusedStage, setFocusedStage] = useState<number>(journeyState.currentStage);
  const [panelOpacity, setPanelOpacity] = useState(80);

  // BubbleTitle state - shows for Wanderers on first visit of the day
  const [showBubbleTitle, setShowBubbleTitle] = useState(false);
  const [isBubbleTitleAnimatingOut, setIsBubbleTitleAnimatingOut] = useState(false);

  // Load panel opacity from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        if (typeof settings.panelOpacity === "number") {
          setPanelOpacity(settings.panelOpacity);
        }
      } catch {
        // Invalid JSON, use defaults
      }
    }
  }, []);

  // Listen for settings changes from SettingsPanel
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (typeof parsed.panelOpacity === "number") {
            setPanelOpacity(parsed.panelOpacity);
          }
        } catch {
          // Invalid JSON
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Check for first daily visit and show BubbleTitle for Wanderers
  useEffect(() => {
    if (journeyState.chosenPath !== "wanderer") return;

    fetch("/api/quest-hub/daily-visit")
      .then((res) => res.json())
      .then((data) => {
        if (data.isFirstVisitToday) {
          setShowBubbleTitle(true);
        }
      })
      .catch(() => {
        // On error, don't show bubble title
      });
  }, [journeyState.chosenPath]);

  // Handle BubbleTitle dismissal
  const handleBubbleTitleDismiss = useCallback(() => {
    setIsBubbleTitleAnimatingOut(true);

    fetch("/api/quest-hub/daily-visit", { method: "POST" }).catch(() => {
      // Ignore errors
    });

    setTimeout(() => {
      setShowBubbleTitle(false);
      setIsBubbleTitleAnimatingOut(false);
    }, 600);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC to close panels
      if (e.key === "Escape" && activePanel) {
        setActivePanel(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePanel]);

  // Handle tab clicks
  const handleTabClick = useCallback((panelId: PanelId) => {
    setActivePanel((current) => (current === panelId ? null : panelId));
  }, []);

  // Handle stage selection from journey map
  const handleStageSelect = useCallback((stageNumber: number) => {
    setFocusedStage(stageNumber);
    setActivePanel("current-quest");
  }, []);

  // All tabs for TerminalToggle
  const allTabs = [
    {
      id: "journey-map" as const,
      icon: <Map className="w-5 h-5" />,
      label: "Journey",
      panel: (
        <JourneyMapPanel
          journeyState={journeyState}
          stages={stages}
          wandererPathStages={wandererPathStages}
          focusedStage={focusedStage}
          onStageSelect={handleStageSelect}
          ideaProgress={ideaProgress}
        />
      ),
    },
    {
      id: "current-quest" as const,
      icon: <Sword className="w-5 h-5" />,
      label: "Quest",
      panel: (
        <CurrentQuestPanel
          journeyState={journeyState}
          stages={stages}
          focusedStage={focusedStage}
          onStageChange={setFocusedStage}
          ideaProgress={ideaProgress}
          totalStages={totalStages}
          wandererPathStages={wandererPathStages}
        />
      ),
    },
    {
      id: "idea-selector" as const,
      icon: <Lightbulb className="w-5 h-5" />,
      label: "Ideas",
      panel: (
        <IdeaSelectorPanel
          ideas={ideas}
          selectedIdeaId={selectedIdeaId}
          journeyState={journeyState}
        />
      ),
    },
    {
      id: "progress-stats" as const,
      icon: <BarChart3 className="w-5 h-5" />,
      label: "Stats",
      panel: (
        <ProgressStatsPanel
          journeyState={journeyState}
          completionPercent={completionPercent}
          totalStages={totalStages}
          wandererPathStages={wandererPathStages}
        />
      ),
    },
    {
      id: "grimoire" as const,
      icon: <BookOpen className="w-5 h-5" />,
      label: "Grimoire",
      panel: <GrimoirePanel journeyState={journeyState} />,
    },
  ];

  // Get active tab data for panel rendering
  const activeTabData = allTabs.find((t) => t.id === activePanel);

  // Calculate glass opacity from panel opacity setting
  const bgOpacity = (panelOpacity / 100) * 0.15;
  const borderOpacity = (panelOpacity / 100) * 0.2;

  return (
    <>
      {/* Terminal Toggle - blinking >_ that expands to show icons */}
      <TerminalToggle
        tabs={allTabs}
        activeTab={activePanel}
        onTabClick={(id) => handleTabClick(id as PanelId)}
      />

      {/* Sliding Panel - appears when a tab is active */}
      <AnimatePresence>
        {activePanel && activeTabData && (
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

      {/* Click-away backdrop when panel is open */}
      {activePanel && (
        <div
          className="fixed inset-0 z-30 cursor-pointer"
          onClick={() => setActivePanel(null)}
        />
      )}

      {/* BubbleTitle for Wanderers on first daily visit */}
      {showBubbleTitle && (
        <BubbleTitle
          text="The Wanderer"
          onClickAway={handleBubbleTitleDismiss}
          isAnimatingOut={isBubbleTitleAnimatingOut}
        />
      )}
    </>
  );
}
