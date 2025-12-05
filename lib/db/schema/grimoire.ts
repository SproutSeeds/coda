import { pgTable, text, uuid, integer, boolean, jsonb, timestamp, index, uniqueIndex, pgEnum } from "drizzle-orm/pg-core";
import { users, ideas } from "../schema";

// --- ENUMS ---
export const spellTypeEnum = pgEnum("spell_type", ["core", "custom", "community"]);

// --- SPELLS (The Registry) ---
export const spells = pgTable("spells", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull(), // e.g. 'summon-vision'
  name: text("name").notNull(),
  description: text("description"),

  type: spellTypeEnum("type").notNull().default("core"),

  // The Magic
  incantationTemplate: text("incantation_template").notNull(), // The System Prompt
  reagents: jsonb("reagents").$type<string[]>().notNull().default([]), // Required inputs (e.g. ["selectedFile", "goal"])

  // Economy
  baseManaCost: integer("base_mana_cost").notNull().default(10),

  // Meta
  authorId: text("author_id").references(() => users.id, { onDelete: "set null" }), // For custom spells
  isPublic: boolean("is_public").notNull().default(false), // Community spells

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  slugIdx: uniqueIndex("idx_spells_slug").on(table.slug),
  typeIdx: index("idx_spells_type").on(table.type),
}));

// --- GRIMOIRE (Inventory) ---
export const grimoireEntries = pgTable("grimoire_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  spellId: uuid("spell_id")
    .notNull()
    .references(() => spells.id, { onDelete: "cascade" }),

  isFavorite: boolean("is_favorite").notNull().default(false),
  masteryLevel: integer("mastery_level").notNull().default(0), // Gamification: Cast count

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userSpellUnique: uniqueIndex("uniq_grimoire_user_spell").on(table.userId, table.spellId),
}));

// --- SPELL CASTS (Memories) ---
export const spellCasts = pgTable("spell_casts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  spellId: uuid("spell_id")
    .notNull()
    .references(() => spells.id, { onDelete: "cascade" }),

  // Context
  ideaId: uuid("idea_id"), // Optional project context

  // Cost Paid
  manaCost: integer("mana_cost").notNull(),

  // Result
  inputContext: jsonb("input_context").notNull(), // The variables used
  outputResult: text("output_result"), // The result (nullable if failed)
  isSuccess: boolean("is_success").notNull().default(true),
  errorMessage: text("error_message"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userSpellIdx: index("idx_spell_casts_user_spell").on(table.userId, table.spellId),
  createdAtIdx: index("idx_spell_casts_created_at").on(table.createdAt),
}));
