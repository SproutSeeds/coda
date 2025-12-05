-- Create Enums
DO $$ BEGIN
 CREATE TYPE "public"."referral_status" AS ENUM('pending', 'completed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."gift_status" AS ENUM('pending', 'accepted', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Alter Wallets Table
ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "booster_balance" integer DEFAULT 0 NOT NULL;
ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "last_core_grant_at" timestamp with time zone;

-- Create Referrals Table
CREATE TABLE IF NOT EXISTS "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inviter_id" text NOT NULL,
	"invitee_id" text NOT NULL,
	"status" "referral_status" DEFAULT 'pending' NOT NULL,
	"rewards_claimed" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create Gifts Table
CREATE TABLE IF NOT EXISTS "gifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"status" "gift_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add Foreign Keys
DO $$ BEGIN
 ALTER TABLE "referrals" ADD CONSTRAINT "referrals_inviter_id_auth_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "referrals" ADD CONSTRAINT "referrals_invitee_id_auth_user_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "gifts" ADD CONSTRAINT "gifts_sender_id_auth_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "gifts" ADD CONSTRAINT "gifts_recipient_id_auth_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create Indexes
CREATE INDEX IF NOT EXISTS "idx_referrals_inviter" ON "referrals" USING btree ("inviter_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_referrals_invitee" ON "referrals" USING btree ("invitee_id");
CREATE INDEX IF NOT EXISTS "idx_gifts_sender" ON "gifts" USING btree ("sender_id");
CREATE INDEX IF NOT EXISTS "idx_gifts_recipient" ON "gifts" USING btree ("recipient_id");
