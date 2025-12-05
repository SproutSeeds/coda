-- The Journey System: Wanderer's Path + Sorcerer's Ascension
-- Everyone walks the path. Wanderers earn time. Sorcerers unlock mana.

-- Create enum for chosen path
DO $$ BEGIN
  CREATE TYPE chosen_path AS ENUM ('wanderer', 'sorcerer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add path choice and trial tracking to users
ALTER TABLE auth_user
  ADD COLUMN IF NOT EXISTS chosen_path chosen_path,
  ADD COLUMN IF NOT EXISTS path_chosen_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- Create index for trial expiration queries
CREATE INDEX IF NOT EXISTS idx_auth_user_trial_ends_at ON auth_user(trial_ends_at) WHERE trial_ends_at IS NOT NULL;

-- Journey progress table
CREATE TABLE IF NOT EXISTS journey_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,

  -- Current position
  current_stage integer NOT NULL DEFAULT 1, -- 1-10

  -- Resources earned
  total_mana integer NOT NULL DEFAULT 0, -- Mana generated through creation
  mana_pool_unlocked integer NOT NULL DEFAULT 0, -- Sorcerer: unlocked from 200k pool (stages 1-5)
  bonus_mana_earned integer NOT NULL DEFAULT 0, -- Sorcerer: bonus from stages 6-10
  crystallized_sand integer NOT NULL DEFAULT 0, -- Wanderer: scoops earned (1 scoop = 1 day)

  -- Task completion tracking (JSONB)
  tasks_completed jsonb NOT NULL DEFAULT '{
    "stage_1": {"task_1": false, "task_2": false, "task_3": false, "task_4": false, "task_5": false},
    "stage_2": {"task_1": false, "task_2": false, "task_3": false, "task_4": false, "task_5": false},
    "stage_3": {"task_1": false, "task_2": false, "task_3": false, "task_4": false, "task_5": false},
    "stage_4": {"task_1": false, "task_2": false, "task_3": false, "task_4": false, "task_5": false},
    "stage_5": {"task_1": false, "task_2": false, "task_3": false, "task_4": false, "task_5": false},
    "stage_6": {"task_1": false, "task_2": false, "task_3": false, "task_4": false, "task_5": false},
    "stage_7": {"task_1": false, "task_2": false, "task_3": false, "task_4": false, "task_5": false},
    "stage_8": {"task_1": false, "task_2": false, "task_3": false, "task_4": false, "task_5": false},
    "stage_9": {"task_1": false, "task_2": false, "task_3": false, "task_4": false, "task_5": false},
    "stage_10": {"task_1": false, "task_2": false, "task_3": false, "task_4": false, "task_5": false}
  }'::jsonb,

  -- Stage completion timestamps
  stages_completed jsonb NOT NULL DEFAULT '{}'::jsonb, -- {"stage_1": "2025-01-15T...", ...}

  -- Feature unlocks (Sorcerer only)
  features_unlocked jsonb NOT NULL DEFAULT '[]'::jsonb, -- ["ai", "devmode", "collaboration", "meditation"]

  -- Meditation (unlocked at stage 10)
  meditation_unlocked boolean NOT NULL DEFAULT false,
  meditation_level integer NOT NULL DEFAULT 0,

  -- Journey milestones
  wanderer_path_completed_at timestamptz, -- Stages 1-5 done
  sorcerer_ascension_completed_at timestamptz, -- Stages 6-10 done

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT journey_progress_user_unique UNIQUE(user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_journey_progress_user ON journey_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_journey_progress_stage ON journey_progress(current_stage);

-- Task completion history (for analytics and preventing re-completion)
CREATE TABLE IF NOT EXISTS journey_task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,

  stage integer NOT NULL, -- 1-10
  task integer NOT NULL, -- 1-5

  -- What was earned
  mana_earned integer NOT NULL DEFAULT 0,
  sand_earned integer NOT NULL DEFAULT 0, -- In tenths of scoops for precision

  -- Context
  action_type text NOT NULL, -- e.g., 'create_idea', 'add_feature', 'star_idea'
  action_reference_id text, -- ID of the entity that triggered completion

  completed_at timestamptz NOT NULL DEFAULT now(),

  -- Prevent duplicate completions
  CONSTRAINT journey_task_unique UNIQUE(user_id, stage, task)
);

CREATE INDEX IF NOT EXISTS idx_journey_task_completions_user ON journey_task_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_journey_task_completions_stage ON journey_task_completions(user_id, stage);

-- Stage completion history
CREATE TABLE IF NOT EXISTS journey_stage_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,

  stage integer NOT NULL, -- 1-10

  -- Rewards granted
  sand_granted integer NOT NULL DEFAULT 0, -- Scoops (Wanderer)
  mana_pool_granted integer NOT NULL DEFAULT 0, -- Unlocked mana (Sorcerer stages 1-5)
  bonus_mana_granted integer NOT NULL DEFAULT 0, -- Bonus mana (Sorcerer stages 6-10)
  feature_unlocked text, -- Feature key unlocked (stages 6-10)

  completed_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT journey_stage_unique UNIQUE(user_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_journey_stage_completions_user ON journey_stage_completions(user_id);
