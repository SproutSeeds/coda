/**
 * The Journey System Constants
 *
 * Everyone walks the same path. The difference is what you earn:
 * - Wanderer: Earns crystallized sand (time)
 * - Sorcerer: Unlocks mana pool + features
 */

import type { FeatureKey, StageKey, TaskKey } from "@/lib/db/schema/journey";

// =============================================================================
// JOURNEY CONSTANTS
// =============================================================================

export const JOURNEY = {
  /** Total stages in the journey */
  totalStages: 10,

  /** Stages 1-5: The Wanderer's Path (available to all) */
  wandererPathStages: 5,

  /** Stages 6-10: The Sorcerer's Ascension (requires subscription) */
  sorcererAscensionStages: 5,

  /** Tasks per stage */
  tasksPerStage: 5,

  /** Mana generated per task completion */
  manaPerTask: 10,

  /** Mana per stage (5 tasks × 10 mana) */
  manaPerStage: 50,
} as const;

// =============================================================================
// WANDERER REWARDS
// =============================================================================

export const WANDERER_REWARDS = {
  /** Scoops of crystallized sand per stage (1 scoop = 1 day) */
  sandPerStage: 6,

  /** Total sand earnable (5 stages × 6 scoops) */
  totalSand: 30,

  /** Days per scoop of sand */
  daysPerScoop: 1,

  /** Total days earnable */
  totalDays: 30,
} as const;

// =============================================================================
// SORCERER REWARDS
// =============================================================================

export const SORCERER_REWARDS = {
  /** Mana pool unlocked per stage (stages 1-5) */
  manaPoolPerStage: 40_000,

  /** Total mana pool (5 stages × 40k) */
  totalManaPool: 200_000,

  /** Bonus mana per ascension stage (stages 6-10) */
  bonusManaPerStage: 10_000,

  /** Total bonus mana (5 stages × 10k) */
  totalBonusMana: 50_000,

  /** Grand total mana for completing all 10 stages */
  grandTotalMana: 250_000,
} as const;

// =============================================================================
// FEATURE UNLOCKS (Sorcerer Stages 6-10)
// =============================================================================

export const FEATURE_UNLOCKS: Record<number, FeatureKey | null> = {
  6: "ai",
  7: "devmode",
  8: "advanced",
  9: "collaboration",
  10: "meditation",
} as const;

// =============================================================================
// TASK DEFINITIONS
// =============================================================================

export type TaskDefinition = {
  id: TaskKey;
  name: string;
  description: string;
  actionType: string; // The action that triggers completion
  /** Additional conditions to check (e.g., "count >= 3") */
  condition?: string;
};

export type StageDefinition = {
  id: StageKey;
  number: number;
  name: string;
  theme: string;
  description: string;
  tasks: TaskDefinition[];
  /** What wanderers earn */
  wandererReward: {
    sand: number;
    description: string;
  };
  /** What sorcerers earn */
  sorcererReward: {
    manaPool?: number; // Stages 1-5
    bonusMana?: number; // Stages 6-10
    featureUnlock?: FeatureKey; // Stages 6-10
    description: string;
  };
  /** Whether this stage requires sorcerer subscription */
  requiresSorcerer: boolean;
};

// =============================================================================
// PART I: THE WANDERER'S PATH (Stages 1-5)
// =============================================================================

