-- Add quest_hub_last_visit column to progression table
-- Tracks when user last visited quest-hub for daily BubbleTitle greeting

ALTER TABLE progression
ADD COLUMN quest_hub_last_visit TIMESTAMP WITH TIME ZONE;
