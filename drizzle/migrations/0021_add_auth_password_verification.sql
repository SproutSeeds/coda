CREATE TABLE "auth_password_verification" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "email" text NOT NULL,
    "user_id" text,
    "token_hash" text NOT NULL,
    "password_hash" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL
);

ALTER TABLE "auth_password_verification"
ADD CONSTRAINT "auth_password_verification_user_id_auth_user_id_fk"
FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "idx_password_verification_email"
ON "auth_password_verification" USING btree ("email");