export const WANDERER_PATH_STAGES: StageDefinition[] = [
  {
    id: "stage_1",
    number: 1,
    name: "Awakening",
    theme: "The first spark",
    description: "Begin your journey and create your first vision.",
    tasks: [
      {
        id: "task_1",
        name: "Enter the workshop",
        description: "Visit the dashboard",
        actionType: "visit_dashboard",
      },
      {
        id: "task_2",
        name: "Name your vision",
        description: "Create an idea with a title",
        actionType: "create_idea",
      },
      {
        id: "task_3",
        name: "Give it form",
        description: "Add notes to your idea",
        actionType: "add_idea_notes",
      },
      {
        id: "task_4",
        name: "See it manifest",
        description: "View your idea in the list",
        actionType: "view_ideas_list",
      },
      {
        id: "task_5",
        name: "Return to your creation",
        description: "Open your idea's detail page",
        actionType: "view_idea_detail",
      },
    ],
    wandererReward: {
      sand: 6,
      description: "+6 scoops of crystallized sand (+6 days)",
    },
    sorcererReward: {
      manaPool: 40_000,
      description: "Unlocks 40,000 mana",
    },
    requiresSorcerer: false,
  },
  {
    id: "stage_2",
    number: 2,
    name: "First Sketch",
    theme: "Giving form to the formless",
    description: "Break down your vision into features.",
    tasks: [
      {
        id: "task_1",
        name: "Break it down",
        description: "Add your first feature",
        actionType: "create_feature",
      },
      {
        id: "task_2",
        name: "And another",
        description: "Add a second feature",
        actionType: "create_feature",
        condition: "feature_count >= 2",
      },
      {
        id: "task_3",
        name: "Describe the piece",
        description: "Add notes to a feature",
        actionType: "add_feature_notes",
      },
      {
        id: "task_4",
        name: "Go deeper",
        description: "Add detail to a feature",
        actionType: "add_feature_detail",
      },
      {
        id: "task_5",
        name: "Shape takes hold",
        description: "Have 3+ features on one idea",
        actionType: "create_feature",
        condition: "idea_feature_count >= 3",
      },
    ],
    wandererReward: {
      sand: 6,
      description: "+6 scoops of crystallized sand (+6 days)",
    },
    sorcererReward: {
      manaPool: 40_000,
      description: "Unlocks 40,000 mana",
    },
    requiresSorcerer: false,
  },
  {
    id: "stage_3",
    number: 3,
    name: "Taking Shape",
    theme: "Refinement and structure",
    description: "Add structure and prioritize what matters in this idea.",
    tasks: [
      {
        id: "task_1",
        name: "Mark what matters",
        description: "Star a feature",
        actionType: "star_feature",
      },
      {
        id: "task_2",
        name: "Arrange your thoughts",
        description: "Reorder features",
        actionType: "reorder_features",
      },
      {
        id: "task_3",
        name: "The workshop grows",
        description: "Have 5+ features on this idea",
        actionType: "create_feature",
        condition: "idea_feature_count >= 5",
      },
      {
        id: "task_4",
        name: "Structure emerges",
        description: "Add detail sections to a feature",
        actionType: "add_feature_detail",
        condition: "has_detail_sections",
      },
      {
        id: "task_5",
        name: "Foundation set",
        description: "All features have notes",
        actionType: "add_feature_notes",
        condition: "all_features_have_notes",
      },
    ],
    wandererReward: {
      sand: 6,
      description: "+6 scoops of crystallized sand (+6 days)",
    },
    sorcererReward: {
      manaPool: 40_000,
      description: "Unlocks 40,000 mana",
    },
    requiresSorcerer: false,
  },
  {
    id: "stage_4",
    number: 4,
    name: "The Craftsman's Mark",
    theme: "Completion and refinement",
    description: "Complete your work and refine your vision.",
    tasks: [
      {
        id: "task_1",
        name: "First completion",
        description: "Mark a feature complete",
        actionType: "complete_feature",
      },
      {
        id: "task_2",
        name: "Refine the vision",
        description: "Edit an idea's title",
        actionType: "edit_idea_title",
      },
      {
        id: "task_3",
        name: "Deepen the description",
        description: "Edit an idea's notes",
        actionType: "edit_idea_notes",
      },
      {
        id: "task_4",
        name: "Polish a facet",
        description: "Edit a feature",
        actionType: "edit_feature",
      },
      {
        id: "task_5",
        name: "Steady progress",
        description: "Complete a second feature",
        actionType: "complete_feature",
        condition: "completed_feature_count >= 2",
      },
    ],
    wandererReward: {
      sand: 6,
      description: "+6 scoops of crystallized sand (+6 days)",
    },
    sorcererReward: {
      manaPool: 40_000,
      description: "Unlocks 40,000 mana",
    },
    requiresSorcerer: false,
  },
  {
    id: "stage_5",
    number: 5,
    name: "The Connected Workshop",
    theme: "Mastery of the basics",
    description: "Master the advanced features and complete the foundation.",
    tasks: [
      {
        id: "task_1",
        name: "Elevate importance",
        description: "Super-star an idea",
        actionType: "super_star_idea",
      },
      {
        id: "task_2",
        name: "Link to the world",
        description: "Add a GitHub URL",
        actionType: "add_github_url",
      },
      {
        id: "task_3",
        name: "Preserve your work",
        description: "Export an idea as JSON",
        actionType: "export_idea",
      },
      {
        id: "task_4",
        name: "Shape from shape",
        description: "Convert a feature to an idea",
        actionType: "convert_feature_to_idea",
      },
      {
        id: "task_5",
        name: "Foundation complete",
        description: "View your path progress",
        actionType: "view_path_complete",
      },
    ],
    wandererReward: {
      sand: 6,
      description: "+6 scoops of crystallized sand (+6 days)",
    },
    sorcererReward: {
      manaPool: 40_000,
      description: "Unlocks 40,000 mana (200k total!)",
    },
    requiresSorcerer: false,
  },
];

