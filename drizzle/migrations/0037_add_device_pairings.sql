-- Device Pairing for Coda Home Server authentication
CREATE TYPE "public"."device_pairing_status" AS ENUM('pending', 'authorized', 'expired');

CREATE TABLE IF NOT EXISTS "device_pairings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "device_code" text NOT NULL UNIQUE,
  "device_name" text,
  "user_id" text REFERENCES "auth_user"("id") ON DELETE CASCADE,
  "status" "device_pairing_status" DEFAULT 'pending' NOT NULL,
  "token" text,
  "jti" text,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "authorized_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "idx_device_pairings_device_code" ON "device_pairings" USING btree ("device_code");
CREATE INDEX IF NOT EXISTS "idx_device_pairings_user" ON "device_pairings" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_device_pairings_status" ON "device_pairings" USING btree ("status");
