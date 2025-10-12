import { and, desc, eq } from "drizzle-orm";

import { getDb } from "./index";
import { meetupCheckins } from "./schema";

const SCHEMA_NOT_READY_CODES = new Set(["42P01", "42703", "42883"]);
const SCHEMA_NOT_READY_SNIPPETS = [
  "relation \"meetup_checkins\"",
  "relation \"public.meetup_checkins\"",
  "column \"user_id\" does not exist",
];

function isSchemaNotReady(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: string; message?: string };
  if (code && SCHEMA_NOT_READY_CODES.has(code)) {
    return true;
  }
  if (typeof message === "string") {
    const lower = message.toLowerCase();
    return SCHEMA_NOT_READY_SNIPPETS.some((snippet) => lower.includes(snippet));
  }
  return false;
}

type RecordMeetupCheckInInput = {
  userId: string;
  email: string;
  eventDate: string;
};

export async function recordMeetupCheckIn({ userId, email, eventDate }: RecordMeetupCheckInInput) {
  const db = getDb();

  try {
    const insertResult = await db
      .insert(meetupCheckins)
      .values({ userId, email, eventDate })
      .onConflictDoNothing({ target: [meetupCheckins.userId, meetupCheckins.eventDate] })
      .returning({ id: meetupCheckins.id });

    const alreadyCheckedIn = insertResult.length === 0;

    return { alreadyCheckedIn };
  } catch (error) {
    if (isSchemaNotReady(error)) {
      console.warn("[meetup-checkins] Skipping insert; table unavailable.");
      return { alreadyCheckedIn: false };
    }
    throw error;
  }
}

export async function getUserMeetupAttendance(userId: string) {
  const db = getDb();

  try {
    const rows = await db
      .select({
        id: meetupCheckins.id,
        eventDate: meetupCheckins.eventDate,
        createdAt: meetupCheckins.createdAt,
      })
      .from(meetupCheckins)
      .where(eq(meetupCheckins.userId, userId))
      .orderBy(desc(meetupCheckins.eventDate), desc(meetupCheckins.createdAt));

    return rows;
  } catch (error) {
    console.warn("[meetup-checkins] Failed to load attendance; falling back to empty list.", error);
    if (isSchemaNotReady(error)) {
      return [];
    }
    return [];
  }
}

export async function hasUserCheckedInForEvent(userId: string, eventDate: string) {
  const db = getDb();

  try {
    const existing = await db
      .select({ id: meetupCheckins.id })
      .from(meetupCheckins)
      .where(and(eq(meetupCheckins.userId, userId), eq(meetupCheckins.eventDate, eventDate)))
      .limit(1);

    return existing.length > 0;
  } catch (error) {
    console.warn("[meetup-checkins] Failed to check event attendance; treating as not checked in.", error);
    if (isSchemaNotReady(error)) {
      return false;
    }
    return false;
  }
}
