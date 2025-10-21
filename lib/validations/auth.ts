import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .email("Enter a valid email address.")
  .max(320, "Email address is too long.")
  .toLowerCase();

export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters long.")
  .max(128, "Password must be shorter than 128 characters.")
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, "Include upper, lower, and a number for extra security.");

export const updatePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: passwordSchema,
});

export const passwordSignUpSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords must match.",
    path: ["confirmPassword"],
  });

export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
export type PasswordSignUpInput = z.infer<typeof passwordSignUpSchema>;
