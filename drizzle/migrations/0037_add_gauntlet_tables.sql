-- The Sorcerer's Gauntlet - 30-Day Trial Challenge
-- Migration: 0037_add_gauntlet_tables.sql

-- Create gauntlet status enum
DO $$ BEGIN
    CREATE TYPE gauntlet_status AS ENUM ('active', 'completed', 'failed', 'converted');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Main gauntlet tracking table (one per user)
CREATE TABLE IF NOT EXISTS gauntlet (
    user_id TEXT PRIMARY KEY REFERENCES auth_user(id) ON DELETE CASCADE,

    -- Status
    status gauntlet_status NOT NULL DEFAULT 'active',

    -- Trial days tracking
    base_days INTEGER NOT NULL DEFAULT 7,
    earned_days INTEGER NOT NULL DEFAULT 0,

    -- Rest days (allowed missed days before gauntlet fails)
    rest_days_used INTEGER NOT NULL DEFAULT 0,
    max_rest_days INTEGER NOT NULL DEFAULT 3,

    -- Streak tracking
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    total_active_days INTEGER NOT NULL DEFAULT 0,

    -- Key dates
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    trial_expires_at TIMESTAMPTZ NOT NULL,
    last_activity_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,

    -- Rewards
    rewards_claimed BOOLEAN NOT NULL DEFAULT FALSE,
    rewards_claimed_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quest completions within the gauntlet
CREATE TABLE IF NOT EXISTS gauntlet_quest_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,

    -- Quest identification (matches QuestId from constants.ts)
    quest_id TEXT NOT NULL,

    -- Rewards granted
    trial_days_granted INTEGER NOT NULL DEFAULT 0,
    mana_granted INTEGER NOT NULL DEFAULT 0,
    xp_granted INTEGER NOT NULL DEFAULT 0,

    -- Timestamps
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cooldown_ends_at TIMESTAMPTZ
);

-- Index for efficient quest lookups
CREATE INDEX IF NOT EXISTS idx_gauntlet_quest_completions_user ON gauntlet_quest_completions(user_id, quest_id);
CREATE INDEX IF NOT EXISTS idx_gauntlet_quest_completions_cooldown ON gauntlet_quest_completions(user_id, cooldown_ends_at);

-- Earned cosmetic rewards from gauntlet completion
CREATE TABLE IF NOT EXISTS gauntlet_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,

    -- Reward identification
    reward_id TEXT NOT NULL,
    reward_type TEXT NOT NULL,

    -- For discount rewards
    discount_percent INTEGER,
    discount_used BOOLEAN NOT NULL DEFAULT FALSE,
    discount_used_at TIMESTAMPTZ,

    -- Timestamps
    earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint on user + reward
CREATE UNIQUE INDEX IF NOT EXISTS uniq_gauntlet_rewards_user_reward ON gauntlet_rewards(user_id, reward_id);
