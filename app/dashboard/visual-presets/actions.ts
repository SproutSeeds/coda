"use server";

import { and, count, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import {
  visualPresets,
  type CloudPresetSettings,
  type VisualPreset,
  type VisualPresetMode,
} from "@/lib/db/schema/visual-presets";
import { requireUser } from "@/lib/auth/session";

const MAX_CLOUD_PRESETS = 50;
const db = getDb();

export type CreatePresetInput = {
  name: string;
  description?: string;
  settings: CloudPresetSettings;
  mode: VisualPresetMode;
};

export type UpdatePresetInput = {
  name?: string;
  description?: string;
  settings?: CloudPresetSettings;
};

/**
 * Create a new cloud preset
 * Enforces 50 preset limit per user
 */
export async function createPreset(input: CreatePresetInput): Promise<VisualPreset> {
  const user = await requireUser();

  // Check limit
  const [{ presetCount }] = await db
    .select({ presetCount: count() })
    .from(visualPresets)
    .where(eq(visualPresets.userId, user.id));

  if (presetCount >= MAX_CLOUD_PRESETS) {
    throw new Error(`Maximum ${MAX_CLOUD_PRESETS} cloud presets allowed. Please delete some presets first.`);
  }

  const [preset] = await db
    .insert(visualPresets)
    .values({
      userId: user.id,
      name: input.name,
      description: input.description ?? null,
      settings: input.settings,
      mode: input.mode,
    })
    .returning();

  revalidatePath("/dashboard");
  return preset;
}

/**
 * List all presets for the current user
 */
export async function listPresets(): Promise<VisualPreset[]> {
  const user = await requireUser();

  return db
    .select()
    .from(visualPresets)
    .where(eq(visualPresets.userId, user.id))
    .orderBy(desc(visualPresets.createdAt));
}

/**
 * Get a single preset by ID
 */
export async function getPreset(id: string): Promise<VisualPreset | null> {
  const user = await requireUser();

  const [preset] = await db
    .select()
    .from(visualPresets)
    .where(and(eq(visualPresets.id, id), eq(visualPresets.userId, user.id)));

  return preset ?? null;
}

/**
 * Update an existing preset
 */
export async function updatePreset(id: string, input: UpdatePresetInput): Promise<VisualPreset> {
  const user = await requireUser();

  const [preset] = await db
    .update(visualPresets)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.settings !== undefined && { settings: input.settings }),
      updatedAt: new Date(),
    })
    .where(and(eq(visualPresets.id, id), eq(visualPresets.userId, user.id)))
    .returning();

  if (!preset) {
    throw new Error("Preset not found or access denied");
  }

  revalidatePath("/dashboard");
  return preset;
}

/**
 * Delete a preset
 */
export async function deletePreset(id: string): Promise<void> {
  const user = await requireUser();

  const deleted = await db
    .delete(visualPresets)
    .where(and(eq(visualPresets.id, id), eq(visualPresets.userId, user.id)))
    .returning({ id: visualPresets.id });

  if (deleted.length === 0) {
    throw new Error("Preset not found or access denied");
  }

  revalidatePath("/dashboard");
}

/**
 * Get count of presets for current user
 */
export async function getPresetCount(): Promise<{ count: number; max: number }> {
  const user = await requireUser();

  const [{ presetCount }] = await db
    .select({ presetCount: count() })
    .from(visualPresets)
    .where(eq(visualPresets.userId, user.id));

  return { count: presetCount, max: MAX_CLOUD_PRESETS };
}
