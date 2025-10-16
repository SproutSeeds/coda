import { pgTable, text, timestamp, uuid, primaryKey, integer, doublePrecision, index, boolean, date, uniqueIndex, pgEnum } from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";

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
  position: doublePrecision("position").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  starred: boolean("starred").notNull().default(false),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => ({
  ideaPositionIdx: index("idx_feature_idea_position").on(table.ideaId, table.position),
  ideaStarIdx: index("idx_feature_idea_star").on(table.ideaId, table.starred),
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
