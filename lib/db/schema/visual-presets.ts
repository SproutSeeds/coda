import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "../schema";

/**
 * Settings type matching ModeSettings in GlobalVisualShell.tsx
 * Cloud presets store settings only - no particle/camera data
 */
export type CloudPresetSettings = {
  backgroundColor: string;
  tubeSpeed: number;
  particleSpeed: number;
  tubesOpacity: number;
  particlesOpacity: number;
  colorIntensity: number;
  mouseFollow: boolean;
  enableCollision: boolean;
  collisionRadius: number;
  collisionStrength: number;
  panelOpacity: number;
  customTubeColors: string[] | null;
  idleTimeout: number;
  tubeRadius: number;
  particleCount: number;
  pulseOnClick: boolean;
  fogIntensity: number;
  particleShape: string;
  particleRotation: number;
  enableFlightControls: boolean;
  flightSpeed: number;
  lookSensitivity: number;
};

export const visualPresetModeEnum = ["flow", "focus"] as const;
export type VisualPresetMode = (typeof visualPresetModeEnum)[number];

export const visualPresets = pgTable(
  "visual_presets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    settings: jsonb("settings").$type<CloudPresetSettings>().notNull(),
    mode: text("mode").$type<VisualPresetMode>().notNull().default("flow"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("idx_visual_presets_user").on(table.userId),
    userNameIdx: index("idx_visual_presets_user_name").on(table.userId, table.name),
  })
);

export type VisualPreset = typeof visualPresets.$inferSelect;
export type VisualPresetInsert = typeof visualPresets.$inferInsert;
