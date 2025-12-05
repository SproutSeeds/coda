-- Add webhook events table for tracking Stripe webhook processing
-- This provides an audit trail for debugging and ensuring webhook reliability

-- Create enum for webhook event status
CREATE TYPE "webhook_event_status" AS ENUM ('received', 'processing', 'completed', 'failed');

-- Create webhook events table
CREATE TABLE IF NOT EXISTS "webhook_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "stripe_event_id" text NOT NULL UNIQUE,
  "event_type" text NOT NULL,
  "user_id" text,
  "status" "webhook_event_status" DEFAULT 'received' NOT NULL,
  "payload" jsonb,
  "error_message" text,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "processed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes for efficient querying
CREATE UNIQUE INDEX IF NOT EXISTS "idx_webhook_events_stripe_event" ON "webhook_events" ("stripe_event_id");
CREATE INDEX IF NOT EXISTS "idx_webhook_events_status" ON "webhook_events" ("status");
CREATE INDEX IF NOT EXISTS "idx_webhook_events_user" ON "webhook_events" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_webhook_events_created" ON "webhook_events" ("created_at");
