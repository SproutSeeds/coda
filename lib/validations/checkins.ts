import { z } from "zod";

export const meetupCheckInSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email"),
});

export type MeetupCheckInInput = z.infer<typeof meetupCheckInSchema>;
