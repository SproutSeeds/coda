"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  Check,
  Lock,
  Sparkles,
  Clock,
  Zap,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { JourneyState } from "@/lib/journey/types";
import type { StageDefinition, TaskDefinition } from "@/lib/journey/constants";
import type { StageKey, TaskKey } from "@/lib/db/schema/journey";

// How-to instructions for each task action type
const TASK_INSTRUCTIONS: Record<string, { steps: string[]; link?: string }> = {
  visit_dashboard: {
    steps: ["Click on 'Coda CLI' in the top left corner", "Or navigate to /dashboard/ideas"],
    link: "/dashboard/ideas",
  },
  create_idea: {
    steps: ["Go to your Ideas dashboard", "Click the '+ New Idea' button", "Enter a title for your idea"],
    link: "/dashboard/ideas",
  },
  add_idea_notes: {
    steps: ["Open any idea by clicking on it", "Find the Notes section below the title", "Type your notes and they'll auto-save"],
  },
  view_ideas_list: {
    steps: ["Navigate to the Ideas dashboard", "Your ideas will be displayed in a list"],
    link: "/dashboard/ideas",
  },
  view_idea_detail: {
    steps: ["Click on any idea card in your list", "The detail page shows all features and notes"],
  },
  create_feature: {
    steps: ["Open an idea's detail page", "Click '+ Add Feature' at the bottom", "Give your feature a title"],
  },
  add_feature_notes: {
    steps: ["Expand a feature by clicking on it", "Find the Notes field", "Type your notes"],
  },
  add_feature_detail: {
    steps: ["Expand a feature", "Click 'Add Detail' or expand the detail section", "Write detailed information about the feature"],
  },
  star_idea: {
    steps: ["Hover over any idea card", "Click the star icon to mark it as important", "Starred ideas appear at the top"],
  },
  star_feature: {
    steps: ["Expand a feature", "Click the star icon next to the feature title"],
  },
  reorder_features: {
    steps: ["On an idea's detail page", "Drag and drop features to reorder them", "Use the grip handle on the left side"],
  },
  complete_feature: {
    steps: ["Expand a feature", "Click the checkbox to mark it complete", "Completed features show a strikethrough"],
  },
  edit_idea_title: {
    steps: ["Click on the idea title", "Edit the text directly", "Changes auto-save"],
  },
  edit_idea_notes: {
    steps: ["Click on the idea's notes section", "Edit the text", "Changes auto-save"],
  },
  edit_feature: {
    steps: ["Expand a feature", "Click on any text field to edit", "Changes auto-save"],
  },
  super_star_idea: {
    steps: ["Click the star icon twice on an idea", "First click = starred, second click = super-starred", "Super-starred ideas have a golden glow"],
  },
  add_github_url: {
    steps: ["Open an idea's detail page", "Find the 'GitHub URL' field", "Paste your repository URL"],
  },
  export_idea: {
    steps: ["Open an idea's detail page", "Click the '...' menu in the top right", "Select 'Export as JSON'"],
  },
  convert_feature_to_idea: {
    steps: ["Expand a feature", "Click the '...' menu on the feature", "Select 'Convert to Idea'"],
  },
  view_path_complete: {
    steps: ["You're already here!", "Complete all previous tasks to finish this stage"],
    link: "/dashboard/path",
  },
  // Sorcerer stages (placeholders for future features)
  open_ai_panel: {
    steps: ["Open an idea's detail page", "Click the 'AI Assistant' button", "The AI panel will open on the right"],
  },
  send_ai_message: {
    steps: ["Open the AI panel", "Type a question or request", "Press Enter to send"],
  },
  apply_ai_suggestion: {
    steps: ["After receiving an AI response", "Click 'Apply' on a suggestion", "The suggestion will be added to your idea"],
  },
  ai_conversation: {
    steps: ["Continue chatting with the AI", "Ask follow-up questions", "Build on previous responses"],
  },
  ai_context_reference: {
    steps: ["Ask the AI about your existing ideas", "It will reference your content in responses"],
  },
  download_runner: {
    steps: ["Go to Settings or the DevMode page", "Click 'Download Companion App'", "Install the app on your computer"],
  },
  pair_device: {
    steps: ["Open the Runner Companion app", "Click 'Pair with Coda'", "Enter the pairing code shown in your browser"],
  },
  open_terminal: {
    steps: ["With a paired device", "Click 'New Terminal' on any idea", "A terminal session will open"],
  },
  execute_command: {
    steps: ["In an open terminal", "Type any command", "Press Enter to execute"],
  },
  run_dev_command: {
    steps: ["In a terminal session", "Run a dev server: npm run dev, pnpm dev, etc.", "Or run a build command"],
  },
  create_detail_section: {
    steps: ["Expand a feature", "Click 'Add Section' in the detail area", "Name your section"],
  },
  edit_section_label: {
    steps: ["Find an existing section", "Click on the section label", "Edit the name"],
  },
  make_idea_public: {
    steps: ["Open an idea's settings", "Toggle 'Make Public'", "Your idea will be visible to others"],
  },
  invite_collaborator: {
    steps: ["Open an idea's settings", "Click 'Invite Collaborator'", "Enter their email address"],
  },
  public_idea_viewed: {
    steps: ["Share your public idea link", "When someone views it, this task completes"],
  },
  accept_join_request: {
    steps: ["Check your notifications", "Find a join request", "Click 'Accept'"],
  },
  collaborator_edit: {
    steps: ["Have a collaborator make changes", "They need to edit any part of your shared idea"],
  },
  visit_meditation: {
    steps: ["Navigate to the Meditation page", "Find it in your dashboard menu"],
  },
  start_meditation: {
    steps: ["On the Meditation page", "Click 'Begin Meditation'", "The timer will start"],
  },
  meditation_duration: {
    steps: ["Start a meditation session", "Keep it running for the required time"],
  },
  meditation_days: {
    steps: ["Meditate on different calendar days", "Each day counts once"],
  },
  meditation_level: {
    steps: ["Continue meditating regularly", "Your level increases with practice"],
  },
};

