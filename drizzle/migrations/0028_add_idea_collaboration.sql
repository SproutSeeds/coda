DO $$ BEGIN
  CREATE TYPE "idea_visibility" AS ENUM ('private', 'public');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "idea_feature_visibility" AS ENUM ('inherit', 'private');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "idea_collaborator_role" AS ENUM ('owner', 'editor', 'commenter', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "ideas"
  ADD COLUMN IF NOT EXISTS "visibility" "idea_visibility" NOT NULL DEFAULT 'private';

ALTER TABLE "idea_features"
  ADD COLUMN IF NOT EXISTS "visibility" "idea_feature_visibility" NOT NULL DEFAULT 'inherit';

CREATE TABLE IF NOT EXISTS "idea_collaborators" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "idea_id" uuid NOT NULL REFERENCES "ideas"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "auth_user"("id") ON DELETE CASCADE,
  "role" "idea_collaborator_role" NOT NULL DEFAULT 'editor',
  "invited_by" text REFERENCES "auth_user"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_idea_collaborators_idea_user"
  ON "idea_collaborators" ("idea_id", "user_id");

CREATE INDEX IF NOT EXISTS "idx_idea_collaborators_role"
  ON "idea_collaborators" ("idea_id", "role");

CREATE TABLE IF NOT EXISTS "idea_collaborator_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "idea_id" uuid NOT NULL REFERENCES "ideas"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "role" "idea_collaborator_role" NOT NULL DEFAULT 'viewer',
  "token" text NOT NULL,
  "invited_by" text REFERENCES "auth_user"("id") ON DELETE SET NULL,
  "expires_at" timestamptz NOT NULL,
  "accepted_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_idea_collaborator_invites_email"
  ON "idea_collaborator_invites" ("idea_id", "email");

CREATE INDEX IF NOT EXISTS "idx_idea_collaborator_invites_token"
  ON "idea_collaborator_invites" ("token");

INSERT INTO "idea_collaborators" ("idea_id", "user_id", "role", "invited_by")
SELECT i."id", i."user_id", 'owner', i."user_id"
FROM "ideas" i
INNER JOIN "auth_user" u ON u."id" = i."user_id"
ON CONFLICT ("idea_id", "user_id") DO NOTHING;
