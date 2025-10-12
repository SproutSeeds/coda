"use server";

import { findOrCreateUserByEmail } from "@/lib/auth/users";
import { recordMeetupCheckIn } from "@/lib/db/meetup";
import { meetupCheckInSchema } from "@/lib/validations/checkins";

type SuccessState = "recorded" | "already";

type ActionResult =
  | { success: true; message: string; state: SuccessState }
  | { success: false; message: string; fieldErrors?: Record<string, string> };

const MEETUP_TIME_ZONE = "America/Chicago";

function resolveCstContext(date: Date) {
  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: MEETUP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: MEETUP_TIME_ZONE,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: MEETUP_TIME_ZONE,
    weekday: "short",
  });

  const eventDate = dateFormatter.format(date);
  const weekday = weekdayFormatter.format(date).toLowerCase();
  const timeParts = timeFormatter.formatToParts(date);
  const hour = Number(timeParts.find((part) => part.type === "hour")?.value ?? "0");

  return { eventDate, weekday, hour };
}

export async function submitMeetupCheckIn(formData: FormData): Promise<ActionResult> {
  const raw = {
    email: formData.get("email"),
  };

  const parsed = meetupCheckInSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const [field, issues] of Object.entries(parsed.error.flatten().fieldErrors)) {
      if (issues && issues.length > 0) {
        fieldErrors[field] = issues[0];
      }
    }
    return {
      success: false,
      message: "Enter a valid email to check in.",
      fieldErrors,
    };
  }

  const now = new Date();
  const { eventDate, weekday, hour } = resolveCstContext(now);
  const isSaturday = weekday === "sat";
  const withinWindow = hour >= 11 && hour < 13;

  if (!isSaturday || !withinWindow) {
    return {
      success: false,
      message: "Check-in opens Saturdays from 11am – 1pm CST. Swing by during the meetup window to earn rewards.",
    };
  }

  try {
    const user = await findOrCreateUserByEmail(parsed.data.email);
    const record = await recordMeetupCheckIn({
      userId: user.id,
      email: parsed.data.email,
      eventDate,
    });

    return {
      success: true,
      state: record.alreadyCheckedIn ? "already" : "recorded",
      message: record.alreadyCheckedIn
        ? "You were already checked in for this meetup—we've still sent a fresh magic link."
        : "You're checked in! Check your inbox for the magic sign-in link.",
    };
  } catch (error) {
    console.error("meetup check-in failed", error);
    return {
      success: false,
      message: "Something went wrong while saving your check-in. Please try again.",
    };
  }
}