// Expandable Task Item Component
function TaskItem({
  task,
  isComplete,
  instructions,
  isWanderer,
}: {
  task: TaskDefinition;
  isComplete: boolean;
  instructions?: { steps: string[]; link?: string };
  isWanderer: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={cn(
        "rounded-lg overflow-hidden transition-all",
        isComplete ? "bg-green-500/10" : "bg-muted/30 cursor-pointer"
      )}
    >
      {/* Task Header - Clickable */}
      <button
        onClick={() => !isComplete && setIsExpanded(!isExpanded)}
        disabled={isComplete}
        className={cn(
          "w-full flex items-start gap-3 p-3 text-left transition-colors cursor-pointer",
          !isComplete && "hover:bg-muted/50"
        )}
      >
        <div
          className={cn(
            "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5",
            isComplete
              ? "bg-green-500 text-white"
              : "border-2 border-muted-foreground/30"
          )}
        >
          {isComplete && <Check className="w-3 h-3" />}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "font-medium text-sm",
              isComplete && "line-through opacity-70"
            )}
          >
            {task.name}
          </p>
          <p className="text-xs text-muted-foreground">{task.description}</p>
        </div>
        {isComplete ? (
          <Sparkles className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
        ) : (
          <ChevronRight
            className={cn(
              "w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5 transition-transform",
              isExpanded && "rotate-90"
            )}
          />
        )}
      </button>

      {/* Expanded Instructions */}
      <AnimatePresence>
        {isExpanded && !isComplete && instructions && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 ml-8 border-t border-border/30">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                How to complete:
              </p>
              <ol className="space-y-1.5">
                {instructions.steps.map((step, index) => (
                  <li key={index} className="flex items-start gap-2 text-xs">
                    <span
                      className={cn(
                        "flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-medium",
                        isWanderer
                          ? "bg-primary/20 text-primary"
                          : "bg-amber-500/20 text-amber-500"
                      )}
                    >
                      {index + 1}
                    </span>
                    <span className="text-foreground/80">{step}</span>
                  </li>
                ))}
              </ol>
              {instructions.link && (
                <Link
                  href={instructions.link}
                  className={cn(
                    "mt-3 inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-colors",
                    isWanderer
                      ? "text-primary hover:text-primary/80"
                      : "text-amber-500 hover:text-amber-400"
                  )}
                >
                  Go there now
                  <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface StageCardProps {
  stage: StageDefinition;
  journeyState: JourneyState;
  isWanderer: boolean;
  isAccessible: boolean;
  isComplete: boolean;
  isLocked?: boolean;
}

export function StageCard({
  stage,
  journeyState,
  isWanderer,
  isAccessible,
  isComplete,
  isLocked = false,
}: StageCardProps) {
  const [isExpanded, setIsExpanded] = useState(
    isAccessible && !isComplete && stage.number === journeyState.currentStage
  );

  const stageKey = stage.id as StageKey;
  const stageTasks = journeyState.tasksCompleted[stageKey];
  const completedTaskCount = stageTasks
    ? Object.values(stageTasks).filter(Boolean).length
    : 0;

  const isCurrent = stage.number === journeyState.currentStage && !isComplete;

  // Get reward display
  const reward = isWanderer ? stage.wandererReward : stage.sorcererReward;

  return (
    <div
      className={cn(
        "rounded-xl border transition-all duration-200",
        isLocked ? "opacity-60" : "cursor-pointer",
        isComplete
          ? "border-green-500/30 bg-green-500/5"
          : isCurrent
          ? isWanderer
            ? "border-primary/50 bg-primary/5"
            : "border-amber-500/50 bg-amber-500/5"
          : "border-border bg-card"
      )}
    >
      {/* Header */}
      <button
        onClick={() => !isLocked && setIsExpanded(!isExpanded)}
        disabled={isLocked}
        className={cn(
          "w-full flex items-center gap-4 p-4 text-left",
          !isLocked && "cursor-pointer hover:bg-muted/30 transition-colors"
        )}
      >
        {/* Stage Number/Status */}
        <div
          className={cn(
            "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-semibold",
            isComplete
              ? "bg-green-500 text-white"
              : isCurrent
              ? isWanderer
                ? "bg-primary text-primary-foreground"
                : "bg-amber-500 text-black"
              : isLocked
              ? "bg-muted text-muted-foreground"
              : "bg-muted text-foreground"
          )}
        >
          {isComplete ? (
            <Check className="w-5 h-5" />
          ) : isLocked ? (
            <Lock className="w-4 h-4" />
          ) : (
            stage.number
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{stage.name}</h3>
            {isCurrent && (
              <span
                className={cn(
                  "px-2 py-0.5 text-xs font-medium rounded-full",
                  isWanderer
                    ? "bg-primary/20 text-primary"
                    : "bg-amber-500/20 text-amber-500"
                )}
              >
                Current
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">{stage.theme}</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-sm font-medium">
              {completedTaskCount} / {stage.tasks.length}
            </span>
            <p className="text-xs text-muted-foreground">tasks</p>
          </div>

          {!isLocked && (
            <ChevronDown
              className={cn(
                "w-5 h-5 text-muted-foreground transition-transform",
                isExpanded && "rotate-180"
              )}
            />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && !isLocked && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-border/50">
              {/* Stage Description */}
              <p className="mt-4 text-sm text-muted-foreground">
                {stage.description}
              </p>

              {/* Tasks */}
              <div className="mt-4 space-y-2">
                {stage.tasks.map((task) => {
                  const taskKey = task.id as TaskKey;
                  const isTaskComplete = stageTasks?.[taskKey] ?? false;
                  const instructions = TASK_INSTRUCTIONS[task.actionType];

                  return (
                    <TaskItem
                      key={task.id}
                      task={task}
                      isComplete={isTaskComplete}
                      instructions={instructions}
                      isWanderer={isWanderer}
                    />
                  );
                })}
              </div>

              {/* Reward */}
              <div
                className={cn(
                  "mt-4 p-3 rounded-lg flex items-center gap-3",
                  isComplete
                    ? "bg-green-500/10 border border-green-500/30"
                    : "bg-muted/50 border border-border"
                )}
              >
                {isWanderer ? (
                  <Clock className="w-5 h-5 text-primary flex-shrink-0" />
                ) : (
                  <Zap className="w-5 h-5 text-amber-500 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">Stage Reward</p>
                  <p className="text-xs text-muted-foreground">
                    {reward.description}
                  </p>
                </div>
                {isComplete && (
                  <span className="text-xs font-medium text-green-500 bg-green-500/20 px-2 py-1 rounded-full">
                    Claimed
                  </span>
                )}
              </div>

              {/* Feature Unlock (Sorcerer stages 6-10) */}
              {stage.sorcererReward.featureUnlock && (
                <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <p className="text-sm font-medium text-amber-500">
                    Unlocks: {getFeatureDisplayName(stage.sorcererReward.featureUnlock)}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function getFeatureDisplayName(feature: string): string {
  const names: Record<string, string> = {
    ai: "AI Assistant",
    devmode: "DevMode Terminals",
    advanced: "Advanced Features",
    collaboration: "Collaboration",
    meditation: "Meditation (Passive Regen)",
  };
  return names[feature] ?? feature;
}
