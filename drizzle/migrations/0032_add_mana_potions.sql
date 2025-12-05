-- Add Mana Potions inventory table
CREATE TABLE IF NOT EXISTS "mana_potions" (
	"user_id" text PRIMARY KEY NOT NULL,
	"small_potions" integer DEFAULT 0 NOT NULL,
	"medium_potions" integer DEFAULT 0 NOT NULL,
	"large_potions" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add foreign key
DO $$ BEGIN
 ALTER TABLE "mana_potions" ADD CONSTRAINT "mana_potions_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add lastMeditationAt to wallets for passive regen tracking
ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "last_meditation_at" timestamp with time zone DEFAULT now() NOT NULL;

-- Update quests table to use potion rewards instead of direct mana
ALTER TABLE "quests" DROP COLUMN IF EXISTS "mana_reward";
ALTER TABLE "quests" ADD COLUMN IF NOT EXISTS "potion_reward" text;
ALTER TABLE "quests" ADD COLUMN IF NOT EXISTS "potion_count" integer DEFAULT 1 NOT NULL;