// =============================================================================
// PART II: THE SORCERER'S ASCENSION (Stages 6-10)
// =============================================================================

export const SORCERER_ASCENSION_STAGES: StageDefinition[] = [
  {
    id: "stage_6",
    number: 6,
    name: "The Oracle's Gift",
    theme: "First contact with intelligence",
    description: "Connect with the AI Oracle and receive its wisdom.",
    tasks: [
      {
        id: "task_1",
        name: "Seek the Oracle",
        description: "Open the AI assistant panel",
        actionType: "open_ai_panel",
      },
      {
        id: "task_2",
        name: "Ask a question",
        description: "Send your first message to the Oracle",
        actionType: "send_ai_message",
      },
      {
        id: "task_3",
        name: "Apply the wisdom",
        description: "Use AI suggestion in your idea",
        actionType: "apply_ai_suggestion",
      },
      {
        id: "task_4",
        name: "Deeper inquiry",
        description: "Have a 3+ message conversation",
        actionType: "ai_conversation",
        condition: "ai_message_count >= 3",
      },
      {
        id: "task_5",
        name: "The Oracle knows you",
        description: "AI references your existing ideas",
        actionType: "ai_context_reference",
      },
    ],
    wandererReward: {
      sand: 0,
      description: "Requires Sorcerer subscription",
    },
    sorcererReward: {
      bonusMana: 10_000,
      featureUnlock: "ai",
      description: "+10,000 bonus mana + AI Assistant unlocked",
    },
    requiresSorcerer: true,
  },
  {
    id: "stage_7",
    number: 7,
    name: "The Codex Opens",
    theme: "Your ideas become living code",
    description: "Connect your workshop to the realm of code.",
    tasks: [
      {
        id: "task_1",
        name: "Summon the companion",
        description: "Download the Runner Companion app",
        actionType: "download_runner",
      },
      {
        id: "task_2",
        name: "Establish the link",
        description: "Pair your device with Coda",
        actionType: "pair_device",
      },
      {
        id: "task_3",
        name: "Open the portal",
        description: "Launch your first terminal session",
        actionType: "open_terminal",
      },
      {
        id: "task_4",
        name: "Speak to the machine",
        description: "Execute a command",
        actionType: "execute_command",
      },
      {
        id: "task_5",
        name: "The codex lives",
        description: "Run a dev server or build command",
        actionType: "run_dev_command",
      },
    ],
    wandererReward: {
      sand: 0,
      description: "Requires Sorcerer subscription",
    },
    sorcererReward: {
      bonusMana: 10_000,
      featureUnlock: "devmode",
      description: "+10,000 bonus mana + DevMode unlocked",
    },
    requiresSorcerer: true,
  },
  {
    id: "stage_8",
    number: 8,
    name: "The Scribe's Discipline",
    theme: "Organization and systematic creation",
    description: "Master the art of structured documentation.",
    tasks: [
      {
        id: "task_1",
        name: "Structure the chaos",
        description: "Create a detail section on a feature",
        actionType: "create_detail_section",
      },
      {
        id: "task_2",
        name: "And another section",
        description: "Add a second detail section",
        actionType: "create_detail_section",
        condition: "section_count >= 2",
      },
      {
        id: "task_3",
        name: "Name your sections",
        description: "Customize a section label",
        actionType: "edit_section_label",
      },
      {
        id: "task_4",
        name: "The pattern emerges",
        description: "Have 3+ sections on one feature",
        actionType: "create_detail_section",
        condition: "feature_section_count >= 3",
      },
      {
        id: "task_5",
        name: "Master of organization",
        description: "Use sections on 3 different features",
        actionType: "create_detail_section",
        condition: "features_with_sections >= 3",
      },
    ],
    wandererReward: {
      sand: 0,
      description: "Requires Sorcerer subscription",
    },
    sorcererReward: {
      bonusMana: 10_000,
      featureUnlock: "advanced",
      description: "+10,000 bonus mana + Advanced Features unlocked",
    },
    requiresSorcerer: true,
  },
  {
    id: "stage_9",
    number: 9,
    name: "The Circle Expands",
    theme: "Collaboration and sharing",
    description: "Open your workshop to allies and collaborators.",
    tasks: [
      {
        id: "task_1",
        name: "Open the gates",
        description: "Make an idea public",
        actionType: "make_idea_public",
      },
      {
        id: "task_2",
        name: "Send an invitation",
        description: "Invite a collaborator to an idea",
        actionType: "invite_collaborator",
      },
      {
        id: "task_3",
        name: "Wisdom shared",
        description: "Have someone view your public idea",
        actionType: "public_idea_viewed",
      },
      {
        id: "task_4",
        name: "The guild grows",
        description: "Accept a join request",
        actionType: "accept_join_request",
      },
      {
        id: "task_5",
        name: "Creation together",
        description: "A collaborator edits your idea",
        actionType: "collaborator_edit",
      },
    ],
    wandererReward: {
      sand: 0,
      description: "Requires Sorcerer subscription",
    },
    sorcererReward: {
      bonusMana: 10_000,
      featureUnlock: "collaboration",
      description: "+10,000 bonus mana + Collaboration unlocked",
    },
    requiresSorcerer: true,
  },
  {
    id: "stage_10",
    number: 10,
    name: "The Meditation Chamber",
    theme: "Inner mastery, sustained power",
    description: "Unlock the power of passive mana regeneration.",
    tasks: [
      {
        id: "task_1",
        name: "Enter the chamber",
        description: "Visit the Meditation page",
        actionType: "visit_meditation",
      },
      {
        id: "task_2",
        name: "First meditation",
        description: "Initiate a meditation session",
        actionType: "start_meditation",
      },
      {
        id: "task_3",
        name: "Sustained focus",
        description: "Maintain meditation for 1 hour",
        actionType: "meditation_duration",
        condition: "meditation_minutes >= 60",
      },
      {
        id: "task_4",
        name: "Daily practice",
        description: "Meditate on 3 different days",
        actionType: "meditation_days",
        condition: "meditation_days >= 3",
      },
      {
        id: "task_5",
        name: "Inner mastery",
        description: "Reach meditation level 2",
        actionType: "meditation_level",
        condition: "meditation_level >= 2",
      },
    ],
    wandererReward: {
      sand: 0,
      description: "Requires Sorcerer subscription",
    },
    sorcererReward: {
      bonusMana: 10_000,
      featureUnlock: "meditation",
      description: "+10,000 bonus mana + Meditation unlocked",
    },
    requiresSorcerer: true,
  },
];

