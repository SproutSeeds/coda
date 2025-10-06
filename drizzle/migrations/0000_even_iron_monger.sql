CREATE TABLE "auth_account" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "auth_account_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "auth_session" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"image" text
);
--> statement-breakpoint
CREATE TABLE "auth_verification_token" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "auth_verification_token_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "ideas" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;