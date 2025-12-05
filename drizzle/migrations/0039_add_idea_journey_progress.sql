-- Per-idea journey progress tracking
-- Each idea has its own quest state, but rewards are global (one-time per stage)

CREATE TABLE idea_journey_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  current_stage INTEGER NOT NULL DEFAULT 2,  -- Per-idea starts at stage 2
  tasks_completed JSONB NOT NULL DEFAULT '{"stage_2": {}, "stage_3": {}, "stage_4": {}, "stage_5": {}, "stage_6": {}, "stage_7": {}, "stage_8": {}, "stage_9": {}, "stage_10": {}}',
  stages_completed JSONB NOT NULL DEFAULT '{}',
  last_evaluation_at TIMESTAMPTZ,
  last_evaluation_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(idea_id)
);

-- Index for fast lookups by user
CREATE INDEX idx_idea_journey_progress_user_id ON idea_journey_progress(user_id);
