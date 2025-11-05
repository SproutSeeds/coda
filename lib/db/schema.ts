import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid, primaryKey, integer, doublePrecision, index, boolean, date, uniqueIndex, pgEnum, jsonb, bigint } from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";

export const ideaVisibilityEnum = pgEnum("idea_visibility", ["private", "public"]);
export const ideaFeatureVisibilityEnum = pgEnum("idea_feature_visibility", ["inherit", "private"]);
export const ideaCollaboratorRoleEnum = pgEnum("idea_collaborator_role", ["owner", "editor", "commenter", "viewer"]);
export const ideaJoinRequestStatusEnum = pgEnum("idea_join_request_status", ["pending", "approved", "rejected"]);

export const ideas = pgTable("ideas", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  notes: text("notes").notNull(),
  position: doublePrecision("position").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  starred: boolean("starred").notNull().default(false),
  superStarred: boolean("super_starred").notNull().default(false),
  superStarredAt: timestamp("super_starred_at", { withTimezone: true }),
  githubUrl: text("github_url"),
  linkLabel: text("link_label").notNull().default("GitHub Repository"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  undoToken: text("undo_token"),
  undoExpiresAt: timestamp("undo_expires_at", { withTimezone: true }),
  visibility: ideaVisibilityEnum("visibility").notNull().default("private"),
}, (table) => ({
  userPositionIdx: index("idx_ideas_user_position").on(table.userId, table.position),
  userStarIdx: index("idx_ideas_user_star").on(table.userId, table.starred),
  userSuperStarIdx: index("idx_ideas_user_super_star").on(table.userId, table.superStarred),
}));

export const ideaFeatures = pgTable("idea_features", {
  id: uuid("id").defaultRandom().primaryKey(),
  ideaId: uuid("idea_id")
    .notNull()
    .references(() => ideas.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  notes: text("notes").notNull(),
  detail: text("detail").notNull().default(""),
  detailLabel: text("detail_label").notNull().default("Detail"),
  detailSections: jsonb("detail_sections")
    .$type<Array<{ id: string; label: string; body: string; position: number }>>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  position: doublePrecision("position").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  starred: boolean("starred").notNull().default(false),
  superStarred: boolean("super_starred").notNull().default(false),
  superStarredAt: timestamp("super_starred_at", { withTimezone: true }),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  visibility: ideaFeatureVisibilityEnum("visibility").notNull().default("inherit"),
}, (table) => ({
  ideaPositionIdx: index("idx_feature_idea_position").on(table.ideaId, table.position),
  ideaStarIdx: index("idx_feature_idea_star").on(table.ideaId, table.starred),
  ideaSuperStarIdx: index("idx_feature_idea_super_star").on(table.ideaId, table.superStarred),
}));


export const users = pgTable("auth_user", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  passwordHash: text("password_hash"),
});

export const accounts = pgTable(
  "auth_account",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccount["type"]>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey(account.provider, account.providerAccountId),
  }),
);