// =============================================================================
// COMBINED STAGES
// =============================================================================

export const ALL_STAGES: StageDefinition[] = [
  ...WANDERER_PATH_STAGES,
  ...SORCERER_ASCENSION_STAGES,
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function getStageById(stageId: StageKey): StageDefinition | undefined {
  return ALL_STAGES.find((s) => s.id === stageId);
}

export function getStageByNumber(stageNumber: number): StageDefinition | undefined {
  return ALL_STAGES.find((s) => s.number === stageNumber);
}

export function getTaskDefinition(stageNumber: number, taskNumber: number): TaskDefinition | undefined {
  const stage = getStageByNumber(stageNumber);
  if (!stage) return undefined;
  return stage.tasks.find((t) => t.id === `task_${taskNumber}`);
}

export function isWandererStage(stageNumber: number): boolean {
  return stageNumber >= 1 && stageNumber <= 5;
}

export function isSorcererStage(stageNumber: number): boolean {
  return stageNumber >= 6 && stageNumber <= 10;
}

export function getFeatureUnlockForStage(stageNumber: number): FeatureKey | null {
  return FEATURE_UNLOCKS[stageNumber] ?? null;
}

// =============================================================================
// MESSAGES
// =============================================================================

export const JOURNEY_MESSAGES = {
  wandererPathComplete: {
    title: "The Wanderer's Path Complete",
    body: "You have walked the path and earned your time. The workshop is yours for 30 days. Create wisely, wanderer.",
  },
  sorcererFoundationComplete: {
    title: "Foundation Complete",
    body: "Your mana pool awakens. 200,000 mana flows through your grimoire. But greater power awaits those who continue the ascension...",
  },
  sorcererAscensionComplete: {
    title: "Ascension Complete",
    body: "You have mastered all paths. 250,000 mana is yours. All powers are unlocked. The workshop bends to your will.",
  },
  stageComplete: (stageName: string) => ({
    title: `${stageName} Complete`,
    body: "Your power grows. Continue the journey.",
  }),
  taskComplete: (taskName: string) => ({
    title: "Task Complete",
    body: `"${taskName}" - Mana manifests from within.`,
  }),
} as const;
