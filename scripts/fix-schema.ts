import { getDb } from "../lib/db";
import { sql } from "drizzle-orm";

const db = getDb();

async function fixSchema() {
    console.log("Fixing schema...");

    try {
        // 1. Fix Wallets Table
        console.log("Adding missing columns to wallets...");
        await db.execute(sql`
      ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "last_meditation_at" timestamp with time zone DEFAULT now() NOT NULL;
      ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "booster_balance" integer DEFAULT 0 NOT NULL;
      ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "last_core_grant_at" timestamp with time zone;
    `);

        // 2. Create Mana Potions (if missing)
        console.log("Creating mana_potions table...");
        await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "mana_potions" (
        "user_id" text PRIMARY KEY NOT NULL,
        "small_potions" integer DEFAULT 0 NOT NULL,
        "medium_potions" integer DEFAULT 0 NOT NULL,
        "large_potions" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `);

        // 3. Create Enums (if missing)
        console.log("Creating enums...");
        await db.execute(sql`
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
    `);

        // 4. Create Referrals Table
        console.log("Creating referrals table...");
        await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "referrals" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "inviter_id" text NOT NULL,
        "invitee_id" text NOT NULL,
        "status" "referral_status" DEFAULT 'pending' NOT NULL,
        "rewards_claimed" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `);

        // 5. Create Gifts Table
        console.log("Creating gifts table...");
        await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "gifts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "sender_id" text NOT NULL,
        "recipient_id" text NOT NULL,
        "status" "gift_status" DEFAULT 'pending' NOT NULL,
        "expires_at" timestamp with time zone NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `);

        console.log("Schema fix complete.");
    } catch (e) {
        console.error("Error fixing schema:", e);
    }

    process.exit(0);
}

fixSchema().catch(console.error);
