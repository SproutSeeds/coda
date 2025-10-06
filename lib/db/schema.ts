import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const ideas = pgTable("ideas", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  notes: text("notes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  undoToken: text("undo_token"),
  undoExpiresAt: timestamp("undo_expires_at", { withTimezone: true }),
});