export const sessions = pgTable("auth_session", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const ideaCollaborators = pgTable("idea_collaborators", {
  id: uuid("id").defaultRandom().primaryKey(),
  ideaId: uuid("idea_id")
    .notNull()
    .references(() => ideas.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: ideaCollaboratorRoleEnum("role").notNull().default("editor"),
  invitedBy: text("invited_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  ideaUserUnique: uniqueIndex("uniq_idea_collaborators_idea_user").on(table.ideaId, table.userId),
  ideaRoleIdx: index("idx_idea_collaborators_role").on(table.ideaId, table.role),
}));

export const ideaCollaboratorInvites = pgTable("idea_collaborator_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  ideaId: uuid("idea_id")
    .notNull()
    .references(() => ideas.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: ideaCollaboratorRoleEnum("role").notNull().default("viewer"),
  token: text("token").notNull(),
  invitedBy: text("invited_by").references(() => users.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  ideaEmailUnique: uniqueIndex("uniq_idea_collaborator_invites_email").on(table.ideaId, table.email),
  tokenIdx: index("idx_idea_collaborator_invites_token").on(table.token),
}));

export const ideaJoinRequests = pgTable("idea_join_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  ideaId: uuid("idea_id")
    .notNull()
    .references(() => ideas.id, { onDelete: "cascade" }),
  applicantId: text("applicant_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  status: ideaJoinRequestStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  processedBy: text("processed_by").references(() => users.id, { onDelete: "set null" }),
  resolutionNote: text("resolution_note"),
  ownerSeenAt: timestamp("owner_seen_at", { withTimezone: true }),
  ownerArchivedAt: timestamp("owner_archived_at", { withTimezone: true }),
  ownerReaction: text("owner_reaction"),
  activityLog: jsonb("activity_log")
    .$type<
      Array<{
        id: string;
        type: "created" | "status_changed" | "owner_seen" | "owner_archived" | "owner_reaction";
        at: string;
        actorId: string | null;
        payload?: Record<string, unknown> | null;
      }>
    >()
    .notNull()
    .default(sql`'[]'::jsonb`),
}, (table) => ({
  ideaStatusIdx: index("idx_idea_join_requests_idea").on(table.ideaId, table.status),
  pendingUnique: uniqueIndex("uniq_idea_join_requests_pending")
    .on(table.ideaId, table.applicantId)
    .where(sql`${table.status} = 'pending'`),
}));

export const verificationTokens = pgTable(
  "auth_verification_token",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (verificationToken) => ({
    compositePk: primaryKey(verificationToken.identifier, verificationToken.token),
  }),
);

export const suggestions = pgTable(
  "suggestions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: text("owner_id").notNull(),
    submittedBy: text("submitted_by").references(() => users.id, { onDelete: "set null" }),
    submittedEmail: text("submitted_email"),
    title: text("title").notNull(),
    notes: text("notes").notNull(),
    position: doublePrecision("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    starred: boolean("starred").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    undoToken: text("undo_token"),
    undoExpiresAt: timestamp("undo_expires_at", { withTimezone: true }),
    completed: boolean("completed").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    ownerPositionIdx: index("idx_suggestions_owner_position").on(table.ownerId, table.position),
    ownerStarIdx: index("idx_suggestions_owner_star").on(table.ownerId, table.starred),
  }),
);

export const suggestionUpdates = pgTable(
  "suggestion_updates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    suggestionId: uuid("suggestion_id")
      .notNull()
      .references(() => suggestions.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
    authorEmail: text("author_email"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    suggestionIdx: index("idx_suggestion_updates_suggestion").on(table.suggestionId, table.createdAt),
  }),
);

export const meetupCheckins = pgTable(
  "meetup_checkins",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    eventDate: date("event_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    createdAtIdx: index("idx_meetup_checkins_created_at").on(table.createdAt),
    emailIdx: index("idx_meetup_checkins_email").on(table.email),
    userEventIdx: uniqueIndex("uniq_meetup_checkins_user_event").on(table.userId, table.eventDate),
  }),
);

export const themePreferenceThemeEnum = pgEnum("theme_preference_theme", ["light", "dark"]);
export const themePreferenceSourceEnum = pgEnum("theme_preference_source", ["explicit", "system-default", "restored"]);

export const themePreferences = pgTable(
  "theme_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    theme: themePreferenceThemeEnum("theme").notNull().default("dark"),
    source: themePreferenceSourceEnum("source").notNull().default("system-default"),
    promptDismissedAt: timestamp("prompt_dismissed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userUnique: uniqueIndex("uniq_theme_preferences_user").on(table.userId),
  }),
);

export const documentAcceptances = pgTable(
  "document_acceptances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    documentSlug: text("document_slug").notNull(),
    version: text("version").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).defaultNow().notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
  },
  (table) => ({
    userDocumentVersionUnique: uniqueIndex("uniq_document_acceptance_user_doc_version").on(
      table.userId,
      table.documentSlug,
      table.version,
    ),
    documentLookupIdx: index("idx_document_acceptances_document").on(table.documentSlug, table.version),
  }),
);

export const passwordVerifications = pgTable("auth_password_verification", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  attempts: integer("attempts").notNull().default(0),
});

// Dev Mode tables
export const devRunnerStatusEnum = pgEnum("dev_runner_status", ["online", "offline", "stale"]);

export const devRunners = pgTable(
  "dev_runners",
  {
    id: text("id").primaryKey(), // cuid
    name: text("name").notNull(),
    capabilities: jsonb("capabilities").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    status: devRunnerStatusEnum("status").notNull().default("offline"),
    lastHeartbeat: timestamp("last_heartbeat", { withTimezone: true }),
    attestation: jsonb("attestation"),
    tokenKid: text("token_kid"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index("idx_dev_runners_status").on(table.status),
  }),
);

export const devJobStateEnum = pgEnum("dev_job_state", [
  "queued",
  "dispatched",
  "running",
  "uploading",
  "succeeded",
  "failed",
  "canceled",
  "timed_out",
]);

export const devPreviewModeEnum = pgEnum("dev_preview_mode", ["direct", "proxied"]);

