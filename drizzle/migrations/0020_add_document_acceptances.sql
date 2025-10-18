CREATE TABLE "document_acceptances" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" text NOT NULL REFERENCES "auth_user"("id") ON DELETE cascade,
    "document_slug" text NOT NULL,
    "version" text NOT NULL,
    "accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
    "ip_address" text,
    "user_agent" text
);

CREATE UNIQUE INDEX "uniq_document_acceptance_user_doc_version"
    ON "document_acceptances" ("user_id", "document_slug", "version");

CREATE INDEX "idx_document_acceptances_document"
    ON "document_acceptances" ("document_slug", "version");
