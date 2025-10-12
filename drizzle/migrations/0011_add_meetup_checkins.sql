CREATE TABLE "meetup_checkins" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "auth_user"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "event_date" date NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "idx_meetup_checkins_created_at" ON "meetup_checkins" ("created_at");
CREATE INDEX "idx_meetup_checkins_email" ON "meetup_checkins" ("email");
CREATE UNIQUE INDEX "uniq_meetup_checkins_user_event" ON "meetup_checkins" ("user_id", "event_date");