export const devJobs = pgTable(
  "dev_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ideaId: text("idea_id").notNull(),
    intent: text("intent").notNull(),
    command: text("command"),
    args: jsonb("args").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    env: jsonb("env"),
    timeoutMs: integer("timeout_ms").notNull().default(900000),
    repoProvider: text("repo_provider"),
    repo: text("repo"),
    branch: text("branch"),
    sha: text("sha"),
    state: devJobStateEnum("state").notNull().default("queued"),
    attempt: integer("attempt").notNull().default(0),
    idempotencyKey: text("idempotency_key").notNull(),
    runnerId: text("runner_id").references(() => devRunners.id, { onDelete: "set null" }),
    previewMode: devPreviewModeEnum("preview_mode"),
    previewUrl: text("preview_url"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => ({
    ideaIdx: index("idx_dev_jobs_idea_created").on(table.ideaId, table.createdAt),
    runnerStateIdx: index("idx_dev_jobs_runner_state").on(table.runnerId, table.state),
    idempotencyUnique: uniqueIndex("uniq_dev_jobs_idempotency").on(table.idempotencyKey),
  }),
);

export const devArtifacts = pgTable(
  "dev_artifacts",
  {
    id: text("id").primaryKey(), // cuid
    jobId: uuid("job_id")
      .notNull()
      .references(() => devJobs.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    path: text("path").notNull(),
    size: integer("size").notNull(),
    mime: text("mime").notNull(),
    sha256: text("sha256").notNull(),
    url: text("url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    jobIdx: index("idx_dev_artifacts_job").on(table.jobId),
  }),
);

export const devMessages = pgTable(
  "dev_messages",
  {
    id: text("id").primaryKey(), // cuid
    ideaId: text("idea_id").notNull(),
    jobId: uuid("job_id").notNull().references(() => devJobs.id, { onDelete: "cascade" }),
    runnerId: text("runner_id").references(() => devRunners.id, { onDelete: "set null" }),
    sender: text("sender").notNull(), // user|codex|system
    content: text("content").notNull(),
    meta: jsonb("meta"),
    seq: integer("seq").notNull(),
    ts: timestamp("ts", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    jobSeqIdx: index("idx_dev_messages_job_seq").on(table.jobId, table.seq),
    ideaTsIdx: index("idx_dev_messages_idea_ts").on(table.ideaId, table.ts),
  }),
);

export const devLogs = pgTable(
  "dev_logs",
  {
    id: text("id").primaryKey(), // cuid
    jobId: uuid("job_id").notNull().references(() => devJobs.id, { onDelete: "cascade" }),
    level: text("level").notNull(), // info|warn|error
    text: text("text").notNull(),
    seq: integer("seq").notNull(),
    ts: timestamp("ts", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    jobSeqIdx: index("idx_dev_logs_job_seq").on(table.jobId, table.seq),
  }),
);

export const devUsageSessions = pgTable(
  "dev_usage_sessions",
  {
    jobId: uuid("job_id")
      .primaryKey()
      .references(() => devJobs.id, { onDelete: "cascade" }),
    ideaId: text("idea_id").notNull(),
    userId: text("user_id").notNull(),
    payerType: text("payer_type").notNull(),
    payerId: text("payer_id").notNull(),
    runnerId: text("runner_id"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    durationMs: bigint("duration_ms", { mode: "number" }).notNull().default(0),
    logBytes: bigint("log_bytes", { mode: "number" }).notNull().default(0),
    costLoggedAt: timestamp("cost_logged_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("idx_dev_usage_sessions_user").on(table.userId, table.createdAt),
    ideaIdx: index("idx_dev_usage_sessions_idea").on(table.ideaId, table.createdAt),
  }),
);
// Dev Mode pairing codes
export const devPairings = pgTable(
  "dev_pairings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    state: text("state").notNull().default("pending"),
    userId: text("user_id"),
    runnerId: text("runner_id"),
    deviceId: text("device_id"), // Stable device identifier (e.g., hostname-username)
    runnerToken: text("runner_token"),
    runnerTokenJti: text("runner_token_jti"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull().default(sql`(now() + interval '10 minutes')`),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
  },
  (table) => ({
    codeIdx: index("idx_dev_pairings_code").on(table.code),
    deviceIdx: index("idx_dev_pairings_device_id").on(table.deviceId),
    userRunnerIdx: index("idx_dev_pairings_user_runner").on(table.userId, table.runnerId).where(sql`state = 'approved'`),
  }),
);
