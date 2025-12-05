-- Create Enums
DO $$ BEGIN
 CREATE TYPE "public"."quest_frequency" AS ENUM('daily', 'weekly', 'story');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."quest_status" AS ENUM('assigned', 'completed', 'claimed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."spell_type" AS ENUM('core', 'custom', 'community');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create Wallets Table (Mana)
CREATE TABLE IF NOT EXISTS "wallets" (
	"user_id" text PRIMARY KEY NOT NULL,
	"mana_balance" integer DEFAULT 0 NOT NULL,
	"max_mana" integer DEFAULT 100 NOT NULL,
	"mana_regen_rate" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create Progression Table (Solo Leveling)
CREATE TABLE IF NOT EXISTS "progression" (
	"user_id" text PRIMARY KEY NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"current_xp" integer DEFAULT 0 NOT NULL,
	"is_awakened" boolean DEFAULT false NOT NULL,
	"awakened_at" timestamp with time zone,
	"is_channeling" boolean DEFAULT false NOT NULL,
	"channeling_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create Quests Table (Daily Rituals)
CREATE TABLE IF NOT EXISTS "quests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"frequency" "quest_frequency" DEFAULT 'daily' NOT NULL,
	"xp_reward" integer DEFAULT 0 NOT NULL,
	"mana_reward" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create User Quests Table
CREATE TABLE IF NOT EXISTS "user_quests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"quest_id" uuid NOT NULL,
	"status" "quest_status" DEFAULT 'assigned' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"target" integer DEFAULT 1 NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"claimed_at" timestamp with time zone
);

-- Create Spells Table (The Registry)
CREATE TABLE IF NOT EXISTS "spells" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "spell_type" DEFAULT 'core' NOT NULL,
	"incantation_template" text NOT NULL,
	"reagents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"base_mana_cost" integer DEFAULT 10 NOT NULL,
	"author_id" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create Grimoire Entries Table (Inventory)
CREATE TABLE IF NOT EXISTS "grimoire_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"spell_id" uuid NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"mastery_level" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create Spell Casts Table (Memories)
CREATE TABLE IF NOT EXISTS "spell_casts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"spell_id" uuid NOT NULL,
	"idea_id" uuid,
	"mana_cost" integer NOT NULL,
	"input_context" jsonb NOT NULL,
	"output_result" text,
	"is_success" boolean DEFAULT true NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add Foreign Keys
DO $$ BEGIN
 ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "progression" ADD CONSTRAINT "progression_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "user_quests" ADD CONSTRAINT "user_quests_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "user_quests" ADD CONSTRAINT "user_quests_quest_id_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "spells" ADD CONSTRAINT "spells_author_id_auth_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."auth_user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "grimoire_entries" ADD CONSTRAINT "grimoire_entries_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "grimoire_entries" ADD CONSTRAINT "grimoire_entries_spell_id_spells_id_fk" FOREIGN KEY ("spell_id") REFERENCES "public"."spells"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "spell_casts" ADD CONSTRAINT "spell_casts_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "spell_casts" ADD CONSTRAINT "spell_casts_spell_id_spells_id_fk" FOREIGN KEY ("spell_id") REFERENCES "public"."spells"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "idx_quests_slug" ON "quests" USING btree ("slug");
CREATE INDEX IF NOT EXISTS "idx_user_quests_user_status" ON "user_quests" USING btree ("user_id","status");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_spells_slug" ON "spells" USING btree ("slug");
CREATE INDEX IF NOT EXISTS "idx_spells_type" ON "spells" USING btree ("type");
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_grimoire_user_spell" ON "grimoire_entries" USING btree ("user_id","spell_id");
CREATE INDEX IF NOT EXISTS "idx_spell_casts_user_spell" ON "spell_casts" USING btree ("user_id","spell_id");
CREATE INDEX IF NOT EXISTS "idx_spell_casts_created_at" ON "spell_casts" USING btree ("created_at");
