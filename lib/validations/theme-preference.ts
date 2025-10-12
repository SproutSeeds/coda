import { z } from "zod";

export const themePreferenceSourceValues = ["explicit", "system-default", "restored"] as const;
export const themePreferenceThemeValues = ["light", "dark"] as const;

export const themePreferenceInputSchema = z.object({
  theme: z.enum(themePreferenceThemeValues),
  source: z.enum(themePreferenceSourceValues).default("explicit"),
});

export type ThemePreferenceInput = z.infer<typeof themePreferenceInputSchema>;

export const themePreferenceRecordSchema = themePreferenceInputSchema.extend({
  userId: z.string().min(1),
  promptDismissedAt: z.date().optional().nullable(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

