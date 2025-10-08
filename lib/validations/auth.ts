import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters long.")
  .max(128, "Password must be shorter than 128 characters.")
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, "Include upper, lower, and a number for extra security.");

export const updatePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: passwordSchema,
});

export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
