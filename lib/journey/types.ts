/**
 * Journey System Types
 */

import type { FeatureKey, StageKey, TaskKey } from "@/lib/db/schema/journey";

export type ChosenPath = "wanderer" | "sorcerer";

export interface JourneyState {
  userId: string;
  chosenPath: ChosenPath | null;
  currentStage: number;
  totalMana: number;

  // Wanderer specific
  crystallizedSand: number;
  trialDaysEarned: number;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;

  // Sorcerer specific
  manaPoolUnlocked: number;
  bonusManaEarned: number;
  featuresUnlocked: FeatureKey[];
  meditationUnlocked: boolean;
  meditationLevel: number;

  // Progress
  tasksCompleted: TasksCompletedMap;
  stagesCompleted: StagesCompletedMap;

  // Milestones
  wandererPathCompleted: boolean;
  sorcererAscensionCompleted: boolean;

  // Tutorial
  tutorialStep: number;
  tutorialSkipped: boolean;
}

export type TasksCompletedMap = {
  [K in StageKey]: {
    [T in TaskKey]: boolean;
  };
};

export type StagesCompletedMap = {
  [K in StageKey]?: string; // ISO timestamp
};

export interface TaskCompletionResult {
  success: boolean;
  taskCompleted: boolean;
  stageCompleted: boolean;
  manaEarned: number;
  sandEarned: number;
  manaPoolUnlocked: number;
  bonusManaEarned: number;
  featureUnlocked: FeatureKey | null;
  message: string;
}

export interface StageCompletionResult {
  success: boolean;
  stageNumber: number;
  stageName: string;
  sandGranted: number;
  manaPoolGranted: number;
  bonusManaGranted: number;
  featureUnlocked: FeatureKey | null;
  isWandererPathComplete: boolean;
  isSorcererAscensionComplete: boolean;
}

export interface PathSelectionResult {
  success: boolean;
  path: ChosenPath;
  trialEndsAt?: Date;
  message: string;
}
